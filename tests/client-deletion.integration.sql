-- Run after database/delete-client.sql on a dedicated test project.
begin;
do $$
declare
 actor uuid;
 client_id text:='test-delete-client-'||gen_random_uuid()::text;
 order_id text:='test-delete-order-'||gen_random_uuid()::text;
 expected_revision integer;
 new_revision integer;
begin
 select id into actor from public.raia_profiles where role='admin' and active limit 1;
 if actor is null then raise exception 'ACTIVE_ADMIN_REQUIRED'; end if;

 select revision into expected_revision from public.raia_workspace where id=1 for update;
 update public.raia_workspace
 set payload=jsonb_set(
  jsonb_set(payload,'{clients}',(payload->'clients')||jsonb_build_array(jsonb_build_object(
   'id',client_id,'name','Cliente test eliminazione','email','','phone','','vat','','city','Roma'
  ))),
  '{orders}',(payload->'orders')||jsonb_build_array(jsonb_build_object(
   'id',order_id,'number',order_id,'clientId',client_id,'created','2026-10-21','due','','notes','',
   'lines',jsonb_build_array(jsonb_build_object(
    'id',order_id||'-linea','description','Lavoro test','qty',1,'unit','pz','price',1,
    'status','Da elaborare','operatorId','','invoiceId',null,'notes',''
   ))
  ))
 )
 where id=1;

 new_revision:=public.raia_delete_client(client_id,actor,expected_revision);
 if new_revision<>expected_revision+1 then raise exception 'REVISION_NOT_INCREMENTED'; end if;
 if exists(select 1 from public.raia_workspace,jsonb_array_elements(payload->'clients') c where c->>'id'=client_id)
  or exists(select 1 from public.raia_workspace,jsonb_array_elements(payload->'orders') o where o->>'id'=order_id) then
  raise exception 'CLIENT_OR_ORDER_STILL_ACTIVE';
 end if;
 if not exists(
  select 1 from public.raia_deleted_orders d
  where d.order_id=order_id
   and d.order_data->>'clientId'=client_id
   and d.client_data->>'name'='Cliente test eliminazione'
 ) then raise exception 'ORDER_ARCHIVE_MISSING'; end if;
end $$;
rollback;
