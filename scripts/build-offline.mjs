import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const files = []
function walk(dir) {
  for (const item of readdirSync(dir, {withFileTypes:true})) {
    const path = `${dir}/${item.name}`
    if (item.isDirectory()) walk(path)
    else if (item.name !== 'sw.js') files.push(path.replace(/^dist/, ''))
  }
}
walk('dist')
const version = createHash('sha256').update(files.map(f => readFileSync(`dist${f}`)).reduce((a,b)=>Buffer.concat([a,b]),Buffer.alloc(0))).digest('hex').slice(0,16)
writeFileSync('dist/sw.js', `const CACHE = 'songbook-v2-${version}';
const ASSETS = ${JSON.stringify(files)};
// A response fetched through a hosting redirect cannot be replayed directly
// into a navigation with redirect mode "manual". Rebuild cached responses
// so the offline document has no redirect history.
async function safeResponse(response) {
  return new Response(await response.clone().arrayBuffer(), {
    status: response.status, statusText: response.statusText, headers: response.headers
  });
}
async function cacheResponse(cache, key, response) {
  if (response.ok && response.type !== 'opaque') {
    await cache.put(key, await safeResponse(response));
  }
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const path of ASSETS) {
      const response = await fetch(path, {cache: 'reload'});
      if (!response.ok || response.type === 'opaque') throw new Error('Offline asset unavailable');
      await cacheResponse(cache, path, response);
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('songbook-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'BIC_OFFLINE_STATUS' || !event.ports?.[0]) return;
  event.waitUntil((async () => {
    let ready = false;
    try {
      const cache = await caches.open(CACHE);
      const saved = await Promise.all(ASSETS.map(path => cache.match(path)));
      ready = saved.every(response => response && response.ok);
    } catch {}
    event.ports[0].postMessage({type: 'BIC_OFFLINE_STATUS', ready});
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      // Online navigation uses the original request, preserving the host's
      // routing. Cached HTML is used only if the network cannot be reached.
      try { return await fetch(event.request); }
      catch {
        const cache = await caches.open(CACHE);
        const cached = await cache.match('/index.html');
        if (cached) return await safeResponse(cached);
        return new Response('You are offline. Connect to the internet and reopen your songbook.', {
          status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}
        });
      }
    })());
    return;
  }
  // Leave hosting/auth endpoints and all unrelated requests to the browser.
  if (!ASSETS.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(url.pathname);
    if (cached) return await safeResponse(cached);
    return await fetch(event.request);
  })());
});`)

