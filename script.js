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
  
})();
