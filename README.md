# BIC Worship DB

First time using the app? Read [START_HERE.md](START_HERE.md), the illustrated beginner guide. After deployment, it is also available in Menu → Start here.

A church songbook for browsing lyrics and chords, preparing setlists, and keeping your own arrangements in your preferred key.

**Website:** [bic-songbook.netlify.app](https://bic-songbook.netlify.app)
**Source:** [gadjet13/bic-songbook](https://github.com/gadjet13/bic-songbook)

This README describes the current source. Website changes become available after the corresponding GitHub commit successfully deploys on Netlify.

## Getting started

1. Open the website and choose **Continue with Google**.
2. Choose your **@ID** when prompted and press **Save ID and continue** to submit an access request.
3. Wait for the church owner or a manager to approve it, then press **Check approval**.
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

Open **Menu → Manage account access**. Your friend must first sign in to create an account. Enter their account email, choose a permission, and select **Update access**. This does not send an invitation email.

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

**My folders** starts closed. Open it to create folders, rename or delete a selected folder, and filter your songs. Open a personal song → Add to folder to use an existing folder or create one, then Open folder to visit it.

A song belongs to one folder at a time. **All songs** includes every personal song, including songs with no folder. There is no separate Unfiled card. Deleting a folder keeps its songs and keeps them in All songs.

### Setlists

Setlists are personal only. The church account contains songs, with no setlists.

Create or edit a setlist, search by song title, or artist, and select a result to add it. Search shows up to 20 matching songs; narrow the search if needed. Arrange songs with the up/down controls. A setlist can contain up to 100 song entries.

Setlists use songs from the same songbook. Choosing a church-only result automatically copies it to My songbook before adding that version to a personal setlist. Deleting a setlist does not delete its songs. Deleted songs appear as missing entries and are skipped when reading.

Saving a new set in the planner prepares a share link and shows it with **Copy setlist link** on the saved set. Approved members who open it land on the overview and can choose **Read full set** for every chart on one scrolling page, or **Start shared setlist** for the existing stage view. **Jump to song** takes you to a numbered occurrence. **Manage share link → Turn off link** removes access for members who joined only by link. People granted access before link sharing can still open their received sets.

For deployments upgrading from email sharing, apply `database/link-only-setlist-sharing.sql` after `database/setlist-links-and-preferences.sql` to retire the old API endpoints. Existing share records and legacy version 2 backups are supported.

In stage view, **My notes** and **My capo** are private account preferences for that song in this set. Repeated songs use the same personal preferences and can have different sounding keys. Notes are omitted from printouts. Saved notes can be read offline, and capo changes made offline sync when you reconnect.

Choose **Copy entire setlist → Copy with chords / Copy lyrics** to copy all included songs in setlist order, with song titles. Chord copying uses each song’s saved base key. Missing/deleted songs are skipped.

From a personal song, open **Add to setlist** and choose an existing setlist, or enter a new name and choose **Create setlist with this song**.

## Reading and appearance

- Choose light, dark, or device theme from the Menu.
- Adjust song text from **6px to 32px**.
- Reading mode fits lyrics into pages. Use **Columns** in either the song reader or **Read full set** to choose Auto, One, or Two. Auto uses two columns on screens at least 700px wide and one on narrower screens. Your choice is saved on this browser.
- Use page buttons, left/right arrow keys, or horizontal swipes to turn pages.
- In a setlist, Next after the final page opens the next song. Previous from the first page opens the previous song's last page when available.
- In two-column mode, read each section left to right across each row, then down. Section headings span both columns.
- Exit reading mode with its button or Escape.

## Backups and current limits

**Menu → Export backup** downloads the currently open songbook's songs as JSON. It does not export folders, favorites, setlists, membership, or account settings. Import appends songs; repeat imports can create duplicates. Importing new personal songs also creates their first church copies.

Individual song sharing and downloaded song files are separate from private setlist sharing. A shared song file/link contains the song content; send it only to intended recipients.

Account approval and saving changes require internet. Saved songbooks and setlists can now be read offline on the same device. Song history and deleted-song recovery are available.

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

### Add chord charts from Codex

See the [Codex connector staging guide](CONNECTOR_SETUP.md) for setup and testing.

### Setlist sounding keys and printing

Use the **Setlists** tab in **My songbook**. Start from a setlist card or open its details to edit keys and print. Sounding key overrides follow the shared setlist. Each musician can choose their own capo in the reader, and the print dialog offers a separate option to include those chord shapes.

Apply the additive `database/setlist-arrangements.sql` migration before publishing the frontend with sounding-key editing. Verify the migration with `tests/setlist-arrangements.sql` in a local or staging database. Older lists without entries use each song’s saved key.

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

## Complete backups, history and chord-sheet paste

**Menu → Complete backup / restore → Download complete backup** exports the current songbook’s songs, folders, personal setlists and favorites. Church exports contain church songs and your church-song favorites. Backups contain song lyrics; keep them safe. Access approvals, outgoing share permissions, received setlists and song history are not included.

**Restore complete backup** imports additional copies in one database transaction. Existing work stays unchanged; repeated restores create duplicates. Folder names and setlist names get a restored suffix. Song IDs and folder references are remapped, keeping setlist order and repeated songs. Personal restore does not create more church copies. Reopen folders/setlists after restoring to reload their choices. Existing songs-only files still work through Import songs.

**Song history** on an editable song shows recent saved versions. Preview one and restore it; the replaced version remains in history. **Recover deleted songs** on the song list restores a deleted song with its original ID so setlists can find it again. Songs whose folders were deleted remain in All songs. Church history is available only to the church owner; managers cannot read or restore other users’ histories. History begins with this update and cannot recover versions or deletions from before it. The UI lists up to 100 recent entries at a time.

**Paste chord sheet** in the new-song/editor screen converts chord lines above lyrics into inline braces, keeps section labels and chord-only instrumental lines, and recognizes a title above the opening chords. Nonbreaking spaces and tabs are normalized. Choose **Preview chord sheet**, check the chart and any flagged lines, then choose **Apply to editor**. Save after reviewing the editing fields. Position estimates depend on the copied spacing; move `{chord}` markers afterward to correct them.

`database/history-backups.sql` has already been applied to the database. Do not run it again. Offline reading is available; offline editing and conflict syncing are not implemented.

## Simplified song fields

Category has been removed from forms, displays and search. Existing category values remain stored for compatibility with old files and history. No automatic artist lookup is performed. Paste chord sheet suggests the arrangement’s key from its chords, showing a possible alternative. Review the estimate in the preview and correct it in the editor before saving. The editor keeps its key if there is no estimate.

## Offline reading

Open the app online on each device and sign in. **Menu → Offline use → Save latest for offline** saves personal and church songs, folders, favorites, personal setlists and received setlists. Refresh also saves these automatically. Wait for the saved timestamp, and open/install the app online once so its application files are cached.

In airplane mode you can reopen the app, browse both songbooks, filter folders/favorites, start setlists, transpose, copy and use reading mode. All account approval, editing, saving, sharing, history, full backup and friend-management operations need internet. Shared setlists use their last saved contents and update after reconnecting. Stay signed in before going offline; first-time sign-in cannot be done offline.

Offline copies are stored in this browser/device, separately by account. Signing out or switching accounts clears the previous account’s saved copy. Menu has a Clear saved offline data button; an online refresh saves the data again. Other devices need their own save. Storage failures are reported. Browser storage can be removed by the browser/device, so this is not a replacement for downloaded backups. Revoked sharing/access cannot be checked without a connection; reconnecting checks approval and refreshes/removes saved data.

## Duplicate titles and setlist limit

Paste chord sheet checks the detected/current title against live church songs and displays matching titles, ignoring case and repeated spaces. You can load an existing version into the editor. Matching personal song titles do not add another automatic church copy; personal versions remain independent. Direct church creation with a matching title is rejected. Different songs with the same title need a distinguishing subtitle. This does not detect every alternate title or remove existing duplicates. Backup restoration remains an explicit import of additional copies.

Each account may have up to **25 personal setlists**. Existing lists above the limit are retained but new lists cannot be added until the count falls below 25. Received setlists do not count. Complete-backup restoration must fit within the limit; otherwise it rolls back without importing partial data. `database/duplicates-setlist-limit.sql` is already applied; do not rerun it.

### Streamlined chord-sheet editing

The preview keeps repeat cues such as `x2` on instrumental rows and removes standalone page numbers from exported charts. **Apply to editor** replaces the chart and fills any detected title and key. The existing-church-song notice appears above **Save** and rechecks when the editor title changes.

### Making a setlist at the limit

At 25, enter the new setlist’s name/songs and save. Choose Delete oldest and create, select another setlist to replace, or Cancel to review your lists. The setlist name is shown before deletion. Songs remain; shares of the deleted setlist end. Replacement runs as one transaction and rolls back if creation fails. Old setlists use their last recorded update as an approximate creation date; new setlists track the real creation date. `database/setlist-replacement.sql` is already applied.

### Opening or overwriting a duplicate

The duplicate notice has Open existing song to visit the church version directly. Overwrite uses the current editor content and requires confirmation. The church owner can overwrite church songs. Personal accounts can overwrite their own existing copy (matched by source song or title); they cannot overwrite the church copy. Make/save a personal copy first if none exists. Previous versions remain in history and revision checks prevent silently replacing someone else’s newer edits. Opening the church song leaves the current unsaved editor.

### Editor refresh fix

Opening Edit loads the freshest known saved song into every editor field. Background refreshes preserve an unsaved draft, and older refresh responses cannot replace a newer saved revision. Switching songs resets the chord-sheet input. Slow save/overwrite responses no longer navigate back to a previously selected song.

## Faster setlists and service reading

Setlist search prioritizes your personal versions. Matching church songs are offered only when no personal version exists. Selecting one automatically adds/reuses a personal copy and adds that copy to the draft setlist. Your saved personal key and edits take priority over the church arrangement. Opening a personal setlist automatically restores missing songs when your own song history still contains them; unavailable older deletions remain marked missing.

On a received live setlist, **Save to my setlists** lets you keep its name or enter a new name. It copies the current order and arrangements into your personal songbook, reusing exactly matching personal songs and creating separate copies for different versions. Your existing edited songs are never overwritten. This creates an independent setlist: later edits on either side do not affect the other. The original received setlist stays available and keeps updating. At 25 personal setlists, the replacement options still apply; copying/replacement runs as one transaction.

Unsaved song/setlist edits, new-setlist names and unconverted pasted chord sheets are protected when navigating away. You can discard changes or stay. Browsers may show their own generic warning on reload/close. These warnings remain separate from browser-local song draft recovery, described below. Setlist edits also have browser-local draft recovery, described below.

Reading mode requests a screen wake lock while visible and releases it on exit. A status shows whether it is active. Device/browser support, battery-saving settings and manual locks can prevent it. It retries when you return to the app; it cannot override all device settings.

`database/setlist-personal-copies.sql` and `database/copy-shared-setlist.sql` have already been applied. Do not run them again.


## October 16 update

Songbooks now use responsive cards and All/A–Z/# title filters. Personal folders open like folders, with a breadcrumb back to all songs. Setlists use cards and show saved keys. Setlist search includes BIC songs and prioritizes personal versions. In the menu, choose My account ID to set a unique, changeable @ID (3–24 letters, numbers or underscores). Church accounts have no account ID. Managers may also use IDs when granting access. Plain pasted titles can precede a section heading; **Title** explicitly marks a title.



## Remember me (October 19)

The login checkbox defaults to on and applies to email and Google OAuth. Auth sessions explicitly persist and refresh through a storage adapter: localStorage when checked, sessionStorage when unchecked. Offline identity uses the same choice, so a tab-only login is not resurrected from a persistent offline identity. Sign-out removes auth entries from both stores. Existing default localStorage sessions remain compatible. Storage failures fall back to memory and a login-page message explains when persistent storage is blocked. Private browsing, cleared site data, and server session policies can still require login. No database migration required.


## Song draft recovery and setlist keys (October 19)

Unsaved new and edited songs, including raw pasted chord sheets, are saved automatically on this browser under the signed-in user and songbook scope. Recover/discard controls appear on the song list. Recovery never writes to the database: users review and save explicitly. A revision mismatch or missing original offers recovery as a new song, preserving the current database version. Successful saves, confirmed Cancel/Discard, and sign-out clear the relevant drafts. Drafts use the Remember me storage choice, so unchecked sessions do not survive a fresh tab session. Drafts do not sync, and browser clearing/quota restrictions can prevent recovery; editor status distinguishes persistent storage from memory-only fallback. Setlist draft recovery is now available too, as described below.

Personal and received setlists show an ordered Saved key overview using saved base keys, with repeated and missing entries preserved. Setlist editing also shows each song’s key alongside reorder controls. This does not change saved keys or temporary reading-mode transposition. The illustrated START_HERE guide is included in this batch. No SQL migration is needed.


## Collapsible library and dedicated setlist pages (October 19)

My Setlists, My folders and Song filters start collapsed. Filters include first letter, artist (the Author / singer field), and favorites, with a visible active-filter summary. Unfiled is no longer a navigation item: songs without a folder remain in All songs. Folder membership remains one folder per song. Add to folder supports existing/new folders, removing membership, and opening the destination folder. Song history stays at the bottom of its song page; deleted-song recovery is now in Menu below Complete backup / restore.

On a setlist card, choose the green play button to read the full set, the title to edit, or the link button to copy its share link.

The reader measures unwrapped lines on opening and width changes, fits font size down to 12px, and groups lyric words across chord markers so wrapping only happens at whitespace. Manual A+ can deliberately cause wrapping. Oversized wrapped source lines are packed by measured visual rows to avoid clipping across columns/pages. An unbroken word wider than a column at 12px remains intact and can scroll horizontally; it is not split at a chord marker.


### Readable automatic sizing

The default text size is 16px. Previously saved sizes below 12px reset to 16px on startup. Opening reading mode starts with the current size and checks each size in descending 1px steps, stopping at the first that fits the measured column. Automatic reduction stops at 12px: longer lines then wrap at spaces, with chords inside a word kept together. Manual text-size controls remain available.


## Setlist recovery, visual chord positions and offline checks (October 20)

**Setlist drafts:** unsaved names and song order are saved in this browser under your account. Open **My Setlists → Recover setlist draft**, review, then **Save setlist**. Names entered through a song’s **Create setlist with this song** flow are included. Successful save, confirmed Cancel/Discard and sign-out clear the relevant drafts. If the original setlist changed or was deleted, recovery offers a new independent setlist; it never silently replaces the saved version. The 25-list limit still applies. Drafts follow Remember me: persistent browser storage when checked, tab storage otherwise. They do not sync; blocked/full storage can leave a draft only in memory, as shown in the editor status.

**Visual chord positions:** in Add/Edit Song, open **Adjust chord positions visually**. Drag a chord to a lyric character, or select it and tap its destination. Arrows move one character; keyboard left/right works on a focused chord. Chords can move between lyric lines, with close chords separated into lanes. Lyrics, sections and chord spelling stay unchanged. **Undo last move** reverses the most recent movement while its result is still in the editor. Save the song afterward. The original text editor remains available.

**Per-setlist offline checks:** personal and received setlist cards show a status; open a setlist for details and **Save latest for offline**. **Ready offline** requires the stored setlist order and song versions, saved sign-in identity, and the current app worker’s cached application files to be verified on this device. Missing/outdated data requests a save; unverified app files never show Ready. A received list checks its own shared versions. Refresh while online, stay signed in, then test airplane mode before worship. A green status verifies the current saved copy, not future remote changes, device storage retention or continued access approval. Offline editing and syncing remain deferred. No SQL migration is required for this update.


## Song sorting (October 22)

Open **Song filters → Sort songs**. Choose **Title A–Z / Z–A**, **Date added — newest / oldest first**, or **Last edited — newest / oldest first**. Sorting rearranges all matching songs; it does not hide songs by date. This replaces the October 21 date-range controls. Sorting works with search, folders, first-letter, artist and favorites filters. The active summary remains visible when collapsed, and **Clear song filters** resets sorting to Title A–Z too. Received setlists keep their owner's order.

Older songs without a recorded added date appear last in both date-added directions. New songs record their added date; last edited uses the server timestamp, including saved folder/key changes. Refresh online to update offline copies. The existing added-date database change remains applied; no new SQL step is needed.


## Joining with an @ID and pending access requests (October 28)

After first sign-in, personal accounts without a account ID see **Choose your @ID**. Choose a unique 3–24-character ID using letters, numbers or underscores, then **Save ID and continue**. Existing personal accounts without IDs are prompted too; IDs remain changeable from Menu → My account ID. The church owner is exempt. An existing saved offline session remains readable without an online onboarding check.

For an unapproved account, saving the ID also submits an access request. The waiting screen shows **Awaiting approval** and **Check approval**. Users who already have an ID but have not submitted can choose **Request access**. A declined user can explicitly **Request access again**; simply refreshing does not resubmit a declined request.

Managers and the church owner open **Menu → Pending access requests (count)**. Expand it to see the sign-in display name, @ID (or ID not chosen yet), email and request time. **Approve** grants ordinary member access; **Decline** asks for confirmation and leaves the login account intact without library access. It does not delete songs or accounts. No email is sent. Check the email/ID: display names are supplied by the sign-in account and are not verified identities.

Existing confirmed accounts without access were included in the pending queue. Approved accounts stay out of it. Requests refresh on focus and every 30 seconds while visible; users can also refresh manually. Members cannot read the queue or approve requests. Stale/repeated decisions are rejected server-side and cannot demote an existing manager or owner. Existing manual access management and the Show/Hide registered-accounts list remain available in Menu.

The database change has already been applied. `database/registration-requests.sql` is reference only; no manual SQL step is needed. Regression SQL in `tests/registration-access.sql` uses temporary test accounts in a transaction that rolls back. This update does not change church song-editing permissions.


## Menu layout, library sorting and offline-copy recovery (October 29)

**Menu:** Pending access requests is now inside Menu for managers and the church owner. Show registered accounts includes each person's @ID, or a dash when none is set (including the church owner). After opening a songbook, the Menu order is Export songs only / Import songs, then Complete backup / restore, then Recover deleted songs. Saved-version Song history stays on its song page.

**Sort setlists and folders:** open My Setlists or My folders, expand its Sort control, and choose Name A–Z / Z–A, Date added newest / oldest, or Last edited newest / oldest. This rearranges cards only, never the songs within a setlist. Missing dates sort last. Folder timestamps begin with this update; existing unknown folder dates remain unknown. Folder last-edited tracks folder renaming, not edits to songs inside it. Older setlist creation dates may be approximate, as previously documented. Refresh online to update device-local copies with dates.

**Recover the last offline save:** inside Complete backup / restore, choose Preview last offline save. It reads this account's latest snapshot from this device and shows its saved time, songbook, song/folder/setlist/favorite counts and a song preview. Review it, then Restore offline save as copies and confirm. Current work is kept. IDs are remapped, setlist order/repeats and folder memberships are preserved, and restored folders/lists get recovery names. Missing setlist-song references are reported and skipped. Received setlists, access permissions and history are not in this offline recovery copy. Only the current songbook is restored; church restoration remains owner-only. Restore requires internet and respects the 25-personal-setlist limit; an invalid/over-limit import rolls back. Repeated restores create duplicates.

This is the latest snapshot still stored, not an archive: online refreshes can replace it, and signing out or clearing site data can remove it. A preview captures a fixed copy so later background refreshes do not alter what you confirm. Keep downloaded complete backups and use Song history for earlier versions. The existing file-based complete restore still adds copies too.

Database changes for folder dates and the manager-only account-ID listing are already applied. `database/menu-library-dates.sql` is reference only; no manual SQL step is needed.


## Setlist default order and reading content (November 3)

Personal setlist cards now default to **Date added — newest first**. You can still choose any other sort. Folder cards keep their existing **Name A–Z** default. Neither setting changes the order of songs inside a setlist.

When opening **Reading mode**, choose **Lyrics only** or **Lyrics + chords**, or cancel. Lyrics only keeps the lyrics and section labels and removes chord spacing from the page layout. **Reading content** also lets you switch while reading; pages are recalculated for the chosen layout. The choice stays active across next/previous songs in a setlist. It affects display only, including saved offline reading, and never edits stored arrangements or transpositions. No database change is needed.


## Horizontal song flow and linked sections (November 3)

Add/Edit Song now has a **Song flow** panel above the main editing fields. Sections are compact horizontal items that wrap on small screens. Existing [Verse 1] / [Chorus] headings and legacy # headings are recognized; chord-only lines remain chords. Opening text without a heading is kept at the start, with an option to name it and include it in the movable flow.

Drag a handle, or select a section and use the move arrows. The + insertion markers choose exactly where to add a new section or repeat an existing one. Select a section for its lyrics/chords, name, insert-after and remove controls. Removing one occurrence keeps the others. **Undo last flow change** reverses the latest flow edit while its result is still current; later edits in another editor disable that stale undo. All changes remain a draft until Save.

Repeated section names with matching text are **linked**. Editing their lyrics/chords through the section editor, regular text editor or visual chord-position editor updates matching occurrences. Rename a particular occurrence, for example **Chorus 2**, before giving it a different arrangement. Copying/importing a complete chord sheet preserves its separate versions for review rather than silently forcing them to match.

Existing sections with the same name but different lyrics/chords are highlighted and stay unchanged. Resolve them before saving: **Keep variations as separate sections** gives distinct numbered labels while keeping every version, or **Use selected version for all ... sections** explicitly replaces the differing versions in the draft. Renaming individual occurrences also works. Equal labels are compared without case differences and repeated spaces; differing final blank lines alone do not create conflicts.

Flow edits are included in browser-local song draft recovery. Saving retains the complete expanded song text, so existing reading, lyrics-only mode, transposition, copying, history, backups and live setlist sharing continue to use the arrangement. No database migration or new backup format is needed. This combined patch also includes the earlier November 3 newest-setlist default and lyrics/chords reading choices; folders remain A–Z by default.
