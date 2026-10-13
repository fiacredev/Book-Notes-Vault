(() => {
  "use strict";

  const STORAGE_KEY = "book-notes-vault.records.v1";
  const SETTINGS_KEY = "book-notes-vault.settings.v1";
  const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
  const MAX_BOOKS = 10000;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const form = $("#book-form");
  const fields = {
    title: $("#title"), author: $("#author"), pages: $("#pages"),
    tag: $("#tag"), dateAdded: $("#date-added"), isbn: $("#isbn"), notes: $("#notes")
  };
  const errorEls = {
    title: $("#title-error"), author: $("#author-error"), pages: $("#pages-error"),
    tag: $("#tag-error"), dateAdded: $("#date-error"), isbn: $("#isbn-error"), notes: $("#notes-error")
  };

  let books = [];
  let settings = { pageTarget: 1000 };
  let pendingDeleteId = null;
  let searchPattern = "";
  let searchRegex = null;
  let searchError = "";
  let lastFocusedBeforeDialog = null;

  const pad = (number, length = 4) => String(number).padStart(length, "0");
  const localDate = (date = new Date()) => {
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1, 2);
    const d = pad(date.getDate(), 2);
    return `${y}-${m}-${d}`;
  };

  const nowIso = () => new Date().toISOString();

  const announce = (message) => { $("#global-status").textContent = message; };

  const setSettingsFeedback = (message, isError = false) => {
    const el = $("#settings-feedback");
    el.textContent = message;
    el.classList.toggle("error", isError);
  };

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);

  const validDate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  };

  const validTimestamp = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value)) && value.length <= 40;

  const normalizedText = value => String(value ?? "").trim().replace(/\s+/g, " ");

  const hasDuplicateWords = value => /\b([\p{L}\p{N}_]+)\s+\1\b/iu.test(value);

  const hasRepeatedSurname = value => {
    const names = value.split(/[;,]|\s+&\s+|\s+and\s+/i).map(part => part.trim()).filter(Boolean);
    const surnames = names.map(name => name.split(/\s+/).filter(Boolean).at(-1)?.toLocaleLowerCase()).filter(Boolean);
    return surnames.some((surname, index) => surnames.indexOf(surname) !== index);
  };

  function checksumValidIsbn(candidate) {
    const raw = candidate.replace(/[\s-]/g, "").toUpperCase();
    if (/^\d{9}[\dX]$/.test(raw)) {
      let sum = 0;
      for (let i = 0; i < 10; i++) {
        const digit = raw[i] === "X" ? 10 : Number(raw[i]);
        sum += digit * (10 - i);
      }
      return sum % 11 === 0 ? raw : null;
    }
    if (/^(?:978|979)\d{10}$/.test(raw)) {
      const sum = [...raw].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
      return sum % 10 === 0 ? raw : null;
    }
    return null;
  }

  function extractIsbn(text) {
    const candidates = String(text ?? "").match(/(?:97[89][\d\s-]{10,17}\d|\d[\d\s-]{8,14}[\dXx])/g) || [];
    for (const candidate of candidates) {
      const checked = checksumValidIsbn(candidate);
      if (checked) return checked;
    }
    return null;
  }

  function validateBookRecord(record) {
    if (!record || typeof record !== "object" || Array.isArray(record)) return "Each book must be an object.";
    const requiredStrings = ["id", "title", "author", "tag", "dateAdded", "createdAt", "updatedAt"];
    for (const key of requiredStrings) {
      if (typeof record[key] !== "string" || !record[key].trim()) return `Book field "${key}" must be a non-empty string.`;
      if (record[key].length > (key === "title" ? 180 : key === "author" ? 120 : key === "tag" ? 50 : 100)) return `Book field "${key}" is too long.`;
    }
    if (!/^rec_[A-Za-z0-9_-]{1,60}$/.test(record.id)) return "A book has an invalid ID.";
    if (!/^\S(?:.*\S)?$/.test(record.title) || /\s{2,}/.test(record.title)) return `Title "${record.title}" has extra spaces.`;
    if (hasDuplicateWords(record.title)) return `Title "${record.title}" contains a repeated word.`;
    if (!/^\S(?:.*\S)?$/.test(record.author) || /\s{2,}/.test(record.author)) return `Author "${record.author}" has extra spaces.`;
    if (!/^(0|[1-9]\d*)$/.test(String(record.pages)) || !Number.isSafeInteger(Number(record.pages)) || Number(record.pages) < 1 || Number(record.pages) > 100000) return `Pages for "${record.title}" must be a whole number from 1 to 100,000.`;
    if (!/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/.test(record.tag)) return `Tag "${record.tag}" must contain letters separated by spaces or hyphens.`;
    if (!validDate(record.dateAdded)) return `Book "${record.title}" has an invalid date.`;
    if (!validTimestamp(record.createdAt) || !validTimestamp(record.updatedAt)) return `Book "${record.title}" has an invalid timestamp.`;
    if (record.isbn !== undefined && record.isbn !== null && typeof record.isbn !== "string") return `ISBN for "${record.title}" must be text.`;
    if (record.isbn && !checksumValidIsbn(record.isbn)) return `ISBN for "${record.title}" is not a valid ISBN-10 or ISBN-13.`;
    if (record.notes !== undefined && typeof record.notes !== "string") return `Notes for "${record.title}" must be text.`;
    if ((record.notes || "").length > 10000) return `Notes for "${record.title}" are too long.`;
    if (hasRepeatedSurname(record.author)) return `Author list for "${record.title}" appears to repeat a surname.`;
    return null;
  }

  function validateBookList(value) {
    if (!Array.isArray(value)) return { error: "JSON must contain an array of books, or an object with a books array." };
    if (value.length > MAX_BOOKS) return { error: `The vault can contain at most ${MAX_BOOKS.toLocaleString()} books.` };
    const ids = new Set();
    for (let i = 0; i < value.length; i++) {
      const error = validateBookRecord(value[i]);
      if (error) return { error: `Book ${i + 1}: ${error}` };
      if (ids.has(value[i].id)) return { error: `Duplicate ID "${value[i].id}" found in the imported file.` };
      ids.add(value[i].id);
    }
    return { books: value };
  }

  function makeBookId() {
    const used = new Set(books.map(book => book.id));
    let highest = 0;
    for (const id of used) {
      const match = /^rec_(\d+)$/.exec(id);
      if (match) highest = Math.max(highest, Number(match[1]));
    }
    let candidate = `rec_${pad(highest + 1)}`;
    while (used.has(candidate)) candidate = `rec_${pad(++highest + 1)}`;
    return candidate;
  }

  function persistBooks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
      return true;
    } catch (error) {
      console.error("Could not save vault:", error);
      announce("Could not save changes. Browser storage may be full or disabled; export a backup if possible.");
      return false;
    }
  }

  function persistSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); return true; }
    catch (error) { console.error("Could not save settings:", error); announce("Could not save settings in this browser."); return false; }
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const result = validateBookList(parsed);
        if (result.error) throw new Error(result.error);
        books = result.books.map(book => ({ isbn: "", notes: "", ...book }));
      }
    } catch (error) {
      books = [];
      announce(`Saved library could not be loaded: ${error.message} Your current session starts with an empty library; the stored data has not been overwritten yet.`);
      console.error(error);
    }
    try {
      const rawSettings = localStorage.getItem(SETTINGS_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed && Number.isSafeInteger(parsed.pageTarget) && parsed.pageTarget >= 1 && parsed.pageTarget <= 10000000) {
          settings.pageTarget = parsed.pageTarget;
        }
      }
    } catch (error) { console.warn("Settings could not be loaded:", error); }
  }

  function setFieldError(name, message) {
    errorEls[name].textContent = message;
    fields[name].setAttribute("aria-invalid", message ? "true" : "false");
  }
  function clearErrors() {
    Object.keys(errorEls).forEach(name => setFieldError(name, ""));
    $("#form-notice").textContent = "";
  }

  function validateForm() {
    clearErrors();
    let valid = true;
    const title = fields.title.value;
    const author = fields.author.value;
    const pagesRaw = fields.pages.value;
    const tag = fields.tag.value;
    const dateAdded = fields.dateAdded.value;
    const isbnRaw = fields.isbn.value;
    const notes = fields.notes.value;
    const markError = (name, message) => { setFieldError(name, message); valid = false; };

    if (!title || !/^\S(?:.*\S)?$/.test(title) || /\s{2,}/.test(title)) markError("title", "Enter a title without leading/trailing or repeated spaces.");
    else if (title.length > 180) markError("title", "Title must be 180 characters or fewer.");
    else if (hasDuplicateWords(title)) markError("title", "Title contains a repeated adjacent word.");
    if (!author || !/^\S(?:.*\S)?$/.test(author) || /\s{2,}/.test(author)) markError("author", "Enter an author without leading/trailing or repeated spaces.");
    else if (author.length > 120) markError("author", "Author must be 120 characters or fewer.");
    else if (hasRepeatedSurname(author)) markError("author", "This author list appears to repeat a surname. Check the names, or separate co-authors with commas.");
    if (!/^(0|[1-9]\d*)$/.test(pagesRaw) || !Number.isSafeInteger(Number(pagesRaw)) || Number(pagesRaw) < 1 || Number(pagesRaw) > 100000) markError("pages", "Pages must be a whole number from 1 to 100,000.");
    if (!/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/.test(tag)) markError("tag", "Use letters, with single spaces or hyphens between words.");
    if (!validDate(dateAdded)) markError("dateAdded", "Enter a real date in YYYY-MM-DD format.");
    if (isbnRaw.trim()) {
      const isbn = extractIsbn(isbnRaw) || checksumValidIsbn(isbnRaw);
      if (!isbn) markError("isbn", "No valid ISBN-10 or ISBN-13 found. Check the number or leave this field blank.");
    }
    if (notes.length > 10000) markError("notes", "Notes must be 10,000 characters or fewer.");

    if (!valid) {
      $("#form-notice").textContent = "Please correct the highlighted fields before saving.";
      const firstInvalid = Object.keys(errorEls).find(name => errorEls[name].textContent);
      if (firstInvalid) fields[firstInvalid].focus();
    }
    return valid;
  }

  function compileSearch() {
    searchPattern = $("#search-pattern").value;
    searchError = "";
    searchRegex = null;
    if (searchPattern) {
      try { searchRegex = new RegExp(searchPattern, $("#case-insensitive").checked ? "iu" : "u"); }
      catch (error) { searchError = `Invalid regular expression: ${error.message}`; }
    }
    const feedback = $("#search-feedback");
    feedback.textContent = searchError || (searchPattern ? "Regex search is active." : "");
    feedback.classList.toggle("error", Boolean(searchError));
    renderBooks();
  }

  function matchesSearch(book) {
    if (!searchPattern || searchError || !searchRegex) return !searchError;
    const haystack = [book.title, book.author, book.tag, book.isbn, book.notes, book.dateAdded].join("\n");
    searchRegex.lastIndex = 0;
    return searchRegex.test(haystack);
  }

  function highlight(value) {
    const text = String(value ?? "");
    if (!searchPattern || !searchRegex || searchError) return escapeHtml(text);
    searchRegex.lastIndex = 0;
    let output = "";
    let last = 0;
    let match;
    const regex = new RegExp(searchRegex.source, searchRegex.flags.replace("g", "") + "g");
    let count = 0;
    while ((match = regex.exec(text)) !== null && count < 200) {
      if (match[0] === "") { regex.lastIndex++; continue; }
      output += escapeHtml(text.slice(last, match.index));
      output += `<mark>${escapeHtml(match[0])}</mark>`;
      last = match.index + match[0].length;
      count++;
    }
    output += escapeHtml(text.slice(last));
    return output;
  }

  function getVisibleBooks() {
    const visible = books.filter(matchesSearch);
    const [key, direction] = $("#sort-by").value.split("-");
    const factor = direction === "desc" ? -1 : 1;
    const keyMap = { date: "dateAdded", title: "title", author: "author", pages: "pages" };
    const prop = keyMap[key] || "dateAdded";
    return visible.sort((a, b) => {
      let result;
      if (prop === "pages") result = Number(a.pages) - Number(b.pages);
      else result = String(a[prop] ?? "").localeCompare(String(b[prop] ?? ""), undefined, { sensitivity: "base", numeric: true });
      return result * factor || a.id.localeCompare(b.id);
    });
  }

  function bookActions(book) {
    const id = escapeHtml(book.id);
    return `<div class="row-actions"><button class="action-button" type="button" data-action="edit" data-id="${id}" aria-label="Edit ${escapeHtml(book.title)}">Edit</button><button class="action-button delete" type="button" data-action="delete" data-id="${id}" aria-label="Delete ${escapeHtml(book.title)}">Delete</button></div>`;
  }

  function renderBooks() {
    const visible = getVisibleBooks();
    const tbody = $("#books-table-body");
    const cards = $("#books-cards");
    tbody.replaceChildren();
    cards.replaceChildren();
    for (const book of visible) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="book-title-cell"><strong>${highlight(book.title)}</strong>${book.isbn ? `<small>ISBN: ${highlight(book.isbn)}</small>` : ""}</td><td>${highlight(book.author)}</td><td>${Number(book.pages).toLocaleString()}</td><td><span class="tag-chip">${highlight(book.tag)}</span></td><td>${escapeHtml(book.dateAdded)}</td><td>${bookActions(book)}</td>`;
      tbody.appendChild(tr);

      const card = document.createElement("article");
      card.className = "book-card";
      card.innerHTML = `<h3>${highlight(book.title)}</h3><p class="card-author">by ${highlight(book.author)}</p><div class="card-meta"><span class="tag-chip">${highlight(book.tag)}</span><span>${Number(book.pages).toLocaleString()} pages</span><span>${escapeHtml(book.dateAdded)}</span></div>${book.isbn ? `<p class="hint">ISBN: ${highlight(book.isbn)}</p>` : ""}${book.notes ? `<p class="card-notes">${highlight(book.notes.length > 420 ? book.notes.slice(0, 420) + "…" : book.notes)}</p>` : ""}<div class="card-actions">${bookActions(book)}</div>`;
      cards.appendChild(card);
    }
    const isEmpty = visible.length === 0;
    $("#empty-state").classList.toggle("visible", isEmpty);
    $("#library-table-wrap").classList.toggle("hidden", isEmpty);
    cards.classList.toggle("hidden", isEmpty);
    if (isEmpty && books.length && !searchError) {
      $("#empty-state h3").textContent = "No matching books";
      $("#empty-state p").textContent = "Try a different regular expression or clear the search field.";
      $("#empty-add-book").textContent = "Add a new book";
    } else {
      $("#empty-state h3").textContent = "Your bookshelf is waiting";
      $("#empty-state p").textContent = "Add your first book to start building your personal vault.";
      $("#empty-add-book").textContent = "Add your first book";
    }
    $("#library-count").textContent = `${visible.length} of ${books.length} ${books.length === 1 ? "book" : "books"} shown`;
    if (searchError) {
      $("#empty-state").classList.remove("visible");
      $("#library-table-wrap").classList.toggle("hidden", books.length === 0);
      cards.classList.toggle("hidden", books.length === 0);
    }
    renderDashboard();
  }

  function renderDashboard() {
    const totalPages = books.reduce((sum, book) => sum + Number(book.pages), 0);
    const tagCounts = new Map();
    books.forEach(book => tagCounts.set(book.tag, (tagCounts.get(book.tag) || 0) + 1));
    const topTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const today = new Date();
    const weekDates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setHours(12, 0, 0, 0);
      date.setDate(today.getDate() - (6 - index));
      return localDate(date);
    });
    const weeklyCounts = weekDates.map(date => books.filter(book => book.dateAdded === date).length);
    const weekTotal = weeklyCounts.reduce((a, b) => a + b, 0);
    $("#stat-books").textContent = books.length.toLocaleString();
    $("#stat-pages").textContent = totalPages.toLocaleString();
    $("#stat-tag").textContent = topTag ? topTag[0] : "—";
    $("#stat-tag").title = topTag ? `${topTag[1]} book(s)` : "No tags yet";
    $("#stat-week").textContent = weekTotal.toLocaleString();
    renderWeeklyChart(weekDates, weeklyCounts);
    updateTarget(totalPages);
  }

  function renderWeeklyChart(dates, counts) {
    const chart = $("#weekly-chart");
    const max = Math.max(1, ...counts);
    chart.replaceChildren();
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    dates.forEach((date, index) => {
      const dateObj = new Date(`${date}T12:00:00`);
      const col = document.createElement("div");
      col.className = "chart-column";
      col.innerHTML = `<div class="chart-bar-wrap"><div class="chart-bar${index === 6 ? " today" : ""}" style="height:${Math.max(3, counts[index] / max * 100)}%"><span class="chart-value">${counts[index]}</span></div></div><span class="chart-day">${days[dateObj.getDay()]}</span>`;
      chart.appendChild(col);
    });
    chart.setAttribute("aria-label", `Books added in the last seven calendar days: ${dates.map((date, i) => `${date}: ${counts[i]}`).join(", ")}.`);
  }

  function updateTarget(totalPages) {
    const target = settings.pageTarget;
    const progress = Math.min(100, Math.round(totalPages / target * 100));
    $("#target-current").textContent = totalPages.toLocaleString();
    $("#target-total").textContent = `/ ${target.toLocaleString()} pages`;
    $("#target-progress").setAttribute("aria-valuemax", String(target));
    $("#target-progress").setAttribute("aria-valuenow", String(Math.min(totalPages, target)));
    $("#target-progress").setAttribute("aria-valuetext", `${totalPages.toLocaleString()} of ${target.toLocaleString()} pages`);
    $("#target-progress-fill").style.width = `${progress}%`;
    const message = $("#target-message");
    if (totalPages > target) {
      message.textContent = `Target exceeded by ${(totalPages - target).toLocaleString()} pages. Consider increasing your target.`;
      message.classList.add("over");
      message.setAttribute("aria-live", "assertive");
    } else {
      message.textContent = `${(target - totalPages).toLocaleString()} pages remaining. You're within your page target.`;
      message.classList.remove("over");
      message.setAttribute("aria-live", "polite");
    }
  }

  function resetForm({ focus = false } = {}) {
    form.reset();
    $("#editing-id").value = "";
    $("#date-added").value = localDate();
    $("#form-title").textContent = "Add a book";
    $("#save-book").textContent = "Save book";
    $("#cancel-edit").classList.add("hidden");
    clearErrors();
    if (focus) fields.title.focus();
  }

  function startEdit(id) {
    const book = books.find(item => item.id === id);
    if (!book) return;
    $("#editing-id").value = book.id;
    fields.title.value = book.title;
    fields.author.value = book.author;
    fields.pages.value = String(book.pages);
    fields.tag.value = book.tag;
    fields.dateAdded.value = book.dateAdded;
    fields.isbn.value = book.isbn || "";
    fields.notes.value = book.notes || "";
    $("#form-title").textContent = "Edit book";
    $("#save-book").textContent = "Save changes";
    $("#cancel-edit").classList.remove("hidden");
    clearErrors();
    $("#book-form-section").scrollIntoView({ behavior: "smooth", block: "start" });
    fields.title.focus({ preventScroll: true });
    announce(`Editing ${book.title}.`);
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    if (!validateForm()) return;
    const editingId = $("#editing-id").value;
    const existing = books.find(book => book.id === editingId);
    const isbnRaw = fields.isbn.value.trim();
    const isbn = isbnRaw ? (extractIsbn(isbnRaw) || checksumValidIsbn(isbnRaw)) : "";
    const timestamp = nowIso();
    const record = {
      id: existing ? existing.id : makeBookId(),
      title: fields.title.value,
      author: fields.author.value,
      pages: Number(fields.pages.value),
      tag: fields.tag.value,
      dateAdded: fields.dateAdded.value,
      isbn: isbn || "",
      notes: fields.notes.value,
      createdAt: existing ? existing.createdAt : timestamp,
      updatedAt: timestamp
    };
    const next = existing ? books.map(book => book.id === editingId ? record : book) : [...books, record];
    if (next.length > MAX_BOOKS) {
      $("#form-notice").textContent = `Your vault is limited to ${MAX_BOOKS.toLocaleString()} books.`;
      return;
    }
    const previous = books;
    books = next;
    if (!persistBooks()) { books = previous; return; }
    renderBooks();
    resetForm();
    const message = existing ? `${record.title} updated.` : `${record.title} added to your vault.`;
    $("#form-notice").textContent = message;
    announce(message);
    $("#library").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function askDelete(id) {
    const book = books.find(item => item.id === id);
    if (!book) return;
    pendingDeleteId = id;
    $("#delete-dialog-description").textContent = `Delete “${book.title}” and its notes from this browser? This cannot be undone unless you have a backup.`;
    lastFocusedBeforeDialog = document.activeElement;
    const dialog = $("#delete-dialog");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else if (window.confirm(`Delete "${book.title}" and its notes?`)) deleteBook(id);
    if (dialog.open) $("#confirm-delete").focus();
  }

  function deleteBook(id) {
    const book = books.find(item => item.id === id);
    if (!book) return;
    const previous = books;
    books = books.filter(item => item.id !== id);
    if (!persistBooks()) { books = previous; return; }
    if ($("#editing-id").value === id) resetForm();
    renderBooks();
    announce(`${book.title} deleted.`);
  }

  function handleRecordAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === "edit") startEdit(id);
    if (action === "delete") askDelete(id);
  }

  function downloadJson() {
    const payload = { schemaVersion: 1, exportedAt: nowIso(), app: "Book & Notes Vault", books };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `book-notes-vault-${localDate()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSettingsFeedback(`Exported ${books.length} ${books.length === 1 ? "book" : "books"} to JSON.`);
    announce("JSON backup downloaded.");
  }

  async function importJson(file) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setSettingsFeedback("File is too large. Choose a JSON file under 5 MB.", true);
      return;
    }
    try {
      const text = await file.text();
      let parsed;
      try { parsed = JSON.parse(text); }
      catch { throw new Error("This file is not valid JSON."); }
      const importedBooks = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.books) ? parsed.books : null;
      if (!importedBooks) throw new Error('Expected a JSON array or an object with a "books" array.');
      const validation = validateBookList(importedBooks);
      if (validation.error) throw new Error(validation.error);
      const merge = $("#merge-import").checked;
      let next;
      if (merge) {
        const byId = new Map(books.map(book => [book.id, book]));
        for (const book of importedBooks) byId.set(book.id, { isbn: "", notes: "", ...book });
        next = [...byId.values()];
      } else {
        next = importedBooks.map(book => ({ isbn: "", notes: "", ...book }));
      }
      if (next.length > MAX_BOOKS) throw new Error(`Import would exceed the ${MAX_BOOKS.toLocaleString()} book limit.`);
      const previous = books;
      books = next;
      if (!persistBooks()) { books = previous; throw new Error("Could not save imported data. Your previous in-memory library was restored."); }
      renderBooks();
      setSettingsFeedback(`Imported ${importedBooks.length} books${merge ? " into your library" : " (replaced the previous library)"}.`);
      announce(`Import successful. ${importedBooks.length} books processed.`);
    } catch (error) {
      setSettingsFeedback(`Import failed: ${error.message}`, true);
      announce(`Import failed: ${error.message}`);
    } finally {
      $("#import-file").value = "";
    }
  }

  function clearVault() {
    if (!books.length) { setSettingsFeedback("Your vault is already empty."); return; }
    if (!window.confirm(`Delete all ${books.length} books and notes from this browser? Export a backup first if you may need them.`)) return;
    const previous = books;
    books = [];
    if (!persistBooks()) { books = previous; return; }
    resetForm();
    renderBooks();
    setSettingsFeedback("All books and notes have been removed from this browser.");
    announce("Vault cleared.");
  }

  function saveTarget() {
    const value = $("#target-input").value;
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 10000000) {
      announce("Enter a page target from 1 to 10,000,000.");
      $("#target-input").setAttribute("aria-invalid", "true");
      $("#target-input").focus();
      return;
    }
    $("#target-input").setAttribute("aria-invalid", "false");
    settings.pageTarget = Number(value);
    persistSettings();
    renderDashboard();
    announce(`Page target saved: ${settings.pageTarget.toLocaleString()} pages.`);
  }

  // function setupNavigation() {
  //   const menuToggle = $("#menu-toggle");
  //   const nav = $("#primary-nav");
  //   menuToggle.addEventListener("click", () => {
  //     const open = nav.classList.toggle("open");
  //     menuToggle.setAttribute("aria-expanded", String(open));
  //   });
  //   nav.addEventListener("click", event => {
  //     if (event.target.closest("a")) {
  //       nav.classList.remove("open");
  //       menuToggle.setAttribute("aria-expanded", "false");
  //     }
  //   });
  //   const sectionLinks = $$("[data-section]");
  //   const sections = sectionLinks.map(link => document.getElementById(link.dataset.section)).filter(Boolean);
  //   if ("IntersectionObserver" in window) {
  //     const observer = new IntersectionObserver(entries => {
  //       const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  //       if (!visible) return;
  //       sectionLinks.forEach(link => {
  //         if (link.dataset.section === visible.target.id) link.setAttribute("aria-current", "location");
  //         else link.removeAttribute("aria-current");
  //       });
  //     }, { rootMargin: "-20% 0px -65% 0px", threshold: [0, .1, .3] });
  //     sections.forEach(section => observer.observe(section));
  //   }
  // }

  function setupEvents() {
    form.addEventListener("submit", handleFormSubmit);
    $("#reset-form").addEventListener("click", () => resetForm({ focus: true }));
    $("#cancel-edit").addEventListener("click", () => resetForm({ focus: true }));
    $("#add-book-top").addEventListener("click", () => { resetForm(); $("#book-form-section").scrollIntoView({ behavior: "smooth" }); fields.title.focus({ preventScroll: true }); });
    $("#empty-add-book").addEventListener("click", () => { resetForm(); $("#book-form-section").scrollIntoView({ behavior: "smooth" }); fields.title.focus({ preventScroll: true }); });
    $("#books-table-body").addEventListener("click", handleRecordAction);
    $("#books-cards").addEventListener("click", handleRecordAction);
    $("#search-pattern").addEventListener("input", compileSearch);
    $("#case-insensitive").addEventListener("change", compileSearch);
    $("#sort-by").addEventListener("change", renderBooks);
    $("#export-json").addEventListener("click", downloadJson);
    $("#import-file").addEventListener("change", event => importJson(event.target.files?.[0]));
    $("#clear-vault").addEventListener("click", clearVault);
    $("#save-target").addEventListener("click", saveTarget);
    $("#target-input").addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); saveTarget(); } });
    $("#delete-dialog").addEventListener("close", () => {
      if ($("#delete-dialog").returnValue === "confirm" && pendingDeleteId) deleteBook(pendingDeleteId);
      pendingDeleteId = null;
      if (lastFocusedBeforeDialog?.isConnected) lastFocusedBeforeDialog.focus();
    });
    Object.entries(fields).forEach(([name, input]) => input.addEventListener("input", () => {
      if (errorEls[name].textContent) setFieldError(name, "");
      if ($("#form-notice").textContent) $("#form-notice").textContent = "";
    }));
  }

  function init() {
    loadData();
    $("#date-added").value = localDate();
    $("#target-input").value = String(settings.pageTarget);
    setupNavigation();
    setupEvents();
    renderBooks();
  }

  init();
})();
