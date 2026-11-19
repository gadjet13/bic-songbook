begin;

alter table public.songbook_setlists add column song_entries jsonb;

create function songbook_private.legacy_setlist_entries(ids bigint[])
returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('song_id',song_id) order by position),'[]'::jsonb)
 from unnest(ids) with ordinality as entries(song_id,position)
$$;

-- Run before setlist_scope so its existing ownership check sees the projected IDs.
create function songbook_private.sync_setlist_entries()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and new.song_entries is not distinct from old.song_entries
   and new.song_ids is distinct from old.song_ids and old.song_entries is not null then
  -- An older client still writes song_ids. Match repeated songs in occurrence order.
  with previous as (
   select entry, row_number() over (partition by entry->>'song_id' order by position) occurrence
   from jsonb_array_elements(old.song_entries) with ordinality as items(entry,position)
  ), current_order as (
   select song_id, position, row_number() over (partition by song_id order by position) occurrence
   from unnest(new.song_ids) with ordinality as items(song_id,position)
  )
  select coalesce(jsonb_agg(coalesce(previous.entry,jsonb_build_object('song_id',current_order.song_id))
    order by current_order.position),'[]'::jsonb) into new.song_entries
  from current_order left join previous on previous.entry->>'song_id'=current_order.song_id::text
    and previous.occurrence=current_order.occurrence;
 end if;
 if new.song_entries is null then return new; end if;
 if jsonb_typeof(new.song_entries)<>'array' then raise exception 'Invalid setlist entries'; end if;
 if jsonb_array_length(new.song_entries)>100 or exists (
  select 1 from jsonb_array_elements(new.song_entries) as entries(entry)
  where jsonb_typeof(entry) is distinct from 'object'
   or jsonb_typeof(entry->'song_id') is distinct from 'number'
   or (entry->>'song_id') !~ '^[1-9][0-9]{0,18}$'
   or coalesce(entry->>'key_override','') not in ('','C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B')
 ) then raise exception 'Invalid setlist entries'; end if;
 select coalesce(array_agg((entry->>'song_id')::bigint order by position),'{}') into new.song_ids
 from jsonb_array_elements(new.song_entries) with ordinality as items(entry,position);
 return new;
end $$;
create trigger setlist_entries_sync before insert or update on public.songbook_setlists
 for each row execute function songbook_private.sync_setlist_entries();

create function songbook_private.setlist_share_payload(ids bigint[], entries jsonb, owner uuid)
returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'artist',s.artist,'key',s.key,
  'category',s.category,'content',s.content,'setlist_key',item->>'key_override') order by position),'[]')
 from jsonb_array_elements(coalesce(entries,songbook_private.legacy_setlist_entries(ids)))
 with ordinality as requested(item,position)
 join public.shared_songs s on s.id=(item->>'song_id')::bigint and s.owner_id=owner
$$;

revoke all on function songbook_private.legacy_setlist_entries(bigint[]),
 songbook_private.sync_setlist_entries(),songbook_private.setlist_share_payload(bigint[],jsonb,uuid)
 from public, anon, authenticated;

