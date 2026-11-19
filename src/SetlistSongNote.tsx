import { useState } from 'react'
import { saveSetlistNote } from './lib/setlist-preferences'

export default function SetlistSongNote({ userId, listId, songId, note, offline, label }:{
  userId:string; listId:string; songId:number; note:string; offline:boolean; label?:string
}) {
  const [draft,setDraft]=useState<string|null>(null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const text=draft??note
  async function save() {
    setBusy(true)
    setMessage('')
    try { await saveSetlistNote(userId,listId,songId,text);setDraft(null);setMessage('Note saved.') }
    catch(error) { setMessage((error as {message:string}).message) }
    finally { setBusy(false) }
  }
  return <details className="stage-notes">
    <summary>{label??(note?'My notes · Saved':'My notes')}</summary>
    <label>Private song note<textarea maxLength={1000} rows={3} value={text} readOnly={offline||busy}
      onChange={event=>{setDraft(event.target.value);setMessage('')}}/></label>
    {offline ? <small>Reconnect to edit and sync notes.</small> :
      <button type="button" disabled={busy||text===note} onClick={()=>void save()}>Save note</button>}
    {message&&<p role="status">{message}</p>}
  </details>
}
