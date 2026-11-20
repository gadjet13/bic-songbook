import { useEffect, useRef, useState } from 'react'
import type { Song } from './App'
import { cloud } from './lib/cloud'
import { displaySong } from './SongChart'

type Member = { member_id: string; display_name: string }
type ChartSummary = Pick<Song, 'id' | 'title' | 'artist' | 'key'>
const pageSize = 50

export default function MemberSongbooks({ memberId, chartId, navigate, back, openCopy }: {
  memberId?: string
  chartId?: number
  navigate: (member: string, chart?: number) => void
  back: () => void
  openCopy?: (id: number) => void
}) {
  const [members, setMembers] = useState<Member[] | null>(null)
  const [charts, setCharts] = useState<ChartSummary[]>([])
  const [chart, setChart] = useState<Song | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copyError, setCopyError] = useState('')
  const [copying, setCopying] = useState(false)
  const copyingRequest = useRef(false)
  const active = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const member = members?.find(row => row.member_id === memberId)

  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [memberId, chartId])

  useEffect(() => {
    const client = cloud!
    const request = new AbortController()
    setLoading(true)
    setChart(null)
    setCopyError('')
    setError('')
    const load = async () => {
      if (memberId && chartId) {
        const { data, error } = await client.rpc('read_member_chart', { member_id: memberId, chart_id: chartId })
          .abortSignal(request.signal)
        if (error) throw error
        if (!data) throw new Error('This member chart is no longer available.')
        if (!request.signal.aborted) setChart(data as Song)
      } else if (memberId) {
        const { data, error } = await client.rpc('list_member_charts', {
          member_id: memberId, search_text: search, start_at: page * pageSize,
        }).abortSignal(request.signal)
        if (error) throw error
        if (!request.signal.aborted) setCharts(data as ChartSummary[])
      }
    }
    const timer = setTimeout(() => {
      void load().catch((error: { message: string }) => {
        if (!request.signal.aborted) setError(error.message)
      }).finally(() => {
        if (!request.signal.aborted) setLoading(false)
      })
    }, memberId && !chartId ? 150 : 0)
    return () => {
      clearTimeout(timer)
      request.abort()
    }
  }, [memberId, chartId, search, page])

  useEffect(() => {
    const request = new AbortController()
    async function loadMembers() {
      const rows: Member[] = []
      const batchSize = 500
      for (let offset = 0; !request.signal.aborted; offset += batchSize) {
        const { data, error } = await cloud!.rpc('list_member_songbooks')
          .range(offset, offset + batchSize - 1).abortSignal(request.signal)
        if (error) throw error
        rows.push(...data as Member[])
        if (data.length < batchSize) break
      }
      if (!request.signal.aborted) setMembers(rows)
    }
    void loadMembers().catch((error: Error) => {
      if (!request.signal.aborted) setError(error.message)
    })
    return () => request.abort()
  }, [])

  useEffect(() => {
    setSearch('')
    setPage(0)
    setCharts([])
  }, [memberId])

  async function copy() {
    if (!memberId || !chart || !openCopy || copyingRequest.current) return
    copyingRequest.current = true
    setCopying(true)
    setCopyError('')
    try {
      const { data, error } = await cloud!.rpc('copy_member_chart', { member_id: memberId, chart_id: chart.id })
      if (error) throw error
      if (active.current) openCopy(data as number)
    } catch (error) {
      setCopyError((error as { message: string }).message)
    } finally {
      copyingRequest.current = false
      setCopying(false)
    }
  }

  const title = chart?.title ?? member?.display_name ?? (memberId ? 'Member songbook' : 'Member songbooks')
  return <div className="app"><main className="member-songbooks">
    <nav className="songbook-back-bar" aria-label="Member songbook navigation">
      <button type="button" className="back-button" disabled={copying}
        onClick={back}>
        {chartId ? '← Back to member charts' : memberId ? '← Member songbooks' : '← Back to songbooks'}
      </button>
    </nav>
    <h1 ref={heading} tabIndex={-1}>{title}</h1>
    {!memberId && <p>{openCopy ? 'Browse charts from approved members and copy a version into your songbook.' : 'Browse charts from approved members.'}</p>}
    {(loading||!members) && !error && <p role="status">Loading…</p>}
    {error && <p className="notice" role="alert">{error}</p>}
    {!memberId && members && !error && <>
      {members.length === 0 && <p>No other member songbooks yet.</p>}
      <div className="songbook-cards">{members.map(item =>
        <button type="button" key={item.member_id} onClick={() => navigate(item.member_id)}><strong>{item.display_name}</strong></button>
      )}</div>
    </>}
    {memberId && !chartId && <>
      <div className="song-search-toolbar">
        <input type="search" aria-label="Search member charts" placeholder="Search songs…" value={search}
          maxLength={120} onChange={event => { setSearch(event.target.value); setPage(0) }}/>
      </div>
      {!loading && !error && <>
        {charts.length === 0 && <p>{search.trim() ? 'No matching charts.' : 'No charts available.'}</p>}
        {!!charts.length && <div className="song-list">{charts.slice(0, pageSize).map(item =>
          <button type="button" className="song-item" key={item.id} onClick={() => navigate(memberId, item.id)}>
            <span className="library-song-name"><strong>{item.title}</strong>{item.artist && <small>{item.artist}</small>}</span>
            <span className="key-badge">{item.key || '—'}</span>
          </button>
        )}</div>}
        {(page > 0 || charts.length > pageSize) && <nav className="worship-set-actions" aria-label="Member chart pages">
          <button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous page</button>
          <button type="button" disabled={charts.length <= pageSize} onClick={() => setPage(value => value + 1)}>Next page</button>
        </nav>}
      </>}
    </>}
    {chart && <article>
      <p>{member?.display_name ?? 'Member songbook'} · Read-only{chart.artist ? ` · ${chart.artist}` : ''}{chart.key ? ` · Key ${chart.key}` : ''}</p>
      {openCopy && <button type="button" className="worship-primary" disabled={copying} onClick={() => void copy()}>
        {copying ? 'Copying…' : 'Copy to My songbook'}
      </button>}
      {copyError && <p className="notice" role="alert">{copyError}</p>}
      <div className="song-display">{displaySong(chart.content, 0, chart.key, true)}</div>
    </article>}
  </main></div>
}
