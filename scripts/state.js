import { MAX_BOOKS } from "./config.js";
import { nowIso, pad } from "./utils.js";
import { loadBooks, loadSettings, saveBooks, saveSettings } from "./storage.js";

/**
 * Single source of truth. UI modules subscribe with onChange() and are re-rendered
 * after every mutation, so state and DOM can never drift apart.
 */
const state = { books: [], settings: { pageTarget: 1000 } };
const listeners = new Set();

let onAnnounce = () => {};
let onWarning = () => {};

/** Wired up in main.js so state never touches the DOM directly. */
export function configure({ announce, warn }) {
  if (announce) onAnnounce = announce;
  if (warn) onWarning = warn;
}

function emit() {
  listeners.forEach(listener => listener(state));
}

export function onChange(listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function getState() {
  return state;
}

export function getBooks() {
  return state.books;
}

export function getSettings() {
  return state.settings;
}

export function initState() {
  const { books, warning } = loadBooks();
  state.books = books;
  state.settings = loadSettings();
  if (warning) onWarning(warning);
  emit();
  return state;
}

/** next id in the rec_0001 sequence, skipping any id already present. */
function makeBookId(books) {
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

/** Every mutation follows commit(): mutate, persist, re-render, announce. */
function commit(nextBooks, message) {
  const previous = state.books;
  state.books = nextBooks;
  const result = saveBooks(state.books);
  if (!result.ok) {
    state.books = previous;
    onAnnounce(result.error);
    return false;
  }
  emit();
  if (message) onAnnounce(message);
  return true;
}

export function addBook(values) {
  if (state.books.length >= MAX_BOOKS) {
    onAnnounce(`Your vault is limited to ${MAX_BOOKS.toLocaleString()} books.`);
    return null;
  }
  const timestamp = nowIso();
  const record = { id: makeBookId(state.books), createdAt: timestamp, updatedAt: timestamp, ...values };
  if (!commit([...state.books, record], `${record.title} added to your vault.`)) return null;
  return record;
}

export function updateBook(id, values) {
  const existing = state.books.find(book => book.id === id);
  if (!existing) return null;
  const record = { ...existing, ...values, id: existing.id, createdAt: existing.createdAt, updatedAt: nowIso() };
  if (!commit(state.books.map(book => (book.id === id ? record : book)), `${record.title} updated.`)) return null;
  return record;
}

export function deleteBook(id) {
  const book = state.books.find(item => item.id === id);
  if (!book) return false;
  if (!commit(state.books.filter(item => item.id !== id))) return false;
  onAnnounce(`${book.title} deleted.`);
  return true;
}

export function replaceBooks(books, message) {
  if (books.length > MAX_BOOKS) {
    onAnnounce(`Your vault is limited to ${MAX_BOOKS.toLocaleString()} books.`);
    return false;
  }
  return commit(books, message);
}

export function mergeBooks(books, message) {
  const byId = new Map(state.books.map(book => [book.id, book]));
  books.forEach(book => byId.set(book.id, book));
  return replaceBooks([...byId.values()], message);
}

export function clearBooks() {
  return replaceBooks([], "Vault cleared.");
}

export function setPageTarget(value) {
  state.settings = { ...state.settings, pageTarget: value };
  const result = saveSettings(state.settings);
  emit();
  if (!result.ok) onAnnounce(result.error);
  return result.ok;
}