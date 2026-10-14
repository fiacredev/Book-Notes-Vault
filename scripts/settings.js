import { MAX_IMPORT_BYTES, PATTERNS } from "./config.js";
import { $, localDate, nowIso } from "./utils.js";
import { validateBookList } from "./validators.js";
import { withDefaults } from "./storage.js";
import { clearBooks, getBooks, mergeBooks, replaceBooks, setPageTarget } from "./state.js";

let announce = () => {};

export function initSettings({ announce: announceFn }) {
  announce = announceFn;

  $("#export-json").addEventListener("click", downloadJson);
  $("#import-file").addEventListener("change", event => importJson(event.target.files?.[0]));
  $("#clear-vault").addEventListener("click", clearVault);
  $("#save-target").addEventListener("click", saveTarget);
  $("#target-input").addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); saveTarget(); }
  });
}

function setSettingsFeedback(message, isError = false) {
  const el = $("#settings-feedback");
  el.textContent = message;
  el.classList.toggle("error", isError);
}

function downloadJson() {
  const books = getBooks();
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

/** Validates the entire file before touching storage; nothing is written on failure. */
async function importJson(file) {
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    setSettingsFeedback("File is too large. Choose a JSON file under 5 MB.", true);
    return;
  }
  try {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      throw new Error("This file is not valid JSON.");
    }

    const incoming = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.books) ? parsed.books : null;
    if (!incoming) throw new Error('Expected a JSON array or an object with a "books" array.');

    const validation = validateBookList(incoming);
    if (validation.error) throw new Error(validation.error);

    const books = incoming.map(withDefaults);
    const merge = $("#merge-import").checked;
    const ok = merge
      ? mergeBooks(books, `Imported ${books.length} books into your library.`)
      : replaceBooks(books, `Imported ${books.length} books (previous library replaced).`);
    if (!ok) throw new Error("Could not save imported data. Your previous library was restored.");

    setSettingsFeedback(
      `Imported ${books.length} books${merge ? " and merged them with your library" : ", replacing the previous library"}.`
    );
    announce(`Import successful. ${books.length} books processed.`);
  } catch (error) {
    setSettingsFeedback(`Import failed: ${error.message}`, true);
    announce(`Import failed: ${error.message}`);
  } finally {
    $("#import-file").value = "";
  }
}

function clearVault() {
  const books = getBooks();
  if (!books.length) { setSettingsFeedback("Your vault is already empty."); return; }
  if (!window.confirm(`Delete all ${books.length} books and notes from this browser? Export a backup first if you may need them.`)) return;
  if (!clearBooks()) return;
  setSettingsFeedback("All books and notes have been removed from this browser.");
}

function saveTarget() {
  const input = $("#target-input");
  const value = input.value;
  if (!PATTERNS.target.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 10000000) {
    input.setAttribute("aria-invalid", "true");
    input.focus();
    announce("Enter a page target from 1 to 10,000,000.");
    return;
  }
  input.setAttribute("aria-invalid", "false");
  if (setPageTarget(Number(value))) announce(`Page target saved: ${Number(value).toLocaleString()} pages.`);
}