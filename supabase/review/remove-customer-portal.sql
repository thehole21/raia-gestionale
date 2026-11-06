-- Retire the public customer portal; retain staff estimates and existing job PDFs.
begin;
do $migration$
declare definition text;
begin
 select pg_get_functiondef('raia_private.raia_submit_staff_quote(uuid,jsonb,text,text,text,text)'::regprocedure) into definition;
 definition:=replace(definition,'customer public.raia_customers; ','');
 definition:=replace(definition,'select * into customer from public.raia_customers where client_id=target_client_id;','');
 definition:=replace(definition,'customer.user_id','null');
 definition:=replace(definition,'Specifiche e PDF nella sezione Richiesta cliente.','Specifiche e PDF nella sezione Dettagli libro.');
 if position('raia_customers' in definition)>0 then raise exception 'Unhandled staff dependency'; end if;
 execute definition;
 select pg_get_functiondef('raia_private.raia_delete_client(text,uuid,integer)'::regprocedure) into definition;
 definition:=regexp_replace(definition,'if exists\(select 1 from public.raia_customers c where c.client_id=target_client_id\) then\s+raise exception ''CUSTOMER_PORTAL_LINKED'';\s+end if;','','g');
 if position('raia_customers' in definition)>0 then raise exception 'Unhandled delete dependency'; end if;
 execute definition;
end $migration$;
drop trigger if exists raia_customer_registration on auth.users;
drop function public.raia_submit_quote(uuid,jsonb,text,text);
drop function raia_private.raia_submit_quote(uuid,jsonb,text,text);
drop function public.raia_manage_quote(uuid,boolean,text,text);
drop function raia_private.raia_manage_quote(uuid,boolean,text,text);
drop function public.raia_tracking_event(text,text,uuid,text,text,timestamptz);
drop function raia_private.raia_tracking_event(text,text,uuid,text,text,timestamptz);
drop function raia_private.raia_register_customer();
drop policy customer_files_insert on storage.objects;
drop policy customer_files_read on storage.objects;
drop policy customer_staff_quote_files_read on storage.objects;
create policy staff_quote_files_read on storage.objects for select to authenticated
using(bucket_id='raia-customer-files' and (select raia_private.raia_role()) is not null);
drop policy quotes_read on public.raia_quotes;
create policy quotes_staff_read on public.raia_quotes for select to authenticated using((select raia_private.raia_role()) is not null);
alter table public.raia_quotes drop constraint raia_quotes_user_id_fkey;
alter table public.raia_quotes alter column source set default 'staff';
-- user_id is retained solely as historical attribution, never as an access predicate.
-- Preserve historical records in a private, inaccessible archive.
revoke all on public.raia_tracking_events,public.raia_customers from public,anon,authenticated;
drop policy tracking_staff_read on public.raia_tracking_events;
drop policy customers_read on public.raia_customers;
alter table public.raia_tracking_events set schema raia_private;
alter table public.raia_customers set schema raia_private;
alter table raia_private.raia_tracking_events rename to archived_portal_tracking_events;
alter table raia_private.raia_customers rename to archived_portal_customers;
commit;
