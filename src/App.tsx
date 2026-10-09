import { useEffect, useRef, useState } from 'react'
import { transposeChord, transposeSongContent, lyricsOnly } from './lib/chord/transpose'
import './App.css'
import { parseSongFile, downloadSongs, makeSongLink, readSongLink } from './lib/sharing'
import { MenuSection } from './ThemePreference'
import SongPages from './SongPages'
import SongFolders from './SongFolders'
import AddToSetlist from './AddToSetlist'
import SetlistCopy from './SetlistCopy'
import SongOrganization, { useFavorites } from './SongOrganization'

export type Song = {
  folder_id?: string | null
  source_song_id?: number | null
  owner_id?: string | null
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
  const match = originalKey.match(/^([A-G](?:#|b)?)(m|maj|min)?$/)
  if (!match) return originalKey
  const root = match[1]
  const normalizedKey = FLAT_TO_SHARP[root] ?? root

  const index = NOTES.indexOf(normalizedKey)

  if (index === -1) {
    return originalKey
  }

  return DISPLAY_NOTES[
    (index + semitones + 12) % 12
  ] + (match[2] ?? '')
}

export type SharedLibrary = {
  sharedSetlist?: boolean
  ownerId: string | null
  refresh: ()=>Promise<void>
  bookName: string
  copyToPersonal?: (song:Song)=>Promise<void>
  userId: string
  songs: Song[]
  canEdit: boolean
  add: (songs: Song[]) => Promise<Song[]>
  update: (song: Song) => Promise<Song>
  remove: (song: Song) => Promise<void>
}
function App({library}: {library: SharedLibrary}) {
  const {favorites,toggle:toggleFavorite,error:favoriteError,busy:favoriteBusy}=useFavorites(library.userId)
  const [folder,setFolder]=useState('all')
  const [folderNames,setFolderNames]=useState<{id:string;name:string}[]>([])
  const [favoritesOnly,setFavoritesOnly]=useState(false)
  const [setlistQueue,setSetlistQueue]=useState<Song[]>([])
  const [queueIndex,setQueueIndex]=useState(0)
  const [startOnLastPage,setStartOnLastPage]=useState(false)
  const [readingMode, setReadingMode] = useState(false)
  const [fontSize, setFontSize] = useState(() => {
    try { const saved = Number(localStorage.getItem('bic-songbook-font-size')); return saved >= 6 && saved <= 32 ? saved : 18 } catch { return 18 }
  })
  useEffect(() => {
    try { localStorage.setItem('bic-songbook-font-size', String(fontSize)) } catch { /* Keep the current size when storage is unavailable. */ }
  }, [fontSize])
  useEffect(() => {
    document.body.classList.toggle('song-reading-mode', readingMode)
    if (readingMode) window.scrollTo(0, 0)
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setReadingMode(false) }
    window.addEventListener('keydown', escape)
    return () => { document.body.classList.remove('song-reading-mode'); window.removeEventListener('keydown', escape) }
  }, [readingMode])
  const [notice, setNotice] = useState('')
  const [incoming, setIncoming] = useState<Song | null>(() => readSongLink())
  const songList = library.songs
  const [search, setSearch] = useState('')
  const [selectedSong, setSelectedSong] =
    useState<Song | null>(null)

  useEffect(()=>{
    if(!library.sharedSetlist)return
    setSelectedSong(current=>current?songList.find(song=>song.id===current.id)??null:null)
    setSetlistQueue(current=>current.length?songList:current)
    setQueueIndex(current=>{
      const index=selectedSong?songList.findIndex(song=>song.id===selectedSong.id):-1
      return index>=0?index:Math.min(current,Math.max(0,songList.length-1))
    })
    if(selectedSong&&!songList.some(song=>song.id===selectedSong.id))setReadingMode(false)
  },[library.songs,library.sharedSetlist])
  const historySongRef=useRef<Song|null>(null)
  historySongRef.current=selectedSong
  useEffect(()=>{
    if(!selectedSong)return
    const state=history.state??{}
    if(state.bicSong===selectedSong.id)return
    const next={...state,bicSong:selectedSong.id}
    if(state.bicMode==='adding')delete next.bicMode
    if(state.bicSong || state.bicMode==='adding')history.replaceState(next,'',location.href)
    else history.pushState(next,'',location.href)
  },[selectedSong?.id])
  useEffect(()=>{
    const back=(event:PopStateEvent)=>{
      if(event.state?.bicSong){
        const song=library.songs.find(item=>item.id===event.state.bicSong)
        if(song){selectSong(song);setReadingMode(event.state.bicMode==='reading');setIsEditing(event.state.bicMode==='editing')}
        setIsAddingSong(false)
      } else if(historySongRef.current){
        setSelectedSong(null);setIsEditing(false);setReadingMode(false);setSetlistQueue([]);setIsAddingSong(event.state?.bicMode==='adding')
      } else {setIsAddingSong(event.state?.bicMode==='adding')}
    }
    window.addEventListener('popstate',back)
    return ()=>window.removeEventListener('popstate',back)
  },[library.songs])

  const currentSongId = useRef<number | null>(null)
  currentSongId.current = selectedSong?.id ?? null
  const [savingKey,setSavingKey]=useState(false)
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
  useEffect(()=>{
    const mode=isAddingSong?'adding':isEditing?'editing':readingMode?'reading':null
    const state=history.state??{}
    if(mode=== (state.bicMode??null))return
    if(mode)history.pushState({...state,bicMode:mode},'',location.href)
    else if(state.bicMode)history.back()
  },[isAddingSong,isEditing,readingMode])


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

  async function saveInCurrentKey() {
    if (!selectedSong || !library.ownerId || !library.canEdit || !transpose || savingKey) return
    const key = getCurrentKey(selectedSong.key,transpose)
    setSavingKey(true)
    try {
      const saved = await library.update({...selectedSong,key,content:transposeSongContent(selectedSong.content,transpose,key.includes('b'))})
      setSetlistQueue(queue=>queue.map(song=>song.id===saved.id?saved:song))
      if (currentSongId.current===saved.id) {
        setSelectedSong(saved)
        setTranspose(0)
        setEditedKey(saved.key)
        setEditedContent(saved.content)
      }
      setNotice(`Saved your personal version in ${key}. The church copy is unchanged.`)
    } catch(error) {setNotice(String(error instanceof Error?error.message:error))}
    finally {setSavingKey(false)}
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
    (folder==='all'||(folder==='unfiled'?!song.folder_id:song.folder_id===folder)) &&
    (!favoritesOnly || favorites.includes(song.id)) &&
    `${song.title} ${song.artist} ${song.category}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  const selectSong = (song: Song) => {
    setStartOnLastPage(false)
    setReadingMode(false)
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
      folder_id: folderNames.some(item=>item.id===folder)?folder:null,
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

  async function copySong(withoutChords: boolean) {
    if (!selectedSong) return
    try {
      const text = withoutChords ? lyricsOnly(selectedSong.content) : transposeSongContent(selectedSong.content, transpose, getCurrentKey(selectedSong.key, transpose).includes('b'))
      await navigator.clipboard.writeText(text)
      setNotice(withoutChords ? 'Lyrics copied without chords.' : 'Song copied with chords in the displayed key.')
    } catch {
      setNotice('Could not copy. Please allow clipboard access in your browser and try again.')
    }
  }

  return (
    <div className="app">
      <header>
        <h1 className="brand"><img src="/bic-logo.png" alt="BIC" /> BIC Worship DB</h1><p>{library.bookName} · <a href="/guide.html" target="_blank" rel="noopener">ⓘ User guide</a></p>
        <p>Your songs, in every key. Wherever you play.</p>
      </header>

      <main>
        <MenuSection><div className="library-tools">
          <button onClick={() => downloadSongs(songList)}>Export backup</button>
          <label className="import-label" hidden={!library.canEdit}>Import songs<input type="file" accept=".json,application/json" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = '' }} /></label>
        </div>
        <p className="storage-note">{library.bookName} · Changes save online. Export a backup whenever you need one.</p></MenuSection>
        {!selectedSong && library.sharedSetlist && <SetlistCopy songs={songList}/>}
        {!selectedSong && library.sharedSetlist && <button disabled={!songList.length} onClick={()=>{setSetlistQueue(songList);setQueueIndex(0);selectSong(songList[0])}}>Start shared setlist</button>}
        {!selectedSong && !isAddingSong && library.ownerId && <SongOrganization ownerId={library.ownerId} songs={songList} canEdit={library.canEdit} onOpen={songs=>{if(songs.length){setSetlistQueue(songs);setQueueIndex(0);selectSong(songs[0])}}}/>}
        {!selectedSong && !isAddingSong && library.ownerId && <SongFolders userId={library.userId} selected={folder} onSelect={setFolder} onFolders={setFolderNames} onChanged={library.refresh}/>}
        {favoriteError && <p role="status" className="notice">{favoriteError}</p>}
        {notice && <p role="status" className="notice">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></p>}
        {incoming && <section className="incoming"><h2>A friend shared “{incoming.title}”</h2><p>{incoming.artist} · Key: {incoming.key}</p><button disabled={!library.canEdit} onClick={async () => { try { const [song] = await library.add([incoming]); selectSong(song); setIncoming(null); history.replaceState(history.state, '', location.pathname + location.search) } catch (error) { setNotice(String(error instanceof Error ? error.message : error)) } }}>Add to this songbook</button><button onClick={() => {setIncoming(null); history.replaceState(history.state, '', location.pathname + location.search)}}>Dismiss</button></section>}

        {!selectedSong ? (
          isAddingSong ? (
            <div className="add-song-form">
              <h2>Add New Song</h2>{library.ownerId && <p className="storage-note">The first saved version also goes to the church songbook. Later edits stay in your personal songbook.</p>}

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
                  placeholder={`[Verse 1]
{G}Amazing grace, {D}how sweet the sound

[Chorus]
{C}Amazing grace`}
                  value={newSongContent}
                  onChange={(event) =>
                    setNewSongContent(
                      event.target.value,
                    )
                  }
                />

                <small className="editor-help">
                  Use <strong>[Verse 1]</strong>, <strong>[Chorus]</strong> or <strong>[Tag]</strong> for sections. Use <strong>{'{C}'}</strong> and <strong>{'{G/B}'}</strong> for chords. Existing # headings and [C] chords still work.
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
              <button hidden={library.sharedSetlist} className="favorite-filter" aria-pressed={favoritesOnly} onClick={()=>setFavoritesOnly(!favoritesOnly)}>{favoritesOnly?'★ Favorites only — show all':'☆ Show my favorites'}</button>
              <div className="song-list">
                {filteredSongs.map((song) => (
                  <button
                    key={song.id}
                    className="song-item"
                    onClick={() =>
                      {setSetlistQueue([]);selectSong(song)}
                    }
                  >
                    <strong>
                      {song.title}
                    </strong>

                    <span>
                      {song.artist} ·{' '}
                      {song.category} · Key:{' '}
                      {song.key}
                      {favorites.includes(song.id) ? ' · ★ Favorite' : ''}
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
                if(history.state?.bicSong)history.back()
                else {setSelectedSong(null);setIsEditing(false);setReadingMode(false);setSetlistQueue([])}
              }}
            >
              ← Back to songs
            </button>

            <div className="song-heading"><h2 title={selectedSong.title}>{selectedSong.title}</h2>
            {!isEditing && !readingMode && !library.sharedSetlist && <button className="favorite-filter" disabled={favoriteBusy} aria-pressed={favorites.includes(selectedSong.id)} onClick={()=>void toggleFavorite(selectedSong.id)}>{favorites.includes(selectedSong.id)?'★ Remove favorite':'☆ Add to my favorites'}</button>}
            {!!setlistQueue.length && !isEditing && <nav className="setlist-navigation" aria-label="Setlist songs"><button disabled={queueIndex===0} onClick={()=>{setQueueIndex(queueIndex-1);selectSong(setlistQueue[queueIndex-1]);setStartOnLastPage(readingMode);setReadingMode(readingMode)}}>← Previous song</button><span>Song {queueIndex+1} of {setlistQueue.length}</span><button disabled={queueIndex===setlistQueue.length-1} onClick={()=>{setQueueIndex(queueIndex+1);selectSong(setlistQueue[queueIndex+1]);setReadingMode(readingMode)}}>Next song →</button></nav>}</div>

            {!isEditing && !readingMode && library.copyToPersonal && <button onClick={async()=>{try{await library.copyToPersonal!(selectedSong);setNotice('Copied to My songbook. You can edit your copy there.')}catch(error){setNotice(String(error instanceof Error?error.message:error))}}}>Copy to My songbook</button>}
            {!isEditing && !readingMode && library.ownerId && library.canEdit && <AddToSetlist key={selectedSong.id} songId={selectedSong.id} ownerId={library.ownerId}/>}
            {!isEditing && !readingMode && library.ownerId && <label>Folder<select value={selectedSong.folder_id??''} onChange={async event=>{try{const saved=await library.update({...selectedSong,folder_id:event.target.value||null});setSelectedSong(saved)}catch(error){setNotice(String(error instanceof Error?error.message:error))}}}><option value="">Unfiled</option>{folderNames.map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>}

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
                    Use <strong>[Verse 1]</strong>, <strong>[Chorus]</strong> or <strong>[Tag]</strong> for sections. Use <strong>{'{C}'}</strong> and <strong>{'{G/B}'}</strong> for chords. Existing # headings and [C] chords still work.
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
                <details className="copy-options"><summary>Copy</summary>
                  <button onClick={()=>void copySong(false)}>Copy with chords</button>
                  <button onClick={()=>void copySong(true)}>Copy lyrics</button>
                </details>
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

            <div className="reader-controls"><div className="transpose">
              <button
                disabled={savingKey}
                aria-label="Transpose down one semitone"
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
                disabled={savingKey}
                aria-label="Transpose up one semitone"
                onClick={() =>
                  changeTranspose(1)
                }
              >
                +
              </button>
              {!isEditing && library.ownerId && library.canEdit && <button className="save-key-button" disabled={savingKey||transpose===0||!/^([A-G](?:#|b)?)(m|maj|min)?$/.test(selectedSong.key)} onClick={()=>void saveInCurrentKey()}>{savingKey?'Saving…':`Save in ${getCurrentKey(selectedSong.key,transpose)} as base key`}</button>}
              {!isEditing && <button className="reading-toggle" aria-pressed={readingMode} onClick={() => setReadingMode(!readingMode)}>{readingMode ? 'Exit reading mode' : 'Reading mode'}</button>}
            </div>
            {!isEditing && <div className="reading-tools" role="group" aria-label="Song text size">
                <span>Text size</span>
                <button aria-label="Decrease song text size" disabled={fontSize <= 6} onClick={() => setFontSize(size => Math.max(6, size - 2))}>A−</button>
                <output aria-live="polite">{fontSize}px</output>
                <button aria-label="Increase song text size" disabled={fontSize >= 32} onClick={() => setFontSize(size => Math.min(32, size + 2))}>A+</button>
              </div>}
            </div>
            {!isEditing && (<>
              {readingMode ? <SongPages key={selectedSong.id+'-'+queueIndex} fontSize={fontSize} startOnLastPage={startOnLastPage} onPreviousSong={queueIndex > 0 && setlistQueue.length ? () => {setQueueIndex(queueIndex-1);selectSong(setlistQueue[queueIndex-1]);setStartOnLastPage(true);setReadingMode(true)} : undefined} onNextSong={queueIndex < setlistQueue.length - 1 ? () => {setQueueIndex(queueIndex+1);selectSong(setlistQueue[queueIndex+1]);setReadingMode(true)} : undefined}>{displaySong(selectedSong.content, transpose, getCurrentKey(selectedSong.key, transpose))}</SongPages> : <div className="song-display" style={{fontSize: `${fontSize}px`}} tabIndex={0} aria-label="Song lyrics and chords">
                {displaySong(
                  selectedSong.content,
                  transpose,
                  getCurrentKey(
                    selectedSong.key,
                    transpose,
                  ),
                )}
              </div>}
              </>
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

  const groups: { heading?: string; lines: string[] }[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    // A chord-only line such as [C] must remain a legacy chord, not a section.
    const bracket = trimmed.match(/^\[([^\]]+)\]$/)
    const legacyChord = bracket && /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add|\d|#|b|[-+()])*(?:\/[A-G](?:#|b)?)?$/.test(bracket[1])
    const heading = trimmed.startsWith('# ') ? trimmed.slice(2) : bracket && !legacyChord ? bracket[1] : undefined
    if (heading !== undefined) groups.push({ heading, lines: [] })
    else {
      if (!groups.length) groups.push({ lines: [] })
      groups[groups.length - 1].lines.push(line)
    }
  }
  return groups.map((group, index) => <div className="song-block" key={index}>
    {group.heading && <div className="song-section">{group.heading}</div>}
    {group.lines.map((line, lineIndex) => <div className="song-line" key={lineIndex}>
      {parseLine(line, transpose, useFlats).map((segment, segmentIndex) => <span style={segment.chord ? {minWidth: `${(segment.chord.length + 0.7) * 0.65}em`} : undefined} className={segment.chord && !segment.lyrics.trim() ? "song-segment chord-only" : "song-segment"} key={segmentIndex}>
        <span className="chord">{segment.chord}</span><span className="lyrics">{segment.lyrics}</span>
      </span>)}
    </div>)}
  </div>)
}

function parseLine(
  line: string,
  transpose: number,
  useFlats: boolean,
) {
  const chordRegex =
    /\[([A-G](?:#|b)?[^/\]\s]*(?:\/[A-G](?:#|b)?)?)\]|\{([A-G](?:#|b)?[^/}\s]*(?:\/[A-G](?:#|b)?)?)\}/g

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
    const chord = match[1] || match[2]

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
