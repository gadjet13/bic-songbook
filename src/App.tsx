import { downloadChordPro } from './lib/chordpro'
import { cloud } from './lib/cloud'
import AddSongForm from './AddSongForm'
import { emptyNewSong, prepareNewSong, recoverNewSong } from './lib/new-song'
import { normalizeTitle } from './lib/setlist-search'
import { songKey } from './lib/setlist-arrangement'
import ReaderChartEditor from './ReaderChartEditor'
import ReadingColumns from './ReadingColumns'
import ReadingTextSize, { maxReadingTextSize, minReadingTextSize } from './ReadingTextSize'
import type { ReaderColumns } from './lib/reader-lines'
import FullSetlistReader from './FullSetlistReader'
import type { FullReaderControls } from './FullSetlistReader'
import { flushSetlistCapos, loadSetlistPreferences, preferencesChanged, queueSetlistCapo } from './lib/setlist-preferences'
import SongFlowEditor from './SongFlowEditor'
import {hasFlowConflicts,mapFlowCursor,syncLinkedSections} from './lib/song-flow'
import {songSortLabels,sortSongsByDate,songVersionDetails} from './lib/song-dates'
import type {SongDateSort} from './lib/song-dates'
import ChordPositionEditor from './ChordPositionEditor'
import { displaySong } from './SongChart'
import AddToFolder from './AddToFolder'
import SongDraftRecovery from './SongDraftRecovery'
import SetlistKeyOverview from './SetlistKeyOverview'
import { draftKey,readSongDrafts,writeSongDraft,removeSongDraft,canResumeSongDraft } from './lib/song-drafts'
import type { SongDraft } from './lib/song-drafts'
import { loginPersistence } from './lib/login-storage'
import { useEffect, useMemo, useRef, useState } from 'react'
import { transposeSongContent, lyricsOnly } from './lib/chord/transpose'
import './App.css'
import { parseSongFile, downloadSongs, makeSongLink, readSongLink } from './lib/sharing'
import { MenuSection } from './ThemePreference'
import SongPages from './SongPages'
import SongFolders from './SongFolders'
import AddToSetlist from './AddToSetlist'
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
  setlist_key?: string | null
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
  sharedSetlistId?:string
  sourceSetlistId?:string
  loading?: boolean
  offline?: boolean
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
type ReaderEdit = {song:Song; occurrence:string; content:string; scroll:number; trigger:HTMLElement}

