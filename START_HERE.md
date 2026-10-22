# BIC Worship DB — Start here

A first-time user guide. Updated October 21, 2026; includes setlist draft recovery, visual chord positioning and offline checks.

Open [BIC Worship DB](https://bic-songbook.netlify.app/). Installing an app is optional.

Prefer an illustrated web page? After deployment, open [the start-up guide](https://bic-songbook.netlify.app/start-guide.html).

## 1. Sign in and get access

![1. Sign in and get access](public/guide-images/01-sign-in.svg)

*Workflow illustration, not an app screenshot; layouts vary by device.*

1. Open [bic-songbook.netlify.app](https://bic-songbook.netlify.app/) in your browser. Installing the app is optional.
1. Choose **Continue with Google**, or **Create an account** to use email and a password. Confirm your email if asked.
1. Keep **Remember me on this device** checked on your own device. Uncheck it on a shared device.
1. Ask the church owner or a manager to approve your account, then press **Refresh library**.

Already have an account? Use the same login method and email. Private browsing or clearing site data can forget your login.

## 2. Choose a songbook

![2. Choose a songbook](public/guide-images/02-songbooks.svg)

*Workflow illustration, not an app screenshot; layouts vary by device.*

**My songbook** is your workspace: edit your arrangements, organize folders and prepare setlists. **Bukchon International Chapel** is the church collection. Members can read it and use **Copy to My songbook** to make an editable personal version.

A new personal song’s first saved version is also added to the church collection unless that title already exists there. Later personal edits do not change the church copy. A manager approves access but cannot edit church songs. The church account manages only the church collection.

## 3. Add a song or paste a chord sheet

1. Open **My songbook → + Add Song → Paste chord sheet**.
1. Paste the title, section headings and chords above the lyrics. To mark the title explicitly, type literal asterisks: `**Song title**`. Bold formatting alone is not retained.
1. Press **Convert into editor**. Check the title, estimated key and chord positions in the editing fields.
1. Open **Adjust chord positions visually**. Drag a chord to a lyric character, or select the chord and tap its destination. Use arrows for one-character adjustments, and **Undo last move** if needed. Moving chords between lyric lines is supported. You can also edit `{chord}` markers directly. Save afterward; conversion and positioning alone do not save.

```text
**Morning Song**

[Verse 1]
G             D
A new day is here
```


In the editor, chords use braces, such as `{G}A new day is {D}here`. Sections use square brackets: `[Verse 1]`, `[Chorus]`.

If a duplicate warning appears above Save, open the existing song first. Overwrite replaces an existing editable version; review carefully before confirming.

## 4. Find and organize songs

Use search for a title or artist. My Setlists, My folders and Song filters are collapsible sections that start closed. Open Song filters for the first-letter buttons, Author / singer filter and favorites. Active filters stay visible when the section is closed; Clear song filters removes them. **All · A–Z · #** filters titles by their first character; **#** includes numbers, symbols and non-Latin titles. Cards adapt to your screen.

Open a folder card to see its songs. Use the **My Songbook** breadcrumb to return to all songs. Create a folder under **New folder**; open a song and choose **Add to folder**. Select an existing folder and **Add song to folder**, or choose **Create folder and add song**. Use **Open folder** afterward to visit it. Folder **⋮** offers Rename and Delete. Deleting a folder keeps its songs in **All songs**.

## 5. Prepare your first setlist

![5. Prepare your first setlist](public/guide-images/03-setlist.svg)

*Workflow illustration, not an app screenshot; layouts vary by device.*

1. In **My songbook → My Setlists**, choose **New setlist** and enter a name.
1. Search by song title or artist. Personal results show your name; church results show **BIC**. Your personal version takes priority when the song is in both places.
1. Select songs in service order. Selecting a BIC-only song automatically adds a personal copy to your songbook.
1. Use **↑ / ↓** to reorder, then **Save setlist**. Reopen it from its card on a dedicated setlist page. Use **Back to setlists** to return. Copying sits below the Start setlist / Edit setlist row; Sharing opens and closes separately. **Saved key overview** shows every song and its base key together, without temporary reading-mode transpositions.

You can also open a personal song → **Add to setlist**, then choose an existing list or **Create setlist with this song**. Each account can keep 25 personal setlists. At the limit, you can replace the oldest, choose another to replace, or cancel. Deleting a setlist keeps the songs but ends its outgoing shares.

Unsaved setlist names and song order are saved in this browser. After returning, open **My Setlists → Recover setlist draft**, review and save. If the original changed or was deleted, recovery offers a new independent list. This also covers new names entered from **Add to setlist** on a song. Save, confirmed Cancel/Discard and sign-out clear drafts. Keep Remember me checked for recovery after closing the browser; drafts never sync between devices.

## 6. Add friends and share

1. Open **Menu → My friend ID**. Choose a unique ID using 3–24 letters, numbers or underscores; for example `@your_name`. You can change it later without losing friends or shares.
1. From the front page, open **Friends**. Enter an approved friend’s ID or email, choose **Find person**, check the displayed person, then **Confirm add friend**. Private nicknames help you recognize people.
1. Open a saved setlist, select a friend or enter their email, then **Share setlist**. They open it under **Shared with me**.

Sharing gives read-only access to that setlist and its songs, not your whole songbook. Your saved changes update the received list automatically; an open list checks periodically. Adding a friend alone does not share anything or grant church access. No email notification is sent.

**Want your own arrangement?** On a received list, choose **Save to my setlists** and keep or change its name. This makes an independent copy. Your edits will not change the sender’s list, and their later changes will not update your personal copy. The original received list stays live separately.

## 7. Read during worship and prepare offline

![7. Read during worship and prepare offline](public/guide-images/04-before-service.svg)

*Workflow illustration, not an app screenshot; layouts vary by device.*

1. Open the saved setlist and choose **Start setlist → Reading mode**.
1. Text starts at 16px by default. Reading mode checks the current size, then decreases it 1px at a time only if needed. It stops as soon as lines fit, with a 12px automatic minimum. Use **A− / A+** for text size afterward. If a line must wrap, it breaks at spaces; chord markers inside a word stay with that word. Use page arrows or swipe. At the last page, Next continues to the next song; at the first page, Previous returns to the previous song’s last page when available.
1. Transpose changes the displayed key. To make it permanent in your editable personal song, choose **Save in X as base key**. Transpose then resets to zero.
1. Before leaving Wi-Fi, open **Menu → Offline use → Save latest for offline**. Wait for the saved timestamp. Check the status on each setlist card, or open it for details. **Ready offline** verifies the stored order, song versions, saved sign-in and app files on this device. If it says **Save for offline**, save again online; if app files cannot be verified, refresh online and recheck. A received list checks its own shared versions.
1. Stay signed in. Test airplane mode and reopen the setlist on that device before the service.

Offline mode supports reading, transposing and page turning. Editing, sharing and new login need internet. Received lists use their last saved version. A ready label confirms the current saved copy, not future changes on the server. Browser storage can still be cleared, so test airplane mode before each service. Check the screen-awake status in reading mode; device settings may still release it.

## 8. Copy, back up and recover

**Copy → Copy lyrics** copies words without chords; **Copy with chords** includes the displayed chords. **Copy entire setlist** copies songs in saved order.

Use **Complete backup / restore → Download complete backup** to keep a separate backup. It includes songs, folders, personal setlists, favorites and private friend nicknames. It excludes received setlists, history and access permissions. Restore adds copies rather than replacing your current work.

For an accidental edit, at the bottom of a song page, open **Song history** and preview an earlier saved version before restoring. Use **Recover deleted songs** on the song list for available deleted-song history. Unsaved song fields and unconverted pasted chord sheets are saved as local drafts while you edit. After returning to the same songbook, choose **Recover draft**, review it and save. If the original changed or was deleted, recovery offers a new song instead. **Cancel** or **Discard draft** removes it. Drafts do not sync across devices and are cleared on sign-out. Keep **Remember me** checked for recovery across browser sessions; unchecked sessions keep drafts only in that tab. If browser storage is blocked or full, the editor warns that the draft is only in memory. Save regularly and keep backups.

## Quick troubleshooting

**I see “Awaiting access.”**
Ask a manager to approve your account email or ID, then Refresh library.

**I cannot edit a church song.**
That is expected for personal accounts. Choose Copy to My songbook and edit your copy.

**A friend cannot see my shared setlist.**
Check their approved account email and use Share setlist. Adding a friend alone is not sharing.

**I cannot edit while offline.**
Reconnect first. Offline mode is for reading saved copies.

**The app looks out of date.**
Connect to the internet and refresh after a successful deployment. If it persists, close and reopen it.

**I need to sign in again.**
Check Remember me and use the same regular browser and website address. Avoid private mode and settings that clear site data on exit.



## Song sorting (October 22)

Open **Song filters → Sort songs**. Choose **Title A–Z / Z–A**, **Date added — newest / oldest first**, or **Last edited — newest / oldest first**. Sorting rearranges all matching songs; it does not hide songs by date. This replaces the October 21 date-range controls. Sorting works with search, folders, first-letter, artist and favorites filters. The active summary remains visible when collapsed, and **Clear song filters** resets sorting to Title A–Z too. Received setlists keep their owner's order.

Older songs without a recorded added date appear last in both date-added directions. New songs record their added date; last edited uses the server timestamp, including saved folder/key changes. Refresh online to update offline copies. The existing added-date database change remains applied; no new SQL step is needed.
