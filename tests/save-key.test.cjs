const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
const exportsObject={};vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/chord/transpose.ts','utf8'),{module:ts.ModuleKind.CommonJS}),{exports:exportsObject});
const {transposeSongContent}=exportsObject;
test('bakes modern and legacy chords including slash bass while preserving lyrics and headings',()=>{
 const text='[Verse 1]\n{C}Amazing {G/B}grace\n[Chorus]\n[Am7]How [F]sweet\n[Bridge]\n# Ending\nPlain lyrics';
 assert.equal(transposeSongContent(text,2),'[Verse 1]\n{D}Amazing {A/C#}grace\n[Chorus]\n[Bm7]How [G]sweet\n[Bridge]\n# Ending\nPlain lyrics');
});
test('saves flat spelling, downward transpose and chord-only lines',()=>{
 assert.equal(transposeSongContent('[C]\n{G7/B}',-2,true),'[Bb]\n{F7/A}');
});
test('preserves section names, non-chord brackets, whitespace and CRLF',()=>{
 const text='[Ending]\r\n[Chorus]\r\n[Bridge]\r\n[Tag]\r\n{C}  words [Repeat]';
 assert.equal(transposeSongContent(text,1,true),'[Ending]\r\n[Chorus]\r\n[Bridge]\r\n[Tag]\r\n{Db}  words [Repeat]');
});

test('copy lyrics removes modern and legacy chords without removing sections or changing words',()=>{
 const text='[Verse 1]\r\n{C}Amazing {G/B}grace\r\n[Chorus]\r\n[Am7]How [F]sweet\r\n[Bridge]\r\n# Ending\r\nre{C}ward [Repeat]';
 assert.equal(exportsObject.lyricsOnly(text),'[Verse 1]\r\nAmazing grace\r\n[Chorus]\r\nHow sweet\r\n[Bridge]\r\n# Ending\r\nreward [Repeat]');
});
