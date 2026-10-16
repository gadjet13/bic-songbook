import { useEffect, useState } from 'react'
import { cloud } from './lib/cloud'
type Friend={friend_id:string;email:string;nickname:string}
export default function FriendPicker({ownerId,onChoose,refreshKey}:{ownerId:string;onChoose?:(email:string)=>void;refreshKey?:number}) {
 const [candidate,setCandidate]=useState<{email:string;handle:string|null;display_name:string;user_id:string}|null>(null)
 const [friends,setFriends]=useState<Friend[]>([])
 const [search,setSearch]=useState('')
 const [email,setEmail]=useState('')
 const [nickname,setNickname]=useState('')
 const [version,setVersion]=useState(0)
 const [notice,setNotice]=useState('')
 const [busy,setBusy]=useState(false)
 useEffect(()=>{let active=true;void cloud!.from('songbook_friends').select('friend_id,email,nickname').eq('owner_id',ownerId).order('email').then(({data,error})=>{if(active){if(error)setNotice(error.message);else setFriends(data??[])}});return()=>{active=false}},[ownerId,refreshKey,version])
 async function change(friend:Friend,remove:boolean){
  const nickname=remove?null:window.prompt('Private nickname for '+friend.email,friend.nickname)
  if(!remove&&nickname===null)return
  setBusy(true);setNotice('')
  try{const query=remove?cloud!.from('songbook_friends').delete():cloud!.from('songbook_friends').update({nickname:nickname!.trim().slice(0,80)});const {data,error}=await query.eq('owner_id',ownerId).eq('friend_id',friend.friend_id).select('friend_id');if(error)throw error;if(!data?.length)throw new Error('Could not update friend. Refresh and try again.');setFriends(rows=>remove?rows.filter(row=>row.friend_id!==friend.friend_id):rows.map(row=>row.friend_id===friend.friend_id?{...row,nickname:nickname!.trim().slice(0,80)}:row))}catch(error){setNotice((error as {message:string}).message)}finally{setBusy(false)}
 }
 async function add(){setBusy(true);setNotice('');try{if(!candidate){const {data,error}=await cloud!.rpc('resolve_songbook_friend',{identifier:email});if(error)throw error;setCandidate(data);return}const {error}=await cloud!.rpc('add_songbook_friend',{email_address:candidate.email,private_nickname:nickname});if(error)throw error;setEmail('');setCandidate(null);setNickname('');setVersion(value=>value+1);setNotice('Friend saved. No invitation or access change was sent.')}catch(error){setNotice((error as {message:string}).message)}finally{setBusy(false)}}
 return <details open={!onChoose}><summary>My friends</summary><p>Add approved accounts here, or they are remembered after sharing. Nicknames are private. Removing a friend does not revoke existing shares.</p><form onSubmit={event=>{event.preventDefault();void add()}}><label>Friend’s ID or email<input type="text" required disabled={busy} value={email} onChange={event=>{setEmail(event.target.value);setCandidate(null)}}/></label><label>Private nickname (optional)<input maxLength={80} disabled={busy} value={nickname} onChange={event=>setNickname(event.target.value)}/></label><button disabled={busy}>{candidate?'Confirm add friend':'Find person'}</button>{candidate&&<p>Confirm: {candidate.display_name} · {candidate.handle?'@'+candidate.handle:candidate.email}</p>}</form><input aria-label="Search friends" type="search" placeholder="Search nickname or email" value={search} onChange={event=>setSearch(event.target.value)}/>{friends.filter(friend=>`${friend.nickname} ${friend.email}`.toLowerCase().includes(search.toLowerCase())).map(friend=><div key={friend.friend_id}><button disabled={busy} onClick={()=>onChoose?.(friend.email)}>{friend.nickname||friend.email}{friend.nickname&&<small> · {friend.email}</small>}</button><button disabled={busy} onClick={()=>void change(friend,false)}>Rename</button><button disabled={busy} onClick={()=>void change(friend,true)}>Remove friend</button></div>)}{!friends.length&&<p>No friends yet. Add an approved account above.</p>}<p role="status">{notice}</p></details>
}
