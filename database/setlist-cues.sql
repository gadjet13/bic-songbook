begin;

create table public.songbook_setlist_cues (
  setlist_id uuid not null references public.songbook_setlists(id) on delete cascade,
  song_id bigint not null,
  location text not null check (length(location) between 1 and 1024),
  scope text not null check (scope in ('team', 'private')),
  author_id uuid not null references auth.users(id) on delete cascade,
  cue text not null check (length(cue) between 1 and 300 and length(btrim(cue)) > 0),
  primary key (setlist_id, song_id, location, scope, author_id)
);
alter table public.songbook_setlist_cues enable row level security;
revoke all on public.songbook_setlist_cues from public, anon, authenticated;
grant select on public.songbook_setlist_cues to authenticated;
create policy read_setlist_cues on public.songbook_setlist_cues for select to authenticated
  using ((scope = 'team' or author_id = (select auth.uid()))
    and songbook_private.can_access_setlist_song(setlist_id, song_id));

create function songbook_private.save_setlist_cue(
  target uuid, song bigint, expected_user uuid, cue_location text, cue_scope text, cue_value text
) returns void language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  list_owner uuid;
  clean_value text := btrim(cue_value);
begin
  if actor is null or actor is distinct from expected_user
    or not songbook_private.can_access_setlist_song(target,song) then
    raise exception 'Setlist song unavailable';
  end if;
  select owner_id into list_owner from public.songbook_setlists where id=target for update;
  if not found or not songbook_private.can_access_setlist_song(target,song) then
    raise exception 'Setlist song unavailable';
  end if;
  if cue_scope is null or cue_scope not in ('team','private')
    or cue_location is null or length(cue_location) not between 1 and 1024
    or clean_value is null or length(clean_value)>300 then
    raise exception 'Invalid cue';
  end if;
  if cue_scope='team' and list_owner<>actor then
    raise exception 'Only the setlist owner can change a team cue';
  end if;
  if clean_value='' then
    delete from public.songbook_setlist_cues
      where setlist_id=target and song_id=song and location=cue_location
        and scope=cue_scope and author_id=actor;
  else
    insert into public.songbook_setlist_cues (setlist_id,song_id,location,scope,author_id,cue)
      values (target,song,cue_location,cue_scope,actor,clean_value)
      on conflict (setlist_id,song_id,location,scope,author_id) do update set cue=excluded.cue;
  end if;
end $$;

create function public.save_setlist_cue(
  target uuid, song bigint, expected_user uuid, cue_location text, cue_scope text, cue_value text
) returns void language sql security invoker set search_path='' as $$
  select songbook_private.save_setlist_cue(target,song,expected_user,cue_location,cue_scope,cue_value);
$$;
revoke all on function public.save_setlist_cue(uuid,bigint,uuid,text,text,text),
  songbook_private.save_setlist_cue(uuid,bigint,uuid,text,text,text) from public,anon;
grant execute on function public.save_setlist_cue(uuid,bigint,uuid,text,text,text),
  songbook_private.save_setlist_cue(uuid,bigint,uuid,text,text,text) to authenticated;

commit;
