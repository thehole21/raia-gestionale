-- Eseguire DOPO supabase-setup.sql. Archiviazione prima della cancellazione.
begin;
create table public.raia_deleted_orders (
 id bigint generated always as identity primary key, order_id text not null,
 order_data jsonb not null, actor_id uuid, deleted_at timestamptz not null default now()
);
alter table public.raia_deleted_orders enable row level security;
revoke all on public.raia_deleted_orders from anon,authenticated;
create function public.raia_delete_order(target_order_id text,actor_id uuid,expected_revision integer) returns integer
language plpgsql security definer set search_path='' as $$
declare current_row public.raia_workspace; target jsonb; updated_payload jsonb;
begin
 if not exists(select 1 from public.raia_profiles p where p.id=actor_id and p.active) then raise exception 'FORBIDDEN'; end if;
 select * into current_row from public.raia_workspace where id=1 for update;
 if current_row.revision<>expected_revision then raise exception 'CONFLICT'; end if;
 select value into target from jsonb_array_elements(current_row.payload->'orders') where value->>'id'=target_order_id;
 if target is null then raise exception 'NOT_FOUND'; end if;
 if exists(select 1 from jsonb_array_elements(target->'lines') l where l->>'invoiceId' is not null)
 or exists(select 1 from jsonb_array_elements(current_row.payload->'drafts') d,jsonb_array_elements_text(d->'workIds') wid where exists(select 1 from jsonb_array_elements(target->'lines') l where l->>'id'=wid)) then raise exception 'DRAFT_LINKED'; end if;
 insert into public.raia_deleted_orders(order_id,order_data,actor_id) values(target_order_id,target,actor_id);
 updated_payload=jsonb_set(current_row.payload,'{orders}',coalesce((select jsonb_agg(value) from jsonb_array_elements(current_row.payload->'orders') where value->>'id'<>target_order_id),'[]'::jsonb));
 update public.raia_workspace set payload=updated_payload,revision=revision+1 where id=1;
 insert into public.raia_audit(actor,revision) values(actor_id,current_row.revision+1);
 return current_row.revision+1;
end $$;
revoke all on function public.raia_delete_order(text,uuid,integer) from public,anon,authenticated;
grant execute on function public.raia_delete_order(text,uuid,integer) to service_role;
commit;
