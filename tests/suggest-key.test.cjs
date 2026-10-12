const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');const exp={};vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/suggest-key.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}),{exports:exp});
test('suggests the arrangement key from a major cadence',()=>assert.equal(exp.suggestKeys('{C} {F} {G7} {C}')[0],'C'));
test('supports minor keys and slash chords',()=>assert.equal(exp.suggestKeys('{Am} {Dm} {E7} {Am}')[0],'Am'));
test('does not interpret section labels as chords',()=>assert.equal(exp.suggestKeys('[Chorus]\n[Bridge]\nlyrics').length,0));
test('honors explicit pasted key header',()=>assert.equal(exp.suggestKeys('Key: D\n{Bm} {G}')[0],'D'));
