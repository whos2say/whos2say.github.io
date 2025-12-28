// Who's to Say ? Foundation — Theme + Nav (Unified v8)
// - Theme toggle with persistence + system fallback
// - Works even if data-theme is missing (CSS defaults to dark)
// - Programs submenu: hover opens on desktop via CSS; click pins open; closes on outside click / Esc
// - Auto-highlights active nav link + optional pathway chips

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
  }

  function setUserTheme(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
  }

  // Run ASAP (before DOMContentLoaded) to reduce flash
  (function initThemeEarly() {
    const initial = savedTheme() || root.getAttribute("data-theme") || systemTheme();
    applyTheme(initial);
  })();

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

  // Click-to-pin submenu (hover handled in CSS)
  function bindSubmenus() {
    const items = document.querySelectorAll(".nav-item.has-submenu");
    if (!items.length) return;

    function closeAll(except) {
      items.forEach((it) => {
        if (it === except) return;
        it.classList.remove("is-open");
        const trigger = it.querySelector(".nav-link[aria-haspopup='true']");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      });
    }

    items.forEach((it) => {
      const trigger = it.querySelector(".nav-link[aria-haspopup='true']");
      if (!trigger) return;

      trigger.addEventListener("click", (e) => {
        // Clicking Programs should pin-open submenu, but still allow navigation if user clicks again
        // We prevent default ONLY when toggling open/close
        const alreadyOpen = it.classList.contains("is-open");
        if (!alreadyOpen) {
          e.preventDefault();
          e.stopPropagation();
          closeAll(it);
          it.classList.add("is-open");
          trigger.setAttribute("aria-expanded", "true");
        } else {
          // If already open, allow navigation to /programs.html
          closeAll(null);
        }
      });
    });

    document.addEventListener("click", () => closeAll(null));
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeAll(null); });
  }

  // Optional: highlight exact nav link
  function markActiveNav() {
    const here = window.location.pathname.replace(/\/+$/, "") || "/";
    document.querySelectorAll(".site-nav .nav-link").forEach((a) => {
      const href = (a.getAttribute("href") || "").replace(/\/+$/, "") || "/";
      // Mark Programs active for any /programs/... page
      const active =
        (href === "/" && here === "/") ||
        (href === "/programs.html" && (here === "/programs.html" || here.startsWith("/programs/"))) ||
        (href !== "/" && href !== "/programs.html" && href === here);
      a.classList.toggle("active", active);
    });
  }

  // Pathways ribbon chips
  function markActivePathwayChip() {
    const here = window.location.pathname.replace(/\/+$/, "");
    document.querySelectorAll(".pathways-ribbon .pathway-chip").forEach((a) => {
      const href = (a.getAttribute("href") || "").replace(/\/+$/, "");
      a.classList.toggle("is-active", href === here);
    });
  }

  window.WTSTheme = { set: setUserTheme, get: () => (root.getAttribute("data-theme") || "dark") };

  document.addEventListener("DOMContentLoaded", function () {
    // ensure theme applied (in case this script loads late)
    const initial = savedTheme() || root.getAttribute("data-theme") || systemTheme();
    applyTheme(initial);

    bindThemeToggle();
    bindSystemListener();
    bindSubmenus();
    markActiveNav();
    markActivePathwayChip();
  });
})();