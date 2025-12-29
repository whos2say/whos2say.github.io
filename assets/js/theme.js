// Who's to Say ? Foundation — Theme + Nav (Pro v4)
// Includes:
// - Theme toggle with persistence and system fallback
// - Theme-aware logo handling (works with single logo + data attrs OR dual logos via CSS)
// - Programs dropdown: hover-open on desktop, pin-open on click, close on outside click / Esc
// - Pathways ribbon: auto-highlights active page

(function () {
  const STORAGE_KEY = "wts-theme";
  const root = document.documentElement;

  // -------------------------
  // THEME
  // -------------------------
  function systemTheme() {
    try {
      return window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: light)").matches
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

  // Works if you have ONE logo with data-logo-light/dark.
  // If you're using dual logos (logo-dark/logo-light) via CSS, this does nothing (and that's fine).
  function updateLogo(theme) {
    const logos = document.querySelectorAll(".brand-logo");
    if (!logos.length) return;

    logos.forEach((logo) => {
      const light = logo.getAttribute("data-logo-light");
      const dark = logo.getAttribute("data-logo-dark");
      if (!light || !dark) return; // dual-logo CSS approach -> no swap needed
      logo.src = theme === "light" ? light : dark;
    });
  }

  function updateToggleUI(theme) {
    document.querySelectorAll(".theme-toggle").forEach((btn) => {
      btn.textContent = theme === "dark" ? "🌙" : "☀️";
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
      btn.setAttribute(
        "title",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
    });
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    updateToggleUI(theme);
    updateLogo(theme);
    try {
      root.dispatchEvent(
        new CustomEvent("wts-theme-change", { detail: { theme } })
      );
    } catch (e) {}
  }

  function setUserTheme(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
  }

  function initThemeEarly() {
    const initial =
      savedTheme() || root.getAttribute("data-theme") || systemTheme();
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
    const handler = () => {
      if (!savedTheme()) applyTheme(systemTheme());
    };
    try {
      mq.addEventListener("change", handler);
    } catch (e) {
      try {
        mq.addListener(handler);
      } catch (e2) {}
    }
  }

  // -------------------------
  // DROPDOWNS (Programs)
  // Supports:
  // 1) legacy: [data-dropdown] + .nav-trigger
  // 2) current: .has-submenu + .nav-submenu (trigger = .nav-link inside)
  // -------------------------
  function isDesktopHover() {
    // Only hover-open if the device supports hover and we're not in a narrow layout
    try {
      return (
        window.matchMedia &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
        window.matchMedia("(min-width: 900px)").matches
      );
    } catch (e) {
      return false;
    }
  }

  function getDropdowns() {
    const legacy = Array.from(document.querySelectorAll("[data-dropdown]"));
    const current = Array.from(document.querySelectorAll(".has-submenu"));
    // de-dupe
    const set = new Set([...legacy, ...current]);
    return Array.from(set);
  }

  function getTrigger(dd) {
    return (
      dd.querySelector(".nav-trigger") ||
      dd.querySelector(".nav-link") ||
      dd.querySelector("a")
    );
  }

  function getMenu(dd) {
    return dd.querySelector(".nav-submenu") || dd.querySelector("[role='menu']");
  }

  function closeDropdown(dd) {
    dd.classList.remove("is-open");
    dd.classList.remove("is-pinned");
    const btn = getTrigger(dd);
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function openDropdown(dd) {
    dd.classList.add("is-open");
    dd.classList.remove("is-pinned");
    const btn = getTrigger(dd);
    if (btn) btn.setAttribute("aria-expanded", "true");
  }

  function closeAll(except) {
    getDropdowns().forEach((dd) => {
      if (dd === except) return;
      closeDropdown(dd);
    });
  }

  function bindDropdowns() {
    const dropdowns = getDropdowns();
    if (!dropdowns.length) return;

    dropdowns.forEach((dd) => {
      const trigger = getTrigger(dd);
      const menu = getMenu(dd);
      if (!trigger || !menu) return;

      // a11y baseline
      trigger.setAttribute("aria-haspopup", "true");
      trigger.setAttribute(
        "aria-expanded",
        dd.classList.contains("is-open") ? "true" : "false"
      );
      // CLICK navigates normally (dropdown opens on hover)

      // HOVER opens on desktop (unless pinned)
      dd.addEventListener("mouseenter", () => {
        if (!isDesktopHover()) return;
        closeAll(dd);
        openDropdown(dd);
      });

      dd.addEventListener("mouseleave", () => {
        if (!isDesktopHover()) return;
        closeDropdown(dd);
      });
    });

    // Outside click closes (unless pinned? We DO close even pinned on outside click — expected UX)
    document.addEventListener("click", () => closeAll(null));

    // Esc closes all
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") closeAll(null);
    });

    // If layout changes (resize), unpin to avoid weird states
    window.addEventListener("resize", () => {
      if (!isDesktopHover()) {
        // on mobile/tablet: keep state but remove hover-open assumptions
        // no-op
      }
    });
  }

  
  // -------------------------
  // Active nav link (no per-page markup needed)
  // -------------------------
  function markActiveNav() {
    const here = window.location.pathname.replace(/\/index\.html$/, "/").replace(/\/+$/, "");
    document.querySelectorAll(".site-nav .nav-link").forEach((a) => {
      const hrefRaw = a.getAttribute("href") || "";
      // ignore external links
      if (/^https?:\/\//i.test(hrefRaw) || hrefRaw.startsWith("mailto:")) return;

      const href = hrefRaw.split("#")[0].replace(/\/index\.html$/, "/").replace(/\/+$/, "");
      const isHome = (here === "" || here === "/");
      const targetIsHome = (href === "" || href === "/");

      const active = targetIsHome ? isHome : (href && href === here);
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }


// -------------------------
  // Pathways ribbon auto-active
  // -------------------------
  function markActivePathwayChip() {
    const here = window.location.pathname.replace(/\/+$/, "");
    document.querySelectorAll(".pathways-ribbon .pathway-chip").forEach((a) => {
      const href = (a.getAttribute("href") || "").replace(/\/+$/, "");
      a.classList.toggle("is-active", href === here);
    });
  }

  // expose a minimal API
  window.WTSTheme = {
    set: setUserTheme,
    get: () => root.getAttribute("data-theme") || "dark",
  };

  // init before paint if possible
  initThemeEarly();

  document.addEventListener("DOMContentLoaded", function () {
    initThemeEarly();
    bindThemeToggle();
    bindSystemListener();    // Programs dropdown (disabled on ribbon pages)
    const hasRibbon = document.body && document.body.dataset && document.body.dataset.hasRibbon === "true";
    if (!hasRibbon) bindDropdowns();
    markActiveNav();
    markActivePathwayChip();
  });
})();

