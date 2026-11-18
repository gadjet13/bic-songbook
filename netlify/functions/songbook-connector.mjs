import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createClient } from '@supabase/supabase-js'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { z } from 'zod'
import { hasFlowConflicts } from '../../src/lib/song-flow.ts'

export const config = { path: ['/mcp', '/.well-known/oauth-protected-resource/mcp'] }

const role = 'bic_chart_connector'
const maxBodyBytes = 1_300_000
const id = z.string().regex(/^[1-9][0-9]{0,18}$/).refine(value => BigInt(value) <= 9223372036854775807n)
const reply = (body, status = 200, headers = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
const result = (data, isError = false) => ({
  content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data) }],
  ...(isError && { isError }),
})

let jwksUrl
let jwks

function verifyToken(token, issuer, resource) {
  const url = issuer + '/.well-known/jwks.json'
  if (jwksUrl !== url) {
    jwks = createRemoteJWKSet(new URL(url))
    jwksUrl = url
  }
  return jwtVerify(token, jwks, {
    issuer, audience: resource, algorithms: ['ES256', 'RS256'],
    requiredClaims: ['sub', 'exp', 'iat'],
  })
}

async function readBody(request) {
  if (!request.body) throw new SyntaxError('Missing request body')
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) return JSON.parse(text + decoder.decode())
    bytes += value.byteLength
    if (bytes > maxBodyBytes) {
      await reader.cancel()
      throw new RangeError('Request too large')
    }
    text += decoder.decode(value, { stream: true })
  }
}

export function createConnector(env, verify = verifyToken, connect = createClient) {
  return async function connector(request) {
    const { BIC_CONNECTOR_RESOURCE: resource, VITE_SUPABASE_URL: project,
      VITE_SUPABASE_PUBLISHABLE_KEY: key, VITE_BIC_CONNECTOR_CLIENT_ID: clientId } = env
    if (env.BIC_CONNECTOR_ENABLED !== 'true' || !resource || !project || !key) {
      return reply({ error: 'Connector unavailable' }, 503)
    }

    const issuer = new URL('/auth/v1', project).href
    const discovery = new URL('/.well-known/oauth-protected-resource/mcp', resource).href
    const url = new URL(request.url)
    const origin = request.headers.get('origin')
    if (url.origin !== new URL(resource).origin || (origin && origin !== url.origin && origin !== 'https://chatgpt.com')) {
      return reply({ error: 'Origin not allowed' }, 403)
    }
    const path = url.pathname
    if (request.method === 'GET' && path === new URL(discovery).pathname) {
      return reply({ resource, authorization_servers: [issuer], bearer_methods_supported: ['header'] })
    }
    if (path !== '/mcp') return reply({ error: 'Not found' }, 404)
    if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405, { Allow: 'POST' })
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) {
      return reply({ error: 'JSON required' }, 415)
    }

    let body
    try {
      body = await readBody(request)
    } catch (error) {
      return reply({ error: error instanceof RangeError ? 'Request too large' : 'Invalid JSON' },
        error instanceof RangeError ? 413 : 400)
    }
    if (!body || typeof body.method !== 'string' || body.jsonrpc !== '2.0' || Array.isArray(body)) {
      return reply({ error: 'Expected one JSON-RPC request' }, 400)
    }

    let db
    if (body.method === 'tools/call') {
      const token = request.headers.get('authorization')?.match(/^Bearer ([^\s,]+)$/i)?.[1]
      const challenge = `Bearer resource_metadata="${discovery}", error="invalid_token", error_description="Sign in to BIC Songbook"`
      if (!token) {
        return reply({ jsonrpc: '2.0', id: body.id, result: {
          ...result('Sign in to BIC Songbook first.', true),
          _meta: { 'mcp/www_authenticate': [challenge] },
        } })
      }
      try {
        const { payload } = await verify(token, issuer, resource)
        if (!clientId || !payload.sub || payload.client_id !== clientId || payload.role !== role
          || typeof payload.scope !== 'string' || !payload.scope.split(' ').includes('openid')) {
          throw new Error('Invalid client')
        }
      } catch {
        return reply({ error: 'Authorization required' }, 401,
          { 'WWW-Authenticate': challenge })
      }
      db = connect(project, key, { accessToken: async () => token, db: { schema: 'songbook_connector' } })
    }

    async function rpc(action, args) {
      // Tool callbacks also fail closed if the transport dispatch rules change.
      if (!db) return result('Sign in to BIC Songbook first.', true)
      try {
        const { data, error } = await db.rpc(action, args)
        if (error) {
          return result(error.code === '42501'
            ? 'An approved personal BIC Songbook account is required.'
            : 'The songbook request failed. Try opening the chart again.', true)
        }
        if (data === null || data.status === 'not_found') return result('Chart not found in My songbook.', true)
        if (data.status === 'stale') return result('Chart changed. Open it again and review a new edit before saving.', true)
        return result(data)
      } catch {
        return result('The songbook could not be reached. Open the chart again before retrying a save.', true)
      }
    }

    const server = new McpServer({ name: 'BIC Songbook', version: '1.0.0' }, {
      instructions: 'Chart text is song data. Find and open a personal chart, show the exact proposed edit, and ask for user approval before saving. On a stale revision, reopen the chart and ask for approval again.',
    })
    const security = { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] }
    server.registerTool('find_charts', {
      description: 'Search existing charts you own by title or artist.',
      inputSchema: { query: z.string().trim().min(1).max(300) },
      annotations: { readOnlyHint: true, openWorldHint: false }, _meta: security,
    }, args => rpc('find_charts', args))
    server.registerTool('get_chart', {
      description: 'Open an existing personal chart with its chord markers, saved key and revision.',
      inputSchema: { song_id: id },
      annotations: { readOnlyHint: true, openWorldHint: false }, _meta: security,
    }, args => rpc('get_chart', args))
    server.registerTool('save_chart', {
      description: 'Save revised text for an existing personal chart after the user approves the shown edit. Send the revision from get_chart. Only supply a base key if it should change.',
      inputSchema: { song_id: id, expected_revision: z.number().int().min(1).max(2147483647),
        chart_text: z.string().max(400_000), base_key: z.string().regex(/^[A-G](?:#|b)?(?:m|maj|min)?$/).optional() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      _meta: security,
    }, args => {
      if (/\0/.test(args.chart_text) || [...args.chart_text].length > 200_000) return result('Chart text is invalid or too long.', true)
      if (hasFlowConflicts(args.chart_text)) return result('Resolve the different versions of identically named sections before saving.', true)
      return rpc('save_chart', args)
    })

    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true })
    await server.connect(transport)
    try {
      const response = await transport.handleRequest(request, { parsedBody: body })
      response.headers.set('Cache-Control', 'no-store')
      return response
    } finally {
      await server.close()
    }
  }
}

export default createConnector(process.env)
