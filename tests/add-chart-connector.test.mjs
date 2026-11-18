import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createConnector } from '../netlify/functions/songbook-connector.mjs'

const env = {
  BIC_CONNECTOR_ENABLED: 'true',
  BIC_CONNECTOR_RESOURCE: 'https://songbook.example/mcp',
  VITE_SUPABASE_URL: 'https://project.example',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable',
  VITE_BIC_CONNECTOR_CLIENT_ID: 'codex-client',
}

function setup() {
  const calls = []
  const connector = createConnector(env, async token => {
    if (token === 'expired') throw new Error('expired')
    return { payload: { sub: 'member', client_id: 'codex-client', scope: 'openid',
      role: token === 'app-session' ? 'authenticated' : 'bic_chart_connector' } }
  }, (_project, _key, options) => ({
    async rpc(action, args) {
      calls.push([action, args, options.db.schema, await options.accessToken()])
      return { data: action === 'add_song'
        ? { status: 'church_copy_changed', would_create_church_copy: false }
        : { personal_exists: false, church_exists: false } }
    },
  }))
  const post = (method, params, token) => connector(new Request(env.BIC_CONNECTOR_RESOURCE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
      ...(token && { Authorization: 'Bearer ' + token }) },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }))
  return { connector, post, calls }
}

test('Codex can discover OAuth before login; MCP requires the restricted client token', async () => {
  const { connector, post, calls } = setup()
  const discovery = await connector(new Request('https://songbook.example/.well-known/oauth-protected-resource/mcp'))
  assert.deepEqual(await discovery.json(), { resource: env.BIC_CONNECTOR_RESOURCE,
    authorization_servers: ['https://project.example/auth/v1'], bearer_methods_supported: ['header'],
    scopes_supported: ['openid'] })
  for (const token of [undefined, 'expired', 'app-session']) {
    const response = await post('initialize', {}, token)
    assert.equal(response.status, 401)
    assert.match(response.headers.get('www-authenticate'), /oauth-protected-resource\/mcp/)
  }
  const { result: { tools } } = await (await post('tools/list', undefined, 'valid')).json()
  assert.deepEqual(tools.map(tool => tool.name), ['check_title', 'add_song'])
  assert.equal(tools[1].annotations.readOnlyHint, false)
  assert.deepEqual(calls, [])
})

test('checks the title and asks for fresh review if the church-copy result changed', async () => {
  const { post, calls } = setup()
  const check = await post('tools/call', { name: 'check_title', arguments: { title: 'Grace' } }, 'valid')
  assert.deepEqual(JSON.parse((await check.json()).result.content[0].text),
    { personal_exists: false, church_exists: false })
  const args = { title: 'Grace', base_key: 'D', chart_text: '[Verse]\n{D}Words', expected_church_copy: true }
  const response = await post('tools/call', { name: 'add_song', arguments: args }, 'valid')
  const { result } = await response.json()
  assert.equal(result.isError, true)
  assert.equal(JSON.parse(result.content[0].text).status, 'church_copy_changed')
  assert.deepEqual(calls[1], ['add_song', args, 'songbook_connector', 'valid'])
  args.chart_text = '[Chorus]\n{G}Words\n[Chorus]\n{D}Words'
  const conflict = await post('tools/call', { name: 'add_song', arguments: args }, 'valid')
  assert.equal((await conflict.json()).result.isError, true)
  assert.equal(calls.length, 2)
})
