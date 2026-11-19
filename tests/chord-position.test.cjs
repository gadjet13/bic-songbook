const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');const api={};vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/chord-position.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}),{exports:api});
const lyrics=content=>content.split('\n').map(line=>{const parsed=api.parseChordPositions(line);return parsed.lyrics+parsed.ending}).join('\n');
const tokens=content=>content.split('\n').flatMap(line=>api.parseChordPositions(line).chords.map(chord=>chord.token)).sort().join('|');
test('moving modern and legacy slash chords preserves all lyric text and original notation',()=>{const original='[Verse 1]\r\n{Bm}Hello [A/C#]world\r\n';const moved=api.movePositionedChord(original,1,0,1,4);assert.equal(lyrics(moved.content),lyrics(original));assert.equal(tokens(moved.content),tokens(original));assert.equal(moved.content,'[Verse 1]\r\nHell{Bm}o [A/C#]world\r\n')});
test('cross-line moves preserve line endings and cannot put a chord into a section heading',()=>{const input='[Chorus]\n{G}First line\nSecond line';assert.equal(api.movePositionedChord(input,1,0,0,0),null);const moved=api.movePositionedChord(input,1,0,2,7);assert.equal(moved.content,'[Chorus]\nFirst line\nSecond {G}line');assert.equal(lyrics(moved.content),lyrics(input))});
test('Unicode boundaries do not split surrogate pairs',()=>{const input='{C}A😀B';assert.equal(api.movePositionedChord(input,0,0,0,2).content,'A{C}😀B');assert.equal(lyrics(api.movePositionedChord(input,0,0,0,3).content),'A😀B')});
test('multiple chords at one position stay present and keep deterministic order',()=>{const input='{C}{G}word {Am}next';const moved=api.movePositionedChord(input,0,2,0,0);assert.equal(moved.content,'{C}{G}{Am}word next');assert.equal(moved.index,2)});
test('many repeated moves preserve every lyric character and chord token',()=>{let current='[Verse]\n{C}Hello {G/B}friends\n{Am}Beautiful 😀 day';const original=current;for(let i=0;i<150;i++){const lines=current.split('\n'),source=1+i%2,parsed=api.parseChordPositions(lines[source]);if(!parsed.chords.length)continue;const target=1+(i+1)%2,position=i%api.parseChordPositions(lines[target]).lyrics.length;const moved=api.movePositionedChord(current,source,0,target,position);assert(moved);current=moved.content;assert.equal(lyrics(current),lyrics(original));assert.equal(tokens(current),tokens(original))}});

test('lyric editing keeps chord anchors through insertions, deletions, and line breaks',()=>{
 const chart='# Verse 1 [slight soft]\r\n{D}Hi [A/C#]there\r\n{Em}Again'
 const insert=api.editPositionedLyrics(chart,1,'Well Hi there',5)
 assert.equal(insert.content,'# Verse 1 [slight soft]\r\nWell {D}Hi [A/C#]there\r\n{Em}Again')
 const split=api.editPositionedLyrics(chart,1,'Hi \nthere',4)
 assert.equal(split.content,'# Verse 1 [slight soft]\r\n{D}Hi \r\n[A/C#]there\r\n{Em}Again')
 assert.equal(split.caret,0)
 assert.equal(split.line,2)
 assert.equal(api.editPositionedLyrics(chart,1,'Hie',2).content,'# Verse 1 [slight soft]\r\n{D}Hi[A/C#]e\r\n{Em}Again')
 assert.equal(api.editPositionedLyrics(split.content,2,'there',0,true).content,chart)
 assert.equal(api.editPositionedLyrics(chart,1,'[Chorus]',8),null)
});

test('insert and replace chords without changing source around the edited token',()=>{
 const chart='# Verse 1 [slight soft]\n{D}A😀 [A/C#]word'
 assert.equal(api.putPositionedChord(chart,1,3,'Bm'),'# Verse 1 [slight soft]\n{D}A😀{Bm} [A/C#]word')
 assert.equal(api.putPositionedChord(chart,1,4,'G/B',1),'# Verse 1 [slight soft]\n{D}A😀 [G/B]word')
 assert.equal(api.putPositionedChord(chart,0,0,'A'),chart)
 assert.equal(api.putPositionedChord(chart,1,2,'A'),chart)
});

test('extra chord positions add only the needed spaces and stop ten past the lyrics',()=>{
 const text='{D}Hi😀'
 const end='Hi😀'.length
 assert.equal(api.chordPlacementBoundaries('Hi😀',10).at(-1),end+10)
 assert.equal(api.putPositionedChord(text,0,end+3,'G',undefined,10),'{D}Hi😀   {G}')
 assert.equal(api.putPositionedChord(text,0,end+11,'G',undefined,10),text)
 assert.equal(api.movePositionedChord(text,0,0,0,end+10,10).content,'Hi😀          {D}')
 assert.equal(api.movePositionedChord('{D}Hi\r\nLast',0,0,1,8,10).content,'Hi\r\nLast    {D}')
 assert.equal(api.chordPlacementBoundaries('Hi😀   ',10).at(-1),end+10)
 assert.equal(api.movePositionedChord(text,0,0,0,end+10).content,'Hi😀{D}')
})
