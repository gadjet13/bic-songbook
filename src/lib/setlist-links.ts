const fragmentPrefix = '#setlist-link='
const pendingKey = 'bic-pending-setlist-link'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function setlistLink(token: string) {
  return location.origin + '/' + fragmentPrefix + token
}

export function pendingSetlistLink() {
  if (location.hash.startsWith(fragmentPrefix)) {
    const token = location.hash.slice(fragmentPrefix.length)
    if (!uuid.test(token)) return null
    try {
      sessionStorage.setItem(pendingKey, token)
      history.replaceState(history.state, '', location.pathname + location.search)
    } catch { /* The link is still available in this page. */ }
    return token
  }
  try { return sessionStorage.getItem(pendingKey) } catch { return null }
}

export function clearSetlistLink() {
  try { sessionStorage.removeItem(pendingKey) } catch { /* Storage can be disabled. */ }
  if (location.hash.startsWith(fragmentPrefix)) {
    history.replaceState(history.state, '', location.pathname + location.search)
  }
}
