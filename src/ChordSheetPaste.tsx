import { useState } from 'react'
import { convertChordSheet } from './lib/chord-sheet'
import { suggestKeys } from './lib/suggest-key'
export default function ChordSheetPaste({onApply}:{onApply:(content:string,title:string,key:string)=>void}) {
 const [raw,setRaw]=useState(''),[notice,setNotice]=useState('')
 function convert(){const result=convertChordSheet(raw);const keys=suggestKeys(result.content);onApply(result.content,result.title,keys[0]??'');setNotice(`Converted into the editing fields below. Check chord positions and the estimated key before saving.${keys.length>1?` Alternative key: ${keys[1]}.`:''}`)}
 return <details className="setlist-panel"><summary>Paste chord sheet</summary><p>Paste chords above lyrics. A title above the first chord line is detected automatically. Convert replaces the current editor text; it does not save the song.</p><textarea aria-label="Paste original chord sheet" className="song-editor" value={raw} onChange={event=>{setRaw(event.target.value);setNotice('')}}/><button disabled={!raw.trim()} onClick={convert}>Convert into editor</button><p role="status">{notice}</p></details>
}
