begin;

-- Member browsing uses a chart-only API and leaves the personal table policies in place.
create function songbook_private.browsable_member_songbook(member_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null
    and songbook_private.songbook_role() is not null
    and member_id is distinct from auth.uid()
    and exists (select 1 from public.songbook_members m where m.user_id=member_id and m.role<>'owner');
$$;

create function songbook_private.list_member_songbooks()
returns table (member_id uuid, display_name text) language sql stable security definer set search_path='' as $$
  select m.user_id, coalesce('@'||h.handle, nullif(btrim(left(u.raw_user_meta_data->>'full_name',80)),''),
    'Member '||left(m.user_id::text,8))
  from public.songbook_members m
  join auth.users u on u.id=m.user_id
  left join public.songbook_handles h on h.user_id=m.user_id
  where songbook_private.browsable_member_songbook(m.user_id)
    and exists (select 1 from public.shared_songs s where s.owner_id=m.user_id)
  order by 2,1;
$$;

create function songbook_private.list_member_charts(member_id uuid, search_text text default '', start_at integer default 0)
returns table (id bigint, title text, artist text, key text)
language sql stable security definer set search_path='' as $$
  select s.id,s.title,s.artist,s.key
  from public.shared_songs s
  where s.owner_id=member_id and songbook_private.browsable_member_songbook(member_id)
    and strpos(lower(s.title||' '||coalesce(s.artist,'')),lower(btrim(left(coalesce(search_text,''),120))))>0
  order by lower(s.title),s.id
  limit 51 offset greatest(start_at,0);
$$;

create function songbook_private.read_member_chart(member_id uuid, chart_id bigint) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',s.id,'title',s.title,'artist',s.artist,'key',s.key,'category',s.category,'content',s.content)
  from public.shared_songs s
  where s.id=chart_id and s.owner_id=member_id and songbook_private.browsable_member_songbook(member_id);
$$;

create function songbook_private.copy_member_chart(member_id uuid, chart_id bigint) returns bigint
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  chart jsonb;
  copied bigint;
  previous text := current_setting('bic.restoring',true);
begin
  if actor is null or coalesce(songbook_private.songbook_role(),'') in ('','owner') then
    raise exception 'Approved personal account required';
  end if;
  chart := songbook_private.read_member_chart(member_id,chart_id);
  if chart is null then raise exception 'Member chart unavailable'; end if;

  -- The existing import flag keeps this copy from creating a church chart.
  perform set_config('bic.restoring','yes',true);
  insert into public.shared_songs(owner_id,title,artist,key,category,content)
    values (actor, chart->>'title', chart->>'artist', chart->>'key', chart->>'category', chart->>'content')
    returning id into copied;
  perform set_config('bic.restoring',coalesce(previous,''),true);
  return copied;
end $$;

create function public.list_member_songbooks() returns table (member_id uuid, display_name text)
language sql stable security invoker set search_path='' as $$select * from songbook_private.list_member_songbooks();$$;
create function public.list_member_charts(member_id uuid, search_text text default '', start_at integer default 0)
returns table (id bigint, title text, artist text, key text)
language sql stable security invoker set search_path='' as $$select * from songbook_private.list_member_charts(member_id,search_text,start_at);$$;
create function public.read_member_chart(member_id uuid, chart_id bigint) returns jsonb
language sql stable security invoker set search_path='' as $$select songbook_private.read_member_chart(member_id,chart_id);$$;
create function public.copy_member_chart(member_id uuid, chart_id bigint) returns bigint
language sql security invoker set search_path='' as $$select songbook_private.copy_member_chart(member_id,chart_id);$$;

revoke all on function songbook_private.browsable_member_songbook(uuid),
  songbook_private.list_member_songbooks(), public.list_member_songbooks(),
  songbook_private.list_member_charts(uuid,text,integer), public.list_member_charts(uuid,text,integer),
  songbook_private.read_member_chart(uuid,bigint), public.read_member_chart(uuid,bigint),
  songbook_private.copy_member_chart(uuid,bigint), public.copy_member_chart(uuid,bigint)
  from public,anon,authenticated;
grant execute on function
  songbook_private.list_member_songbooks(), public.list_member_songbooks(),
  songbook_private.list_member_charts(uuid,text,integer), public.list_member_charts(uuid,text,integer),
  songbook_private.read_member_chart(uuid,bigint), public.read_member_chart(uuid,bigint),
  songbook_private.copy_member_chart(uuid,bigint), public.copy_member_chart(uuid,bigint)
  to authenticated;

commit;
