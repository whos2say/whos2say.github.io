/**
 * Staging vs production UI — staging banner and data-staging-only elements.
 * Navigation is handled by js/content/navigation.js (content/navigation.json).
 * Production hosts are explicitly protected from shared staging flags.
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
    var showBanner = !isProductionHost() && (env.showStagingBanner === true || isStagingHost());

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

    if (showBanner || isStagingHost()) {
      showStagingOnlyElements();
    } else {
      hideStagingOnlyElements();
    }
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
        if (isStagingHost()) applyEnvironment({ environment: { showStagingBanner: true } });
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
