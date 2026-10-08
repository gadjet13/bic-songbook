import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import App from './App'
import { MenuSection } from './ThemePreference'
import { cloud, loadSongs, insertSongs, updateSong, removeSong } from './lib/cloud'
import type { CloudSong } from './lib/cloud'

export default function SharedApp() {
  const [session,setSession]=useState<Session|null>(null)
  const [ready,setReady]=useState(false)
  const [role,setRole]=useState<string|null>(null)
  const [book,setBook]=useState<'home'|'personal'|'church'>('home')
  const [songs,setSongs]=useState<CloudSong[]>([])
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [signup,setSignup]=useState(false)
  const [recovery,setRecovery]=useState(false)
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(false)
  const [accounts,setAccounts]=useState<{email:string;member_role:string}[]>([])
  const [memberEmail,setMemberEmail]=useState('')
  const [memberRole,setMemberRole]=useState('viewer')
  const generation=useRef(0)
  const activeUser=useRef<string|null>(null)
  useEffect(()=>{
    if(!cloud) {setReady(true);return}
    const {data:{subscription}}=cloud!.auth.onAuthStateChange((event,newSession)=>{
      const id=newSession?.user.id ?? null
      if(activeUser.current!==id) {generation.current++;setAccounts([]);setBook('home');setSongs([]);setRole(null);setLoading(false);setNotice('');activeUser.current=id}
      setSession(newSession);setReady(true)
      if(event==='PASSWORD_RECOVERY') setRecovery(true)
    })
    return ()=>subscription.unsubscribe()
  },[])
  async function refresh() {
    if(!cloud || !session) return
    const current=generation.current
    setLoading(true)
    try {
      const {data,error}=await cloud.from('songbook_members').select('role').eq('user_id',session.user.id).maybeSingle()
      if(error) throw error
      const next=data?.role ?? null
      if(next==='owner' && book!=='church'){setRole(next);setBook('church');return}
      const rows=next && book!=='home' ? await loadSongs(book==='personal'?session.user.id:null) : []
      if(generation.current!==current) return
      setRole(next);setSongs(rows)
    } catch(error) {
      if(generation.current===current) setNotice(message(error))
    } finally {if(generation.current===current) setLoading(false)}
  }
  useEffect(()=>{
    void refresh()
    const focus=()=>{void refresh()}
    window.addEventListener('focus',focus)
    return ()=>window.removeEventListener('focus',focus)
  },[session?.user.id,book])
  async function action(fn:()=>Promise<void>) {
    setBusy(true);setNotice('')
    try {await fn()} catch(error){setNotice(message(error))} finally{setBusy(false)}
  }
  function message(error:unknown) {return error instanceof Error ? error.message : String((error as {message?:string})?.message ?? error)}
  if(!cloud) return <main className="auth-panel"><h1>Pocket Songbook</h1><p>The shared database has not been connected yet.</p><p>Set the Supabase URL and public publishable key, then rebuild the app. See SETUP.md in the source folder.</p></main>
  if(!ready) return <main><p>Loading your account…</p></main>
  if(!session || recovery) return <main className="auth-panel"><h1>Pocket Songbook</h1><p>One songbook for you and your friends.</p>
    <form onSubmit={event=>{event.preventDefault(); void action(async()=>{
      if(recovery) {const {error}=await cloud!.auth.updateUser({password});if(error)throw error;setRecovery(false);setPassword('');setNotice('Password updated.');history.replaceState(null,'',location.pathname);return}
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
    <button disabled={busy} onClick={()=>void action(async()=>{const {error}=await cloud!.auth.signOut();if(error)throw error;setRecovery(false)})}>Sign out</button></div>
    {(role==='owner'||role==='manager') && <details className="member-panel"><summary>Manage friends’ access</summary><p>Ask your friend to create an account first. Giving access does not send an email.</p>
      <form onSubmit={event=>{event.preventDefault();void action(async()=>{const {error}=await cloud!.rpc('set_songbook_member',{email_address:memberEmail,member_role:memberRole});if(error)throw error;setNotice('Access updated. Your friend can refresh their library.');setMemberEmail('')})}}>
      <label>Friend’s account email<input type="email" required value={memberEmail} onChange={e=>setMemberEmail(e.target.value)}/></label>
      <label>Permission<select value={memberRole} onChange={e=>setMemberRole(e.target.value)}><option value="viewer">View church songs + manage personal songbook</option>{role==='owner'&&<option value="manager">Manager — approve members, no church editing</option>}<option value="remove">Remove access</option></select></label>
      <button disabled={busy}>Update access</button></form>
      <button disabled={busy} onClick={()=>void action(async()=>{const {data,error}=await cloud!.rpc('list_songbook_accounts');if(error)throw error;setAccounts(data??[])})}>Show registered accounts</button>
      {!!accounts.length&&<div className="account-list"><table><thead><tr><th>Account email</th><th>Access</th></tr></thead><tbody>{accounts.map(account=><tr key={account.email}><td>{account.email}</td><td>{account.member_role==='editor'?'Member (church view only)':account.member_role}</td></tr>)}</tbody></table></div>}
      </details>}
    </MenuSection>
    {notice && <p role="status" className="notice">{notice}</p>}
    {loading && <p className="storage-note">Loading library…</p>}
    {!role && !loading && <main><h1>Welcome!</h1><p>Ask the songbook owner to approve your account’s email address, then press Refresh library.</p></main>}
    {role && role!=='owner' && book==='home' && <main className="songbook-home"><h1>Your songbooks</h1><p>Choose a songbook to visit.</p><div className="songbook-cards">
      <button onClick={()=>{generation.current++;setSongs([]);setBook('personal')}}><strong>My songbook</strong><span>Your versions, folders, and personal setlists.</span></button>
      <button onClick={()=>{generation.current++;setSongs([]);setBook('church')}}><strong>Bukchon International Chapel</strong><span>Visit the church songbook · Shared with approved members.</span></button>
    </div></main>}
    {role && book!=='home' && <><div className="songbook-location">{role!=='owner'&&<button onClick={()=>{generation.current++;setSongs([]);setBook('home')}}>← Songbooks</button>}<strong>{book==='personal'?'My songbook':'Bukchon International Chapel'}</strong></div>
    {<App key={session.user.id+'-'+book} library={{userId:session.user.id,refresh,ownerId:book==='personal'?session.user.id:null,bookName:book==='personal'?'My songbook':'Church songbook',songs,canEdit:book==='personal'||role==='owner',copyToPersonal:book==='church'&&role!=='owner'?async song=>{await insertSongs([{...song,folder_id:null,source_song_id:song.id}],session.user.id)}:undefined,
      add:async rows=>{const saved=await insertSongs(rows,book==='personal'?session.user.id:null);setSongs(current=>[...current,...saved]);return saved},
      update:async song=>{const saved=await updateSong(song);setSongs(current=>current.map(s=>s.id===saved.id?saved:s));return saved},
      remove:async song=>{await removeSong(song);setSongs(current=>current.filter(s=>s.id!==song.id))}
    }}/>}</>}
  </>
}
