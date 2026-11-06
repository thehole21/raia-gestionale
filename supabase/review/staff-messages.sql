create table public.raia_messages(
 id uuid primary key default gen_random_uuid(),
 mailbox text not null check(mailbox in ('Raffaella','Antonio','Alessandro')),
 body text not null check(length(btrim(body)) between 1 and 5000),
 sender uuid not null references public.raia_profiles(id),
 sent_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '168 hours'),
 read_at timestamptz,
 check(expires_at=sent_at+interval '168 hours')
);
create index raia_messages_expiry on public.raia_messages(expires_at);
create index raia_messages_box_sent on public.raia_messages(mailbox,sent_at desc,id);
alter table public.raia_messages enable row level security;
revoke all on public.raia_messages from anon,authenticated;
grant select on public.raia_messages to authenticated;
create policy messages_staff_read on public.raia_messages for select to authenticated using(expires_at>now() and exists(select 1 from public.raia_profiles where id=(select auth.uid()) and role in ('admin','operator') and active and deleted_at is null));

create function raia_private.raia_send_message(message_id uuid,target_box text,message_body text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.raia_profiles where id=auth.uid() and role='admin' and active and deleted_at is null) then raise exception 'ADMIN_REQUIRED'; end if;
 if exists(select 1 from public.raia_messages where id=message_id and (sender<>auth.uid() or mailbox<>target_box or body<>btrim(message_body))) then raise exception 'MESSAGE_CONFLICT'; end if;
 insert into public.raia_messages(id,mailbox,body,sender) values(message_id,target_box,btrim(message_body),auth.uid()) on conflict(id) do nothing;
end $$;
create function public.raia_send_message(message_id uuid,target_box text,message_body text) returns void language sql security invoker set search_path='' as $$select raia_private.raia_send_message(message_id,target_box,message_body)$$;
create function raia_private.raia_read_messages(message_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.raia_profiles where id=auth.uid() and role='operator' and active and deleted_at is null) then raise exception 'OPERATOR_REQUIRED'; end if;
 if cardinality(message_ids)>100 then raise exception 'TOO_MANY_MESSAGES'; end if;
 update public.raia_messages set read_at=now() where id=any(message_ids) and expires_at>now() and read_at is null;
end $$;
create function public.raia_read_messages(message_ids uuid[]) returns void language sql security invoker set search_path='' as $$select raia_private.raia_read_messages(message_ids)$$;
create function public.raia_message_counts() returns table(mailbox text,total bigint,unread bigint) language sql stable security invoker set search_path='' as $$
 select b.name,count(m.id),count(m.id) filter(where m.read_at is null)
 from (values('Raffaella'),('Antonio'),('Alessandro')) b(name)
 left join public.raia_messages m on m.mailbox=b.name and m.expires_at>now()
 group by b.name
$$;
revoke all on function raia_private.raia_send_message(uuid,text,text),public.raia_send_message(uuid,text,text),raia_private.raia_read_messages(uuid[]),public.raia_read_messages(uuid[]),public.raia_message_counts() from public,anon;
grant execute on function raia_private.raia_send_message(uuid,text,text),public.raia_send_message(uuid,text,text),raia_private.raia_read_messages(uuid[]),public.raia_read_messages(uuid[]),public.raia_message_counts() to authenticated;
create extension if not exists pg_cron;
select cron.schedule('raia-expire-messages','* * * * *',$job$delete from public.raia_messages where expires_at<=now();$job$);

