begin;

alter table public.songbook_setlist_shares
  add column shared_by_email boolean not null default true,
  add column shared_by_link boolean not null default false,
  add constraint setlist_share_has_source check (shared_by_email or shared_by_link);

create table songbook_private.setlist_links (
  setlist_id uuid primary key references public.songbook_setlists(id) on delete cascade,
  token uuid not null unique default gen_random_uuid()
);
revoke all on songbook_private.setlist_links from public, anon, authenticated;

-- Link redemption does not add people to the leader's friends.
create or replace function songbook_private.remember_setlist_friend() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.shared_by_email and (tg_op = 'INSERT' or not old.shared_by_email) then
    insert into public.songbook_friends(owner_id,friend_id,email)
    values(new.sender_id,new.recipient_id,new.recipient_email)
    on conflict(owner_id,friend_id) do update set email=excluded.email;
  end if;
  return new;
end $$;
drop trigger remember_setlist_friend on public.songbook_setlist_shares;
create trigger remember_setlist_friend after insert or update of shared_by_email
  on public.songbook_setlist_shares for each row execute function songbook_private.remember_setlist_friend();

create or replace function songbook_private.share_setlist(list_id uuid,recipient_email_address text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; list public.songbook_setlists; payload jsonb; from_email text; to_email text;
begin
 if actor is null or coalesce(songbook_private.songbook_role(),'') in ('','owner') then raise exception 'Personal account access required'; end if;
 select * into list from public.songbook_setlists where id=list_id and owner_id=actor for update;
 if not found then raise exception 'Personal setlist not found'; end if;
 select u.id,u.email into target,to_email from auth.users u join public.songbook_members m on m.user_id=u.id where lower(u.email)=lower(trim(recipient_email_address)) and u.email_confirmed_at is not null and m.role<>'owner';
 if target is null or target=actor then raise exception 'Choose another approved personal account; church accounts cannot receive setlists'; end if;
 select email into from_email from auth.users where id=actor;
 payload:=songbook_private.setlist_share_payload(list.song_ids,list.song_entries,actor);
 if jsonb_array_length(payload)<>cardinality(list.song_ids) then raise exception 'Remove missing songs before sharing'; end if;
 insert into public.songbook_setlist_shares(setlist_id,sender_id,recipient_id,sender_email,recipient_email,title,songs,shared_by_email) values(list.id,actor,target,from_email,to_email,list.title,payload,true) on conflict(setlist_id,recipient_id) do update set shared_by_email=true,title=excluded.title,songs=excluded.songs,updated_at=now();
end $$;

-- The owner's list lock serializes link creation, redemption and revocation.
create function songbook_private.manage_setlist_link(target uuid, operation text) returns uuid
language plpgsql security definer set search_path='' as $$
declare link_token uuid;
begin
  if coalesce(songbook_private.songbook_role(),'') in ('','owner') then
    raise exception 'Personal account access required';
  end if;
  perform 1 from public.songbook_setlists where id=target and owner_id=auth.uid() for update;
  if not found then raise exception 'Personal setlist not found'; end if;
  if operation='enable' then
    insert into songbook_private.setlist_links(setlist_id) values(target) on conflict do nothing;
  elsif operation='disable' then
    delete from public.songbook_setlist_shares where setlist_id=target and shared_by_link and not shared_by_email;
    update public.songbook_setlist_shares set shared_by_link=false where setlist_id=target and shared_by_link;
    delete from songbook_private.setlist_links where setlist_id=target;
  elsif operation is distinct from 'status' then raise exception 'Invalid link action';
  end if;
  select token into link_token from songbook_private.setlist_links where setlist_id=target;
  return link_token;
end $$;

create function songbook_private.open_setlist_link(link_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; list public.songbook_setlists; share_id uuid; payload jsonb;
begin
  if actor is null or coalesce(songbook_private.songbook_role(),'') in ('','owner') then
    raise exception 'Approved personal account required';
  end if;
  select setlist_id into target from songbook_private.setlist_links where token=link_token;
  select * into list from public.songbook_setlists where id=target for update;
  if not found or not exists (
    select 1 from songbook_private.setlist_links where setlist_id=target and token=link_token
  ) then return null; end if;
  if list.owner_id=actor then return jsonb_build_object('owned_setlist_id',target); end if;
  if coalesce((select role from public.songbook_members where user_id=list.owner_id),'') in ('','owner') then
    return null;
  end if;
  payload:=songbook_private.setlist_share_payload(list.song_ids,list.song_entries,list.owner_id);
  insert into public.songbook_setlist_shares(setlist_id,sender_id,recipient_id,sender_email,recipient_email,title,songs,shared_by_email,shared_by_link)
  values(target,list.owner_id,actor,(select email from auth.users where id=list.owner_id),
    (select email from auth.users where id=actor),list.title,payload,false,true)
  on conflict(setlist_id,recipient_id) do update set shared_by_link=true,title=excluded.title,songs=excluded.songs,updated_at=now()
  returning id into share_id;
  return jsonb_build_object('share_id',share_id);
end $$;

create table public.songbook_setlist_preferences (
  setlist_id uuid not null references public.songbook_setlists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id bigint not null,
  note text not null default '' check (char_length(note)<=1000),
  capo smallint check (capo between 0 and 11),
  primary key(setlist_id,user_id,song_id)
);
alter table public.songbook_setlist_preferences enable row level security;
revoke all on public.songbook_setlist_preferences from public,anon,authenticated;
grant select on public.songbook_setlist_preferences to authenticated;

create function songbook_private.can_access_setlist_song(target uuid, song bigint) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(songbook_private.songbook_role(),'') not in ('','owner') and exists (
    select 1 from public.songbook_setlists l where l.id=target and song=any(l.song_ids)
      and (l.owner_id=auth.uid() or exists (
        select 1 from public.songbook_setlist_shares s
        where s.setlist_id=l.id and s.sender_id=l.owner_id and s.recipient_id=auth.uid()
      ))
  );
$$;
revoke all on function songbook_private.can_access_setlist_song(uuid,bigint) from public,anon;
grant execute on function songbook_private.can_access_setlist_song(uuid,bigint) to authenticated;
create policy own_setlist_preferences on public.songbook_setlist_preferences for select to authenticated
  using (user_id=(select auth.uid()) and songbook_private.can_access_setlist_song(setlist_id,song_id));

create function songbook_private.save_setlist_preference(
  target uuid, song bigint, expected_user uuid, note_value text default null, capo_value smallint default null, initialize_capo boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.songbook_setlist_preferences;
begin
  if expected_user is distinct from auth.uid() or not songbook_private.can_access_setlist_song(target,song) then
    raise exception 'Setlist song unavailable';
  end if;
  if note_value is null and capo_value is null then raise exception 'Enter a note or capo'; end if;
  insert into public.songbook_setlist_preferences as pref(setlist_id,user_id,song_id,note,capo)
  values(target,auth.uid(),song,coalesce(note_value,''),capo_value)
  on conflict(setlist_id,user_id,song_id) do update set
    note=coalesce(note_value,pref.note),
    capo=case when initialize_capo then coalesce(pref.capo,capo_value) else coalesce(capo_value,pref.capo) end
  returning * into saved;
  return jsonb_build_object('song_id',saved.song_id,'note',saved.note,'capo',saved.capo);
end $$;

create function public.manage_setlist_link(target uuid, operation text) returns uuid
language sql security invoker set search_path='' as $$select songbook_private.manage_setlist_link(target,operation)$$;
create function public.open_setlist_link(link_token uuid) returns jsonb
language sql security invoker set search_path='' as $$select songbook_private.open_setlist_link(link_token)$$;
create function public.save_setlist_preference(
  target uuid, song bigint, expected_user uuid, note_value text default null, capo_value smallint default null, initialize_capo boolean default false
) returns jsonb language sql security invoker set search_path='' as $$
  select songbook_private.save_setlist_preference(target,song,expected_user,note_value,capo_value,initialize_capo)
$$;
revoke all on function
  public.manage_setlist_link(uuid,text), songbook_private.manage_setlist_link(uuid,text),
  public.open_setlist_link(uuid), songbook_private.open_setlist_link(uuid),
  public.save_setlist_preference(uuid,bigint,uuid,text,smallint,boolean),
  songbook_private.save_setlist_preference(uuid,bigint,uuid,text,smallint,boolean)
  from public,anon;
grant execute on function
  public.manage_setlist_link(uuid,text), songbook_private.manage_setlist_link(uuid,text),
  public.open_setlist_link(uuid), songbook_private.open_setlist_link(uuid),
  public.save_setlist_preference(uuid,bigint,uuid,text,smallint,boolean),
  songbook_private.save_setlist_preference(uuid,bigint,uuid,text,smallint,boolean)
  to authenticated;
commit;
