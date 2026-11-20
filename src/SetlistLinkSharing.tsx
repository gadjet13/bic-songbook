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
  const [status,setStatus]=useState<{id:string;token:string|null;busy:boolean;notice:string;resolved:boolean}|null>(null)
  const current=status?.id===listId?status:null
  const activeId=useRef(listId)
  activeId.current=listId

  useEffect(()=>{
    if(!listId)return
    let active=true
    const request=loadSetlistLink(listId)
    setStatus({id:listId,token:null,busy:true,notice:'',resolved:false})
    void request.then(token=>{
      if(active)setStatus({id:listId,token,busy:false,notice:'',resolved:true})
    }).catch(error=>{
      if(active)setStatus({id:listId,token:null,busy:false,notice:String(error.message),resolved:false})
    })
    return ()=>{active=false}
  },[listId])

  async function changeLink(operation: 'enable' | 'disable') {
    if (!listId || !current || current.busy) return
    if (operation === 'disable' &&
        !window.confirm('Turn off this link and remove access for people who joined through it?')) return
    setStatus({ ...current, busy: true, notice: '' })
    try {
      const token = await manage(listId, operation)
      if (operation === 'enable' && !token) throw new Error('Could not create the setlist link.')
      if (activeId.current === listId) {
        const notice = operation === 'enable' ? 'Share link created.' : 'Setlist link turned off.'
        setStatus({ id: listId, token, busy: false, notice, resolved: true })
      }
      return true
    } catch (error) {
      if (activeId.current === listId) setStatus({ ...current, busy: false, notice: (error as Error).message })
    }
  }
  return {
    token: current?.token ?? null,
    busy: !current || current.busy,
    resolved: !!current?.resolved && !current.busy,
    notice: current?.notice ?? '',
    enableLink: () => changeLink('enable'),
    disableLink: () => changeLink('disable'),
  }
}

export function loadSetlistLink(listId: string) {
  return manage(listId, 'status')
}

export function createSetlistLink(listId:string){
  return manage(listId,'enable')
}

export function ReaderShareLink({ token, busy, notice, enableLink }: {
  token: string | null
  busy: boolean
  notice: string
  enableLink: () => Promise<unknown>
}) {
  const field = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState<{ token: string; message: string } | null>(null)
  const message = token && copied?.token === token ? copied.message : notice

  async function copy() {
    if (!token) return
    if (await copySetlistLink(token)) {
      field.current?.focus()
      field.current?.select()
      setCopied({ token, message: 'Link selected. Copy it to share.' })
    } else {
      setCopied({ token, message: 'Setlist link copied.' })
    }
  }

  return <div className="reader-share-link">
    {token && <label>Setlist link<input ref={field} readOnly value={setlistLink(token)} /></label>}
    <button type="button" disabled={busy} onClick={() => void (token ? copy() : enableLink())}>
      {token ? 'Copy setlist link' : 'Create share link'}
    </button>
    {message && <p role="status">{message}</p>}
  </div>
}
