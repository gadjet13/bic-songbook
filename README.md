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

Open a saved personal setlist, enter another approved personal account’s email, then choose **Share setlist**. They find it under **Shared with me** on the front page. Only that setlist and its included songs are shared read-only. Saved song edits, title changes, additions, removals and reordering update automatically. The open recipient view checks every 15 seconds while visible, and refreshes on focus. Sharing sends no email. Church accounts cannot send or receive setlists. Revoke sharing to remove access; deleting the original setlist removes its shares. Already copied or downloaded content cannot be recalled.

After the first share, the recipient is remembered under **My friends** in the sharing controls. Search by email or private nickname, select them to fill the email, and use Rename or Remove friend. Removing a friend does not revoke existing shares.

Choose **Copy entire setlist → Copy with chords / Copy lyrics** to copy all included songs in setlist order, with song titles. Chord copying uses each song’s saved base key. Missing/deleted songs are skipped.

From a personal song, open **Add to setlist** and choose an existing setlist, or enter a new name and choose **Create setlist with this song**.

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

Account approval and saving changes require internet. Saved songbooks and setlists can now be read offline on the same device. Song history and deleted-song recovery are also planned.

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

`database/setlist-sharing.sql` has already been applied to the live database. Do not rerun it. It restricts setlists to personal accounts and adds protected read-only live sharing. Existing church setlist records are retained but hidden.

### Copy songs

Open a song and choose **Copy → Copy with chords** to copy its text in the currently displayed key, or **Copy → Copy lyrics** to copy without chords. Section labels remain. Copying does not edit the saved song. This replaces Print.

You can also open a personal song and choose **Add to setlist**, select an existing personal setlist, and press **Add song**. The song is appended at the end. Shared setlists update automatically.

`database/live-sharing-friends.sql` is already applied. Do not rerun it. Existing shares now follow the owner’s saved changes.

### Friends tab

On the front page, choose **Friends** to add an approved personal account by email before sharing, give them a private nickname, rename or remove them. Adding a friend does not approve an account, send an invitation or share any songs. `database/add-friends.sql` is already applied; do not rerun it.

## Complete backups, history and chord-sheet paste

**Menu → Complete backup / restore → Download complete backup** exports the current songbook’s songs, folders, personal setlists, favorites and private friend nicknames. Church exports contain church songs and your church-song favorites. Backups contain lyrics and friend emails; keep them safe. Access approvals, outgoing share permissions, received setlists and song history are not included.

**Restore complete backup** imports additional copies in one database transaction. Existing work stays unchanged; repeated restores create duplicates. Folder names and setlist names get a restored suffix. Song IDs and folder references are remapped, keeping setlist order and repeated songs. Personal restore does not create more church copies. Friends are restored only if their account is still approved. Reopen folders/setlists after restoring to reload their choices. Existing songs-only files still work through Import songs.

**Song history** on an editable song shows recent saved versions. Preview one and restore it; the replaced version remains in history. **Recover deleted songs** on the song list restores a deleted song with its original ID so setlists can find it again. Deleted folders are replaced by Unfiled. Church history is available only to the church owner; managers cannot read or restore other users’ histories. History begins with this update and cannot recover versions or deletions from before it. The UI lists up to 100 recent entries at a time.

**Paste chord sheet** in the new-song/editor screen converts chord lines above lyrics into inline braces, keeps section labels and chord-only instrumental lines, and recognizes a title above the opening chords. Nonbreaking spaces and tabs are normalized. Convert, check/edit the preview, then Apply to editor and save. Position estimates depend on the copied spacing; move `{chord}` markers afterward to correct them.

`database/history-backups.sql` has already been applied to the database. Do not run it again. Offline reading is available; offline editing and conflict syncing are not implemented.

## Simplified song fields

Category has been removed from forms, displays and search. Existing category values remain stored for compatibility with old files and history. No automatic artist lookup is performed. Paste chord sheet suggests the arrangement’s key from its chords, showing a possible alternative. Confirm or edit the suggestion before applying; it may differ from the original recording and relative major/minor keys can be ambiguous. Leave the suggestion blank to keep the existing key.

## Offline reading

Open the app online on each device and sign in. **Menu → Offline use → Save latest for offline** saves personal and church songs, folders, favorites, personal setlists and received setlists. Refresh also saves these automatically. Wait for the saved timestamp, and open/install the app online once so its application files are cached.

In airplane mode you can reopen the app, browse both songbooks, filter folders/favorites, start setlists, transpose, copy and use reading mode. All account approval, editing, saving, sharing, history, full backup and friend-management operations need internet. Shared setlists use their last saved contents and update after reconnecting. Stay signed in before going offline; first-time sign-in cannot be done offline.

