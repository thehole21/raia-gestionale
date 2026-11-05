create table public.raia_order_admin_values(order_id text primary key, cifra text not null check(cifra ~ '^[0-9]{1,8}$'), updated_at timestamptz not null default now());
alter table public.raia_order_admin_values enable row level security;
revoke all on public.raia_order_admin_values from anon,authenticated;
grant select,insert,update,delete on public.raia_order_admin_values to authenticated;
create policy admin_values_only on public.raia_order_admin_values for all to authenticated
using(exists(select 1 from public.raia_profiles where id=(select auth.uid()) and role='admin' and active and deleted_at is null))
with check(exists(select 1 from public.raia_profiles where id=(select auth.uid()) and role='admin' and active and deleted_at is null));
