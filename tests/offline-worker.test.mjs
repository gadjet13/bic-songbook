import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const code = readFileSync('dist/sw.js', 'utf8')
function setup() {
  const handlers = {}, records = new Map(), deleted = []
  let networkFails = false, skip = false, claimed = false
  const cache = {put: async (key, response) => records.set(key, response), match: async key => records.get(key)}
  const networkResponse = new Response('<html>songbook</html>', {headers:{'Content-Type':'text/html'}})
  // Simulate a response that hosting delivered through an HTTP redirect.
  Object.defineProperty(networkResponse, 'redirected', {value:true})
  vm.runInNewContext(code, {
    Response, URL,
    self: {location:{origin:'https://songbook.test'}, addEventListener:(name,handler)=>handlers[name]=handler,
      skipWaiting:async()=>{skip=true}, clients:{claim:async()=>{claimed=true}}},
    caches:{open:async()=>cache, keys:async()=>['songbook-old','other-app'], delete:async k=>deleted.push(k)},
    fetch:async()=>{if(networkFails) throw new Error('offline'); return networkResponse}
  })
  return {handlers, records, deleted, networkResponse, offline:()=>{networkFails=true}, activated:()=>skip && claimed}
}
async function installAndActivate(s) {
  let p; s.handlers.install({waitUntil:v=>p=v}); await p
  s.handlers.activate({waitUntil:v=>p=v}); await p
}
async function navigate(s) {
  let response
  s.handlers.fetch({request:{url:'https://songbook.test/',method:'GET',mode:'navigate'},respondWith:v=>response=v})
  return await response
}
test('upgrade replaces old worker/cache and sanitizes redirected offline HTML', async()=>{
  const s=setup(); await installAndActivate(s)
  assert(s.activated()); assert.deepEqual(s.deleted,['songbook-old'])
  const cached=s.records.get('/index.html'); assert(cached)
  assert.equal(cached.redirected,false); assert.equal(await cached.clone().text(),'<html>songbook</html>')
  s.offline(); const response=await navigate(s)
  assert.equal(response.status,200); assert.equal(response.redirected,false)
  assert.equal(await response.text(),'<html>songbook</html>')
})
test('online navigation returns the network response, not cached HTML',async()=>{
  const s=setup(); await installAndActivate(s)
  assert.equal(await navigate(s),s.networkResponse)
})
test('missing cache while offline gives a readable response',async()=>{
  const s=setup(); s.offline(); const response=await navigate(s)
  assert.equal(response.status,503); assert.match(await response.text(),/Connect to the internet/)
})
test('hosting endpoints and other origins are not intercepted',()=>{
  const s=setup()
  for(const url of ['https://songbook.test/auth/callback','https://other.test/']) {
    s.handlers.fetch({request:{url,method:'GET',mode:'cors'},respondWith:()=>assert.fail('Unexpected interception')})
  }
})