Offline copies are stored in this browser/device, separately by account. Signing out or switching accounts clears the previous account’s saved copy. Menu has a Clear saved offline data button; an online refresh saves the data again. Other devices need their own save. Storage failures are reported. Browser storage can be removed by the browser/device, so this is not a replacement for downloaded backups. Revoked sharing/access cannot be checked without a connection; reconnecting checks approval and refreshes/removes saved data.

## Duplicate titles and setlist limit

Paste chord sheet checks the detected/current title against live church songs and displays matching titles, ignoring case and repeated spaces. You can load an existing version into the editor. Matching personal song titles do not add another automatic church copy; personal versions remain independent. Direct church creation with a matching title is rejected. Different songs with the same title need a distinguishing subtitle. This does not detect every alternate title or remove existing duplicates. Backup restoration remains an explicit import of additional copies.

Each account may have up to **25 personal setlists**. Existing lists above the limit are retained but new lists cannot be added until the count falls below 25. Received setlists do not count. Complete-backup restoration must fit within the limit; otherwise it rolls back without importing partial data. `database/duplicates-setlist-limit.sql` is already applied; do not rerun it.

### Streamlined chord-sheet editing

**Convert into editor** fills the regular title, key and content fields immediately, replacing the current editor text without saving. There is no separate preview/apply confirmation. Adjust the normal fields, then save. The existing-church-song notice appears directly above Save and rechecks when the title changes.

### Making a setlist at the limit

At 25, enter the new setlist’s name/songs and save. Choose Delete oldest and create, select another setlist to replace, or Cancel to review your lists. The setlist name is shown before deletion. Songs remain; shares of the deleted setlist end. Replacement runs as one transaction and rolls back if creation fails. Old setlists use their last recorded update as an approximate creation date; new setlists track the real creation date. `database/setlist-replacement.sql` is already applied.

### Opening or overwriting a duplicate

The duplicate notice has Open existing song to visit the church version directly. Overwrite uses the current editor content and requires confirmation. The church owner can overwrite church songs. Personal accounts can overwrite their own existing copy (matched by source song or title); they cannot overwrite the church copy. Make/save a personal copy first if none exists. Previous versions remain in history and revision checks prevent silently replacing someone else’s newer edits. Opening the church song leaves the current unsaved editor.

### Editor refresh fix

Opening Edit loads the freshest known saved song into every editor field. Background refreshes preserve an unsaved draft, and older refresh responses cannot replace a newer saved revision. Switching songs resets the chord-sheet input. Slow save/overwrite responses no longer navigate back to a previously selected song.

## Faster setlists and service reading

Setlist search prioritizes your personal versions. Matching church songs are offered only when no personal version exists. Selecting one automatically adds/reuses a personal copy and adds that copy to the draft setlist. Your saved personal key and edits take priority over the church arrangement. Opening a personal setlist automatically restores missing songs when your own song history still contains them; unavailable older deletions remain marked missing.

On a received live setlist, **Save to my setlists** lets you keep its name or enter a new name. It copies the current order and arrangements into your personal songbook, reusing exactly matching personal songs and creating separate copies for different versions. Your existing edited songs are never overwritten. This creates an independent setlist: later edits on either side do not affect the other. The original received setlist stays available and keeps updating. At 25 personal setlists, the replacement options still apply; copying/replacement runs as one transaction.

Unsaved song/setlist edits, new-setlist names and unconverted pasted chord sheets are protected when navigating away. You can discard changes or stay. Browsers may show their own generic warning on reload/close. These warnings do not provide persistent draft recovery after force-closing the app.

Reading mode requests a screen wake lock while visible and releases it on exit. A status shows whether it is active. Device/browser support, battery-saving settings and manual locks can prevent it. It retries when you return to the app; it cannot override all device settings.

`database/setlist-personal-copies.sql` and `database/copy-shared-setlist.sql` have already been applied. Do not run them again.


## October 16 update

Songbooks now use responsive cards and All/A–Z/# title filters. Personal folders open like folders, with a breadcrumb back to all songs. Setlists use cards and show saved keys. Setlist search includes BIC songs and prioritizes personal versions. In the menu, choose My friend ID to set a unique, changeable @ID (3–24 letters, numbers or underscores). Friends can find and confirm you by ID or email; existing connections survive ID changes. Church accounts have no friend ID. Managers may also use IDs when granting access. Plain pasted titles can precede a section heading; **Title** explicitly marks a title. The friend-ID database changes are already applied; no manual SQL is needed.
