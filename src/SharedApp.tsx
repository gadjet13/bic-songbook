import { useEffect, useRef, useState } from 'react'
import { readOffline,saveOffline,clearOffline,usableOffline,rememberIdentity,offlineIdentity,forgetIdentity } from './lib/offline'
import type { OfflineBundle } from './lib/offline'
import App from './App'
import SaveSharedSetlist from './SaveSharedSetlist'
import { allowNavigation } from './lib/unsaved'
import FriendPicker from './FriendPicker'
import type { Song } from './App'
type SharedSetlist = {id:string;title:string;sender_email:string;songs:Song[]}
import { MenuSection } from './ThemePreference'
import { cloud, loadSongs, insertSongs, updateSong, removeSong } from './lib/cloud'
import type { CloudSong } from './lib/cloud'

export default function SharedApp() {
  const [session,setSession]=useState<{user:{id:string;email?:string}}|null>(null)
  const [offline,setOffline]=useState(!navigator.onLine)
  const [offlineBundle,setOfflineBundle]=useState<OfflineBundle|null>(null)
  const [offlineStatus,setOfflineStatus]=useState('Not saved on this device yet.')
  const [ready,setReady]=useState(false)
  const [role,setRole]=useState<string|null>(null)
  const [homeTab,setHomeTab]=useState<'songbooks'|'friends'>('songbooks')
  const [pendingSong,setPendingSong]=useState<number|undefined>()
  const [book,setBook]=useState<'home'|'personal'|'church'>('home')
  const [songs,setSongs]=useState<CloudSong[]>([])
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [signup,setSignup]=useState(false)
  const [recovery,setRecovery]=useState(false)
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(false)
  const [showAccounts,setShowAccounts]=useState(false)
  const [sharedLists,setSharedLists]=useState<SharedSetlist[]>([])
  const [sharedList,setSharedList]=useState<SharedSetlist|null>(null)
  const [accounts,setAccounts]=useState<{email:string;member_role:string}[]>([])
  const [memberEmail,setMemberEmail]=useState('')
  const [memberRole,setMemberRole]=useState('viewer')
  const bookRef=useRef(book)
  bookRef.current=book
  const sharedListsRef=useRef(sharedLists)
  sharedListsRef.current=sharedLists
  function openBook(next:'personal'|'church') {
    if(!allowNavigation())return
    setPendingSong(undefined)
    history.pushState({bicBook:next},'',location.href)
    generation.current++;setSongs([]);setBook(next)
  }
  function openShared(list:SharedSetlist) {
    if(!allowNavigation())return
    history.pushState({bicBook:'home',bicShared:list.id},'',location.href)
    setSharedList(list)
  }
  function backToBooks() {
    history.go(history.state?.bicSong ? -2 : -1)
  }
  const exitPressed=useRef(0)
  const historyInitialized=useRef(false)
  useEffect(()=>{
    if(!historyInitialized.current){historyInitialized.current=true;history.replaceState({bicExitGuard:true},'',location.href);history.pushState({bicBook:'home'},'',location.href)}
    const back=(event:PopStateEvent)=>{
      const state=event.state??{}
      if(state.bicExitGuard){
        if(Date.now()-exitPressed.current<2500){history.back();return}
        exitPressed.current=Date.now();setNotice('Press Back again to exit.')
        history.pushState({bicBook:bookRef.current},'',location.href)
        return
      }
      if((state.bicBook??'home')!==bookRef.current){generation.current++;setLoading(false);setSongs([])}
      setBook(state.bicBook??'home')
      setSharedList(state.bicShared?sharedListsRef.current.find(list=>list.id===state.bicShared)??null:null)
    }
    window.addEventListener('popstate',back)
    return ()=>window.removeEventListener('popstate',back)
  },[])
  const generation=useRef(0)
  const refreshSerial=useRef(0)
  const activeUser=useRef<string|null>(null)
  useEffect(()=>{
    if(!cloud) {setReady(true);return}
    if(!navigator.onLine){const user=offlineIdentity();if(user){activeUser.current=user.id;setSession({user});setReady(true)}}
    const {data:{subscription}}=cloud!.auth.onAuthStateChange((event,newSession)=>{
      if(!newSession&&!navigator.onLine&&event!=='SIGNED_OUT')return
      const id=newSession?.user.id ?? null
      if(activeUser.current!==id) {generation.current++;setAccounts([]);setShowAccounts(false);setSharedLists([]);setSharedList(null);setPendingSong(undefined);setBook('home');setSongs([]);setRole(null);setOfflineBundle(null);setOfflineStatus('Not saved on this device yet.');setLoading(false);setNotice('');if(activeUser.current&&activeUser.current!==id)void clearOffline(activeUser.current).catch(()=>{});if(!id)forgetIdentity();activeUser.current=id}
      setSession(newSession);setReady(true)
      if(event==='PASSWORD_RECOVERY') setRecovery(true)
    })
    return ()=>subscription.unsubscribe()
  },[])
  async function useSaved(current:number,request:number){
    const userId=session!.user.id
    const saved=await readOffline(userId)
    if(generation.current!==current||request!==refreshSerial.current)return
    setOffline(true)
    if(!usableOffline(saved,userId)){setSongs([]);setRole(null);setNotice('No offline songbooks saved on this device. Connect once and save for offline use.');return}
    setOfflineBundle(saved);setRole(saved.role);setOfflineStatus(`Saved ${new Date(saved.savedAt).toLocaleString()}`)
    if(saved.role==='owner'&&book!=='church'){history.replaceState({bicBook:'church'},'',location.href);setBook('church');return}
    setSongs(book==='personal'?saved.personal:book==='church'?saved.church:[])
    setSharedLists(saved.shared);setSharedList(previous=>previous?saved.shared.find(list=>list.id===previous.id)??null:null)
  }
  async function refresh() {
    if(!cloud || !session)return
    const current=generation.current;const request=++refreshSerial.current;setLoading(true)
    try {
      if(!navigator.onLine){await useSaved(current,request);return}
      const {data,error}=await cloud.from('songbook_members').select('role').eq('user_id',session.user.id).maybeSingle()
      if(error)throw error
      if(generation.current!==current||request!==refreshSerial.current)return
      const next=data?.role??null
      setOffline(false)
      if(!next){await clearOffline(session.user.id);setOfflineBundle(null);setRole(null);setSongs([]);setSharedLists([]);setSharedList(null);setOfflineStatus('Access not approved.');return}
      const [personal,church,folders,lists,favorites,shares]=await Promise.all([
        next==='owner'?Promise.resolve([]):loadSongs(session.user.id),loadSongs(null),
        next==='owner'?Promise.resolve({data:[],error:null}):cloud.from('songbook_folders').select('id,name').eq('owner_id',session.user.id).order('name'),
        next==='owner'?Promise.resolve({data:[],error:null}):cloud.from('songbook_setlists').select('*').eq('owner_id',session.user.id).order('title'),
        cloud.from('songbook_favorites').select('song_id').eq('user_id',session.user.id),
        next==='owner'?Promise.resolve({data:[],error:null}):cloud.from('songbook_setlist_shares').select('id,title,sender_email,songs').eq('recipient_id',session.user.id).order('updated_at',{ascending:false})
      ])
      for(const result of [folders,lists,favorites,shares])if(result.error)throw result.error
      if(generation.current!==current||request!==refreshSerial.current)return
      const bundle:OfflineBundle={userId:session.user.id,role:next,savedAt:new Date().toISOString(),personal,church,folders:folders.data??[],setlists:lists.data??[],favorites:(favorites.data??[]).map(row=>row.song_id),shared:shares.data??[]}
      setOfflineBundle(bundle);setRole(next);setSongs(book==='personal'?personal:book==='church'?church:[]);setSharedLists(bundle.shared);setSharedList(previous=>previous?bundle.shared.find(list=>list.id===previous.id)??null:null)
      try{await saveOffline(bundle);if(generation.current===current&&request===refreshSerial.current){rememberIdentity(session.user);setOfflineBundle(bundle);setOfflineStatus(`Saved ${new Date(bundle.savedAt).toLocaleString()}`)}else if(activeUser.current!==bundle.userId){await clearOffline(bundle.userId)}}catch{setOfflineStatus('Could not save offline data. Device storage may be full or blocked.')}
      if(next==='owner'&&book!=='church'){history.replaceState({bicBook:'church'},'',location.href);setBook('church')}
    } catch(error) {
      if(generation.current!==current||request!==refreshSerial.current)return
      if(!navigator.onLine||/failed to fetch|networkerror|network request failed|load failed/i.test(message(error))){try{await useSaved(current,request)}catch{setNotice('Could not load offline data on this device.')}}
      else setNotice(message(error))
    } finally {if(generation.current===current&&request===refreshSerial.current)setLoading(false)}
  }
  useEffect(()=>{
    void refresh()
    const focus=()=>{if(!navigator.onLine)setOffline(true);void refresh()}
    window.addEventListener('focus',focus);window.addEventListener('online',focus);window.addEventListener('offline',focus)
    return ()=>{window.removeEventListener('focus',focus);window.removeEventListener('online',focus);window.removeEventListener('offline',focus)}
  },[session?.user.id,book])
  useEffect(()=>{
    if(!sharedList||offline)return
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh()},15000)
    return ()=>window.clearInterval(timer)
  },[sharedList?.id,session?.user.id,book,offline])
  async function action(fn:()=>Promise<void>) {
    setBusy(true);setNotice('')
    try {await fn()} catch(error){setNotice(message(error))} finally{setBusy(false)}
  }
  function message(error:unknown) {return error instanceof Error ? error.message : String((error as {message?:string})?.message ?? error)}
  if(!cloud) return <main className="auth-panel"><h1 className="brand"><img src="/bic-logo.png" alt="BIC" />BIC Worship DB</h1><p><a href="/guide.html" target="_blank" rel="noopener">ⓘ First time? Read the user guide</a></p><p>The shared database has not been connected yet.</p><p>Set the Supabase URL and public publishable key, then rebuild the app. See SETUP.md in the source folder.</p></main>
  if(!ready) return <main><p>Loading your account…</p></main>
  if(!session || recovery) return <main className="auth-panel"><h1 className="brand"><img src="/bic-logo.png" alt="BIC" />BIC Worship DB</h1><p><a href="/guide.html" target="_blank" rel="noopener">ⓘ First time? Read the user guide</a></p><p>One songbook for you and your friends.</p>
    <form onSubmit={event=>{event.preventDefault(); void action(async()=>{
      if(recovery) {const {error}=await cloud!.auth.updateUser({password});if(error)throw error;setRecovery(false);setPassword('');setNotice('Password updated.');history.replaceState(history.state,'',location.pathname);return}
      const result=signup ? await cloud!.auth.signUp({email,password,options:{emailRedirectTo:location.origin}}) : await cloud!.auth.signInWithPassword({email,password})
      if(result.error)throw result.error
      setPassword('')
      if(signup && !result.data.session) setNotice('Check your email to confirm your account, then sign in.')
    })}}>
    {!recovery && <label>Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>}
    <label>{recovery ? 'New password' : 'Password'}<input type="password" minLength={signup || recovery ? 12 : undefined} required autoComplete={signup || recovery ? 'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} /></label>
    <button disabled={busy}>{busy ? 'Please wait…' : recovery ? 'Save password' : signup ? 'Create account' : 'Sign in'}</button>
    </form>
    {!recovery && <><button disabled={busy} onClick={()=>void action(async()=>{const {error}=await cloud!.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin}});if(error)throw error})}>Continue with Google</button><button disabled={busy} onClick={()=>{setSignup(!signup);setNotice('')}}>{signup ? 'Already have an account? Sign in' : 'Create an account'}</button>
    <button disabled={busy || !email} onClick={()=>void action(async()=>{const {error}=await cloud!.auth.resetPasswordForEmail(email,{redirectTo:location.origin});if(error)throw error;setNotice('If this account exists, you will receive a password reset email.')})}>Forgot password</button></>}
    <p role="status">{notice}</p><p>New accounts need the owner’s approval before viewing the library.</p>
  </main>
  return <>
    <MenuSection>
    <div className="account-bar"><span>{session.user.email} · {role ?? 'Awaiting access'}</span>
    <button disabled={loading} onClick={()=>void refresh()}>Refresh library</button>
    <button disabled={busy} onClick={()=>void action(async()=>{if(!allowNavigation())return;await clearOffline(session.user.id);forgetIdentity();const {error}=await cloud!.auth.signOut({scope:'local'});if(error&&!offline)throw error;if(offline){localStorage.removeItem('sb-tggcpgfunzaxftbkghbn-auth-token');setSession(null);setRole(null);setSongs([]);setSharedLists([]);setSharedList(null);setOfflineBundle(null)}setRecovery(false)})}>Sign out</button></div>
    {!offline&&(role==='owner'||role==='manager') && <details className="member-panel"><summary>Manage friends’ access</summary><p>Ask your friend to create an account first. Giving access does not send an email.</p>
      <form onSubmit={event=>{event.preventDefault();void action(async()=>{const {error}=await cloud!.rpc('set_songbook_member',{email_address:memberEmail,member_role:memberRole});if(error)throw error;setNotice('Access updated. Your friend can refresh their library.');setMemberEmail('')})}}>
      <label>Friend’s account email<input type="email" required value={memberEmail} onChange={e=>setMemberEmail(e.target.value)}/></label>
      <label>Permission<select value={memberRole} onChange={e=>setMemberRole(e.target.value)}><option value="viewer">View church songs + manage personal songbook</option>{role==='owner'&&<option value="manager">Manager — approve members, no church editing</option>}<option value="remove">Remove access</option></select></label>
      <button disabled={busy}>Update access</button></form>
      <button disabled={busy} onClick={()=>void action(async()=>{if(showAccounts){setShowAccounts(false);return}const {data,error}=await cloud!.rpc('list_songbook_accounts');if(error)throw error;setAccounts(data??[]);setShowAccounts(true)})}>{showAccounts?'Hide registered accounts':'Show registered accounts'}</button>
      {showAccounts&&<div className="account-list"><table><thead><tr><th>Account email</th><th>Access</th></tr></thead><tbody>{accounts.map(account=><tr key={account.email}><td>{account.email}</td><td>{account.member_role==='editor'?'Member (church view only)':account.member_role}</td></tr>)}</tbody></table></div>}
      </details>}
    <details><summary>Offline use</summary><p>{offlineStatus}</p><p>Saved songs, folders, favorites and setlists are available for reading. Offline editing and sharing are disabled. Shared setlists use their last saved version.</p><button disabled={loading||offline} onClick={()=>void refresh()}>Save latest for offline</button><button disabled={busy} onClick={()=>void action(async()=>{await clearOffline(session.user.id);forgetIdentity();setOfflineBundle(null);setOfflineStatus('Offline data removed. Online refresh saves it again.');if(offline){setSongs([]);setRole(null);setSharedLists([]);setSharedList(null)}})}>Clear saved offline data</button></details>
    </MenuSection>
    {offline&&<p className="notice" role="status">Offline · Reading saved copies · {offlineStatus}</p>}
    {notice && <p role="status" className="notice">{notice}</p>}
    {loading && <p className="storage-note">Loading library…</p>}
    {!role && !loading && <main><h1>Welcome!</h1><p>Ask the songbook owner to approve your account’s email address, then press Refresh library.</p></main>}
    {role && role!=='owner' && book==='home' && !sharedList && <main className="songbook-home"><h1 className="brand"><img src="/bic-logo.png" alt="BIC" />BIC Worship DB</h1><p><a href="/guide.html" target="_blank" rel="noopener">ⓘ User guide</a></p><nav aria-label="Home tabs"><button aria-pressed={homeTab==='songbooks'} onClick={()=>setHomeTab('songbooks')}>Songbooks</button><button aria-pressed={homeTab==='friends'} onClick={()=>setHomeTab('friends')}>Friends</button></nav>{homeTab==='friends'?offline?<p>Friend management needs an internet connection.</p>:<FriendPicker ownerId={session.user.id}/>:<><h2>Your songbooks</h2><p>Choose a songbook to visit.</p><div className="songbook-cards">
      <button onClick={()=>{openBook('personal')}}><strong>My songbook</strong><span>Your versions, folders, and personal setlists.</span></button>
      <button onClick={()=>{openBook('church')}}><strong>Bukchon International Chapel</strong><span>Visit the church songbook · Shared with approved members.</span></button>
    </div><h2>Shared with me</h2><button disabled={loading} onClick={()=>void refresh()}>Refresh shared setlists</button>{!sharedLists.length&&<p>No shared setlists yet.</p>}<div className="songbook-cards">{sharedLists.map(list=><button key={list.id} onClick={()=>openShared(list)}><strong>{list.title}</strong><span>From {list.sender_email} · {list.songs.length} songs</span></button>)}</div></>}</main>}
    {sharedList && role && role!=='owner' && <><button onClick={backToBooks}>← Songbooks</button><p>Shared by {sharedList.sender_email} · {offline?'Saved shared setlist · Updates when reconnected':'Live shared setlist · Updates automatically'}</p><button disabled={busy||offline} onClick={()=>void action(async()=>{const {error}=await cloud!.from('songbook_setlist_shares').delete().eq('id',sharedList.id);if(error)throw error;setSharedList(null);await refresh()})}>Remove shared setlist</button>{!offline&&<SaveSharedSetlist key={sharedList.id+'-save'} shareId={sharedList.id} title={sharedList.title} ownerId={session.user.id} onSaved={refresh}/>}<App key={sharedList.id} library={{offline,offlineData:offlineBundle??undefined,sharedSetlist:true,userId:session.user.id,ownerId:null,bookName:sharedList.title,songs:sharedList.songs,canEdit:false,refresh,add:async()=>{throw new Error('Read only')},update:async()=>{throw new Error('Read only')},remove:async()=>{throw new Error('Read only')}}}/></>}

    {role && book!=='home' && <><div className="songbook-location">{role!=='owner'&&<button onClick={backToBooks}>← Songbooks</button>}<strong>{book==='personal'?'My songbook':'Bukchon International Chapel'}</strong></div>
    {<App key={session.user.id+'-'+book} library={{initialSongId:pendingSong,openChurchSong:song=>{openBook('church');setPendingSong(song.id)},offline,offlineData:offlineBundle??undefined,userId:session.user.id,refresh,ownerId:book==='personal'?session.user.id:null,bookName:book==='personal'?'My songbook':'Church songbook',songs,canEdit:!offline&&(book==='personal'||role==='owner'),copyToPersonal:!offline&&book==='church'&&role!=='owner'?async song=>{await insertSongs([{...song,folder_id:null,source_song_id:song.id}],session.user.id)}:undefined,
      add:async rows=>{if(offline||!navigator.onLine)throw new Error('Reconnect before saving songs.');const saved=await insertSongs(rows,book==='personal'?session.user.id:null);setSongs(current=>[...current,...saved]);void refresh();return saved},
      update:async song=>{if(offline||!navigator.onLine)throw new Error('Reconnect before saving songs.');const saved=await updateSong(song);setSongs(current=>current.map(s=>s.id===saved.id?saved:s));void refresh();return saved},
      remove:async song=>{if(offline||!navigator.onLine)throw new Error('Reconnect before deleting songs.');await removeSong(song);setSongs(current=>current.filter(s=>s.id!==song.id));void refresh()}
    }}/>}</>}
  </>
}
