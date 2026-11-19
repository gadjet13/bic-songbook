import { useEffect, useRef, useState } from 'react'
import { cloud } from './lib/cloud'
import { setlistLink } from './lib/setlist-links'

export default function SetlistLinkSharing({ listId }: { listId: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [notice, setNotice] = useState('')
  const linkField = useRef<HTMLInputElement>(null)
  const active = useRef(false)

  async function manage(operation: 'status' | 'enable' | 'disable') {
    const { data, error } = await cloud!.rpc('manage_setlist_link', { target: listId, operation })
    if (error) throw error
    return data as string | null
  }

  useEffect(() => {
    active.current = true
    void manage('status').then(result => {
      if (active.current) setToken(result)
    }).catch(error => {
      if (active.current) setNotice(error.message)
    }).finally(() => { if (active.current) setBusy(false) })
    return () => { active.current = false }
  }, [listId])

  async function copyLink() {
    setBusy(true)
    setNotice('')
    try {
      const next = await manage('enable')
      if (!next || !active.current) return
      setToken(next)
      try {
        await navigator.clipboard.writeText(setlistLink(next))
        setNotice('Setlist link copied.')
      } catch {
        setNotice('Select and copy the setlist link below.')
        requestAnimationFrame(() => linkField.current?.select())
      }
    } catch (error) { setNotice((error as {message: string}).message) }
    finally { if (active.current) setBusy(false) }
  }

  async function disableLink() {
    if (!window.confirm('Turn off this link and remove access for people who joined through it? Email invitations will still work.')) return
    setBusy(true)
    setNotice('')
    try {
      await manage('disable')
      if (!active.current) return
      setToken(null)
      setNotice('Setlist link turned off.')
    } catch (error) { setNotice((error as {message: string}).message) }
    finally { if (active.current) setBusy(false) }
  }

  return <section aria-label="Share by link">
    <p>Anyone with the link and an approved songbook account can open this live set.</p>
    <button type="button" disabled={busy} onClick={()=>void copyLink()}>Copy setlist link</button>
    {token && <>
      <button type="button" disabled={busy} onClick={()=>void disableLink()}>Turn off link</button>
      <label>Setlist link<input ref={linkField} readOnly value={setlistLink(token)} onFocus={event=>event.currentTarget.select()}/></label>
    </>}
    {notice && <p role="status">{notice}</p>}
  </section>
}
