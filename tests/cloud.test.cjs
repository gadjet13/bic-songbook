const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
function setup(result) {
 const calls=[];const query={};for(const name of ['select','order','insert','update','delete','is','eq','maybeSingle'])query[name]=(...args)=>{calls.push([name,...args]);return query};query.then=(ok,bad)=>Promise.resolve(result).then(ok,bad);
 const client={from:name=>{calls.push(['from',name]);return query}};const exports={};const source=fs.readFileSync('src/lib/cloud.ts','utf8').replace(/import\.meta\.env\.VITE_SUPABASE_URL/g,"'https://test.supabase.co'").replace(/import\.meta\.env\.VITE_SUPABASE_PUBLISHABLE_KEY/g,"'public'");
 vm.runInNewContext(ts.transpile(source,{module:ts.ModuleKind.CommonJS}),{exports,require:()=>({createClient:()=>client}),Error});return {api:exports,calls};
}
test('stale update does not silently succeed and checks server revision',async()=>{
 const {api,calls}=setup({data:null,error:null});await assert.rejects(api.updateSong({id:4,revision:2,title:'T',artist:'',key:'G',category:'',content:'[G]Hi'}),/changed/);assert(calls.some(c=>c[0]==='eq'&&c[1]==='revision'&&c[2]===2));
});
test('stale delete checks revision and reports conflict',async()=>{
 const {api,calls}=setup({data:[],error:null});await assert.rejects(api.removeSong({id:4,revision:3}),/changed/);assert(calls.some(c=>c[0]==='eq'&&c[1]==='revision'&&c[2]===3));
});
test('import cannot assign IDs, revisions or membership fields',async()=>{
 const {api,calls}=setup({data:[],error:null});await api.insertSongs([{id:999,revision:1,title:'T',artist:'',key:'C',category:'',content:'',role:'owner',owner_id:'forged'}], 'signed-in-user');const fields=calls.find(c=>c[0]==='insert')[1][0];assert.equal(fields.id,undefined);assert.equal(fields.role,undefined);assert.equal(fields.revision,undefined);assert.equal(fields.owner_id,'signed-in-user');
});
test('server denies are surfaced rather than saved locally',async()=>{
 const {api}=setup({data:null,error:{message:'permission denied'}});await assert.rejects(api.loadSongs(),/permission denied/);
});

test('library reads scope to personal owner or church',async()=>{
 const personal=setup({data:[],error:null});await personal.api.loadSongs('user-a');assert(personal.calls.some(c=>c[0]==='eq'&&c[1]==='owner_id'&&c[2]==='user-a'));
 const church=setup({data:[],error:null});await church.api.loadSongs(null);assert(church.calls.some(c=>c[0]==='is'&&c[1]==='owner_id'&&c[2]===null));
});
