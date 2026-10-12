-- Reference only: applied through a managed migration.
create table public.songbook_song_history(
 id bigint generated always as identity primary key,
 song_id bigint not null,owner_id uuid references auth.users(id) on delete cascade,
 event text not null check(event in ('saved','deleted')),
 snapshot jsonb not null,created_at timestamptz not null default now()
);
create index song_history_scope on public.songbook_song_history(owner_id,song_id,created_at desc);
alter table public.songbook_song_history enable row level security;
revoke all on public.songbook_song_history from anon,authenticated;
grant select on public.songbook_song_history to authenticated;
create policy history_read on public.songbook_song_history for select to authenticated using((owner_id=(select auth.uid()) and coalesce((select songbook_private.songbook_role()),'') not in ('','owner')) or (owner_id is null and (select songbook_private.songbook_role())='owner'));
create function songbook_private.record_song_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then insert into public.songbook_song_history(song_id,owner_id,event,snapshot) values(old.id,old.owner_id,'deleted',to_jsonb(old));
 else insert into public.songbook_song_history(song_id,owner_id,event,snapshot) values(new.id,new.owner_id,'saved',to_jsonb(new));end if;
 return null;
end $$;
revoke all on function songbook_private.record_song_history() from public,anon,authenticated;
insert into public.songbook_song_history(song_id,owner_id,event,snapshot) select id,owner_id,'saved',to_jsonb(s) from public.shared_songs s;
create trigger record_song_history after insert or update or delete on public.shared_songs for each row execute function songbook_private.record_song_history();
create or replace function songbook_private.copy_first_song_to_church() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.owner_id is not null and new.source_song_id is null then
  if new.owner_id is distinct from auth.uid() or songbook_private.songbook_role() is null then raise exception 'Approved songbook account required.'; end if;
  if coalesce(current_setting('bic.restoring',true),'')<>'yes' then
   insert into public.shared_songs(title,artist,key,category,content) values(new.title,new.artist,new.key,new.category,new.content);
  end if;
 end if;
 return new;
