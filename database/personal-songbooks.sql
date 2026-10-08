-- Reference: already applied to the live database. Do not run again.
create table public.songbook_folders (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 100),
 unique(owner_id,name)
);
alter table public.songbook_folders enable row level security;
revoke all on public.songbook_folders from anon,authenticated;
grant select,insert,update,delete on public.songbook_folders to authenticated;
create policy folders_read on public.songbook_folders for select to authenticated using(owner_id=(select auth.uid()) and (select songbook_private.songbook_role()) is not null);
create policy folders_add on public.songbook_folders for insert to authenticated with check(owner_id=(select auth.uid()) and (select songbook_private.songbook_role()) is not null);
create policy folders_edit on public.songbook_folders for update to authenticated using(owner_id=(select auth.uid()) and (select songbook_private.songbook_role()) is not null) with check(owner_id=(select auth.uid()) and (select songbook_private.songbook_role()) is not null);
create policy folders_remove on public.songbook_folders for delete to authenticated using(owner_id=(select auth.uid()) and (select songbook_private.songbook_role()) is not null);
alter table public.shared_songs add column owner_id uuid references auth.users(id) on delete cascade,
 add column source_song_id bigint references public.shared_songs(id) on delete set null,
 add column folder_id uuid references public.songbook_folders(id) on delete set null;
alter table public.songbook_setlists add column owner_id uuid references auth.users(id) on delete cascade;
create index songs_owner on public.shared_songs(owner_id);
create index songs_source on public.shared_songs(source_song_id);
create index songs_folder on public.shared_songs(folder_id);
create index setlists_owner on public.songbook_setlists(owner_id);
drop policy song_read on public.shared_songs;
drop policy song_add on public.shared_songs;
drop policy song_edit on public.shared_songs;
drop policy song_delete on public.shared_songs;
create policy song_read on public.shared_songs for select to authenticated using((select songbook_private.songbook_role()) is not null and (owner_id is null or owner_id=(select auth.uid())));
create policy song_add on public.shared_songs for insert to authenticated with check((select songbook_private.songbook_role()) is not null and (owner_id=(select auth.uid()) or (owner_id is null and (select songbook_private.songbook_role()) in ('owner','editor'))));
create policy song_edit on public.shared_songs for update to authenticated using((select songbook_private.songbook_role()) is not null and (owner_id=(select auth.uid()) or (owner_id is null and (select songbook_private.songbook_role()) in ('owner','editor')))) with check((select songbook_private.songbook_role()) is not null and (owner_id=(select auth.uid()) or (owner_id is null and (select songbook_private.songbook_role()) in ('owner','editor'))));
create policy song_remove on public.shared_songs for delete to authenticated using((select songbook_private.songbook_role()) is not null and (owner_id=(select auth.uid()) or (owner_id is null and (select songbook_private.songbook_role()) in ('owner','editor'))));
drop policy setlists_read on public.songbook_setlists;
drop policy setlists_add on public.songbook_setlists;
drop policy setlists_edit on public.songbook_setlists;
drop policy setlists_remove on public.songbook_setlists;
create policy setlists_read on public.songbook_setlists for select to authenticated using((select songbook_private.songbook_role()) is not null and (owner_id is null or owner_id=(select auth.uid())));
create policy setlists_add on public.songbook_setlists for insert to authenticated with check((select songbook_private.songbook_role()) is not null and (owner_id=(select auth.uid()) or (owner_id is null and (select songbook_private.songbook_role()) in ('owner','editor'))));
create policy setlists_edit on public.songbook_setlists for update to authenticated using((select songbook_private.songbook_role()) is not null and (owner_id=(select auth.uid()) or (owner_id is null and (select songbook_private.songbook_role()) in ('owner','editor')))) with check((select songbook_private.songbook_role()) is not null and (owner_id=(select auth.uid()) or (owner_id is null and (select songbook_private.songbook_role()) in ('owner','editor'))));
create policy setlists_remove on public.songbook_setlists for delete to authenticated using((select songbook_private.songbook_role()) is not null and (owner_id=(select auth.uid()) or (owner_id is null and (select songbook_private.songbook_role()) in ('owner','editor'))));
create function songbook_private.check_songbook_scope() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and new.owner_id is distinct from old.owner_id then raise exception 'Songbook ownership cannot be changed.'; end if;
 if tg_table_name='shared_songs' then
  if new.folder_id is not null and not exists(select 1 from public.songbook_folders f where f.id=new.folder_id and f.owner_id=new.owner_id) then raise exception 'Choose a folder in your own songbook.'; end if;
  if tg_op='INSERT' and new.source_song_id is not null and not exists(select 1 from public.shared_songs s where s.id=new.source_song_id and s.owner_id is null) then raise exception 'Copy source must be a church song.'; end if;
  if tg_op='UPDATE' and new.source_song_id is distinct from old.source_song_id and new.source_song_id is not null then raise exception 'Copy source cannot be changed.'; end if;
 else
  if exists(select 1 from unnest(new.song_ids) as requested(song_id) where not exists(select 1 from public.shared_songs s where s.id=requested.song_id and s.owner_id is not distinct from new.owner_id)) then raise exception 'Setlists can only contain songs from this songbook.'; end if;
 end if;
 return new;
end $$;
create trigger songbook_scope before insert or update on public.shared_songs for each row execute function songbook_private.check_songbook_scope();
create trigger setlist_scope before insert or update on public.songbook_setlists for each row execute function songbook_private.check_songbook_scope();
create function songbook_private.copy_first_song_to_church() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.owner_id is not null and new.source_song_id is null then
  if new.owner_id is distinct from auth.uid() or songbook_private.songbook_role() is null then raise exception 'Approved songbook account required.'; end if;
  insert into public.shared_songs(title,artist,key,category,content) values(new.title,new.artist,new.key,new.category,new.content);
 end if;
 return new;
end $$;
revoke all on function songbook_private.copy_first_song_to_church() from public,anon,authenticated;
revoke all on function songbook_private.check_songbook_scope() from public,anon,authenticated;
create trigger first_song_church_copy after insert on public.shared_songs for each row execute function songbook_private.copy_first_song_to_church();

drop policy favorites_add on public.songbook_favorites;
create policy favorites_add on public.songbook_favorites for insert to authenticated with check(user_id=(select auth.uid()) and (select songbook_private.songbook_role()) is not null and exists(select 1 from public.shared_songs s where s.id=song_id));