create function public.replace_personal_setlist_entries(delete_id uuid,expected_revision integer,new_title text,entries jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare created jsonb; result public.songbook_setlists;
begin
 created:=songbook_private.replace_personal_setlist(delete_id,expected_revision,new_title,'{}');
 update public.songbook_setlists set song_entries=entries
 where id=(created->>'id')::uuid and owner_id=auth.uid() returning * into strict result;
 return to_jsonb(result);
end $$;
revoke all on function public.replace_personal_setlist_entries(uuid,integer,text,jsonb) from public,anon;
grant execute on function public.replace_personal_setlist_entries(uuid,integer,text,jsonb) to authenticated;

create or replace function songbook_private.share_setlist(list_id uuid,recipient_email_address text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; list public.songbook_setlists; payload jsonb; from_email text; to_email text;
begin
 if actor is null or coalesce(songbook_private.songbook_role(),'') in ('','owner') then raise exception 'Personal account access required'; end if;
 select * into list from public.songbook_setlists where id=list_id and owner_id=actor;
 if not found then raise exception 'Personal setlist not found'; end if;
 select u.id,u.email into target,to_email from auth.users u join public.songbook_members m on m.user_id=u.id where lower(u.email)=lower(trim(recipient_email_address)) and u.email_confirmed_at is not null and m.role<>'owner';
 if target is null or target=actor then raise exception 'Choose another approved personal account; church accounts cannot receive setlists'; end if;
 select email into from_email from auth.users where id=actor;
 payload:=songbook_private.setlist_share_payload(list.song_ids,list.song_entries,actor);
 if jsonb_array_length(payload)<>cardinality(list.song_ids) then raise exception 'Remove missing songs before sharing'; end if;
 insert into public.songbook_setlist_shares(setlist_id,sender_id,recipient_id,sender_email,recipient_email,title,songs) values(list.id,actor,target,from_email,to_email,list.title,payload) on conflict(setlist_id,recipient_id) do update set title=excluded.title,songs=excluded.songs,updated_at=now();
end $$;

create or replace function songbook_private.refresh_live_setlist(target uuid) returns void language sql security definer set search_path='' as $$
 update public.songbook_setlist_shares sh set title=l.title,songs=songbook_private.setlist_share_payload(l.song_ids,l.song_entries,l.owner_id),updated_at=now() from public.songbook_setlists l where sh.setlist_id=l.id and l.id=target and sh.sender_id=l.owner_id;
$$;

create or replace function songbook_private.copy_shared_setlist(share_id uuid,new_title text,replace_id uuid default null,expected_revision integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); shared public.songbook_setlist_shares; item jsonb; personal public.shared_songs; entries jsonb:='[]'; new_list public.songbook_setlists; old_list public.songbook_setlists; previous text;
begin
 if actor is null or coalesce(songbook_private.songbook_role(),'') in ('','owner') then raise exception 'Approved personal account required';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,25));
 select * into shared from public.songbook_setlist_shares where id=share_id and recipient_id=actor for share;
 if not found then raise exception 'Shared setlist not available';end if;
 if replace_id is not null then
 select * into old_list from public.songbook_setlists where id=replace_id and owner_id=actor for update;
 if not found or expected_revision is null or old_list.revision<>expected_revision then raise exception 'Setlist changed. Refresh before replacing.';end if;
 delete from public.songbook_setlists where id=old_list.id;
 end if;
 if (select count(*) from public.songbook_setlists where owner_id=actor)>=25 then raise exception 'You have reached the limit of 25 personal setlists.';end if;
 if jsonb_array_length(shared.songs)>100 then raise exception 'Shared setlist is too long';end if;
 previous:=current_setting('bic.restoring',true);perform set_config('bic.restoring','yes',true);
 for item in select value from jsonb_array_elements(shared.songs) loop
 select * into personal from public.shared_songs where owner_id=actor and title=item->>'title' and artist=item->>'artist' and key=item->>'key' and content=item->>'content' order by id limit 1;
 if not found then insert into public.shared_songs(owner_id,title,artist,key,category,content) values(actor,item->>'title',item->>'artist',item->>'key',coalesce(item->>'category',''),item->>'content') returning * into personal;end if;
 entries:=entries||jsonb_build_object('song_id',personal.id,'key_override',item->>'setlist_key');
 end loop;
 insert into public.songbook_setlists(owner_id,title,song_entries) values(actor,coalesce(nullif(trim(new_title),''),shared.title),entries) returning * into new_list;
 perform set_config('bic.restoring',coalesce(previous,''),true);return to_jsonb(new_list);
end $$;

create or replace function songbook_private.import_songbook_backup(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare scope uuid:=auth.uid(); item jsonb; map_s jsonb:='{}'; map_f jsonb:='{}'; id_song bigint; id_folder uuid; entries jsonb; oldsetting text; count_s int:=0; label text;
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
 if coalesce(jsonb_typeof(item->'song_entries'),'null') not in ('array','null') then raise exception 'Invalid setlist entries'; end if;
 if jsonb_typeof(item->'song_entries')='array' then
  if jsonb_array_length(item->'song_entries')>100 then raise exception 'Invalid setlist entries'; end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('song_id',(map_s->>(entry->>'song_id'))::bigint,
   'key_override',entry->>'key_override') order by position),'[]'::jsonb) into entries
 from jsonb_array_elements(case when jsonb_typeof(item->'song_entries')='array' then item->'song_entries' else (
   select coalesce(jsonb_agg(jsonb_build_object('song_id',value) order by old_position),'[]')
   from jsonb_array_elements_text(item->'song_ids') with ordinality as legacy(value,old_position)
 ) end) with ordinality as slots(entry,position) where map_s ? (entry->>'song_id');
 insert into public.songbook_setlists(owner_id,title,song_entries) values(scope,left(item->>'title',170)||' (restored)',entries);
 end loop;
 for item in select value from jsonb_array_elements(coalesce(payload->'friends','[]')) loop
 if exists(select 1 from auth.users u join public.songbook_members m on m.user_id=u.id where lower(u.email)=lower(item->>'email') and m.role<>'owner' and u.id<>scope) then perform songbook_private.add_songbook_friend(item->>'email',left(coalesce(item->>'nickname',''),80));end if;
 end loop;end if;
 for item in select value from jsonb_array_elements(coalesce(payload->'favorites','[]')) loop
 if map_s ? (item#>>'{}') then insert into public.songbook_favorites(user_id,song_id) values(auth.uid(),(map_s->>(item#>>'{}'))::bigint) on conflict do nothing;end if;
 end loop;
 perform set_config('bic.restoring',coalesce(oldsetting,''),true);return jsonb_build_object('songs',count_s);
end $$;

commit;
