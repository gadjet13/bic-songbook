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
load('./chord/transpose','chord/transpose')
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
