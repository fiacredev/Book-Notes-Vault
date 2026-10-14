# M1 — Specification, Data Model & Accessibility Plan

Book & Notes Vault. A personal library for cataloguing books, storing reading notes,
and searching the collection with user-supplied regular expressions.

---

## 1. Purpose

Keep book metadata and personal notes together in one place, with no account,
no server, and no build step. The user owns their data: it lives in the browser
until they export it.

## 2. Scope

| In scope | Out of scope |
| --- | --- |
| Add / edit / delete books | Cloud sync, accounts |
| Regex search with highlighting | Reading status, ratings |
| Sorting by title, author, date, pages | Full-text indexing / server search |
| Dashboard stats and a page target | Pagination, advanced filters |
| localStorage persistence | Encryption (out of app scope) |
| JSON import / export | Native mobile app |

## 3. Data model

One record per book. `id` is unique; `createdAt` is immutable; `updatedAt` is
bumped on every edit.

```jsonc
{
  "id":        "rec_0001",                        // /^rec_[A-Za-z0-9_-]{1,60}$/
  "title":     "Atomic Habits",                   // no leading/trailing/double spaces
  "author":    "James Clear",                     // co-authors split on ", " / " and "
  "pages":     320,                               // integer, 1–100,000
  "tag":       "Self-Development",                // letters, spaces, hyphens
  "dateAdded": "2025-09-29",                      // YYYY-MM-DD, real calendar date
  "isbn":      "9780735211292",                   // optional, checksum-validated
  "notes":     "You fall to the level of your systems.",  // optional, ≤10,000 chars
  "createdAt": "2025-09-29T18:12:04.000Z",
  "updatedAt": "2025-09-29T18:12:04.000Z"
}
```

**Export envelope**

```jsonc
{ "schemaVersion": 1, "exportedAt": "...", "app": "Book & Notes Vault", "books": [ /* … */ ] }
```

The importer also accepts a bare array for interoperability.

**Limits** — 10,000 records; 5 MB import; title 180, author 120, tag 50, notes 10,000 chars.

## 4. Architecture

A single observable store. Every mutation follows one path: **mutate → persist →
re-render → announce**. The DOM cannot drift from the data because nothing writes
to the DOM outside a render pass.

```
main.js          bootstrap; renders on state change
 ├─ state.js      observable store + all mutations
 │   ├─ storage.js    localStorage, graceful failure
 │   └─ validators.js record / list validation
 ├─ validators.js  shared regex rules + ISBN checksums
 ├─ form.js        add/edit, inline errors
 ├─ records.js     delegated edit/delete, confirm dialog
 ├─ search.js      safe regex compiler, match, highlight, sort
 ├─ library.js     table + card rendering, empty states
 ├─ stats.js       metrics, weekly chart, target logic
 ├─ settings.js    export, import, clear, page target
 └─ navigation.js  mobile menu, scroll-spy
```

`config.js` holds the regex catalog so the form, the importer, and the test suite
all assert against the same definitions.

## 5. Regex plan

Validation rules are defined in M3; the search engine is delivered in M4.
The catalogue is documented in the README.

**Advanced patterns (≥1 required)**

| Technique | Pattern | Catches |
| --- | --- | --- |
| Back-reference | `/\b(\p{L}\p{N}_]+)\s+\1\b/iu` | A word repeated next to itself |
| Back-reference (derived) | surname comparison | Co-author lists repeating a surname |
| Alternation + quantifier | `/(?:97[89][\d\s-]{10,17}\d\|\d[\d\s-]{8,14}[\dXx])/g` | An ISBN inside free text |
| Character class | `/^(?:978\|979)\d{10}$/` | ISBN-13 shape (plus checksum) |

**Safety rule:** user patterns are compiled inside `try/catch`. An invalid pattern
reports an inline error and matches nothing — it never throws into the UI.

## 6. Accessibility plan

**Structure**
- Landmarks: `header`, `nav`, `main`, `section`, `article`, `footer`
- Heading hierarchy descending from a single `h1`
- Library is a real `<table>` with `scope="col"` and a caption; cards only below 768px
- Skip link is the first focusable element, targeting `#main-content`

**Forms**
- Every input has a bound `<label>`
- `aria-describedby` points at help text and the error node
- `aria-invalid` flips `true` on failure, back to `false` on correction
- Errors are text next to the field — never colour alone

**Live regions**

| Element | Role | Announces |
| --- | --- | --- |
| `#global-status` | `status`, polite | Saves, deletes, imports, storage errors |
| `#form-notice` | `status` | Submission result |
| `#search-feedback` | `status` | Regex compilation errors |
| `#settings-feedback` | `status` | Import / export results |
| `#target-message` | polite → assertive | Under target → exceeded |

**Focus management**
- First invalid field receives focus on a rejected save
- Edit scrolls to the form and focuses the title
- Focus returns to the triggering button after the delete dialog closes
- Delete uses native `<dialog>` + `showModal()` for focus trapping and `Escape`

**Charts and progress**
- Weekly chart is `role="img"` with a full per-day text summary
- Page target is `role="progressbar"` with `aria-valuenow` and spoken `aria-valuetext`

**Other**
- Action buttons carry the book title in `aria-label` ("Delete Sapiens")
- `<mark>` wraps the matched text itself, so the real words are announced
- All user content is HTML-escaped before rendering
- Colour pairs meet WCAG AA for body text
- `prefers-reduced-motion: reduce` disables transitions and animations

## 7. Responsive plan

Mobile-first, base ≈360px, layering up at 767px, 1024px, and above.

| Breakpoint | Layout |
| --- | --- |
| ≤390px | Single column, menu toggle, cards, stacked form |
| ≤767px | Wider gutters, larger tap targets |
| ≤1024px | Two-column stats, dashboard panels paired |
| >1024px | Four-column stats, full table, hero artwork |

## 8. Verification

`tests.html` — standalone assertions, no runner, no dependencies. Covers the regex
catalogue, back-references, ISBN checksums, form and record validation, invalid
search patterns, highlighting escaping, sort order, dashboard totals, `seed.json`
integrity, and a `localStorage` round-trip. Results are shown on the page and
exposed as `window.__testResults`.

## 9. Deliverables checklist

| Milestone | Weight | Artifact |
| --- | --- | --- |
| M1 Spec & wireframes | 10% | This document |
| M2 Semantic HTML & base CSS | 10% | `index.html`, `styles/main.css` |
| M3 Forms & regex validation | 15% | `validators.js`, `form.js`, `tests.html` |
| M4 Render, sort, regex search | 20% | `library.js`, `search.js` |
| M5 Stats & targets | 15% | `stats.js` |
| M6 Persistence, import/export, settings | 15% | `storage.js`, `state.js`, `settings.js`, `seed.json` |
| M7 Polish & a11y audit | 15% | `main.js`, `navigation.js`, README, workflow |