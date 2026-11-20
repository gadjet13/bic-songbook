-- Run read-only with the project administrator, after canonical-section-headings.sql.
begin read only;

with charts as (
  select owner_id,content,songbook_private.canonical_chart_headings(content) as canonical
  from public.shared_songs
)
select case when owner_id is null then 'church' else 'personal' end as scope,
  count(*) as chart_count,
  count(*) filter (where canonical <> content and char_length(canonical)<=200000) as pending_conversion,
  count(*) filter (where canonical <> content and char_length(canonical)>200000) as exceeds_chart_limit
from charts group by 1 order by 1;

-- Report identifiers and line numbers only. Inspect ambiguous text in the appropriate songbook.
select song.id, case when song.owner_id is null then 'church' else 'personal' end as scope, lines.number
from public.shared_songs song
cross join lateral unnest(string_to_array(song.content,E'\n')) with ordinality as lines(line,number)
where line ~* '^[ \t]*\[?(intro|verse|pre[ -]?chorus|chorus|post[ -]?chorus|bridge|refrain|tag|instrumental|interlude|solo|breakdown|vamp|turnaround|outro|ending)[ \t]*[0-9]*([ \t\r]*$|[ \t\]]+\[)'
  and songbook_private.chart_section_label(line) is null
order by song.id, lines.number;

commit;
