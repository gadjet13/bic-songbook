import { useEffect,useRef } from 'react'
import { registerDraft,allowNavigation,hasUnsavedChanges } from './lib/unsaved'
export default function useUnsavedChanges(dirty:boolean){
 const token=useRef(Symbol('editor'))
 useEffect(()=>{registerDraft(token.current,dirty);return()=>registerDraft(token.current,false)},[dirty])
 useEffect(()=>{
  if(!dirty)return
  const state=history.state,url=location.href
  const unload=(event:BeforeUnloadEvent)=>{if(hasUnsavedChanges()){event.preventDefault();event.returnValue=''}}
  const back=(event:PopStateEvent)=>{if(!allowNavigation()){event.stopImmediatePropagation();history.pushState(state,'',url)}}
  const link=(event:MouseEvent)=>{const target=(event.target as Element).closest?.('a');if(target&&target.target!=='_blank'&&target.href&&!allowNavigation()){event.preventDefault();event.stopImmediatePropagation()}}
  window.addEventListener('beforeunload',unload);window.addEventListener('popstate',back,true);document.addEventListener('click',link,true)
  return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('popstate',back,true);document.removeEventListener('click',link,true)}
 },[dirty])
}
