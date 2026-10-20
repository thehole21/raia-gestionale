alter table public.raia_quotes alter column user_id drop not null;
alter table public.raia_quotes add column created_by uuid references auth.users(id);
alter table public.raia_quotes add column source text not null default 'customer' check(source in ('customer','staff'));
create index raia_quotes_created_by on public.raia_quotes(created_by);
create policy staff_quote_files_insert on storage.objects for insert to authenticated with check(bucket_id='raia-customer-files' and (select raia_private.raia_role()) is not null and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy customer_staff_quote_files_read on storage.objects for select to authenticated using(bucket_id='raia-customer-files' and exists(select 1 from public.raia_quotes q where q.user_id=(select auth.uid()) and (q.book_path=name or q.cover_path=name)));
create function raia_private.raia_submit_staff_quote(request_id uuid, specification jsonb, book_file text, cover_file text, target_client_id text, assigned_to text) returns uuid language plpgsql security definer set search_path='' as $$
declare customer public.raia_customers; ws public.raia_workspace; existing public.raia_quotes; oid text; n text; new_order jsonb; k text;
begin
 if raia_private.raia_role() is null then raise exception 'FORBIDDEN'; end if;
 -- Serialize retries and duplicate submissions with the same idempotency UUID.
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into existing from public.raia_quotes where id=request_id;
 if found then
  if existing.created_by is distinct from auth.uid() or existing.source<>'staff' then raise exception 'FORBIDDEN'; end if;
  return existing.id;
 end if;
 select * into ws from public.raia_workspace where id=1 for update;
 if not exists(select 1 from jsonb_array_elements(ws.payload->'clients') c where c->>'id'=target_client_id) then raise exception 'CLIENT_REQUIRED'; end if;
 select * into customer from public.raia_customers where client_id=target_client_id;
 if assigned_to is null then
  select case when title='Tecnico' then '' else id::text end into assigned_to from public.raia_profiles where id=auth.uid();
 end if;
 if assigned_to<>'' and not exists(select 1 from jsonb_array_elements(ws.payload->'operators') o where o->>'id'=assigned_to) then raise exception 'INVALID_ASSIGNEE'; end if;
 if exists(select 1 from public.raia_profiles where id::text=assigned_to and title='Tecnico') then raise exception 'TECHNICIAN_NOT_ASSIGNABLE'; end if;
 if jsonb_typeof(specification) is distinct from 'object' or octet_length(specification::text)>12000 then raise exception 'INVALID_SPEC'; end if;
 foreach k in array array['pages','copies','paperWeight','colorPages'] loop
  if coalesce(specification->>k,'') !~ '^\d{1,6}$' then raise exception 'INVALID_NUMBER'; end if;
 end loop;
 if (specification->>'pages')::int not between 1 and 5000 or (specification->>'copies')::int not between 1 and 100000 or (specification->>'paperWeight')::int not between 60 and 400 or (specification->>'colorPages')::int > (specification->>'pages')::int
 or coalesce(specification->>'format','') not in ('A4','A5','A6','B5')
 or coalesce(specification->>'paper','') not in ('Uso mano','Patinata opaca','Patinata lucida')
 or coalesce(specification->>'print','') not in ('Bianco e nero','A colori','Bianco e nero con inserti a colori')
 or coalesce(specification->>'cover','') not in ('Morbida','Rigida','Da definire')
 or length(coalesce(specification->>'title','')) not between 1 and 160 then raise exception 'INVALID_SPEC'; end if;
 if (select count(*) from public.raia_quotes where created_by=auth.uid() and created_at>now()-interval '1 day')>=100 then raise exception 'DAILY_LIMIT'; end if;
 if book_file=cover_file then raise exception 'TWO_PDFS_REQUIRED'; end if;
 foreach k in array array[book_file,cover_file] loop
  if k is null or split_part(k,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='raia-customer-files' and name=k and lower(metadata->>'mimetype')='application/pdf') then raise exception 'FILE_REQUIRED'; end if;
 end loop;
 oid:='staff_'||request_id::text; n:='STAFF-'||upper(replace(request_id::text,'-',''));
 new_order:=jsonb_build_object('id',oid,'number',n,'customerRequestId',request_id,'clientId',target_client_id,'created',to_char(now() at time zone 'Europe/Rome','YYYY-MM-DD'),'executionDate','','due','','notes','Ordine inserito e confermato dallo staff. Prezzo da definire.','lines',jsonb_build_array(jsonb_build_object('id',oid||'_book','description',specification->>'title','qty',(specification->>'copies')::int,'unit','pz','price',0,'status','Da elaborare','operatorId',assigned_to,'invoiceId',null,'notes','Specifiche e PDF nella sezione Richiesta cliente.')));
 insert into public.raia_quotes(id,user_id,spec,book_path,cover_path,order_id,created_by,source,status,confirmed_at) values(request_id,customer.user_id,specification,book_file,cover_file,oid,auth.uid(),'staff','confirmed',now());
 update public.raia_workspace set payload=jsonb_set(payload,'{orders}',jsonb_build_array(new_order)||(payload->'orders')),revision=revision+1 where id=1;
 return request_id;
end $$;

revoke all on function raia_private.raia_submit_staff_quote(uuid,jsonb,text,text,text,text) from public,anon;
grant execute on function raia_private.raia_submit_staff_quote(uuid,jsonb,text,text,text,text) to authenticated;
create function public.raia_submit_staff_quote(request_id uuid,specification jsonb,book_file text,cover_file text,target_client_id text,assigned_to text default null) returns uuid language sql security invoker set search_path='' as $$ select raia_private.raia_submit_staff_quote(request_id,specification,book_file,cover_file,target_client_id,assigned_to) $$;
revoke all on function public.raia_submit_staff_quote(uuid,jsonb,text,text,text,text) from public,anon;
grant execute on function public.raia_submit_staff_quote(uuid,jsonb,text,text,text,text) to authenticated;
