/**
 * Shared constants and limits for the vault.
 */
export const STORAGE_KEY = "book-notes-vault.records.v1";
export const SETTINGS_KEY = "book-notes-vault.settings.v1";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_BOOKS = 10000;

export const FIELD_LIMITS = {
  title: 180,
  author: 120,
  pages: 100000,
  tag: 50,
  notes: 10000,
  isbn: 80
};

export const DEFAULT_SETTINGS = { pageTarget: 1000 };

/** Regex catalog: shared between the form, record validation, search, and tests. */
export const PATTERNS = {
  title: /^\S(?:.*\S)?$/,
  doubleSpace: /\s{2,}/,
  pages: /^(0|[1-9]\d*)$/,
  date: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  tag: /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/,
  recordId: /^rec_[A-Za-z0-9_-]{1,60}$/,
  // Advanced: back-reference — catches a word repeated next to itself.
  duplicateWord: /\b([\p{L}\p{N}_]+)\s+\1\b/iu,
  // Advanced: ISBN-like candidate inside free text.
  isbnCandidate: /(?:97[89][\d\s-]{10,17}\d|\d[\d\s-]{8,14}[\dXx])/g,
  isbn10: /^\d{9}[\dX]$/,
  isbn13: /^(?:978|979)\d{10}$/,
  target: /^[1-9]\d*$/
};