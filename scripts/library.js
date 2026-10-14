import { $, escapeHtml, formatNumber } from "./utils.js";
import { filterAndSort, getSearchState, highlight, searchFeedback } from "./search.js";

const NOTE_PREVIEW = 420;

/** Row/card action buttons. Labels include the title for screen readers. */
function bookActions(book) {
  const id = escapeHtml(book.id);
  const title = escapeHtml(book.title);
  return (
    `<div class="row-actions">` +
    `<button class="action-button" type="button" data-action="edit" data-id="${id}" aria-label="Edit ${title}">Edit</button>` +
    `<button class="action-button delete" type="button" data-action="delete" data-id="${id}" aria-label="Delete ${title}">Delete</button>` +
    `</div>`
  );
}

function rowHtml(book) {
  return (
    `<td class="book-title-cell"><strong>${highlight(book.title)}</strong>` +
    (book.isbn ? `<small>ISBN: ${highlight(book.isbn)}</small>` : "") +
    `</td><td>${highlight(book.author)}</td><td>${formatNumber(book.pages)}</td>` +
    `<td><span class="tag-chip">${highlight(book.tag)}</span></td><td>${escapeHtml(book.dateAdded)}</td>` +
    `<td>${bookActions(book)}</td>`
  );
}

function cardHtml(book) {
  const preview = book.notes.length > NOTE_PREVIEW ? `${book.notes.slice(0, NOTE_PREVIEW)}…` : book.notes;
  return (
    `<h3>${highlight(book.title)}</h3><p class="card-author">by ${highlight(book.author)}</p>` +
    `<div class="card-meta"><span class="tag-chip">${highlight(book.tag)}</span>` +
    `<span>${formatNumber(book.pages)} pages</span><span>${escapeHtml(book.dateAdded)}</span></div>` +
    (book.isbn ? `<p class="hint">ISBN: ${highlight(book.isbn)}</p>` : "") +
    (book.notes ? `<p class="card-notes">${highlight(preview)}</p>` : "") +
    `<div class="card-actions">${bookActions(book)}</div>`
  );
}

/** Two different empty states: nothing saved yet vs. nothing matched the regex. */
function renderEmptyState(visibleCount, totalCount, hasSearch) {
  const empty = $("#empty-state");
  const searching = totalCount > 0 && hasSearch && visibleCount === 0;

  empty.classList.toggle("visible", visibleCount === 0);
  $("#library-table-wrap").classList.toggle("hidden", visibleCount === 0);
  $("#books-cards").classList.toggle("hidden", visibleCount === 0);

  $("h3", empty).textContent = searching ? "No matching books" : "Your bookshelf is waiting";
  $("p", empty).textContent = searching
    ? "Try a different regular expression or clear the search field."
    : "Add your first book to start building your personal vault.";
  $("#empty-add-book").textContent = searching ? "Add a new book" : "Add your first book";
}

export function renderLibrary(books) {
  const visible = filterAndSort(books, $("#sort-by").value);
  const search = getSearchState();

  const tbody = $("#books-table-body");
  const cards = $("#books-cards");
  tbody.replaceChildren();
  cards.replaceChildren();

  for (const book of visible) {
    const row = document.createElement("tr");
    row.innerHTML = rowHtml(book);
    tbody.appendChild(row);

    const card = document.createElement("article");
    card.className = "book-card";
    card.innerHTML = cardHtml(book);
    cards.appendChild(card);
  }

  renderEmptyState(visible.length, books.length, Boolean(search.pattern));

  $("#library-count").textContent = `${visible.length} of ${books.length} ${books.length === 1 ? "book" : "books"} shown`;

  const feedback = $("#search-feedback");
  feedback.textContent = searchFeedback();
  feedback.classList.toggle("error", Boolean(search.error));
}