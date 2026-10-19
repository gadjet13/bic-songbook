/** Auth persistence is chosen before either password login or an OAuth redirect. */
export function createLoginPersistence(local:()=>Storage,tab:()=>Storage) {
 const preference='bic-remember-me'
 const memory=new Map<string,string>()
 let remembered=true
 const getRememberMe=()=>{try{return local().getItem(preference)!=='false'}catch{return remembered}}
 const selected=()=>getRememberMe()?local():tab()
 const other=()=>getRememberMe()?tab():local()
 const storage={
  getItem(key:string):string|null {if(memory.has(key))return memory.get(key)!;try{return selected().getItem(key)}catch{return null}},
  setItem(key:string,value:string){try{selected().setItem(key,value);memory.delete(key)}catch{memory.set(key,value)}try{other().removeItem(key)}catch{/* unavailable storage */}},
  removeItem(key:string){memory.delete(key);for(const store of [local,tab])try{store().removeItem(key)}catch{/* unavailable storage */}},
 }
 function setRememberMe(value:boolean){remembered=value;try{local().setItem(preference,String(value))}catch{/* session still works in memory */}}
 function canRemember(){const key='bic-storage-check';try{local().setItem(key,'1');local().removeItem(key);return true}catch{return false}}
 return {storage,getRememberMe,setRememberMe,canRemember}
}
export const loginPersistence=createLoginPersistence(()=>window.localStorage,()=>window.sessionStorage)
