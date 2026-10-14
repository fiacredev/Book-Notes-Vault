import { $ } from "./utils.js";
import { compileSearch } from "./search.js";
import { configure, getState, initState, onChange } from "./state.js";
import { initNavigation } from "./navigation.js";
import { initForm, openBlankForm } from "./form.js";
import { initRecordActions } from "./records.js";
import { initSettings } from "./settings.js";
import { renderLibrary } from "./library.js";
import { computeStats, renderDashboard } from "./stats.js";

/** Writes to the global aria-live region so screen readers hear every state change. */
const announce = (message) => {
  $("#global-status").textContent = message;
};

function initSearch() {
  const run = () => compileSearch($("#search-pattern").value, $("#case-insensitive").checked);
  $("#search-pattern").addEventListener("input", run);
  $("#case-insensitive").addEventListener("change", run);
  $("#sort-by").addEventListener("change", () => renderLibrary(getState().books));
}

function init() {
  configure({ announce, warn: announce });
  initNavigation();
  initForm({ announce, onSaved: () => {} });
  initRecordActions();
  initSettings({ announce });
  initSearch();

  $("#add-book-top").addEventListener("click", openBlankForm);
  $("#empty-add-book").addEventListener("click", openBlankForm);

  // Single render pass for every state change.
  onChange(({ books, settings }) => {
    renderLibrary(books);
    renderDashboard(computeStats(books, settings));
  });

  initState();
  $("#target-input").value = String(getState().settings.pageTarget);
}

init();