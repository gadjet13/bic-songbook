import type { SetlistEntry } from './setlist-arrangement'
import type {Song} from '../App'
import type {OfflineBundle} from './offline'
export type OfflineSnapshot={userId:string;bundle?:OfflineBundle;shell:'checking'|'ready'|'unavailable';identity:boolean;error?:string}
export type Readiness={state:'ready'|'needs-save'|'checking'|'blocked';detail:string;savedAt?:string}
export type ReadinessList={id:string;title:string;song_ids?:number[];song_entries?:SetlistEntry[]|null;revision?:number;songs?:Song[]}
const sameSong=(a:Song,b:Song)=>a.id===b.id&&a.title===b.title&&a.artist===b.artist&&a.key===b.key&&(a.setlist_key??null)===(b.setlist_key??null)&&a.content===b.content&&(a.revision===undefined||b.revision===undefined||a.revision===b.revision)
export function setlistReadiness(snapshot:OfflineSnapshot|undefined,userId:string,list:ReadinessList,songs:Song[],shared=false):Readiness{
 if(!snapshot||snapshot.userId!==userId||snapshot.shell==='checking')return{state:'checking',detail:'Checking this device…'}
 if(snapshot.error)return{state:'blocked',detail:snapshot.error}
 const saved=snapshot.bundle
 if(!saved||saved.userId!==userId)return{state:'needs-save',detail:'This account has no saved offline copy on this device.'}
 if(!Array.isArray(saved.personal)||!Array.isArray(saved.setlists)||!Array.isArray(saved.shared))return{state:'needs-save',detail:'The saved offline copy is incomplete. Save the latest while online.'}
 if(shared){const cached=saved.shared.find(row=>row.id===list.id);if(!cached||!Array.isArray(cached.songs)||cached.title!==list.title||cached.songs.length!==songs.length||songs.some((song,index)=>!cached.songs[index]||!sameSong(song,cached.songs[index])))return{state:'needs-save',detail:'Save the latest shared setlist and its song versions.'}}
 else{const cached=saved.setlists.find(row=>row.id===list.id);if(!cached||cached.title!==list.title||cached.revision!==list.revision||JSON.stringify(cached.song_ids)!==JSON.stringify(list.song_ids)||JSON.stringify(cached.song_entries??null)!==JSON.stringify(list.song_entries??null))return{state:'needs-save',detail:'The current setlist name, order, or keys have not been saved offline.'}
  const ids=[...new Set(list.song_ids??[])],missing=ids.filter(id=>!songs.some(song=>song.id===id)||!saved.personal.some(song=>song.id===id))
  if(missing.length)return{state:'needs-save',detail:`${missing.length} song${missing.length===1?' is':'s are'} missing from the current library or offline copy. Recover unavailable songs before saving offline.`}
  if(ids.some(id=>!sameSong(songs.find(song=>song.id===id)!,saved.personal.find(song=>song.id===id)!)))return{state:'needs-save',detail:'Some saved song versions are out of date. Save the latest for offline.'}
 }
 if(!snapshot.identity)return{state:'blocked',detail:'A saved sign-in is needed for offline access. Stay signed in and save latest for offline.'}
 if(snapshot.shell!=='ready')return{state:'blocked',detail:'Songs are saved, but offline app files are not verified. Connect, refresh the app, and check again.'}
 return{state:'ready',detail:'Setlist order and all included song versions are saved on this device.',savedAt:saved.savedAt}
}
/** Ask the controlling app worker to verify every asset in its current offline cache. */
export function checkOfflineShell():Promise<boolean>{
 if(typeof navigator==='undefined'||!('serviceWorker'in navigator)||!navigator.serviceWorker.controller)return Promise.resolve(false)
 const controller=navigator.serviceWorker.controller
 if(new URL(controller.scriptURL).pathname!=='/sw.js')return Promise.resolve(false)
 return new Promise(resolve=>{const channel=new MessageChannel();let done=false;const finish=(ready:boolean)=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(ready)};const timer=setTimeout(()=>finish(false),2500);channel.port1.onmessage=event=>finish(event.data?.type==='BIC_OFFLINE_STATUS'&&event.data.ready===true);try{controller.postMessage({type:'BIC_OFFLINE_STATUS'},[channel.port2])}catch{finish(false)}})
}
