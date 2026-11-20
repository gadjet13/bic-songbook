const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const source = ts.transpile(fs.readFileSync('src/lib/setlist-links.ts', 'utf8'), { module: ts.ModuleKind.CommonJS })
const token = '03310000-0000-4000-8000-000000000001'

function fixture(hash, pathname='/') {
  const data = new Map()
  const location = { origin:'https://rehearsal.example', pathname, search:'', hash }
  const exports = {}
  const sessionStorage = {
    getItem: key=>data.get(key) ?? null,
    setItem: (key,value)=>data.set(key,value),
    removeItem: key=>data.delete(key),
  }
  const history = {
    state:null,
    replaceState(_state,_title,url) { location.hash = new URL(url,location.origin).hash },
  }
  vm.runInNewContext(source,{ exports, location, sessionStorage, history })
  return { api:exports, location }
}

test('captures the link before sign-in and reads it after an OAuth callback',()=>{
  const {api,location}=fixture('#setlist-link='+token)
  assert.equal(api.setlistLink(token),'https://rehearsal.example/setlists/'+token)
  assert.equal(api.pendingSetlistLink(),token)
  assert.equal(location.hash,'')
  location.hash='#access_token=oauth-callback'
  assert.equal(api.pendingSetlistLink(),token)
  assert.equal(location.hash,'#access_token=oauth-callback')
  api.clearSetlistLink()
  assert.equal(api.pendingSetlistLink(),null)
  assert.equal(location.hash,'#access_token=oauth-callback')
})

test('rejects a malformed link without treating it as a pending set',()=>{
  const {api}=fixture('#setlist-link=not-a-token')
  assert.equal(api.pendingSetlistLink(),null)
})


test('reads a canonical path, preserves it until navigation, and prefers it over a legacy token',()=>{
  const {api,location}=fixture('#setlist-link=13310000-0000-4000-8000-000000000001','/setlists/'+token+'/')
  assert.equal(api.pendingSetlistLink(),token)
  assert.equal(location.pathname,'/setlists/'+token+'/')
  assert.equal(location.hash,'')
  assert.equal(api.setlistTokenFromPath('/setlists/not-a-token'),null)
  assert.equal(api.setlistTokenFromPath('/setlists/'+token+'/extra'),null)
})
