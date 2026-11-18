import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createConnector } from '../netlify/functions/songbook-connector.mjs'

const env = {
  BIC_CONNECTOR_ENABLED: 'true',
  BIC_CONNECTOR_RESOURCE: 'https://songbook.example/mcp',
  VITE_SUPABASE_URL: 'https://project.example',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable',
  VITE_BIC_CONNECTOR_CLIENT_ID: 'chatgpt-client',
}

function setup() {
  const calls = []
  const connector = createConnector(env, async token => {
    if (token === 'expired') throw new Error('expired')
    return { payload: { sub: 'member', scope: 'openid', client_id: 'chatgpt-client',
      role: token === 'app-session' ? 'authenticated' : 'bic_chart_connector' } }
  }, (_project, _key, options) => ({
    async rpc(action, args) {
      calls.push([action, args, options.db.schema, await options.accessToken()])
      return { data: action === 'save_chart' ? { status: 'stale' } : null }
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

test('discovery and tool list work before sign-in, but tools require the connector token', async () => {
  const { connector, post, calls } = setup()
  const discovery = await connector(new Request('https://songbook.example/.well-known/oauth-protected-resource/mcp'))
  assert.deepEqual(await discovery.json(), { resource: env.BIC_CONNECTOR_RESOURCE,
    authorization_servers: ['https://project.example/auth/v1'], bearer_methods_supported: ['header'] })
  const { result: { tools } } = await (await post('tools/list')).json()
  assert.deepEqual(tools.map(tool => tool.name), ['find_charts', 'get_chart', 'save_chart'])
  assert.equal(tools[2].annotations.destructiveHint, true)
  assert.equal(tools[2]._meta.securitySchemes[0].type, 'oauth2')
  const unauthenticated = await post('tools/call', { name: 'find_charts', arguments: { query: 'Grace' } })
  const authResult = (await unauthenticated.json()).result
  assert.equal(authResult.isError, true)
  assert.match(authResult._meta['mcp/www_authenticate'][0], /oauth-protected-resource\/mcp/)
  for (const token of ['expired', 'app-session']) {
    const response = await post('tools/call', { name: 'find_charts', arguments: { query: 'Grace' } }, token)
    assert.equal(response.status, 401)
    assert.match(response.headers.get('www-authenticate'), /oauth-protected-resource\/mcp/)
  }
  assert.deepEqual(calls, [])
})

test('write uses the caller token and revision and tells the user to review stale edits', async () => {
  const { post, calls } = setup()
  const args = { song_id: '12', expected_revision: 2, chart_text: '[Verse]\n{D}Words', base_key: 'D' }
  const response = await post('tools/call', { name: 'save_chart', arguments: args }, 'valid')
  const { result } = await response.json()
  assert.equal(result.isError, true)
  assert.match(result.content[0].text, /review a new edit/)
  assert.deepEqual(calls, [['save_chart', args, 'songbook_connector', 'valid']])

  args.chart_text = '[Chorus]\n{G}Words\n[Chorus]\n{D}Words'
  const conflict = await post('tools/call', { name: 'save_chart', arguments: args }, 'valid')
  assert.equal((await conflict.json()).result.isError, true)
  assert.equal(calls.length, 1)
})
