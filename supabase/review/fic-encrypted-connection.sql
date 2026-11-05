create table public.raia_fic_connection (
 id integer primary key check(id=1),
 token_blob text not null,
 company_id bigint,
 companies jsonb not null default '[]',
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id),
 lock_until timestamptz not null default '1970-01-01'
);
alter table public.raia_fic_connection enable row level security;
revoke all on public.raia_fic_connection from anon,authenticated;
grant select,insert,update,delete on public.raia_fic_connection to authenticated;
create policy fic_admin on public.raia_fic_connection for all to authenticated
using (exists(select 1 from public.raia_profiles where id=(select auth.uid()) and role='admin' and active and deleted_at is null))
with check (exists(select 1 from public.raia_profiles where id=(select auth.uid()) and role='admin' and active and deleted_at is null) and updated_by=(select auth.uid()));
comment on column public.raia_fic_connection.token_blob is 'AES-256-GCM ciphertext; key derived on the application server from FIC_CLIENT_SECRET. Never store plaintext tokens.';
