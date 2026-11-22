import { Children, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { displaySong } from './SongChart'
import { CueText } from './SetlistCues'
import { songCueLocation } from './lib/cue-locations'
import type { SetlistCue } from './lib/setlist-cues'
import { fitStageColumns, type StageColumn } from './lib/stage-layout'
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

const columnOptions = ['auto', 'one', 'two', 'three', 'four', 'five', 'six'] as const
type StageColumns = typeof columnOptions[number]
type Orientation = 'portrait' | 'landscape'
type StageLayout = { size: number; scale: number; gap: number; columns: StageColumn[] }

function FittedChart({chart, columns, paper = false, includePrivate = true, onSize}: {
  chart: StageChart; columns: StageColumns; paper?: boolean; includePrivate?: boolean; onSize?: (size: number) => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<StageLayout>()
  const { title, content, key, soundingKey, transpose = 0, capo } = chart
  const cues = (chart.cues ?? []).filter(cue => includePrivate || cue.scope === 'team')
  const cueSignature = JSON.stringify(cues)
  const units: ReactNode[] = [
    <div className="stage-chart-heading">
      <h2>{title}</h2>
      {soundingKey && <p>Key: {soundingKey}{!!capo && <> · Capo {capo} · Shapes: {key}</>}</p>}
      <CueText cues={cues} location={songCueLocation}/>
    </div>,
  ]
  const sectionBlocks = displaySong(content, transpose, key, true, true, (location, heading) => <>
    <div className="song-section">{heading}</div>
    <CueText cues={cues} location={location}/>
  </>, false, true)
  for (const block of sectionBlocks) {
    const [heading, lines] = block.props.children
    const rows = Children.toArray(lines)
    if (heading) units.push(<>{heading}{rows.shift()}</>)
    units.push(...rows)
  }

  useLayoutEffect(() => {
    const viewport = frame.current!
    const measuring = measure.current!
    let active = true
    const count = columns === 'auto' ? 'auto' : columnOptions.indexOf(columns)
    function fit() {
      if (!active || !viewport.clientWidth || !viewport.clientHeight) return
      function at(size: number, scale = 1): StageLayout | null {
        measuring.style.fontSize = size + 'px'
        const rows = Array.from(measuring.children, row => {
          const box = row.getBoundingClientRect()
          return { width: Math.ceil(box.width), height: Math.ceil(box.height) }
        })
        const gap = Math.max(8, Math.ceil(size * .75))
        const columns = fitStageColumns(rows, viewport.clientWidth / scale, viewport.clientHeight / scale, gap, count)
        return columns ? { size, scale, gap, columns } : null
      }

      let fitted = at(paper ? 18 : 32)
      if (!fitted) {
        let low = 1
        let high = paper ? 17 : 31
        while (low <= high) {
          const candidate = Math.floor((low + high) / 2)
          const result = at(candidate)
          if (result) {
            fitted = result
            low = candidate + 1
          } else high = candidate - 1
        }
      }
      // Scale exceptionally large charts uniformly without wrapping any rows.
      for (let scale = .5; !fitted; scale /= 2) fitted = at(1, scale)
      setLayout(fitted)
      onSize?.(fitted.size * fitted.scale)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(viewport)
    document.fonts.ready.then(fit)
    return () => { active = false; observer.disconnect() }
  }, [title, content, key, soundingKey, transpose, capo, cueSignature, columns, paper, onSize])

  return <div className="stage-chart-frame" ref={frame}>
    <div className="stage-chart stage-measure" ref={measure} aria-hidden="true">
      {units.map((unit, i) => <div className="stage-unit" key={i}>{unit}</div>)}
    </div>
    {layout && <div className="stage-chart stage-columns" style={{
      fontSize: layout.size, gap: layout.gap, transform: `scale(${layout.scale})`,
      gridTemplateColumns: layout.columns.map(column => `${column.width}px`).join(' '),
    }}>
      {layout.columns.map(({start, end}) => <div className="stage-column" key={start}>
        {units.slice(start, end).map((unit, i) => <div className="stage-unit" key={start + i}>{unit}</div>)}
      </div>)}
    </div>}
  </div>
}

export default function StageReader({charts, index, select, exit, setlist = false}: {
  charts: StageChart[]; index: number; select?: (index: number) => void; exit: () => void; setlist?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const options = useRef<HTMLDetailsElement>(null)
  const [columns, setColumns] = useState<StageColumns>(() => {
    try {
      const saved = localStorage.getItem('bic-stage-columns')
      const choice = columnOptions.find(option => option === saved)
      if (choice) return choice
    } catch { /* Storage is optional. */ }
    return 'auto'
  })
  const [fittedSize, setFittedSize] = useState(32)
  const [includePrivate, setIncludePrivate] = useState(true)
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const [print, setPrint] = useState<{charts: StageChart[]; columns: StageColumns; includePrivate: boolean; orientation: Orientation} | null>(null)
  const current = charts[index]

  useLayoutEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
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
    setPrint({charts: rows, columns, includePrivate, orientation})
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
          <label className="reading-columns">Columns
            <select value={columns} onChange={event => setColumns(event.target.value as StageColumns)}>
              {columnOptions.map((option, count) => <option key={option} value={option}>{count || 'Auto'}</option>)}
            </select>
          </label>
          <details ref={options} className="stage-print">
            <summary>Print</summary>
            <div>
              <label>Page orientation
                <select value={orientation} onChange={event => setOrientation(event.target.value as Orientation)}>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
              {setlist && <label><input type="checkbox" checked={includePrivate} onChange={event => setIncludePrivate(event.target.checked)}/> Include my private cues</label>}
              <button disabled={!current || !!print} onClick={() => current && printCharts([current])}>Print this song</button>
              {setlist && <button disabled={!charts.length || !!print} onClick={() => printCharts(charts)}>Print full set</button>}
            </div>
          </details>
          <button onClick={exit}>Exit one-page view</button>
        </div>
        {current ? <FittedChart chart={current} columns={columns} onSize={setFittedSize}/>
          : <p>No songs available.</p>}
        {current && fittedSize < 12 && <p className="stage-fit-note" role="status">Small text in this chart. <button onClick={exit}>Open standard reader</button></p>}
      </div>
    </dialog>
    {print && <div className="stage-print-output" data-orientation={print.orientation} aria-hidden="true">
      {print.charts.map(chart => <section key={chart.id} className="stage-print-page">
        <FittedChart chart={chart} columns={print.columns} paper includePrivate={print.includePrivate}/>
      </section>)}
    </div>}
  </>, document.body)
}
