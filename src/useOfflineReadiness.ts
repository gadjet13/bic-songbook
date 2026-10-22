import {useEffect,useState} from 'react'
import {offlineIdentity,readOffline} from './lib/offline'
import {loginPersistence} from './lib/login-storage'
import {checkOfflineShell} from './lib/offline-readiness'
import type {OfflineSnapshot} from './lib/offline-readiness'
export default function useOfflineReadiness(userId:string|null){
 const [snapshot,setSnapshot]=useState<OfflineSnapshot|undefined>()
 useEffect(()=>{if(!userId){setSnapshot(undefined);return}let active=true,serial=0
  const load=async()=>{const request=++serial;setSnapshot(previous=>previous?.userId===userId?{...previous,shell:'checking'}:{userId,shell:'checking',identity:false});try{const [bundle,shell]=await Promise.all([readOffline(userId),checkOfflineShell()]);if(active&&request===serial)setSnapshot({userId,bundle,shell:shell?'ready':'unavailable',identity:offlineIdentity()?.id===userId&&loginPersistence.isPersisted('bic-offline-identity')})}catch{if(active&&request===serial)setSnapshot({userId,shell:'unavailable',identity:false,error:'Offline storage could not be checked. Allow site storage and try again.'})}}
  void load();window.addEventListener('songbook-offline-changed',load);window.addEventListener('focus',load)
  navigator.serviceWorker?.addEventListener('controllerchange',load)
  return()=>{active=false;window.removeEventListener('songbook-offline-changed',load);window.removeEventListener('focus',load);navigator.serviceWorker?.removeEventListener('controllerchange',load)}
 },[userId])
 return snapshot?.userId===userId?snapshot:undefined
}
