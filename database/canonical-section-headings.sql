begin;

-- Keep the grammar in sync with src/lib/chord/transpose.ts.
create function songbook_private.chart_section_label(line text)
returns text language plpgsql immutable strict set search_path = ''
as $fn$
declare
  value text := btrim(line, E' \t\r\n');
  label text;
  parts text[];
  note text[];
  chord constant text := $re$^[A-G](?:#|b)?(?:(?:maj|min|dim|aug|sus|add|omit|no|m|M)|[0-9]|[#b()+-])*(?:/[A-G](?:#|b)?)?/*$$re$;
  heading constant text := $re$(?:intro|verse|pre[ -]?chorus|chorus|post[ -]?chorus|bridge|refrain|tag|instrumental|interlude|solo|breakdown|vamp|turnaround|outro|ending)[ \t]*[0-9]*$re$;
  notes constant text := $re$(\[[^\[\]\r\n]+\](?:[ \t]+\[[^\[\]\r\n]+\])*)$re$;
begin
  if left(value,2) = '# ' then return nullif(btrim(substr(value,3), E' \t\r\n'),''); end if;
  parts := regexp_match(value, $re$^\[([^\[\]\r\n]+)\]$$re$);
  if parts is not null then
    label := btrim(parts[1], E' \t\r\n');
    if label = '' or label ~ chord then return null; end if;
    return label;
  end if;

  parts := coalesce(
    regexp_match(value, '^(' || heading || ')[ \t]+' || notes || '$', 'i'),
    regexp_match(value, '^\[(' || heading || ')\][ \t]+' || notes || '$', 'i'),
    regexp_match(value, '^\[(' || heading || ')[ \t]+' || notes || '\]$', 'i')
  );
  if parts is null then return null; end if;
  for note in select regexp_matches(parts[2], $re$\[([^\]]+)\]$re$, 'g') loop
    label := btrim(note[1], E' \t\r\n');
    if label = '' or label ~ chord then return null; end if;
  end loop;
  return btrim(parts[1], E' \t\r\n') || ' ' || parts[2];
end;
$fn$;

create function songbook_private.canonical_chart_headings(chart text)
returns text language sql immutable strict set search_path = ''
as $$
  select coalesce(string_agg(
    case when label is null then line
    else substring(line from '^[ \t]*') || '# ' || label || substring(line from '[ \t]*\r?$') end,
    E'\n' order by ordinal),'')
  from unnest(string_to_array(chart,E'\n')) with ordinality as lines(line,ordinal)
  cross join lateral (
    select case when line !~ '^[ \t]*# ' then songbook_private.chart_section_label(line) end as label
  ) as parsed;
$$;

create function songbook_private.normalize_chart_on_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare canonical text;
begin
  if tg_op = 'UPDATE' and new.content is not distinct from old.content then return new; end if;
  canonical := songbook_private.canonical_chart_headings(new.content);
  -- Keep valid, near-limit charts writable. The admin report flags these for review.
  if char_length(canonical) <= 200000 then new.content := canonical; end if;
  return new;
end;
$$;
create trigger normalize_chart_headings before insert or update of content on public.shared_songs
for each row execute function songbook_private.normalize_chart_on_write();

create table songbook_private.chart_heading_backups (
  song_id bigint not null,
  previous_revision integer not null,
  converted_revision integer not null,
  previous_content text not null,
  converted_at timestamptz not null default now(),
  primary key (song_id,converted_revision)
);
revoke all on table songbook_private.chart_heading_backups from public, anon, authenticated, service_role;

create function songbook_private.convert_chart_heading_batch(batch_size integer default 100)
returns integer language sql set search_path = ''
as $$
  with candidates as materialized (
    select song.id,song.revision,song.content,normalized.content as canonical
    from public.shared_songs as song
    cross join lateral (select songbook_private.canonical_chart_headings(song.content) as content) normalized
    where normalized.content is distinct from song.content and char_length(normalized.content) <= 200000
    order by song.id
    limit least(greatest(coalesce(batch_size,100),1),1000)
    for update of song skip locked
  ), changed as (
    update public.shared_songs as song
    set content = candidates.canonical
    from candidates
    where song.id = candidates.id and song.revision = candidates.revision
    returning song.id,candidates.revision as previous_revision,song.revision as converted_revision,candidates.content
  ), backed_up as (
    insert into songbook_private.chart_heading_backups (song_id,previous_revision,converted_revision,previous_content)
    select id,previous_revision,converted_revision,content from changed returning song_id
  )
  select count(*)::integer from backed_up;
$$;

revoke all on function songbook_private.chart_section_label(text),
  songbook_private.canonical_chart_headings(text), songbook_private.normalize_chart_on_write(),
  songbook_private.convert_chart_heading_batch(integer) from public, anon, authenticated, service_role;

commit;
