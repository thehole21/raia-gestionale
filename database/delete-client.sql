-- Apply once to the deployed RAIA Supabase project.
-- Client orders are archived atomically before the client is removed.
begin;

create or replace function raia_private.raia_delete_client(target_client_id text,actor_id uuid,expected_revision integer) returns integer
language plpgsql security definer set search_path='' as $$
declare
 current_row public.raia_workspace;
 target_client jsonb;
 target_order jsonb;
 updated_payload jsonb;
begin
 if not exists(select 1 from public.raia_profiles p where p.id=actor_id and p.active and p.role='admin') then
  raise exception 'FORBIDDEN';
 end if;

 select * into current_row from public.raia_workspace where id=1 for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if current_row.revision<>expected_revision then raise exception 'CONFLICT'; end if;

 select client_data.value into target_client
 from jsonb_array_elements(coalesce(current_row.payload->'clients','[]'::jsonb))
  as client_data(value)
 where client_data.value->>'id'=target_client_id;
 if target_client is null then raise exception 'NOT_FOUND'; end if;

 if exists(select 1 from public.raia_customers c where c.client_id=target_client_id) then
  raise exception 'CUSTOMER_PORTAL_LINKED';
 end if;

 if exists(
  select 1
  from jsonb_array_elements(coalesce(current_row.payload->'drafts','[]'::jsonb)) as drafts(draft)
  where draft->>'clientId'=target_client_id
   or exists(
    select 1
    from jsonb_array_elements(coalesce(current_row.payload->'orders','[]'::jsonb)) as orders(order_data),
         jsonb_array_elements(coalesce(orders.order_data->'lines','[]'::jsonb)) as lines(line_data),
         jsonb_array_elements_text(coalesce(draft->'workIds','[]'::jsonb)) as work_ids(work_id)
    where orders.order_data->>'clientId'=target_client_id and lines.line_data->>'id'=work_ids.work_id
   )
 ) or exists(
  select 1
  from jsonb_array_elements(coalesce(current_row.payload->'orders','[]'::jsonb)) as orders(order_data),
       jsonb_array_elements(coalesce(orders.order_data->'lines','[]'::jsonb)) as lines(line_data)
  where orders.order_data->>'clientId'=target_client_id and nullif(lines.line_data->>'invoiceId','') is not null
 ) then
  raise exception 'DRAFT_LINKED';
 end if;

 for target_order in
  select orders.order_data
  from jsonb_array_elements(coalesce(current_row.payload->'orders','[]'::jsonb)) as orders(order_data)
  where orders.order_data->>'clientId'=target_client_id
 loop
  insert into public.raia_deleted_orders(order_id,order_data,actor_id)
  values(target_order->>'id',target_order,actor_id);
 end loop;

 update public.raia_quotes
 set status='cancelled',cancelled_at=now(),cancelled_by=actor_id
 where order_id in (
  select orders.order_data->>'id'
  from jsonb_array_elements(coalesce(current_row.payload->'orders','[]'::jsonb)) as orders(order_data)
  where orders.order_data->>'clientId'=target_client_id
 ) and status<>'cancelled';

 updated_payload:=jsonb_set(
  current_row.payload,
  '{orders}',
  coalesce((
   select jsonb_agg(orders.order_data)
   from jsonb_array_elements(coalesce(current_row.payload->'orders','[]'::jsonb)) as orders(order_data)
   where orders.order_data->>'clientId' is distinct from target_client_id
  ),'[]'::jsonb)
 );
 updated_payload:=jsonb_set(
  updated_payload,
  '{clients}',
  coalesce((
   select jsonb_agg(clients.client_data)
   from jsonb_array_elements(coalesce(current_row.payload->'clients','[]'::jsonb)) as clients(client_data)
   where clients.client_data->>'id' is distinct from target_client_id
  ),'[]'::jsonb)
 );

 update public.raia_workspace
 set payload=updated_payload,revision=revision+1
 where id=1;
 insert into public.raia_audit(actor,revision) values(actor_id,current_row.revision+1);
 return current_row.revision+1;
end $$;

revoke all on function raia_private.raia_delete_client(text,uuid,integer) from public,anon,authenticated;
grant execute on function raia_private.raia_delete_client(text,uuid,integer) to service_role;

create or replace function public.raia_delete_client(target_client_id text,actor_id uuid,expected_revision integer) returns integer
language sql security invoker set search_path='' as $$
 select raia_private.raia_delete_client(target_client_id,actor_id,expected_revision)
$$;
revoke all on function public.raia_delete_client(text,uuid,integer) from public,anon,authenticated;
grant execute on function public.raia_delete_client(text,uuid,integer) to service_role;

commit;
