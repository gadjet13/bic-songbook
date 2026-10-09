# BIC Worship DB

A church songbook for browsing lyrics and chords, preparing setlists, and keeping your own arrangements in your preferred key.

**Website:** [bic-songbook.netlify.app](https://bic-songbook.netlify.app)  
**Source:** [gadjet13/bic-songbook](https://github.com/gadjet13/bic-songbook)

This README describes the current source. Website changes become available after the corresponding GitHub commit successfully deploys on Netlify.

## Getting started

1. Open the website and choose **Continue with Google**.
2. If your account is awaiting approval, ask the church owner or a manager to approve your email address.
3. After approval, refresh the library.
4. Choose **My songbook** or **Bukchon International Chapel**. The church owner account opens directly into the church songbook.

On a phone or tablet, use the app's installation help or your browser's **Install app / Add to Home Screen** option. This installs the website as a home-screen app; it does not require an app-store download.

## Accounts and permissions

| Role | Manage their own songs, folders, and setlists | View church collection | Edit church collection | Manage members |
|---|---|---|---|---|
| Church owner | No personal songbook | Yes | Yes | Yes; can appoint managers |
| Manager | Yes | Yes | No | Approve or remove ordinary members |
| Member (`viewer`) | Yes | Yes | No | No |
| Awaiting approval | No | No | No | No |

Legacy `editor` memberships are treated as ordinary members for church editing. Only the church owner can directly add, edit, or delete church songs and setlists.

The church owner account is **bukchoninternationalchapel@gmail.com**. The manager account is **agatheojetro@gmail.com**. These are app roles; they do not transfer ownership of GitHub, Netlify, Google Cloud, or Supabase.

### Approving friends

Open **Menu → Manage friends’ access**. Your friend must first sign in to create an account. Enter their account email, choose a permission, and select **Update access**. This does not send an invitation email.

**Show registered accounts** lists confirmed account email addresses and their current access, including accounts awaiting approval. Only the owner and managers can use this list. Removing access does not delete the person's login account or stored songs.

Managers cannot appoint managers or change the church owner. The church owner can appoint or change managers.

## Personal and church songs

- Existing shared songs belong to the church collection.
- Creating a new personal song automatically adds a **separate copy of its first saved version** to the church collection.
- Later personal edits, key changes, folder changes, and deletions do not change that church copy.
- The church owner may explicitly edit or delete the church copy.
- Use **Copy to My songbook** on a church song to make your own arrangement. This does not create another church entry.
- Personal songs, folders, and setlists are private to their account, including from other members and managers using the app.

The automatic first-copy rule means a newly created personal song is also submitted to the church collection. Personal songbooks are not a place to create content that must never be shared with church members.

### Saving your preferred key

1. Open a song in **My songbook**.
2. Use the transpose − / + buttons to choose your key.
3. Select **Save in … as base key**, beside the transpose controls.

The app saves the transposed chords, changes the song's base key, and resets transpose to **0**. The church copy stays unchanged. If you only use transpose without saving, the stored arrangement stays unchanged.

## Writing lyrics and chords

Put section headings on their own lines using square brackets. Put chords in curly braces where they belong in the lyrics:

```text
[Verse 1]
{G}Amazing grace, {D}how sweet the sound

[Chorus]
{C}Amazing {G/B}grace
```

Chords display above the lyrics. Chords can appear inside a word, such as `re{C}ward`, without adding a space to that word. Slash chords such as `{D/F#}` are supported.

Older `# Verse 1` headings and `[G]` chord markers remain supported. A chord-only line such as `[C]` is interpreted as a legacy chord, not a section heading.

## Folders and setlists

### Personal folders

**My folders** starts closed. Open it to create folders, rename or delete a selected folder, and filter your songs. Open a personal song to choose its folder.

A song belongs to one folder at a time. **All songs** includes every personal song; **Unfiled** includes songs without a folder. Deleting a folder keeps its songs and moves them to Unfiled.

### Setlists

Setlists are personal only. The church account contains songs, with no setlists.

Create or edit a setlist, search by song title, artist, or category, and select a result to add it. Search shows up to 20 matching songs; narrow the search if needed. Arrange songs with the up/down controls. A setlist can contain up to 100 song entries.

Setlists use songs from the same songbook. Copy a church song to My songbook before adding your version to a personal setlist. Deleting a setlist does not delete its songs. Deleted songs appear as missing entries and are skipped when reading.

Open a saved personal setlist, enter another approved personal account’s email, then choose **Share / update copy**. They find it under **Shared with me** on the front page. Only that setlist and its included songs are shared as a read-only snapshot. Later edits do not change it until you share again. The sender can revoke sharing; the recipient can remove their copy. Deleting the original setlist removes its shares. Church accounts cannot send or receive setlists. Sharing sends no email. Access removal blocks online viewing, but cannot recall content already downloaded or copied.

## Reading and appearance

- Choose light, dark, or device theme from the Menu.
- Adjust song text from **6px to 32px**.
- Reading mode fits lyrics into pages, with two columns on screens at least 700px wide and one on narrower screens.
- Use page buttons, left/right arrow keys, or horizontal swipes to turn pages.
- In a setlist, Next after the final page opens the next song. Previous from the first page opens the previous song's last page when available.
- Sections stay in one column when they fit. Larger sections use both columns on one page when possible; sections exceeding the available space need multiple pages.
- Exit reading mode with its button or Escape.

## Backups and current limits

**Menu → Export backup** downloads the currently open songbook's songs as JSON. It does not export folders, favorites, setlists, membership, or account settings. Import appends songs; repeat imports can create duplicates. Importing new personal songs also creates their first church copies.

Individual song sharing and downloaded song files are separate from private setlist sharing. A shared song file/link contains the song content; send it only to intended recipients.

The app requires an internet connection for account checks and database songs. The installed app caches application files, but full offline song and setlist access is not implemented. Song history and deleted-song recovery are also planned.

## Editing and deploying the website

This project uses React, TypeScript, Vite, and Supabase. Netlify builds the source from GitHub.

For an update ZIP supplied for this project:

1. Extract the ZIP.
2. Open the GitHub repository's root on the deployment branch (`main`).
3. Choose **Add file → Upload files**.
4. Upload the extracted `src` and `public` folders, preserving their paths. If the update includes this README, upload `README.md` at the root too.
5. Commit the changes and wait for Netlify to show **Published**.
6. Refresh the website and check the changed features.

Upload the folder contents from the ZIP, not the ZIP itself or an extra enclosing folder. Do not upload `node_modules` or generated `dist` for this GitHub build workflow. Partial updates replace supplied files and keep other existing project files.

For appearance changes, start with `src/App.css`. `src/ThemePreference.tsx` controls theme selection. React components under `src` control the screens and behavior.

### Local development

Use a Node.js release supported by the installed Vite version. Install dependencies from the lockfile:

```sh
npm ci
```

Create `.env.local` with the project's public connection settings:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

Never put a Supabase secret/service-role key, Google client secret, or password in frontend files or GitHub uploads.

```sh
npm run dev
npm run build
npm run preview
node --test tests/cloud.test.cjs tests/offline-worker.test.mjs tests/save-key.test.cjs
```

Netlify uses `npm run build` and publishes `dist`, as configured in `netlify.toml`. Set the two public environment variables in Netlify too; changes to build variables require a new deployment.

### Database and login maintenance

The live database is already configured. **Do not rerun the database SQL files on the existing project.** Some files are reference snapshots of changes already applied. The early `SETUP.md` describes the original launch and contains historical status and permissions; use this README for current behavior. A fresh installation needs a reviewed, ordered database setup, not a blind replay of every file.

Database rules enforce access independently of hidden buttons. Revision checks prevent an old edit or delete from silently overwriting a newer version.

If the website address changes, update Supabase Auth's Site URL and redirect allowlist, Google OAuth's website origin, and Google's homepage/privacy links. The Google-to-Supabase callback stays the same when only the Netlify address changes. Reinstall home-screen apps from the new address.

Google sign-in is the primary shared login path. Email/password and recovery screens exist, but external email delivery needs a configured and tested email service.

## Suggested release checks

- Manager can approve members and view registered accounts, but cannot edit church songs or setlists.
- Church owner opens only the church songbook and can edit its collection.
- Personal songs, folders, and setlists do not appear in another account.
- New personal songs create one initial church copy; personal edits and deletions preserve that copy.
- Copying a church song creates only a personal copy.
- Saving a transposition changes personal chords and base key, then resets transpose to 0.
- Folder deletion keeps songs; setlist search, ordering, and reading work.
- Check lyrics spacing, page turns, and light/dark mode on desktop and phone/tablet.

Privacy information is published at [bic-songbook.netlify.app/privacy.html](https://bic-songbook.netlify.app/privacy.html).

## App guide and branding

The app is named **BIC Worship DB** and uses the chapel logo, including the BIC letters. Open **Menu → User guide / README**, or the **ⓘ User guide** link on the front page. Phone shortcuts may need to be removed and reinstalled to update their icon and name. The existing website address remains unchanged.

`database/setlist-sharing.sql` has already been applied to the live database. Do not rerun it. It restricts setlists to personal accounts and adds protected read-only snapshot sharing. Existing church setlist records are retained but hidden.

### Copy songs

Open a song and choose **Copy → Copy with chords** to copy its text in the currently displayed key, or **Copy → Copy lyrics** to copy without chords. Section labels remain. Copying does not edit the saved song. This replaces Print.

You can also open a personal song and choose **Add to setlist**, select an existing personal setlist, and press **Add song**. The song is appended at the end. Shared snapshots are updated only when you share again.
