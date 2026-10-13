import { useState } from 'react'
import { cloud } from './lib/cloud'
import useUnsavedChanges from './useUnsavedChanges'
import { allowNavigation } from './lib/unsaved'
import SetlistLimitPanel from './SetlistLimitPanel'
export default function SaveSharedSetlist({shareId,title,ownerId,onSaved}:{shareId:string;title:string;ownerId:string;onSaved:()=>Promise<void>}) {
 const [name,setName]=useState(title),[open,setOpen]=useState(false),[limit,setLimit]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 useUnsavedChanges(open&&name!==title)
 async function copy(replace?:{id:string;revision:number}){setBusy(true);setNotice('');try{const {error}=await cloud!.rpc('copy_shared_setlist',{share_id:shareId,new_title:name.trim()||title,replace_id:replace?.id??null,expected_revision:replace?.revision??null});if(error)throw error;setLimit(false);setOpen(false);await onSaved();setNotice('Saved to My songbook → Setlists. Your copy is independent; the original shared setlist keeps updating separately.')}catch(error){const msg=(error as {message:string}).message;if(msg.includes('25 personal setlists'))setLimit(true);else setNotice(msg)}finally{setBusy(false)}}
 return <section><button disabled={busy} onClick={()=>{if(!open||allowNavigation())setOpen(!open)}}>Save to my setlists</button>{open&&<><label>Personal setlist name<input disabled={busy} value={name} maxLength={200} onChange={event=>setName(event.target.value)}/></label><p>Copies the current order and song versions into your personal songbook. Neither side’s later edits affect the other.</p><button disabled={busy} onClick={()=>void copy()}>Save independent copy</button><button disabled={busy} onClick={()=>{if(allowNavigation()){setOpen(false);setLimit(false)}}}>Cancel</button></>}{limit&&<SetlistLimitPanel ownerId={ownerId} title={name||title} songIds={[]} onCreated={()=>{}} onCancel={()=>setLimit(false)} onReplace={async list=>{await copy(list)}}/>}<p role="status">{notice}</p></section>
}
