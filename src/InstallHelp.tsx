import { useEffect, useState } from 'react'
type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
export function InstallHelp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [help, setHelp] = useState(false)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches)
  useEffect(() => {
    const ready = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt) }
    const done = () => { setInstalled(true); setPrompt(null) }
    window.addEventListener('beforeinstallprompt', ready)
    window.addEventListener('appinstalled', done)
    return () => { window.removeEventListener('beforeinstallprompt', ready); window.removeEventListener('appinstalled', done) }
  }, [])
  if (installed) return <p className="storage-note">Your pocket songbook</p>
  return <><button className="install-button" onClick={async () => {
    if (prompt) { await prompt.prompt(); await prompt.userChoice; setPrompt(null) }
    else setHelp(!help)
  }}>Install on your phone</button>{help && <p className="install-help">iPhone/iPad: open in Safari → Share → Add to Home Screen. Android: open in Chrome → menu → Install app / Add to Home screen. Open the app online once before using it offline.</p>}</>
}
