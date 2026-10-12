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
})();
