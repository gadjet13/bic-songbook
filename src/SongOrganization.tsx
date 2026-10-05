import { useEffect, useState } from 'react'
import { cloud } from './lib/cloud'
import type { Song } from './App'

type Setlist = {id:string; title:string; song_ids:number[]; revision:number}
const message = (error: unknown) => error instanceof Error ? error.message : String((error as {message?:string})?.message ?? error)
export function useFavorites(userId: string) {
 const [favorites,setFavorites]=useState<number[]>([])
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 useEffect(()=>{let active=true;const load=async()=>{const {data,error}=await cloud!.from('songbook_favorites').select('song_id').eq('user_id',userId);if(active){if(error)setError(error.message);else {setFavorites((data??[]).map(row=>row.song_id));setError('')}}};void load();window.addEventListener('focus',load);return()=>{active=false;window.removeEventListener('focus',load)}},[userId])
 async function toggle(id:number){if(busy)return;setBusy(true);setError('');try{const exists=favorites.includes(id);const result=exists?await cloud!.from('songbook_favorites').delete().eq('user_id',userId).eq('song_id',id):await cloud!.from('songbook_favorites').insert({user_id:userId,song_id:id});if(result.error)throw result.error;setFavorites(current=>exists?current.filter(value=>value!==id):[...current,id])}catch(error){setError(message(error))}finally{setBusy(false)}}
 return {favorites,toggle,error,busy}
}
export default function SongOrganization({songs,canEdit,onOpen}: {songs:Song[];canEdit:boolean;onOpen:(songs:Song[])=>void}) {
 const [lists,setLists]=useState<Setlist[]>([])
 const [selected,setSelected]=useState<Setlist|null>(null)
 const [title,setTitle]=useState('')
 const [ids,setIds]=useState<number[]>([])
 const [adding,setAdding]=useState('')
 const [editing,setEditing]=useState(false)
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 async function refresh(){const {data,error}=await cloud!.from('songbook_setlists').select('*').order('title');if(error)throw error;setLists(data??[]);return (data??[]) as Setlist[]}
 useEffect(()=>{let active=true;void cloud!.from('songbook_setlists').select('*').order('title').then(({data,error})=>{if(active){if(error)setNotice(error.message);else setLists(data??[])}});return()=>{active=false}},[])
 async function action(fn:()=>Promise<void>){setBusy(true);setNotice('');try{await fn()}catch(error){setNotice(message(error))}finally{setBusy(false)}}
 function choose(list:Setlist){setSelected(list);setTitle(list.title);setIds(list.song_ids);setEditing(false);setNotice('')}
 async function save(){if(!title.trim())throw new Error('Enter a setlist name.');const fields={title:title.trim(),song_ids:ids};const result=selected?await cloud!.from('songbook_setlists').update(fields).eq('id',selected.id).eq('revision',selected.revision).select().maybeSingle():await cloud!.from('songbook_setlists').insert(fields).select().single();if(result.error)throw result.error;if(!result.data)throw new Error('Someone changed this setlist. Copy your changes, then refresh setlists and try again.');await refresh();choose(result.data);setNotice('Setlist saved.')}
 function move(index:number,direction:number){const next=[...ids];[next[index],next[index+direction]]=[next[index+direction],next[index]];setIds(next)}
 const queue=(values:number[])=>values.map(id=>songs.find(song=>song.id===id)).filter((song):song is Song=>!!song)
 return <details className="setlist-panel"><summary>Setlists</summary><p className="storage-note">Shared with approved members. Owners and editors can arrange songs.</p>
 <div className="setlist-tools"><label>Choose setlist<select value={selected?.id??''} disabled={busy||editing} onChange={event=>{const list=lists.find(item=>item.id===event.target.value);if(list)choose(list);else setSelected(null)}}><option value="">Select a setlist</option>{lists.map(list=><option key={list.id} value={list.id}>{list.title}</option>)}</select></label>
 <button disabled={busy||editing} onClick={()=>void action(async()=>{const rows=await refresh();if(selected){const current=rows.find(row=>row.id===selected.id);if(current)choose(current);else setSelected(null)}})}>Refresh setlists</button>
 {canEdit&&<button disabled={busy||editing} onClick={()=>{setSelected(null);setTitle('');setIds([]);setEditing(true)}}>New setlist</button>}</div>
 {editing?<><label>Setlist name<input maxLength={200} value={title} placeholder="Sunday service" disabled={busy} onChange={event=>setTitle(event.target.value)}/></label>
 <ol className="setlist-songs">{ids.map((id,index)=><li key={id+'-'+index}><span>{songs.find(song=>song.id===id)?.title??'Song removed from library'}</span><button disabled={busy||index===0} aria-label={'Move song '+(index+1)+' up'} onClick={()=>move(index,-1)}>↑</button><button disabled={busy||index===ids.length-1} aria-label={'Move song '+(index+1)+' down'} onClick={()=>move(index,1)}>↓</button><button disabled={busy} onClick={()=>setIds(ids.filter((_,i)=>i!==index))}>Remove</button></li>)}</ol>
 <label>Add a song<select value={adding} disabled={busy} onChange={event=>setAdding(event.target.value)}><option value="">Choose song</option>{songs.map(song=><option key={song.id} value={song.id}>{song.title}</option>)}</select></label>
 <button disabled={busy||!adding||ids.length>=100} onClick={()=>{setIds([...ids,Number(adding)]);setAdding('')}}>Add to setlist</button><button disabled={busy} onClick={()=>void action(save)}>Save setlist</button><button disabled={busy} onClick={()=>{setEditing(false);if(selected)choose(selected)}}>Cancel</button>
 </>:selected&&<><ol>{selected.song_ids.map((id,index)=>{const song=songs.find(item=>item.id===id);return <li key={id+'-'+index}>{song?<button onClick={()=>onOpen(queue(selected.song_ids.slice(index)))}>{song.title}</button>:<span>Song removed from library</span>}</li>})}</ol>
 <button disabled={!queue(selected.song_ids).length} onClick={()=>onOpen(queue(selected.song_ids))}>Start setlist</button>
 {canEdit&&<><button disabled={busy} onClick={()=>{setTitle(selected.title);setIds(selected.song_ids);setEditing(true)}}>Edit setlist</button><button disabled={busy} onClick={()=>{if(window.confirm('Delete setlist '+selected.title+'? Songs will stay in the library.'))void action(async()=>{const {data,error}=await cloud!.from('songbook_setlists').delete().eq('id',selected.id).eq('revision',selected.revision).select('id');if(error)throw error;if(!data?.length)throw new Error('Setlist changed. Refresh before deleting.');setSelected(null);await refresh()})}}>Delete setlist</button></>}
 </>}<p role="status">{notice}</p></details>
}
