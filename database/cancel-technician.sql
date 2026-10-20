alter table public.raia_profiles drop constraint raia_profiles_role_check;
alter table public.raia_profiles add constraint raia_profiles_role_check check(role in ('admin','operator','technician'));
-- Existing authorization policies treat the technician as a full administrator.
create or replace function raia_private.raia_role() returns text language sql stable security definer set search_path='' as $$
 select case when role='technician' then 'admin' else role end from public.raia_profiles where id=auth.uid() and active=true
$$;

create function raia_private.raia_sync_staff() returns trigger language plpgsql security definer set search_path='' as $$
declare staff jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb) into staff from public.raia_profiles where active and role in ('admin','operator');
 update public.raia_workspace set payload=jsonb_set(payload,'{operators}',coalesce((select jsonb_agg(o) from jsonb_array_elements(payload->'operators') o where not exists(select 1 from public.raia_profiles p where p.id::text=o->>'id')),'[]'::jsonb)||staff),revision=revision+1 where id=1;
 return new;
end $$;
revoke all on function raia_private.raia_sync_staff() from public,anon,authenticated;
create trigger raia_staff_assignments after insert or update on public.raia_profiles for each row execute function raia_private.raia_sync_staff();

alter table public.raia_quotes drop constraint raia_quotes_status_check;
alter table public.raia_quotes add constraint raia_quotes_status_check check(status in ('processing','confirmed','shipped','delivered','cancelled'));
alter table public.raia_quotes add column cancelled_at timestamptz;
alter table public.raia_quotes add column cancelled_by uuid;

create or replace function raia_private.raia_delete_order(target_order_id text,actor_id uuid,expected_revision integer) returns integer
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
 update public.raia_quotes set status='cancelled',cancelled_at=now(),cancelled_by=actor_id where order_id=target_order_id and status<>'cancelled';
 updated_payload=jsonb_set(current_row.payload,'{orders}',coalesce((select jsonb_agg(value) from jsonb_array_elements(current_row.payload->'orders') where value->>'id'<>target_order_id),'[]'::jsonb));
 update public.raia_workspace set payload=updated_payload,revision=revision+1 where id=1;
 insert into public.raia_audit(actor,revision) values(actor_id,current_row.revision+1);
 return current_row.revision+1;
end $$;

-- Terminal cancellation is never undone by staff confirmation or late carrier events.
do $$ declare definition text; begin
 select pg_get_functiondef('raia_private.raia_manage_quote(uuid,boolean,text,text)'::regprocedure) into definition;
 definition:=replace(definition,'where id=quote_id;','where id=quote_id and status<>''cancelled'';');
 execute definition;
 select pg_get_functiondef('raia_private.raia_tracking_event(text,text,uuid,text,text,timestamptz)'::regprocedure) into definition;
 definition:=replace(definition,'q.status=''processing''','q.status in (''processing'',''cancelled'')');
 execute definition;
end $$;

create function raia_private.raia_no_technician_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from jsonb_array_elements(new.payload->'operators') o join public.raia_profiles p on p.id::text=o->>'id' where p.role='technician')
 or exists(select 1 from jsonb_array_elements(new.payload->'orders') o cross join lateral jsonb_array_elements(o->'lines') l join public.raia_profiles p on p.id::text=l->>'operatorId' where p.role='technician') then raise exception 'TECHNICIAN_NOT_ASSIGNABLE'; end if;
 return new;
end $$;
revoke all on function raia_private.raia_no_technician_assignment() from public,anon,authenticated;
create trigger raia_no_technician_assignment before update on public.raia_workspace for each row execute function raia_private.raia_no_technician_assignment();
