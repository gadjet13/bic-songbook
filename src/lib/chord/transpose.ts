const SHARP_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const FLAT_NOTES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
const ENHARMONIC: Record<string, string> = { Db:'C#', Eb:'D#', Gb:'F#', Ab:'G#', Bb:'A#' }

function transposeNote(note: string, semitones: number, useFlats: boolean): string {
  const normalizedNote = ENHARMONIC[note] ?? note
  const index = SHARP_NOTES.indexOf(normalizedNote)
  if (index === -1) return note
  const newIndex = ((index + semitones) % 12 + 12) % 12
  return useFlats ? FLAT_NOTES[newIndex] : SHARP_NOTES[newIndex]
}

export function transposeChord(chord: string, semitones: number, useFlats = false): string {
  const match = chord.match(/^([A-G](?:#|b)?)([^/]*?)(?:\/([A-G](?:#|b)?))?$/)
  if (!match) return chord
  const [, root, quality, bass] = match
  const newRoot = transposeNote(root, semitones, useFlats)
  const newBass = bass ? transposeNote(bass, semitones, useFlats) : null
  return newBass ? `${newRoot}${quality}/${newBass}` : `${newRoot}${quality}`
}
