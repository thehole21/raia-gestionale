create table public.raia_customers (
 user_id uuid primary key references auth.users(id), client_id text unique not null,
 details jsonb not null, created_at timestamptz not null default now()
);
create table public.raia_quotes (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.raia_customers(user_id),
 spec jsonb not null, book_path text not null, cover_path text not null,
 order_id text unique, status text not null default 'processing' check(status in ('processing','confirmed','shipped','delivered')),
 carrier text, tracking_number text, tracking_updated_at timestamptz,
 created_at timestamptz not null default now(), confirmed_at timestamptz
);
create index raia_quotes_owner on public.raia_quotes(user_id,created_at desc);
create table public.raia_tracking_events (
 provider text not null, event_id text not null, quote_id uuid not null references public.raia_quotes(id),
 status text not null check(status in ('shipped','delivered')), occurred_at timestamptz not null,
 primary key(provider,event_id)
);
create index raia_tracking_events_quote on public.raia_tracking_events(quote_id);
alter table public.raia_customers enable row level security;
alter table public.raia_quotes enable row level security;
alter table public.raia_tracking_events enable row level security;
revoke all on public.raia_customers,public.raia_quotes,public.raia_tracking_events from anon,authenticated;
grant select on public.raia_customers,public.raia_quotes to authenticated;
grant all on public.raia_customers,public.raia_quotes,public.raia_tracking_events to service_role;
create policy customers_read on public.raia_customers for select to authenticated using(user_id=(select auth.uid()) or (select raia_private.raia_role()) is not null);
create policy quotes_read on public.raia_quotes for select to authenticated using(user_id=(select auth.uid()) or (select raia_private.raia_role()) is not null);
create policy tracking_staff_read on public.raia_tracking_events for select to authenticated using((select raia_private.raia_role()) is not null);
grant select on public.raia_tracking_events to authenticated;

-- Customer metadata is contact information only, never an authorization role.
create function raia_private.raia_register_customer() returns trigger language plpgsql security definer set search_path='' as $$
declare d jsonb; c jsonb; cid text;
begin
 if new.raw_user_meta_data->>'raia_customer' is distinct from 'true' then return new; end if;
 d:=new.raw_user_meta_data->'customer';
 if jsonb_typeof(d) is distinct from 'object' or length(coalesce(d->>'name','')) not between 2 and 160 or octet_length(d::text)>12000 then raise exception 'INVALID_CUSTOMER'; end if;
 cid:='customer_'||new.id::text;
 c:=jsonb_build_object('id',cid,'name',d->>'name','email',new.email,'phone',left(coalesce(d->>'phone',''),60),'vat',left(coalesce(d->>'vat',''),30),'taxCode',left(coalesce(d->>'taxCode',''),30),'recipientCode',left(coalesce(d->>'recipientCode',''),20),'pec',left(coalesce(d->>'pec',''),254),'address',left(coalesce(d->>'address',''),250),'postalCode',left(coalesce(d->>'postalCode',''),20),'city',left(coalesce(d->>'city',''),100),'province',left(coalesce(d->>'province',''),60),'country',left(coalesce(d->>'country','IT'),60));
 insert into public.raia_customers(user_id,client_id,details) values(new.id,cid,c);
 update public.raia_workspace set payload=jsonb_set(payload,'{clients}',(payload->'clients')||jsonb_build_array(c)),revision=revision+1 where id=1;
 return new;
end $$;
revoke all on function raia_private.raia_register_customer() from public,anon,authenticated;
create trigger raia_customer_registration after insert on auth.users for each row execute function raia_private.raia_register_customer();

create function raia_private.raia_submit_quote(request_id uuid, specification jsonb, book_file text, cover_file text) returns uuid language plpgsql security definer set search_path='' as $$
declare customer public.raia_customers; existing public.raia_quotes; oid text; n text; new_order jsonb; k text;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'CONFIRM_EMAIL'; end if;
 select * into customer from public.raia_customers where user_id=auth.uid();
 if not found then raise exception 'CUSTOMER_REQUIRED'; end if;
 -- Serialize retries and duplicate submissions with the same idempotency UUID.
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into existing from public.raia_quotes where id=request_id;
 if found then
  if existing.user_id<>auth.uid() then raise exception 'FORBIDDEN'; end if;
  return existing.id;
 end if;
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
 if (select count(*) from public.raia_quotes where user_id=auth.uid() and created_at>now()-interval '1 day')>=30 then raise exception 'DAILY_LIMIT'; end if;
 if book_file=cover_file then raise exception 'TWO_PDFS_REQUIRED'; end if;
 foreach k in array array[book_file,cover_file] loop
  if k is null or split_part(k,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='raia-customer-files' and name=k and lower(metadata->>'mimetype')='application/pdf') then raise exception 'FILE_REQUIRED'; end if;
 end loop;
 oid:='web_'||request_id::text; n:='WEB-'||upper(replace(request_id::text,'-',''));
 new_order:=jsonb_build_object('id',oid,'number',n,'customerRequestId',request_id,'clientId',customer.client_id,'created',to_char(now() at time zone 'Europe/Rome','YYYY-MM-DD'),'executionDate','','due','','notes','Richiesta dal portale clienti. Prezzo da definire.','lines',jsonb_build_array(jsonb_build_object('id',oid||'_book','description',specification->>'title','qty',(specification->>'copies')::int,'unit','pz','price',0,'status','Preventivo','operatorId','','invoiceId',null,'notes','Specifiche e PDF nella sezione Richiesta cliente.')));
 insert into public.raia_quotes(id,user_id,spec,book_path,cover_path,order_id) values(request_id,auth.uid(),specification,book_file,cover_file,oid);
 update public.raia_workspace set payload=jsonb_set(payload,'{orders}',jsonb_build_array(new_order)||(payload->'orders')),revision=revision+1 where id=1;
 return request_id;
