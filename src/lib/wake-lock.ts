export type ScreenLock={released:boolean;release:()=>Promise<void>;addEventListener:(type:string,handler:()=>void)=>void}
export function wakeController(request:()=>Promise<ScreenLock>,visible:()=>boolean,notify:(message:string)=>void){
 let active=true,lock:ScreenLock|null=null,pending=false
 async function acquire(){if(!active||!visible()||pending||(lock&&!lock.released))return;pending=true;try{const next=await request();if(!active||!visible()){await next.release();return}lock=next;notify('Screen kept awake');next.addEventListener('release',()=>{if(lock===next){lock=null;if(active)notify('Screen lock released — device may dim')}})}catch{if(active)notify('Screen lock unavailable — check device auto-lock')}finally{pending=false}}
 function stop(){active=false;if(lock)void lock.release().catch(()=>{});lock=null}
 return {acquire,stop}
}
