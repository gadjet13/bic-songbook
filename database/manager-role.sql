-- Already applied to the live database; reference only.
alter table public.songbook_members drop constraint songbook_members_role_check;
alter table public.songbook_members add constraint songbook_members_role_check check(role in ('owner','manager','editor','viewer'));
update public.songbook_members m set role='manager' from auth.users u where m.user_id=u.id and lower(u.email)='agatheojetro@gmail.com' and m.role='owner';
drop policy member_read on public.songbook_members;
create policy member_read on public.songbook_members for select to authenticated using(user_id=(select auth.uid()) or (select songbook_private.songbook_role()) in ('owner','manager'));
create or replace function songbook_private.set_songbook_member(email_address text,member_role text) returns void language plpgsql security definer set search_path='' as $$
declare target uuid; actor_role text; target_role text;
begin
 actor_role:=songbook_private.songbook_role();
 if actor_role is null or actor_role not in ('owner','manager') then raise exception 'Owner or manager access required'; end if;
 if member_role is null or member_role not in ('viewer','manager','remove') then raise exception 'Invalid member role'; end if;
 select id into target from auth.users where lower(email)=lower(trim(email_address)) and email_confirmed_at is not null;
 if target is null then raise exception 'Ask your friend to create an account first'; end if;
 select role into target_role from public.songbook_members where user_id=target for update;
 if target_role='owner' then raise exception 'Church owner cannot be changed here'; end if;
 if actor_role='manager' and (member_role='manager' or target_role='manager') then raise exception 'Only the church owner can appoint or change managers'; end if;
 if member_role='remove' then delete from public.songbook_members where user_id=target;
 else insert into public.songbook_members(user_id,role) values(target,member_role) on conflict(user_id) do update set role=excluded.role; end if;
end $$;
drop policy song_add on public.shared_songs;
create policy song_add on public.shared_songs for insert to authenticated with check((select songbook_private.songbook_role()) is not null and ((owner_id=(select auth.uid()) and (select songbook_private.songbook_role())<>'owner') or (owner_id is null and (select songbook_private.songbook_role())='owner')));
drop policy song_edit on public.shared_songs;
create policy song_edit on public.shared_songs for update to authenticated using((select songbook_private.songbook_role()) is not null and ((owner_id=(select auth.uid()) and (select songbook_private.songbook_role())<>'owner') or (owner_id is null and (select songbook_private.songbook_role())='owner'))) with check((select songbook_private.songbook_role()) is not null and ((owner_id=(select auth.uid()) and (select songbook_private.songbook_role())<>'owner') or (owner_id is null and (select songbook_private.songbook_role())='owner')));
drop policy song_remove on public.shared_songs;
create policy song_remove on public.shared_songs for delete to authenticated using((select songbook_private.songbook_role()) is not null and ((owner_id=(select auth.uid()) and (select songbook_private.songbook_role())<>'owner') or (owner_id is null and (select songbook_private.songbook_role())='owner'))) ;
drop policy setlists_add on public.songbook_setlists;
create policy setlists_add on public.songbook_setlists for insert to authenticated with check((select songbook_private.songbook_role()) is not null and ((owner_id=(select auth.uid()) and (select songbook_private.songbook_role())<>'owner') or (owner_id is null and (select songbook_private.songbook_role())='owner')));
drop policy setlists_edit on public.songbook_setlists;
create policy setlists_edit on public.songbook_setlists for update to authenticated using((select songbook_private.songbook_role()) is not null and ((owner_id=(select auth.uid()) and (select songbook_private.songbook_role())<>'owner') or (owner_id is null and (select songbook_private.songbook_role())='owner'))) with check((select songbook_private.songbook_role()) is not null and ((owner_id=(select auth.uid()) and (select songbook_private.songbook_role())<>'owner') or (owner_id is null and (select songbook_private.songbook_role())='owner')));
drop policy setlists_remove on public.songbook_setlists;
create policy setlists_remove on public.songbook_setlists for delete to authenticated using((select songbook_private.songbook_role()) is not null and ((owner_id=(select auth.uid()) and (select songbook_private.songbook_role())<>'owner') or (owner_id is null and (select songbook_private.songbook_role())='owner'))) ;
create function songbook_private.list_songbook_accounts() returns table(email text,member_role text) language plpgsql security definer set search_path='' as $$
begin
 if coalesce(songbook_private.songbook_role(),'') not in ('owner','manager') then raise exception 'Owner or manager access required'; end if;
 return query select u.email::text,coalesce(m.role,'awaiting approval') from auth.users u left join public.songbook_members m on m.user_id=u.id where u.email_confirmed_at is not null order by lower(u.email);
end $$;
revoke all on function songbook_private.list_songbook_accounts() from public,anon;
grant execute on function songbook_private.list_songbook_accounts() to authenticated;
create function public.list_songbook_accounts() returns table(email text,member_role text) language sql security invoker set search_path='' as $$ select * from songbook_private.list_songbook_accounts(); $$;
revoke all on function public.list_songbook_accounts() from public,anon;
grant execute on function public.list_songbook_accounts() to authenticated;

drop policy folders_add on public.songbook_folders;
create policy folders_add on public.songbook_folders for insert to authenticated with check(owner_id=(select auth.uid()) and (select songbook_private.songbook_role()) is not null and (select songbook_private.songbook_role())<>'owner');
