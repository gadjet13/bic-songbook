const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
const helpers={};vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/setlist-copy.ts','utf8'),{module:ts.ModuleKind.CommonJS}),{exports:helpers});
const songs=[{title:'Song B',key:'G',content:'[Chorus]\n{G}Second'},{title:'Song A',key:'C',content:'[Verse]\n{C}First'}, {title:'Song B',key:'G',content:'[Chorus]\n{G}Second'}];
test('setlist copy keeps explicit order and repeated songs with saved keys',()=>{const text=helpers.setlistText(songs);assert.ok(text.indexOf('1. Song B')<text.indexOf('2. Song A'));assert.ok(text.includes('3. Song B'));assert.ok(text.includes('Key: G'));assert.ok(text.includes('{C}First'))});
