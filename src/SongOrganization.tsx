import { useEffect, useState } from 'react'
import { cloud } from './lib/cloud'
import type { Song } from './App'
import type { OfflineList } from './lib/offline'
import SetlistCopy from './SetlistCopy'
import FriendPicker from './FriendPicker'

type Setlist = {id:string; title:string; song_ids:number[]; revision:number}
const message = (error: unknown) => error instanceof Error ? error.message : String((error as {message?:string})?.message ?? error)
export function useFavorites(userId: string, offlineFavorites?:number[]) {
 const [favorites,setFavorites]=useState<number[]>([])
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 useEffect(()=>{if(offlineFavorites){setFavorites(offlineFavorites);setError('');return}let active=true;const load=async()=>{const {data,error}=await cloud!.from('songbook_favorites').select('song_id').eq('user_id',userId);if(active){if(error)setError(error.message);else {setFavorites((data??[]).map(row=>row.song_id));setError('')}}};void load();window.addEventListener('focus',load);return()=>{active=false;window.removeEventListener('focus',load)}},[userId,offlineFavorites])
 async function toggle(id:number){if(busy)return;setBusy(true);setError('');try{const exists=favorites.includes(id);const result=exists?await cloud!.from('songbook_favorites').delete().eq('user_id',userId).eq('song_id',id):await cloud!.from('songbook_favorites').insert({user_id:userId,song_id:id});if(result.error)throw result.error;setFavorites(current=>exists?current.filter(value=>value!==id):[...current,id])}catch(error){setError(message(error))}finally{setBusy(false)}}
 return {favorites,toggle,error,busy}
}
export default function SongOrganization({songs,canEdit,onOpen,ownerId,offlineLists}: {offlineLists?:OfflineList[];songs:Song[];canEdit:boolean;ownerId:string|null;onOpen:(songs:Song[])=>void}) {
 const [lists,setLists]=useState<Setlist[]>([])
 const [selected,setSelected]=useState<Setlist|null>(null)
 const [title,setTitle]=useState('')
 const [ids,setIds]=useState<number[]>([])
 const [search,setSearch]=useState('')
 const [recipient,setRecipient]=useState('')
 const [friendRefresh,setFriendRefresh]=useState(0)
 const [shares,setShares]=useState<{id:string;recipient_email:string}[]>([])
 async function loadShares(id:string){if(offlineLists)return;const {data,error}=await cloud!.from('songbook_setlist_shares').select('id,recipient_email').eq('setlist_id',id);if(error)throw error;setShares(data??[])}
 useEffect(()=>{setShares([]);if(selected)void loadShares(selected.id).catch(error=>setNotice(message(error)))},[selected?.id,offlineLists])
 const [editing,setEditing]=useState(false)
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 function query(){const q=cloud!.from('songbook_setlists').select('*').order('title');return ownerId?q.eq('owner_id',ownerId):q.is('owner_id',null)}
 async function refresh(){if(offlineLists){setLists(offlineLists);return offlineLists}const {data,error}=await query();if(error)throw error;setLists(data??[]);return (data??[]) as Setlist[]}
 useEffect(()=>{const restored=()=>{setSelected(null);void refresh().catch(error=>setNotice(message(error)))};window.addEventListener('songbook-restored',restored);return()=>window.removeEventListener('songbook-restored',restored)},[ownerId])
 useEffect(()=>{if(offlineLists){setLists(offlineLists);return}let active=true;void query().then(({data,error})=>{if(active){if(error)setNotice(error.message);else setLists(data??[])}});return()=>{active=false}},[ownerId,offlineLists])
 async function action(fn:()=>Promise<void>){setBusy(true);setNotice('');try{await fn()}catch(error){setNotice(message(error))}finally{setBusy(false)}}
 function choose(list:Setlist){setSelected(list);setTitle(list.title);setIds(list.song_ids);setEditing(false);setNotice('')}
 async function save(){if(offlineLists)throw new Error('Reconnect before saving setlists.');if(!title.trim())throw new Error('Enter a setlist name.');const fields={title:title.trim(),song_ids:ids};const result=selected?await cloud!.from('songbook_setlists').update(fields).eq('id',selected.id).eq('revision',selected.revision).select().maybeSingle():await cloud!.from('songbook_setlists').insert({...fields,owner_id:ownerId}).select().single();if(result.error)throw result.error;if(!result.data)throw new Error('Someone changed this setlist. Copy your changes, then refresh setlists and try again.');await refresh();choose(result.data);setNotice('Setlist saved.')}
 function move(index:number,direction:number){const next=[...ids];[next[index],next[index+direction]]=[next[index+direction],next[index]];setIds(next)}
 const queue=(values:number[])=>values.map(id=>songs.find(song=>song.id===id)).filter((song):song is Song=>!!song)
 return <details className="setlist-panel"><summary>Setlists</summary><p className="storage-note">{ownerId?'Your personal setlists. Share a live, read-only setlist with another approved personal account.':'Church setlists shared with approved members.'}</p>
 <p>{lists.length} / 25 personal setlists</p><div className="setlist-tools"><label>Choose setlist<select value={selected?.id??''} disabled={busy||editing} onChange={event=>{const list=lists.find(item=>item.id===event.target.value);if(list)choose(list);else setSelected(null)}}><option value="">Select a setlist</option>{lists.map(list=><option key={list.id} value={list.id}>{list.title}</option>)}</select></label>
 <button disabled={busy||editing} onClick={()=>void action(async()=>{const rows=await refresh();if(selected){const current=rows.find(row=>row.id===selected.id);if(current)choose(current);else setSelected(null)}})}>Refresh setlists</button>
 {canEdit&&<button disabled={busy||editing||lists.length>=25} onClick={()=>{setSelected(null);setTitle('');setIds([]);setEditing(true)}}>New setlist</button>}</div>
 {editing?<fieldset disabled={!canEdit}><label>Setlist name<input maxLength={200} value={title} placeholder="Sunday service" disabled={busy} onChange={event=>setTitle(event.target.value)}/></label>
 <ol className="setlist-songs">{ids.map((id,index)=><li key={id+'-'+index}><span>{songs.find(song=>song.id===id)?.title??'Song removed from library'}</span><button disabled={busy||index===0} aria-label={'Move song '+(index+1)+' up'} onClick={()=>move(index,-1)}>↑</button><button disabled={busy||index===ids.length-1} aria-label={'Move song '+(index+1)+' down'} onClick={()=>move(index,1)}>↓</button><button disabled={busy} onClick={()=>setIds(ids.filter((_,i)=>i!==index))}>Remove</button></li>)}</ol>
 <label>Search songs to add<input type="search" value={search} disabled={busy} placeholder="Song title or artist" onChange={event=>setSearch(event.target.value)}/></label>
 {search.trim() && <div className="setlist-search-results">{songs.filter(song=>`${song.title} ${song.artist}`.toLowerCase().includes(search.toLowerCase())).slice(0,20).map(song=><button key={song.id} disabled={busy||ids.length>=100} onClick={()=>{setIds([...ids,song.id]);setSearch('')}}>＋ {song.title} {song.artist&&`· ${song.artist}`}</button>)}{!songs.some(song=>`${song.title} ${song.artist}`.toLowerCase().includes(search.toLowerCase()))&&<p>No matching songs.</p>}</div>}
 <button disabled={busy} onClick={()=>void action(save)}>Save setlist</button><button disabled={busy} onClick={()=>{setEditing(false);if(selected)choose(selected)}}>Cancel</button>
 </fieldset>:selected&&<><ol>{selected.song_ids.map((id,index)=>{const song=songs.find(item=>item.id===id);return <li key={id+'-'+index}>{song?<button onClick={()=>onOpen(queue(selected.song_ids.slice(index)))}>{song.title}</button>:<span>Song removed from library</span>}</li>})}</ol>
 <SetlistCopy songs={queue(selected.song_ids)}/>
 <button disabled={!queue(selected.song_ids).length} onClick={()=>onOpen(queue(selected.song_ids))}>Start setlist</button>
 {canEdit&&<><button disabled={busy} onClick={()=>{setTitle(selected.title);setIds(selected.song_ids);setEditing(true)}}>Edit setlist</button><button disabled={busy} onClick={()=>{if(window.confirm('Delete setlist '+selected.title+'? Songs will stay in the library.'))void action(async()=>{const {data,error}=await cloud!.from('songbook_setlists').delete().eq('id',selected.id).eq('revision',selected.revision).select('id');if(error)throw error;if(!data?.length)throw new Error('Setlist changed. Refresh before deleting.');setSelected(null);await refresh()})}}>Delete setlist</button></>}
 {!offlineLists&&ownerId&&<FriendPicker ownerId={ownerId} onChoose={setRecipient} refreshKey={friendRefresh}/>}
 {!offlineLists&&<form onSubmit={event=>{event.preventDefault();void action(async()=>{const {error}=await cloud!.rpc('share_setlist',{list_id:selected.id,recipient_email_address:recipient});if(error)throw error;await loadShares(selected.id);setRecipient('');setFriendRefresh(value=>value+1);setNotice('Shared. Your friend can find it under Shared with me. Saved changes update automatically.')})}}><label>Share with account email<input type="email" required value={recipient} onChange={event=>setRecipient(event.target.value)} /></label><button disabled={busy}>Share setlist</button></form>}
 {shares.map(share=><p key={share.id}>{share.recipient_email} <button disabled={busy} onClick={()=>void action(async()=>{const {error}=await cloud!.from('songbook_setlist_shares').delete().eq('id',share.id);if(error)throw error;await loadShares(selected.id)})}>Revoke sharing</button></p>)}
 </>}<p role="status">{notice}</p></details>
}
