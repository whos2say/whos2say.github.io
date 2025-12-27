// Who's to Say ? Foundation — Theme Toggle (Pro v2)
// Adds:
// - Logo swapping via data-logo-light / data-logo-dark on .brand-logo

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
    const btns = document.querySelectorAll(".theme-toggle");
    if (!btns.length) return;
    btns.forEach((btn) => {
      btn.textContent = theme === "dark" ? "🌙" : "☀️";
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
      btn.setAttribute("title", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    });
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    updateToggleUI(theme);
    updateLogo(theme);

    try {
      root.dispatchEvent(new CustomEvent("wts-theme-change", { detail: { theme } }));
    } catch (e) {}
  }

  function setUserTheme(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
    apply(theme);
  }

  function clearUserTheme() {
    localStorage.removeItem(STORAGE_KEY);
    apply(systemTheme());
  }

  function initEarly() {
    const initial = savedTheme() || root.getAttribute("data-theme") || systemTheme();
    apply(initial);
  }

  function bindToggles() {
    const btns = document.querySelectorAll(".theme-toggle");
    if (!btns.length) return;
    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const current = root.getAttribute("data-theme") || "dark";
        const next = current === "dark" ? "light" : "dark";
        setUserTheme(next);
      });
    });
  }

  function bindSystemListener() {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      if (!savedTheme()) apply(systemTheme());
    };
    try { mq.addEventListener("change", handler); }
    catch (e) { try { mq.addListener(handler); } catch (e2) {} }
  }

  window.WTSTheme = { set: setUserTheme, reset: clearUserTheme, get: () => (root.getAttribute("data-theme") || "dark") };

  initEarly();

  document.addEventListener("DOMContentLoaded", function () {
    initEarly();
    bindToggles();
    bindSystemListener();
  });
})();
