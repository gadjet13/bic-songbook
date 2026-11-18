begin;

create role bic_chart_connector nologin noinherit;
grant bic_chart_connector to authenticator;
create schema songbook_connector;
revoke all on schema songbook_connector from public, anon, authenticated, service_role;
grant usage on schema songbook_connector to bic_chart_connector;

create table songbook_private.connector_client (
  singleton boolean primary key default true check (singleton),
  client_id uuid not null,
  resource text not null check (resource like 'https://%/mcp'),
  enabled boolean not null default false
);
revoke all on songbook_private.connector_client from public, anon, authenticated;

-- Third-party OAuth tokens must never get the regular app's database role.
-- Ordinary BIC sign-in (including Google sign-in) does not yield a client_id claim.
create function songbook_private.connector_token_hook(event jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  audience text;
begin
  if nullif(event #>> '{claims,client_id}', '') is null then
    if event->>'authentication_method' = 'oauth_provider/authorization_code' then
      raise exception 'OAuth client claim required';
    end if;
    return event;
  end if;

  select resource into audience from songbook_private.connector_client
    where client_id::text = event #>> '{claims,client_id}' and enabled;
  if audience is null then raise exception 'OAuth client unavailable'; end if;

  return jsonb_set(jsonb_set(event, '{claims,role}', '"bic_chart_connector"'::jsonb),
    '{claims,aud}', to_jsonb(audience));
end;
$$;
revoke all on function songbook_private.connector_token_hook(jsonb) from public, anon, authenticated;
grant usage on schema songbook_private to supabase_auth_admin;
grant select on songbook_private.connector_client to supabase_auth_admin;
grant execute on function songbook_private.connector_token_hook(jsonb) to supabase_auth_admin;

create function songbook_private.connector_member()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  claims jsonb := auth.jwt();
begin
  if caller is null or claims->>'role' is distinct from 'bic_chart_connector'
    or not exists (
      select 1 from songbook_private.connector_client
      where enabled and client_id::text = claims->>'client_id' and resource = claims->>'aud'
    )
    or not exists (
      select 1 from public.songbook_members where user_id = caller and role in ('viewer','editor','manager')
    )
  then raise insufficient_privilege using message = 'Approved personal songbook access required'; end if;
  return caller;
end;
$$;
revoke all on function songbook_private.connector_member() from public, anon, authenticated;

create function songbook_connector.find_charts(query text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := songbook_private.connector_member();
begin
  if query is null or char_length(btrim(query)) not between 1 and 300 then
    raise invalid_parameter_value using message = 'Enter a title or artist to search';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(match) order by match.title, match.id)
    from (
      select id::text as id, title, artist, key, revision from public.shared_songs
      where owner_id = caller and (
        strpos(lower(title), lower(btrim(query))) > 0
        or strpos(lower(artist), lower(btrim(query))) > 0
      )
      order by title, id limit 20
    ) match
  ), '[]'::jsonb);
end;
$$;

create function songbook_connector.get_chart(song_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := songbook_private.connector_member();
begin
  return (
    select to_jsonb(chart) from (
      select id::text as id, title, artist, key, content, revision
      from public.shared_songs where id = song_id and owner_id = caller
    ) chart
  );
end;
$$;

create function songbook_connector.save_chart(song_id bigint, expected_revision integer, chart_text text, base_key text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := songbook_private.connector_member();
  song public.shared_songs%rowtype;
begin
  if expected_revision is null or expected_revision < 1 or chart_text is null
    or char_length(chart_text) > 200000
    or (base_key is not null and base_key !~ '^[A-G](#|b)?(m|maj|min)?$')
  then raise invalid_parameter_value using message = 'Invalid chart, key or revision'; end if;

  select * into song from public.shared_songs where id = song_id and owner_id = caller for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if song.revision <> expected_revision then
    return jsonb_build_object('status', 'stale');
  end if;

  if song.content is not distinct from chart_text and (base_key is null or base_key = song.key) then
    return jsonb_build_object('status', 'unchanged', 'revision', song.revision);
  end if;

  update public.shared_songs set content = chart_text, key = coalesce(base_key, song.key)
  where id = song_id and owner_id = caller and revision = expected_revision returning * into song;
  return jsonb_build_object('status', 'saved', 'revision', song.revision, 'key', song.key);
end;
$$;

revoke all on all functions in schema songbook_connector from public, anon, authenticated, service_role;
grant execute on function songbook_connector.find_charts(text),
  songbook_connector.get_chart(bigint), songbook_connector.save_chart(bigint, integer, text, text)
  to bic_chart_connector;

commit;
