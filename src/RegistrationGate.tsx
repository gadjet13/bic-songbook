import {useEffect,useRef,useState} from 'react'
import type {ReactNode} from 'react'
import AccountHandle from './AccountHandle'
import {cloud} from './lib/cloud'
type Profile={handle:string|null;member_role:string|null;request_status:'none'|'pending'|'approved'|'declined'}
export default function RegistrationGate({userId,offline,onRefresh,children}:{userId:string;offline:boolean;onRefresh:()=>Promise<void>;children:ReactNode}){
 const [profile,setProfile]=useState<Profile|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const currentProfile=useRef(profile);currentProfile.current=profile
 const previousRole=useRef<string|null|undefined>(undefined)
 const active=useRef(true),serial=useRef(0),refresh=useRef(onRefresh);refresh.current=onRefresh
 async function load(){const request=++serial.current;const {data,error}=await cloud!.rpc('get_songbook_registration');if(!active.current||request!==serial.current)return;if(error){setError(error.message);return}setProfile(data);setError('');if(previousRole.current!==undefined&&previousRole.current!==data.member_role)void refresh.current();previousRole.current=data.member_role}
 useEffect(()=>{active.current=true;if(!offline)void load();const focus=()=>{if(navigator.onLine)void load()};window.addEventListener('focus',focus);const timer=window.setInterval(()=>{if(navigator.onLine&&document.visibilityState==='visible'&&!currentProfile.current?.member_role)void load()},30000);return()=>{active.current=false;serial.current++;clearInterval(timer);window.removeEventListener('focus',focus)}},[userId,offline])
 async function request(){setBusy(true);setError('');try{const {error}=await cloud!.rpc('request_songbook_access');if(error)throw error;await load()}catch(error){setError((error as Error).message)}finally{setBusy(false)}}
 // An existing saved offline session must remain readable without a profile request.
 if(offline)return <>{children}</>
 if(!profile)return <main className="registration-panel"><p>{error||'Checking your account…'}</p><button disabled={busy} onClick={()=>void load()}>Retry account check</button></main>
 if(profile.member_role==='owner')return <>{children}</>
 if(!profile.handle)return <main className="registration-panel"><h1>Welcome to BIC Worship DB</h1><p>Choose your friend ID before continuing. You can change it later in Menu → My friend ID.</p><AccountHandle key={userId} userId={userId} onboarding onSaved={async()=>{if(!profile.member_role){const {error}=await cloud!.rpc('request_songbook_access');if(error)throw error}await load();await refresh.current()}}/>{error&&<p role="alert">{error}</p>}</main>
 if(profile.member_role)return <>{children}</>
 return <main className="registration-panel"><h1>{profile.request_status==='declined'?'Access request declined':profile.request_status==='pending'?'Awaiting approval':'Request songbook access'}</h1><p>Your friend ID: <strong>@{profile.handle}</strong></p><p>{profile.request_status==='pending'?'Your request is visible to the church account and managers. They can approve access to the songbooks.':profile.request_status==='declined'?'Your login account has been kept, but library access was not approved. Contact a manager if needed, or request again.':'Send a request so the church account or a manager can approve your access.'}</p>{profile.request_status!=='pending'&&<button disabled={busy} onClick={()=>void request()}>{busy?'Sending…':profile.request_status==='declined'?'Request access again':'Request access'}</button>}<button disabled={busy} onClick={async()=>{setBusy(true);try{await load();await refresh.current()}finally{setBusy(false)}}}>Check approval</button>{error&&<p role="alert">{error}</p>}</main>
}
