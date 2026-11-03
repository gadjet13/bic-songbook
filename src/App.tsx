import SongFlowEditor from './SongFlowEditor'
import {hasFlowConflicts,mapFlowCursor,syncLinkedSections} from './lib/song-flow'
import {songSortLabels,sortSongsByDate} from './lib/song-dates'
import type {SongDateSort} from './lib/song-dates'
import OfflineSetlistStatus from './OfflineSetlistStatus'
import type {OfflineSnapshot} from './lib/offline-readiness'
import ChordPositionEditor from './ChordPositionEditor'
import {readingWords} from './lib/reader-lines'
import AddToFolder from './AddToFolder'
import SongDraftRecovery from './SongDraftRecovery'
import SetlistKeyOverview from './SetlistKeyOverview'
import { draftKey,readSongDrafts,writeSongDraft,removeSongDraft,canResumeSongDraft } from './lib/song-drafts'
import type { SongDraft } from './lib/song-drafts'
import { loginPersistence } from './lib/login-storage'
import { useEffect, useRef, useState } from 'react'
import { transposeChord, transposeSongContent, lyricsOnly } from './lib/chord/transpose'
import './App.css'
import { parseSongFile, downloadSongs, makeSongLink, readSongLink } from './lib/sharing'
import { MenuSection } from './ThemePreference'
import SongPages from './SongPages'
import SongFolders from './SongFolders'
import AddToSetlist from './AddToSetlist'
import SetlistCopy from './SetlistCopy'
import CompleteBackup from './CompleteBackup'
import type { OfflineBundle } from './lib/offline'
import SongHistory from './SongHistory'
import ChordSheetPaste from './ChordSheetPaste'
import DuplicateSongNotice from './DuplicateSongNotice'
import useUnsavedChanges from './useUnsavedChanges'
import useReadingWakeLock from './useReadingWakeLock'
import { allowNavigation } from './lib/unsaved'
import { freshestSong } from './lib/editor-song'
import SongOrganization, { useFavorites } from './SongOrganization'

