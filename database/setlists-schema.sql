-- Already applied to the live database on October 5, 2026. Reference only.
create table public.songbook_setlists (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 1 and 200),
 song_ids bigint[] not null default '{}' check(cardinality(song_ids)<=100),
 revision integer not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.songbook_setlists enable row level security;
revoke all on public.songbook_setlists from anon,authenticated;
grant select,insert,update,delete on public.songbook_setlists to authenticated;
create policy setlists_read on public.songbook_setlists for select to authenticated using ((select songbook_private.songbook_role()) is not null);
create policy setlists_add on public.songbook_setlists for insert to authenticated with check ((select songbook_private.songbook_role()) in ('owner','editor'));
create policy setlists_edit on public.songbook_setlists for update to authenticated using ((select songbook_private.songbook_role()) in ('owner','editor')) with check ((select songbook_private.songbook_role()) in ('owner','editor'));
create policy setlists_remove on public.songbook_setlists for delete to authenticated using ((select songbook_private.songbook_role()) in ('owner','editor'));
create trigger setlist_revision before update on public.songbook_setlists for each row execute function songbook_private.bump_song_revision();
create table public.songbook_favorites (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 song_id bigint not null references public.shared_songs(id) on delete cascade,
 primary key(user_id,song_id)
);
create index songbook_favorites_song_idx on public.songbook_favorites(song_id);
alter table public.songbook_favorites enable row level security;
revoke all on public.songbook_favorites from anon,authenticated;
grant select,insert,delete on public.songbook_favorites to authenticated;
create policy favorites_read on public.songbook_favorites for select to authenticated using (user_id=(select auth.uid()) and (select songbook_private.songbook_role()) is not null);
create policy favorites_add on public.songbook_favorites for insert to authenticated with check (user_id=(select auth.uid()) and (select songbook_private.songbook_role()) is not null);
create policy favorites_remove on public.songbook_favorites for delete to authenticated using (user_id=(select auth.uid()) and (select songbook_private.songbook_role()) is not null);
