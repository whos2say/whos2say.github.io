/**
 * DJR Photography — content loader & renderers.
 *
 * Every DJR page reads its copy from JSON files in /content/djr/.
 * Edit the JSON directly, or use the WYSIWYG editor at /admin/
 * (Decap CMS → "DJR Photography" collections).
 *
 * HTML pages keep their layout as a fallback; this script syncs
 * live copy on load, mirroring /js/content/render.js for the
 * main foundation site.
 */
(function (global) {
  'use strict';

  var CACHE = {};

  function fetchJson(url) {
    if (CACHE[url]) return Promise.resolve(CACHE[url]);
    return fetch(url, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load ' + url + ' (' + res.status + ')');
        return res.json();
      })
      .then(function (data) {
        CACHE[url] = data;
        return data;
      });
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setMeta(meta) {
    if (!meta) return;
    if (meta.title) document.title = meta.title;
    if (meta.description) {
      var tag = document.querySelector('meta[name="description"]');
      if (tag) tag.setAttribute('content', meta.description);
    }
  }

  function mediaHtml(src, alt, icon) {
    if (src) return '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" loading="lazy" decoding="async"/>';
    return '<div class="djr-placeholder" aria-hidden="true">' + esc(icon || '📷') + '</div>';
  }

  /* ── Shared chrome: header + footer from site.json ── */

  function renderChrome(site) {
    var brand = site.brand || {};
    var mark = document.querySelector('.djr-brand .djr-wordmark');
    if (mark) mark.textContent = brand.wordmark || 'DJR';
    var sub = document.querySelector('.djr-brand-sub');
    if (sub) sub.textContent = (brand.name || '') + ' ' + (brand.tagline || '');

    var page = document.body.getAttribute('data-djr-page') || '';
    var nav = document.querySelector('.djr-nav');
    if (nav && site.nav) {
      nav.innerHTML = site.nav
        .map(function (item) {
          var active = item.key === page ? ' class="is-active"' : '';
          return '<a href="' + esc(item.href) + '"' + active + '>' + esc(item.label) + '</a>';
        })
        .join('\n');
    }

    var book = document.querySelector('.djr-header-cta');
    if (book && site.bookButton) {
      book.href = site.bookButton.href;
      book.textContent = site.bookButton.label;
    }

    renderFooter(site);
  }

  function renderFooter(site) {
    var footer = document.querySelector('.djr-footer');
    if (!footer) return;
    var brand = site.brand || {};
    var contact = site.contact || {};
    var partner = site.partner || {};

    var partnerHtml = '';
    if (partner.enabled !== false && partner.logo) {
      partnerHtml =
        '<div class="djr-footer-partner">' +
        '<span>' + esc(partner.label || '') + '</span>' +
        '<a href="' + esc(partner.href || '#') + '" rel="noopener" target="_blank">' +
        '<img src="' + esc(partner.logo) + '" alt="' + esc(partner.alt || '') + '"/></a></div>';
    }

    footer.innerHTML =
      '<div class="djr-container">' +
      '<div class="djr-footer-grid">' +
      '<div>' +
      '<span class="djr-wordmark">' + esc(brand.wordmark || 'DJR') + '</span>' +
      '<div class="djr-footer-brandsub">' + esc(brand.name || '') + ' ' + esc(brand.tagline || '') + '</div>' +
      '</div>' +
      '<div><h4>Contact</h4><ul>' +
      (contact.phone ? '<li><a href="tel:' + esc(contact.phoneTel || contact.phone) + '">📞 ' + esc(contact.phone) + '</a></li>' : '') +
      (contact.email ? '<li><a href="mailto:' + esc(contact.email) + '">✉ ' + esc(contact.email) + '</a></li>' : '') +
      (contact.location ? '<li>📍 ' + esc(contact.location) + '</li>' : '') +
      '</ul></div>' +
      '<div><h4>Follow</h4><div class="djr-social">' +
      (site.social || [])
        .map(function (s) {
          return '<a href="' + esc(s.href) + '" aria-label="' + esc(s.label) + '" rel="noopener" target="_blank">' + esc(s.icon) + '</a>';
        })
        .join('') +
      '</div></div>' +
      '<div><h4>Quick Links</h4><ul>' +
      (site.quickLinks || [])
        .map(function (l) {
          return '<li><a href="' + esc(l.href) + '">' + esc(l.label) + '</a></li>';
        })
        .join('') +
      '</ul></div>' +
      partnerHtml +
      '</div>' +
      '<div class="djr-footer-bottom">' + esc(site.footerCopyright || '') + '</div>' +
      '</div>';
  }

  /* ── Homepage ── */

  function renderHome(data) {
    setMeta(data.meta);

    var hero = data.hero || {};
    var heroBg = document.querySelector('.djr-hero-bg');
    if (heroBg) {
      heroBg.style.backgroundImage = hero.backgroundImage ? 'url("' + hero.backgroundImage + '")' : '';
    }
    var tagline = document.querySelector('.djr-hero-tagline');
    if (tagline && hero.tagline) tagline.textContent = hero.tagline;
    var heroActions = document.querySelector('.djr-hero-actions');
    if (heroActions) {
      var btns = [];
      if (hero.primaryButton) {
        btns.push('<a class="djr-btn djr-btn--solid" href="' + esc(hero.primaryButton.href) + '">' + esc(hero.primaryButton.label) + '</a>');
      }
      if (hero.secondaryButton) {
        btns.push('<a class="djr-btn" href="' + esc(hero.secondaryButton.href) + '">' + esc(hero.secondaryButton.label) + '</a>');
      }
      heroActions.innerHTML = btns.join('\n');
    }

    var potw = data.pictureOfTheWeek || {};
    var potwSection = document.querySelector('.djr-potw');
    if (potwSection) {
      potwSection.style.display = potw.enabled === false ? 'none' : '';
      var eyebrow = potwSection.querySelector('.djr-eyebrow');
      if (eyebrow) eyebrow.textContent = potw.eyebrow || '';
      var title = potwSection.querySelector('.djr-potw-title');
      if (title) title.textContent = potw.title || '';
      var body = potwSection.querySelector('.djr-potw-body');
      if (body) body.textContent = potw.body || '';
      var frame = potwSection.querySelector('.djr-potw-frame');
      if (frame) frame.innerHTML = mediaHtml(potw.image, potw.imageAlt, '🌅');
      var btn = potwSection.querySelector('.djr-btn');
      if (btn && potw.button) {
        btn.href = potw.button.href;
        btn.textContent = potw.button.label;
      }
    }

    var services = data.services || {};
    var servicesSection = document.getElementById('services');
    if (servicesSection) {
      var sEyebrow = servicesSection.querySelector('.djr-eyebrow');
      if (sEyebrow) sEyebrow.textContent = services.eyebrow || '';
      var sTitle = servicesSection.querySelector('.djr-h2');
      if (sTitle) sTitle.textContent = services.title || '';
      var grid = servicesSection.querySelector('.djr-services-grid');
      if (grid && services.items) {
        grid.innerHTML = services.items
          .map(function (item) {
            return (
              '<a class="djr-service-card" href="' + esc(item.href || '/djr/galleries.html') + '">' +
              '<div class="djr-service-media">' + mediaHtml(item.image, item.title, item.icon) + '</div>' +
              '<div class="djr-service-body">' +
              '<span class="djr-service-icon" aria-hidden="true">' + esc(item.icon || '📷') + '</span>' +
              '<h3 class="djr-service-title">' + esc(item.title) + '</h3>' +
              '<p class="djr-service-text">' + esc(item.text) + '</p>' +
              '<span class="djr-service-link">Learn More →</span>' +
              '</div></a>'
            );
          })
          .join('\n');
      }
    }

    var about = data.about || {};
    var aboutSection = document.getElementById('about');
    if (aboutSection) {
      aboutSection.style.display = about.enabled === false ? 'none' : '';
      var aEyebrow = aboutSection.querySelector('.djr-eyebrow');
      if (aEyebrow) aEyebrow.textContent = about.eyebrow || '';
      var aTitle = aboutSection.querySelector('.djr-h2');
      if (aTitle) aTitle.textContent = about.title || '';
      var aBody = aboutSection.querySelector('.djr-about-body p');
      if (aBody) aBody.textContent = about.body || '';
      var aPhoto = aboutSection.querySelector('.djr-about-photo');
      if (aPhoto) aPhoto.innerHTML = mediaHtml(about.photo, about.title, '👤');
    }

    var cta = data.cta || {};
    var ctaEl = document.querySelector('.djr-cta');
    if (ctaEl) {
      var cTitle = ctaEl.querySelector('.djr-cta-title');
      if (cTitle) cTitle.textContent = cta.title || '';
      var cSub = ctaEl.querySelector('.djr-cta-sub');
      if (cSub) cSub.textContent = cta.sub || '';
      var cBtn = ctaEl.querySelector('.djr-btn');
      if (cBtn && cta.button) {
        cBtn.href = cta.button.href;
        cBtn.textContent = cta.button.label;
      }
    }
  }

  /* ── Galleries page (static copy; the grid itself is rendered by djr-galleries.js) ── */

  function renderGalleriesPage(data) {
    setMeta(data.meta);
    var hero = data.hero || {};
    var eyebrow = document.querySelector('.djr-page-hero .djr-eyebrow');
    if (eyebrow) eyebrow.textContent = hero.eyebrow || '';
    var title = document.querySelector('.djr-page-hero .djr-h2');
    if (title) title.textContent = hero.title || '';
    var intro = document.querySelector('.djr-page-hero p');
    if (intro) intro.textContent = hero.intro || '';
  }

  /* ── Contact page ── */

  function renderContact(data, site) {
    setMeta(data.meta);
    var hero = data.hero || {};
    var eyebrow = document.querySelector('.djr-page-hero .djr-eyebrow');
    if (eyebrow) eyebrow.textContent = hero.eyebrow || '';
    var title = document.querySelector('.djr-page-hero .djr-h2');
    if (title) title.textContent = hero.title || '';
    var intro = document.querySelector('.djr-page-hero p');
    if (intro) intro.textContent = hero.intro || '';

    var form = document.querySelector('.djr-form');
    if (form && data.formAction) form.setAttribute('action', data.formAction);

    var select = document.getElementById('djr-session-type');
    if (select && data.sessionTypes) {
      select.innerHTML = data.sessionTypes
        .map(function (t) {
          return '<option value="' + esc(t) + '">' + esc(t) + '</option>';
        })
        .join('');
    }

    var sidebar = data.sidebar || {};
    var contact = (site && site.contact) || {};
    var cards = document.querySelector('.djr-contact-aside');
    if (cards) {
      cards.innerHTML =
        '<div class="djr-info-card"><h3>Contact</h3>' +
        (contact.phone ? '<p><a href="tel:' + esc(contact.phoneTel || contact.phone) + '">📞 ' + esc(contact.phone) + '</a></p>' : '') +
        (contact.email ? '<p><a href="mailto:' + esc(contact.email) + '">✉ ' + esc(contact.email) + '</a></p>' : '') +
        (contact.location ? '<p>📍 ' + esc(contact.location) + '</p>' : '') +
        '</div>' +
        '<div class="djr-info-card"><h3>' + esc(sidebar.availabilityTitle || 'Availability') + '</h3>' +
        '<p>' + esc(sidebar.availabilityBody || '') + '</p></div>' +
        '<div class="djr-info-card"><h3>' + esc(sidebar.responseTitle || 'Response Time') + '</h3>' +
        '<p>' + esc(sidebar.responseBody || '') + '</p></div>';
    }
  }

  /* ── Mobile nav toggle ── */

  function initNavToggle() {
    var toggle = document.querySelector('.djr-nav-toggle');
    var nav = document.querySelector('.djr-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ── Init ── */

  function init() {
    initNavToggle();
    var page = document.body.getAttribute('data-djr-page');
    if (!page) return Promise.resolve();

    return fetchJson('/content/djr/site.json').then(function (site) {
      renderChrome(site);
      if (page === 'home') {
        return fetchJson('/content/djr/home.json').then(renderHome);
      }
      if (page === 'galleries') {
        return fetchJson('/content/djr/galleries.json').then(renderGalleriesPage);
      }
      if (page === 'contact') {
        return fetchJson('/content/djr/contact.json').then(function (data) {
          renderContact(data, site);
        });
      }
      return undefined;
    });
  }

  global.DJRContent = { fetchJson: fetchJson, init: init, esc: esc, mediaHtml: mediaHtml };

  document.addEventListener('DOMContentLoaded', function () {
    init().catch(function (err) {
      console.warn('[DJRContent] Content sync skipped:', err.message);
    });
  });
})(window);
