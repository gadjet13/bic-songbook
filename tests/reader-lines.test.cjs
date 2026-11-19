const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');const api={};vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/reader-lines.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}),{exports:api});
test('chords inside a lyric word are not wrapping boundaries',()=>{const words=api.readingWords([{chord:'',lyrics:'hel'},{chord:'G',lyrics:'lo beau'},{chord:'D',lyrics:'tiful world'}]);const tokens=words.filter(word=>word.kind==='word');assert.equal(tokens.length,3);assert.equal(tokens[0].parts.map(part=>part.lyrics).join(''),'hello');assert.equal(tokens[0].parts[1].chord,'G');assert.equal(tokens[1].parts.map(part=>part.lyrics).join(''),'beautiful')});
test('spaces, slash chords and adjacent chord-only tokens remain intact',()=>{const tokens=api.readingWords([{chord:'Bm',lyrics:''},{chord:'A/C#',lyrics:'  first word'}]);assert.equal(tokens[0].parts[1].chord,'A/C#');assert.equal(tokens.filter(token=>token.kind==='space').map(token=>token.text).join(''),'   ');assert.equal(tokens.filter(token=>token.kind==='word').map(token=>token.parts.map(part=>part.lyrics).join('')).join(''),'firstword')});
test('fit starts at the current size and stops immediately if it fits',()=>{const checked=[];assert.equal(api.fitReaderFont(16,500,size=>{checked.push(size);return 400}),16);assert.deepEqual(checked,[16])});
test('fit checks each descending size and stops at the first non-wrapping size',()=>{const checked=[];assert.equal(api.fitReaderFont(16,140,size=>{checked.push(size);return size*10}),14);assert.deepEqual(checked,[16,15,14]);assert.equal(api.fitReaderFont(20,200,size=>size*10),20)});
test('auto-fitting stops at 12px even if a long line must still wrap',()=>{const checked=[];assert.equal(api.fitReaderFont(16,20,size=>{checked.push(size);return size*10}),12);assert.deepEqual(checked,[16,15,14,13,12])});

test('automatic columns preserve the reader breakpoint and explicit choices override it',()=>{
  assert.equal(api.readerColumnCount('auto',699),1)
  assert.equal(api.readerColumnCount('auto',700),2)
  assert.equal(api.readerColumnCount('one',1280),1)
  assert.equal(api.readerColumnCount('two',390),2)
})
