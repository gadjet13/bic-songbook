# BIC Songbook connector staging setup

Use a separate Supabase project and a separate Netlify test deployment. Prepare the current BIC database schema in that project with a reviewed schema-only copy and use sample songs and test accounts. The older SQL files in this repository are reference snapshots. The new migration for an already prepared songbook is [database/chord-connector.sql](database/chord-connector.sql).

## Add the connector to the test project

1. In Netlify, create a test site for this branch. Record its stable HTTPS origin and use that origin plus `/mcp` as the connector resource URL. Set the project URL, publishable key, resource URL and enabled flag from the table below and deploy once. Tool discovery is available before the client is registered.
2. In the Supabase test project, check that Auth uses an active ES256 or RS256 JWT signing key. Apply the connector migration once in **SQL Editor**. Under **Settings → Data API**, add `songbook_connector` to **Exposed schemas**, keeping the existing schemas.
3. In **Authentication → Hooks**, set the **Custom Access Token** hook to the Postgres function `songbook_private.connector_token_hook`. If a hook already exists, stop and review how to combine them before changing the setting. Enable this hook before enabling OAuth. In **Authentication → URL Configuration**, set the Site URL to the test site origin. Add the test site's consent URL to **Redirect URLs** using `https://YOUR_TEST_SITE/oauth/consent?**`. This lets the existing Google sign-in return to the pending consent request.
4. In **Authentication → OAuth Server**, enable the server and set the authorization path to `/oauth/consent`. Leave dynamic client registration off. In ChatGPT's custom plugin setup, choose the provided OAuth client option and copy the exact callback URL that ChatGPT shows. In Supabase **Authentication → OAuth Apps**, register a public client named **BIC Songbook for ChatGPT** with that exact URL and copy its client ID. Configure ChatGPT to use that ID and token endpoint authentication method `none`.
5. In the staging SQL Editor, register the client and resource. Substitute the actual client ID and Netlify test URL.

   ```sql
   insert into songbook_private.connector_client (client_id, resource, enabled)
   values ('REPLACE_WITH_CLIENT_UUID', 'https://REPLACE_WITH_TEST_SITE/mcp', true);
   ```

6. Set these staging Netlify environment variables, then deploy the branch.

   | Variable | Value and scope |
   | --- | --- |
   | `VITE_SUPABASE_URL` | Test Supabase project URL, Builds and Functions |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Test project's publishable key, Builds and Functions |
   | `VITE_BIC_CONNECTOR_CLIENT_ID` | Registered OAuth client ID, Builds and Functions |
   | `VITE_BIC_CONNECTOR_CALLBACK` | Exact registered ChatGPT callback URL, Builds |
   | `BIC_CONNECTOR_RESOURCE` | Exact HTTPS Netlify connector URL ending in `/mcp`, Functions |
   | `BIC_CONNECTOR_ENABLED` | `true`, Functions |

   Connect ChatGPT to the resource URL. Set the save tool to ask for confirmation, and keep the tools private to the pilot. The preview and approval are handled by ChatGPT. The database enforces the caller's access and the expected revision when a save is submitted.

## Verify in staging

- Run [tests/chord-connector.sql](tests/chord-connector.sql) in the test project's SQL Editor. It creates temporary fixtures and rolls back. Run `npm run build` and `node --test tests/*.test.*` in the repo.
- Sign in through the connector with one approved test account. Cancel one proposed edit, verify the chart is untouched, then approve one edit and verify the chart, key if changed, and song history in the app.
- Change the chart in a browser after opening it in ChatGPT. Verify that saving the older revision asks for a fresh review. Verify that signing in with the other test account shows only that account's charts. Test access again after removing a test account's BIC membership.
- Check that regular Google and email sign-in still work. Test the OAuth token exchange and refresh. With a staging connector token, verify that the three RPCs work as intended and that the ordinary Data API, other application RPCs and any enabled Storage or Realtime surfaces reject privileged access. Confirm that the signed token carries the restricted role and the exact resource audience. Keep tokens local to the test.
- Review the change with the maintainer before a separate production deployment. To stop the connector immediately, run `update songbook_private.connector_client set enabled = false;` in that environment, then turn off the Netlify function flag. Disabling the database entry also blocks already-issued connector tokens from accessing charts.

Official references are [Supabase OAuth setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started), [Supabase redirect URL patterns](https://supabase.com/docs/guides/auth/redirect-urls), and [OpenAI connector authentication](https://developers.openai.com/plugins/build/auth).
