import { $, localDate, formatNumber } from "./utils.js";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The last seven calendar dates, oldest first, ending today. */
export function lastSevenDates(today = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setHours(12, 0, 0, 0);
    date.setDate(today.getDate() - (6 - index));
    return localDate(date);
  });
}

export function computeStats(books, settings) {
  const totalPages = books.reduce((sum, book) => sum + Number(book.pages), 0);
  const tagCounts = new Map();
  books.forEach(book => tagCounts.set(book.tag, (tagCounts.get(book.tag) || 0) + 1));
  const topTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  const dates = lastSevenDates();
  const weekly = dates.map(date => books.filter(book => book.dateAdded === date).length);

  return {
    totalBooks: books.length,
    totalPages,
    topTag,
    weekTotal: weekly.reduce((a, b) => a + b, 0),
    weekly,
    weeklyDates: dates,
    pageTarget: settings.pageTarget
  };
}

function renderWeeklyChart(stats) {
  const chart = $("#weekly-chart");
  const max = Math.max(1, ...stats.weekly);
  chart.replaceChildren();

  stats.weeklyDates.forEach((date, index) => {
    const column = document.createElement("div");
    column.className = "chart-column";
    column.innerHTML =
      `<div class="chart-bar-wrap"><div class="chart-bar${index === 6 ? " today" : ""}"` +
      ` style="height:${Math.max(3, (stats.weekly[index] / max) * 100)}%">` +
      `<span class="chart-value">${stats.weekly[index]}</span></div></div>` +
      `<span class="chart-day">${DAYS[new Date(`${date}T12:00:00`).getDay()]}</span>`;
    chart.appendChild(column);
  });

  chart.setAttribute(
    "aria-label",
    `Books added in the last seven calendar days: ${stats.weeklyDates.map((date, i) => `${date}: ${stats.weekly[i]}`).join(", ")}.`
  );
}

/** Polite while under target, assertive once the target is exceeded. */
function renderTarget(totalPages, target) {
  const progress = Math.min(100, Math.round((totalPages / target) * 100));
  $("#target-current").textContent = formatNumber(totalPages);
  $("#target-total").textContent = `/ ${formatNumber(target)} pages`;

  const bar = $("#target-progress");
  bar.setAttribute("aria-valuemax", String(target));
  bar.setAttribute("aria-valuenow", String(Math.min(totalPages, target)));
  bar.setAttribute("aria-valuetext", `${formatNumber(totalPages)} of ${formatNumber(target)} pages`);
  $("#target-progress-fill").style.width = `${progress}%`;

  const message = $("#target-message");
  const over = totalPages > target;
  message.textContent = over
    ? `Target exceeded by ${formatNumber(totalPages - target)} pages. Consider increasing your target.`
    : `${formatNumber(target - totalPages)} pages remaining. You're within your page target.`;
  message.classList.toggle("over", over);
  message.setAttribute("aria-live", over ? "assertive" : "polite");
}

export function renderDashboard(stats) {
  $("#stat-books").textContent = formatNumber(stats.totalBooks);
  $("#stat-pages").textContent = formatNumber(stats.totalPages);
  $("#stat-tag").textContent = stats.topTag ? stats.topTag[0] : "—";
  $("#stat-tag").title = stats.topTag ? `${stats.topTag[1]} book(s)` : "No tags yet";
  $("#stat-week").textContent = formatNumber(stats.weekTotal);
  renderWeeklyChart(stats);
  renderTarget(stats.totalPages, stats.pageTarget);
}

export { renderTarget };