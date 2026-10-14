import { $ } from "./utils.js";
import { deleteBook } from "./state.js";
import { startEdit, resetForm } from "./form.js";

let pendingDeleteId = null;
let lastFocusedBeforeDialog = null;

/** Delete confirmation: <dialog> when available, window.confirm as a fallback. */
function askDelete(id) {
  const dialog = $("#delete-dialog");
  const title = id ? document.querySelector(`[data-id="${CSS.escape(id)}"]`)?.closest("tr, article") : null;
  pendingDeleteId = id;

  const bookTitle = title ? title.querySelector(".book-title-cell strong, h3")?.textContent?.trim() : "this book";
  $("#delete-dialog-description").textContent =
    `Delete “${bookTitle}” and its notes from this browser? This cannot be undone unless you have a backup.`;

  lastFocusedBeforeDialog = document.activeElement;
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    if (dialog.open) $("#confirm-delete").focus();
  } else if (window.confirm(`Delete "${bookTitle}" and its notes?`)) {
    deleteBook(id);
    pendingDeleteId = null;
  }
}

/** One delegated listener serves both the table rows and the mobile cards. */
export function initRecordActions() {
  const onAction = event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit") startEdit(button.dataset.id);
    if (button.dataset.action === "delete") askDelete(button.dataset.id);
  };

  $("#books-table-body").addEventListener("click", onAction);
  $("#books-cards").addEventListener("click", onAction);

  $("#delete-dialog").addEventListener("close", event => {
    if (event.target.returnValue === "confirm" && pendingDeleteId) {
      if ($("#editing-id").value === pendingDeleteId) resetForm();
      deleteBook(pendingDeleteId);
    }
    pendingDeleteId = null;
    if (lastFocusedBeforeDialog?.isConnected) lastFocusedBeforeDialog.focus();
  });
}