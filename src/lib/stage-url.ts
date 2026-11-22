export function stageView(search = location.search) {
  const params = new URLSearchParams(search)
  if (params.get('view') !== 'stage') return null
  const song = params.get('song')
  return { song: song && /^[1-9]\d*-[1-9]\d*$/.test(song) ? song : null }
}

export function stageSearch(search = location.search) {
  return stageView(search) ? search : ''
}

const sharedStageKey = 'bic-shared-stage-return'

export function rememberSharedStageSearch() {
  try { sessionStorage.setItem(sharedStageKey, stageSearch()) } catch { /* Storage is optional. */ }
}

export function takeSharedStageSearch() {
  try {
    const search = sessionStorage.getItem(sharedStageKey)
    sessionStorage.removeItem(sharedStageKey)
    return stageSearch(search ?? '')
  } catch { return '' }
}
