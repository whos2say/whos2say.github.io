/**
 * Full-page renderers for content-only pages (Creative Workshops, Support Coordinators).
 * Loaded after render.js; uses existing program-page CSS patterns.
 */
(function (global) {
  'use strict';

  function headerHtml() {
    return (
      '<header class="site-header"><div class="header-inner">' +
      '<a aria-label="Who\'s to Say ? Foundation Home" class="brand" href="/">' +
      '<img alt="" class="brand-logo logo-dark" src="/assets/images/logo-white-dark.png"/>' +
      '<img alt="" class="brand-logo logo-light" src="/assets/images/logo-black-light.png"/>' +
      '</a><nav aria-label="Primary navigation" class="site-nav">' +
      '<a class="nav-link" href="/">Home</a>' +
      '<a class="nav-link" href="/programs.html">Programs</a>' +
      '<a class="nav-link" href="/creative-workshops.html">Creative Workshops</a>' +
      '<a class="nav-link" href="https://givebutter.com/whostosayfoundation" rel="noopener" target="_blank">Donate</a>' +
      '<a class="nav-link" href="/contact.html">Contact</a>' +
      '</nav><div class="header-actions">' +
      '<button aria-label="Toggle theme" aria-pressed="false" class="theme-toggle" type="button"></button>' +
      '</div></div></header>'
    );
  }

  function footerHtml() {
    return (
      '<footer class="site-footer">© <span id="year"></span> Who\'s to Say ? Foundation</footer>' +
      '<script>document.getElementById("year").textContent=new Date().getFullYear();<\/script>'
    );
  }

  function renderCreativeWorkshops(data) {
    document.title = data.meta.title;
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = data.meta.description;

    var workshops = data.workshops
      .map(function (w) {
        return (
          '<div class="program-card" style="pointer-events:none">' +
          '<div class="card-content"><h3>' + w.title + '</h3><p>' + w.summary + '</p></div></div>'
        );
      })
      .join('');

    var tiers = data.pricing.tiers
      .map(function (t) {
        return (
          '<div class="how-card">' +
          '<h3>' + t.name + '</h3>' +
          '<p class="rate-price">' + t.price + '</p>' +
          '<p>' + t.description + '</p></div>'
        );
      })
      .join('');

    var steps = data.howSessionsWork.steps
      .map(function (s, i) {
        return (
          '<div class="how-card">' +
          '<div class="how-icon" aria-hidden="true">' + (i + 1) + '</div>' +
          '<h3>' + s.title + '</h3><p>' + s.body + '</p></div>'
        );
      })
      .join('');

    document.body.innerHTML =
      '<a class="skip-link" href="#main">Skip to content</a>' +
      headerHtml() +
      '<main class="program-page" id="main">' +
      '<section class="program-hero contact-hero">' +
      '<div class="program-hero-card"><div class="program-hero-body">' +
      '<p class="home-kicker">' + data.hero.kicker + '</p>' +
      '<h1>' + data.hero.title + '</h1>' +
      '<p class="program-subtitle">' + data.hero.subtitle + '</p>' +
      '<div class="pills">' +
      data.hero.pills.map(function (p) {
        return '<span class="pill">' + p + '</span>';
      }).join('') +
      '</div></div></div></section>' +
      '<section class="program-shell"><article class="program-content">' +
      '<section class="program-section"><h2>Workshop Menu</h2><div class="program-grid">' + workshops + '</div></section>' +
      '<section class="program-section"><h2>' + data.pricing.title + '</h2><p>' + data.pricing.intro + '</p>' +
      '<div class="how-grid how-grid--4">' + tiers + '</div></section>' +
      '<section class="program-section"><h2>' + data.howSessionsWork.title + '</h2>' +
      '<div class="how-grid how-grid--4">' + steps + '</div></section>' +
      '<section class="program-section"><h2>' + data.inclusiveSection.title + '</h2><p>' + data.inclusiveSection.body + '</p></section>' +
      '<section class="program-section cw-note"><h2>' + data.fundingNote.title + '</h2><p>' + data.fundingNote.body + '</p>' +
      '<a href="' + data.fundingNote.linkHref + '">' + data.fundingNote.linkLabel + '</a></section>' +
      '<section class="program-section"><h2>' + data.makerSpace.title + '</h2><p>' + data.makerSpace.body + '</p>' +
      '<a class="btn btn-primary" href="' + data.makerSpace.ctaHref + '"' +
      (data.makerSpace.ctaExternal ? ' target="_blank" rel="noopener"' : '') + '>' + data.makerSpace.ctaLabel + '</a></section>' +
      '<section class="program-section cw-cta"><h2>' + data.finalCta.title + '</h2><p>' + data.finalCta.body + '</p>' +
      '<a class="btn btn-primary" href="' + data.finalCta.primaryHref + '">' + data.finalCta.primaryLabel + '</a> ' +
      '<a class="btn btn-secondary" href="' + data.finalCta.secondaryHref + '">' + data.finalCta.secondaryLabel + '</a></section>' +
      '</article></section></main>' +
      footerHtml();

    var theme = document.createElement('script');
    theme.src = '/assets/js/theme.js';
    document.body.appendChild(theme);
  }

  function renderSupportCoordinators(data) {
    document.title = data.meta.title;
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = data.meta.description;

    var samples = data.sampleDescriptions
      .map(function (s) {
        return '<section class="program-section"><h3>' + s.title + '</h3><p>' + s.body + '</p></section>';
      })
      .join('');

    var invoices = data.invoiceDescriptions
      .map(function (s) {
        return '<div class="program-sidebar-card"><h3>' + s.title + '</h3><p>' + s.body + '</p></div>';
      })
      .join('');

    document.body.innerHTML =
      '<a class="skip-link" href="#main">Skip to content</a>' +
      headerHtml() +
      '<main class="program-page" id="main">' +
      '<section class="program-hero contact-hero"><div class="program-hero-card"><div class="program-hero-body">' +
      '<h1>' + data.hero.title + '</h1>' +
      '<p class="program-subtitle">' + data.hero.subtitle + '</p>' +
      '<div class="pills">' +
      data.hero.pills.map(function (p) {
        return '<span class="pill">' + p + '</span>';
      }).join('') +
      '</div></div></div></section>' +
      '<section class="program-shell program-shell--6040">' +
      '<article class="program-content">' +
      '<section class="program-section"><h2>' + data.whatWeProvide.title + '</h2><p>' + data.whatWeProvide.intro + '</p><ul>' +
      data.whatWeProvide.items.map(function (i) {
        return '<li>' + i + '</li>';
      }).join('') +
      '</ul></section>' + samples +
      '<section class="program-section"><h2>' + data.documentation.title + '</h2><ul>' +
      data.documentation.items.map(function (i) {
        return '<li>' + i + '</li>';
      }).join('') +
      '</ul></section>' +
      '<section class="program-section"><h2>' + data.fundingNote.title + '</h2><p>' + data.fundingNote.body + '</p></section>' +
      '<section class="program-section"><h2>' + data.nextPhase.title + '</h2><p>' + data.nextPhase.body + '</p></section>' +
      '<section class="program-section cw-cta"><h2>' + data.finalCta.title + '</h2><p>' + data.finalCta.body + '</p>' +
      '<a class="btn btn-primary" href="' + data.finalCta.primaryHref + '">' + data.finalCta.primaryLabel + '</a> ' +
      '<a class="btn btn-secondary" href="' + data.finalCta.secondaryHref + '">' + data.finalCta.secondaryLabel + '</a></section>' +
      '</article><aside class="program-sidebar">' +
      '<div class="program-sidebar-card"><h3>' + data.sidebar.contactTitle + '</h3><p>' + data.sidebar.contactIntro + '</p>' +
      '<ul class="contact-list"><li><a href="mailto:info@whostosay.org">info@whostosay.org</a></li>' +
      '<li><a href="tel:+17323141943">(732) 314-1943</a></li></ul></div>' +
      '<div class="program-sidebar-card"><h3>' + data.sidebar.quickReferenceTitle + '</h3><ul>' +
      data.sidebar.quickReferenceItems.map(function (i) {
        return '<li>' + i + '</li>';
      }).join('') +
      '</ul></div>' +
      '<div class="program-sidebar-card"><h3>' + data.sidebar.fundingCardTitle + '</h3><p>' + data.sidebar.fundingCardBody + '</p></div>' +
      invoices +
      '</aside></section></main>' +
      footerHtml();

    var theme = document.createElement('script');
    theme.src = '/assets/js/theme.js';
    document.body.appendChild(theme);
  }

  global.W2SContentRenderFullPage = function (page, data) {
    if (page === 'creative-workshops') renderCreativeWorkshops(data);
    if (page === 'support-coordinators') renderSupportCoordinators(data);
  };
})(window);
