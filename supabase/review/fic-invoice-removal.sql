-- Server-only: the route verifies the remote deletion before invoking this function.
create table if not exists public.raia_fic_invoice_removals (
 id bigint generated always as identity primary key,
 removed_at timestamptz not null default now(), actor uuid not null,
 operation jsonb not null, draft jsonb not null
);
alter table public.raia_fic_invoice_removals enable row level security;
revoke all on public.raia_fic_invoice_removals from anon,authenticated;
create or replace function public.raia_remove_deleted_fic_invoice(target_draft text, target_company bigint, document_id bigint, actor_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare ws public.raia_workspace; op public.raia_fic_invoices; d jsonb; orders jsonb; drafts jsonb;
begin
 if not exists(select 1 from public.raia_profiles where id=actor_id and role='admin' and active and deleted_at is null) then raise exception 'ADMIN_REQUIRED'; end if;
 select * into ws from public.raia_workspace where id=1 for update;
 select * into op from public.raia_fic_invoices where draft_id=target_draft for update;
 if not found then
  if not exists(select 1 from jsonb_array_elements(ws.payload->'drafts') x where x->>'id'=target_draft) then return; end if;
  raise exception 'OPERATION_MISSING';
 end if;
 if op.company_id<>target_company or op.remote_id is distinct from document_id then raise exception 'DOCUMENT_CHANGED'; end if;
 select x into d from jsonb_array_elements(ws.payload->'drafts') x where x->>'id'=target_draft;
 if d is null then raise exception 'DRAFT_MISSING'; end if;
 insert into public.raia_fic_invoice_removals(actor,operation,draft) values(actor_id,to_jsonb(op),d);
 select coalesce(jsonb_agg(x order by n),'[]'::jsonb) into drafts from jsonb_array_elements(ws.payload->'drafts') with ordinality e(x,n) where x->>'id'<>target_draft;
 select coalesce(jsonb_agg(jsonb_set(o,'{lines}',(select coalesce(jsonb_agg(case when l->>'invoiceId'=target_draft then
   case when jsonb_typeof(l->'production')='object' then jsonb_set(l||jsonb_build_object('invoiceId',null),'{production,invoicing}','""'::jsonb) else l||jsonb_build_object('invoiceId',null) end
   else l end order by k),'[]'::jsonb) from jsonb_array_elements(o->'lines') with ordinality e(l,k))) order by n),'[]'::jsonb)
 into orders from jsonb_array_elements(ws.payload->'orders') with ordinality e(o,n);
 update public.raia_fic_documents set status='removed',updated_at=now() where company_id=target_company and remote_id=document_id and target_type='invoice';
 delete from public.raia_fic_invoices where draft_id=target_draft;
 update public.raia_workspace set payload=jsonb_set(jsonb_set(payload,'{orders}',orders),'{drafts}',drafts),revision=revision+1 where id=1;
 insert into public.raia_audit(actor,revision) values(actor_id,ws.revision+1);
end $$;
revoke all on function public.raia_remove_deleted_fic_invoice(text,bigint,bigint,uuid) from public,anon,authenticated;
grant execute on function public.raia_remove_deleted_fic_invoice(text,bigint,bigint,uuid) to service_role;

grant select on public.raia_fic_invoice_removals to service_role;
