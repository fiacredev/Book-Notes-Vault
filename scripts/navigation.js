import { $, $$ } from "./utils.js";

/** Mobile menu toggle plus scroll-spy for aria-current on the nav links. */
export function initNavigation() {
  const menuToggle = $("#menu-toggle");
  const nav = $("#primary-nav");

  menuToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });

  nav.addEventListener("click", event => {
    if (!event.target.closest("a")) return;
    nav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  });

  const sectionLinks = $$("[data-section]");
  const sections = sectionLinks.map(link => document.getElementById(link.dataset.section)).filter(Boolean);
  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      sectionLinks.forEach(link => {
        if (link.dataset.section === visible.target.id) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    },
    { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.1, 0.3] }
  );

  sections.forEach(section => observer.observe(section));
}