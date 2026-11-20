import { useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { displaySong } from './SongChart'

type Props = {
  content: string
  onChange: (value: string) => void
  baseKey: string
  busy: boolean
  canSave: boolean
  error: string
  onSave: () => void
  onCancel: () => void
  dirty: boolean
  songTitle?: string
  fullWindow?: 'setlist' | 'song'
}

function LiveChartPreview({ content, baseKey, scrollRef, onScroll }: {
  content: string
  baseKey: string
  scrollRef: RefObject<HTMLDivElement | null>
  onScroll: (element: HTMLDivElement) => void
}) {
  const deferredContent = useDeferredValue(content)
  const chart = useMemo(() => displaySong(deferredContent, 0, baseKey, true), [deferredContent, baseKey])

  return <section className="chart-editor-preview" aria-label="Live chart preview">
    <h2>Preview</h2>
    <div ref={scrollRef} className="chord-paste-chart song-display" tabIndex={0} aria-label="Rendered chart"
      onScroll={event => onScroll(event.currentTarget)}>
      {deferredContent.trim() ? chart : <p>Type or paste a chart to preview it.</p>}
    </div>
  </section>
}

export default function ReaderChartEditor({
  content, onChange, baseKey, busy, canSave, error, onSave, onCancel, dirty, songTitle, fullWindow,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLLegendElement>(null)
  const editorScroll = useRef<HTMLTextAreaElement>(null)
  const previewScroll = useRef<HTMLDivElement>(null)
  const syncedPositions = useRef(new WeakMap<HTMLElement, number>())
  const headingId = useId()
  const [wide, setWide] = useState(false)

  useLayoutEffect(() => {
    const modal = dialog.current
    if (!modal) return
    modal.showModal()
    heading.current?.focus({ preventScroll: true })
    return () => modal.close()
  }, [])

  useEffect(() => {
    if (!fullWindow) return
    const viewport = window.matchMedia('(min-width: 900px)')
    const update = () => setWide(viewport.matches)
    update()
    viewport.addEventListener('change', update)
    return () => viewport.removeEventListener('change', update)
  }, [fullWindow])

  function syncScroll(source: HTMLElement, target: HTMLElement | null) {
    const previous = syncedPositions.current.get(source)
    syncedPositions.current.delete(source)
    if (previous !== undefined && Math.abs(previous - source.scrollTop) < 1) return

    const sourceRange = source.scrollHeight - source.clientHeight
    if (!target || sourceRange <= 0) return
    const progress = Math.max(0, Math.min(1, source.scrollTop / sourceRange))
    const next = progress * (target.scrollHeight - target.clientHeight)
    if (Math.abs(next - target.scrollTop) < 1) return

    target.scrollTop = next
    // The resulting scroll event belongs to this update. Don't send it back.
    syncedPositions.current.set(target, target.scrollTop)
  }

  useLayoutEffect(() => {
    if (wide && editorScroll.current) syncScroll(editorScroll.current, previewScroll.current)
  }, [wide])

  const editor = <fieldset className="reader-chart-editor" disabled={busy}>
    <legend id={headingId} ref={heading} tabIndex={-1} data-reader-edit-heading>
      {songTitle ? `Edit raw chart · ${songTitle}` : 'Edit raw chart'}
    </legend>
    {fullWindow === 'song'
      ? <p>Chords are in the chart key {baseKey || '(unspecified)'}. Going back keeps your draft in the song editor.</p>
      : <p>Chords are in the saved key {baseKey || '(unspecified)'}. Saving updates your personal chart wherever it’s used.</p>}
    <p>Start section headings with <code># </code>, for example <code># Verse 1 [slight soft]</code>.</p>
    <div className="chart-editor-workspace" data-preview={wide ? 'visible' : undefined}>
      <label>Raw chart content<textarea ref={editorScroll} className="reader-raw-chart" spellCheck={false} value={content.replace(/\r\n/g,'\n')}
        onScroll={event => syncScroll(event.currentTarget, previewScroll.current)}
        onChange={event => {
          const text = event.currentTarget.value
          onChange(content.includes('\r\n') ? text.replace(/\n/g,'\r\n') : text)
        }}/></label>
      {wide && <LiveChartPreview content={content} baseKey={baseKey} scrollRef={previewScroll}
        onScroll={element => syncScroll(element, editorScroll.current)}/>}
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="reader-edit-actions">
      {fullWindow ? <>
        <button type="button" className="worship-primary" disabled={!dirty || !canSave} onClick={onSave}>
          {busy ? 'Saving…' : fullWindow === 'setlist' ? 'Save and return to setlist' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel}>
          {fullWindow === 'setlist' ? 'Back to setlist' : 'Back to song editor'}
        </button>
      </> : <>
        <button type="button" disabled={dirty && !canSave} onClick={onSave}>
          {busy ? 'Saving…' : dirty ? 'Save and return to reading' : 'Return to reading'}
        </button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </>}
    </div>
  </fieldset>

  return fullWindow ? <dialog ref={dialog} className="chart-editor-dialog" aria-labelledby={headingId}
    onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}>
    {editor}
  </dialog> : editor
}
