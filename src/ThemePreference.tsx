import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { InstallHelp } from './InstallHelp'

export function MenuSection({children}: {children: ReactNode}) {
  const [target,setTarget]=useState<HTMLElement|null>(null)
  useEffect(()=>{setTarget(document.getElementById('songbook-menu-content'))},[])
  return target ? createPortal(children,target) : null
}

type Preference = 'system' | 'light' | 'dark'
const storageKey = 'bic-songbook-theme'
function initialPreference(): Preference {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* Use the device preference if storage is unavailable. */ }
  return 'system'
}

export default function ThemePreference({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<Preference>(initialPreference)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme = preference === 'system'
        ? media.matches ? 'dark' : 'light' : preference
    }
    apply()
    try { localStorage.setItem(storageKey, preference) } catch { /* Keep working without persistence. */ }
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preference])
  return <>
    <header className="site-header">
    <div className="site-header-inner">
    <div className="site-brand"><img src="/bic-logo.png" alt="" />BIC Songbook</div>
    <details className="settings-menu">
    <summary><span aria-hidden="true">☰</span> Menu</summary>
    <div id="songbook-menu-content">
    <div className="theme-toolbar">
      <label htmlFor="theme-preference">Appearance</label>
      <select id="theme-preference" value={preference} onChange={event => setPreference(event.target.value as Preference)}>
        <option value="system">Use device setting</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
    <div className="menu-install"><InstallHelp /><p><a href="/start-guide.html" target="_blank" rel="noopener">Start here — illustrated guide</a></p><p><a href="/guide.html" target="_blank" rel="noopener">User guide / README</a></p><p><a href="/privacy.html">Privacy policy</a></p></div>
    </div>
    </details>
    </div>
    </header>
    {children}
  </>
}

