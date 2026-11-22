import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { displaySong } from './SongChart'
import ReadingColumns from './ReadingColumns'
import { CueText } from './SetlistCues'
import { songCueLocation } from './lib/cue-locations'
import type { SetlistCue } from './lib/setlist-cues'
import { readerColumnCount, type ReaderColumns } from './lib/reader-lines'
import { stageView } from './lib/stage-url'
import { allowNavigation } from './lib/unsaved'
import './StageReader.css'

export type StageChart = {
  id: string
  title: string
  content: string
  key: string
  soundingKey: string
  transpose?: number
  capo?: number
  cues?: SetlistCue[]
  note?: string
}

export function useStageView(enabled: boolean) {
  const [view, setView] = useState(() => stageView())
  useEffect(() => {
    const sync = () => setView(stageView())
    sync()
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [enabled])

  function open(song?: string) {
    if (!enabled || !allowNavigation()) return
    const url = new URL(location.href)
    url.searchParams.set('view', 'stage')
    if (song) url.searchParams.set('song', song)
    if (stageView()) history.replaceState(history.state, '', url)
    else history.pushState({ ...history.state, bicStageEntry: true }, '', url)
    setView(stageView())
  }

  function close() {
    if (history.state?.bicStageEntry) {
      history.back()
      return
    }
    const url = new URL(location.href)
    url.searchParams.delete('view')
    url.searchParams.delete('song')
    history.replaceState(history.state, '', url)
    setView(null)
  }
  return { view: enabled ? view : null, open, close }
}

function FittedChart({chart, columns, paper = false, includePrivate = true, onSize}: {
  chart: StageChart; columns: number; paper?: boolean; includePrivate?: boolean; onSize?: (size: number) => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const flow = useRef<HTMLDivElement>(null)
  const { title, content, key, soundingKey, transpose = 0, capo, note } = chart
  const cues = (chart.cues ?? []).filter(cue => includePrivate || cue.scope === 'team')
  const cueSignature = JSON.stringify(cues)
  useLayoutEffect(() => {
    const viewport = frame.current!
    const layout = flow.current!
    let active = true
    function fit() {
      if (!active || !viewport.clientWidth || !viewport.clientHeight) return
      layout.style.transform = ''
      layout.style.width = ''
      layout.style.height = ''
      let low = 1
      let high = paper ? 18 : 32
      const fits = (size: number) => {
        layout.style.fontSize = size + 'px'
        return layout.scrollWidth <= layout.clientWidth + 1 && layout.scrollHeight <= layout.clientHeight + 1
      }
      while (low < high) {
        const candidate = Math.ceil((low + high) / 2)
        if (fits(candidate)) low = candidate
        else high = candidate - 1
      }
      if (!fits(low)) {
        // Exceptionally large charts can still fit by scaling a larger layout.
        let factor = 1
        do {
          factor *= 2
          layout.style.width = viewport.clientWidth * factor + 'px'
          layout.style.height = viewport.clientHeight * factor + 'px'
        } while (!fits(low))
        layout.style.transform = `scale(${1 / factor})`
      }
      onSize?.(low)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(viewport)
    document.fonts.ready.then(fit)
    return () => { active = false; observer.disconnect() }
  }, [title, content, key, soundingKey, transpose, capo, note, cueSignature, columns, paper, includePrivate, onSize])

  return <div className="stage-chart-frame" ref={frame}>
    <div className="stage-chart" ref={flow} style={{columnCount: columns}}>
      <div className="stage-chart-heading">
        <h2>{title}</h2>
        {soundingKey && <p>Key: {soundingKey}{!!capo && <> · Capo {capo} · Shapes: {key}</>}</p>}
      </div>
      <CueText cues={cues} location={songCueLocation}/>
      {includePrivate && note && <p className="stage-note"><strong>My notes</strong> {note}</p>}
      {displaySong(content, transpose, key, true, true, (location, heading) => <>
        <div className="song-section">{heading}</div>
        <CueText cues={cues} location={location}/>
      </>, false, true)}
    </div>
  </div>
}

export default function StageReader({charts, index, select, exit, setlist = false}: {
  charts: StageChart[]; index: number; select?: (index: number) => void; exit: () => void; setlist?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const options = useRef<HTMLDetailsElement>(null)
  const [columns, setColumns] = useState<ReaderColumns>(() => {
    try {
      const saved = localStorage.getItem('bic-stage-columns')
      if (saved === 'one' || saved === 'two') return saved
    } catch { /* Storage is optional. */ }
    return 'auto'
  })
  const [width, setWidth] = useState(() => window.innerWidth)
  const [fittedSize, setFittedSize] = useState(32)
  const [includePrivate, setIncludePrivate] = useState(true)
  const [print, setPrint] = useState<{charts: StageChart[]; columns: number; includePrivate: boolean} | null>(null)
  const columnCount = readerColumnCount(columns, width)
  const current = charts[index]

  useLayoutEffect(() => {
    const element = dialog.current!
    element.showModal()
    const resize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', resize)
    return () => { window.removeEventListener('resize', resize); element.close() }
  }, [])

  useEffect(() => {
    try { localStorage.setItem('bic-stage-columns', columns) } catch { /* Storage is optional. */ }
  }, [columns])

  useEffect(() => {
    function keys(event: KeyboardEvent) {
      if (event.key === 'Escape' && dialog.current?.open) {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (options.current?.open) {
          options.current.open = false
          options.current.querySelector('summary')?.focus()
        } else if (!event.repeat && !print) exit()
        return
      }
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey ||
          event.shiftKey || print || options.current?.open ||
          (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]'))) return
      const direction = event.key === 'j' ? 1 : event.key === 'k' ? -1 : 0
      if (select && direction && charts[index + direction]) {
        event.preventDefault()
        select(index + direction)
      }
    }
    window.addEventListener('keydown', keys, true)
    return () => window.removeEventListener('keydown', keys, true)
  }, [charts, index, select, exit, print])

  useEffect(() => {
    if (!print) return
    let active = true
    let frame = 0
    const done = () => setPrint(null)
    window.addEventListener('afterprint', done, {once: true})
    document.fonts.ready.then(() => {
      if (!active) return
      frame = requestAnimationFrame(() => {
        try { window.print() } catch { done() }
      })
    })
    return () => {
      active = false
      cancelAnimationFrame(frame)
      window.removeEventListener('afterprint', done)
    }
  }, [print])

  function printCharts(rows: StageChart[]) {
    setPrint({charts: rows, columns: columnCount, includePrivate})
  }

  return createPortal(<>
    <dialog className="stage-reader" ref={dialog} aria-label="One-page reader"
      onCancel={event => { event.preventDefault(); if (!print) exit() }}>
      <div className="stage-reader-layout">
        <div className="stage-toolbar">
          {setlist && <nav aria-label="Stage song navigation">
            <button disabled={index <= 0} onClick={() => select?.(index - 1)}>Previous</button>
            <span aria-live="polite">{current ? `${index + 1} / ${charts.length}` : 'No songs'}</span>
            <button disabled={index + 1 >= charts.length} onClick={() => select?.(index + 1)}>Next</button>
          </nav>}
          <ReadingColumns value={columns} onChange={setColumns}/>
          <details ref={options} className="stage-print">
            <summary>Print</summary>
            <div>
              {setlist && <label><input type="checkbox" checked={includePrivate} onChange={event => setIncludePrivate(event.target.checked)}/> Include my private cues and notes</label>}
              <button disabled={!current || !!print} onClick={() => current && printCharts([current])}>Print this song</button>
              {setlist && <button disabled={!charts.length || !!print} onClick={() => printCharts(charts)}>Print full set</button>}
            </div>
          </details>
          <button onClick={exit}>Exit one-page view</button>
        </div>
        {current ? <FittedChart chart={current} columns={columnCount} onSize={setFittedSize}/>
          : <p>No songs available.</p>}
        {current && fittedSize < 12 && <p className="stage-fit-note" role="status">Small text in this chart. <button onClick={exit}>Open standard reader</button></p>}
      </div>
    </dialog>
    {print && <div className="stage-print-output" aria-hidden="true">
      {print.charts.map(chart => <section key={chart.id} className="stage-print-page">
        <FittedChart chart={chart} columns={print.columns} paper includePrivate={print.includePrivate}/>
      </section>)}
    </div>}
  </>, document.body)
}
