import { convertChordSheet } from './chord-sheet'
import { normalizeSectionHeadings } from './chord/transpose'
import { chartKeyLine, explicitChartKey, suggestKeys } from './suggest-key'
import type { SongDraft } from './song-drafts'

export type ChartInputMode = 'chord-sheet' | 'formatted'
type ChartInput = { mode: ChartInputMode; text: string }
export type NewSongInput = ChartInput & {
  title: string
  artist: string
  key: string
  alternate?: ChartInput
}

export const emptyNewSong: NewSongInput = { title: '', artist: '', key: '', mode: 'chord-sheet', text: '' }

export function recoverNewSong(draft: SongDraft): NewSongInput {
  const mode = draft.inputMode ?? (draft.content ? 'formatted' : 'chord-sheet')
  const text = mode === 'formatted' ? draft.content : draft.raw
  const other = mode === 'formatted' ? draft.raw : draft.content
  const alternate = draft.alternateInput ?? (other
    ? { mode: mode === 'formatted' ? 'chord-sheet' as const : 'formatted' as const, text: other }
    : undefined)
  return { mode, text, title: draft.title, artist: draft.artist, key: draft.key, alternate }
}

export function prepareNewSong(input: NewSongInput) {
  const explicitKey = explicitChartKey(input.text)
  const chart = input.mode === 'chord-sheet'
    ? convertChordSheet(explicitKey?input.text.replace(chartKeyLine,''):input.text,input.title)
    : { title: '', content: normalizeSectionHeadings(input.text), warnings: [] }
  const suggestedKey = explicitKey || (suggestKeys(chart.content)[0] ?? '')
  return {
    ...chart,
    title: input.title.trim() || chart.title,
    artist: input.artist.trim(),
    key: input.key.trim() || suggestedKey,
    suggestedTitle: chart.title,
    suggestedKey,
  }
}
