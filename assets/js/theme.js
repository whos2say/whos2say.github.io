// Who's to Say ? Foundation — Theme + Nav (Pro v4)
// Includes:
// - Theme toggle with persistence and system fallback
// - Theme-aware logo handling (works with single logo + data attrs OR dual logos via CSS)
// - Programs dropdown: hover-open on desktop, pin-open on click, close on outside click / Esc
// - Pathways ribbon: auto-highlights active page

(function () {
  const STORAGE_KEY = "wts-theme";
  const root = document.documentElement;

  const uiState = {
    dropdownGlobalsBound: false,
    mobileGlobalsBound: false,
    systemListenerBound: false,
    mobileMenuController: { close: function () {} },
  };

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

  function updateLogo(theme) {
    const logos = document.querySelectorAll(".brand-logo");
    if (!logos.length) return;

    logos.forEach((logo) => {
      const light = logo.getAttribute("data-logo-light");
      const dark = logo.getAttribute("data-logo-dark");
      if (!light || !dark) return;
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
    document.querySelectorAll(".theme-toggle:not([data-wts-bound])").forEach((btn) => {
      btn.setAttribute("data-wts-bound", "true");
      btn.addEventListener("click", () => {
        const current = root.getAttribute("data-theme") || "dark";
        setUserTheme(current === "dark" ? "light" : "dark");
      });
    });
  }

  function bindSystemListener() {
    if (uiState.systemListenerBound || !window.matchMedia) return;
    uiState.systemListenerBound = true;

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
  // -------------------------
  function isDesktopHover() {
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

  function onDropdownDocumentClick() {
    closeAll(null);
  }

  function onDropdownDocumentKeydown(ev) {
    if (ev.key === "Escape") closeAll(null);
  }

  function bindDropdownGlobalsOnce() {
    if (uiState.dropdownGlobalsBound) return;
    uiState.dropdownGlobalsBound = true;
    document.addEventListener("click", onDropdownDocumentClick);
    document.addEventListener("keydown", onDropdownDocumentKeydown);
  }

  function bindDropdowns() {
    const dropdowns = getDropdowns();
    if (!dropdowns.length) return;

    bindDropdownGlobalsOnce();

    dropdowns.forEach((dd) => {
      if (dd.getAttribute("data-wts-dropdown-bound") === "true") return;

      const trigger = getTrigger(dd);
      const menu = getMenu(dd);
      if (!trigger || !menu) return;

      dd.setAttribute("data-wts-dropdown-bound", "true");
      trigger.setAttribute("aria-haspopup", "true");
      trigger.setAttribute(
        "aria-expanded",
        dd.classList.contains("is-open") ? "true" : "false"
      );

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
  }

  // -------------------------
  // Mobile hamburger menu
  // -------------------------
  function bindMobileMenuGlobalsOnce() {
    if (uiState.mobileGlobalsBound) return;
    uiState.mobileGlobalsBound = true;

    document.addEventListener("click", function () {
      uiState.mobileMenuController.close();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") uiState.mobileMenuController.close();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 900) uiState.mobileMenuController.close();
    });
  }

  function destroyMobileMenu() {
    document.querySelectorAll(".mobile-menu-btn").forEach(function (el) {
      el.remove();
    });
    document.querySelectorAll(".mobile-menu-panel").forEach(function (el) {
      el.remove();
    });
    uiState.mobileMenuController.close = function () {};
  }

  function buildMobileMenu() {
    const siteNav = document.querySelector(".site-nav");
    const headerActions = document.querySelector(".header-actions");
    if (!siteNav || !headerActions) return;

    destroyMobileMenu();
    bindMobileMenuGlobalsOnce();

    const hamburger = document.createElement("button");
    hamburger.className = "mobile-menu-btn";
    hamburger.setAttribute("aria-label", "Open navigation menu");
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("type", "button");
    hamburger.innerHTML =
      '<span class="hamburger-icon" aria-hidden="true">' +
      "<span></span><span></span><span></span>" +
      "</span>";
    headerActions.insertBefore(hamburger, headerActions.firstChild);

    const panel = document.createElement("nav");
    panel.className = "mobile-menu-panel";
    panel.setAttribute("aria-label", "Mobile navigation");
    panel.setAttribute("aria-hidden", "true");

    const here = window.location.pathname
      .replace(/\/index\.html$/, "/")
      .replace(/\/+$/, "");

    siteNav.querySelectorAll(".nav-link").forEach(function (link) {
      const a = document.createElement("a");
      a.href = link.href;
      a.textContent = link.textContent;
      a.className = "mobile-nav-link";
      const hrefRaw = (link.getAttribute("href") || "")
        .split("#")[0]
        .replace(/\/index\.html$/, "/")
        .replace(/\/+$/, "");
      const isHome = here === "" || here === "/";
      const targetIsHome = hrefRaw === "" || hrefRaw === "/";
      const active = targetIsHome ? isHome : hrefRaw && hrefRaw === here;
      if (active) {
        a.classList.add("active");
        a.setAttribute("aria-current", "page");
      }
      panel.appendChild(a);
    });

    document.body.appendChild(panel);

    function closeMenu() {
      hamburger.classList.remove("is-open");
      hamburger.setAttribute("aria-expanded", "false");
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
    }

    function openMenu() {
      hamburger.classList.add("is-open");
      hamburger.setAttribute("aria-expanded", "true");
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
    }

    uiState.mobileMenuController.close = closeMenu;

    hamburger.addEventListener("click", function (e) {
      e.stopPropagation();
      hamburger.classList.contains("is-open") ? closeMenu() : openMenu();
    });

    panel.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    panel.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
  }

  // -------------------------
  // Active nav link
  // -------------------------
  function markActiveNav() {
    const here = window.location.pathname
      .replace(/\/index\.html$/, "/")
      .replace(/\/+$/, "");
    document.querySelectorAll(".site-nav .nav-link").forEach((a) => {
      const hrefRaw = a.getAttribute("href") || "";
      if (/^https?:\/\//i.test(hrefRaw) || hrefRaw.startsWith("mailto:")) return;

      const href = hrefRaw
        .split("#")[0]
        .replace(/\/index\.html$/, "/")
        .replace(/\/+$/, "");
      const isHome = here === "" || here === "/";
      const targetIsHome = href === "" || href === "/";

      const active = targetIsHome ? isHome : href && href === here;
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function markActivePathwayChip() {
    const here = window.location.pathname.replace(/\/+$/, "");
    document.querySelectorAll(".pathways-ribbon .pathway-chip").forEach((a) => {
      const href = (a.getAttribute("href") || "").replace(/\/+$/, "");
      a.classList.toggle("is-active", href === here);
    });
  }

  function refreshNavigationUi() {
    destroyMobileMenu();

    initThemeEarly();
    bindThemeToggle();
    buildMobileMenu();
    const hasRibbon =
      document.body &&
      document.body.dataset &&
      document.body.dataset.hasRibbon === "true";
    if (!hasRibbon) bindDropdowns();
    markActiveNav();
  }

  window.WTSTheme = {
    set: setUserTheme,
    get: () => root.getAttribute("data-theme") || "dark",
    reinitAfterDynamicRender: refreshNavigationUi,
  };

  initThemeEarly();

  document.addEventListener("DOMContentLoaded", function () {
    initThemeEarly();
    bindThemeToggle();
    buildMobileMenu();
    bindSystemListener();
    const hasRibbon =
      document.body &&
      document.body.dataset &&
      document.body.dataset.hasRibbon === "true";
    if (!hasRibbon) bindDropdowns();
    markActiveNav();
    markActivePathwayChip();
  });

  document.addEventListener("w2s:navigation-ready", refreshNavigationUi);
})();
