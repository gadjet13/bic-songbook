begin;
create schema if not exists songbook_private;
revoke all on schema songbook_private from public, anon;
grant usage on schema songbook_private to authenticated;
create table public.songbook_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now()
);
create table public.shared_songs (
  id bigint generated always as identity primary key,
  title text not null check(length(trim(title)) between 1 and 300),
  artist text not null default '' check(length(artist)<=300),
  key text not null default 'C' check(length(key)<=20),
  category text not null default '' check(length(category)<=100),
  content text not null default '' check(length(content)<=200000),
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.songbook_members enable row level security;
alter table public.shared_songs enable row level security;
create function songbook_private.songbook_role() returns text language sql stable security definer set search_path = '' as $$
  select role from public.songbook_members where user_id = (select auth.uid());
$$;
revoke all on function songbook_private.songbook_role() from public, anon;
grant execute on function songbook_private.songbook_role() to authenticated;
create policy member_read on public.songbook_members for select to authenticated
  using (user_id=(select auth.uid()) or (select songbook_private.songbook_role())='owner');
create policy song_read on public.shared_songs for select to authenticated
  using ((select songbook_private.songbook_role()) is not null);
create policy song_add on public.shared_songs for insert to authenticated
  with check ((select songbook_private.songbook_role()) in ('owner','editor'));
create policy song_edit on public.shared_songs for update to authenticated
  using ((select songbook_private.songbook_role()) in ('owner','editor'))
  with check ((select songbook_private.songbook_role()) in ('owner','editor'));
create policy song_delete on public.shared_songs for delete to authenticated
  using ((select songbook_private.songbook_role()) in ('owner','editor'));
create function songbook_private.bump_song_revision() returns trigger language plpgsql set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end; $$;
create trigger song_revision before update on public.shared_songs for each row execute function songbook_private.bump_song_revision();
revoke all on public.songbook_members, public.shared_songs from anon, authenticated;
grant select on public.songbook_members to authenticated;
grant select,insert,update,delete on public.shared_songs to authenticated;
grant usage,select on sequence public.shared_songs_id_seq to authenticated;
-- Membership changes only happen through this owner-checked server function.
create function songbook_private.set_songbook_member(email_address text, member_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if songbook_private.songbook_role() is distinct from 'owner' then raise exception 'Owner access required'; end if;
  if member_role is null or member_role not in ('editor','viewer','remove') then raise exception 'Invalid member role'; end if;
  select id into target from auth.users where lower(email)=lower(trim(email_address)) and email_confirmed_at is not null;
  if target is null then raise exception 'Ask your friend to create an account first'; end if;
  if exists(select 1 from public.songbook_members where user_id=target and role='owner') then raise exception 'Owner cannot be changed here'; end if;
  if member_role='remove' then delete from public.songbook_members where user_id=target;
  else insert into public.songbook_members(user_id,role) values(target,member_role)
    on conflict(user_id) do update set role=excluded.role; end if;
end; $$;
revoke all on function songbook_private.set_songbook_member(text,text) from public,anon;
grant execute on function songbook_private.set_songbook_member(text,text) to authenticated;
create function public.set_songbook_member(email_address text, member_role text) returns void
language sql security invoker set search_path = '' as $$
  select songbook_private.set_songbook_member(email_address,member_role);
$$;
revoke all on function public.set_songbook_member(text,text) from public, anon;
grant execute on function public.set_songbook_member(text,text) to authenticated;
revoke all on function songbook_private.bump_song_revision() from public, anon, authenticated;
create index shared_songs_title_idx on public.shared_songs(title);
commit;
-- After creating YOUR account, run this separately with your own email:
-- insert into public.songbook_members(user_id,role)
-- select id,'owner' from auth.users where lower(email)=lower('YOUR_EMAIL_HERE');
