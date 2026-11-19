const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const transpile=path=>ts.transpile(fs.readFileSync(path,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022})
const transpose={},api={}
vm.runInNewContext(transpile('src/lib/chord/transpose.ts'),{exports:transpose})
vm.runInNewContext(transpile('src/lib/reader-chart-edit.ts'),{exports:api,require:()=>transpose})

test('performance chord changes save in the base key, including slash bass',()=>{
 const pitch={key:'G',semitones:5,flats:false}
 assert.equal(api.storedChord('D/F#',pitch,'D'),'A/C#')
 assert.equal(api.performanceChord('A/C#',pitch),'D/F#')
 assert.equal(api.storedChord('Ab', {key:'Ab',semitones:0,flats:true},'Ab'),'Ab')
})

test('bar editing preserves separators and beat placeholders when adding and moving',()=>{
 const chart='(|D / G / | D / / / |)\r\n| A / |'
 assert.equal(api.changeBarChord(chart,0,4,'Bm'),'(|D Bm G / | D / / / |)\r\n| A / |')
 const target=api.editableBar(chart.split('\n')[1]).find(cell=>cell.text==='/').offset
 assert.equal(api.changeBarChord(chart,1,target,'D',{line:0,offset:2}),'(|/ / G / | D / / / |)\r\n| A D |')
 assert.ok(api.editableBar('| / / |'))
})
