import { useState } from 'react'
import { transposeChord } from './lib/chord/transpose'
import './App.css'
import { parseSongFile, downloadSongs, makeSongLink, readSongLink } from './lib/sharing'
import { InstallHelp } from './InstallHelp'

export type Song = {
  revision?: number
  id: number
  title: string
  artist: string
  key: string
  category: string
  content: string
}

const NOTES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

const DISPLAY_NOTES = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
]

const FLAT_TO_SHARP: Record<string, string> = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
}

function getCurrentKey(
  originalKey: string,
  semitones: number,
) {
  const normalizedKey =
    FLAT_TO_SHARP[originalKey] ?? originalKey

  const index = NOTES.indexOf(normalizedKey)

  if (index === -1) {
    return originalKey
  }

  return DISPLAY_NOTES[
    (index + semitones + 12) % 12
  ]
}

export type SharedLibrary = {
  songs: Song[]
  canEdit: boolean
  add: (songs: Song[]) => Promise<Song[]>
  update: (song: Song) => Promise<Song>
  remove: (song: Song) => Promise<void>
}
function App({library}: {library: SharedLibrary}) {
  const [notice, setNotice] = useState('')
  const [incoming, setIncoming] = useState<Song | null>(() => readSongLink())
  const songList = library.songs
  const [search, setSearch] = useState('')
  const [selectedSong, setSelectedSong] =
    useState<Song | null>(null)

  const [transpose, setTranspose] = useState(0)

  const [isEditing, setIsEditing] = useState(false)

  const [editedContent, setEditedContent] =
    useState('')

  const [editedTitle, setEditedTitle] =
    useState('')

  const [editedArtist, setEditedArtist] =
    useState('')

  const [editedKey, setEditedKey] =
    useState('')

  const [editedCategory, setEditedCategory] =
    useState('Worship')

  const [isAddingSong, setIsAddingSong] =
    useState(false)

  const [newSongTitle, setNewSongTitle] =
    useState('')

  const [newSongArtist, setNewSongArtist] =
    useState('')

  const [newSongKey, setNewSongKey] =
    useState('C')

  const [newSongCategory, setNewSongCategory] =
    useState('Worship')

  const [newSongContent, setNewSongContent] =
    useState('')

  const changeTranspose = (amount: number) => {
    const next = transpose + amount

    if (next >= 12 || next <= -12) {
      setTranspose(0)
    } else {
      setTranspose(next)
    }
  }

  async function importFile(file?: File) {
    if (!file) return
    try {
      if (file.size > 5_000_000) throw new Error('Please choose a file smaller than 5 MB.')
      const imported = parseSongFile(await file.text())
      await library.add(imported)
      setNotice(`Imported ${imported.length} song(s). Existing songs were kept.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not import this file.') }
  }

  async function shareSong(song: Song) {
    try {
      const url = makeSongLink(song)
      if (url.length > 24000) { downloadSongs([song]); setNotice('This song is long. Send the downloaded song file to your friend.'); return }
      if (navigator.share) { await navigator.share({title: song.title, url}); setNotice('Song shared.'); }
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); setNotice('Song link copied. Send it to a friend.'); }
      else { downloadSongs([song]); setNotice('Send the downloaded song file to your friend.'); }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      downloadSongs([song]); setNotice('Sharing was unavailable. Send the downloaded song file instead.')
    }
  }

  const filteredSongs = songList.filter((song) =>
    `${song.title} ${song.artist} ${song.category}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  const selectSong = (song: Song) => {
    setSelectedSong(song)
    setTranspose(0)

    setEditedTitle(song.title)
    setEditedArtist(song.artist)
    setEditedKey(song.key)
    setEditedCategory(song.category)
    setEditedContent(song.content)

    setIsEditing(false)
  }

  const saveSong = async () => {
    if (!editedTitle.trim()) { setNotice('Please enter a song title.'); return }
    if (!selectedSong) {
      return
    }

    const updatedSong: Song = {
      ...selectedSong,
      title: editedTitle,
      artist: editedArtist,
      key: editedKey,
      category: editedCategory,
      content: editedContent,
    }

    try { setSelectedSong(await library.update(updatedSong)) }
    catch (error) { setNotice(String(error instanceof Error ? error.message : error)); return }
    setIsEditing(false)
  }

  const addSong = async () => {
    if (!newSongTitle.trim()) {
      return
    }

    const newSong: Song = {
      id: Date.now(),
      title: newSongTitle.trim(),
      artist: newSongArtist.trim(),
      key: newSongKey.trim() || 'C',
      category:
        newSongCategory.trim() || 'Worship',
      content: newSongContent,
    }

    try { const [saved] = await library.add([newSong]); setSelectedSong(saved) }
    catch (error) { setNotice(String(error instanceof Error ? error.message : error)); return }
    setTranspose(0)
    setIsAddingSong(false)

    setNewSongTitle('')
    setNewSongArtist('')
    setNewSongKey('C')
    setNewSongCategory('Worship')
    setNewSongContent('')
  }

  const deleteSong = async () => {
    if (!selectedSong) {
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${selectedSong.title}"?`,
    )

    if (!confirmed) {
      return
    }

    try { await library.remove(selectedSong) }
    catch (error) { setNotice(String(error instanceof Error ? error.message : error)); return }
    setSelectedSong(null)
    setIsEditing(false)
  }

  const cancelEditing = () => {
    if (!selectedSong) {
      return
    }

    setEditedTitle(selectedSong.title)
    setEditedArtist(selectedSong.artist)
    setEditedKey(selectedSong.key)
    setEditedCategory(selectedSong.category)
    setEditedContent(selectedSong.content)

    setIsEditing(false)
  }

  return (
    <div className="app">
      <header>
        <h1>🎵 Song Database</h1>
        <p>Your songs, in every key. Wherever you play.</p>
        <InstallHelp />
      </header>

      <main>
        <div className="library-tools">
          <button onClick={() => downloadSongs(songList)}>Export backup</button>
          <label className="import-label" hidden={!library.canEdit}>Import songs<input type="file" accept=".json,application/json" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = '' }} /></label>
        </div>
        <p className="storage-note">Shared library · Changes save online. Export a backup whenever you need one.</p>
        {notice && <p role="status" className="notice">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></p>}
        {incoming && <section className="incoming"><h2>A friend shared “{incoming.title}”</h2><p>{incoming.artist} · Key: {incoming.key}</p><button disabled={!library.canEdit} onClick={async () => { try { const [song] = await library.add([incoming]); selectSong(song); setIncoming(null); history.replaceState(null, '', location.pathname + location.search) } catch (error) { setNotice(String(error instanceof Error ? error.message : error)) } }}>Add to shared library</button><button onClick={() => {setIncoming(null); history.replaceState(null, '', location.pathname + location.search)}}>Dismiss</button></section>}

        {!selectedSong ? (
          isAddingSong ? (
            <div className="add-song-form">
              <h2>Add New Song</h2>

              <label>
                Song Title
                <input
                  type="text"
                  placeholder="Amazing Grace"
                  value={newSongTitle}
                  onChange={(event) =>
                    setNewSongTitle(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Artist
                <input
                  type="text"
                  placeholder="Traditional"
                  value={newSongArtist}
                  onChange={(event) =>
                    setNewSongArtist(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Original Key
                <input
                  type="text"
                  placeholder="C"
                  value={newSongKey}
                  onChange={(event) =>
                    setNewSongKey(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Category
                <input
                  type="text"
                  placeholder="Worship"
                  value={newSongCategory}
                  onChange={(event) =>
                    setNewSongCategory(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Song Content

                <textarea
                  className="song-editor"
                  placeholder={`# Verse 1
[G]Amazing grace, [D]how sweet the sound

# Chorus
[C]Amazing grace`}
                  value={newSongContent}
                  onChange={(event) =>
                    setNewSongContent(
                      event.target.value,
                    )
                  }
                />

                <small className="editor-help">
                  Use <strong># </strong> for section
                  headings, such as{' '}
                  <strong># Verse 1</strong> or{' '}
                  <strong># Chorus</strong>.
                </small>
              </label>

              <div className="edit-buttons">
                <button
                  className="save-button"
                  onClick={addSong}
                >
                  Save Song
                </button>

                <button
                  className="cancel-button"
                  onClick={() =>
                    setIsAddingSong(false)
                  }
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <input
                type="text"
                aria-label="Search songs"
                placeholder="Search songs..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />

              <button
                hidden={!library.canEdit}
                className="add-song-button"
                onClick={() =>
                  setIsAddingSong(true)
                }
              >
                + Add Song
              </button>

              {filteredSongs.length === 0 && <p>No songs found. Try another search or add a song.</p>}
              <div className="song-list">
                {filteredSongs.map((song) => (
                  <button
                    key={song.id}
                    className="song-item"
                    onClick={() =>
                      selectSong(song)
                    }
                  >
                    <strong>
                      {song.title}
                    </strong>

                    <span>
                      {song.artist} ·{' '}
                      {song.category} · Key:{' '}
                      {song.key}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )
        ) : (
          <div className="song-view">
            <button
              className="back-button"
              onClick={() => {
                setSelectedSong(null)
                setIsEditing(false)
              }}
            >
              ← Back to songs
            </button>

            <h2>{selectedSong.title}</h2>

            <p>{selectedSong.artist}</p>

            <p className="song-category">
              {selectedSong.category}
            </p>

            <p>
              Original Key: {selectedSong.key} ·
              Current Key:{' '}
              {getCurrentKey(
                selectedSong.key,
                transpose,
              )}
            </p>

            {isEditing ? (
              <>
                <label>
                  Song Title

                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(event) =>
                      setEditedTitle(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  Artist

                  <input
                    type="text"
                    value={editedArtist}
                    onChange={(event) =>
                      setEditedArtist(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  Original Key

                  <input
                    type="text"
                    value={editedKey}
                    onChange={(event) =>
                      setEditedKey(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  Category

                  <input
                    type="text"
                    value={editedCategory}
                    onChange={(event) =>
                      setEditedCategory(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  Song Content

                  <textarea
                    className="song-editor"
                    value={editedContent}
                    onChange={(event) =>
                      setEditedContent(
                        event.target.value,
                      )
                    }
                  />

                  <small className="editor-help">
                    Use <strong># </strong> for section
                    headings, such as{' '}
                    <strong># Verse 1</strong>,{' '}
                    <strong># Chorus</strong>,{' '}
                    <strong># Bridge</strong>, etc.
                  </small>
                </label>

                <div className="edit-buttons">
                  <button
                    className="save-button"
                    onClick={saveSong}
                  >
                    Save Changes
                  </button>

                  <button
                    className="cancel-button"
                    onClick={cancelEditing}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="song-actions">
                <button onClick={() => void shareSong(selectedSong)}>Share Song</button>
                <button onClick={() => window.print()}>Print</button>
                <button
                  hidden={!library.canEdit}
                  className="edit-button"
                  onClick={() =>
                    setIsEditing(true)
                  }
                >
                  Edit Song
                </button>

                <button
                  hidden={!library.canEdit}
                  className="delete-button"
                  onClick={deleteSong}
                >
                  Delete Song
                </button>
              </div>
            )}

            <div className="transpose">
              <button
                onClick={() =>
                  changeTranspose(-1)
                }
              >
                −
              </button>

              <span>
                Transpose:{' '}
                {transpose > 0 ? '+' : ''}
                {transpose}
              </span>

              <button
                onClick={() =>
                  changeTranspose(1)
                }
              >
                +
              </button>
            </div>

            {!isEditing && (
              <div className="song-display">
                {displaySong(
                  selectedSong.content,
                  transpose,
                  getCurrentKey(
                    selectedSong.key,
                    transpose,
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function displaySong(
  content: string,
  transpose: number,
  currentKey: string,
) {
  const useFlats = currentKey.includes('b')

  return content
    .split('\n')
    .map((line, lineIndex) => {
      const trimmedLine = line.trim()

      if (trimmedLine.startsWith('# ')) {
        return (
          <div
            className="song-section"
            key={lineIndex}
          >
            {trimmedLine.slice(2)}
          </div>
        )
      }

      const segments = parseLine(
        line,
        transpose,
        useFlats,
      )

      return (
        <div
          className="song-line"
          key={lineIndex}
        >
          {segments.map(
            (segment, segmentIndex) => (
              <span
                className="song-segment"
                key={segmentIndex}
              >
                <span className="chord">
                  {segment.chord}
                </span>

                <span className="lyrics">
                  {segment.lyrics}
                </span>
              </span>
            ),
          )}
        </div>
      )
    })
}

function parseLine(
  line: string,
  transpose: number,
  useFlats: boolean,
) {
  const chordRegex =
    /\[([A-G](?:#|b)?[^/\]\s]*(?:\/[A-G](?:#|b)?)?)\]/g

  const matches = [
    ...line.matchAll(chordRegex),
  ]

  if (!matches.length) {
    return [
      {
        chord: '',
        lyrics: line,
      },
    ]
  }

  const segments: {
    chord: string
    lyrics: string
  }[] = []

  if (matches[0].index! > 0) {
    segments.push({
      chord: '',
      lyrics: line.slice(
        0,
        matches[0].index,
      ),
    })
  }

  matches.forEach((match, index) => {
    const chord = match[1]

    const start =
      match.index! + match[0].length

    const end =
      index + 1 < matches.length
        ? matches[index + 1].index!
        : line.length

    let lyrics = line.slice(
      start,
      end,
    )

    if (lyrics.startsWith(' ')) {
      lyrics = lyrics.slice(1)
    }

    segments.push({
      chord: transposeChord(
        chord,
        transpose,
        useFlats,
      ),
      lyrics,
    })
  })

  return segments
}

export default App