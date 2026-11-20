import { useEffect, useRef, useState } from 'react'
import { cloud } from './lib/cloud'
import { setlistLink } from './lib/setlist-links'

async function manage(listId:string, operation:'status'|'enable'|'disable'){
  const {data,error}=await cloud!.rpc('manage_setlist_link',{target:listId,operation})
  if(error)throw error
  return data as string|null
}

export async function copySetlistLink(token:string|null){
  if(!token)throw new Error('Could not create the setlist link.')
  const url=setlistLink(token)
  try{
    await navigator.clipboard.writeText(url)
    return null
  }catch{
    return url
  }
}

export function useSetlistLink(listId:string|null){
  const [status,setStatus]=useState<{id:string;token:string|null;busy:boolean;notice:string}|null>(null)
  const current=status?.id===listId?status:null
  const activeId=useRef(listId)
  activeId.current=listId

  useEffect(()=>{
    if(!listId)return
    let active=true
    const request=manage(listId,'status')
    setStatus({id:listId,token:null,busy:true,notice:''})
    void request.then(token=>{
      if(active)setStatus({id:listId,token,busy:false,notice:''})
    }).catch(error=>{
      if(active)setStatus({id:listId,token:null,busy:false,notice:String(error.message)})
    })
    return ()=>{active=false}
  },[listId])

  async function disableLink(){
    if(!listId||!current||current.busy||!window.confirm('Turn off this link and remove access for people who joined through it?'))return
    setStatus({...current,busy:true,notice:''})
    try{
      await manage(listId,'disable')
      if(activeId.current===listId)setStatus({id:listId,token:null,busy:false,notice:'Setlist link turned off.'})
      return true
    }catch(error){
      if(activeId.current===listId)setStatus({...current,busy:false,notice:(error as Error).message})
    }
  }
  return {token:current?.token??null,busy:!current||current.busy,notice:current?.notice??'',disableLink}
}

export function createSetlistLink(listId:string){
  return manage(listId,'enable')
}
