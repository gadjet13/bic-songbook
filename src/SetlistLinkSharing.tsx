import { useEffect, useRef, useState } from 'react'
import { cloud } from './lib/cloud'
import { setlistLink } from './lib/setlist-links'

async function manage(listId:string, operation:'status'|'enable'|'disable'){
  const {data,error}=await cloud!.rpc('manage_setlist_link',{target:listId,operation})
  if(error)throw error
  return data as string|null
}

export function useSetlistLink(listId:string|null, newLink:Promise<string|null>|null){
  const [status,setStatus]=useState<{id:string;token:string|null;busy:boolean;notice:string}|null>(null)
  const current=status?.id===listId?status:null
  const linkField=useRef<HTMLInputElement>(null)
  const activeId=useRef(listId)
  activeId.current=listId

  useEffect(()=>{
    if(!listId)return
    let active=true
    const request=newLink??manage(listId,'status')
    setStatus({id:listId,token:null,busy:true,notice:''})
    void request.then(token=>{
      if(active)setStatus({id:listId,token,busy:false,notice:''})
    }).catch(error=>{
      if(active)setStatus({id:listId,token:null,busy:false,notice:newLink
        ? 'Set saved. The link could not be created. Choose Copy setlist link to retry.'
        : String(error.message)})
    })
    return ()=>{active=false}
  },[listId,newLink])

  async function copyLink(){
    if(!listId||!current||current.busy)return
    setStatus({...current,busy:true,notice:''})
    try{
      const next=await manage(listId,'enable')
      if(activeId.current!==listId)return
      if(!next)throw new Error('Could not create the setlist link.')
      let notice='Setlist link copied.'
      try{await navigator.clipboard.writeText(setlistLink(next))}
      catch{notice='Select and copy the setlist link below.';requestAnimationFrame(()=>linkField.current?.select())}
      if(activeId.current===listId)setStatus({id:listId,token:next,busy:false,notice})
    }catch(error){
      if(activeId.current===listId)setStatus({...current,busy:false,notice:(error as Error).message})
    }
  }

  async function disableLink(){
    if(!listId||!current||current.busy||!window.confirm('Turn off this link and remove access for people who joined through it? Email invitations will still work.'))return
    setStatus({...current,busy:true,notice:''})
    try{
      await manage(listId,'disable')
      if(activeId.current===listId)setStatus({id:listId,token:null,busy:false,notice:'Setlist link turned off.'})
    }catch(error){
      if(activeId.current===listId)setStatus({...current,busy:false,notice:(error as Error).message})
    }
  }
  return {token:current?.token??null,busy:!current||current.busy,notice:current?.notice??'',linkField,copyLink,disableLink}
}

export function createSetlistLink(listId:string){
  const request=manage(listId,'enable')
  // The saved set mounts the link controls on the next render.
  void request.catch(()=>{})
  return request
}

export default function SetlistLinkSharing({link}:{link:ReturnType<typeof useSetlistLink>}){
  return <section className="setlist-quick-share" aria-label="Share by link">
    <button type="button" className="worship-primary" disabled={link.busy} onClick={()=>void link.copyLink()}>Copy setlist link</button>
    {link.token&&<label>Setlist link<input ref={link.linkField} readOnly value={setlistLink(link.token)}
      onFocus={event=>event.currentTarget.select()}/></label>}
    {link.notice&&<p role="status">{link.notice}</p>}
  </section>
}