function App({library}: {library: SharedLibrary}) {
  const {favorites,toggle:toggleFavorite,error:favoriteError,busy:favoriteBusy}=useFavorites(library.userId,library.offline?library.offlineData?.favorites:undefined)
  const [folder,setFolder]=useState('all')
  const [letter,setLetter]=useState('All')
  const [artistFilter,setArtistFilter]=useState('all')
  const [dateSort,setDateSort]=useState<SongDateSort>('title')
  function resetSongSort(){setDateSort('title')}
  const [libraryView,setLibraryView]=useState<'songs'|'setlists'>(()=>library.ownerId&&history.state?.bicSetlistIndex?'setlists':'songs')
  const [setlistId,setSetlistId]=useState<string|null>(()=>library.ownerId?history.state?.bicSetlist??null:null)
  const [setlistSongEditor,setSetlistSongEditor]=useState<{
    onSaved: (song: Song) => void
    returnFocus: HTMLElement
  } | null>(null)
  const setlistReturnFocus=useRef<HTMLElement|null>(null)
  const activeSetlistSongEditor=useRef(setlistSongEditor)
  activeSetlistSongEditor.current=setlistSongEditor
  const [folderNames,setFolderNames]=useState<{id:string;name:string}[]>([])
  const [favoritesOnly,setFavoritesOnly]=useState(false)
  const [readingMode, setReadingMode] = useState(false)
  const [fullSetReading,setFullSetReading]=useState(()=>!!history.state?.bicFullSet)
  const [readerEdit,setReaderEdit]=useState<ReaderEdit|null>(null)
  const [readerSaving,setReaderSaving]=useState(false)
  const [readerError,setReaderError]=useState('')
  const readerSavePending=useRef(false)
  const returnToFullSetButton=useRef(false)
  const fullSetCard=useRef<string|null>(typeof history.state?.bicFullSet==='string'?history.state.bicFullSet:null)
  const [readingChoice,setReadingChoice]=useState(false)
  const [readingContent,setReadingContent]=useState<'lyrics'|'chords'>('chords')
  const [readerColumns,setReaderColumns]=useState<ReaderColumns>(()=>{
    try {
      const saved=localStorage.getItem('bic-reading-columns')
      if(saved==='one'||saved==='two')return saved
    } catch { /* Storage can be disabled. */ }
    return 'auto'
  })
  useEffect(()=>{
    try { localStorage.setItem('bic-reading-columns',readerColumns) }
    catch { /* Keep the choice until the page closes. */ }
  },[readerColumns])
  const wakeStatus=useReadingWakeLock(readingMode||fullSetReading)
  const [fontSize, setFontSize] = useState(() => {
    try { const saved = Number(localStorage.getItem('bic-songbook-font-size')); return saved >= minReadingTextSize && saved <= maxReadingTextSize ? saved : 16 } catch { return 16 }
  })
  useEffect(() => {
    try { localStorage.setItem('bic-songbook-font-size', String(fontSize)) } catch { /* Keep the current size when storage is unavailable. */ }
  }, [fontSize])
  useEffect(() => {
    document.body.classList.toggle('song-reading-mode', readingMode)
    if (readingMode) window.scrollTo(0, 0)
    return () => document.body.classList.remove('song-reading-mode')
  }, [readingMode])
  useEffect(()=>{
    if(!readingMode)return
    const escape = (event: KeyboardEvent) => {
      if(event.key!=='Escape'||event.defaultPrevented||history.state?.bicFullSet)return
      if(readerEdit){
        if(!(event.target instanceof HTMLElement&&event.target.matches('input,textarea,select')))cancelReaderEdit()
      }else setReadingMode(false)
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [readingMode,readerEdit])
  useEffect(()=>{
    document.body.classList.toggle('full-set-reading',fullSetReading)
    if(!fullSetReading&&returnToFullSetButton.current){
      returnToFullSetButton.current=false
      const card=fullSetCard.current
      const trigger=card?`[data-read-full-set="${CSS.escape(card)}"]`:'[data-read-full-set=""]'
      requestAnimationFrame(()=>document.querySelector<HTMLElement>(trigger)?.focus())
    }
    return ()=>document.body.classList.remove('full-set-reading')
  },[fullSetReading])
  const [notice, setNotice] = useState('')
  const [incoming, setIncoming] = useState<Song | null>(() => readSongLink())
  const songList = library.songs
  const [search, setSearch] = useState('')
  const [selectedSong, setSelectedSong] =
    useState<Song | null>(null)

  useEffect(()=>{
    if(!library.sharedSetlist||!selectedSong)return
    setSelectedSong(songList.find(song=>song.id===selectedSong.id)??null)
  },[library.songs,library.sharedSetlist])
  const preferenceId=library.sourceSetlistId??(setlistId==='new'?null:setlistId)
  const oldPreferenceId=library.sharedSetlistId??preferenceId
  const localPreferenceId=preferenceId??oldPreferenceId
  const [,refreshPreferences]=useState(0)
  const [preferenceError,setPreferenceError]=useState('')
  useEffect(()=>{
    const refresh=()=>refreshPreferences(value=>value+1)
    window.addEventListener(preferencesChanged,refresh)
    window.addEventListener('storage',refresh)
    return ()=>{window.removeEventListener(preferencesChanged,refresh);window.removeEventListener('storage',refresh)}
  },[])
  useEffect(()=>{
    if(!preferenceId||library.offline)return
    let active=true
    const load=()=>void loadSetlistPreferences(library.userId,preferenceId).then(()=>{
      if(active)setPreferenceError('')
    }).catch(error=>{
      if(active)setPreferenceError(String(error.message))
    })
    setPreferenceError('')
    load()
    window.addEventListener('focus',load)
    return ()=>{active=false;window.removeEventListener('focus',load)}
  },[preferenceId,library.userId,library.offline])
  function changeCapo(targetSong:number,fret:number){
    if(!localPreferenceId)return
    queueSetlistCapo(library.userId,localPreferenceId,targetSong,fret,!preferenceId&&!!library.sharedSetlistId)
    if(preferenceId&&!library.offline){
      setPreferenceError('')
      void flushSetlistCapos(library.userId).catch(error=>setPreferenceError(String(error.message)))
    }
  }

  const historyFullSetRef=useRef(fullSetReading)
  historyFullSetRef.current=fullSetReading
  const historySongRef=useRef<Song|null>(null)
  historySongRef.current=selectedSong
  useEffect(()=>{
    if(!selectedSong||setlistSongEditor)return
    const state=history.state??{}
    if(state.bicSong===selectedSong.id)return
    const next={...state,bicSong:selectedSong.id}
    if(state.bicMode==='adding')delete next.bicMode
    if(state.bicSong || state.bicMode==='adding')history.replaceState(next,'',location.href)
    else history.pushState(next,'',location.href)
  },[selectedSong?.id])
  useEffect(()=>{
    const back=(event:PopStateEvent)=>{
      setReaderEdit(null)
      setlistReturnFocus.current=null
      activeSetlistSongEditor.current=null
      setSetlistSongEditor(null)
      if(historyFullSetRef.current&&!event.state?.bicFullSet)returnToFullSetButton.current=true
      if(event.state?.bicFullSet)fullSetCard.current=typeof event.state.bicFullSet==='string'?event.state.bicFullSet:null
      setFullSetReading(!!event.state?.bicFullSet)
      setSetlistId(event.state?.bicSetlist??null)
      if(typeof event.state?.bicSetlistIndex==='boolean')setLibraryView(event.state.bicSetlistIndex?'setlists':'songs')
      setFolder(event.state?.bicFolder??'all')
      if(event.state?.bicSong){
        const song=library.songs.find(item=>item.id===event.state.bicSong)
        if(song){selectSong(song);setReadingMode(event.state.bicMode==='reading');setIsEditing(event.state.bicMode==='editing')}
        setIsAddingSong(false)
      } else if(historySongRef.current){
        setSelectedSong(null);setIsEditing(false);setReadingMode(false);setIsAddingSong(event.state?.bicMode==='adding')
        const libraryScroll=event.state?.bicLibraryScroll
        if(!event.state?.bicSetlist&&typeof libraryScroll==='number'){
          requestAnimationFrame(()=>window.scrollTo(0,libraryScroll))
        }
      } else {setIsAddingSong(event.state?.bicMode==='adding')}
    }
    window.addEventListener('popstate',back)
    return ()=>window.removeEventListener('popstate',back)
  },[library.songs])

  useEffect(()=>{
    if(!selectedSong)return
    const frame=requestAnimationFrame(()=>window.scrollTo(0,0))
    return ()=>cancelAnimationFrame(frame)
  },[selectedSong?.id])
  useEffect(()=>{
    if(!setlistId||fullSetReading)return
    const frame=requestAnimationFrame(()=>window.scrollTo(0,0))
    return ()=>cancelAnimationFrame(frame)
  },[setlistId])

  const currentSongId = useRef<number | null>(null)
  currentSongId.current = selectedSong?.id ?? null
  const [savingKey,setSavingKey]=useState(false)
  const [transpose, setTranspose] = useState(0)

  const [isEditing, setIsEditing] = useState(false)
  const [savingSong,setSavingSong]=useState(false)
  const songSaveInProgress=useRef(false)
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


  const [newSong,setNewSong]=useState(emptyNewSong)
  const [newSongError,setNewSongError]=useState('')
  const newChart=useMemo(()=>prepareNewSong(newSong),[newSong])
  const songsByTitle=useMemo(()=>{
    const groups=new Map<string,Song[]>()
    for(const song of songList){
      const title=normalizeTitle(song.title)
      const rows=groups.get(title)??[]
      rows.push(song)
      groups.set(title,rows)
    }
    return groups
  },[songList])
  const newTitle=normalizeTitle(newChart.title)
  const existingPersonal=songsByTitle.get(newTitle)??[]
  const existingChurch=(library.offlineData?.church??[]).filter(song=>normalizeTitle(song.title)===newTitle)
  const newSongMatches=existingPersonal.length?existingPersonal:existingChurch
  const [editedRaw,setEditedRaw]=useState('')
  const recoveryKey=draftKey(library.userId,library.ownerId?'personal':'church')
  const [songDrafts,setSongDrafts]=useState(()=>library.sharedSetlist?[]:readSongDrafts(recoveryKey))
  const [draftStatus,setDraftStatus]=useState('')
  const dirtySong=!!isEditing&&!!selectedSong&&(editedTitle!==selectedSong.title||editedArtist!==selectedSong.artist||editedKey!==selectedSong.key||editedContent!==selectedSong.content||!!editedRaw.trim())
  const dirtyNew=isAddingSong&&!!(newSong.title.trim()||newSong.artist.trim()||newSong.key.trim()||newSong.text.trim()||newSong.alternate)
  useUnsavedChanges(dirtySong||dirtyNew,savingSong)
  const readerDirty=!!readerEdit&&readerEdit.content!==readerEdit.song.content
  useUnsavedChanges(readerDirty,readerSaving)
  useEffect(()=>{
    if(!readerEdit||!readerDirty)return
    const {song,content}=readerEdit
    setSongDrafts(writeSongDraft(recoveryKey,{id:'song:'+song.id,songId:song.id,baseRevision:song.revision,
      title:song.title,artist:song.artist,key:song.key,content,raw:'',folderId:song.folder_id??null,updatedAt:new Date().toISOString()}))
  },[readerEdit,readerDirty,recoveryKey])

  function openRawEditor(song:Song,occurrence:string,trigger:HTMLElement){
    if(!canEditInReader||readerSavePending.current||!allowNavigation())return
    const draft=readSongDrafts(recoveryKey).find(row=>row.songId===song.id)
    if(draft&&(!canResumeSongDraft(draft,song)||draft.raw||draft.title!==song.title||draft.artist!==song.artist||draft.key!==song.key||
      (draft.folderId??null)!==(song.folder_id??null))){
      setNotice('Recover your existing draft from the Songs tab before editing this chart in the reader.')
      return
    }
    setNotice('');setReaderError('')
    setReaderEdit({song,occurrence,content:draft?.content??song.content,scroll:window.scrollY,trigger})
    requestAnimationFrame(()=>document.querySelector<HTMLElement>('[data-reader-edit-heading]')?.focus())
  }
  function lockReader(){
    if(!readerEdit)return
    const {trigger,scroll}=readerEdit
    setReaderEdit(null);setReaderError('')
    requestAnimationFrame(()=>{window.scrollTo(0,scroll);trigger.focus({preventScroll:true})})
  }
  function cancelReaderEdit(){
    if(!readerEdit||readerSavePending.current)return
    if(readerDirty&&!window.confirm('Discard your unsaved chart changes?'))return
    clearDraft('song:'+readerEdit.song.id)
    lockReader()
  }
  async function saveReaderEdit(){
    if(!readerEdit||readerSavePending.current)return
    if(!readerDirty){clearDraft('song:'+readerEdit.song.id);lockReader();return}
    if(!canEditInReader||hasFlowConflicts(readerEdit.content))return
    readerSavePending.current=true;setReaderSaving(true);setReaderError('')
    try{
      const saved=await library.update({...readerEdit.song,content:readerEdit.content})
      setSelectedSong(current=>current?.id===saved.id?saved:current)
      clearDraft('song:'+saved.id)
      lockReader()
      setNotice('Chart saved.')
    }catch(error){setReaderError(error instanceof Error?error.message:String((error as {message?:string})?.message??error))}
    finally{readerSavePending.current=false;setReaderSaving(false)}
  }
  useEffect(()=>{
    if(library.sharedSetlist||!library.canEdit)return
    const draft:SongDraft|null=dirtyNew?{id:'new',songId:null,title:newSong.title,artist:newSong.artist,artistEntered:newSong.artistEntered,key:newSong.key,content:newSong.mode==='formatted'?newSong.text:'',raw:newSong.mode!=='formatted'?newSong.text:'',inputMode:newSong.mode,alternateInput:newSong.alternate,folderId:folder==='all'||folder==='unfiled'?null:folder,updatedAt:new Date().toISOString()}:dirtySong&&selectedSong?{id:'song:'+selectedSong.id,songId:selectedSong.id,baseRevision:selectedSong.revision,title:editedTitle,artist:editedArtist,key:editedKey,content:editedContent,raw:editedRaw,folderId:selectedSong.folder_id??null,updatedAt:new Date().toISOString()}:null
    if(!draft){const id=isAddingSong?'new':isEditing&&selectedSong?'song:'+selectedSong.id:null;if(id&&readSongDrafts(recoveryKey).some(row=>row.id===id)){setSongDrafts(removeSongDraft(recoveryKey,id));setDraftStatus('')}return}
    setSongDrafts(writeSongDraft(recoveryKey,draft))
    setDraftStatus(loginPersistence.isPersisted(recoveryKey)?'Draft saved on this browser. Save the song to update the database.':'Draft is only in memory. Browser storage is unavailable or full; do not close this tab before saving.')
  },[recoveryKey,isAddingSong,isEditing,library.canEdit,library.sharedSetlist,dirtyNew,dirtySong,newSong,editedTitle,editedArtist,editedKey,editedContent,editedRaw,selectedSong?.id,folder])
  function clearDraft(id:string){setSongDrafts(removeSongDraft(recoveryKey,id));setDraftStatus('')}
  function recoverDraft(draft:SongDraft, withinSet=false, selected?:Song){
    if(!library.canEdit||(!withinSet&&(library.loading||!allowNavigation())))return
    const current=selected??songList.find(song=>song.id===draft.songId)
    const canResume=canResumeSongDraft(draft,current)
    if(draft.songId!==null&&!canResume&&!window.confirm('This song changed or was deleted after the draft began. Recover it as a new song instead? The current saved version will stay unchanged.'))return
    if(canResume&&current){selectSong(current,true);setEditedTitle(draft.title);setEditedArtist(draft.artist);setEditedKey(draft.key);setEditedContent(draft.content);setEditedRaw(draft.raw);setIsEditing(true);setIsAddingSong(false)}
    else {if(draft.songId!==null&&songDrafts.some(row=>row.id==='new')){setNotice('Recover or discard your existing new-song draft first.');return}setSelectedSong(null);setNewSong(recoverNewSong(draft));setNewSongError('');setFolder(draft.folderId??'all');setIsEditing(false);setIsAddingSong(true);if(draft.songId!==null)clearDraft(draft.id)}
    setNotice(canResume?'Draft recovered. Review and save when ready.':'Draft recovered as a new song. Review it before saving.')
  }
  function startNewSong(withinSet=false){
    if(!withinSet&&!allowNavigation())return
    const draft=songDrafts.find(row=>row.id==='new')
    if(draft){recoverDraft(draft,withinSet);return}
    setNewSong(emptyNewSong);setNewSongError('');setIsAddingSong(true)
  }
  function openSetlistSongEditor(song:Song|null,onSaved:(song:Song)=>void,returnFocus:HTMLElement){
    if(!library.canEdit)return
    const draft=song&&songDrafts.find(row=>row.id==='song:'+song.id)
    if(draft&&!canResumeSongDraft(draft,song)){
      setNotice('This arrangement changed since your song draft began. Recover that draft from the Songs tab before editing here.')
      return
    }
    setNotice('')
    setSetlistSongEditor({onSaved,returnFocus})
    if(draft&&song)recoverDraft(draft,true,song)
    else if(song){selectSong(song,true);setIsEditing(true)}
    else {setFolder('all');startNewSong(true)}
    requestAnimationFrame(()=>document.querySelector<HTMLElement>('[data-setlist-song-heading]')?.focus())
  }
  function returnToSetlist(saved?:Song){
    if(!setlistSongEditor||activeSetlistSongEditor.current!==setlistSongEditor)return
    if(saved)setlistSongEditor.onSaved(saved)
    setlistReturnFocus.current=setlistSongEditor.returnFocus
    setSetlistSongEditor(null)
    setSelectedSong(null);setIsEditing(false);setIsAddingSong(false);setNotice('')
  }
  useEffect(()=>{
    if(setlistSongEditor)return
    const button=setlistReturnFocus.current
    if(!button)return
    setlistReturnFocus.current=null
    if(button.isConnected)button.focus()
  },[setlistSongEditor])
  function switchLibraryView(view:'songs'|'setlists'){
    history.replaceState({...history.state,bicSetlistIndex:view==='setlists'},'',location.href)
    setLibraryView(view)
  }
  function canCancelSong(dirty:boolean){
    if(songSaveInProgress.current)return false
    return setlistSongEditor
      ? !dirty||window.confirm('Discard the unsaved song changes and return to the set?')
      : allowNavigation()
  }
  function cancelNewSong(){if(!canCancelSong(dirtyNew))return;clearDraft('new');setNewSong(emptyNewSong);setNewSongError('');setIsAddingSong(false);returnToSetlist()}


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

  useEffect(()=>{
    if(!library.offline&&(fullSetReading||(setlistId&&setlistId!=='new')))void library.refresh()
  },[fullSetReading,setlistId])

  function readFullSet(listId?:string){
    if(!allowNavigation())return
    const next={...history.state,bicFullSet:listId??true}
    if(listId){
      next.bicSetlist=listId
      delete next.bicSong
      delete next.bicMode
      setSetlistId(listId)
    }
    history.pushState(next,'',location.href)
    fullSetCard.current=listId??null
    setFullSetReading(true)
  }
  function exitFullSet(){
    if(readerSavePending.current)return
    if(history.state?.bicFullSet)history.back()
    else if(allowNavigation()){setReaderEdit(null);returnToFullSetButton.current=true;setFullSetReading(false)}
  }
  function openSetlist(id:string){
    if(!allowNavigation())return
    const next={...history.state,bicSetlist:id};delete next.bicSong;delete next.bicMode
    if(setlistId)history.replaceState(next,'',location.href);else history.pushState(next,'',location.href)
    setSetlistId(id);setSelectedSong(null);setIsAddingSong(false)
  }
  function backToSetlists(){if(history.state?.bicSetlist)history.back();else if(allowNavigation())setSetlistId(null)}
  function selectFolder(id:string){setFolder(id);history.replaceState({...history.state,bicFolder:id},'',location.href)}
  function openFolder(id:string){
    const next={...history.state,bicFolder:id};delete next.bicSong;delete next.bicMode;delete next.bicSetlist
    history.pushState(next,'',location.href);setFolder(id);setSelectedSong(null);setIsEditing(false);setReadingMode(false);setSetlistId(null);setLetter('All');setArtistFilter('all');setSearch('');setFavoritesOnly(false);resetSongSort()
  }
  const libraryPage=!selectedSong&&!isAddingSong&&!setlistId
  const setlistIndex=libraryPage&&!!library.ownerId&&libraryView==='setlists'
  const artists=[...new Map(songList.filter(song=>song.artist.trim()).map(song=>[song.artist.trim().toLowerCase(),song.artist.trim()])).entries()].sort((a,b)=>a[1].localeCompare(b[1]))
  const selectSong = (song: Song,force=false) => {
    if(!force&&song.id!==currentSongId.current&&!allowNavigation())return
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
    clearDraft(isAddingSong?'new':'song:'+startedSong);setEditedRaw('');
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
    if(songSaveInProgress.current)return
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

    songSaveInProgress.current=true
    setSavingSong(true)
    try {
      const saved=await library.update(updatedSong)
      clearDraft('song:'+updatedSong.id);setEditedRaw('')
      if(setlistSongEditor){returnToSetlist(saved);return}
      if(currentSongId.current===updatedSong.id){setSelectedSong(saved);setEditedTitle(saved.title);setEditedArtist(saved.artist);setEditedKey(saved.key);setEditedContent(saved.content);setIsEditing(false)}
    } catch(error){setNotice(String(error instanceof Error?error.message:error))}
    finally{songSaveInProgress.current=false;setSavingSong(false)}
  }

  async function finishNewSong(save:()=>Promise<Song>){
    if(songSaveInProgress.current)return
    songSaveInProgress.current=true
    setSavingSong(true);setNewSongError('')
    try{
      const saved=await save()
      clearDraft('new')
      setNewSong(emptyNewSong)
      if(setlistSongEditor)returnToSetlist(saved)
      else {setSelectedSong(saved);setTranspose(0);setIsAddingSong(false)}
    }catch(error){
      setNewSongError(error instanceof Error?error.message:String((error as {message?:string})?.message??error))
    }finally{
      songSaveInProgress.current=false;setSavingSong(false)
    }
  }

  async function addSong(){
    if(!newChart.title){setNewSongError('Enter a song title.');return}
    if(!songKey(newChart.key)){setNewSongError('Enter a key such as D or F#m.');return}
    if(!newChart.content.trim()){setNewSongError('Paste a chart with lyrics or chords.');return}
    if(hasFlowConflicts(newChart.content)){
      setNewSongError('Give repeated sections with different lyrics or chords distinct names, such as Chorus 1 and Chorus 2.')
      return
    }
    if(!library.ownerId&&newSongMatches.length)return
    await finishNewSong(async()=>{
      const [saved]=await library.add([{
        id:Date.now(),folder_id:folderNames.some(item=>item.id===folder)?folder:null,
        title:newChart.title,artist:newChart.artist,key:newChart.key,category:'',content:newChart.content,
      }])
      if(!saved)throw new Error('No saved song was returned.')
      return saved
    })
  }

  function useChartInSet(song:Song){
    if(!setlistSongEditor||!library.ownerId||!library.canEdit||library.offline||songSaveInProgress.current)return
    if((newSong.text.trim()||newSong.alternate)&&!window.confirm('Use this existing chart and discard the new song draft?'))return
    void finishNewSong(async()=>{
      if(existingPersonal.some(match=>match.id===song.id))return song
      const {data,error}=await cloud!.rpc('ensure_personal_church_song',{church_song_id:song.id})
      if(error)throw error
      if(!data)throw new Error('Could not add the existing chart.')
      void library.refresh()
      return data as Song
    })
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
    if(!canCancelSong(dirtySong))return
    if (!selectedSong) {
      return
    }

    clearDraft('song:'+selectedSong.id);setEditedRaw('')
    setEditedTitle(selectedSong.title)
    setEditedArtist(selectedSong.artist)
    setEditedKey(selectedSong.key)
    setEditedContent(selectedSong.content)

    setIsEditing(false)
    returnToSetlist()
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

  const canEditInReader=!!library.ownerId&&library.canEdit&&!library.offline&&!library.sharedSetlist
  const readerEditor=readerEdit?<ReaderChartEditor key={readerEdit.occurrence} content={readerEdit.content}
    onChange={content=>setReaderEdit({...readerEdit,content})}
    baseKey={readerEdit.song.key} busy={readerSaving} canSave={!readerDirty||canEditInReader}
    error={readerError||(!canEditInReader?'Reconnect to save your chart.':'')} dirty={readerDirty}
    onSave={()=>void saveReaderEdit()} onCancel={cancelReaderEdit}/>:null
  const fullReader:FullReaderControls|null=fullSetReading?{
    userId:library.userId,preferenceId,legacyId:oldPreferenceId,offline:!!library.offline,
    content:readingContent,changeContent:setReadingContent,changeCapo,exit:exitFullSet,
    wakeStatus,preferenceError,fontSize,changeFontSize:setFontSize,readerColumns,changeColumns:setReaderColumns,
    onEditRaw:canEditInReader?openRawEditor:undefined,editingOccurrence:readerEdit?.occurrence,editor:readerEditor,
    cancelEditing:cancelReaderEdit
  }:null
  if(fullReader&&library.sharedSetlist)return <div className="app"><main>
    <FullSetlistReader title={library.bookName} songs={songList} controls={fullReader}/>
  </main></div>

  return (
    <div className="app">
      <header>
        <h1 className="brand"><img src="/bic-logo.png" alt="BIC" /> BIC Worship DB</h1><p>{library.bookName} · <a href="/guide.html" target="_blank" rel="noopener">ⓘ User guide</a></p>
      </header>

      <main>
        {!selectedSong&&library.sharedSetlist&&<div className="setlist-primary-actions">
          <button className="worship-primary" data-read-full-set="" onClick={()=>readFullSet()}>Read full set</button>
        </div>}
        <MenuSection><div className="library-tools">
          <button onClick={() => downloadSongs(songList)}>Export songs only</button>

          <label className="import-label" hidden={!library.canEdit}>Import songs<input type="file" accept=".json,application/json" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = '' }} /></label>
        </div>
        {!library.sharedSetlist&&!library.offline&&<CompleteBackup key={library.userId+'-'+library.ownerId} userId={library.userId} church={!library.ownerId} canEdit={library.canEdit} onChanged={library.refresh}/>}
        {!library.sharedSetlist&&library.canEdit&&<SongHistory ownerId={library.ownerId} currentSongs={songList} onChanged={library.refresh}/>}
        <p className="storage-note">{library.bookName} · {library.offline?'Reading saved copies. Reconnect to edit or share.':'Changes save online. Export a backup whenever you need one.'}</p></MenuSection>
        {!selectedSong && library.sharedSetlist && <SetlistKeyOverview songs={songList}/>}

        {libraryPage&&library.ownerId&&<nav className="library-tabs" aria-label="My songbook views"><button aria-pressed={!setlistIndex} onClick={()=>switchLibraryView('songs')}>Songs</button><button aria-pressed={setlistIndex} onClick={()=>switchLibraryView('setlists')}>Setlists</button></nav>}
        {libraryPage&&!setlistIndex&&!library.sharedSetlist&&<SongDraftRecovery drafts={songDrafts} canRestore={library.canEdit&&!library.loading} onRestore={recoverDraft} onDiscard={draft=>{if(window.confirm('Permanently discard this unsaved draft?'))clearDraft(draft.id)}}/>}
        {(isAddingSong||isEditing)&&draftStatus&&<p className="storage-note" role="status">{draftStatus}</p>}

        {(setlistSongEditor||(!selectedSong&&!isAddingSong)) && library.ownerId && (setlistId||setlistIndex) && <div hidden={!!setlistSongEditor}><SongOrganization activeId={setlistId} onNavigate={openSetlist} onBack={backToSetlists} churchSongs={library.offlineData?.church??[]} onSongsChanged={library.refresh} offlineLists={library.offline?library.offlineData?.setlists:undefined} ownerId={library.ownerId} songs={songList} canEdit={library.canEdit} onSongEditor={openSetlistSongEditor} fullReader={fullReader} onReadFull={readFullSet}/></div>}
        {favoriteError && <p role="status" className="notice">{favoriteError}</p>}
        {notice && <p role="status" className="notice">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></p>}
        {!setlistId && incoming && <section className="incoming"><h2>A friend shared “{incoming.title}”</h2><p>{incoming.artist} · Key: {incoming.key}</p><button disabled={!library.canEdit} onClick={async () => { try { const [song] = await library.add([incoming]); selectSong(song); setIncoming(null); history.replaceState(history.state, '', location.pathname + location.search) } catch (error) { setNotice(String(error instanceof Error ? error.message : error)) } }}>Add to this songbook</button><button onClick={() => {setIncoming(null); history.replaceState(history.state, '', location.pathname + location.search)}}>Dismiss</button></section>}

        {!selectedSong&&!isAddingSong&&(setlistId||setlistIndex) ? null : !selectedSong ? (
          isAddingSong ? (
            <AddSongForm input={newSong} onChange={input=>{setNewSong(input);setNewSongError('')}}
              chart={newChart} matches={newSongMatches} personal={!!library.ownerId} inSet={!!setlistSongEditor}
              offline={!!library.offline} busy={savingSong} error={newSongError}
              onSave={()=>void addSong()} onCancel={cancelNewSong} onUseExisting={useChartInSet}
              onOpenExisting={song=>{
                if(!canCancelSong(dirtyNew))return
                setNewSongError('');setIsAddingSong(false);selectSong(song,true)
              }}/>

          ) : (
            <>
              <div className="song-search-toolbar">
                <input type="search" aria-label="Search songs" placeholder="Search songs…" value={search}
                  onChange={event=>setSearch(event.target.value)}/>
                {library.canEdit&&<button className="add-song-button" onClick={()=>startNewSong()}>+ Add Song</button>}
              </div>

              {filteredSongs.length === 0 && <p>No songs found. Try another search or add a song.</p>}
              {!library.sharedSetlist&&<details className="song-filters library-toggle"><summary>Filters</summary>{library.ownerId&& <SongFolders songs={songList} canEdit={library.canEdit} offlineFolders={library.offline?library.offlineData?.folders:undefined} userId={library.userId} selected={folder} onSelect={selectFolder} onFolders={setFolderNames} onChanged={library.refresh}/>}<label>Author / singer<select value={artistFilter} onChange={event=>setArtistFilter(event.target.value)}><option value="all">All artists</option><option value="__none">No artist listed</option>{artists.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="song-sort">Sort songs<select aria-label="Sort songs" value={dateSort} onChange={event=>setDateSort(event.target.value as SongDateSort)}>{(Object.entries(songSortLabels) as [SongDateSort,string][]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{dateSort.startsWith('added')&&<p className="storage-note">Songs without a recorded date added appear last.</p>}<nav className="alphabet-filter" aria-label="Filter by first letter">{['All',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ','#'].map(value=><button key={value} aria-pressed={letter===value} onClick={()=>setLetter(value)}>{value}</button>)}</nav><button className="favorite-filter" aria-pressed={favoritesOnly} onClick={()=>setFavoritesOnly(!favoritesOnly)}>{favoritesOnly?'★ Favorites only — show all':'☆ Show my favorites'}</button></details>}
              {!library.sharedSetlist&&(letter!=='All'||artistFilter!=='all'||favoritesOnly||dateSort!=='title')&&<p className="active-filters">Filters: {letter!=='All'&&`Title ${letter} · `}{artistFilter!=='all'&&`Artist: ${artistFilter==='__none'?'Not listed':artists.find(([value])=>value===artistFilter)?.[1]??artistFilter} · `}{favoritesOnly&&'Favorites '}{dateSort!=='title'&&`Sort: ${songSortLabels[dateSort]} `}<button onClick={()=>{setLetter('All');setArtistFilter('all');setFavoritesOnly(false);resetSongSort()}}>Clear song filters</button></p>}
              {folder!=='all'&&<p>Folder: {folderNames.find(item=>item.id===folder)?.name??'Selected folder'} <button onClick={()=>selectFolder('all')}>Show all songs</button></p>}
              <div className="song-list">
                {filteredSongs.map((song) => (
                  <button
                    key={song.id}
                    className="song-item"
                    onClick={()=>{
                      history.replaceState({...history.state,bicLibraryScroll:window.scrollY},'',location.href)
                      selectSong(song)
                    }}
                  >
                    <span className="library-song-name"><strong>{song.title}</strong>
                      {(songsByTitle.get(normalizeTitle(song.title))?.length??0)>1
                        ?<small>{songVersionDetails(song,songsByTitle.get(normalizeTitle(song.title))!)}</small>
                        :song.artist&&<small>{song.artist}</small>}</span>
                    <span className="library-song-key">{favorites.includes(song.id)&&<span aria-label="Favorite">★ </span>}
                      <strong className="key-badge" aria-label={song.key?'Key '+song.key:'Key not set'}>{song.key||'—'}</strong>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )
        ) : (
          <div className="song-view">
            <nav className="songbook-back-bar" aria-label="Song navigation"><button
              className="back-button"
              disabled={savingSong||readerSaving}
              onClick={() => {
                if(setlistSongEditor){cancelEditing();return}
                if(history.state?.bicSong)history.back()
                else if(allowNavigation()){setReaderEdit(null);setSelectedSong(null);setIsEditing(false);setReadingMode(false)}
              }}
            >
              {setlistId?'← Back to setlist':'← Back to songs'}
            </button></nav>

            <div className="song-heading"><h2 tabIndex={-1} data-setlist-song-heading title={selectedSong.title}>{selectedSong.title}</h2>
            {!isEditing && !readingMode && !library.sharedSetlist && <button className="favorite-filter" disabled={favoriteBusy||library.offline} aria-pressed={favorites.includes(selectedSong.id)} onClick={()=>void toggleFavorite(selectedSong.id)}>{favorites.includes(selectedSong.id)?'★ Remove favorite':'☆ Add to my favorites'}</button>}
</div>


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
              <fieldset className="song-form" disabled={savingSong}>
                {setlistSongEditor&&<p>Saving changes updates your personal chart in every set that uses it, including live shared sets.</p>}
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

                <ChordSheetPaste title={editedTitle} songKey={editedKey} raw={editedRaw} onRawChange={setEditedRaw} key={selectedSong.id} onApply={(content,title,key)=>{setEditedContent(content);if(title)setEditedTitle(title);if(key)setEditedKey(key)}}/>
                <label>
                  Song Content
                  <textarea
                    className="song-editor"
                    value={editedContent}
                    onChange={(event) =>
                      editLinkedText(event.currentTarget,editedContent,setEditedContent)
                    }
                  />

                  <small className="editor-help">
                    Use <strong># Verse 1</strong>, <strong># Chorus</strong> or <strong># Tag</strong> for sections. Use <strong>{'{C}'}</strong> and <strong>{'{G/B}'}</strong> for chords. Existing # headings and [C] chords still work.
                  </small>
                </label>

                <ChordPositionEditor content={editedContent} onChange={value=>setEditedContent(current=>syncLinkedSections(current,value))} disabled={savingSong||library.offline}/>
                <DuplicateSongNotice onOpen={setlistSongEditor?undefined:openDuplicate} canOverwrite={song=>!!library.canEdit&&!!duplicateTarget(song)} onOverwrite={setlistSongEditor?undefined:song=>overwriteDuplicate(song,{title:editedTitle,artist:editedArtist,key:editedKey,content:editedContent})} title={editedTitle} personal={!!library.ownerId} excludeId={library.ownerId?undefined:selectedSong.id} onUseExisting={song=>{setEditedTitle(song.title);setEditedArtist(song.artist);setEditedKey(song.key);setEditedContent(song.content)}}/>
                <div className="edit-buttons">
                  <button
                    className="save-button"
                    disabled={savingSong||library.offline||hasFlowConflicts(editedContent)} title={hasFlowConflicts(editedContent)?'Resolve section variations in Song flow first':undefined} onClick={saveSong}
                  >
                    {setlistSongEditor?'Save arrangement':'Save Changes'}
                  </button>

                  <button
                    className="cancel-button"
                    disabled={savingSong}
                    onClick={cancelEditing}
                  >
                    Cancel
                  </button>
                </div>
              </fieldset>
            ) : (
              <div className="song-actions">
                <button disabled={library.offline} onClick={() => void shareSong(selectedSong)}>Share Song</button>
                <details className="copy-options"><summary>Copy</summary>
                  <button onClick={()=>void copySong(false)}>Copy with chords</button>
                  <button onClick={()=>void copySong(true)}>Copy lyrics</button>
                  <button onClick={()=>downloadChordPro(selectedSong)}>Export ChordPro</button>
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
                disabled={savingKey||!!readerEdit}
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
                disabled={savingKey||!!readerEdit}
                aria-label="Transpose up one semitone"
                onClick={() =>
                  changeTranspose(1)
                }
              >
                +
              </button>
              {!isEditing && library.ownerId && library.canEdit && <button className="save-key-button" disabled={savingKey||!!readerEdit||transpose===0||!/^([A-G](?:#|b)?)(m|maj|min)?$/.test(selectedSong.key)} onClick={()=>void saveInCurrentKey()}>{savingKey?'Saving…':`Save in ${getCurrentKey(selectedSong.key,transpose)} as base key`}</button>}
              {!isEditing && !readerEdit && <button className="reading-toggle" aria-pressed={readingMode} onClick={() => {if(readingMode)setReadingMode(false);else setReadingChoice(value=>!value)}}>{readingMode?'Exit reading mode':'Reading mode'}</button>}
            </div>
            {!isEditing&&!readingMode&&<ReadingTextSize value={fontSize} onChange={setFontSize}/>}
            </div>
            {!isEditing&&readingChoice&&!readingMode&&<fieldset className="reading-choice"><legend>Reading mode content</legend><p>Choose what to show. Your saved song stays unchanged.</p><button onClick={()=>{setReadingContent('lyrics');setReadingChoice(false);setReadingMode(true)}}>Lyrics only</button><button onClick={()=>{setReadingContent('chords');setReadingChoice(false);setReadingMode(true)}}>Lyrics + chords</button><button onClick={()=>setReadingChoice(false)}>Cancel reading mode</button></fieldset>}
            {!isEditing && (<>
              {readingMode&&<div className="reading-layout-options">
                <label className="reader-content-choice">Reading content<select aria-label="Reading content" value={readingContent} onChange={event=>setReadingContent(event.target.value as 'lyrics'|'chords')}><option value="lyrics">Lyrics only</option><option value="chords">Lyrics + chords</option></select></label>
                <ReadingColumns value={readerColumns} onChange={setReaderColumns}/>
                <ReadingTextSize value={fontSize} onChange={setFontSize}/>
              </div>}
              {readingMode&&<small role="status">{wakeStatus}</small>}
              {readingMode&&canEditInReader&&<button type="button" hidden={!!readerEdit}
                onClick={event=>openRawEditor(selectedSong,'single-'+selectedSong.id,event.currentTarget)}>Edit raw content</button>}
              {readingMode&&readerEditor}
              {readingMode ? <div hidden={!!readerEdit}><SongPages key={selectedSong.id+'-'+readingContent} columnPreference={readerColumns} fontSize={fontSize} onFitFontSize={setFontSize}>{displaySong(selectedSong.content,transpose,getCurrentKey(selectedSong.key,transpose),true,readingContent==='chords')}</SongPages></div> : <div className="song-display" style={{fontSize: `${fontSize}px`}} tabIndex={0} aria-label="Song lyrics and chords">
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

export default App

