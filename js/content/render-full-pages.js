/**
 * Full-page renderers for content-only pages (Creative Workshops, Support Coordinators).
 * Markup follows contact.html / program detail page patterns.
 */
(function (global) {
  'use strict';

  var HERO_IMAGE_WORKSHOPS = '/assets/images/Maker_space.png';
  var HERO_IMAGE_COORDINATORS = '/assets/images/Abstract_Program-hero.png';

  function headerHtml() {
    return (
      '<header class="site-header"><div class="header-inner">' +
      '<a aria-label="Who\'s to Say ? Foundation Home" class="brand" href="/">' +
      '<img alt="" class="brand-logo logo-dark" src="/assets/images/logo-white-dark.png"/>' +
      '<img alt="" class="brand-logo logo-light" src="/assets/images/logo-black-light.png"/>' +
      '</a><nav aria-label="Primary navigation" class="site-nav">' +
      '<a class="nav-link" href="/">Home</a>' +
      '<a class="nav-link" href="/programs.html">Programs</a>' +
      '<a class="nav-link" href="https://givebutter.com/whostosayfoundation" rel="noopener" target="_blank">Donate</a>' +
      '<a class="nav-link" href="/contact.html">Contact</a>' +
      '</nav><div class="header-actions">' +
      '<button aria-label="Toggle theme" aria-pressed="false" class="theme-toggle" type="button"></button>' +
      '</div></div></header>' +
      '<nav data-page-subnav class="page-subnav" aria-label="Page sections" hidden></nav>'
    );
  }

  function footerHtml() {
    return (
      '<footer class="site-footer">' +
      '<nav data-footer-nav class="footer-nav" aria-label="Footer navigation" hidden></nav>' +
      '© <span id="year"></span> Who\'s to Say ? Foundation</footer>' +
      '<script>document.getElementById("year").textContent=new Date().getFullYear();<\/script>'
    );
  }

  function pillsHtml(items) {
    return (items || [])
      .map(function (p) {
        return '<span class="pill">' + p + '</span>';
      })
      .join('');
  }

  function heroHtml(options) {
    return (
      '<section class="program-hero contact-hero"' +
      (options.id ? ' id="' + options.id + '"' : '') +
      '>' +
      '<div class="program-hero-card">' +
      '<div class="program-hero-media contact-hero-media">' +
      '<img src="' +
      options.imageSrc +
      '" alt="" loading="lazy" decoding="async"/>' +
      '</div>' +
      '<div class="program-hero-body">' +
      options.breadcrumb +
      (options.kicker ? '<p class="home-kicker">' + options.kicker + '</p>' : '') +
      '<h1>' +
      options.title +
      '</h1>' +
      '<p class="program-subtitle">' +
      options.subtitle +
      '</p>' +
      '<div class="pills">' +
      pillsHtml(options.pills) +
      '</div>' +
      '</div></div></section>'
    );
  }

  function appendPageScripts() {
    if (global.W2SEnvironment && global.W2SEnvironment.init) {
      global.W2SEnvironment.init();
    }
    var navPromise =
      global.W2SNavigation && global.W2SNavigation.init
        ? global.W2SNavigation.init()
        : Promise.resolve();
    navPromise.finally(function () {
      if (global.WTSTheme && global.WTSTheme.reinitAfterDynamicRender) {
        global.WTSTheme.reinitAfterDynamicRender();
      }
    });
  }

  function renderCreativeWorkshops(data) {
    document.title = data.meta.title;
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = data.meta.description;

    document.body.classList.add('content-page');

    var workshopsEnabled = data.workshopsEnabled !== false;
    var pricingEnabled = data.pricing.enabled !== false;
    var fundingNoteEnabled = data.fundingNote.enabled !== false;
    var finalCtaEnabled = data.finalCta.enabled !== false;

    global.W2SPageSectionVisibility = {
      page: 'creative-workshops',
      sections: {
        'workshop-menu': workshopsEnabled,
        pricing: pricingEnabled,
        funding: fundingNoteEnabled,
        'final-cta': finalCtaEnabled,
      },
    };

    var workshops = workshopsEnabled ? data.workshops
      .map(function (w) {
        return (
          '<div class="program-card program-card--static">' +
          '<div class="card-content"><h3>' +
          w.title +
          '</h3><p>' +
          w.summary +
          '</p></div></div>'
        );
      })
      .join('') : '';

    var tiers = pricingEnabled ? data.pricing.tiers
      .map(function (t) {
        return (
          '<div class="how-card">' +
          '<h3>' +
          t.name +
          '</h3>' +
          '<p class="rate-price">' +
          t.price +
          '</p>' +
          '<p>' +
          t.description +
          '</p></div>'
        );
      })
      .join('') : '';

    var steps = data.howSessionsWork.steps
      .map(function (s, i) {
        return (
          '<div class="how-card">' +
          '<div class="how-icon" aria-hidden="true">' +
          (i + 1) +
          '</div>' +
          '<h3>' +
          s.title +
          '</h3><p>' +
          s.body +
          '</p></div>'
        );
      })
      .join('');

    document.body.innerHTML =
      '<a class="skip-link" href="#main">Skip to content</a>' +
      headerHtml() +
      '<main class="program-page content-page" id="main">' +
      heroHtml({
        id: 'overview',
        imageSrc: HERO_IMAGE_WORKSHOPS,
        breadcrumb:
          '<div class="breadcrumb"><a href="/programs.html">Programs</a><span>›</span><span>Creative Workshops</span></div>',
        kicker: data.hero.kicker,
        title: data.hero.title,
        subtitle: data.hero.subtitle,
        pills: data.hero.pills,
      }) +
      '<section class="program-shell content-page-shell">' +
      '<article class="program-content">' +
      (workshopsEnabled ? '<section class="program-section content-page-section" id="workshop-menu"><h2>Workshop Menu</h2><div class="program-grid content-page-grid">' +
      workshops +
      '</div></section>' : '') +
      '<section class="program-section content-page-section" id="class-sessions">' +
      '<h2>' + (data.classSchedule ? data.classSchedule.title : 'Available Class Sessions') + '</h2>' +
      '<p class="class-sessions-intro">' + (data.classSchedule ? data.classSchedule.intro : 'Open to adults with and without disabilities. Small class size, maximum 3 participants.') + '</p>' +
      '<div id="class-sessions-list" class="class-sessions-list"></div>' +
      '</section>' +
      (pricingEnabled ? '<section class="program-section content-page-section" id="pricing"><h2>' +
      data.pricing.title +
      '</h2><p>' +
      data.pricing.intro +
      '</p>' +
      '<div class="how-grid how-grid--4">' +
      tiers +
      '</div></section>' : '') +
      '<section class="program-section content-page-section" id="session-flow"><h2>' +
      data.howSessionsWork.title +
      '</h2>' +
      '<div class="how-grid how-grid--4">' +
      steps +
      '</div></section>' +
      '<section class="program-section content-page-section"><h2>' +
      data.inclusiveSection.title +
      '</h2><p>' +
      data.inclusiveSection.body +
      '</p></section>' +
      (fundingNoteEnabled ? '<section class="program-section content-page-section cw-note" id="funding"><h2>' +
      data.fundingNote.title +
      '</h2><p>' +
      data.fundingNote.body +
      '</p>' +
      '<a href="' +
      data.fundingNote.linkHref +
      '">' +
      data.fundingNote.linkLabel +
      '</a></section>' : '') +
      '<section class="program-section content-page-section"><h2>' +
      data.makerSpace.title +
      '</h2><p>' +
      data.makerSpace.body +
      '</p>' +
      '<a class="btn btn-primary" href="' +
      data.makerSpace.ctaHref +
      '"' +
      (data.makerSpace.ctaExternal ? ' target="_blank" rel="noopener"' : '') +
      '>' +
      data.makerSpace.ctaLabel +
      '</a></section>' +
      (finalCtaEnabled ? '<section class="program-section content-page-section cw-cta"><h2>' +
      data.finalCta.title +
      '</h2><p>' +
      data.finalCta.body +
      '</p>' +
      '<a class="btn btn-primary" href="' +
      data.finalCta.primaryHref +
      '">' +
      data.finalCta.primaryLabel +
      '</a> ' +
      '<a class="btn btn-secondary" href="' +
      data.finalCta.secondaryHref +
      '">' +
      data.finalCta.secondaryLabel +
      '</a></section>' : '') +
      '</article></section></main>' +
      footerHtml();

    appendPageScripts();
    document.dispatchEvent(new CustomEvent('w2s:page-rendered', { detail: { page: 'creative-workshops' } }));
  }

  function renderSupportCoordinators(data) {
    document.title = data.meta.title;
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = data.meta.description;

    document.body.classList.add('content-page');

    var samples = data.sampleDescriptions
      .map(function (s) {
        return (
          '<section class="program-section content-page-section"><h3>' +
          s.title +
          '</h3><p>' +
          s.body +
          '</p></section>'
        );
      })
      .join('');

    var invoices = data.invoiceDescriptions
      .map(function (s) {
        return (
          '<div class="program-sidebar-card"><h3>' +
          s.title +
          '</h3><p>' +
          s.body +
          '</p></div>'
        );
      })
      .join('');

    document.body.innerHTML =
      '<a class="skip-link" href="#main">Skip to content</a>' +
      headerHtml() +
      '<main class="program-page content-page contact-page" id="main">' +
      heroHtml({
        id: 'overview',
        imageSrc: HERO_IMAGE_COORDINATORS,
        breadcrumb:
          '<div class="breadcrumb"><a href="/programs.html">Programs</a><span>›</span><span>For Coordinators</span></div>',
        title: data.hero.title,
        subtitle: data.hero.subtitle,
        pills: data.hero.pills,
      }) +
      '<section class="program-shell program-shell--6040 content-page-shell">' +
      '<article class="program-content">' +
      '<section class="program-section content-page-section" id="what-we-provide"><h2>' +
      data.whatWeProvide.title +
      '</h2><p>' +
      data.whatWeProvide.intro +
      '</p><ul>' +
      data.whatWeProvide.items
        .map(function (i) {
          return '<li>' + i + '</li>';
        })
        .join('') +
      '</ul></section>' +
      '<div id="samples">' +
      samples +
      '</div>' +
      '<section class="program-section content-page-section"><h2>' +
      data.documentation.title +
      '</h2><ul>' +
      data.documentation.items
        .map(function (i) {
          return '<li>' + i + '</li>';
        })
        .join('') +
      '</ul></section>' +
      '<section class="program-section content-page-section cw-note" id="funding"><h2>' +
      data.fundingNote.title +
      '</h2><p>' +
      data.fundingNote.body +
      '</p></section>' +
      '<section class="program-section content-page-section"><h2>' +
      data.nextPhase.title +
      '</h2><p>' +
      data.nextPhase.body +
      '</p></section>' +
      '<section class="program-section content-page-section cw-cta"><h2>' +
      data.finalCta.title +
      '</h2><p>' +
      data.finalCta.body +
      '</p>' +
      '<a class="btn btn-primary" href="' +
      data.finalCta.primaryHref +
      '">' +
      data.finalCta.primaryLabel +
      '</a> ' +
      '<a class="btn btn-secondary" href="' +
      data.finalCta.secondaryHref +
      '">' +
      data.finalCta.secondaryLabel +
      '</a></section>' +
      '</article><aside class="program-sidebar">' +
      '<div class="program-sidebar-card"><h3>' +
      data.sidebar.contactTitle +
      '</h3><p>' +
      data.sidebar.contactIntro +
      '</p>' +
      '<ul class="contact-list"><li><a href="mailto:info@whostosay.org">info@whostosay.org</a></li>' +
      '<li><a href="tel:+17323141943">(732) 314-1943</a></li></ul></div>' +
      '<div class="program-sidebar-card"><h3>' +
      data.sidebar.quickReferenceTitle +
      '</h3><ul>' +
      data.sidebar.quickReferenceItems
        .map(function (i) {
          return '<li>' + i + '</li>';
        })
        .join('') +
      '</ul></div>' +
      '<div class="program-sidebar-card"><h3>' +
      data.sidebar.fundingCardTitle +
      '</h3><p>' +
      data.sidebar.fundingCardBody +
      '</p></div>' +
      '<div id="invoice-lines">' +
      invoices +
      '</div>' +
      '</aside></section></main>' +
      footerHtml();

    appendPageScripts();
  }

  global.W2SContentRenderFullPage = function (page, data) {
    if (page === 'creative-workshops') renderCreativeWorkshops(data);
    if (page === 'support-coordinators') renderSupportCoordinators(data);
  };
})(window);
