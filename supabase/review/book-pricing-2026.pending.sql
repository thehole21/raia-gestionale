-- RAIA listino LIBRI 2026: all arithmetic numeric, final line totals rounded to cents.
create or replace function raia_private.book_price(spec jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
 books jsonb; b jsonb; items jsonb:='[]'; kind text:=coalesce(spec->>'orderKind','standard');
 pages integer; copies integer; weight integer; color_pages integer; shipments integer;
 small boolean; ivory boolean; flaps boolean; kg numeric; base numeric; discount numeric; net numeric;
 total numeric:=0; minimum_fee numeric:=0; short_run boolean:=false; k text;
begin
 if jsonb_typeof(spec) is distinct from 'object' or spec->>'pricingVersion' is distinct from 'raia-libri-2026-03-v1'
 or kind not in ('standard','sample','mixed') or jsonb_typeof(coalesce(spec->'additionalBooks','[]')) is distinct from 'array'
 or coalesce(spec->>'shipments','0') !~ '^[0-9]{1,6}$' then raise exception 'INVALID_SPEC'; end if;
 shipments:=coalesce(spec->>'shipments','0')::integer;
 if shipments>100000 then raise exception 'INVALID_SHIPMENTS'; end if;
 books:=jsonb_build_array(spec)||coalesce(spec->'additionalBooks','[]');
 if jsonb_array_length(books)>10 or (kind='mixed' and jsonb_array_length(books)<2)
 or (kind<>'mixed' and jsonb_array_length(books)<>1) then raise exception 'INVALID_TITLES'; end if;
 for b in select value from jsonb_array_elements(books) loop
  foreach k in array array['pages','copies','paperWeight','colorPages'] loop
   if coalesce(b->>k,'') !~ '^[0-9]{1,6}$' then raise exception 'INVALID_NUMBER'; end if;
  end loop;
  pages:=(b->>'pages')::integer;copies:=(b->>'copies')::integer;
  weight:=(b->>'paperWeight')::integer;color_pages:=(b->>'colorPages')::integer;
  if pages not between 1 and 5000 or copies not between 1 and 100000 or color_pages>pages
  or weight not in (80,90,100) or coalesce(b->>'format','') not in ('15x21','17x24')
  or coalesce(b->>'paper','') not in ('Uso mano','Edizioni avorio 80 gr M. 1,6')
  or (b->>'paper'='Edizioni avorio 80 gr M. 1,6' and weight<>80)
  or coalesce(b->>'cover','') not in ('Patinata 250 g plastificata','Marcata 250 g')
  or jsonb_typeof(b->'flaps') is distinct from 'boolean'
  or length(trim(coalesce(b->>'title',''))) not between 1 and 160
  or coalesce(b->>'print','') not in ('Bianco e nero','Bianco e nero con inserti a colori')
  or (b->>'print'='Bianco e nero' and color_pages<>0)
  or (b->>'print'='Bianco e nero con inserti a colori' and color_pages=0)
  or (kind='sample' and copies<>1) then raise exception 'INVALID_SPEC'; end if;
  small:=b->>'format'='15x21';ivory:=b->>'paper'='Edizioni avorio 80 gr M. 1,6';flaps:=(b->>'flaps')::boolean;
  kg:=case when small then case weight when 80 then 22.5 when 90 then 25.34 else 28.16 end
      else case weight when 80 then 28 when 90 then 31.5 else 35 end end;
  base:=(kg*(case when ivory then 1.32 else 1.2 end)*1.25/16000+
      case when small then .05/8 else .033/4 end)*pages+.9+.6+
      (case when small then .035 else .065 end)*color_pages;
  if flaps then base:=base+.35;end if;
  if b->>'cover'='Marcata 250 g' then
   base:=base+case when small then case when flaps then -.15 else -.08 end else case when flaps then .30 else .26 end end;
  end if;
  discount:=case when copies>=500 then 18 when copies>=300 then 12 when copies>=200 then 8 when copies>=100 then 5 when copies>=50 then 3 else 0 end;
  if kind='sample' then base:=case when color_pages>0 then 45 else 30 end;discount:=0;end if;
  net:=round(base*copies*(1-discount/100),2);total:=total+net;short_run:=short_run or copies<20;
  items:=items||jsonb_build_array(jsonb_build_object('title',b->>'title','copies',copies,'baseUnit',base,
    'discountPercent',discount,'unitNet',round(net/copies,8),'net',net));
 end loop;
 if short_run and kind<>'sample' then minimum_fee:=case when kind='mixed' then 50 else 30 end;end if;
 return jsonb_build_object('version','raia-libri-2026-03-v1','items',items,'printNet',total,
 'minimumFee',minimum_fee,'shippingNet',shipments*5,'shipments',shipments,'totalNet',total+minimum_fee+shipments*5,'vatIncluded',false);
end $$;
revoke all on function raia_private.book_price(jsonb) from public,anon,authenticated;

create or replace function raia_private.book_lines(price jsonb,oid text,work_status text,assignee text)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare lines jsonb:='[]';item jsonb;i integer:=0;
begin
 for item in select value from jsonb_array_elements(price->'items') loop
  i:=i+1;
  lines:=lines||jsonb_build_array(jsonb_build_object('id',oid||'_book_'||i,'description',item->>'title',
  'qty',(item->>'copies')::integer,'unit','pz','price',(item->>'unitNet')::numeric,
  'status',work_status,'operatorId',assignee,'invoiceId',null,'notes','Prezzo IVA esclusa. Specifiche e PDF nella richiesta cliente.'));
 end loop;
 if (price->>'minimumFee')::numeric>0 then lines:=lines||jsonb_build_array(jsonb_build_object('id',oid||'_setup',
 'description','Minimale di lavorazione','qty',1,'unit','pz','price',(price->>'minimumFee')::numeric,'status',work_status,'operatorId',assignee,'invoiceId',null,'notes','IVA esclusa'));end if;
 if (price->>'shipments')::integer>0 then lines:=lines||jsonb_build_array(jsonb_build_object('id',oid||'_shipping',
 'description','Spedizione','qty',(price->>'shipments')::integer,'unit','pz','price',5,'status',work_status,'operatorId',assignee,'invoiceId',null,'notes','IVA esclusa'));end if;
 return lines;
end $$;
revoke all on function raia_private.book_lines(jsonb,text,text,text) from public,anon,authenticated;

alter policy customer_staff_quote_files_read on storage.objects using (
 bucket_id='raia-customer-files' and exists (
  select 1 from public.raia_quotes q where q.user_id=(select auth.uid())
  and (q.book_path=objects.name or q.cover_path=objects.name or exists (
   select 1 from jsonb_array_elements(coalesce(q.spec->'additionalBooks','[]')) b
   where b->>'bookPath'=objects.name or b->>'coverPath'=objects.name
  ))
 )
);

CREATE OR REPLACE FUNCTION raia_private.raia_submit_quote(request_id uuid, specification jsonb, book_file text, cover_file text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare customer public.raia_customers; existing public.raia_quotes; oid text; n text; new_order jsonb; k text; price jsonb; extra jsonb;
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
 if jsonb_typeof(specification) is distinct from 'object' or octet_length(specification::text)>50000 then raise exception 'INVALID_SPEC'; end if;

 specification:=specification-'pricing';
 if specification ? 'pricingVersion' then
  price:=raia_private.book_price(specification);
  specification:=jsonb_set(specification,'{pricing}',price);
  for extra in select value from jsonb_array_elements(coalesce(specification->'additionalBooks','[]')) loop
   if extra->>'bookPath' is not distinct from extra->>'coverPath' then raise exception 'TWO_PDFS_REQUIRED';end if;
   foreach k in array array[extra->>'bookPath',extra->>'coverPath'] loop
    if k is null or split_part(k,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='raia-customer-files' and name=k and lower(metadata->>'mimetype')='application/pdf') then raise exception 'FILE_REQUIRED';end if;
   end loop;
  end loop;
 else
  foreach k in array array['pages','copies','paperWeight','colorPages'] loop
  if coalesce(specification->>k,'') !~ '^\d{1,6}$' then raise exception 'INVALID_NUMBER'; end if;
 end loop;
 if (specification->>'pages')::int not between 1 and 5000 or (specification->>'copies')::int not between 1 and 100000 or (specification->>'paperWeight')::int not between 60 and 400 or (specification->>'colorPages')::int > (specification->>'pages')::int
 or coalesce(specification->>'format','') not in ('A4','A5','A6','B5')
 or coalesce(specification->>'paper','') not in ('Uso mano','Patinata opaca','Patinata lucida')
 or coalesce(specification->>'print','') not in ('Bianco e nero','A colori','Bianco e nero con inserti a colori')
 or coalesce(specification->>'cover','') not in ('Morbida','Rigida','Da definire')
 or length(coalesce(specification->>'title','')) not between 1 and 160 then raise exception 'INVALID_SPEC'; end if;

 end if;
 if (select count(*) from public.raia_quotes where user_id=auth.uid() and created_at>now()-interval '1 day')>=30 then raise exception 'DAILY_LIMIT'; end if;
 if book_file=cover_file then raise exception 'TWO_PDFS_REQUIRED'; end if;
 foreach k in array array[book_file,cover_file] loop
  if k is null or split_part(k,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='raia-customer-files' and name=k and lower(metadata->>'mimetype')='application/pdf') then raise exception 'FILE_REQUIRED'; end if;
 end loop;
 oid:='web_'||request_id::text; n:='WEB-'||upper(replace(request_id::text,'-',''));
 new_order:=jsonb_build_object('id',oid,'number',n,'customerRequestId',request_id,'clientId',customer.client_id,'created',to_char(now() at time zone 'Europe/Rome','YYYY-MM-DD'),'executionDate','','due','','notes','Richiesta dal portale clienti. Prezzo da definire.','lines',jsonb_build_array(jsonb_build_object('id',oid||'_book','description',specification->>'title','qty',(specification->>'copies')::int,'unit','pz','price',0,'status','Preventivo','operatorId','','invoiceId',null,'notes','Specifiche e PDF nella sezione Richiesta cliente.')));

 if price is not null then
  new_order:=jsonb_set(new_order,'{lines}',raia_private.book_lines(price,oid,'Preventivo',''));
  new_order:=jsonb_set(new_order,'{notes}',to_jsonb('Preventivo listino libri 2026. Prezzi IVA esclusa.'::text));
 else
  new_order:=jsonb_set(new_order,'{lines,0,priceUnspecified}','true');
 end if;
 insert into public.raia_quotes(id,user_id,spec,book_path,cover_path,order_id) values(request_id,auth.uid(),specification,book_file,cover_file,oid);
 update public.raia_workspace set payload=jsonb_set(payload,'{orders}',jsonb_build_array(new_order)||(payload->'orders')),revision=revision+1 where id=1;
 return request_id;
end $function$;

CREATE OR REPLACE FUNCTION raia_private.raia_submit_staff_quote(request_id uuid, specification jsonb, book_file text, cover_file text, target_client_id text, assigned_to text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare customer public.raia_customers; ws public.raia_workspace; existing public.raia_quotes; oid text; n text; new_order jsonb; k text; price jsonb; extra jsonb;
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
 if jsonb_typeof(specification) is distinct from 'object' or octet_length(specification::text)>50000 then raise exception 'INVALID_SPEC'; end if;

 specification:=specification-'pricing';
 if specification ? 'pricingVersion' then
  price:=raia_private.book_price(specification);
  specification:=jsonb_set(specification,'{pricing}',price);
  for extra in select value from jsonb_array_elements(coalesce(specification->'additionalBooks','[]')) loop
   if extra->>'bookPath' is not distinct from extra->>'coverPath' then raise exception 'TWO_PDFS_REQUIRED';end if;
   foreach k in array array[extra->>'bookPath',extra->>'coverPath'] loop
    if k is null or split_part(k,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='raia-customer-files' and name=k and lower(metadata->>'mimetype')='application/pdf') then raise exception 'FILE_REQUIRED';end if;
   end loop;
  end loop;
 else
  foreach k in array array['pages','copies','paperWeight','colorPages'] loop
  if coalesce(specification->>k,'') !~ '^\d{1,6}$' then raise exception 'INVALID_NUMBER'; end if;
 end loop;
 if (specification->>'pages')::int not between 1 and 5000 or (specification->>'copies')::int not between 1 and 100000 or (specification->>'paperWeight')::int not between 60 and 400 or (specification->>'colorPages')::int > (specification->>'pages')::int
 or coalesce(specification->>'format','') not in ('A4','A5','A6','B5')
 or coalesce(specification->>'paper','') not in ('Uso mano','Patinata opaca','Patinata lucida')
 or coalesce(specification->>'print','') not in ('Bianco e nero','A colori','Bianco e nero con inserti a colori')
 or coalesce(specification->>'cover','') not in ('Morbida','Rigida','Da definire')
 or length(coalesce(specification->>'title','')) not between 1 and 160 then raise exception 'INVALID_SPEC'; end if;

 end if;
 if (select count(*) from public.raia_quotes where created_by=auth.uid() and created_at>now()-interval '1 day')>=100 then raise exception 'DAILY_LIMIT'; end if;
 if book_file=cover_file then raise exception 'TWO_PDFS_REQUIRED'; end if;
 foreach k in array array[book_file,cover_file] loop
  if k is null or split_part(k,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='raia-customer-files' and name=k and lower(metadata->>'mimetype')='application/pdf') then raise exception 'FILE_REQUIRED'; end if;
 end loop;
 oid:='staff_'||request_id::text; n:='STAFF-'||upper(replace(request_id::text,'-',''));
 new_order:=jsonb_build_object('id',oid,'number',n,'customerRequestId',request_id,'clientId',target_client_id,'created',to_char(now() at time zone 'Europe/Rome','YYYY-MM-DD'),'executionDate','','due','','notes','Ordine inserito e confermato dallo staff. Prezzo da definire.','lines',jsonb_build_array(jsonb_build_object('id',oid||'_book','description',specification->>'title','qty',(specification->>'copies')::int,'unit','pz','price',0,'status','Da elaborare','operatorId',assigned_to,'invoiceId',null,'notes','Specifiche e PDF nella sezione Richiesta cliente.')));

 if price is not null then
  new_order:=jsonb_set(new_order,'{lines}',raia_private.book_lines(price,oid,'Da elaborare',assigned_to));
  new_order:=jsonb_set(new_order,'{notes}',to_jsonb('Preventivo listino libri 2026. Prezzi IVA esclusa.'::text));
 else
  new_order:=jsonb_set(new_order,'{lines,0,priceUnspecified}','true');
 end if;
 insert into public.raia_quotes(id,user_id,spec,book_path,cover_path,order_id,created_by,source,status,confirmed_at) values(request_id,customer.user_id,specification,book_file,cover_file,oid,auth.uid(),'staff','confirmed',now());
 update public.raia_workspace set payload=jsonb_set(payload,'{orders}',jsonb_build_array(new_order)||(payload->'orders')),revision=revision+1 where id=1;
 return request_id;
end $function$;
