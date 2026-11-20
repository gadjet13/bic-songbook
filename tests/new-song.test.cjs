const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
const modules={}
function load(name,path){
 const exports=modules[name]={}
 vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/'+path+'.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}),{
  exports,require:id=>modules[id]
 })
 return exports
}
modules['./chord/transpose.ts']=load('./chord/transpose','chord/transpose')
load('./song-flow','song-flow')
load('./chord-sheet','chord-sheet')
load('./suggest-key','suggest-key')
const {emptyNewSong,prepareNewSong,recoverNewSong}=load('./new-song','new-song')

test('converts chord sheets and prefers entered fields over suggestions',()=>{
 const input={...emptyNewSong,text:'**Sample Song**\nKey: G\n[Verse]\nD    G\nWords go here'}
 const suggested=prepareNewSong(input)
 assert.equal(suggested.title,'Sample Song')
 assert.equal(suggested.key,'G')
 assert.match(suggested.content,/# Verse\n\{D\}Words\{G\} go here/)
 const manual=prepareNewSong({...input,title:'My arrangement',key:'Bm'})
 assert.equal(manual.title,'My arrangement')
 assert.equal(manual.key,'Bm')
})

test('preserves formatted chart spacing and avoids dropping a first lyric when the title is entered',()=>{
 const formatted=prepareNewSong({...emptyNewSong,mode:'formatted',text:' [Verse]\r\n{D}Hi   {G}\r\n'})
 assert.equal(formatted.content,' # Verse\r\n{D}Hi   {G}\r\n')
 assert.equal(prepareNewSong({...emptyNewSong,title:'My title',text:'First lyric\nD\nAnother line'}).content,'First lyric\n{D}Another line')
 assert.equal(prepareNewSong({...emptyNewSong,text:'Only words'}).key,'')
})

test('preserves both legacy chart texts and restores the saved mode',()=>{
 const old={title:'Example',artist:'',key:'G',raw:'G\nWords',content:'# Verse\n{G}Words'}
 const recovered=recoverNewSong(old)
 assert.equal(recovered.mode,'formatted')
 assert.equal(recovered.text,old.content)
 assert.equal(recovered.alternate.text,old.raw)
 const reopened=recoverNewSong({...old,inputMode:'chord-sheet',alternateInput:{mode:'formatted',text:old.content}})
 assert.equal(reopened.text,old.raw)
 assert.equal(reopened.alternate.text,old.content)
})

test('copied webpage charts keep their title, key, and distinct section performances',()=>{
 const pasted=[
  'X','Fixture Song Chords by Fixture Artist','Difficulty: beginner','Tuning: E A D G B E','Key: A',
  'Chords','D','F#m','E','Strumming pattern','144 bpm','1','&','2','&','',
  '[Intro]','D F#m E x2','',
  '[Verse]','D     F#m','First words here','',
  '[Chorus]','A','Sing along','',
  'Page 1/3',
  '[Verse]','D       F#m','Second words here','',
  '[Chorus]','A','Sing along','','A','Sing along','',
  '[Chorus]','A','Sing along','','A','Sing along','',
  '[Ending]','D F#m E x2','Page 3/3'
 ].join('\n')
 const result=prepareNewSong({...emptyNewSong,text:pasted})
 assert.equal(result.title,'Fixture Song')
 assert.equal(result.artist,'Fixture Artist')
 assert.equal(prepareNewSong({...emptyNewSong,text:pasted,artistEntered:true}).artist,'')
 assert.equal(result.key,'A')
 assert.equal(result.sectionsRenamed,true)
 assert.deepEqual(result.content.match(/^# .*$/gm),['# Intro','# Verse 1','# Chorus 1','# Verse 2','# Chorus 2','# Chorus 2','# Ending'])
 assert.match(result.content,/\{D\}First \{F#m\}words here/)
 assert.match(result.content,/\{D\}Second w\{F#m\}ords here/)
 assert.match(result.content,/^# Intro\n\{D\} \{F#m\} \{E\}  x2/)
 assert.doesNotMatch(result.content,/Strumming pattern|1\/3|Difficulty|Tuning|144 bpm/)
 assert.equal(modules['./song-flow'].hasFlowConflicts(result.content),false)
})

test('ordinary preambles and formatted variants keep their text',()=>{
 const raw='Fixture Song Chords by Fixture Artist\nThese words must stay\n[Verse]\nD\nOther words'
 assert.match(prepareNewSong({...emptyNewSong,text:raw}).content,/These words must stay/)
 const formatted='# Chorus\n{D}First\n# Chorus\n{G}Second'
 const result=prepareNewSong({...emptyNewSong,mode:'formatted',text:formatted})
 assert.equal(result.sectionsRenamed,false)
 assert.equal(result.content,formatted)
})

test('removes blank lines around pasted headings and keeps stanza breaks and formatted spacing',()=>{
 const raw='[Verse]\n \n\n{D}One line\n\n{G}Second stanza\n\n \n\n[Chorus]\n\n{A}Chorus line'
 const result=prepareNewSong({...emptyNewSong,text:raw})
 assert.equal(result.content,'# Verse\n{D}One line\n\n{G}Second stanza\n# Chorus\n{A}Chorus line')
 assert.equal(result.sectionsRenamed,false)
 const formatted=prepareNewSong({...emptyNewSong,mode:'formatted',text:raw})
 assert.equal(formatted.content,raw.replace('[Verse]','# Verse').replace('[Chorus]','# Chorus'))
})
