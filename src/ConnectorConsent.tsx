import { useEffect, useState } from 'react'
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js'
import { cloud } from './lib/cloud'

export const connectorConsentPath = '/oauth/consent'
const clientId = import.meta.env.VITE_BIC_CONNECTOR_CLIENT_ID
const callback = import.meta.env.VITE_BIC_CONNECTOR_CALLBACK

export const isConnectorConsent = () =>
  Boolean(clientId && callback && location.pathname === connectorConsentPath)

function currentAuthorizationId() {
  const value = new URLSearchParams(location.search).get('authorization_id')
  return value && value.length <= 256 && !/[^A-Za-z0-9_-]/.test(value) ? value : null
}

export function authReturnUrl() {
  const authorizationId = currentAuthorizationId()
  return isConnectorConsent() && authorizationId
    ? location.origin + connectorConsentPath + '?authorization_id=' + authorizationId
    : new URL('/', location.origin).href
}

function returnToClient(value: string) {
  const expected = new URL(callback)
  const actual = new URL(value)
  if (actual.origin !== expected.origin || actual.pathname !== expected.pathname
    || actual.username || actual.password || actual.hash
    || Array.from(expected.searchParams.keys()).some(key =>
      actual.searchParams.getAll(key).join('\n') !== expected.searchParams.getAll(key).join('\n'))) {
    throw new Error('Unexpected sign-in callback.')
  }
  location.assign(actual.href)
}

export default function ConnectorConsent({ userId }: { userId: string }) {
  const authorizationId = currentAuthorizationId()
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null)
  const [notice, setNotice] = useState('Checking the connection request…')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    if (!authorizationId || !cloud) {
      setNotice('Start the connection from Codex to continue.')
      return
    }
    void cloud.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (!active) return
      if (error || !data) throw new Error()
      if ('redirect_url' in data) {
        returnToClient(data.redirect_url)
        return
      }
      if (data.client.id !== clientId || data.redirect_uri !== callback || data.user.id !== userId) {
        throw new Error()
      }
      setDetails(data)
      setNotice('')
    }).catch(() => {
      if (active) setNotice('This connection request is invalid or expired. Start again from Codex.')
    })
    return () => { active = false }
  }, [authorizationId, userId])

  async function decide(allow: boolean) {
    if (!cloud || !authorizationId || !details) return
    setBusy(true)
    setNotice('')
    try {
      const options = { skipBrowserRedirect: true }
      const { data, error } = allow
        ? await cloud.auth.oauth.approveAuthorization(authorizationId, options)
        : await cloud.auth.oauth.denyAuthorization(authorizationId, options)
      if (error || !data) throw new Error()
      returnToClient(data.redirect_url)
    } catch {
      setBusy(false)
      setNotice('Could not finish this request. Try again or restart from Codex.')
    }
  }

  return <main className="auth-panel">
    <h1>Connect BIC Songbook</h1>
    {details && <>
      <p>Allow {details.client.name} to add new charts in My songbook?</p>
      <p>Signed in as {details.user.email}.</p>
      <button disabled={busy} onClick={() => void decide(true)}>Allow</button>
      <button disabled={busy} onClick={() => void decide(false)}>Decline</button>
    </>}
    <p role="status">{notice}</p>
    <a href="/">Back to BIC Songbook</a>
  </main>
}
