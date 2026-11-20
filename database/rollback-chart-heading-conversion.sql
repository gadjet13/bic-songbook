-- Run only to roll back a verified conversion. Later edits are preserved.
begin;
set local lock_timeout = '5s';
alter table public.shared_songs disable trigger normalize_chart_headings;
with restored as (
  update public.shared_songs song
  set content = backup.previous_content
  from songbook_private.chart_heading_backups backup
  where song.id = backup.song_id and song.revision = backup.converted_revision
  returning song.id
)
select count(*) as restored_charts from restored;
alter table public.shared_songs enable trigger normalize_chart_headings;
commit;