export type Song = {
  created_at?: string | null
  updated_at?: string | null
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
  offlineReadiness?:OfflineSnapshot
  sharedSetlistId?:string
  loading?: boolean
  offline?: boolean
  personalName?: string
  offlineData?: OfflineBundle
  initialSongId?: number
  openChurchSong?: (song:Song)=>void
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
  const {favorites,toggle:toggleFavorite,error:favoriteError,busy:favoriteBusy}=useFavorites(library.userId,library.offline?library.offlineData?.favorites:undefined)
  const [folder,setFolder]=useState('all')
  const [letter,setLetter]=useState('All')
  const [artistFilter,setArtistFilter]=useState('all')
  const [dateSort,setDateSort]=useState<SongDateSort>('title')
  function resetSongSort(){setDateSort('title')}
  const [setlistId,setSetlistId]=useState<string|null>(null)
  const [folderNames,setFolderNames]=useState<{id:string;name:string}[]>([])
  const [favoritesOnly,setFavoritesOnly]=useState(false)
  const [setlistQueue,setSetlistQueue]=useState<Song[]>([])
  const [queueIndex,setQueueIndex]=useState(0)
  const [startOnLastPage,setStartOnLastPage]=useState(false)
  const [readingMode, setReadingMode] = useState(false)
  const [readingChoice,setReadingChoice]=useState(false)
  const [readingContent,setReadingContent]=useState<'lyrics'|'chords'>('chords')
  const wakeStatus=useReadingWakeLock(readingMode)
  const [fontSize, setFontSize] = useState(() => {
    try { const saved = Number(localStorage.getItem('bic-songbook-font-size')); return saved >= 12 && saved <= 32 ? saved : 16 } catch { return 16 }
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
      setSetlistId(event.state?.bicSetlist??null)
      setFolder(event.state?.bicFolder??'all')
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
  const [savingSong,setSavingSong]=useState(false)
  useEffect(()=>{
    if(isEditing||library.sharedSetlist)return
    setSelectedSong(current=>current?freshestSong(current,songList):null)
  },[library.songs,isEditing,library.sharedSetlist])

  const [editedContent, setEditedContent] =
    useState('')

  const [editedTitle, setEditedTitle] =
    useState('')

  const [editedArtist, setEditedArtist] =
    useState('')

  const [editedKey, setEditedKey] =
    useState('')


  useEffect(()=>{setReadingChoice(false)},[selectedSong?.id,isEditing])

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


  const [newSongContent, setNewSongContent] =
    useState('')
  const [newRaw,setNewRaw]=useState('')
  const [editedRaw,setEditedRaw]=useState('')
  const recoveryKey=draftKey(library.userId,library.ownerId?'personal':'church')
  const [songDrafts,setSongDrafts]=useState(()=>library.sharedSetlist?[]:readSongDrafts(recoveryKey))
  const [draftStatus,setDraftStatus]=useState('')
  const dirtySong=!!isEditing&&!!selectedSong&&(editedTitle!==selectedSong.title||editedArtist!==selectedSong.artist||editedKey!==selectedSong.key||editedContent!==selectedSong.content||!!editedRaw.trim())
  const dirtyNew=isAddingSong&&!!(newSongTitle.trim()||newSongArtist.trim()||newSongContent.trim()||newRaw.trim()||newSongKey!=='C')
  useUnsavedChanges(dirtySong||dirtyNew)
  useEffect(()=>{
    if(library.sharedSetlist||!library.canEdit)return
    const draft:SongDraft|null=dirtyNew?{id:'new',songId:null,title:newSongTitle,artist:newSongArtist,key:newSongKey,content:newSongContent,raw:newRaw,folderId:folder==='all'||folder==='unfiled'?null:folder,updatedAt:new Date().toISOString()}:dirtySong&&selectedSong?{id:'song:'+selectedSong.id,songId:selectedSong.id,baseRevision:selectedSong.revision,title:editedTitle,artist:editedArtist,key:editedKey,content:editedContent,raw:editedRaw,folderId:selectedSong.folder_id??null,updatedAt:new Date().toISOString()}:null
    if(!draft){const id=isAddingSong?'new':isEditing&&selectedSong?'song:'+selectedSong.id:null;if(id&&readSongDrafts(recoveryKey).some(row=>row.id===id)){setSongDrafts(removeSongDraft(recoveryKey,id));setDraftStatus('')}return}
    setSongDrafts(writeSongDraft(recoveryKey,draft))
    setDraftStatus(loginPersistence.isPersisted(recoveryKey)?'Draft saved on this browser. Save the song to update the database.':'Draft is only in memory. Browser storage is unavailable or full; do not close this tab before saving.')
  },[recoveryKey,isAddingSong,isEditing,library.canEdit,library.sharedSetlist,dirtyNew,dirtySong,newSongTitle,newSongArtist,newSongKey,newSongContent,newRaw,editedTitle,editedArtist,editedKey,editedContent,editedRaw,selectedSong?.id,folder])
  function clearDraft(id:string){setSongDrafts(removeSongDraft(recoveryKey,id));setDraftStatus('')}
  function recoverDraft(draft:SongDraft){
    if(!library.canEdit||library.loading||!allowNavigation())return
    const current=songList.find(song=>song.id===draft.songId)
    const canResume=canResumeSongDraft(draft,current)
    if(draft.songId!==null&&!canResume&&!window.confirm('This song changed or was deleted after the draft began. Recover it as a new song instead? The current saved version will stay unchanged.'))return
    if(canResume&&current){selectSong(current,true);setEditedTitle(draft.title);setEditedArtist(draft.artist);setEditedKey(draft.key);setEditedContent(draft.content);setEditedRaw(draft.raw);setIsEditing(true);setIsAddingSong(false)}
    else {if(draft.songId!==null&&songDrafts.some(row=>row.id==='new')){setNotice('Recover or discard your existing new-song draft first.');return}setSelectedSong(null);setNewSongTitle(draft.title);setNewSongArtist(draft.artist);setNewSongKey(draft.key);setNewSongContent(draft.content);setNewRaw(draft.raw);setFolder(draft.folderId??'all');setIsEditing(false);setIsAddingSong(true);if(draft.songId!==null)clearDraft(draft.id)}
    setNotice(canResume?'Draft recovered. Review and save when ready.':'Draft recovered as a new song. Review it before saving.')
  }
  function startNewSong(){if(!allowNavigation())return;const draft=songDrafts.find(row=>row.id==='new');if(draft){recoverDraft(draft);return}setNewSongTitle('');setNewSongArtist('');setNewSongKey('C');setNewSongContent('');setNewRaw('');setIsAddingSong(true)}
  function cancelNewSong(){if(!allowNavigation())return;clearDraft('new');setNewSongTitle('');setNewSongArtist('');setNewSongKey('C');setNewSongContent('');setNewRaw('');setIsAddingSong(false)}


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

  const matchingSongs = songList.filter((song) =>
    (letter==='All'||(letter==='#'?!/^[A-Za-z]/.test(song.title.trim()):song.title.trim().toUpperCase().startsWith(letter))) &&
    (folder==='all'||song.folder_id===folder) &&
    (artistFilter==='all'||(artistFilter==='__none'?!song.artist.trim():song.artist.trim().toLowerCase()===artistFilter)) &&
    (!favoritesOnly || favorites.includes(song.id)) &&
    `${song.title} ${song.artist}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  const filteredSongs = library.sharedSetlist?matchingSongs:sortSongsByDate(matchingSongs,dateSort)

  function openSetlist(id:string,saved=false){
    if(!saved&&!allowNavigation())return
    const next={...history.state,bicSetlist:id};delete next.bicSong;delete next.bicMode
    if(setlistId)history.replaceState(next,'',location.href);else history.pushState(next,'',location.href)
    setSetlistId(id);setSelectedSong(null);setIsAddingSong(false)
  }
  function backToSetlists(){if(history.state?.bicSetlist)history.back();else if(allowNavigation())setSetlistId(null)}
  function selectFolder(id:string){setFolder(id);history.replaceState({...history.state,bicFolder:id},'',location.href)}
  function openFolder(id:string){
    const next={...history.state,bicFolder:id};delete next.bicSong;delete next.bicMode;delete next.bicSetlist
    history.pushState(next,'',location.href);setFolder(id);setSelectedSong(null);setIsEditing(false);setReadingMode(false);setSetlistQueue([]);setSetlistId(null);setLetter('All');setArtistFilter('all');setSearch('');setFavoritesOnly(false);resetSongSort()
  }
  const libraryPage=!selectedSong&&!isAddingSong&&!setlistId
  const artists=[...new Map(songList.filter(song=>song.artist.trim()).map(song=>[song.artist.trim().toLowerCase(),song.artist.trim()])).entries()].sort((a,b)=>a[1].localeCompare(b[1]))
  const selectSong = (song: Song,force=false) => {
    if(!force&&song.id!==currentSongId.current&&!allowNavigation())return
    setStartOnLastPage(false)
    setReadingMode(false)
    setSelectedSong(song)
    setTranspose(0)

    setEditedRaw('')
    setEditedTitle(song.title)
    setEditedArtist(song.artist)
    setEditedKey(song.key)
    setEditedContent(song.content)

    setIsEditing(false)
  }

  const initialOpened=useRef<number|undefined>(undefined)
  useEffect(()=>{
    if(initialOpened.current===library.initialSongId||!library.initialSongId)return
    const song=songList.find(song=>song.id===library.initialSongId)
    if(song){initialOpened.current=library.initialSongId;selectSong(song)}
  },[library.initialSongId,library.songs])
  const duplicateTarget=(churchSong:Song)=>library.ownerId?songList.find(song=>song.source_song_id===churchSong.id)||songList.find(song=>song.title.trim().toLowerCase().replace(/\s+/g,' ')===churchSong.title.trim().toLowerCase().replace(/\s+/g,' ')):churchSong
  function openDuplicate(song:Song){
    if(!allowNavigation())return
    if(library.ownerId)library.openChurchSong?.(song)
    else {setIsAddingSong(false);selectSong(song,true)}
  }
  async function overwriteDuplicate(song:Song,draft:{title:string;artist:string;key:string;content:string}){
    if(hasFlowConflicts(draft.content))throw new Error('Resolve the different section versions in Song flow before overwriting.')
    const target=duplicateTarget(song)
    if(!target||!library.canEdit)throw new Error('You can only overwrite an existing song in your own editable songbook.')
    if(!draft.title.trim())throw new Error('Enter a title first.')
    if(!window.confirm(`Overwrite ${library.ownerId?'your personal':'the church'} version of “${target.title}” with the current editor content? Its previous version remains in history.`))return
    const startedSong=currentSongId.current
    const saved=await library.update({...target,...draft,title:draft.title.trim()})
    if(currentSongId.current!==startedSong){setNotice("Existing version overwritten. Open it to see the changes.");return}
    clearDraft(isAddingSong?'new':'song:'+startedSong);setNewRaw('');setEditedRaw('');
    setIsAddingSong(false);selectSong(saved,true);setNotice('Existing version overwritten. The previous version is in song history.')
  }
  function beginEditing(){
    if(!selectedSong)return
    const draft=songDrafts.find(row=>row.id==='song:'+selectedSong.id);if(draft){recoverDraft(draft);return}
    setEditedRaw('')
    const song=freshestSong(selectedSong,songList)
    setSelectedSong(song);setEditedTitle(song.title);setEditedArtist(song.artist);setEditedKey(song.key);setEditedContent(song.content);setIsEditing(true)
  }
  function editLinkedText(element:HTMLTextAreaElement,current:string,setContent:(value:string)=>void){
    const next=element.value,start=element.selectionStart,end=element.selectionEnd,value=syncLinkedSections(current,next)
    setContent(value)
    if(value!==next)requestAnimationFrame(()=>{if(element.isConnected&&element.value===value)element.setSelectionRange(mapFlowCursor(next,value,start),mapFlowCursor(next,value,end))})
  }
  const saveSong = async () => {
    if(savingSong)return
    if(hasFlowConflicts(editedContent)){setNotice('Resolve the different section versions in Song flow before saving.');return}
    if (!editedTitle.trim()) { setNotice('Please enter a song title.'); return }
    if (!selectedSong) {
      return
    }

    const updatedSong: Song = {
      ...selectedSong,
      title: editedTitle,
      artist: editedArtist,
      key: editedKey,
      category: selectedSong.category,
      content: editedContent,
    }

    setSavingSong(true)
    try {
      const saved=await library.update(updatedSong)
      clearDraft('song:'+updatedSong.id);setEditedRaw('')
      if(currentSongId.current===updatedSong.id){setSelectedSong(saved);setEditedTitle(saved.title);setEditedArtist(saved.artist);setEditedKey(saved.key);setEditedContent(saved.content);setIsEditing(false)}
    } catch(error){setNotice(String(error instanceof Error?error.message:error))}
    finally{setSavingSong(false)}
  }

  const addSong = async () => {
    if(hasFlowConflicts(newSongContent)){setNotice('Resolve the different section versions in Song flow before saving.');return}
    if (!newSongTitle.trim()) {
      return
    }

    const newSong: Song = {
      id: Date.now(),
      folder_id: folderNames.some(item=>item.id===folder)?folder:null,
      title: newSongTitle.trim(),
      artist: newSongArtist.trim(),
      key: newSongKey.trim() || 'C',
      category: '',
      content: newSongContent,
    }

    try { const [saved] = await library.add([newSong]); clearDraft('new');setNewRaw('');setSelectedSong(saved) }
    catch (error) { setNotice(String(error instanceof Error ? error.message : error)); return }
    setTranspose(0)
    setIsAddingSong(false)

    setNewSongTitle('')
    setNewSongArtist('')
    setNewSongKey('C')
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
    if(!allowNavigation())return
    if (!selectedSong) {
      return
    }

    clearDraft('song:'+selectedSong.id);setEditedRaw('')
    setEditedTitle(selectedSong.title)
    setEditedArtist(selectedSong.artist)
    setEditedKey(selectedSong.key)
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
          <button onClick={() => downloadSongs(songList)}>Export songs only</button>

          <label className="import-label" hidden={!library.canEdit}>Import songs<input type="file" accept=".json,application/json" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = '' }} /></label>
        </div>
        {!library.sharedSetlist&&!library.offline&&<CompleteBackup key={library.userId+'-'+library.ownerId} userId={library.userId} church={!library.ownerId} canEdit={library.canEdit} onChanged={library.refresh}/>}
        {!library.sharedSetlist&&library.canEdit&&<SongHistory ownerId={library.ownerId} currentSongs={songList} onChanged={library.refresh}/>}
        <p className="storage-note">{library.bookName} · {library.offline?'Reading saved copies. Reconnect to edit or share.':'Changes save online. Export a backup whenever you need one.'}</p></MenuSection>
        {!selectedSong&&library.sharedSetlist&&library.sharedSetlistId&&<OfflineSetlistStatus snapshot={library.offlineReadiness} userId={library.userId} list={{id:library.sharedSetlistId,title:library.bookName}} songs={songList} shared offline={library.offline} onSave={library.refresh} disabled={library.loading}/>}
        {!selectedSong && library.sharedSetlist && <SetlistKeyOverview songs={songList}/>}

        {!selectedSong && library.sharedSetlist && <button disabled={!songList.length} onClick={()=>{setSetlistQueue(songList);setQueueIndex(0);selectSong(songList[0])}}>Start shared setlist</button>}
        {!selectedSong&&library.sharedSetlist&&<div className="setlist-copy-row"><SetlistCopy songs={songList}/></div>}
        {libraryPage&&!library.sharedSetlist&&<SongDraftRecovery drafts={songDrafts} canRestore={library.canEdit&&!library.loading} onRestore={recoverDraft} onDiscard={draft=>{if(window.confirm('Permanently discard this unsaved draft?'))clearDraft(draft.id)}}/>}
        {(isAddingSong||isEditing)&&draftStatus&&<p className="storage-note" role="status">{draftStatus}</p>}

        {!selectedSong && !isAddingSong && library.ownerId && <SongOrganization offlineSnapshot={library.offlineReadiness} refreshing={library.loading} activeId={setlistId} onNavigate={openSetlist} onBack={backToSetlists} personalName={library.personalName??'My songbook'} churchSongs={library.offlineData?.church??[]} onSongsChanged={library.refresh} offlineLists={library.offline?library.offlineData?.setlists:undefined} ownerId={library.ownerId} songs={songList} canEdit={library.canEdit} onOpen={songs=>{if(songs.length){setSetlistQueue(songs);setQueueIndex(0);selectSong(songs[0])}}}/>}
        {libraryPage && library.ownerId && <SongFolders songs={songList} canEdit={library.canEdit} offlineFolders={library.offline?library.offlineData?.folders:undefined} userId={library.userId} selected={folder} onSelect={selectFolder} onFolders={setFolderNames} onChanged={library.refresh}/>}
        {favoriteError && <p role="status" className="notice">{favoriteError}</p>}
        {notice && <p role="status" className="notice">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></p>}
        {!setlistId && incoming && <section className="incoming"><h2>A friend shared “{incoming.title}”</h2><p>{incoming.artist} · Key: {incoming.key}</p><button disabled={!library.canEdit} onClick={async () => { try { const [song] = await library.add([incoming]); selectSong(song); setIncoming(null); history.replaceState(history.state, '', location.pathname + location.search) } catch (error) { setNotice(String(error instanceof Error ? error.message : error)) } }}>Add to this songbook</button><button onClick={() => {setIncoming(null); history.replaceState(history.state, '', location.pathname + location.search)}}>Dismiss</button></section>}

        {!selectedSong&&setlistId ? null : !selectedSong ? (
          isAddingSong ? (
            <div className="add-song-form">
              <h2>Add New Song</h2><ChordSheetPaste raw={newRaw} onRawChange={setNewRaw} onApply={(content,title,key)=>{setNewSongContent(content);if(title)setNewSongTitle(title);if(key)setNewSongKey(key)}}/>{library.ownerId && <p className="storage-note">The first saved version also goes to the church songbook. Later edits stay in your personal songbook.</p>}

              <SongFlowEditor content={newSongContent} onChange={setNewSongContent} disabled={savingSong||library.offline}/>
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
                Song Content

                <textarea
                  className="song-editor"
                  placeholder={`[Verse 1]
{G}Amazing grace, {D}how sweet the sound

[Chorus]
{C}Amazing grace`}
                  value={newSongContent}
                  onChange={(event) =>
                    editLinkedText(event.currentTarget,newSongContent,setNewSongContent)
                  }
                />

                <small className="editor-help">
                  Use <strong>[Verse 1]</strong>, <strong>[Chorus]</strong> or <strong>[Tag]</strong> for sections. Use <strong>{'{C}'}</strong> and <strong>{'{G/B}'}</strong> for chords. Existing # headings and [C] chords still work.
                </small>
              </label>

              <ChordPositionEditor content={newSongContent} onChange={value=>setNewSongContent(current=>syncLinkedSections(current,value))} disabled={savingSong||library.offline}/>
              <DuplicateSongNotice onOpen={openDuplicate} canOverwrite={song=>!!library.canEdit&&!!duplicateTarget(song)} onOverwrite={song=>overwriteDuplicate(song,{title:newSongTitle,artist:newSongArtist,key:newSongKey,content:newSongContent})} title={newSongTitle} personal={!!library.ownerId} onUseExisting={song=>{setNewSongTitle(song.title);setNewSongArtist(song.artist);setNewSongKey(song.key);setNewSongContent(song.content)}}/>
              <div className="edit-buttons">
                <button
                  className="save-button"
                  disabled={savingSong||library.offline||hasFlowConflicts(newSongContent)}
                  title={hasFlowConflicts(newSongContent)?'Resolve section variations in Song flow first':undefined}
                  onClick={addSong}
                >
                  Save Song
                </button>

                <button
                  className="cancel-button"
                  onClick={cancelNewSong}
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
                onClick={startNewSong}
              >
                + Add Song
              </button>

              {filteredSongs.length === 0 && <p>No songs found. Try another search or add a song.</p>}
              {!library.sharedSetlist&&<details className="song-filters library-toggle"><summary>Song filters</summary><label>Author / singer<select value={artistFilter} onChange={event=>setArtistFilter(event.target.value)}><option value="all">All artists</option><option value="__none">No artist listed</option>{artists.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="song-sort">Sort songs<select aria-label="Sort songs" value={dateSort} onChange={event=>setDateSort(event.target.value as SongDateSort)}>{(Object.entries(songSortLabels) as [SongDateSort,string][]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{dateSort.startsWith('added')&&<p className="storage-note">Songs without a recorded date added appear last.</p>}<nav className="alphabet-filter" aria-label="Filter by first letter">{['All',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ','#'].map(value=><button key={value} aria-pressed={letter===value} onClick={()=>setLetter(value)}>{value}</button>)}</nav><button className="favorite-filter" aria-pressed={favoritesOnly} onClick={()=>setFavoritesOnly(!favoritesOnly)}>{favoritesOnly?'★ Favorites only — show all':'☆ Show my favorites'}</button></details>}
              {!library.sharedSetlist&&(letter!=='All'||artistFilter!=='all'||favoritesOnly||dateSort!=='title')&&<p className="active-filters">Filters: {letter!=='All'&&`Title ${letter} · `}{artistFilter!=='all'&&`Artist: ${artistFilter==='__none'?'Not listed':artists.find(([value])=>value===artistFilter)?.[1]??artistFilter} · `}{favoritesOnly&&'Favorites '}{dateSort!=='title'&&`Sort: ${songSortLabels[dateSort]} `}<button onClick={()=>{setLetter('All');setArtistFilter('all');setFavoritesOnly(false);resetSongSort()}}>Clear song filters</button></p>}
              {folder!=='all'&&<p>Folder: {folderNames.find(item=>item.id===folder)?.name??'Selected folder'} <button onClick={()=>selectFolder('all')}>Show all songs</button></p>}
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
                      Key:{' '}
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
              {setlistId?'← Back to setlist':'← Back to songs'}
            </button>

            <div className="song-heading"><h2 title={selectedSong.title}>{selectedSong.title}</h2>
            {!isEditing && !readingMode && !library.sharedSetlist && <button className="favorite-filter" disabled={favoriteBusy||library.offline} aria-pressed={favorites.includes(selectedSong.id)} onClick={()=>void toggleFavorite(selectedSong.id)}>{favorites.includes(selectedSong.id)?'★ Remove favorite':'☆ Add to my favorites'}</button>}
            {!!setlistQueue.length && !isEditing && <nav className="setlist-navigation" aria-label="Setlist songs"><button disabled={queueIndex===0} onClick={()=>{setQueueIndex(queueIndex-1);selectSong(setlistQueue[queueIndex-1]);setStartOnLastPage(readingMode);setReadingMode(readingMode)}}>← Previous song</button><span>Song {queueIndex+1} of {setlistQueue.length}</span><button disabled={queueIndex===setlistQueue.length-1} onClick={()=>{setQueueIndex(queueIndex+1);selectSong(setlistQueue[queueIndex+1]);setReadingMode(readingMode)}}>Next song →</button></nav>}</div>


            {!isEditing && !readingMode && library.copyToPersonal && <button onClick={async()=>{try{await library.copyToPersonal!(selectedSong);setNotice('Copied to My songbook. You can edit your copy there.')}catch(error){setNotice(String(error instanceof Error?error.message:error))}}}>Copy to My songbook</button>}
            {!isEditing && !readingMode && library.ownerId && library.canEdit && <AddToSetlist key={'setlist-'+selectedSong.id} songId={selectedSong.id} ownerId={library.ownerId}/>}
            {!isEditing&&!readingMode&&library.ownerId&&library.canEdit&&<AddToFolder key={'folder-'+selectedSong.id} song={selectedSong} ownerId={library.ownerId} folders={folderNames} onSave={async folderId=>{const saved=await library.update({...selectedSong,folder_id:folderId});setSelectedSong(saved)}} onFolderCreated={folder=>{setFolderNames(rows=>[...rows,folder]);window.dispatchEvent(new Event('songbook-restored'))}} onOpen={openFolder}/>}

            <p>{selectedSong.artist}</p>

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
                <SongFlowEditor key={'flow-'+selectedSong.id} content={editedContent} onChange={setEditedContent} disabled={savingSong||library.offline}/>
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
                  Song Content
                  <ChordSheetPaste raw={editedRaw} onRawChange={setEditedRaw} key={selectedSong.id} onApply={(content,title,key)=>{setEditedContent(content);if(title)setEditedTitle(title);if(key)setEditedKey(key)}}/>
                  <textarea
                    className="song-editor"
                    value={editedContent}
                    onChange={(event) =>
                      editLinkedText(event.currentTarget,editedContent,setEditedContent)
                    }
                  />

                  <small className="editor-help">
                    Use <strong>[Verse 1]</strong>, <strong>[Chorus]</strong> or <strong>[Tag]</strong> for sections. Use <strong>{'{C}'}</strong> and <strong>{'{G/B}'}</strong> for chords. Existing # headings and [C] chords still work.
                  </small>
                </label>

                <ChordPositionEditor content={editedContent} onChange={value=>setEditedContent(current=>syncLinkedSections(current,value))} disabled={savingSong||library.offline}/>
                <DuplicateSongNotice onOpen={openDuplicate} canOverwrite={song=>!!library.canEdit&&!!duplicateTarget(song)} onOverwrite={song=>overwriteDuplicate(song,{title:editedTitle,artist:editedArtist,key:editedKey,content:editedContent})} title={editedTitle} personal={!!library.ownerId} excludeId={library.ownerId?undefined:selectedSong.id} onUseExisting={song=>{setEditedTitle(song.title);setEditedArtist(song.artist);setEditedKey(song.key);setEditedContent(song.content)}}/>
                <div className="edit-buttons">
                  <button
                    className="save-button"
                    disabled={savingSong||library.offline||hasFlowConflicts(editedContent)} title={hasFlowConflicts(editedContent)?'Resolve section variations in Song flow first':undefined} onClick={saveSong}
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
                <button disabled={library.offline} onClick={() => void shareSong(selectedSong)}>Share Song</button>
                <details className="copy-options"><summary>Copy</summary>
                  <button onClick={()=>void copySong(false)}>Copy with chords</button>
                  <button onClick={()=>void copySong(true)}>Copy lyrics</button>
                </details>
                <button
                  hidden={!library.canEdit}
                  className="edit-button"
                  onClick={beginEditing}
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
              {!isEditing && <button className="reading-toggle" aria-pressed={readingMode} onClick={() => {if(readingMode)setReadingMode(false);else setReadingChoice(value=>!value)}}>{readingMode ? 'Exit reading mode' : 'Reading mode'}</button>}
            </div>
            {!isEditing && <div className="reading-tools" role="group" aria-label="Song text size">
                <span>Text size</span>
                <button aria-label="Decrease song text size" disabled={fontSize <= 6} onClick={() => setFontSize(size => Math.max(6, size - 2))}>A−</button>
                <output aria-live="polite">{fontSize}px</output>
                <button aria-label="Increase song text size" disabled={fontSize >= 32} onClick={() => setFontSize(size => Math.min(32, size + 2))}>A+</button>
              </div>}
            </div>
            {!isEditing&&readingChoice&&!readingMode&&<fieldset className="reading-choice"><legend>Reading mode content</legend><p>Choose what to show. Your saved song stays unchanged.</p><button onClick={()=>{setReadingContent('lyrics');setReadingChoice(false);setReadingMode(true)}}>Lyrics only</button><button onClick={()=>{setReadingContent('chords');setReadingChoice(false);setReadingMode(true)}}>Lyrics + chords</button><button onClick={()=>setReadingChoice(false)}>Cancel reading mode</button></fieldset>}
            {!isEditing && (<>
              {readingMode&&<label className="reader-content-choice">Reading content<select aria-label="Reading content" value={readingContent} onChange={event=>setReadingContent(event.target.value as 'lyrics'|'chords')}><option value="lyrics">Lyrics only</option><option value="chords">Lyrics + chords</option></select></label>}
              {readingMode&&<small role="status">{wakeStatus}</small>}
              {readingMode ? <SongPages key={selectedSong.id+'-'+queueIndex+'-'+readingContent} fontSize={fontSize} onFitFontSize={setFontSize} startOnLastPage={startOnLastPage} onPreviousSong={queueIndex > 0 && setlistQueue.length ? () => {setQueueIndex(queueIndex-1);selectSong(setlistQueue[queueIndex-1]);setStartOnLastPage(true);setReadingMode(true)} : undefined} onNextSong={queueIndex < setlistQueue.length - 1 ? () => {setQueueIndex(queueIndex+1);selectSong(setlistQueue[queueIndex+1]);setReadingMode(true)} : undefined}>{displaySong(selectedSong.content, transpose, getCurrentKey(selectedSong.key, transpose),true,readingContent==='chords')}</SongPages> : <div className="song-display" style={{fontSize: `${fontSize}px`}} tabIndex={0} aria-label="Song lyrics and chords">
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
        {selectedSong&&!isEditing&&!readingMode&&library.canEdit&&<SongHistory key={'history-'+selectedSong.id} song={selectedSong} ownerId={library.ownerId} currentSongs={songList} onChanged={library.refresh} onRestored={song=>setSelectedSong(song)}/>}
      </main>
    </div>
  )
}

function displaySong(
  content: string,
  transpose: number,
  currentKey: string,
  wrapWords=false,
  showChords=true,
) {
  if(!showChords)content=lyricsOnly(content)
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
  return groups.map((group, index) => <div className={showChords?'song-block':'song-block lyrics-only-block'} key={index}>
    {group.heading && <div className="song-section">{group.heading}</div>}
    {group.lines.map((line, lineIndex) => <div className="song-line" key={lineIndex}>
      {wrapWords?readingWords(parseLine(line,transpose,useFlats)).map((word,wordIndex)=>word.kind==='space'?word.text:<span className="song-word" key={wordIndex}>{word.parts.map((segment,segmentIndex)=><span key={segmentIndex} style={segment.chord?{minWidth:`${(segment.chord.length+.7)*.65}em`}:undefined} className={segment.chord&&!segment.lyrics.trim()?'song-segment chord-only':'song-segment'}><span className="chord">{segment.chord}</span><span className="lyrics">{segment.lyrics}</span></span>)}</span>):parseLine(line, transpose, useFlats).map((segment, segmentIndex) => <span style={segment.chord ? {minWidth: `${(segment.chord.length + 0.7) * 0.65}em`} : undefined} className={segment.chord && !segment.lyrics.trim() ? "song-segment chord-only" : "song-segment"} key={segmentIndex}>
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

