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
})();
