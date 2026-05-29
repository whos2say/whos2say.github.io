/**
 * Staging vs production UI — draft page nav, staging banner.
 * Reads content/site.json environment flags; hostname is a fallback.
 * Production nav stays unchanged when showDraftPagesInNav is false.
 */
(function (global) {
  'use strict';

  var PRODUCTION_HOSTS = { 'www.whostosay.org': true, 'whostosay.org': true };
  var STAGING_HOST = 'staging.whostosay.org';

  function isStagingHost() {
    return global.location && global.location.hostname === STAGING_HOST;
  }

  function isProductionHost() {
    return global.location && PRODUCTION_HOSTS[global.location.hostname];
  }

  function applyEnvironment(site) {
    var env = (site && site.environment) || {};
    var showDraftNav = env.showDraftPagesInNav === true || isStagingHost();
    var showBanner = env.showStagingBanner === true || isStagingHost();

    if (showBanner && !document.getElementById('w2s-staging-banner')) {
      var banner = document.createElement('div');
      banner.id = 'w2s-staging-banner';
      banner.className = 'w2s-staging-banner';
      banner.setAttribute('role', 'status');
      banner.innerHTML =
        '<strong>Staging site</strong> — content here is not live on ' +
        '<a href="https://www.whostosay.org">www.whostosay.org</a>. ' +
        'Review on staging, then merge <code>staging</code> → <code>main</code>.';
      document.body.insertBefore(banner, document.body.firstChild);
    }

    if (showDraftNav) {
      injectDraftNavLinks(env.draftNavLinks);
      showStagingOnlyElements();
    } else {
      hideStagingOnlyElements();
    }
  }

  function defaultDraftLinks() {
    return [
      { href: '/creative-workshops.html', label: 'Creative Workshops' },
      { href: '/support-coordinators.html', label: 'For Coordinators' },
    ];
  }

  function injectDraftNavLinks(links) {
    var items = links && links.length ? links : defaultDraftLinks();
    document.querySelectorAll('.site-nav').forEach(function (nav) {
      if (nav.querySelector('[data-draft-nav]')) return;
      items.forEach(function (item) {
        var a = document.createElement('a');
        a.className = 'nav-link';
        a.setAttribute('data-draft-nav', 'true');
        a.href = item.href;
        a.textContent = item.label;
        var donate = nav.querySelector('a[href*="givebutter"]');
        if (donate && donate.parentNode) {
          donate.parentNode.insertBefore(a, donate);
        } else {
          nav.appendChild(a);
        }
      });
    });
  }

  function showStagingOnlyElements() {
    document.querySelectorAll('[data-staging-only]').forEach(function (el) {
      el.hidden = false;
      el.style.display = '';
    });
  }

  function hideStagingOnlyElements() {
    document.querySelectorAll('[data-staging-only]').forEach(function (el) {
      el.hidden = true;
      el.style.display = 'none';
    });
  }

  function init() {
    if (!global.fetch) return;

    global.fetch('/content/site.json', { cache: 'no-cache' })
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .then(applyEnvironment)
      .catch(function () {
        if (isStagingHost()) applyEnvironment({ environment: { showDraftPagesInNav: true, showStagingBanner: true } });
        else applyEnvironment({});
      });
  }

  global.W2SEnvironment = { init: init, isStagingHost: isStagingHost, isProductionHost: isProductionHost };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
