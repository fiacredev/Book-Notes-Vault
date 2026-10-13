 Book & Notes Vault

A browser-based library manager for organizing books, storing notes, tracking page targets, and searching your collection using regular expressions. Features a clean green-and-white theme with local storage and JSON backups.

1. Chosen Theme: Green & White

Green: Represents growth, learning, and focus.
White: Provides a clean, simple, readable interface.
Design: Responsive layouts, green buttons and tags, clear error messages, and visible focus indicators.


2. Features

Add, edit, and delete books.
Store titles, authors, pages, tags, dates, ISBNs, and notes.
Search using regular expressions and highlight matches.
Sort by title, author, date, or page count.
View dashboard statistics and weekly activity.
Set and track page-count targets.
Save data using browser localStorage.
Import and export JSON backups.
Validate book details and imported records.
Support up to 10,000 books and imports up to 5 MB.
3. 🔎 Regex Catalog
Pattern	Purpose	Example
/^\\S(?:.*\\S)?$/	Rejects leading/trailing spaces	Clean Code ✓
/\\s{2,}/	Detects repeated spaces	Clean Code ✗
/\\b([\\p{L}\\p{N}_]+)\\s+\\1\\b/iu	Detects repeated adjacent words	The the Book ✗
/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/	Validates tags	Web Design ✓
`/^\d{4}-(0[1-9]\	1[0-2])-(0[1-9]\	[12]\d\
/^\\d{9}[\\dX]$/	Checks ISBN-10 format	0306406152
`/^(?:978\	979)\d{10}$/`	Checks ISBN-13 format
/^rec_[A-Za-z0-9_-]{1,60}$/	Validates record IDs	rec_0001 ✓

ISBNs must also pass checksum validation. Dates are checked against the actual calendar.

Search examples:

javascript — find matching text.
\\bdesign\\b — find the whole word “design”.
20\\d{2} — find years such as 2026.
book|notes — match either word.
^The — match text beginning with “The”.

Search supports Unicode and optional case-insensitive matching.

4.  Keyboard Map

Key	Action
Tab / Shift + Tab	Navigate between controls
Enter	Submit forms or save the page target
Space / Enter	Activate focused buttons
Escape	Close the native delete dialog
Tab	Navigate between book actions

Focus moves to invalid fields, the edit form, and the delete confirmation as appropriate. Focus is restored after the delete dialog closes.

5. ♿ Accessibility Notes

Use labelled form fields and descriptive validation messages.
Update aria-invalid for invalid fields.
Provide accessible status announcements.
Support keyboard navigation and visible focus indicators.
Use semantic tables, headings, dialogs, and progress indicators.
Maintain sufficient contrast between green, white, and text.
Escape user content before rendering it as HTML.

Accessibility also depends on the accompanying HTML and CSS.

6.  How to Run

Requirements: A modern browser and the application's HTML, CSS, and JavaScript files.

Place the project files in one directory.
Ensure the HTML contains the IDs required by the JavaScript.
Start a local server:
python -m http.server 8000

Open http://localhost:8000 in your browser.

No backend is required.

7.  How to Run Tests

The project does not currently include automated tests. Test manually or configure Vitest for unit tests and Playwright for browser tests.

Test checklist
Add, edit, and delete books.
Validate invalid titles, tags, dates, and ISBNs.
Test regex searches and sorting.
Import and export JSON files.
Verify local storage after reloading.
Test page targets and dashboard statistics.
Test invalid imports and duplicate IDs.
Check keyboard navigation and accessibility.

After configuring the test tools and package.json, run:

npm install
npm run test
npm run test:e2e


These commands require the corresponding dependencies, scripts, and test configuration.

8. Storage & Privacy

Books and settings are saved in browser localStorage:

book-notes-vault.records.v1
book-notes-vault.settings.v1

Data is not automatically synchronized to the cloud or encrypted by the application. Export regular JSON backups and store them securely.

9.  Limitations

No cloud synchronization or user accounts.
Complex regex patterns may affect performance.
Tag validation supports ASCII letters, spaces, and hyphens only.
Author surname checks may produce false positives.
The page target measures total library pages, not pages actually read.
Automated tests must be configured separately.

10.  Future Improvements

Add reading status and ratings.
Improve Unicode tag support.
Add pagination and advanced filters.
Expand automated testing and accessibility checks.
Add schema migrations and optional encrypted backups.

11.  License

Choose and add a license before distributing the project.

Book & Notes Vault — Your books, your notes, your reading journey.