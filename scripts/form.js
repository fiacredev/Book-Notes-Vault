import { $, localDate } from "./utils.js";
import { checksumValidIsbn, extractIsbn, validateFormValues } from "./validators.js";
import { addBook, getBooks, updateBook } from "./state.js";

export const FIELD_IDS = {
  title: "#title",
  author: "#author",
  pages: "#pages",
  tag: "#tag",
  dateAdded: "#date-added",
  isbn: "#isbn",
  notes: "#notes"
};

const el = {};
let announce = () => {};
let onSaved = () => {};

export function initForm({ announce: announceFn, onSaved: onSavedFn }) {
  announce = announceFn;
  onSaved = onSavedFn;

  el.form = $("#book-form");
  el.editingId = $("#editing-id");
  el.notice = $("#form-notice");
  el.cancel = $("#cancel-edit");
  el.saveButton = $("#save-book");
  el.heading = $("#form-title");
  for (const [name, selector] of Object.entries(FIELD_IDS)) {
    el[name] = $(selector);
    el[`${name}Error`] = $(`${selector}-error`);
  }

  el.form.addEventListener("submit", handleSubmit);
  $("#reset-form").addEventListener("click", () => resetForm({ focus: true }));
  el.cancel.addEventListener("click", () => resetForm({ focus: true }));

  // Live feedback: clear an error as soon as the user edits that field.
  Object.entries(FIELD_IDS).forEach(([name, input]) =>
    input.addEventListener("input", () => {
      if (el[`${name}Error`].textContent) setFieldError(name, "");
      if (el.notice.textContent) el.notice.textContent = "";
    })
  );

  resetForm();
}

export function setFieldError(name, message) {
  el[`${name}Error`].textContent = message;
  el[name].setAttribute("aria-invalid", message ? "true" : "false");
}

function clearErrors() {
  Object.keys(FIELD_IDS).forEach(name => setFieldError(name, ""));
  el.notice.textContent = "";
}

function readValues() {
  return {
    title: el.title.value,
    author: el.author.value,
    pages: Number(el.pages.value),
    tag: el.tag.value,
    dateAdded: el.dateAdded.value,
    isbn: el.isbn.value.trim() ? extractIsbn(el.isbn.value) || checksumValidIsbn(el.isbn.value) || "" : "",
    notes: el.notes.value
  };
}

function validate() {
  clearErrors();
  const errors = validateFormValues({
    title: el.title.value,
    author: el.author.value,
    pages: el.pages.value,
    tag: el.tag.value,
    dateAdded: el.dateAdded.value,
    isbn: el.isbn.value,
    notes: el.notes.value
  });

  for (const [name, message] of Object.entries(errors)) setFieldError(name, message);

  const firstInvalid = Object.keys(FIELD_IDS).find(name => errors[name]);
  if (firstInvalid) {
    el.notice.textContent = "Please correct the highlighted fields before saving.";
    el[firstInvalid].focus();
    return false;
  }
  return true;
}

export function resetForm({ focus = false } = {}) {
  el.form.reset();
  el.editingId.value = "";
  el.dateAdded.value = localDate();
  el.heading.textContent = "Add a book";
  el.saveButton.textContent = "Save book";
  el.cancel.classList.add("hidden");
  clearErrors();
  if (focus) el.title.focus();
}

export function startEdit(id) {
  const book = getBooks().find(item => item.id === id);
  if (!book) return;
  el.editingId.value = book.id;
  Object.entries(FIELD_IDS).forEach(([name, input]) => {
    el[name].value = name === "pages" ? String(book.pages) : book[name] || "";
  });
  el.heading.textContent = "Edit book";
  el.saveButton.textContent = "Save changes";
  el.cancel.classList.remove("hidden");
  clearErrors();
  $("#book-form-section").scrollIntoView({ behavior: "smooth", block: "start" });
  el.title.focus({ preventScroll: true });
  announce(`Editing ${book.title}.`);
}

/** Public entry point for the "Add a book" buttons in the hero, library, and empty state. */
export function openBlankForm() {
  resetForm();
  $("#book-form-section").scrollIntoView({ behavior: "smooth" });
  el.title.focus({ preventScroll: true });
}

function handleSubmit(event) {
  event.preventDefault();
  if (!validate()) return;

  const editingId = el.editingId.value;
  const values = readValues();
  const saved = editingId ? updateBook(editingId, values) : addBook(values);
  if (!saved) return;

  el.notice.textContent = `${saved.title} ${editingId ? "updated" : "added to your vault"}.`;
  resetForm();
  onSaved(saved);
  $("#library").scrollIntoView({ behavior: "smooth", block: "start" });
}