# Book & Notes Vault

A calm, accessible personal library for keeping book details and your own reading notes together. Catalog, pages, tags, and regex-powered search in plain HTML, CSS, and JavaScript — no frameworks, no build step, no server.

Everything lives in your browser's `localStorage`. Export a JSON backup whenever you want a copy.

> **Live app:** <https://fiacredev.github.io/Book-Notes-Vault/> ·
> **Demo video:** _link to be added_ (see [Demo video](#demo-video))

---

## Contents

1. [Chosen theme](#chosen-theme)
2. [Live demo](#live-demo)
3. [Features](#features)
4. [Tech stack and why](#tech-stack-and-why)
5. [Project structure](#project-structure)
6. [Regex catalog](#regex-catalog)
7. [Search patterns to try](#search-patterns-to-try)
8. [Keyboard map](#keyboard-map)
9. [Accessibility notes](#accessibility-notes)
10. [Data model](#data-model)
11. [How to run](#how-to-run)
12. [How to run the tests](#how-to-run-the-tests)
13. [Demo video](#demo-video)
14. [Storage, import/export, and privacy](#storage-importexport-and-privacy)
15. [Responsive breakpoints](#responsive-breakpoints)
16. [Limitations](#limitations)

---

## Chosen theme

**Book & Notes Vault** — a reading-room aesthetic in warm paper tones with deep library green.

| Token      | Value     | Role                                 |
| ---------- | --------- | ------------------------------------ |
| `--cream`  | `#f7f4eb` | Page background                      |
| `--paper`  | `#fffdf7` | Card and panel surfaces              |
| `--ink`    | `#26372c` | Primary text                         |
| `--green`  | `#244a38` | Buttons, links, active nav           |
| `--brown`  | `#825a3c` | Accents and book-stack artwork       |
| `--danger` | `#8c3028` | Delete actions and over-target state |

Green reads as growth and focus; the cream/paper neutrals keep long reading sessions comfortable instead of clinical. All foreground/background pairs were chosen to clear WCAG AA contrast for body text.

---

## Live demo

**Live site:** <https://fiacredev.github.io/Book-Notes-Vault/>

Hosted on GitHub Pages. The same app and the test suite are both reachable from the deployed build:

| Page       | URL                                                       |
| ---------- | --------------------------------------------------------- |
| App        | <https://fiacredev.github.io/Book-Notes-Vault/>           |
| Test suite | <https://fiacredev.github.io/Book-Notes-Vault/tests.html> |
| Seed data  | <https://fiacredev.github.io/Book-Notes-Vault/seed.json>  |
| Repository | <https://github.com/fiacredev/Book-Notes-Vault>           |

To republish after a change, push to `main` and GitHub Pages serves it.

> Running locally? `python -m http.server 8000` and open <http://localhost:8000>. A server is required — ES modules and `fetch` are blocked on `file://`.

---

## Features

**Catalog**

- Add, edit, and delete books with inline confirmation
- Fields: title, author, pages, tag, date added, ISBN, free-form notes
- Sort by title, author, date added, or page count, each ascending and descending
- Table layout on tablet and up, card layout on mobile

**Regex search**

- Live search across title, author, tag, ISBN, notes, and date
- Toggle for case-insensitive matching
- Matches highlighted with `<mark>`; invalid patterns report an error instead of breaking
- Safe compilation — an unbalanced `(` never throws

**Dashboard**

- Total books, total pages, favourite tag, books added this week
- Seven-day CSS bar chart with a text alternative for screen readers
- Page target with progress bar; the status message is `polite` while under target and switches to `assertive` once exceeded

**Data**

- Auto-save to `localStorage` on every change
- JSON export and import with full structural validation before anything is written
- Merge or replace on import, duplicate-ID detection, 10,000-book cap, 5 MB file cap
- `seed.json` with 12 diverse records to load as a starting library

**Interface**

- Mobile-first responsive layout across four breakpoints
- Semantic landmarks, skip link, visible focus, ARIA live regions
- Reduced-motion support via `prefers-reduced-motion`

---

## Tech stack and why

Vanilla HTML, CSS, and JavaScript ES modules. No frameworks, no bundler, no dependencies.

ES modules give each concern its own file, and the browser's module loader replaces the bundler. That means the `scripts/` folder you read is the same code that ships — nothing is compiled, minified, or hidden.

State is a single observable store. Every mutation follows the same commit path — mutate, persist, re-render, announce — so the DOM can never drift out of sync with the data.

---

## Project structure

```
.
├── index.html              App shell: landmarks, forms, panels, dialog
├── seed.json               12 sample records for import
├── tests.html              Standalone assertion suite (93 checks)
├── styles/
│   └── main.css            All styling, mobile-first with custom properties
├── scripts/
│   ├── main.js             Bootstrap: wires modules, renders on state change
│   ├── config.js           Storage keys, limits, the shared regex catalog
│   ├── state.js            Observable store — all mutations flow through here
│   ├── storage.js          localStorage read/write with graceful failure
│   ├── validators.js       Regex rules, ISBN checksums, record/list validation
│   ├── search.js           Safe regex compiler, matching, highlighting, sorting
│   ├── stats.js            Dashboard metrics, weekly chart, target logic
│   ├── library.js          Table and card rendering, empty states
│   ├── form.js             Add/edit form, inline errors, edit mode
│   ├── records.js          Delegated edit/delete actions, confirm dialog
│   ├── settings.js         Export, import, clear vault, page target
│   ├── navigation.js       Mobile menu, scroll-spy for aria-current
│   └── utils.js            DOM, escaping, and date helpers
├── docs/SPEC.md            M1 specification, data model, accessibility plan
├── assets/                 Static assets
└── codevibe-report/        Submission report
```

---

## Regex catalog

All patterns live in `scripts/config.js` and are shared by the form, the record validator, the importer, and the test suite.

### Validation

| Pattern                                              | Purpose                                     | Example                             |
| ---------------------------------------------------- | ------------------------------------------- | ----------------------------------- |
| `/^\S(?:.*\S)?$/`                                    | No leading or trailing whitespace           | `Atomic Habits` ✅ · ` Atomic` ❌   |
| `/\s{2,}/`                                           | No collapsed double spaces                  | `Deep Work` ✅ · `Deep  Work` ❌    |
| `/^(0\|[1-9]\d*)$/`                                  | Pages: whole number, no leading zero        | `320` ✅ · `0320` ❌ · `32.0` ❌    |
| `/^\d{4}-(0[1-9]\|1[0-2])-(0[1-9]\|[12]\d\|3[01])$/` | Date in `YYYY-MM-DD`                        | `2025-09-29` ✅ · `2025-13-01` ❌   |
| `/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/`                    | Tag: letters separated by spaces or hyphens | `Self-Development` ✅ · `Sci2Fi` ❌ |
| `/^rec_[A-Za-z0-9_-]{1,60}$/`                        | Record ID shape                             | `rec_0001` ✅                       |
| `/^[1-9]\d*$/`                                       | Page target                                 | `1000` ✅ · `0` ❌                  |

### Advanced — back-references and lookahead-free extraction

| Pattern                                                | Purpose                                                    | Example                                     |
| ------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------- |
| `/\b(\p{L}\p{N}_]+)\s+\1\b/iu`                         | **Back-reference.** Catches a word repeated next to itself | `the the book` ❌                           |
| `/(?:97[89][\d\s-]{10,17}\d\|\d[\d\s-]{8,14}[\dXx])/g` | Pulls an ISBN candidate out of free text                   | `copy: 978-0-7352-1129-2` → `9780735211292` |
| `/^\d{9}[\dX]$/`                                       | ISBN-10 shape, then a mod-11 checksum                      | `0-306-40615-2` ✅                          |
| `/^(?:978\|979)\d{10}$/`                               | ISBN-13 shape, then a mod-10 checksum                      | `9780735211292` ✅ · `9780735211293` ❌     |

> ISBNs must pass both the shape **and** the checksum. Dates must exist in the real calendar, so `2025-02-30` is rejected.

---

## Search patterns to try

Search runs against title, author, tag, ISBN, notes, and date joined by newlines.

| Pattern                   | What it finds                         |
| ------------------------- | ------------------------------------- |
| `Atomic\|Clear`           | Books by either author                |
| `^The`                    | Titles starting with "The"            |
| `\bdesign\b`              | The whole word only, not "designed"   |
| `\b(\w+)\s+\1\b`          | Records with a repeated adjacent word |
| `Self-Development`        | A literal tag                         |
| `9780735211292`           | A book by ISBN                        |
| `\d{2}:\d{2}`             | Time tokens inside notes              |
| `20\d{2}`                 | Any year from 2000 onward             |
| `[A-Z][a-z]+ [A-Z][a-z]+` | Capitalised word pairs                |
| `[a-z](?=[A-Z])`          | camelCase boundaries inside notes     |

An invalid pattern such as `a(` reports the error message inline and shows no matches rather than throwing.

---

## Keyboard map

| Key                   | Action                                       |
| --------------------- | -------------------------------------------- |
| `Tab` / `Shift + Tab` | Move between controls                        |
| `Enter`               | Submit the book form; save the page target   |
| `Space` / `Enter`     | Activate the focused button                  |
| `Escape`              | Close the delete dialog                      |
| `Tab`                 | Move between a row's Edit and Delete buttons |

**Focus management**

- The skip link is the first focusable element and jumps to `#main-content`
- Focus moves to the first invalid field when a save is rejected
- Editing scrolls to the form and focuses the title field
- After the delete dialog closes, focus returns to the button that opened it
- The mobile menu toggle reports state through `aria-expanded`

Every interactive element has a visible focus ring, so keyboard position is always clear.

---

## Accessibility notes

**Landmarks and structure**

Semantic `header`, `nav`, `main`, `section`, `article`, and `footer`, with a heading hierarchy that descends cleanly from the `h1`. The library is a real `<table>` with `scope="col"` headers and a caption, not a grid of `div`s.

**Forms**

Every input has a bound `<label>`. Help text and error messages are wired through `aria-describedby`, and `aria-invalid` flips to `true` on a failed field and back to `false` once corrected.

**Live regions**

| Element              | Role                           | Purpose                                      |
| -------------------- | ------------------------------ | -------------------------------------------- |
| `#global-status`     | `status`, `aria-live="polite"` | Saves, deletes, imports, and errors          |
| `#form-notice`       | `status`                       | Form submission result                       |
| `#search-feedback`   | `status`                       | Regex compilation errors                     |
| `#settings-feedback` | `status`                       | Import and export results                    |
| `#target-message`    | `polite` → `assertive`         | Polite under target, assertive once exceeded |

**Other**

- `role="progressbar"` on the page target carries `aria-valuenow`, `aria-valuemax`, and a spoken `aria-valuetext`
- The weekly chart is `role="img"` with a full text summary of every day
- Delete uses a native `<dialog>` with `showModal()`, so focus is trapped and `Escape` works natively
- Action buttons carry the book title in `aria-label`, so a screen reader announces "Delete Sapiens" rather than a bare "Delete"
- `<mark>` highlighting wraps the matched text itself, so assistive technology reads the real words
- All user content is HTML-escaped before rendering, which also blocks injection through stored notes
- `prefers-reduced-motion: reduce` disables transitions and animations

---

## Data model

One record per book:

```jsonc
{
  "id": "rec_0001", // unique, matches /^rec_[A-Za-z0-9_-]{1,60}$/
  "title": "Atomic Habits", // no leading/trailing/double spaces
  "author": "James Clear", // co-authors separated by ", " or " and "
  "pages": 320, // integer, 1–100,000
  "tag": "Self-Development", // letters, spaces, hyphens
  "dateAdded": "2025-09-29", // YYYY-MM-DD, real calendar date
  "isbn": "9780735211292", // optional, checksum-validated
  "notes": "You fall to the level of your systems.", // optional, max 10,000 chars
  "createdAt": "2025-09-29T18:12:04.000Z", // preserved across edits
  "updatedAt": "2025-09-29T18:12:04.000Z", // bumped on every edit
}
```

An export wraps these in an envelope:

```jsonc
{
  "schemaVersion": 1,
  "exportedAt": "2025-10-01T09:00:00.000Z",
  "app": "Book & Notes Vault",
  "books": [
    /* … */
  ],
}
```

The importer also accepts a bare array, for interoperability with other tools.

---

## How to run

**Requirements:** a modern browser. No Node, no build step, no server.

Because the app uses ES modules and `fetch`, it must be served over HTTP — opening `index.html` from the filesystem will not work.

```bash
# Python
python -m http.server 8000

# or Node
npx serve .

# or PHP
php -S localhost:8000
```

Then open <http://localhost:8000>.

Load the sample library by importing `seed.json` from **Settings → Import a backup**.

---

## How to run the tests

The suite is a standalone page — no test runner, no dependencies.

```bash
python -m http.server 8000
```

Open <http://localhost:8000/tests.html>.

The summary line at the top turns green when all checks pass and red on any failure; every individual assertion is listed below it with its expected and actual values.

**Coverage — 93 assertions across 7 groups**

| Group                       | What it checks                                                                 |
| --------------------------- | ------------------------------------------------------------------------------ |
| Regex validation rules      | Every validation pattern against valid and invalid input                       |
| Advanced regex              | Back-references, repeated surnames, ISBN extraction and checksums              |
| Date, pages, text           | Leap years, `2025-02-30`, numeric boundaries, length limits                    |
| Form validation             | Each field's error path, including optional fields left blank                  |
| Record and list validation  | The import path — bad IDs, duplicate IDs, wrong types                          |
| Search and highlighting     | Invalid patterns, anchors, alternation, markup escaping                        |
| Sorting, stats, persistence | Sort order, dashboard totals, `seed.json` integrity, `localStorage` round-trip |

The suite reads `scripts/*.js` directly, so it tests the shipped code rather than a copy. Results are also exposed as `window.__testResults` for scripting.

---

## Demo video

> **TODO — paste the unlisted YouTube link here before submitting.**
>
> `https://www.youtube.com/watch?v=_______________________`

<!--
Delete this block and replace it with the real link when the video is uploaded.
Keep the video unlisted rather than private: the marker must resolve for a grader
who has the link, and a private video only works if the account itself is shared.
-->

A 2–3 minute walkthrough should cover:

| #   | Show                                                        | Why it matters                             |
| --- | ----------------------------------------------------------- | ------------------------------------------ |
| 1   | Live app at <https://fiacredev.github.io/Book-Notes-Vault/> | The deployed build, not a local copy       |
| 2   | Skip link, then `Tab` through the form                      | Keyboard-only navigation                   |
| 3   | Add a book with an invalid title (`Atomic  Atomic`)         | Back-reference catches the repeated word   |
| 4   | Enter a bad date (`2025-02-30`) and a bad ISBN              | Calendar and checksum validation           |
| 5   | Search `\b(\w+)\s+\1\b`, then `9780735211292`               | Regex search and `<mark>` highlighting     |
| 6   | Type `a(` into the search box                               | Invalid pattern errors instead of crashing |
| 7   | Sort by pages, then A–Z                                     | Sorting and re-render                      |
| 8   | Export JSON, then re-import it                              | Import/export round-trip                   |
| 9   | Import a deliberately broken file                           | Validation rejects it, library untouched   |
| 10  | Resize to 360px and 1024px                                  | Table becomes cards, stats reflow          |
| 11  | `tests.html` showing all green                              | The suite passing                          |
| 12  | Set a page target under 99,999 pages                        | Target message switches to assertive       |

---

## Storage, import/export, and privacy

Two `localStorage` keys hold everything:

| Key                            | Contents        |
| ------------------------------ | --------------- |
| `book-notes-vault.records.v1`  | The book array  |
| `book-notes-vault.settings.v1` | The page target |

Notes never leave your browser unless you export them. The app sends no network requests, has no analytics, and uses no cookies.

**Import safety**

The whole file is parsed and validated before a single record is written. If any record fails, the import is rejected and your existing library is left untouched. Duplicate IDs, non-array files, oversized files, and over-limit vaults are all caught with a specific message. Merge mode keys on ID; replace mode overwrites.

**If storage is unavailable** — private browsing, disabled site data, or a full quota — the app reports it in the live region instead of failing silently, and keeps working in memory for the session.

Export regular backups. Clearing browser data will erase the vault.

---

## Responsive breakpoints

Mobile-first: base styles target ~360px, then layers up.

| Breakpoint    | Layout                                                                        |
| ------------- | ----------------------------------------------------------------------------- |
| Base (≤390px) | Single column, collapsed nav behind a Menu toggle, card list, stacked form    |
| ≤767px        | Wider gutters, larger tap targets                                             |
| ≤1024px       | Two-column stats grid, dashboard panels side by side                          |
| >1024px       | Four-column stats grid, full table with per-row actions, hero artwork visible |

Also handled: `prefers-reduced-motion`, table-to-card switching for the library, and horizontal overflow on the table wrapper at narrow widths.

---

## Limitations

- No cloud sync, accounts, or cross-device access — data lives in one browser
- No reading status, ratings, or progress tracking; the page target counts library pages, not pages read
- Tag validation is ASCII letters, spaces, and hyphens only
- The repeated-surname check can produce false positives on genuinely different authors sharing a surname
- Very large libraries rely on full re-renders, which is fine at the 10,000-book cap but not tuned for it
- Complex search patterns run against every record on each keystroke

---

**Book & Notes Vault** — Your books, your notes, your reading journey.
