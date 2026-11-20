import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { chartCueLocations, cueLocationLabel, songCueLocation } from './lib/cue-locations'
import type { CueScope, SetlistCue } from './lib/setlist-cues'

export function CueText({ cues, location }: { cues: SetlistCue[]; location: string }) {
  return <>
    {cues.filter(cue => cue.location === location).sort((a,b) => b.scope.localeCompare(a.scope)).map(cue =>
      <p className="setlist-cue" data-visibility={cue.scope} key={cue.scope}>
        <span className="setlist-cue-visibility">{cue.scope === 'team' ? 'Team cue. ' : 'Private cue. '}</span>{cue.cue}
      </p>
    )}
  </>
}

type CueControls = {
  songId: number
  cues: SetlistCue[]
  canEditTeam: boolean
  offline: boolean
  save: (row: SetlistCue) => Promise<void>
}

function CueEditor({ songId, location, cues, canEditTeam, offline, save, close, headingAvailable = true }: CueControls & {
  location: string
  close?: () => void
  headingAvailable?: boolean
}) {
  const [scope, setScope] = useState<CueScope>(() =>
    canEditTeam && cues.some(cue => cue.scope === 'team') &&
    !cues.some(cue => cue.scope === 'private') ? 'team' : 'private')
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const saved = cues.find(cue => cue.scope === scope)?.cue ?? ''
  const text = draft ?? saved
  const dirty = draft !== null && draft !== saved

  async function submit(value: string) {
    setBusy(true)
    setStatus('')
    try {
      await save({ song_id: songId, location, scope, cue: value })
      setDraft(null)
      setStatus(value.trim() ? 'Cue saved.' : 'Cue removed.')
    } catch (error) {
      setStatus((error as { message?: string }).message ?? 'Could not save the cue.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="setlist-cue-editor" onSubmit={event => { event.preventDefault(); void submit(text) }}>
    {canEditTeam && <label>Visibility<select value={scope} disabled={busy || dirty} onChange={event => {
      setScope(event.target.value as CueScope)
      setDraft(null)
      setStatus('')
    }}>
      <option value="private">My cue · Private</option>
      <option value="team">Team cue</option>
    </select></label>}
    <label>{scope === 'team' ? 'Team cue' : 'My cue · Private'}<textarea
      value={text} maxLength={300} rows={2} readOnly={busy || !headingAvailable || offline}
      onChange={event => { setDraft(event.target.value); setStatus('') }}
    /></label>
    <div className="setlist-cue-actions">
      {headingAvailable && <button type="submit" disabled={offline || busy || text.trim() === saved}>Save cue</button>}
      {dirty && <button type="button" disabled={busy} onClick={() => { setDraft(null); setStatus('') }}>Discard changes</button>}
      {saved && <button type="button" disabled={offline || busy} onClick={() => void submit('')}>Remove cue</button>}
      {close && <button type="button" onClick={close}>Close</button>}
    </div>
    {offline && <p>Reconnect to edit cues.</p>}
    {status && <p role="status">{status}</p>}
  </form>
}

export function CueAnchor({ location, title, heading, controls }: {
  location: string
  title: string
  heading: (title: ReactNode) => ReactNode
  controls: CueControls | null
}) {
  const panelId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  // Keep an opened editor mounted so closing a section preserves its draft.
  const [editor, setEditor] = useState<'unopened' | 'open' | 'closed'>('unopened')
  const cues = controls?.cues.filter(cue => cue.location === location) ?? []
  const open = editor === 'open'

  return <>
    {heading(controls ? <button type="button" className="cue-heading-button" ref={trigger}
      aria-expanded={open} aria-controls={editor === 'unopened' ? undefined : panelId}
      title="Add or edit cues" onClick={() => setEditor(open ? 'closed' : 'open')}>
      <span>{title}</span><span className="cue-heading-icon" aria-hidden="true">{open ? '−' : '+'}</span>
    </button> : title)}
    <CueText cues={cues} location={location}/>
    {controls && editor !== 'unopened' && <div className="setlist-cue-panel" id={panelId} hidden={!open}>
      <CueEditor {...controls} cues={cues} location={location} close={() => {
        setEditor('closed')
        trigger.current?.focus()
      }}/>
    </div>}
  </>
}

export function UnplacedCues({ content, controls }: { content: string; controls: CueControls }) {
  const locations = new Set([songCueLocation, ...chartCueLocations(content).map(section => section.id)])
  const unplaced = controls.cues.filter(cue => !locations.has(cue.location) && (controls.canEditTeam || cue.scope === 'private'))
  if (!unplaced.length) return null
  return <details className="setlist-cue-panel">
    <summary>Cues from removed sections</summary>
    {[...new Set(unplaced.map(cue => cue.location))].map(location =>
      <details key={location}>
        <summary>{cueLocationLabel(location)}</summary>
        <CueEditor {...controls} cues={unplaced.filter(cue => cue.location === location)}
          location={location} headingAvailable={false}/>
      </details>
    )}
  </details>
}
