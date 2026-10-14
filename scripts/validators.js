import { PATTERNS, FIELD_LIMITS, MAX_BOOKS } from "./config.js";
import { isValidTimestamp } from "./utils.js";

/** Advanced: back-reference detecting a word repeated next to itself. */
export const hasDuplicateWords = (value) => PATTERNS.duplicateWord.test(String(value ?? ""));

/** Back-reference style check: co-author lists that repeat the same surname. */
export const hasRepeatedSurname = (value) => {
  const names = String(value ?? "")
    .split(/[;,]|\s+&\s+|\s+and\s+/i)
    .map(part => part.trim())
    .filter(Boolean);
  const surnames = names
    .map(name => name.split(/\s+/).filter(Boolean).at(-1)?.toLocaleLowerCase())
    .filter(Boolean);
  return surnames.some((surname, index) => surnames.indexOf(surname) !== index);
};

/** Shape check (regex) plus a real-calendar check, so 2025-02-30 is rejected. */
export const isValidDate = (value) => {
  if (typeof value !== "string" || !PATTERNS.date.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export const isValidPages = (value) => {
  const raw = String(value ?? "");
  if (!PATTERNS.pages.test(raw)) return false;
  const pages = Number(raw);
  return Number.isSafeInteger(pages) && pages >= 1 && pages <= FIELD_LIMITS.pages;
};

export const isValidText = (value, limit) =>
  typeof value === "string" && PATTERNS.title.test(value) && !PATTERNS.doubleSpace.test(value) && value.length <= limit;

/** ISBN-10 / ISBN-13 checksum. Returns the cleaned code, or null. */
export function checksumValidIsbn(candidate) {
  const raw = String(candidate ?? "").replace(/[\s-]/g, "").toUpperCase();
  if (PATTERNS.isbn10.test(raw)) {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += (raw[i] === "X" ? 10 : Number(raw[i])) * (10 - i);
    return sum % 11 === 0 ? raw : null;
  }
  if (PATTERNS.isbn13.test(raw)) {
    const sum = [...raw].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
    return sum % 10 === 0 ? raw : null;
  }
  return null;
}

/** Pulls the first checksum-valid ISBN out of free text (advanced regex usage). */
export function extractIsbn(text) {
  const candidates = String(text ?? "").match(PATTERNS.isbnCandidate) || [];
  for (const candidate of candidates) {
    const checked = checksumValidIsbn(candidate);
    if (checked) return checked;
  }
  return null;
}

/** Returns an error string, or null when the record is valid. Used by forms and imports. */
export function validateBookRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return "Each book must be an object.";

  const requiredStrings = ["id", "title", "author", "tag", "dateAdded", "createdAt", "updatedAt"];
  for (const key of requiredStrings) {
    if (typeof record[key] !== "string" || !record[key].trim()) return `Book field "${key}" must be a non-empty string.`;
  }

  if (!PATTERNS.recordId.test(record.id)) return "A book has an invalid ID.";
  if (!isValidText(record.title, FIELD_LIMITS.title)) return `Title "${record.title}" has extra spaces or is too long.`;
  if (hasDuplicateWords(record.title)) return `Title "${record.title}" contains a repeated word.`;
  if (!isValidText(record.author, FIELD_LIMITS.author)) return `Author "${record.author}" has extra spaces or is too long.`;
  if (!isValidPages(record.pages)) return `Pages for "${record.title}" must be a whole number from 1 to ${FIELD_LIMITS.pages.toLocaleString()}.`;
  if (record.tag.length > FIELD_LIMITS.tag || !PATTERNS.tag.test(record.tag)) return `Tag "${record.tag}" must contain letters separated by spaces or hyphens.`;
  if (!isValidDate(record.dateAdded)) return `Book "${record.title}" has an invalid date.`;
  if (!isValidTimestamp(record.createdAt) || !isValidTimestamp(record.updatedAt)) return `Book "${record.title}" has an invalid timestamp.`;
  if (record.isbn !== undefined && record.isbn !== null && typeof record.isbn !== "string") return `ISBN for "${record.title}" must be text.`;
  if (record.isbn && !checksumValidIsbn(record.isbn)) return `ISBN for "${record.title}" is not a valid ISBN-10 or ISBN-13.`;
  if (record.notes !== undefined && typeof record.notes !== "string") return `Notes for "${record.title}" must be text.`;
  if ((record.notes || "").length > FIELD_LIMITS.notes) return `Notes for "${record.title}" are too long.`;
  if (hasRepeatedSurname(record.author)) return `Author list for "${record.title}" appears to repeat a surname.`;
  return null;
}

/** Validates an entire array (import, or data restored from localStorage). */
export function validateBookList(value) {
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

/** Field-level feedback for the add/edit form. Returns a map of field -> message. */
export function validateFormValues(values) {
  const errors = {};
  const { title, author, pages, tag, dateAdded, isbn, notes = "" } = values;

  if (!title || !isValidText(title, FIELD_LIMITS.title)) errors.title = "Enter a title without leading/trailing or repeated spaces (max 180 characters).";
  else if (hasDuplicateWords(title)) errors.title = "Title contains a repeated adjacent word.";

  if (!author || !isValidText(author, FIELD_LIMITS.author)) errors.author = "Enter an author without leading/trailing or repeated spaces (max 120 characters).";
  else if (hasRepeatedSurname(author)) errors.author = "This author list appears to repeat a surname. Check the names, or separate co-authors with commas.";

  if (!isValidPages(pages)) errors.pages = `Pages must be a whole number from 1 to ${FIELD_LIMITS.pages.toLocaleString()}.`;

  if (!PATTERNS.tag.test(tag || "")) errors.tag = "Use letters, with single spaces or hyphens between words.";

  if (!isValidDate(dateAdded)) errors.dateAdded = "Enter a real date in YYYY-MM-DD format.";

  if (String(isbn).trim() && !(extractIsbn(isbn) || checksumValidIsbn(isbn))) {
    errors.isbn = "No valid ISBN-10 or ISBN-13 found. Check the number or leave this field blank.";
  }

  if (String(notes).length > FIELD_LIMITS.notes) errors.notes = `Notes must be ${FIELD_LIMITS.notes.toLocaleString()} characters or fewer.`;

  return errors;
}