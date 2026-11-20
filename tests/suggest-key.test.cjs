const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');const exp={},chord={};vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/chord/transpose.ts','utf8'),{module:ts.ModuleKind.CommonJS}),{exports:chord});vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/suggest-key.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}),{exports:exp,require:()=>chord});
test('suggests the arrangement key from a major cadence',()=>assert.equal(exp.suggestKeys('{C} {F} {G7} {C}')[0],'C'));
test('supports minor keys and slash chords',()=>assert.equal(exp.suggestKeys('{Am} {Dm} {E7} {Am}')[0],'Am'));
test('does not interpret section labels as chords',()=>assert.equal(exp.suggestKeys('[Chorus]\n[Bridge]\nlyrics').length,0));
test('honors explicit pasted key header',()=>assert.equal(exp.suggestKeys('Key: D\n{Bm} {G}')[0],'D'));
test('reads a bar chart and ignores chord-like tokens in section notes',()=>{
 assert.equal(exp.suggestKeys('# Verse [Bb]\n(|D / G / | A7 / D / |)')[0],'D');
 assert.deepEqual(Array.from(exp.suggestKeys('# Verse [Bb]\nLyrics')),[]);
 assert.equal(exp.suggestKeys('Original Key: ebmin\n{A}')[0],'Ebm');
});
