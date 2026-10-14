import { escapeHtml } from "./utils.js";

/**
 * Regex search: safe compilation, matching, and accessible highlighting.
 * An invalid pattern never throws — it simply shows no results plus an error.
 */
const state = { pattern: "", regex: null, error: "", ignoreCase: true };

export function compileSearch(pattern, ignoreCase = state.ignoreCase) {
  state.pattern = pattern;
  state.ignoreCase = ignoreCase;
  state.error = "";
  state.regex = null;
  if (pattern) {
    try {
      state.regex = new RegExp(pattern, ignoreCase ? "iu" : "u");
    } catch (error) {
      state.error = `Invalid regular expression: ${error.message}`;
    }
  }
  return state;
}

export function getSearchState() {
  return state;
}

function haystackFor(book) {
  return [book.title, book.author, book.tag, book.isbn, book.notes, book.dateAdded].join("\n");
}

export function matchesSearch(book) {
  if (state.error) return false;
  if (!state.regex) return true;
  state.regex.lastIndex = 0;
  return state.regex.test(haystackFor(book));
}

export function searchFeedback() {
  if (state.error) return state.error;
  if (state.pattern) return "Regex search is active.";
  return "";
}

/**
 * Escapes the text first, then wraps matches in <mark>, so highlighting can
 * never introduce markup from user data. Empty matches are skipped to avoid
 * an infinite loop, and matches are capped to keep rendering fast.
 */
export function highlight(value) {
  const text = String(value ?? "");
  if (!state.regex || state.error) return escapeHtml(text);

  const global = new RegExp(state.regex.source, state.regex.flags.replace(/[gy]/g, "") + "g");
  let output = "";
  let last = 0;
  let count = 0;
  let match;
  while ((match = global.exec(text)) !== null && count < 200) {
    if (match[0] === "") { global.lastIndex++; continue; }
    output += escapeHtml(text.slice(last, match.index));
    output += `<mark>${escapeHtml(match[0])}</mark>`;
    last = match.index + match[0].length;
    count++;
  }
  return output + escapeHtml(text.slice(last));
}

const SORT_KEYS = { date: "dateAdded", title: "title", author: "author", pages: "pages" };

/** Filters by regex, then sorts by the toolbar's "key-direction" value. */
export function filterAndSort(books, sortValue) {
  const [key, direction] = String(sortValue || "date-desc").split("-");
  const prop = SORT_KEYS[key] || "dateAdded";
  const factor = direction === "desc" ? -1 : 1;
  return books.filter(matchesSearch).sort((a, b) => {
    const result =
      prop === "pages"
        ? Number(a.pages) - Number(b.pages)
        : String(a[prop] ?? "").localeCompare(String(b[prop] ?? ""), undefined, { sensitivity: "base", numeric: true });
    return result * factor || a.id.localeCompare(b.id);
  });
}