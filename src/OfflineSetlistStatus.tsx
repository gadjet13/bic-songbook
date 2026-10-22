import {useState} from 'react'
import {setlistReadiness} from './lib/offline-readiness'
import type {OfflineSnapshot,ReadinessList} from './lib/offline-readiness'
import type {Song} from './App'
export default function OfflineSetlistStatus({snapshot,userId,list,songs,shared=false,compact=false,offline=false,onSave,disabled=false}:{snapshot:OfflineSnapshot|undefined;userId:string;list:ReadinessList;songs:Song[];shared?:boolean;compact?:boolean;offline?:boolean;onSave?:()=>Promise<void>;disabled?:boolean}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const status=setlistReadiness(snapshot,userId,list,songs,shared),label=status.state==='ready'?'✓ Ready offline':status.state==='checking'?'Checking offline…':status.state==='needs-save'?'Save for offline':'Offline not verified'
 if(compact)return <small className={'offline-setlist-badge offline-'+status.state} title={status.detail}>{label}</small>
 return <section className={'offline-setlist-status offline-'+status.state} aria-label="Setlist offline readiness"><strong aria-live="polite">{label}</strong><p>{status.detail}{status.savedAt&&` Saved ${new Date(status.savedAt).toLocaleString()}.`}</p>{offline&&<p>This uses the saved copy. Reconnect to check for newer changes.</p>}<p className="storage-note">Stay signed in. Keep Remember me checked to use saved copies after closing the browser. This check covers the files currently saved; test airplane mode on this device before worship.</p>{onSave&&<button disabled={disabled||busy||offline} onClick={async()=>{setBusy(true);setNotice('');try{await onSave()}catch(error){setNotice((error as Error).message)}finally{setBusy(false)}}}>{busy?'Saving…':'Save latest for offline'}</button>}<p role="status">{notice}</p></section>
}
