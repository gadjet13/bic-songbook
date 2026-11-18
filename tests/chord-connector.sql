-- Run as postgres against a test songbook schema after database/chord-connector.sql.
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

do $$
declare
  ordinary jsonb := '{"claims":{"role":"authenticated"},"authentication_method":"oauth"}';
  token jsonb := '{"claims":{"role":"authenticated","client_id":"c3377751-153c-4308-8bbd-02df10cb5429","sub":"866d22eb-c756-4a2b-9ae7-5d30fb414e61","aud":"authenticated"},"authentication_method":"token_refresh"}';
  issued jsonb := songbook_private.connector_token_hook(token);
  church_id bigint;
  chart_id bigint;
  other_id bigint;
begin
  if songbook_private.connector_token_hook(ordinary) is distinct from ordinary then raise exception 'Ordinary sign-in changed'; end if;
  if issued #>> '{claims,role}' is distinct from 'bic_chart_connector'
    or issued #>> '{claims,aud}' is distinct from 'https://songbook.example/mcp' then
    raise exception 'OAuth token did not get a restricted role and audience';
  end if;

  insert into public.shared_songs (title) values ('__connector_test_church') returning id into church_id;
  insert into public.shared_songs (title, owner_id, source_song_id, content, key)
    values ('__connector_test_personal', '866d22eb-c756-4a2b-9ae7-5d30fb414e61', church_id, '{G}Words', 'G')
    returning id into chart_id;
  insert into public.shared_songs (title, owner_id, source_song_id)
    values ('__connector_test_other', '5f4587da-7af9-427f-9002-3c1ad628fe3c', church_id) returning id into other_id;
  perform set_config('request.jwt.claims', (issued->'claims')::text, true);
  perform set_config('bic_test.church', church_id::text, true);
  perform set_config('bic_test.chart', chart_id::text, true);
  perform set_config('bic_test.other', other_id::text, true);
end $$;

set local role bic_chart_connector;
do $$
declare
  chart_id bigint := current_setting('bic_test.chart')::bigint;
  church_id bigint := current_setting('bic_test.church')::bigint;
  other_id bigint := current_setting('bic_test.other')::bigint;
  res jsonb;
begin
  if has_table_privilege(current_user, 'public.shared_songs', 'SELECT,UPDATE,INSERT,DELETE')
    or has_schema_privilege(current_user, 'songbook_private', 'USAGE')
    or pg_has_role(current_user, 'authenticated', 'MEMBER') then
    raise exception 'Connector can access ordinary database actions directly';
  end if;
  if jsonb_array_length(songbook_connector.find_charts('__connector_test')) <> 1
    or songbook_connector.get_chart(other_id) is not null or songbook_connector.get_chart(church_id) is not null then
    raise exception 'Connector can read charts outside the caller songbook';
  end if;
  if songbook_connector.save_chart(other_id, 1, 'wrong')->>'status' is distinct from 'not_found'
    or songbook_connector.save_chart(church_id, 1, 'wrong')->>'status' is distinct from 'not_found' then
    raise exception 'Connector can write charts outside the caller songbook';
  end if;
  res := songbook_connector.save_chart(chart_id, 1, '{D}Words', 'D');
  if res->>'status' is distinct from 'saved' or res->>'revision' is distinct from '2' then raise exception 'Save failed'; end if;
  if songbook_connector.save_chart(chart_id, 1, 'stale')->>'status' is distinct from 'stale' then raise exception 'Stale edit accepted'; end if;
  if songbook_connector.get_chart(chart_id)->>'content' is distinct from '{D}Words' then raise exception 'Saved chart differs'; end if;
end $$;

reset role;
do $$
begin
  if not exists (select 1 from public.songbook_song_history
    where song_id = current_setting('bic_test.chart')::bigint and snapshot->>'revision' = '2') then
    raise exception 'Connector save is missing from song history';
  end if;
end $$;
delete from public.songbook_members where user_id = '866d22eb-c756-4a2b-9ae7-5d30fb414e61';
set local role bic_chart_connector;
do $$
begin
  begin
    perform songbook_connector.find_charts('__connector_test');
    raise exception 'Removed member still has access';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
