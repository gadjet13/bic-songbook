const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),api={};const chord={};vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/chord/transpose.ts','utf8'),{module:ts.ModuleKind.CommonJS}),{exports:chord});vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/song-flow.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}),{exports:api,require:()=>chord});
const linked='[Verse 1]\n{G}Morning words\n\n[Chorus]\n{C}Shared words\n\n[Verse 2]\n{D}Other words\n\n[Chorus]\n{C}Shared words';const labels=text=>Array.from(api.parseSongFlow(text).sections,x=>x.label);
test('lossless parsing keeps unsectioned text, legacy headings, Unicode, spaces and CRLF',()=>{for(const text of ['',linked,'{G}Opening 😀\r\n\r\n# Verse 1\r\n  {G}Words\r\n\r\n[Chorus]\r\n[D/F#]\r\nLast','[Verse 1]','No headings at all\n'])assert.equal(api.serializeSongFlow(api.parseSongFlow(text)),text)});
test('chord-only lines are never sections',()=>{assert.deepEqual(labels('[G]\n{C}Words\n[A/C#]\n[Verse 1]\n[Cmaj7]\n# Bridge\n[D]'),['Verse 1','Bridge'])});
test('numbered variations avoid existing labels and name equivalent repeats consistently',()=>{const text='[Chorus 1]\nExisting\n[Chorus]\nA\n[Chorus]\nB\n[Chorus]\nA';const result=api.namePastedSectionVariants(text);assert.deepEqual(labels(result),['Chorus 1','Chorus 2','Chorus 3','Chorus 2']);assert.equal(api.hasFlowConflicts(result),false)});

test('heading-only repeats reuse the previous written section or the first later one',()=>{
 const chart='# Chorus\n\n# Chorus\n{G}First\n# Chorus\n\t\n# Chorus\n{D}Second\n# Chorus\n\n# Intro'
 const repeats=Array.from(api.resolveSectionRepeats(api.parseSongFlow(chart).sections))
 assert.deepEqual(repeats.map(section=>section.label),['Chorus 1','Chorus 1','Chorus 1','Chorus 2','Chorus 2','Intro'])
 assert.deepEqual(repeats.map(section=>section.bodyIndex),[1,1,1,3,3,5])
 const named=api.namePastedSectionVariants(chart)
 assert.deepEqual(labels(named),['Chorus 1','Chorus 1','Chorus 1','Chorus 2','Chorus 2','Intro'])
 assert.equal(api.parseSongFlow(named).sections[4].body.trim(),'')
 assert.equal(api.hasFlowConflicts(named),false)
})

test('identical repeated sections and unresolved headings keep their names',()=>{
 const chart='# Chorus\r\n{G}Same words\r\n\r\n# chorus\r\n\r\n# CHORUS\r\n{G}Same words\r\n# Intro\r\n'
 const repeats=Array.from(api.resolveSectionRepeats(api.parseSongFlow(chart).sections))
 assert.deepEqual(repeats.map(section=>section.label),['Chorus','chorus','CHORUS','Intro'])
 assert.deepEqual(repeats.map(section=>section.bodyIndex),[0,0,2,3])
 assert.equal(api.namePastedSectionVariants(chart),chart)
})

test('compact repeats keep every heading and one body per distinct section', () => {
  const chart = '# Chorus\n\n# Chorus\n{G}First\n# Chorus\n{G}First\n# Chorus\n{D}Second\n# Chorus\n\n# Intro'
  const sections = Array.from(api.compactSectionRepeats(api.parseSongFlow(chart).sections))
  assert.deepEqual(sections.map(section => section.label), ['Chorus 1', 'Chorus 1', 'Chorus 1', 'Chorus 2', 'Chorus 2', 'Intro'])
  assert.deepEqual(sections.map(section => section.bodyIndex), [null, 1, null, 3, null, null])
})
