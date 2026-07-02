/**
 * Centralized navigation — loads content/navigation.json and renders
 * primary nav, footer nav, and page subnavs filtered by environment.
 *
 * Depends on js/content/environment.js (W2SEnvironment) when available.
 * Preserves static HTML nav as no-JS fallback; replaces on successful load.
 */
(function (global) {
  'use strict';

  var NAV_URL = '/content/navigation.json';
  var STAGING_HOST = 'staging.whostosay.org';
  var PRODUCTION_HOSTS = { 'www.whostosay.org': true, 'whostosay.org': true };
  var LOCAL_DEV_HOSTS = { localhost: true, '127.0.0.1': true };

  function getHostname() {
    return global.location && global.location.hostname ? global.location.hostname : '';
  }

  function isLocalDev() {
    return !!LOCAL_DEV_HOSTS[getHostname()];
  }

  function isStagingEnvironment() {
    if (global.W2SEnvironment && typeof global.W2SEnvironment.isStagingHost === 'function') {
      if (global.W2SEnvironment.isStagingHost()) return true;
    }
    if (getHostname() === STAGING_HOST) return true;
    if (isLocalDev()) return true;
    return false;
  }

  function isProductionEnvironment() {
    if (global.W2SEnvironment && typeof global.W2SEnvironment.isProductionHost === 'function') {
      if (global.W2SEnvironment.isProductionHost()) return true;
    }
    return !!PRODUCTION_HOSTS[getHostname()];
  }

  function currentEnvironmentKey() {
    if (isStagingEnvironment() && !isProductionEnvironment()) return 'staging';
    if (isProductionEnvironment()) return 'production';
    if (isLocalDev()) return 'staging';
    return 'production';
  }

  function itemVisible(item, envKey) {
    if (!item || item.enabled === false) return false;
    var scope = item.environment || 'all';
    if (scope === 'all') return true;
    return scope === envKey;
  }

  function sortItems(items) {
    return (items || [])
      .slice()
      .sort(function (a, b) {
        return (a.order || 0) - (b.order || 0);
      });
  }

  function filterItems(items, envKey) {
    return sortItems(items).filter(function (item) {
      return itemVisible(item, envKey);
    });
  }

  function sectionIdFromHash(href) {
    if (!href || href.charAt(0) !== '#') return '';
    return href.slice(1);
  }

  function filterByPageSectionVisibility(items, pageId) {
    var visibility = global.W2SPageSectionVisibility;
    if (!visibility || visibility.page !== pageId || !visibility.sections) return items;

    return items.filter(function (item) {
      var sectionId = sectionIdFromHash(item.href);
      if (!sectionId) return true;
      return visibility.sections[sectionId] !== false;
    });
  }

  function escapeAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function linkAttrs(item) {
    var attrs = ' href="' + escapeAttr(item.href) + '"';
    if (item.external) attrs += ' target="_blank" rel="noopener"';
    if (item.ariaLabel) attrs += ' aria-label="' + escapeAttr(item.ariaLabel) + '"';
    if (item.className) attrs += ' class="' + escapeAttr(item.className) + '"';
    return attrs;
  }

  function renderPrimaryItem(item, envKey) {
    if (item.children && item.children.length) {
      var visibleChildren = filterItems(item.children, envKey);
      if (!visibleChildren.length) {
        return (
          '<a class="nav-link" data-nav="programs"' + linkAttrs(item) + '>' +
          item.label +
          '</a>'
        );
      }
      var submenu = visibleChildren
        .map(function (child) {
          return (
            '<a class="submenu-link" href="' + escapeAttr(child.href) + '" role="menuitem">' +
            child.label +
            '</a>'
          );
        })
        .join('');
      return (
        '<div class="nav-item has-submenu" data-submenu="programs">' +
        '<a aria-expanded="false" aria-haspopup="true" class="nav-link" data-nav="programs"' +
        linkAttrs(item) +
        '>' +
        item.label +
        '</a>' +
        '<div aria-label="Programs submenu" class="nav-submenu" role="menu">' +
        submenu +
        '</div></div>'
      );
    }

    var cls = 'nav-link';
    if (item.className) cls += ' ' + item.className;
    var dataNav = '';
    if (item.href === '/') dataNav = ' data-nav="home"';
    else if (item.href === '/programs.html') dataNav = ' data-nav="programs"';

    return '<a class="' + cls + '"' + dataNav + linkAttrs(item) + '>' + item.label + '</a>';
  }

  function renderPrimaryNav(container, items, envKey) {
    var visible = filterItems(items, envKey);
    if (!visible.length) return;

    container.setAttribute('data-nav-generated', 'true');
    container.classList.add('site-nav--generated');
    container.innerHTML = visible.map(function (item) {
      return renderPrimaryItem(item, envKey);
    }).join('');
  }

  function renderFooterNav(container, items, envKey) {
    var visible = filterItems(items, envKey);
    if (!visible.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    container.classList.add('footer-nav--generated');
    container.innerHTML = visible
      .map(function (item) {
        return (
          '<a class="footer-nav__link"' +
          linkAttrs(item) +
          '>' +
          item.label +
          '</a>'
        );
      })
      .join('');
  }

  function renderSubnav(container, items, envKey) {
    var pageId = document.body && document.body.getAttribute('data-content-page');
    var visible = filterByPageSectionVisibility(filterItems(items, envKey), pageId);
    if (!visible.length) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }

    container.hidden = false;
    container.innerHTML =
      '<div class="page-subnav__inner">' +
      visible
        .map(function (item) {
          return (
            '<a class="page-subnav__link"' +
            linkAttrs(item) +
            '>' +
            item.label +
            '</a>'
          );
        })
        .join('') +
      '</div>';

    bindSubnavScroll(container);
  }

  function bindSubnavScroll(container) {
    if (container.getAttribute('data-wts-subnav-bound') === 'true') return;
    container.setAttribute('data-wts-subnav-bound', 'true');

    container.addEventListener('click', function (e) {
      var link = e.target.closest('.page-subnav__link[href^="#"]');
      if (!link || !container.contains(link)) return;

      var id = link.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (global.history && global.history.replaceState) {
        global.history.replaceState(null, '', '#' + id);
      }
    });
  }

  function markActiveSubnav(container) {
    var here = global.location.pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '');
    var hash = global.location.hash || '';
    container.querySelectorAll('.page-subnav__link').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var active = false;
      if (href.indexOf('#') === 0) {
        active = hash === href;
      } else {
        var path = href.split('#')[0].replace(/\/index\.html$/, '/').replace(/\/+$/, '');
        active = path === here || path === here + '.html';
      }
      a.classList.toggle('is-active', active);
      if (active) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  function applyNavigation(data) {
    var envKey = currentEnvironmentKey();

    document.querySelectorAll('.site-header .site-nav, .site-nav[data-nav-primary]').forEach(function (nav) {
      renderPrimaryNav(nav, data.primary, envKey);
    });

    document.querySelectorAll('[data-footer-nav]').forEach(function (footerNav) {
      renderFooterNav(footerNav, data.footer, envKey);
    });

    var pageId = document.body && document.body.getAttribute('data-content-page');
    var subnavItems = pageId && data.subnavs ? data.subnavs[pageId] : null;
    document.querySelectorAll('[data-page-subnav]').forEach(function (subnav) {
      if (subnavItems) {
        renderSubnav(subnav, subnavItems, envKey);
        markActiveSubnav(subnav);
      } else {
        subnav.hidden = true;
        subnav.innerHTML = '';
      }
    });

    var readyEvent = new CustomEvent('w2s:navigation-ready', { bubbles: true });
    if (global.document && global.document.dispatchEvent) {
      global.document.dispatchEvent(readyEvent);
    } else {
      global.dispatchEvent(readyEvent);
    }
  }

  function init() {
    if (!global.fetch) return Promise.resolve();

    return global
      .fetch(NAV_URL, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('navigation.json HTTP ' + res.status);
        return res.json();
      })
      .then(applyNavigation)
      .catch(function (err) {
        console.warn('[W2SNavigation] Using static HTML nav fallback:', err.message);
      });
  }

  global.W2SNavigation = { init: init, currentEnvironmentKey: currentEnvironmentKey };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
    });
  } else {
    init();
  }
})(window);
