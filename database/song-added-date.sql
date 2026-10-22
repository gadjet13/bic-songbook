-- Reference only: already applied as track_song_added_dates on October 21, 2026.
-- Existing rows remain NULL: their actual original added date was not recorded.
alter table public.shared_songs add column if not exists created_at timestamptz;
alter table public.shared_songs alter column created_at set default now();
create or replace function songbook_private.bump_song_revision() returns trigger language plpgsql set search_path='' as $$
begin
 new.created_at := old.created_at;
 new.revision := old.revision + 1;
 new.updated_at := now();
 return new;
end; $$;
