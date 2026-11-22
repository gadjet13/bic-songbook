import { stageSearch } from './stage-url.ts'

export type AppRoute = {
  bicBook: 'home' | 'personal' | 'church'
  bicMemberBooks?: boolean
  bicMember?: string
  bicMemberSong?: number
  bicShared?: string
  bicSetlistIndex?: boolean
  bicSetlist?: string
  bicSetlistSong?: number | 'new'
  bicFullSet?: string | true
  bicSong?: number
  bicMode?: 'adding' | 'editing' | 'reading'
  bicRawChart?: string
  bicFullChartEdit?: boolean
  bicFolder?: string
}

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const songId = (key?: string) => key && /^[1-9]\d*$/.test(key) && Number.isSafeInteger(Number(key)) ? Number(key) : null
const rootRoute: AppRoute = { bicBook: 'home' }
const authKey = 'bic-pending-app-route'

export function appPath(route: AppRoute): string {
  if (route.bicMemberBooks) {
    const member = route.bicMember ? `/${route.bicMember}` : ''
    const chart = member && route.bicMemberSong ? `/songs/${route.bicMemberSong}` : ''
    return '/members' + member + chart
  }
  if (route.bicShared && route.bicFullSet) return `/shared/${route.bicShared}/read`
  if (route.bicBook === 'personal' && route.bicSetlist) {
    const base = '/my/setlists/' + route.bicSetlist
    if (route.bicFullSet) return base + '/read' + (route.bicRawChart ? '/edit/' + route.bicRawChart : '')
    if (route.bicSetlistSong) {
      const editor = route.bicSetlistSong === 'new' ? '' : '/edit' + (route.bicFullChartEdit ? '/full' : '')
      return base + '/songs/' + route.bicSetlistSong + editor
    }
    return base + (route.bicSetlist === 'new' ? '' : '/edit')
  }
  const book = route.bicShared ? `/shared/${route.bicShared}` : route.bicBook === 'personal' ? '/my' : route.bicBook === 'church' ? '/church' : ''
  if (!book) return '/'
  if (route.bicSong) {
    const base = `${book}/songs/${route.bicSong}`
    if (route.bicMode === 'reading') return base + '/read' + (route.bicRawChart ? '/edit' : '')
    if (route.bicMode === 'editing') return base + '/edit' + (route.bicFullChartEdit ? '/full' : '')
    return base
  }
  if (route.bicMode === 'adding') return book + '/songs/new'
  if (route.bicSetlistIndex && route.bicBook === 'personal') return '/my/setlists'
  return book + (route.bicFolder && route.bicFolder !== 'all' ? '/folders/' + route.bicFolder : '')
}

export function parseAppPath(pathname: string): AppRoute | null {
  const normalized = pathname.replace(/\/$/, '') || '/'
  if (normalized === '/') return rootRoute
  const [base, section, id, step, target, action, editorStep] = normalized.slice(1).split('/')
  let route: AppRoute
  if (base === 'members') {
    route = { ...rootRoute, bicMemberBooks: true }
    if (section && uuid.test(section)) route.bicMember = section
    if (id === 'songs' && songId(step)) route.bicMemberSong = songId(step)!
  } else if (base === 'shared' && uuid.test(section ?? '')) {
    route = { ...rootRoute, bicShared: section }
    if (id === 'read') route.bicFullSet = true
    if (id === 'songs' && songId(step)) {
      route.bicSong = songId(step)!
      if (target === 'read') route.bicMode = 'reading'
    }
  } else if (base === 'my' || base === 'church') {
    route = { bicBook: base === 'my' ? 'personal' : 'church' }
    if (section === 'folders' && (uuid.test(id ?? '') || id === 'unfiled')) route.bicFolder = id
    if (section === 'setlists' && base === 'my') {
      route.bicSetlistIndex = true
      if (id === 'new' || uuid.test(id ?? '')) {
        route.bicSetlist = id
        if (step === 'read' && id !== 'new') {
          route.bicFullSet = id
          if (target === 'edit' && /^[1-9]\d*-[1-9]\d*$/.test(action ?? '')) route.bicRawChart = action
        }
        if (step === 'songs' && (target === 'new' || songId(target))) {
          route.bicSetlistSong = target === 'new' ? target : songId(target)!
          if (editorStep === 'full' && target !== 'new') route.bicFullChartEdit = true
        }
      }
    }
    if (section === 'songs') {
      if (id === 'new') route.bicMode = 'adding'
      else if (songId(id)) {
        route.bicSong = songId(id)!
        if (step === 'edit') {
          route.bicMode = 'editing'
          if (target === 'full') route.bicFullChartEdit = true
        } else if (step === 'read') {
          route.bicMode = 'reading'
          if (target === 'edit') route.bicRawChart = String(route.bicSong)
        }
      }
    }
  } else return null
  return appPath(route) === normalized ? route : null
}

export function writeAppRoute(state: AppRoute, replace = false) {
  const current = history.state
  const derivedPath = appPath(state)
  // Keep the capability URL on the reader entry as long as the user stays in it.
  const path = derivedPath === appPath(current ?? rootRoute) && location.pathname.startsWith('/setlists/')
    ? location.pathname : derivedPath + (location.hash.startsWith('#song=') ? location.hash : '')
  if (replace) history.replaceState(state, '', path)
  else history.pushState(state, '', path)
}

function parent(route: AppRoute): AppRoute | null {
  const next = { ...route }
  if (next.bicRawChart) delete next.bicRawChart
  else if (next.bicFullChartEdit) delete next.bicFullChartEdit
  else if (next.bicSetlistSong) delete next.bicSetlistSong
  else if (next.bicFullSet) {
    delete next.bicFullSet
    delete next.bicSetlist
  }
  else if (next.bicMode) delete next.bicMode
  else if (next.bicSong) delete next.bicSong
  else if (next.bicSetlist) delete next.bicSetlist
  else if (next.bicSetlistIndex) delete next.bicSetlistIndex
  else if (next.bicFolder) delete next.bicFolder
  else if (next.bicMemberSong) delete next.bicMemberSong
  else if (next.bicMember) delete next.bicMember
  else if (next.bicMemberBooks || next.bicShared || next.bicBook !== 'home') return rootRoute
  else return null
  return next
}

export function initializeAppRoute() {
  let pathname = location.pathname
  let search = stageSearch()
  try {
    const pending = sessionStorage.getItem(authKey)
    sessionStorage.removeItem(authKey)
    if (pathname === '/' && pending) {
      const address = new URL(pending, location.origin)
      pathname = address.pathname
      search = stageSearch(address.search)
    }
  } catch { /* The page URL still works without session storage. */ }
  const route = parseAppPath(pathname)
  if (!route || pathname === '/') return false
  if (history.state?.bicBook && appPath(history.state) === appPath(route)) return true
  const chain: AppRoute[] = []
  for (let current: AppRoute | null = route; current; current = parent(current)) chain.unshift(current)
  const incomingSong = location.hash.startsWith('#song=') ? location.hash : ''
  for (const [index, entry] of chain.entries()) {
    if (index === 0) history.replaceState(entry, '', appPath(entry))
    else history.pushState(entry, '', appPath(entry) + (index === chain.length - 1 ? incomingSong : ''))
  }
  if (search) history.replaceState(history.state, '', location.pathname + search + location.hash)
  return true
}

export function rememberAppRoute() {
  if (location.pathname === '/' || !parseAppPath(location.pathname)) return
  try { sessionStorage.setItem(authKey, location.pathname + stageSearch()) } catch { /* Password sign-in can stay on the current page. */ }
}
