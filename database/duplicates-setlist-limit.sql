-- Already applied to live database; reference only.
create function songbook_private.normalized_song_title(value text) returns text language sql immutable set search_path='' as $$ select lower(regexp_replace(trim(value),'\s+',' ','g')); $$;
revoke all on function songbook_private.normalized_song_title(text) from public,anon,authenticated;
create or replace function songbook_private.copy_first_song_to_church() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.owner_id is not null and new.source_song_id is null then
  if new.owner_id is distinct from auth.uid() or songbook_private.songbook_role() is null then raise exception 'Approved songbook account required.';end if;
  if coalesce(current_setting('bic.restoring',true),'')<>'yes' then
   perform pg_advisory_xact_lock(hashtextextended(songbook_private.normalized_song_title(new.title),0));
   if not exists(select 1 from public.shared_songs where owner_id is null and songbook_private.normalized_song_title(title)=songbook_private.normalized_song_title(new.title)) then
    insert into public.shared_songs(title,artist,key,category,content) values(new.title,new.artist,new.key,new.category,new.content);
   end if;
  end if;
 end if;return new;
end $$;
create function songbook_private.limit_personal_setlists() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.owner_id is not null then
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,25));
  if (select count(*) from public.songbook_setlists where owner_id=new.owner_id)>=25 then raise exception 'You have reached the limit of 25 personal setlists. Delete an unused setlist first.';end if;
 end if;return new;
end $$;
revoke all on function songbook_private.limit_personal_setlists() from public,anon,authenticated;
create trigger limit_personal_setlists before insert on public.songbook_setlists for each row execute function songbook_private.limit_personal_setlists();

create function songbook_private.check_church_song_title() returns trigger language plpgsql security definer set search_path='' as $$ begin if new.owner_id is null and coalesce(current_setting('bic.restoring',true),'')<>'yes' then perform pg_advisory_xact_lock(hashtextextended(songbook_private.normalized_song_title(new.title),0));if exists(select 1 from public.shared_songs where owner_id is null and songbook_private.normalized_song_title(title)=songbook_private.normalized_song_title(new.title)) then raise exception 'A church song with this title already exists. Open that song to edit it, or use a distinct title for a different song.';end if;end if;return new;end $$;
revoke all on function songbook_private.check_church_song_title() from public,anon,authenticated;
create trigger check_church_song_title before insert on public.shared_songs for each row execute function songbook_private.check_church_song_title();
