import { loginPersistence } from './login-storage'
import type { Song } from '../App'
import type {LibraryDates} from './library-sort'
export type OfflineList=LibraryDates&{id:string;title:string;song_ids:number[];revision:number}
export type OfflineShared={id:string;title:string;sender_email:string;songs:Song[]}
export type OfflineBundle={userId:string;role:string;savedAt:string;personal:Song[];church:Song[];folders:(LibraryDates&{id:string;name:string})[];setlists:OfflineList[];favorites:number[];shared:OfflineShared[]}
const dbName='bic-worship-offline-v1'
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(dbName,1);request.onupgradeneeded=()=>request.result.createObjectStore('accounts',{keyPath:'userId'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function transaction<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest):Promise<T>{const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('accounts',mode);const request=action(tx.objectStore('accounts'));let value:T;request.onsuccess=()=>{value=request.result};tx.oncomplete=()=>{db.close();resolve(value)};tx.onerror=()=>{db.close();reject(tx.error)};tx.onabort=()=>{db.close();reject(tx.error??new Error('Offline save was interrupted'))}})}
export const readOffline=(userId:string)=>transaction<OfflineBundle|undefined>('readonly',store=>store.get(userId))
function changed(){if(typeof window!=='undefined')window.dispatchEvent(new Event('songbook-offline-changed'))}
export const saveOffline=async(bundle:OfflineBundle)=>{await transaction<void>('readwrite',store=>store.put(bundle));changed()}
export const clearOffline=async(userId:string)=>{await transaction<void>('readwrite',store=>store.delete(userId));changed()}
export function usableOffline(bundle:OfflineBundle|undefined,userId:string):bundle is OfflineBundle{return !!bundle&&bundle.userId===userId&&!!bundle.role&&Array.isArray(bundle.personal)&&Array.isArray(bundle.church)}
export function rememberIdentity(user:{id:string;email?:string}){loginPersistence.storage.setItem('bic-offline-identity',JSON.stringify({id:user.id,email:user.email}));changed()}
export function offlineIdentity():{id:string;email?:string}|null{try{const user=JSON.parse(loginPersistence.storage.getItem('bic-offline-identity')??'null');return user&&typeof user.id==='string'?user:null}catch{return null}}
export function forgetIdentity(){loginPersistence.storage.removeItem('bic-offline-identity');changed()}

