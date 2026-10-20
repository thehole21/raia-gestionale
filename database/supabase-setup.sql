-- Eseguire una volta nel SQL Editor di un NUOVO progetto Supabase dedicato a RAIA.
-- Non eseguire schema-proposal.sql: è un documento storico, non questa migrazione.
begin;
create table public.raia_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null, email text not null, role text not null check(role in ('admin','operator')),
 active boolean not null default true
);
alter table public.raia_profiles enable row level security;
create function public.raia_role() returns text language sql stable security definer set search_path = '' as $$
 select role from public.raia_profiles where id = auth.uid() and active = true
$$;
revoke all on function public.raia_role() from public;
grant execute on function public.raia_role() to authenticated;
create policy profiles_read on public.raia_profiles for select to authenticated using(id = auth.uid() or public.raia_role() = 'admin');
grant select on public.raia_profiles to authenticated;
revoke insert,update,delete on public.raia_profiles from anon,authenticated;
create table public.raia_workspace (
 id integer primary key check(id=1), revision integer not null default 0, payload jsonb not null
);
insert into public.raia_workspace values (1,0,'{"version":2,"clients":[],"operators":[],"orders":[],"drafts":[],"activity":[]}');
alter table public.raia_workspace enable row level security;
create policy workspace_read on public.raia_workspace for select to authenticated using(public.raia_role() is not null);
grant select on public.raia_workspace to authenticated;
revoke insert,update,delete on public.raia_workspace from anon,authenticated;
create table public.raia_audit (
 id bigint generated always as identity primary key, actor uuid, at timestamptz not null default now(), revision integer not null
);
alter table public.raia_audit enable row level security;
create policy audit_admin on public.raia_audit for select to authenticated using(public.raia_role() = 'admin');
grant select on public.raia_audit to authenticated;
revoke insert,update,delete on public.raia_audit from anon,authenticated;
create function public.raia_save_workspace(expected_revision integer, next_payload jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare existing public.raia_workspace; actor_role text;
begin
 actor_role := public.raia_role();
 if actor_role is null then raise exception 'FORBIDDEN'; end if;
 select * into existing from public.raia_workspace where id=1 for update;
 if existing.revision <> expected_revision then raise exception 'CONFLICT'; end if;
 if next_payload->>'version' is distinct from '2'
 or jsonb_typeof(next_payload->'orders') is distinct from 'array'
 or jsonb_typeof(next_payload->'clients') is distinct from 'array'
 or jsonb_typeof(next_payload->'operators') is distinct from 'array'
 or jsonb_typeof(next_payload->'drafts') is distinct from 'array'
 or jsonb_typeof(next_payload->'activity') is distinct from 'array'
 or octet_length(next_payload::text) > 10000000 then raise exception 'INVALID_PAYLOAD'; end if;
 if actor_role <> 'admin' and next_payload->'operators' is distinct from existing.payload->'operators' then raise exception 'ADMIN_REQUIRED'; end if;
 if exists(select 1 from jsonb_array_elements(existing.payload->'orders') old_order
 where not exists(select 1 from jsonb_array_elements(next_payload->'orders') new_order where new_order->>'id'=old_order->>'id'))
 then raise exception 'PASSWORD_REQUIRED_FOR_DELETE'; end if;
 if exists(select 1 from jsonb_array_elements(existing.payload->'orders') old_order, jsonb_array_elements(old_order->'lines') old_line
 where not exists(select 1 from jsonb_array_elements(next_payload->'orders') new_order, jsonb_array_elements(new_order->'lines') new_line where new_order->>'id'=old_order->>'id' and new_line->>'id'=old_line->>'id'))
 then raise exception 'PASSWORD_REQUIRED_FOR_DELETE'; end if;
 update public.raia_workspace set payload=next_payload, revision=existing.revision+1 where id=1;
 insert into public.raia_audit(actor,revision) values(auth.uid(),existing.revision+1);
 return existing.revision+1;
end $$;
revoke all on function public.raia_save_workspace(integer,jsonb) from public;
grant execute on function public.raia_save_workspace(integer,jsonb) to authenticated;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('raia-documents','raia-documents',false,20971520,array['application/pdf']);
create policy raia_files_read on storage.objects for select to authenticated using(bucket_id='raia-documents' and public.raia_role() is not null);
create policy raia_files_insert on storage.objects for insert to authenticated with check(bucket_id='raia-documents' and public.raia_role() is not null);
create policy raia_files_delete on storage.objects for delete to authenticated using(bucket_id='raia-documents' and public.raia_role()='admin');
commit;
-- Dopo aver creato il primo utente nel pannello Authentication, eseguire separatamente:
-- insert into public.raia_profiles(id,name,email,role)
-- select id,'Amministratore',email,'admin' from auth.users where email='LA_TUA_EMAIL';