end $$;
revoke all on function raia_private.raia_submit_quote(uuid,jsonb,text,text) from public;
grant execute on function raia_private.raia_submit_quote(uuid,jsonb,text,text) to authenticated;
create function public.raia_submit_quote(request_id uuid,specification jsonb,book_file text,cover_file text) returns uuid language sql security invoker set search_path='' as $$ select raia_private.raia_submit_quote(request_id,specification,book_file,cover_file) $$;
revoke all on function public.raia_submit_quote(uuid,jsonb,text,text) from public,anon;
grant execute on function public.raia_submit_quote(uuid,jsonb,text,text) to authenticated;

create function raia_private.raia_manage_quote(quote_id uuid, confirm_order boolean, carrier_name text, tracking_code text) returns void language plpgsql security definer set search_path='' as $$
begin
 if raia_private.raia_role() is null then raise exception 'FORBIDDEN'; end if;
 if length(coalesce(carrier_name,''))>100 or length(coalesce(tracking_code,''))>150 then raise exception 'INVALID_TRACKING'; end if;
 if (coalesce(carrier_name,'')='')<>(coalesce(tracking_code,'')='') then raise exception 'TRACKING_PAIR_REQUIRED'; end if;
 update public.raia_quotes set status=case when confirm_order and status='processing' then 'confirmed' else status end,confirmed_at=case when confirm_order then coalesce(confirmed_at,now()) else confirmed_at end,carrier=nullif(trim(carrier_name),''),tracking_number=nullif(trim(tracking_code),'') where id=quote_id;
 if not found then raise exception 'NOT_FOUND'; end if;
end $$;
revoke all on function raia_private.raia_manage_quote(uuid,boolean,text,text) from public;
grant execute on function raia_private.raia_manage_quote(uuid,boolean,text,text) to authenticated;
create function public.raia_manage_quote(quote_id uuid,confirm_order boolean,carrier_name text,tracking_code text) returns void language sql security invoker set search_path='' as $$ select raia_private.raia_manage_quote(quote_id,confirm_order,carrier_name,tracking_code) $$;
revoke all on function public.raia_manage_quote(uuid,boolean,text,text) from public,anon;
grant execute on function public.raia_manage_quote(uuid,boolean,text,text) to authenticated;

-- Called only by a future server adapter AFTER verifying the carrier webhook signature.
create function raia_private.raia_tracking_event(provider_name text,external_event_id text,quote_id uuid,tracking_code text,event_status text,event_time timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare q public.raia_quotes;
begin
 if coalesce(provider_name,'')='' or coalesce(external_event_id,'')='' or event_status not in ('shipped','delivered') or event_time is null or event_time>now()+interval '5 minutes' then raise exception 'INVALID_EVENT'; end if;
 select * into q from public.raia_quotes where id=quote_id for update;
 if not found or q.status='processing' or q.tracking_number is null or q.tracking_number is distinct from tracking_code or q.carrier is distinct from provider_name then raise exception 'TRACKING_MISMATCH'; end if;
 insert into public.raia_tracking_events values(provider_name,external_event_id,quote_id,event_status,event_time) on conflict do nothing;
 if not found then return; end if;
 if q.status='delivered' or (q.tracking_updated_at is not null and event_time<q.tracking_updated_at) then return; end if;
 update public.raia_quotes set status=event_status,tracking_updated_at=event_time where id=quote_id;
end $$;
revoke all on function raia_private.raia_tracking_event(text,text,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function raia_private.raia_tracking_event(text,text,uuid,text,text,timestamptz) to service_role;
create function public.raia_tracking_event(provider_name text,external_event_id text,quote_id uuid,tracking_code text,event_status text,event_time timestamptz) returns void language sql security invoker set search_path='' as $$ select raia_private.raia_tracking_event(provider_name,external_event_id,quote_id,tracking_code,event_status,event_time) $$;
revoke all on function public.raia_tracking_event(text,text,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.raia_tracking_event(text,text,uuid,text,text,timestamptz) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('raia-customer-files','raia-customer-files',false,20971520,array['application/pdf']);
create policy customer_files_read on storage.objects for select to authenticated using(bucket_id='raia-customer-files' and ((select raia_private.raia_role()) is not null or (storage.foldername(name))[1]=(select auth.uid())::text));
create policy customer_files_insert on storage.objects for insert to authenticated with check(bucket_id='raia-customer-files' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.raia_customers where user_id=(select auth.uid())));
-- Files are immutable. Submitted originals cannot be replaced or deleted by customers.
