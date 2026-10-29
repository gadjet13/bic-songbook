-- Reference: applied to the live database as registration_requests (October 28, 2026).
-- Do not rerun on the existing project.
create table public.songbook_access_requests (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','approved','declined')),
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz
);
alter table public.songbook_access_requests enable row level security;
revoke all on public.songbook_access_requests from public,anon,authenticated;
grant select on public.songbook_access_requests to authenticated;
create policy request_read on public.songbook_access_requests for select to authenticated
 using(user_id=(select auth.uid()) or (select songbook_private.songbook_role()) in ('owner','manager'));
create index songbook_pending_requests on public.songbook_access_requests(requested_at) where status='pending';
-- Include existing confirmed accounts that have not received access yet.
insert into public.songbook_access_requests(user_id,requested_at)
 select u.id,coalesce(u.email_confirmed_at,u.created_at,now()) from auth.users u
 where u.email_confirmed_at is not null and not exists(select 1 from public.songbook_members m where m.user_id=u.id);

create function songbook_private.get_songbook_registration() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise exception 'Sign in first';end if;
 select jsonb_build_object('handle',h.handle,'member_role',m.role,'request_status',case when m.role is not null then 'approved' else coalesce(r.status,'none') end)
 into result from auth.users u left join public.songbook_handles h on h.user_id=u.id
 left join public.songbook_members m on m.user_id=u.id left join public.songbook_access_requests r on r.user_id=u.id where u.id=actor;
 if result is null then raise exception 'Account not found';end if;
 return result;
end $$;
create function songbook_private.request_songbook_access() returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Confirm your email and sign in first';end if;
 if exists(select 1 from public.songbook_members where user_id=actor) then return;end if;
 if not exists(select 1 from public.songbook_handles where user_id=actor) then raise exception 'Choose a friend ID first';end if;
 insert into public.songbook_access_requests(user_id) values(actor)
 on conflict(user_id) do update set status='pending',requested_at=clock_timestamp(),reviewed_at=null
 where public.songbook_access_requests.status<>'pending';
end $$;
create function songbook_private.list_songbook_access_requests()
 returns table(user_id uuid,email text,display_name text,handle text,requested_at timestamptz)
 language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(songbook_private.songbook_role(),'') not in ('owner','manager') then raise exception 'Owner or manager access required';end if;
 return query select u.id,u.email::text,left(coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),split_part(u.email,'@',1)),160),h.handle,r.requested_at
 from public.songbook_access_requests r join auth.users u on u.id=r.user_id
 left join public.songbook_handles h on h.user_id=u.id
 where r.status='pending' and u.email_confirmed_at is not null
 and not exists(select 1 from public.songbook_members m where m.user_id=u.id)
 order by r.requested_at,u.id;
end $$;
create function songbook_private.review_songbook_access_request(target_user_id uuid,decision text,expected_requested_at timestamptz)
 returns void language plpgsql security definer set search_path='' as $$
declare r public.songbook_access_requests; inserted integer;
begin
 if auth.uid() is null or coalesce(songbook_private.songbook_role(),'') not in ('owner','manager') then raise exception 'Owner or manager access required';end if;
 if decision is null or decision not in ('approve','decline') then raise exception 'Invalid decision';end if;
 select * into r from public.songbook_access_requests where user_id=target_user_id for update;
 if not found or r.status<>'pending' or expected_requested_at is null or r.requested_at is distinct from expected_requested_at then raise exception 'This request changed. Refresh requests and try again';end if;
 if not exists(select 1 from auth.users where id=target_user_id and email_confirmed_at is not null) then raise exception 'Confirmed account required';end if;
 if exists(select 1 from public.songbook_members where user_id=target_user_id) then raise exception 'This account already has access. Refresh requests';end if;
 if decision='approve' then
  insert into public.songbook_members(user_id,role) values(target_user_id,'viewer') on conflict(user_id) do nothing;
  get diagnostics inserted=row_count;
  if inserted<>1 then raise exception 'This account already has access. Refresh requests';end if;
 end if;
 update public.songbook_access_requests set status=case when decision='approve' then 'approved' else 'declined' end,reviewed_at=clock_timestamp() where user_id=target_user_id;
end $$;
create function public.get_songbook_registration() returns jsonb language sql security invoker set search_path='' as $$select songbook_private.get_songbook_registration()$$;
create function public.request_songbook_access() returns void language sql security invoker set search_path='' as $$select songbook_private.request_songbook_access()$$;
create function public.list_songbook_access_requests() returns table(user_id uuid,email text,display_name text,handle text,requested_at timestamptz) language sql security invoker set search_path='' as $$select * from songbook_private.list_songbook_access_requests()$$;
create function public.review_songbook_access_request(target_user_id uuid,decision text,expected_requested_at timestamptz) returns void language sql security invoker set search_path='' as $$select songbook_private.review_songbook_access_request(target_user_id,decision,expected_requested_at)$$;
revoke all on function songbook_private.get_songbook_registration(),songbook_private.request_songbook_access(),songbook_private.list_songbook_access_requests(),songbook_private.review_songbook_access_request(uuid,text,timestamptz),public.get_songbook_registration(),public.request_songbook_access(),public.list_songbook_access_requests(),public.review_songbook_access_request(uuid,text,timestamptz) from public,anon;
grant execute on function songbook_private.get_songbook_registration(),songbook_private.request_songbook_access(),songbook_private.list_songbook_access_requests(),songbook_private.review_songbook_access_request(uuid,text,timestamptz),public.get_songbook_registration(),public.request_songbook_access(),public.list_songbook_access_requests(),public.review_songbook_access_request(uuid,text,timestamptz) to authenticated;
