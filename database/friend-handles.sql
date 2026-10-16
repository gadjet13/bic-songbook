-- Applied to live database; reference only. Handles do not replace immutable auth IDs.
create table public.songbook_handles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 handle text not null unique check(handle ~ '^[a-z0-9_]{3,24}$')
);
alter table public.songbook_handles enable row level security;
revoke all on public.songbook_handles from public,anon,authenticated;
grant select on public.songbook_handles to authenticated;
create policy own_handle on public.songbook_handles for select to authenticated using(user_id=(select auth.uid()));
create function songbook_private.set_songbook_handle(new_handle text) returns text language plpgsql security definer set search_path='' as $$
declare value text:=lower(regexp_replace(trim(new_handle),'^@','')); actor uuid:=auth.uid();
begin
 if actor is null or actor='09464d2d-669b-4771-aecd-4776b7350b44'::uuid then raise exception 'A personal account is required';end if;
 if value is null or value !~ '^[a-z0-9_]{3,24}$' then raise exception 'Use 3–24 letters, numbers or underscores';end if;
 insert into public.songbook_handles(user_id,handle) values(actor,value) on conflict(user_id) do update set handle=excluded.handle;
 return value;
exception when unique_violation then raise exception 'That ID is already taken';
end $$;
create function public.set_songbook_handle(new_handle text) returns text language sql security invoker set search_path='' as $$select songbook_private.set_songbook_handle(new_handle)$$;
create function songbook_private.resolve_songbook_friend(identifier text) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid; target_email text; target_handle text; display text;
begin
 if auth.uid() is null or coalesce(songbook_private.songbook_role(),'') in ('','owner') then raise exception 'Personal account access required';end if;
 select u.id,u.email,h.handle,coalesce(nullif(u.raw_user_meta_data->>'full_name',''),split_part(u.email,'@',1)) into target,target_email,target_handle,display
 from auth.users u join public.songbook_members m on m.user_id=u.id left join public.songbook_handles h on h.user_id=u.id
 where u.email_confirmed_at is not null and m.role<>'owner' and (lower(u.email)=lower(trim(identifier)) or h.handle=lower(regexp_replace(trim(identifier),'^@','')));
 if target is null or target=auth.uid() then raise exception 'Choose another approved personal account';end if;
 return jsonb_build_object('user_id',target,'email',target_email,'handle',target_handle,'display_name',display);
end $$;
create function public.resolve_songbook_friend(identifier text) returns jsonb language sql security invoker set search_path='' as $$select songbook_private.resolve_songbook_friend(identifier)$$;
create or replace function songbook_private.add_songbook_friend(email_address text,private_nickname text default '') returns void language plpgsql security definer set search_path='' as $$
declare resolved jsonb;
begin
 resolved:=songbook_private.resolve_songbook_friend(email_address);
 if length(coalesce(private_nickname,''))>80 then raise exception 'Nickname must be 80 characters or fewer';end if;
 insert into public.songbook_friends(owner_id,friend_id,email,nickname) values(auth.uid(),(resolved->>'user_id')::uuid,resolved->>'email',trim(coalesce(private_nickname,''))) on conflict(owner_id,friend_id) do update set email=excluded.email,nickname=case when excluded.nickname<>'' then excluded.nickname else public.songbook_friends.nickname end;
end $$;
revoke all on function songbook_private.set_songbook_handle(text),songbook_private.resolve_songbook_friend(text),public.set_songbook_handle(text),public.resolve_songbook_friend(text) from public,anon;
grant execute on function songbook_private.set_songbook_handle(text),songbook_private.resolve_songbook_friend(text),public.set_songbook_handle(text),public.resolve_songbook_friend(text) to authenticated;

create or replace function songbook_private.set_songbook_member(email_address text,member_role text) returns void language plpgsql security definer set search_path='' as $$
declare target uuid; actor_role text; target_role text;
begin
 actor_role:=songbook_private.songbook_role();
 if actor_role is null or actor_role not in ('owner','manager') then raise exception 'Owner or manager access required'; end if;
 if member_role is null or member_role not in ('viewer','manager','remove') then raise exception 'Invalid member role'; end if;
 select u.id into target from auth.users u left join public.songbook_handles h on h.user_id=u.id where (lower(u.email)=lower(trim(email_address)) or h.handle=lower(regexp_replace(trim(email_address),'^@',''))) and u.email_confirmed_at is not null;
 if target is null then raise exception 'Ask your friend to create an account first'; end if;
 select role into target_role from public.songbook_members where user_id=target for update;
 if target_role='owner' then raise exception 'Church owner cannot be changed here'; end if;
 if actor_role='manager' and (member_role='manager' or target_role='manager') then raise exception 'Only the church owner can appoint or change managers'; end if;
 if member_role='remove' then delete from public.songbook_members where user_id=target;
 else insert into public.songbook_members(user_id,role) values(target,member_role) on conflict(user_id) do update set role=excluded.role; end if;
end $$;
