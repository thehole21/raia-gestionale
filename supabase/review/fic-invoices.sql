create table public.raia_fic_invoices(
 draft_id text primary key, company_id bigint not null, work_ids jsonb not null,
 status text not null check(status in ('creating','created','failed','reconcile')),
 remote_id bigint, remote_number text, request_data jsonb not null,
 created_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
alter table public.raia_fic_invoices enable row level security;
revoke all on public.raia_fic_invoices from anon,authenticated;
grant select,update on public.raia_fic_invoices to authenticated;
create policy fic_invoice_admin on public.raia_fic_invoices for all to authenticated
using(exists(select 1 from public.raia_profiles where id=(select auth.uid()) and role='admin' and active and deleted_at is null))
with check(exists(select 1 from public.raia_profiles where id=(select auth.uid()) and role='admin' and active and deleted_at is null));

create function public.raia_claim_fic_invoice(target_draft text, expected_revision integer, target_company bigint, invoice_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ws public.raia_workspace; d jsonb; op public.raia_fic_invoices;
begin
 if raia_private.raia_role() is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
 select * into ws from public.raia_workspace where id=1 for update;
 select * into op from public.raia_fic_invoices where draft_id=target_draft;
 if found and op.status<>'failed' then return jsonb_build_object('claimed',false,'status',op.status,'remoteId',op.remote_id); end if;
 if ws.revision<>expected_revision then raise exception 'CONFLICT'; end if;
 if not exists(select 1 from public.raia_fic_connection where id=1 and company_id=target_company) then raise exception 'COMPANY_CHANGED'; end if;
 select value into d from jsonb_array_elements(ws.payload->'drafts') where value->>'id'=target_draft;
 if d is null or d->>'remoteDocumentId' is not null or jsonb_array_length(d->'workIds')=0 then raise exception 'INVALID_DRAFT'; end if;
 if exists(select 1 from public.raia_fic_invoices f where f.draft_id<>target_draft and f.status<>'failed' and exists(select 1 from jsonb_array_elements_text(f.work_ids) a join jsonb_array_elements_text(d->'workIds') b on a.value=b.value)) then raise exception 'WORK_ALREADY_CLAIMED'; end if;
 insert into public.raia_fic_invoices(draft_id,company_id,work_ids,status,request_data,created_by) values(target_draft,target_company,d->'workIds','creating',invoice_data,auth.uid())
 on conflict(draft_id) do update set company_id=excluded.company_id,work_ids=excluded.work_ids,status='creating',request_data=excluded.request_data,created_by=excluded.created_by,updated_at=now();
 return jsonb_build_object('claimed',true);
end $$;
revoke all on function public.raia_claim_fic_invoice(text,integer,bigint,jsonb) from public,anon;
grant execute on function public.raia_claim_fic_invoice(text,integer,bigint,jsonb) to authenticated;

create function public.raia_finish_fic_invoice(target_draft text,document_id bigint,document_number text)
returns void language plpgsql security definer set search_path='' as $$
declare ws public.raia_workspace; op public.raia_fic_invoices; drafts jsonb;
begin
 if raia_private.raia_role() is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
 if document_id<=0 then raise exception 'INVALID_DOCUMENT'; end if;
 select * into ws from public.raia_workspace where id=1 for update;
 select * into op from public.raia_fic_invoices where draft_id=target_draft for update;
 if not found or (op.remote_id is not null and op.remote_id<>document_id) then raise exception 'INVALID_OPERATION'; end if;
 update public.raia_fic_invoices set status='created',remote_id=document_id,remote_number=document_number,updated_at=now() where draft_id=target_draft;
 select jsonb_agg(case when d->>'id'=target_draft then d||jsonb_build_object('status','created','remoteDocumentId',document_id,'remoteCompanyId',op.company_id,'remoteNumber',document_number) else d end order by n) into drafts from jsonb_array_elements(ws.payload->'drafts') with ordinality e(d,n);
 if not exists(select 1 from jsonb_array_elements(ws.payload->'drafts') d where d->>'id'=target_draft) then raise exception 'DRAFT_MISSING'; end if;
 update public.raia_workspace set payload=jsonb_set(payload,'{drafts}',drafts),revision=revision+1 where id=1;
 insert into public.raia_audit(actor,revision) values(auth.uid(),ws.revision+1);
end $$;
revoke all on function public.raia_finish_fic_invoice(text,bigint,text) from public,anon;
grant execute on function public.raia_finish_fic_invoice(text,bigint,text) to authenticated;
