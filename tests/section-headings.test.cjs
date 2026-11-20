const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
const api={}
vm.runInNewContext(ts.transpile(readFileSync('src/lib/chord/transpose.ts','utf8'),{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}),{exports:api})
const cases=require('./section-headings.cases.json')

test('canonical headings preserve chords and source spacing and are idempotent',()=>{
 for(const [source,expected] of cases){
  assert.equal(api.normalizeSectionHeadings(source),expected)
  assert.equal(api.normalizeSectionHeadings(expected),expected)
 }
})
test('annotated headings read consistently in the original and performance keys',()=>{
 const line='Verse1 [slight soft]'
 assert.equal(api.sectionHeading(line),'Verse1 [slight soft]')
 assert.equal(api.sectionHeading('# A'),'A')
 assert.equal(api.sectionHeading('[D]'),undefined)
 assert.equal(api.transposeSongContent(line+'\n[A/C#]',2),line+'\n[B/D#]')
 assert.equal(api.lyricsOnly(line+'\n{A/C#}Words'),line+'\nWords')
})
