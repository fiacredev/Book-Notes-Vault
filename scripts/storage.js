import { STORAGE_KEY, SETTINGS_KEY, DEFAULT_SETTINGS } from "./config.js";
import { validateBookList } from "./validators.js";

/** Defaults applied when a record predates an optional field. */
export const withDefaults = (book) => ({
  ...book,
  isbn: typeof book.isbn === "string" ? book.isbn : "",
  notes: typeof book.notes === "string" ? book.notes : ""
});

export function saveBooks(books) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
    return { ok: true };
  } catch (error) {
    console.error("Could not save vault:", error);
    return { ok: false, error: "Browser storage may be full or disabled. Export a backup if possible." };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return { ok: true };
  } catch (error) {
    console.error("Could not save settings:", error);
    return { ok: false, error: "Could not save settings in this browser." };
  }
}

/** Reads and validates the stored library. Never throws; returns a warning instead. */
export function loadBooks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { books: [], warning: "" };
    const result = validateBookList(JSON.parse(raw));
    if (result.error) throw new Error(result.error);
    return { books: result.books.map(withDefaults), warning: "" };
  } catch (error) {
    console.error(error);
    return {
      books: [],
      warning: `Saved library could not be loaded: ${error.message} This session starts empty; the stored data has not been overwritten.`
    };
  }
}

export function loadSettings() {
  const settings = { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return settings;
    const parsed = JSON.parse(raw);
    if (parsed && Number.isSafeInteger(parsed.pageTarget) && parsed.pageTarget >= 1 && parsed.pageTarget <= 10000000) {
      settings.pageTarget = parsed.pageTarget;
    }
  } catch (error) {
    console.warn("Settings could not be loaded:", error);
  }
  return settings;
}