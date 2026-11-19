-- Run on a test project after applying the connector migration. All fixtures roll back.
begin;
delete from songbook_private.connector_client;
insert into songbook_private.connector_client (client_id, resource, enabled)
values ('c3377751-153c-4308-8bbd-02df10cb5429', 'https://songbook.example/mcp', true);

insert into auth.users (id, email, email_confirmed_at) values
  ('866d22eb-c756-4a2b-9ae7-5d30fb414e61', 'connector-one@example.invalid', now()),
  ('5f4587da-7af9-427f-9002-3c1ad628fe3c', 'connector-two@example.invalid', now());
insert into public.songbook_members (user_id, role) values
  ('866d22eb-c756-4a2b-9ae7-5d30fb414e61', 'viewer'),
  ('5f4587da-7af9-427f-9002-3c1ad628fe3c', 'viewer');
insert into public.shared_songs (title) values ('__mcp_existing_chart');

set local role supabase_auth_admin;
do $$
declare
  ordinary jsonb := '{"claims":{"role":"authenticated"},"authentication_method":"oauth"}';
  token jsonb := '{"claims":{"role":"authenticated","client_id":"c3377751-153c-4308-8bbd-02df10cb5429","sub":"866d22eb-c756-4a2b-9ae7-5d30fb414e61","aud":"authenticated"},"authentication_method":"token_refresh"}';
  issued jsonb := songbook_private.connector_token_hook(token);
begin
  if songbook_private.connector_token_hook(ordinary) is distinct from ordinary then
    raise exception 'Ordinary sign-in changed';
  end if;
  if issued #>> '{claims,role}' is distinct from 'bic_chart_connector'
    or issued #>> '{claims,aud}' is distinct from 'https://songbook.example/mcp' then
    raise exception 'OAuth token was not restricted';
  end if;
  perform set_config('request.jwt.claims', (issued->'claims')::text, true);
end $$;

set local role bic_chart_connector;
do $$
declare
  response jsonb;
begin
  if has_table_privilege(current_user, 'public.shared_songs', 'SELECT,UPDATE,INSERT,DELETE')
    or has_schema_privilege(current_user, 'songbook_private', 'USAGE')
    or pg_has_role(current_user, 'authenticated', 'MEMBER') then
    raise exception 'Connector can access ordinary database actions directly';
  end if;
  if songbook_connector.check_title('__mcp_existing_chart') <> '{"personal_exists":false,"church_exists":true}'::jsonb then
    raise exception 'Incorrect existing-title preview';
  end if;
  response := songbook_connector.add_song('__mcp_existing_chart', 'G', '{G}New chart', true);
  if response->>'status' is distinct from 'church_copy_changed' then
    raise exception 'Unexpected church-copy status did not stop the save';
  end if;
  response := songbook_connector.add_song('__mcp_existing_chart', 'G', '{G}New chart', false);
  if response->>'status' is distinct from 'saved' or response->>'church_copy_created' is distinct from 'false' then
    raise exception 'Existing church title did not save only to My songbook';
  end if;
  response := songbook_connector.add_song('__mcp New chart', 'D', '{D}New chart', true);
  if response->>'status' is distinct from 'saved' or response->>'church_copy_created' is distinct from 'true' then
    raise exception 'New church title did not create its first church copy';
  end if;
  response := songbook_connector.add_song(' __MCP  new chart ', 'D', '{D}New chart', false);
  if response->>'status' is distinct from 'personal_duplicate' then raise exception 'Duplicate was not blocked'; end if;
end $$;

reset role;
do $$
begin
  if (select count(*) from public.shared_songs where title = '__mcp New chart') <> 2
    or not exists (select 1 from public.shared_songs where title = '__mcp New chart' and owner_id is null)
    or not exists (select 1 from public.shared_songs where title = '__mcp New chart' and owner_id = '866d22eb-c756-4a2b-9ae7-5d30fb414e61')
    or (select count(*) from public.shared_songs where title = '__mcp_existing_chart' and owner_id is null) <> 1 then
    raise exception 'Incorrect chart ownership or church copy';
  end if;
  perform set_config('request.jwt.claims', jsonb_set(current_setting('request.jwt.claims')::jsonb, '{sub}',
    '"5f4587da-7af9-427f-9002-3c1ad628fe3c"')::text, true);
end $$;

set local role bic_chart_connector;
do $$
begin
  if songbook_connector.check_title('__mcp New chart') <> '{"personal_exists":false,"church_exists":true}'::jsonb then
    raise exception 'Another account saw a personal chart';
  end if;
end $$;
reset role;
delete from public.songbook_members where user_id = '5f4587da-7af9-427f-9002-3c1ad628fe3c';
set local role bic_chart_connector;
do $$
begin
  begin
    perform songbook_connector.add_song('__mcp Removed account', 'G', '{G}Words', true);
    raise exception 'Removed user still has access';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
