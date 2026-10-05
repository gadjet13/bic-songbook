# Current project status

Supabase project **BIC Songbook** (`tggcpgfunzaxftbkghbn`) is configured in Seoul. The initial database migration has ALREADY been applied. Do not run it again on this project. SQL permission checks passed for viewer, editor, owner, unapproved and anonymous roles; the security advisor reported no notices. No real app users or songs exist yet. Login-provider setup and real user login testing remain pending.

The `dist` folder in this package is already built with the public connection settings and is ready for Netlify manual upload. These settings are public frontend identifiers, not administrator secrets. For local editing, copy `.env.example` to `.env.local`.

Choose your Netlify address, set that origin as the Supabase Auth Site URL and redirect allowlist, and configure the login provider. Create your own app account before assigning the owner role. Export your old songs and import them only after sign-in. Your Supabase dashboard login is separate from this app's user accounts.

---

# Launch your shared Pocket Songbook

This is the shared-library edition of the app. It is prepared source, not a configured live service. Start with a NEW Supabase project: the migration creates tables and is intended to run once. Your existing hosted local-storage edition remains separate.

## 1. Your free accounts

Create a Supabase Free project and a Netlify Free account. You can use the generated `your-name.netlify.app` address; you do not need to buy a domain. Free plans have quotas and service limitations. Supabase Free projects may pause after a week of inactivity. See current pricing before choosing a plan:
- https://supabase.com/pricing
- https://www.netlify.com/pricing/

## 2. Create the database

In Supabase SQL Editor run `database/001_shared_songbook.sql`. Do not run it in an existing populated project without first reviewing table names and making a backup.

The server rules deny song access to anonymous users and registered accounts without membership. Approved viewers can read; editors can add/edit/delete; owners also manage membership. Membership changes are server-checked, not merely hidden UI buttons. Song revisions protect against stale updates/deletes.

## 3. Configure login

Use Google login for friends if you want to avoid email-delivery setup. Enable Google in Supabase Auth providers; create the OAuth client using the provider's documented callback URL and add the client ID/secret only in the Supabase dashboard. Follow https://supabase.com/docs/guides/auth/social-login/auth-google. This code already has Continue with Google.

Email/password login, signup and password recovery are also implemented. For confirmation and password recovery emails to arbitrary friends, configure custom SMTP. Supabase's default email sender is restricted to project-team addresses and is not a production email service. Do not promise working signup/reset emails until you test delivery to an external address. An alternative for a small trial is to create confirmed test accounts manually in Supabase Auth Users without sending invitations. Keep email verification enabled for public signup; do not trust unverified emails for membership.

Set Auth Site URL and redirect allowlist to your localhost address for local tests and your exact Netlify HTTPS origin for release. Use a strong password policy. Never put Google client secrets or Supabase service-role/secret keys in the frontend.

## 4. Connect the frontend

Copy `.env.example` to `.env.local`. Enter your Supabase project URL and public publishable key (a legacy public anon key also works). These are frontend identifiers; permissions are enforced by RLS, not by keeping this public key secret.

```sh
npm ci
npm run dev
```

Create your own account or sign in with Google, then in SQL Editor run the commented owner bootstrap at the end of the migration, replacing YOUR_EMAIL_HERE with your verified account email. Refresh the library. Never automatically make the first public signup an owner.

## 5. Move existing songs

Export a JSON backup from the current app BEFORE moving domains. Sign into the new app as owner and use Import songs once. Imports append copies; repeat imports create duplicates. The new shared library starts empty. Songs and accounts are not automatically copied from the old website.

## 6. Test permissions with separate accounts

Before giving friends the release link, use separate browsers/accounts and verify:
- Signed-out requests cannot read or write songs.
- A signed-in account without membership cannot read/write songs or grant itself membership.
- Viewer can read, but direct API inserts/updates/deletes and membership RPC calls fail.
- Editor can change songs but cannot change membership.
- Owner can grant/remove access; owner cannot be removed through the membership UI.
- Two edits made from the same revision: the first saves, the second reports a conflict and keeps its unsaved content.
- Removing a member denies their next server request, even if they still have a login session.
- Logout clears the displayed library; another account does not see the previous account's library.
- Google callback and password reset callback work at the actual release origin.

Live database policy tests are NOT completed in this package because no Supabase project was connected during preparation. Run the above tests before release. Build and worker regression tests can run locally:

```sh
npm run build
node --test tests/*.test.*
```

## 7. Deploy free on Netlify

Connect your source repository to Netlify. `netlify.toml` specifies the build command (`npm run build`) and output folder (`dist`). Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY as build environment variables in Netlify. Build a new deploy after changing them.

For manual deployment, build locally with `.env.local` configured, then upload the CONTENTS of `dist` through Netlify's manual deploy flow. Do not upload the source zip as the website. The source ZIP is for editing/development; the published files are the generated `dist` directory.

Choose the free generated Netlify address, add that exact origin to Supabase auth configuration, and test it before sharing. Install the new origin on your phone. CSS updates on that same origin reach the installed app on its next online launch.

## Current synchronization behavior

All approved users read/write the same database. The library refreshes on opening the app, switching back to its window, or pressing Refresh library. This release does not stream edits live while another person is looking at an already-open window.

The interface has offline asset caching, but shared songs are NOT persisted as a private offline database in this edition. Loading the shared library and saving edits require internet. Offline song caching and queued edits are a separate next feature; keep a backup for now.

## Change the appearance

Edit `src/App.css` / `src/index.css` for appearance; `src/App.tsx` for song screens; `src/SharedApp.tsx` for accounts and membership screens. Preview locally, then rebuild and deploy to the SAME Netlify site to retain browser sessions and the installed app address.
