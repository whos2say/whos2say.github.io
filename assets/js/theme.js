// Who's to Say ? Foundation — Theme Toggle (v1)
// - Uses html[data-theme="dark|light"]
// - Persists to localStorage key: "wts-theme"
// - Updates button text (🌙/☀️)
// - Safe to include on every page

(function () {
  const STORAGE_KEY = "wts-theme";
  const root = document.documentElement;

  function getInitialTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;

    const attr = root.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") return attr;

    try {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    } catch (e) {
      return "dark";
    }
  }

  function setTheme(next) {
    root.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
    updateToggleUI(next);
  }

  function updateToggleUI(theme) {
    const btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    btn.textContent = theme === "dark" ? "🌙" : "☀️";
    btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    btn.setAttribute("title", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }

  function bindToggle() {
    const btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      const current = root.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      setTheme(next);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    const initial = getInitialTheme();
    setTheme(initial);
    bindToggle();
  });
})();
