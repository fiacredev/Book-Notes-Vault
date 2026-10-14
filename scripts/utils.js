/** Small DOM/text/date helpers shared across modules. */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

export const pad = (number, length = 4) => String(number).padStart(length, "0");

/** Local (not UTC) calendar date as YYYY-MM-DD, so "today" matches the user's day. */
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;

export const nowIso = () => new Date().toISOString();

export const normalizedText = (value) => String(value ?? "").trim().replace(/\s+/g, " ");

export const isValidTimestamp = (value) =>
  typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));

/** Formats a number for display without letting the user inject markup. */
export const formatNumber = (value) => Number(value || 0).toLocaleString();