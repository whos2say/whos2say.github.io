// Who's to Say ? Foundation — Theme + Nav (Pro v3)
// Includes:
// - Theme toggle with persistence and system fallback
// - Theme-aware logo swapping via data-logo-light / data-logo-dark on .brand-logo
// - Programs dropdown: hover-open on desktop, pin-open on click, close on outside click / Esc
// - Pathways ribbon: auto-highlights active page

(function () {
  const STORAGE_KEY = "wts-theme";
  const root = document.documentElement;

  function systemTheme() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    } catch (e) {
      return "dark";
    }
  }

  function savedTheme() {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  }

  function updateLogo(theme) {
    const logo = document.querySelector(".brand-logo");
    if (!logo) return;
    const light = logo.getAttribute("data-logo-light");
    const dark = logo.getAttribute("data-logo-dark");
    if (!light || !dark) return;
    logo.src = theme === "light" ? light : dark;
  }

  function updateToggleUI(theme) {
    document.querySelectorAll(".theme-toggle").forEach((btn) => {
      btn.textContent = theme === "dark" ? "🌙" : "☀️";
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
      btn.setAttribute("title", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    });
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    updateToggleUI(theme);
    updateLogo(theme);
    try { root.dispatchEvent(new CustomEvent("wts-theme-change", { detail: { theme } })); } catch (e) {}
  }

  function setUserTheme(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
  }

  function initThemeEarly() {
    const initial = savedTheme() || root.getAttribute("data-theme") || systemTheme();
    applyTheme(initial);
  }

  function bindThemeToggle() {
    document.querySelectorAll(".theme-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const current = root.getAttribute("data-theme") || "dark";
        setUserTheme(current === "dark" ? "light" : "dark");
      });
    });
  }

  function bindSystemListener() {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => { if (!savedTheme()) applyTheme(systemTheme()); };
    try { mq.addEventListener("change", handler); } catch (e) { try { mq.addListener(handler); } catch (e2) {} }
  }

  // Programs dropdown behavior
  function bindDropdowns() {
    const dropdowns = document.querySelectorAll("[data-dropdown]");
    if (!dropdowns.length) return;

    function closeAll(except) {
      dropdowns.forEach((dd) => {
        if (dd === except) return;
        dd.classList.remove("is-open");
        const btn = dd.querySelector(".nav-trigger");
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
    }

    dropdowns.forEach((dd) => {
      const btn = dd.querySelector(".nav-trigger");
      if (!btn) return;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const willOpen = !dd.classList.contains("is-open");
        closeAll(dd);
        dd.classList.toggle("is-open", willOpen);
        btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });
    });

    document.addEventListener("click", () => closeAll(null));
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") closeAll(null);
    });
  }

  // Pathways ribbon auto-active
  function markActivePathwayChip() {
    const here = window.location.pathname.replace(/\/+$/, "");
    document.querySelectorAll(".pathways-ribbon .pathway-chip").forEach((a) => {
      const href = (a.getAttribute("href") || "").replace(/\/+$/, "");
      a.classList.toggle("is-active", href === here);
    });
  }

  window.WTSTheme = { set: setUserTheme, get: () => (root.getAttribute("data-theme") || "dark") };

  initThemeEarly();

  document.addEventListener("DOMContentLoaded", function () {
    initThemeEarly();
    bindThemeToggle();
    bindSystemListener();
    bindDropdowns();
    markActivePathwayChip();
  });
})();
