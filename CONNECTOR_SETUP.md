# Add chord charts from Codex

After setup, paste your rough chord sheet in Codex. Codex formats it, checks the title, and shows the complete proposed chart and whether it will create a church copy. Approve the save when it looks right. The connector can add a new personal chart and check title availability. The existing app trigger makes a separate church copy when the title is new to the church. A personal title match blocks the save.

## Set up staging

Use a separate Netlify test site and Supabase test project with the current BIC schema, sample songs and approved test accounts. Prepare that schema with a reviewed schema-only copy. The older SQL files are historical snapshots.

1. Deploy this branch to the Netlify test site with the initial environment variables below. Use its stable HTTPS origin plus `/mcp` as the resource URL.
2. In Supabase, confirm an active ES256 or RS256 JWT signing key. Apply [database/add-chart-connector.sql](database/add-chart-connector.sql) once. Under **Settings → Data API**, add `songbook_connector` to **Exposed schemas**.
3. Under **Authentication → Hooks**, enable `songbook_private.connector_token_hook` as the **Custom Access Token** hook. If one already exists, review how to combine them before changing the setting. Under **Authentication → URL Configuration**, set the site URL to the Netlify test origin and allow `https://YOUR_TEST_SITE/oauth/consent?authorization_id=**` as a sign-in redirect.
4. Under **Authentication → OAuth Server**, enable OAuth and set the authorization path to `/oauth/consent`. Leave dynamic registration off. Under **Authentication → OAuth Apps**, register a public OAuth client named **BIC Songbook for Codex**. For local Codex CLI, use a fixed loopback callback port, for example 43821, since Supabase requires an exact redirect URL. Set top-level `mcp_oauth_callback_url = "http://127.0.0.1:43821/callback"` and `mcp_oauth_callback_port = 43821` in the local Codex configuration. Register this URL provisionally, run the add command below with the resulting client ID, and then set the Supabase redirect to the exact callback Codex reports. If the URL has a suffix, preserve it. Use that same complete URL in `VITE_BIC_CONNECTOR_CALLBACK`.

   ```sh
   codex mcp add bic-songbook --url https://YOUR_TEST_SITE/mcp --oauth-client-id YOUR_CLIENT_ID
   ```

5. Register the test OAuth client in the test database.

   ```sql
   insert into songbook_private.connector_client (client_id, resource, enabled)
   values ('YOUR_CLIENT_UUID', 'https://YOUR_TEST_SITE/mcp', true);
   ```

6. Set the remaining variables and redeploy the test site.

   | Variable | Value and scope |
   | --- | --- |
   | `VITE_SUPABASE_URL` | Test project URL, Builds and Functions |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Test project's publishable key, Builds and Functions |
   | `BIC_CONNECTOR_RESOURCE` | Exact HTTPS test site URL ending in `/mcp`, Functions |
   | `BIC_CONNECTOR_ENABLED` | `true`, Functions |
   | `VITE_BIC_CONNECTOR_CLIENT_ID` | Supabase OAuth client ID, Builds and Functions |
   | `VITE_BIC_CONNECTOR_CALLBACK` | Exact registered Codex callback URL, Builds |

7. In the `[mcp_servers.bic-songbook]` section of your Codex configuration, set `default_tools_approval_mode = "writes"`. Run `codex mcp login bic-songbook --scopes openid`, then sign in with an approved test BIC Songbook account and approve the connection. Open a new Codex session and verify both tools are available. A remote Codex execution environment may require its own reachable OAuth callback. Register the exact callback emitted by that client.

## Verify before production

- Run `npm run build`, `node --test tests/*.test.*`, and [tests/add-chart-connector.sql](tests/add-chart-connector.sql) on staging. The SQL test uses temporary fixtures and rolls back.
- Paste a rough test chart. Cancel the first proposed save and confirm the song stays absent. Approve the second save and verify the personal version and one separate church copy. Retry with the same title using different capitalization or spacing and verify that no duplicate appears.
- Verify an existing church title can be added to My songbook with explicit approval, with the original church chart intact. Confirm that another user's personal charts are private.
- Test OAuth sign-in and refresh, regular browser sign-in, and access after a test member loses approval. Test a staging connector token against unrelated database APIs and RPCs. The token must have the restricted role and resource audience, and those APIs must reject privileged access.
- Review the hosted preview and staging results before opening production access. To disable access immediately, run `update songbook_private.connector_client set enabled = false;` in that environment and turn off the Netlify flag. Disabling the row also blocks already-issued connector tokens.

See the official [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [Supabase OAuth setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started), and [Supabase redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls).
