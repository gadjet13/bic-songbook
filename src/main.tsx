import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SharedApp from './SharedApp'
import ThemePreference from './ThemePreference'

createRoot(document.getElementById('root')!).render(
  <StrictMode><ThemePreference><SharedApp /></ThemePreference></StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Recheck on each launch, including installed-app launches, to recover
    // clients controlled by an older worker without deleting song storage.
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(() => console.warn('Offline support unavailable'))
  })
}
