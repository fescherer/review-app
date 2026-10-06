# Media Review

A local, single-user desktop app for reviewing media you've consumed (anime, books, movies, games…) and keeping
watchlists/reading lists of things you want to get to. Everything (database and images) lives in **one folder**
that you can sync with Google Drive for Desktop. No accounts, no cloud services, works fully offline.

Built with Tauri v2, React, TypeScript, Vite, Tailwind CSS and SQLite.

## Setup on Windows

### 1. Prerequisites

1. **Microsoft C++ Build Tools**: install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   and select the **"Desktop development with C++"** workload.
2. **WebView2**: preinstalled on Windows 10 (1803+) and 11. If missing, get the "Evergreen Bootstrapper" from
   [Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/).
3. **Rust**: install with [rustup](https://rustup.rs/) (`rustup-init.exe`) and keep the default
   `stable-x86_64-pc-windows-msvc` toolchain. Check with `rustc -V`.
4. **Node.js** 20 or newer (LTS) from [nodejs.org](https://nodejs.org/). Check with `node -v`.

See the official guide for details: <https://v2.tauri.app/start/prerequisites/>.

### 2. Install and run

```powershell
npm install
npm run tauri dev      # development, with hot reload
npm run tauri build    # release build + Windows installers
```

The first `tauri dev`/`tauri build` compiles the Rust dependencies and takes a few minutes. Later runs are fast.

The installers end up in `src-tauri\target\release\bundle\nsis\` (`.exe`) and `...\bundle\msi\` (`.msi`).

## Using a Google Drive folder

1. Install **Google Drive for Desktop** and sign in. Your Drive shows up as a drive letter, usually `G:\My Drive`.
2. Create an empty folder, e.g. `G:\My Drive\MediaReview`.
3. Start the app and pick that folder on the welcome screen. The app creates its structure and database there.
4. On another PC, install the app, wait for Drive to finish syncing, and pick the **same** folder. Because it
   already contains `media.db`, the app opens it as-is.

Tips:

- Use the app on **one PC at a time** and let Drive finish syncing before switching. SQLite files don't merge.
  If two PCs edit at once, Drive keeps both copies as conflicting versions.
- The database runs with `journal_mode = DELETE` (not WAL), so the only database file is `media.db`. The app
  closes the database when you close the window.
- If Drive isn't running, the app shows a "Can't open your data folder" screen with **Try again**. It checks
  again whenever the window regains focus.
- Change the folder any time in **Settings → Data folder**. The folder path itself is stored per PC in
  `%APPDATA%\com.felipe.mediareview\settings.json`, not in the synced folder.

## Data folder structure

```
<root>/
  media.db                 SQLite database (all records)
  defaults/                built-in placeholder covers (book, movie, anime, game…), copied on setup
  reviews/
    <tag-slug>/            one folder per tag, e.g. anime/, book/, movie/
      <review-id>/         images + thumbnails of one review
  lists/
    <list-slug>/           one folder per list, e.g. anime-watchlist/
      <item-id>/           images + thumbnails of one list item
  references/              flat folder: <id>.<ext> files + <id>.thumb.webp thumbnails (no subfolders)
  exports/                 JSON backups from Settings → Export
```

- Image paths in the database are **relative to the root** (e.g. `reviews/anime/<id>/a1b2c3.jpg`), so the folder
  works on any PC and any drive letter.
- Each imported image is **copied** in. Your originals are never moved or changed. A thumbnail (max 400px wide,
  WebP) is created next to it as `<name>.thumb.webp`.
- Renaming a tag or list renames its folder and updates the stored paths.
- Deleting a review or list item deletes its image folder (after a confirmation).
- Deleting a tag that has reviews requires picking another tag to move them to. Their folders move too.

## Features

- **Reviews**: a grid of cards (cover, title, stars). Click a card for the gallery, tag, date and the full review
  (Markdown supported). Search the title and text; filter by tags, star range and review date; sort by review
  date, grade, title or date added.
- **Grades**: stored as an integer 0–10, shown as 0–5 stars (`grade / 2`, odd grades are half stars). In the form,
  click the left half of a star for a half value.
- **Images**: add one or more with the file picker or drag & drop, or use a default cover. Click an image to make
  it the cover (the first one is the default cover).
- **Find**: lists such as watchlists or reading lists. Items appear in a new random order (Fisher–Yates) every time
  you open a list, and **Shuffle again** reshuffles them. **Mark as done** opens a pre-filled review form. Saving it
  moves the images into the review's folder and removes the item from the list.
- **References**: a flat library of any files (images, videos, text, PDFs, ...) organized by free-form tags
  instead of folders. Add files with the picker, drag & drop (files or whole folders) or **Import folder**. Files
  are copied by the OS (not loaded into memory), with a progress bar for big imports. Before importing you can
  apply the same tags to all files and edit each title. Thumbnails: images are resized, videos get a frame from
  about 1 second in, text files show their first lines, other files show an icon. The detail view has an image
  zoom, a video player (with "Open in default app" when the webview can't play a format such as some
  .mkv/.avi files), rendered text/Markdown, and "Open in default app" / "Show in folder". Filter by tags
  (**All tags** = AND, **Any tag** = OR) with live counts (combinations with no matches are dimmed), by file type,
  and search titles, notes, original file names and the contents of text files. Sort by date added, title or
  size, or press **Shuffle** for a random order (Fisher–Yates).
- **Settings**: data folder, reference tags (rename, merge, delete, usage counts), manage tags and lists, and export everything to `exports/media-backup-<time>.json`.

## Code layout

```
src/
  types/        shared domain types
  db/           SQLite access (tauri-plugin-sql): client, migration runner, queries per table
    migrations/ versioned SQL files (001_init.sql, …), applied on startup using PRAGMA user_version
  services/     business logic + zod validation: dataFolder, fileSystem, images, tags, reviews,
                lists, listItems, exportService, config (tauri-plugin-store)
  components/   reusable UI (cards, stars, image picker, forms, modals)
  pages/        Reviews, Find, Settings, Welcome
  assets/defaults/  placeholder cover SVGs bundled into the app
src-tauri/
  src/lib.rs    plugin registration + one command (allow_data_folder) that grants fs/asset access
                to the folder you picked at runtime
  capabilities/default.json   permissions for fs, dialog, sql, store, opener
  tauri.conf.json             window, CSP, asset protocol, bundle settings
```

To change the schema, add a new file such as `src/db/migrations/002_add_something.sql`. It runs once on the next
start.
