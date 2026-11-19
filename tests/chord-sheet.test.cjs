const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');const exp={};const chord={};vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/chord/transpose.ts','utf8'),{module:ts.ModuleKind.CommonJS}),{exports:chord});vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/chord-sheet.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}),{exports:exp,require:()=>chord});
test('converts title, chord-only intros, section labels and aligned slash chords',()=>{const input='**Oceans**\nBm A/C# D\n\n[Verse 1]\nBm    A/C#\nYou call me';const result=exp.convertChordSheet(input);assert.equal(result.title,'Oceans');assert.equal(result.content,'{Bm} {A/C#} {D}\n\n[Verse 1]\n{Bm}You ca{A/C#}ll me');assert.equal(result.warnings.length,0)});
test('normalizes copied nonbreaking spaces and keeps labels and existing notation',()=>{const result=exp.convertChordSheet('[Chorus]\r\nC\u00a0 G\r\nHi there\r\n\r\n{Am}Already converted');assert.equal(result.content,'[Chorus]\n{C}Hi {G}there\n\n{Am}Already converted')});
test('multiple chords beyond short lyric line remain intact and ordered',()=>{assert.equal(exp.convertChordSheet('C       F      G\nHi').content,'{C}Hi{F}{G}')});

test('recognizes a plain title above the opening chord line',()=>{const result=exp.convertChordSheet('Oceans\n\nBm A/C# D\n\n[Verse]\n{Bm}Words');assert.equal(result.title,'Oceans');assert.ok(result.content.startsWith('{Bm} {A/C#} {D}'))});

test('recognizes a plain title before a section without swallowing untitled lyrics',()=>{const result=exp.convertChordSheet('Oceans\n\n[Verse 1]\nBm\nWords');assert.equal(result.title,'Oceans');assert.ok(result.content.startsWith('[Verse 1]'));assert.equal(exp.convertChordSheet('First lyric\nSecond lyric').title,'')});

test('preserves chord repeats and removes only standalone page markers',()=>{
 const result=exp.convertChordSheet('Song title\n[Intro]\nD F#m E   x2\nPage 2/3\n[Verse]\n{D}Page 2/3 is part of this line\n[Ending]\nA/E G x3\nSing on');
 assert.equal(result.title,'Song title');
 assert.equal(result.content,'[Intro]\n{D} {F#m} {E}  x2\n[Verse]\n{D}Page 2/3 is part of this line\n[Ending]\n{A/E} {G}  x3\nSing on');
});

test('reports original line numbers for uncertain chord placement or notation',()=>{
 const result=exp.convertChordSheet('**Song title**\nPage 1/2\n[Verse]\nC        F\nHi\nC   D/?\nA new day dawns');
 assert.equal(result.content,'[Verse]\n{C}Hi{F}\nC   D/?\nA new day dawns');
 assert.equal(JSON.stringify(result.warnings),JSON.stringify([{line:4,kind:'past-lyrics'},{line:6,kind:'unrecognized-row'}]));
});

test('leaves lyrics and inline chord markers intact',()=>{
 const result=exp.convertChordSheet('[Verse]\nA new day dawns\n{D}Here we sing\nPage 2/3 of the story');
 assert.equal(result.content,'[Verse]\nA new day dawns\n{D}Here we sing\nPage 2/3 of the story');
 assert.equal(result.warnings.length,0);
});

test('retains a standalone bar chart and detects the title immediately above it',()=>{
 const bars='(|D / G / | D / / / | D / G / | D / / / |)';
 const result=exp.convertChordSheet('A Thousand Hallelujahs\n'+bars+'\n[Verse]\nFirst lyric');
 assert.equal(result.title,'A Thousand Hallelujahs');
 assert.equal(result.content,bars+'\n[Verse]\nFirst lyric');
 assert.equal(result.warnings.length,0);
 assert.equal(exp.convertChordSheet('D G\n'+bars).content,'{D} {G}\n'+bars);
});

test('pastes chord lines with attached beat slashes without swallowing the lyric line',()=>{
 const result=exp.convertChordSheet('[Verse]\nD      D/ F#m    Bm A\nForever Yours');
 assert.equal(result.content,'[Verse]\n{D}Forever{D/} Yo{F#m}urs{Bm}{A}');
 assert.equal(JSON.stringify(result.warnings),JSON.stringify([{line:2,kind:'past-lyrics'}]));
});
