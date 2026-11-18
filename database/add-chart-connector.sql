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

-- Use the same title normalization as the existing library and first-copy trigger.
create function songbook_private.connector_title(title text)
returns text language plpgsql immutable set search_path = '' as $$
begin
  if title is null or char_length(btrim(title)) not between 1 and 300 then
    raise invalid_parameter_value using message = 'Enter a song title of 1–300 characters';
  end if;
  return songbook_private.normalized_song_title(title);
end;
$$;
revoke all on function songbook_private.connector_title(text) from public, anon, authenticated;

create function songbook_private.connector_title_status(caller uuid, normalized_title text)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'personal_exists', exists (
      select 1 from public.shared_songs
      where owner_id = caller and songbook_private.normalized_song_title(title) = normalized_title
    ),
    'church_exists', exists (
      select 1 from public.shared_songs
      where owner_id is null and songbook_private.normalized_song_title(title) = normalized_title
    )
  );
$$;
revoke all on function songbook_private.connector_title_status(uuid, text) from public, anon, authenticated;

create function songbook_connector.check_title(title text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select songbook_private.connector_title_status(
    songbook_private.connector_member(), songbook_private.connector_title(title)
  );
$$;

create function songbook_connector.add_song(
  title text, base_key text, chart_text text, expected_church_copy boolean, artist text default ''
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := songbook_private.connector_member();
  normalized_title text := songbook_private.connector_title(title);
  title_status jsonb;
  creates_church_copy boolean;
  saved public.shared_songs%rowtype;
begin
  if artist is null or char_length(btrim(artist)) > 300 or chart_text is null
    or chart_text !~ '[^[:space:]]' or char_length(chart_text) > 200000
    or base_key is null or base_key !~ '^[A-G](#|b)?(m|maj|min)?$'
    or expected_church_copy is null
  then raise invalid_parameter_value using message = 'Invalid chart, artist or key'; end if;

  -- Serialize with the existing church copy and title checks, including other MCP saves.
  perform pg_advisory_xact_lock(hashtextextended(normalized_title, 0));
  title_status := songbook_private.connector_title_status(caller, normalized_title);
  if (title_status->>'personal_exists')::boolean then
    return jsonb_build_object('status', 'personal_duplicate');
  end if;

  creates_church_copy := not (title_status->>'church_exists')::boolean;
  if creates_church_copy is distinct from expected_church_copy then
    return jsonb_build_object('status', 'church_copy_changed', 'would_create_church_copy', creates_church_copy);
  end if;

  insert into public.shared_songs (title, artist, key, content, owner_id)
    values (btrim(title), btrim(artist), base_key, chart_text, caller) returning * into saved;

  return jsonb_build_object('status', 'saved', 'id', saved.id::text, 'title', saved.title,
    'key', saved.key, 'church_copy_created', creates_church_copy);
end;
$$;

revoke all on all functions in schema songbook_connector from public, anon, authenticated, service_role;
grant execute on function songbook_connector.check_title(text),
  songbook_connector.add_song(text, text, text, boolean, text) to bic_chart_connector;

commit;
