import { useState } from 'react'
import { chartCueLocations, cueLocationLabel, songCueLocation } from './lib/cue-locations'
import type { CueScope, SetlistCue } from './lib/setlist-cues'

export function CueText({ cues, location }: { cues: SetlistCue[]; location: string }) {
  return <>
    {cues.filter(cue => cue.location === location).sort((a,b) => b.scope.localeCompare(a.scope)).map(cue =>
      <p className="setlist-cue" data-visibility={cue.scope} key={cue.scope}>
        <strong>{cue.scope === 'team' ? 'Team cue' : 'My cue · Private'}</strong> {cue.cue}
      </p>
    )}
  </>
}

export default function SetlistCues({ songId, content, cues, canEditTeam, offline, save }: {
  songId: number
  content: string
  cues: SetlistCue[]
  canEditTeam: boolean
  offline: boolean
  save: (row: SetlistCue) => Promise<void>
}) {
  const [scope, setScope] = useState<CueScope>('private')
  const [location, setLocation] = useState(songCueLocation)
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const sections = chartCueLocations(content)
  const saved = cues.find(cue => cue.scope === scope && cue.location === location)?.cue ?? ''
  const text = draft ?? saved
  const locations = new Set([songCueLocation, ...sections.map(section => section.id)])
  const orphaned = new Set(cues.filter(cue => cue.scope === scope && !locations.has(cue.location)).map(cue => cue.location))
  if (!locations.has(location)) orphaned.add(location)
  const editable = locations.has(location)
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

  return <details className="setlist-cue-editor">
    <summary>Manage cues</summary>
    <form onSubmit={event => { event.preventDefault(); void submit(text) }}>
      {canEditTeam && <label>Visibility<select value={scope} disabled={busy || dirty} onChange={event => {
        setScope(event.target.value as CueScope)
        setLocation(songCueLocation)
        setDraft(null)
        setStatus('')
      }}>
        <option value="private">My cue · Private</option>
        <option value="team">Team cue</option>
      </select></label>}
      <label>Location<select value={location} disabled={busy || dirty} onChange={event => {
        setLocation(event.target.value)
        setDraft(null)
        setStatus('')
      }}>
        <option value={songCueLocation}>Whole song</option>
        {sections.map(section => <option key={section.id} value={section.id}>{section.label}</option>)}
        {[...orphaned].map(id => <option key={id} value={id}>{cueLocationLabel(id)}</option>)}
      </select></label>
      <label>{scope === 'team' ? 'Team cue' : 'My cue · Private'}<textarea
        value={text} maxLength={300} rows={2} readOnly={busy || !editable || offline}
        onChange={event => { setDraft(event.target.value); setStatus('') }}
      /></label>
      {editable && <button type="submit" disabled={offline || busy || text.trim() === saved}>Save cue</button>}
      {dirty && <button type="button" disabled={busy} onClick={() => { setDraft(null); setStatus('') }}>Discard changes</button>}
      {saved && <button type="button" disabled={offline || busy} onClick={() => void submit('')}>Remove cue</button>}
      {offline && <p>Reconnect to edit cues.</p>}
      {status && <p role="status">{status}</p>}
    </form>
  </details>
}
