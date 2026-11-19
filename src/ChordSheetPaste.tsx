import { useState } from 'react'
import { displaySong } from './SongChart'
import { convertChordSheet } from './lib/chord-sheet'
import { suggestKeys } from './lib/suggest-key'

type Preview = ReturnType<typeof convertChordSheet> & { source: string; keys: string[] }

export default function ChordSheetPaste({ onApply, raw, onRawChange, title, songKey }: {
  raw: string
  onRawChange: (value: string) => void
  onApply: (content: string, title: string, key: string) => void
  title: string
  songKey: string
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [notice, setNotice] = useState('')
  const current = preview?.source === raw ? preview : null

  function openPreview() {
    const result = convertChordSheet(raw)
    setPreview({ ...result, source: raw, keys: suggestKeys(result.content) })
    setNotice('')
  }

  function apply() {
    if (!current?.content) return
    onApply(current.content, current.title, current.keys[0] ?? '')
    onRawChange('')
    setPreview(null)
    setNotice('Applied to the editor. You can adjust chord positions before saving.')
  }

  return <details className="setlist-panel" onToggle={event => { if (!event.currentTarget.open) setPreview(null) }}>
    <summary>Paste chord sheet</summary>
    <p>Paste chords above lyrics. You can mark a title with **Title**.</p>
    <textarea aria-label="Paste original chord sheet" className="song-editor" value={raw} onChange={event => {
      onRawChange(event.target.value)
      setPreview(null)
      setNotice('')
    }}/>
    <button type="button" disabled={!raw.trim()} onClick={openPreview}>Preview chord sheet</button>
    {current && <section className="chord-paste-preview" aria-label="Chord sheet preview">
      <h3>Chord sheet preview</h3>
      <dl>
        <dt>Title</dt><dd>{current.title || title || 'No title detected'}{!current.title && title && ' (kept from editor)'}</dd>
        <dt>Key</dt><dd>{current.keys[0] ? `${current.keys[0]} (estimate)` : `${songKey} (kept from editor)`}
          {current.keys[1] && ` · Alternative ${current.keys[1]}`}</dd>
      </dl>
      {current.content ? <>
        <p>Applying replaces the editor’s chart{current.title && current.title !== title ? ', updates the title' : ''}
          {current.keys[0] && current.keys[0] !== songKey ? ', and sets the estimated key' : ''}. Check the chord alignment before saving.</p>
        {current.warnings.length > 0 && <ul>{current.warnings.map(({ line, kind }) => <li key={line}>
          Line {line}{kind === 'past-lyrics' ? ' has a chord at or past the end of the lyrics. Check its placement.' :
            ' looks like a chord row and was kept as pasted. Check its notation.'}
        </li>)}</ul>}
        <div className="chord-paste-chart">{displaySong(current.content, 0, current.keys[0] ?? songKey, true)}</div>
      </> : <p>No chart content found. Add lyrics or chords to the paste.</p>}
      <button type="button" disabled={!current.content} onClick={apply}>Apply to editor</button>
      <button type="button" onClick={() => setPreview(null)}>Close preview</button>
    </section>}
    <p role="status">{notice}</p>
  </details>
}
