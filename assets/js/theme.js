// Who's to Say ? Foundation — Theme + Nav (Pro v4)
// - Theme toggle with persistence + system fallback
// - Dropdown: hover-open on desktop, pin-open on click, close on outside click / Esc
// - Accordion helper for program pages

(function () {
  const STORAGE_KEY = "wts-theme";
  const root = document.documentElement;

  function systemTheme() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    } catch (e) { return "dark"; }
  }

  function savedTheme() {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
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
    try { root.dispatchEvent(new CustomEvent("wts-theme-change", { detail: { theme } })); } catch (e) {}
  }

  function setUserTheme(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
  }

  function initTheme() {
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

  // Dropdowns: expects .nav-dropdown[data-dropdown] with a button.nav-trigger inside
  function bindDropdowns() {
    const dropdowns = document.querySelectorAll(".nav-dropdown[data-dropdown]");
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
        e.stopPropagation();
        const willOpen = !dd.classList.contains("is-open");
        closeAll(dd);
        dd.classList.toggle("is-open", willOpen);
        btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
        // button trigger: always prevent page nav
        e.preventDefault();
      });
    });

    document.addEventListener("click", () => closeAll(null));
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeAll(null); });
  }

  // Accordions: .acc-item contains button.acc-btn and .acc-panel
  function bindAccordions() {
    document.querySelectorAll(".acc-item .acc-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.closest(".acc-item");
        if (!item) return;
        item.classList.toggle("is-open");
      });
    });
  }

  window.WTSTheme = { set: setUserTheme, get: () => (root.getAttribute("data-theme") || "dark") };

  initTheme();

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    bindThemeToggle();
    bindSystemListener();
    bindDropdowns();
    bindAccordions();
  });
})();
