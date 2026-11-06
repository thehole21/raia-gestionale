create table public.raia_fic_ddt_removals (
 id bigint generated always as identity primary key,
 removed_at timestamptz not null default now(), actor uuid not null,
 company_id bigint not null, remote_id bigint not null, operations jsonb not null,
 unique(company_id,remote_id)
);
alter table public.raia_fic_ddt_removals enable row level security;
revoke all on public.raia_fic_ddt_removals from public,anon,authenticated;
grant select on public.raia_fic_ddt_removals to service_role;

-- Called only by the server after an authenticated company check and an exact remote 404.
create or replace function public.raia_remove_deleted_fic_ddt(target_company bigint,document_id bigint,actor_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare ws public.raia_workspace; ops jsonb; orders jsonb='[]'; o jsonb; l jsonb; lines jsonb; notes jsonb; match_line boolean;
begin
 if not exists(select 1 from public.raia_profiles where id=actor_id and role in ('admin','operator') and active and deleted_at is null) then raise exception 'STAFF_REQUIRED'; end if;
 if document_id is null or document_id<=0 or not exists(select 1 from public.raia_fic_connection where id=1 and company_id=target_company) then raise exception 'COMPANY_CHANGED'; end if;
 select * into ws from public.raia_workspace where id=1 for update;
 select coalesce(jsonb_agg(x),'[]') into ops from (
 select to_jsonb(d)||jsonb_build_object('ledger','deliveries') x from public.raia_fic_deliveries d where company_id=target_company and remote_id=document_id
 union all select to_jsonb(d)||jsonb_build_object('ledger','legacy') from public.raia_fic_ddts d where company_id=target_company and remote_id=document_id
 union all select to_jsonb(d)||jsonb_build_object('ledger','documents') from public.raia_fic_documents d where company_id=target_company and remote_id=document_id and target_type='delivery_note' and status<>'removed'
 ) s;
 if jsonb_array_length(ops)=0 then return; end if;
 insert into public.raia_fic_ddt_removals(actor,company_id,remote_id,operations) values(actor_id,target_company,document_id,ops) on conflict(company_id,remote_id) do nothing;
 for o in select value from jsonb_array_elements(ws.payload->'orders') loop
  lines='[]';
  for l in select value from jsonb_array_elements(o->'lines') loop
   match_line=(l->'ddt'->>'remoteDocumentId'=document_id::text and l->'ddt'->>'remoteCompanyId'=target_company::text);
   if coalesce(match_line,false) then
    l=l-'ddt';
    if jsonb_typeof(l->'production')='object' then l=jsonb_set(l,'{production,ddtNumber}','""'); end if;
   elsif l->'ddt' is null and exists(select 1 from jsonb_array_elements(ops) p where p->>'order_id'=o->>'id' and (p->>'ledger'='legacy' or p->'work_ids' ? (l->>'id')) and p->>'remote_number'=l->'production'->>'ddtNumber') then
    l=jsonb_set(l,'{production,ddtNumber}','""');
   end if;
   lines=lines||jsonb_build_array(l);
  end loop;
  o=jsonb_set(o,'{lines}',lines);
  if o->'ddt'->>'remoteDocumentId'=document_id::text and o->'ddt'->>'remoteCompanyId'=target_company::text then o=o-'ddt'; end if;
  if jsonb_typeof(o->'deliveryNotes')='array' then
   select coalesce(jsonb_agg(d order by n),'[]') into notes from jsonb_array_elements(o->'deliveryNotes') with ordinality e(d,n) where not coalesce(d->>'remoteDocumentId'=document_id::text and d->>'remoteCompanyId'=target_company::text,false);
   o=jsonb_set(o,'{deliveryNotes}',notes);
  end if;
  orders=orders||jsonb_build_array(o);
 end loop;
 delete from public.raia_fic_deliveries where company_id=target_company and remote_id=document_id;
 delete from public.raia_fic_ddts where company_id=target_company and remote_id=document_id;
 update public.raia_fic_documents set status='removed',updated_at=now() where company_id=target_company and remote_id=document_id and target_type='delivery_note';
 update public.raia_workspace set payload=jsonb_set(payload,'{orders}',orders),revision=revision+1 where id=1;
 insert into public.raia_audit(actor,revision) values(actor_id,ws.revision+1);
end $$;
revoke all on function public.raia_remove_deleted_fic_ddt(bigint,bigint,uuid) from public,anon,authenticated;
grant execute on function public.raia_remove_deleted_fic_ddt(bigint,bigint,uuid) to service_role;

