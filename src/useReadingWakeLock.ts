import { useEffect,useState } from 'react'
import { wakeController } from './lib/wake-lock'
export default function useReadingWakeLock(active:boolean){
 const [status,setStatus]=useState('')
 useEffect(()=>{if(!active){setStatus('');return}if(!('wakeLock' in navigator)){setStatus('Screen lock not supported on this browser');return}const controller=wakeController(()=>navigator.wakeLock.request('screen'),()=>document.visibilityState==='visible',setStatus);void controller.acquire();const focus=()=>void controller.acquire();document.addEventListener('visibilitychange',focus);window.addEventListener('focus',focus);return()=>{controller.stop();document.removeEventListener('visibilitychange',focus);window.removeEventListener('focus',focus)}},[active])
 return status
}