end $$;
create function songbook_private.restore_song_version(version_id bigint,expected_revision integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.songbook_song_history; s public.shared_songs; f uuid; source bigint; previous text;
begin
 select * into h from public.songbook_song_history where id=version_id;
 if not found or not coalesce(((h.owner_id=auth.uid() and coalesce(songbook_private.songbook_role(),'') not in ('','owner')) or (h.owner_id is null and songbook_private.songbook_role()='owner')),false) then raise exception 'Song history access denied';end if;
 perform pg_advisory_xact_lock(h.song_id);
 select * into s from public.shared_songs where id=h.song_id for update;
 if found and (s.owner_id is distinct from h.owner_id or expected_revision is null or s.revision<>expected_revision) then raise exception 'Song changed. Refresh before restoring.';end if;
 select id into f from public.songbook_folders where id=(h.snapshot->>'folder_id')::uuid and owner_id=h.owner_id;
 select id into source from public.shared_songs where id=(h.snapshot->>'source_song_id')::bigint and owner_id is null;
 previous:=current_setting('bic.restoring',true);perform set_config('bic.restoring','yes',true);
 if s.id is not null then
 update public.shared_songs set title=h.snapshot->>'title',artist=h.snapshot->>'artist',key=h.snapshot->>'key',category=h.snapshot->>'category',content=h.snapshot->>'content',folder_id=f where id=h.song_id returning * into s;
 else
 insert into public.shared_songs(id,owner_id,title,artist,key,category,content,folder_id,source_song_id,revision) overriding system value values(h.song_id,h.owner_id,h.snapshot->>'title',h.snapshot->>'artist',h.snapshot->>'key',h.snapshot->>'category',h.snapshot->>'content',f,source,(select coalesce(max((snapshot->>'revision')::integer),1)+1 from public.songbook_song_history where song_id=h.song_id)) returning * into s;
 end if;
 perform set_config('bic.restoring',coalesce(previous,''),true);return to_jsonb(s);
end $$;
revoke all on function songbook_private.restore_song_version(bigint,integer) from public,anon;
grant execute on function songbook_private.restore_song_version(bigint,integer) to authenticated;
create function public.restore_song_version(version_id bigint,expected_revision integer default null) returns jsonb language sql security invoker set search_path='' as $$select songbook_private.restore_song_version(version_id,expected_revision);$$;
revoke all on function public.restore_song_version(bigint,integer) from public,anon;
grant execute on function public.restore_song_version(bigint,integer) to authenticated;
drop trigger live_song_changed on public.shared_songs;
create trigger live_song_changed after insert or update or delete on public.shared_songs for each row execute function songbook_private.live_song_changed();
create function songbook_private.export_songbook_backup(church boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare scope uuid:=auth.uid(); result jsonb;
begin
 if scope is null or songbook_private.songbook_role() is null then raise exception 'Approved account required';end if;
 if church then scope:=null;elsif songbook_private.songbook_role()='owner' then raise exception 'Church account has no personal library';end if;
 select jsonb_build_object('format','bic-worship-db','version',2,'scope',case when church then 'church' else 'personal' end,'exported_at',now(),
 'songs',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.shared_songs s where owner_id is not distinct from scope),
 'folders',(select coalesce(jsonb_agg(to_jsonb(f)),'[]') from public.songbook_folders f where owner_id=scope),
 'setlists',(select coalesce(jsonb_agg(to_jsonb(l)),'[]') from public.songbook_setlists l where owner_id=scope),
 'favorites',(select coalesce(jsonb_agg(song_id),'[]') from public.songbook_favorites where user_id=auth.uid() and song_id in(select id from public.shared_songs where owner_id is not distinct from scope)),
 'friends',(select coalesce(jsonb_agg(jsonb_build_object('email',email,'nickname',nickname)),'[]') from public.songbook_friends where owner_id=scope)) into result;
 return result;
end $$;
revoke all on function songbook_private.export_songbook_backup(boolean) from public,anon;
grant execute on function songbook_private.export_songbook_backup(boolean) to authenticated;
create function public.export_songbook_backup(church boolean default false) returns jsonb language sql security invoker set search_path='' as $$select songbook_private.export_songbook_backup(church);$$;
revoke all on function public.export_songbook_backup(boolean) from public,anon;
grant execute on function public.export_songbook_backup(boolean) to authenticated;
create function songbook_private.import_songbook_backup(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare scope uuid:=auth.uid(); item jsonb; map_s jsonb:='{}'; map_f jsonb:='{}'; id_song bigint; id_folder uuid; ids bigint[]; oldsetting text; count_s int:=0; label text;
begin
 if scope is null or songbook_private.songbook_role() is null then raise exception 'Approved account required';end if;
 if coalesce(payload->>'format','')<>'bic-worship-db' or coalesce(payload->>'version','')<>'2' or coalesce(payload->>'scope','') not in ('personal','church') then raise exception 'Invalid complete backup';end if;
 if payload->>'scope'='church' then if songbook_private.songbook_role()<>'owner' then raise exception 'Only church owner may restore church backup';end if;scope:=null;elsif songbook_private.songbook_role()='owner' then raise exception 'Church account cannot restore personal backup';end if;
 if coalesce(jsonb_typeof(payload->'songs'),'')<>'array' or jsonb_array_length(payload->'songs')>2000 or coalesce(jsonb_typeof(payload->'folders'),'')<>'array' or jsonb_array_length(payload->'folders')>500 or coalesce(jsonb_typeof(payload->'setlists'),'')<>'array' or jsonb_array_length(payload->'setlists')>500 then raise exception 'Invalid backup or backup exceeds limits';end if;
 oldsetting:=current_setting('bic.restoring',true);perform set_config('bic.restoring','yes',true);
 if scope is not null then
 for item in select value from jsonb_array_elements(payload->'folders') loop
 label:=left(trim(item->>'name'),65)||' (restored '||substr(gen_random_uuid()::text,1,8)||')';
 insert into public.songbook_folders(owner_id,name) values(scope,label) returning id into id_folder;map_f:=map_f||jsonb_build_object(item->>'id',id_folder);
 end loop;end if;
 for item in select value from jsonb_array_elements(payload->'songs') loop
 if coalesce(trim(item->>'title'),'')='' or length(item->>'content')>200000 or item->>'id' is null or map_s ? (item->>'id') then raise exception 'Invalid song in backup';end if;
 insert into public.shared_songs(owner_id,title,artist,key,category,content,folder_id) values(scope,item->>'title',coalesce(item->>'artist',''),coalesce(item->>'key','C'),coalesce(item->>'category',''),coalesce(item->>'content',''),(map_f->>(item->>'folder_id'))::uuid) returning id into id_song;
 map_s:=map_s||jsonb_build_object(item->>'id',id_song);count_s:=count_s+1;
 end loop;
 if scope is not null then
 for item in select value from jsonb_array_elements(payload->'setlists') loop
 if jsonb_typeof(item->'song_ids')<>'array' or jsonb_array_length(item->'song_ids')>100 then raise exception 'Invalid setlist';end if;
 select coalesce(array_agg((map_s->>value)::bigint order by position),'{}') into ids from jsonb_array_elements_text(item->'song_ids') with ordinality entries(value,position) where map_s ? value;
 insert into public.songbook_setlists(owner_id,title,song_ids) values(scope,left(item->>'title',170)||' (restored)',ids);
 end loop;
 for item in select value from jsonb_array_elements(coalesce(payload->'friends','[]')) loop
 if exists(select 1 from auth.users u join public.songbook_members m on m.user_id=u.id where lower(u.email)=lower(item->>'email') and m.role<>'owner' and u.id<>scope) then perform songbook_private.add_songbook_friend(item->>'email',left(coalesce(item->>'nickname',''),80));end if;
 end loop;end if;
 for item in select value from jsonb_array_elements(coalesce(payload->'favorites','[]')) loop
 if map_s ? (item#>>'{}') then insert into public.songbook_favorites(user_id,song_id) values(auth.uid(),(map_s->>(item#>>'{}'))::bigint) on conflict do nothing;end if;
 end loop;
 perform set_config('bic.restoring',coalesce(oldsetting,''),true);return jsonb_build_object('songs',count_s);
end $$;
revoke all on function songbook_private.import_songbook_backup(jsonb) from public,anon;
grant execute on function songbook_private.import_songbook_backup(jsonb) to authenticated;
create function public.import_songbook_backup(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select songbook_private.import_songbook_backup(payload);$$;
revoke all on function public.import_songbook_backup(jsonb) from public,anon;
grant execute on function public.import_songbook_backup(jsonb) to authenticated;
