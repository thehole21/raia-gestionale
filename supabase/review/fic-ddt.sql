create table public.raia_fic_ddts(order_id text primary key,company_id bigint not null,status text not null check(status in ('creating','created','failed','reconcile')),remote_id bigint,remote_number text,request_data jsonb not null,created_by uuid not null references auth.users(id),updated_at timestamptz not null default now());
alter table public.raia_fic_ddts enable row level security;
revoke all on public.raia_fic_ddts from anon,authenticated;
grant select on public.raia_fic_ddts to authenticated;
grant all on public.raia_fic_ddts to service_role;
create policy ddt_staff_read on public.raia_fic_ddts for select to authenticated using(exists(select 1 from public.raia_profiles where id=(select auth.uid()) and role in ('admin','operator') and active and deleted_at is null));
create function public.raia_claim_fic_ddt(target_order text,expected_revision integer,target_company bigint,document_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare ws public.raia_workspace; o jsonb; op public.raia_fic_ddts;
begin
 if raia_private.raia_role() is null then raise exception 'FORBIDDEN'; end if;
 select * into ws from public.raia_workspace where id=1 for update;
 select * into op from public.raia_fic_ddts where order_id=target_order;
 if found and op.status<>'failed' then return jsonb_build_object('claimed',false,'remoteId',op.remote_id); end if;
 if ws.revision<>expected_revision then raise exception 'CONFLICT'; end if;
 if not exists(select 1 from public.raia_fic_connection where id=1 and company_id=target_company) then raise exception 'COMPANY_CHANGED'; end if;
 select value into o from jsonb_array_elements(ws.payload->'orders') where value->>'id'=target_order;
 if o is null or coalesce(o->'ddt'->>'number','')<>'' then raise exception 'DDT_EXISTS_OR_ORDER_MISSING'; end if;
 insert into public.raia_fic_ddts(order_id,company_id,status,request_data,created_by) values(target_order,target_company,'creating',document_data,auth.uid()) on conflict(order_id) do update set status='creating',company_id=excluded.company_id,request_data=excluded.request_data,updated_at=now();
 return jsonb_build_object('claimed',true);
end $$;
revoke all on function public.raia_claim_fic_ddt(text,integer,bigint,jsonb) from public,anon;
grant execute on function public.raia_claim_fic_ddt(text,integer,bigint,jsonb) to authenticated;
create function public.raia_finish_fic_ddt(target_order text,document_id bigint,document_number text) returns void language plpgsql security definer set search_path='' as $$
declare ws public.raia_workspace; op public.raia_fic_ddts; orders jsonb;
begin
 if raia_private.raia_role() is null then raise exception 'FORBIDDEN'; end if;
 if document_id<=0 then raise exception 'INVALID_DOCUMENT'; end if;
 select * into ws from public.raia_workspace where id=1 for update;
 select * into op from public.raia_fic_ddts where order_id=target_order for update;
 if not found or (op.remote_id is not null and op.remote_id<>document_id) then raise exception 'INVALID_OPERATION'; end if;
 if not exists(select 1 from jsonb_array_elements(ws.payload->'orders') o where o->>'id'=target_order) then raise exception 'ORDER_MISSING'; end if;
 update public.raia_fic_ddts set status='created',remote_id=document_id,remote_number=document_number,updated_at=now() where order_id=target_order;
 if exists(select 1 from jsonb_array_elements(ws.payload->'orders') o where o->>'id'=target_order and o->'ddt'->>'remoteDocumentId'=document_id::text) then return; end if;
 select jsonb_agg(case when o->>'id'=target_order then o||jsonb_build_object('ddt',jsonb_build_object('number',document_number,'date',op.request_data->>'date','remoteDocumentId',document_id,'remoteCompanyId',op.company_id)) else o end order by n) into orders from jsonb_array_elements(ws.payload->'orders') with ordinality e(o,n);
 update public.raia_workspace set payload=jsonb_set(payload,'{orders}',orders),revision=revision+1 where id=1;
 insert into public.raia_audit(actor,revision) values(auth.uid(),ws.revision+1);
end $$;
revoke all on function public.raia_finish_fic_ddt(text,bigint,text) from public,anon;
grant execute on function public.raia_finish_fic_ddt(text,bigint,text) to authenticated;
