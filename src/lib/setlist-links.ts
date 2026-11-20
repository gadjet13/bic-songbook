const fragmentPrefix = '#setlist-link='
const pathPrefix = '/setlists/'
const pendingKey = 'bic-pending-setlist-link'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function setlistTokenFromPath(pathname = location.pathname) {
  if (!pathname.startsWith(pathPrefix)) return null
  const token = pathname.slice(pathPrefix.length).replace(/\/$/, '')
  return uuid.test(token) ? token.toLowerCase() : null
}

export function isSetlistPath(pathname = location.pathname) {
  return pathname.startsWith(pathPrefix)
}

export function setlistLink(token: string) {
  return location.origin + pathPrefix + token.toLowerCase()
}

export function pendingSetlistLink() {
  const pathToken = setlistTokenFromPath()
  if (isSetlistPath() || location.hash.startsWith(fragmentPrefix)) {
    const token = isSetlistPath() ? pathToken : location.hash.slice(fragmentPrefix.length)
    if (!token || !uuid.test(token)) {
      try { sessionStorage.removeItem(pendingKey) } catch { /* Storage can be disabled. */ }
      return null
    }
    try {
      sessionStorage.setItem(pendingKey, token.toLowerCase())
      if (location.hash.startsWith(fragmentPrefix)) {
        history.replaceState(history.state, '', location.pathname + location.search)
      }
    } catch { /* The current address still contains the link. */ }
    return token.toLowerCase()
  }
  try { return sessionStorage.getItem(pendingKey) } catch { return null }
}

export function clearSetlistLink(resetPath = false) {
  try { sessionStorage.removeItem(pendingKey) } catch { /* Storage can be disabled. */ }
  if (resetPath && isSetlistPath()) history.replaceState({ bicBook: 'home' }, '', '/')
  else if (location.hash.startsWith(fragmentPrefix)) {
    history.replaceState(history.state, '', location.pathname + location.search)
  }
}
