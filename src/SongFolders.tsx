import { useEffect, useState } from 'react'
import { cloud } from './lib/cloud'
type Folder={id:string;name:string}
export default function SongFolders({userId,selected,onSelect,onFolders,onChanged}:{userId:string;selected:string;onSelect:(id:string)=>void;onFolders:(folders:Folder[])=>void;onChanged:()=>Promise<void>}) {
 const [folders,setFolders]=useState<Folder[]>([]),[name,setName]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function load(){const {data,error}=await cloud!.from('songbook_folders').select('id,name').eq('owner_id',userId).order('name');if(error)throw error;setFolders(data??[]);onFolders(data??[])}
 useEffect(()=>{void load().catch(error=>setError(error.message))},[userId])
 async function action(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();await load();await onChanged()}catch(error){setError(String((error as {message?:string}).message??error))}finally{setBusy(false)}}
 return <details className="setlist-panel"><summary>My folders</summary><div className="folder-tools"><label>Show songs<select value={selected} onChange={event=>onSelect(event.target.value)}><option value="all">All songs</option><option value="unfiled">Unfiled</option>{folders.map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
 <form onSubmit={event=>{event.preventDefault();void action(async()=>{const {error}=await cloud!.from('songbook_folders').insert({owner_id:userId,name:name.trim()});if(error)throw error;setName('')})}}><label>New folder<input maxLength={100} required value={name} onChange={event=>setName(event.target.value)}/></label><button disabled={busy||!name.trim()}>Create folder</button></form>
 {folders.some(folder=>folder.id===selected)&&<><button disabled={busy} onClick={()=>{const name=window.prompt('Rename folder',folders.find(folder=>folder.id===selected)!.name);if(name?.trim())void action(async()=>{const {error}=await cloud!.from('songbook_folders').update({name:name.trim()}).eq('id',selected);if(error)throw error})}}>Rename</button><button disabled={busy} onClick={()=>{if(window.confirm('Delete this folder? Its songs will move to Unfiled.'))void action(async()=>{const {error}=await cloud!.from('songbook_folders').delete().eq('id',selected);if(error)throw error;onSelect('all')})}}>Delete folder</button></>}
 </div><p role="status">{error}</p></details>
}
