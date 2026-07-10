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

  function mediaHtml(src, alt, fallback) {
    if (src) return '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" loading="lazy" decoding="async"/>';
    return '<div class="djr-placeholder" aria-hidden="true">' + esc(fallback || 'Photo') + '</div>';
  }

  function renderChrome(site) {
    var brand = site.brand || {};
    document.querySelectorAll('.djr-brand .djr-wordmark').forEach(function (el) {
      el.textContent = brand.wordmark || 'DJR';
    });
    document.querySelectorAll('.djr-brand-sub').forEach(function (el) {
      el.textContent = (brand.name || '') + ' ' + (brand.tagline || '');
    });

    var page = document.body.getAttribute('data-djr-page') || '';
    var nav = document.querySelector('.djr-nav');
    if (nav && site.nav) {
      nav.innerHTML = site.nav.map(function (item) {
        var active = item.key === page ? ' class="is-active"' : '';
        return '<a href="' + esc(item.href) + '"' + active + '>' + esc(item.label) + '</a>';
      }).join('\n');
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
    var social = (site.social || []).map(function (s) {
      return '<a href="' + esc(s.href) + '" aria-label="' + esc(s.label) + '" rel="noopener" target="_blank">' + esc(s.icon) + '</a>';
    }).join('');
    var quickLinks = (site.quickLinks || []).map(function (l) {
      return '<li><a href="' + esc(l.href) + '">' + esc(l.label) + '</a></li>';
    }).join('');
    var partnerHtml = partner.enabled !== false && partner.logo
      ? '<div class="djr-footer-partner"><span>' + esc(partner.label || '') + '</span><a href="' + esc(partner.href || '#') + '" rel="noopener" target="_blank"><img src="' + esc(partner.logo) + '" alt="' + esc(partner.alt || '') + '"/></a></div>'
      : '';

    footer.innerHTML =
      '<div class="djr-container"><div class="djr-footer-grid">' +
      '<div><span class="djr-wordmark">' + esc(brand.wordmark || 'DJR') + '</span><div class="djr-footer-brandsub">' + esc(brand.name || '') + ' ' + esc(brand.tagline || '') + '</div></div>' +
      '<div><h4>Contact</h4><ul>' +
      (contact.phone ? '<li><a href="tel:' + esc(contact.phoneTel || contact.phone) + '">' + esc(contact.phone) + '</a></li>' : '') +
      (contact.email ? '<li><a href="mailto:' + esc(contact.email) + '">' + esc(contact.email) + '</a></li>' : '') +
      (contact.location ? '<li>' + esc(contact.location) + '</li>' : '') +
      '</ul></div>' +
      '<div><h4>Follow</h4><div class="djr-social">' + social + '</div></div>' +
      '<div><h4>Quick Links</h4><ul>' + quickLinks + '</ul></div>' +
      partnerHtml +
      '</div><div class="djr-footer-bottom">' + esc(site.footerCopyright || '') + '</div></div>';
  }

  function renderHome(data) {
    setMeta(data.meta);

    var hero = data.hero || {};
    var heroBg = document.querySelector('.djr-hero-bg');
    if (heroBg) heroBg.style.backgroundImage = hero.backgroundImage ? 'url("' + hero.backgroundImage + '")' : '';
    var heroLogo = document.querySelector('.djr-hero-logo');
    if (heroLogo && hero.logoImage) heroLogo.innerHTML = '<img src="' + esc(hero.logoImage) + '" alt="' + esc(hero.logoAlt || 'DJR Photography') + '"/>';
    var tagline = document.querySelector('.djr-hero-tagline');
    if (tagline) tagline.textContent = hero.tagline || '';
    var heroActions = document.querySelector('.djr-hero-actions');
    if (heroActions) {
      heroActions.innerHTML =
        (hero.primaryButton ? '<a class="djr-btn djr-btn--solid" href="' + esc(hero.primaryButton.href) + '">' + esc(hero.primaryButton.label) + '</a>' : '') +
        (hero.secondaryButton ? '<a class="djr-btn" href="' + esc(hero.secondaryButton.href) + '">' + esc(hero.secondaryButton.label) + '</a>' : '');
    }

    var story = data.story || {};
    var storySection = document.querySelector('.djr-story');
    if (storySection) {
      storySection.style.display = story.enabled === false ? 'none' : '';
      var st = storySection;
      st.querySelector('.djr-eyebrow').textContent = story.eyebrow || '';
      st.querySelector('.djr-h2').textContent = story.title || '';
      st.querySelector('.djr-story-lead').textContent = story.lead || '';
      st.querySelector('.djr-story-body').textContent = story.body || '';
      st.querySelector('.djr-story-quote').textContent = story.quote || '';
      var collage = st.querySelector('.djr-story-collage');
      if (collage && story.images) {
        collage.innerHTML = story.images.map(function (image, index) {
          return '<figure class="djr-story-photo djr-story-photo--' + (index + 1) + '"><img src="' + esc(image.src) + '" alt="' + esc(image.alt || '') + '" loading="lazy" decoding="async"/>' + (image.caption ? '<figcaption>' + esc(image.caption) + '</figcaption>' : '') + '</figure>';
        }).join('\n');
      }
    }

    var potw = data.pictureOfTheWeek || {};
    var potwSection = document.querySelector('.djr-potw');
    if (potwSection) {
      potwSection.style.display = potw.enabled === false ? 'none' : '';
      potwSection.querySelector('.djr-eyebrow').textContent = potw.eyebrow || '';
      potwSection.querySelector('.djr-potw-title').textContent = potw.title || '';
      potwSection.querySelector('.djr-potw-body').textContent = potw.body || '';
      potwSection.querySelector('.djr-potw-frame').innerHTML = mediaHtml(potw.image, potw.imageAlt, 'Photo');
      var potwButton = potwSection.querySelector('.djr-btn');
      if (potwButton && potw.button) {
        potwButton.href = potw.button.href;
        potwButton.textContent = potw.button.label;
      }
    }

    var services = data.services || {};
    var servicesSection = document.getElementById('services');
    if (servicesSection) {
      servicesSection.querySelector('.djr-eyebrow').textContent = services.eyebrow || '';
      servicesSection.querySelector('.djr-h2').textContent = services.title || '';
      var grid = servicesSection.querySelector('.djr-services-grid');
      if (grid) {
        grid.innerHTML = (services.items || []).map(function (item) {
          return '<a class="djr-service-card" href="' + esc(item.href || '/djr/galleries.html') + '"><div class="djr-service-media">' + mediaHtml(item.image, item.title, item.icon) + '</div><div class="djr-service-body"><span class="djr-service-icon">' + esc(item.icon || 'Photo') + '</span><h3 class="djr-service-title">' + esc(item.title) + '</h3><p class="djr-service-text">' + esc(item.text) + '</p><span class="djr-service-link">Learn More</span></div></a>';
        }).join('\n');
      }
    }

    var creative = data.creativeFeature || {};
    var creativeSection = document.querySelector('.djr-creative-feature');
    if (creativeSection) {
      creativeSection.style.display = creative.enabled === false ? 'none' : '';
      creativeSection.querySelector('.djr-eyebrow').textContent = creative.eyebrow || '';
      creativeSection.querySelector('.djr-h2').textContent = creative.title || '';
      creativeSection.querySelector('.djr-creative-body').textContent = creative.body || '';
      var crImages = creativeSection.querySelector('.djr-creative-images');
      if (crImages) crImages.innerHTML = (creative.images || []).map(function (image) {
        return '<img src="' + esc(image.src) + '" alt="' + esc(image.alt || '') + '" loading="lazy" decoding="async"/>';
      }).join('\n');
    }

    var about = data.about || {};
    var aboutSection = document.getElementById('about');
    if (aboutSection) {
      aboutSection.style.display = about.enabled === false ? 'none' : '';
      aboutSection.querySelector('.djr-eyebrow').textContent = about.eyebrow || '';
      aboutSection.querySelector('.djr-h2').textContent = about.title || '';
      aboutSection.querySelector('.djr-about-body p').textContent = about.body || '';
      aboutSection.querySelector('.djr-about-photo').innerHTML = mediaHtml(about.photo, about.title, 'David');
    }

    var cta = data.cta || {};
    var ctaEl = document.querySelector('.djr-cta');
    if (ctaEl) {
      ctaEl.querySelector('.djr-cta-title').textContent = cta.title || '';
      ctaEl.querySelector('.djr-cta-sub').textContent = cta.sub || '';
      var ctaButton = ctaEl.querySelector('.djr-btn');
      if (ctaButton && cta.button) {
        ctaButton.href = cta.button.href;
        ctaButton.textContent = cta.button.label;
      }
    }
  }

  function renderGalleriesPage(data) {
    setMeta(data.meta);
    var hero = data.hero || {};
    var section = document.querySelector('.djr-page-hero');
    if (!section) return;
    section.querySelector('.djr-eyebrow').textContent = hero.eyebrow || '';
    section.querySelector('.djr-h2').textContent = hero.title || '';
    section.querySelector('p:not(.djr-eyebrow)').textContent = hero.intro || '';
  }

  function renderContact(data, site) {
    setMeta(data.meta);
    var hero = data.hero || {};
    var section = document.querySelector('.djr-page-hero');
    if (section) {
      section.querySelector('.djr-eyebrow').textContent = hero.eyebrow || '';
      section.querySelector('.djr-h2').textContent = hero.title || '';
      section.querySelector('p:not(.djr-eyebrow)').textContent = hero.intro || '';
    }
    var form = document.querySelector('.djr-form');
    if (form && data.formAction) form.action = data.formAction;
    var select = document.getElementById('djr-session-type');
    if (select) {
      select.innerHTML = (data.sessionTypes || []).map(function (t) {
        return '<option value="' + esc(t) + '">' + esc(t) + '</option>';
      }).join('');
    }
    var contact = (site && site.contact) || {};
    var sidebar = data.sidebar || {};
    var aside = document.querySelector('.djr-contact-aside');
    if (aside) {
      aside.innerHTML =
        '<div class="djr-info-card"><h3>Contact</h3>' +
        (contact.phone ? '<p><a href="tel:' + esc(contact.phoneTel || contact.phone) + '">' + esc(contact.phone) + '</a></p>' : '') +
        (contact.email ? '<p><a href="mailto:' + esc(contact.email) + '">' + esc(contact.email) + '</a></p>' : '') +
        (contact.location ? '<p>' + esc(contact.location) + '</p>' : '') +
        '</div><div class="djr-info-card"><h3>' + esc(sidebar.availabilityTitle || 'Availability') + '</h3><p>' + esc(sidebar.availabilityBody || '') + '</p></div>' +
        '<div class="djr-info-card"><h3>' + esc(sidebar.responseTitle || 'Response Time') + '</h3><p>' + esc(sidebar.responseBody || '') + '</p></div>';
    }
  }

  function initNavToggle() {
    var toggle = document.querySelector('.djr-nav-toggle');
    var nav = document.querySelector('.djr-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function init() {
    initNavToggle();
    var page = document.body.getAttribute('data-djr-page');
    if (!page) return Promise.resolve();
    return fetchJson('/content/djr/site.json').then(function (site) {
      renderChrome(site);
      if (page === 'home') return fetchJson('/content/djr/home.json').then(renderHome);
      if (page === 'galleries') return fetchJson('/content/djr/galleries.json').then(renderGalleriesPage);
      if (page === 'contact') return fetchJson('/content/djr/contact.json').then(function (data) { renderContact(data, site); });
    });
  }

  global.DJRContent = { fetchJson: fetchJson, esc: esc, init: init };
  document.addEventListener('DOMContentLoaded', function () {
    init().catch(function (err) { console.warn('[DJRContent] Content sync skipped:', err.message); });
  });
})(window);
