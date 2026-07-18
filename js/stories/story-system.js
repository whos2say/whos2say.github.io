(function () {
  'use strict';

  var MANIFEST_URL = '/content/stories-manifest.json';
  var SPACING_VALUES = ['none', 'tight', 'compact', 'standard', 'spacious'];
  var WIDTH_VALUES = ['narrow', 'standard', 'wide', 'full'];
  var SECTION_TYPES = {
    'rich-text': renderText,
    'image-text': renderImageText,
    quote: renderQuote,
    cards: renderCards,
    steps: renderSteps,
    gallery: renderGallery,
    'feature-image': renderFeatureImage,
    callout: renderCallout,
    'final-cta': renderFinalCta
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeHref(value) {
    var href = String(value || '');
    return /^(?:https:\/\/|\/|#)/.test(href) ? href : '#';
  }

  function actionLink(action, secondary) {
    if (!action || !action.label || !action.href) return '';
    var href = safeHref(action.href);
    var external = /^https:\/\//.test(href);
    return '<a class="story-button' + (secondary ? ' story-button--secondary' : '') +
      '" href="' + esc(href) + '"' + (external ? ' target="_blank" rel="noopener"' : '') +
      '>' + esc(action.label) + '</a>';
  }

  function heading(section) {
    return (section.eyebrow ? '<p class="story-eyebrow">' + esc(section.eyebrow) + '</p>' : '') +
      (section.heading ? '<h2>' + esc(section.heading) + '</h2>' : '') +
      (section.lead ? '<p class="story-lead">' + esc(section.lead) + '</p>' : '');
  }

  function paragraphs(items) {
    return (items || []).map(function (text) { return '<p>' + esc(text) + '</p>'; }).join('');
  }

  function layout(section, defaultWidth) {
    var spacing = section.spacing || {};
    var top = SPACING_VALUES.indexOf(spacing.top) >= 0 ? spacing.top : 'compact';
    var bottom = SPACING_VALUES.indexOf(spacing.bottom) >= 0 ? spacing.bottom : 'compact';
    var width = WIDTH_VALUES.indexOf(section.width) >= 0 ? section.width : (defaultWidth || 'standard');
    return {
      section: ' story-space-top--' + top + ' story-space-bottom--' + bottom,
      width: ' story-width--' + width
    };
  }

  function renderText(section) {
    var classes = layout(section, 'narrow');
    return '<section class="story-section' + classes.section + '" id="' + esc(section.id || '') +
      '"><div class="story-wrap story-prose' + classes.width + '">' +
      heading(section) + paragraphs(section.paragraphs) + '</div></section>';
  }

  function renderImageText(section) {
    var classes = layout(section);
    return '<section class="story-section story-section--soft' + classes.section + '" id="' +
      esc(section.id || '') + '"><div class="story-wrap story-split' + classes.width + ' story-split--' +
      esc(section.placement || 'left') + '"><figure><img src="' + esc(section.image) + '" alt="' +
      esc(section.imageAlt) + '" class="story-image--' + esc(section.imageFit || 'cover') +
      '" loading="lazy" decoding="async"><figcaption>' + esc(section.caption || '') +
      '</figcaption></figure><div class="story-prose">' + heading(section) + paragraphs(section.paragraphs) +
      '</div></div></section>';
  }

  function renderQuote(section) {
    var classes = layout(section, 'narrow');
    return '<section class="story-section' + classes.section + '"><div class="story-wrap' + classes.width +
      '"><figure class="story-quote"><blockquote>' +
      esc(section.quote) + '</blockquote><figcaption><strong>' + esc(section.attribution) + '</strong>' +
      (section.role ? ' · ' + esc(section.role) : '') + '</figcaption></figure></div></section>';
  }

  function renderCards(section) {
    var classes = layout(section);
    var cards = (section.items || []).map(function (item) {
      return '<article class="story-card"><h3>' + esc(item.title) + '</h3><p>' + esc(item.body) + '</p></article>';
    }).join('');
    return '<section class="story-section' + classes.section + '"><div class="story-wrap' + classes.width + '">' + heading(section) +
      '<div class="story-grid">' + cards + '</div></div></section>';
  }

  function renderSteps(section) {
    var classes = layout(section);
    var steps = (section.items || []).map(function (item, index) {
      return '<li><span>' + String(index + 1).padStart(2, '0') + '</span><div><h3>' +
        esc(item.title) + '</h3><p>' + esc(item.body) + '</p></div></li>';
    }).join('');
    return '<section class="story-section story-section--dark' + classes.section +
      '"><div class="story-wrap' + classes.width + '">' + heading(section) +
      '<ol class="story-steps">' + steps + '</ol></div></section>';
  }

  function renderGallery(section) {
    var classes = layout(section, 'wide');
    var images = (section.items || []).map(function (item) {
      return '<figure><img src="' + esc(item.image) + '" alt="' + esc(item.imageAlt) +
        '" class="story-image--' + esc(item.imageFit || 'cover') +
        '" loading="lazy" decoding="async"><figcaption>' + esc(item.caption || '') + '</figcaption></figure>';
    }).join('');
    return '<section class="story-section' + classes.section + '"><div class="story-wrap' + classes.width + '">' + heading(section) +
      '<div class="story-gallery">' + images + '</div></div></section>';
  }

  function renderFeatureImage(section) {
    var classes = layout(section, 'full');
    var fit = section.imageFit || 'cover';
    return '<section class="story-feature story-feature--' + esc(fit) + classes.section +
      '"><img src="' + esc(section.image) + '" alt="' +
      esc(section.imageAlt) + '" loading="lazy" decoding="async" style="object-position:' +
      esc(section.position || 'center') + '" class="story-image--' + esc(fit) +
      '"><div class="story-feature__overlay"><div class="story-wrap' + classes.width + '">' +
      heading(section) + '</div></div></section>';
  }

  function renderCallout(section) {
    var classes = layout(section, 'narrow');
    return '<section class="story-section' + classes.section + '"><div class="story-wrap story-callout' +
      classes.width + '">' + heading(section) +
      '<p>' + esc(section.body) + '</p>' + actionLink(section.action) + '</div></section>';
  }

  function renderFinalCta(section) {
    var classes = layout(section, 'narrow');
    return '<section class="story-final' + classes.section + '"><div class="story-wrap' +
      classes.width + '">' + heading(section) +
      '<p>' + esc(section.body) + '</p><div class="story-actions">' + actionLink(section.primaryAction) +
      actionLink(section.secondaryAction, true) + '</div></div></section>';
  }

  function setMeta(data) {
    document.title = data.seo.title;
    var values = {
      'meta[name="description"]': data.seo.description,
      'meta[name="robots"]': data.status === 'published' ? 'index,follow' : 'noindex,nofollow',
      'meta[property="og:title"]': data.seo.title,
      'meta[property="og:description"]': data.seo.description,
      'meta[property="og:image"]': data.seo.image,
      'meta[property="og:url"]': data.seo.canonical
    };
    Object.keys(values).forEach(function (selector) {
      var node = document.querySelector(selector);
      if (node) node.setAttribute('content', values[selector]);
    });
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', data.seo.canonical);
  }

  function renderStory(data) {
    setMeta(data);
    document.documentElement.style.setProperty('--story-accent', data.theme.accent);
    var root = document.querySelector('[data-story-root]');
    var draft = data.status === 'draft'
      ? '<aside class="story-draft" role="status">Draft preview — this story is not listed publicly.</aside>' : '';
    root.innerHTML = draft +
      '<article><header class="story-hero"><div class="story-wrap story-hero__grid"><div>' +
      '<p class="story-eyebrow">' + esc(data.hero.eyebrow) + '</p><h1>' + esc(data.hero.title) +
      '</h1><p class="story-hero__lead">' + esc(data.hero.lead) + '</p><div class="story-actions">' +
      actionLink(data.hero.primaryAction) + actionLink(data.hero.secondaryAction, true) +
      '</div></div><figure><img src="' + esc(data.hero.image) +
      '" alt="' + esc(data.hero.imageAlt) + '" class="story-image--' +
      esc(data.hero.imageFit || 'cover') + '">' +
      (data.hero.badge ? '<figcaption class="story-hero__badge">' + esc(data.hero.badge) + '</figcaption>' : '') +
      '</figure></div></header>' +
      data.sections.map(function (section) { return SECTION_TYPES[section.type](section); }).join('') +
      '</article>';
  }

  function renderIndex(records) {
    var root = document.querySelector('[data-stories-index]');
    var published = records.filter(function (story) { return story.status === 'published'; })
      .sort(function (a, b) { return a.listing.order - b.listing.order; });
    root.innerHTML = published.map(function (story) {
      return '<article class="story-index-card"><a href="/stories/' + esc(story.slug) +
        '.html"><img src="' + esc(story.listing.image) + '" alt="' + esc(story.listing.imageAlt) +
        '" class="story-image--' + esc(story.listing.imageFit || 'cover') +
        '" loading="lazy"><div><p class="story-eyebrow">' + esc(story.listing.label) +
        '</p><h2>' + esc(story.listing.title) + '</h2><p>' + esc(story.listing.summary) +
        '</p><span>Read ' + (story.type === 'case-study' ? 'the case study' : 'the story') +
        ' →</span></div></a></article>';
    }).join('');
  }

  function fetchJson(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (response) {
      if (!response.ok) throw new Error('Could not load ' + url);
      return response.json();
    });
  }

  function showError(error) {
    var root = document.querySelector('[data-story-root], [data-stories-index]');
    if (root) root.innerHTML = '<p class="story-error">This story could not be loaded. Please try again later.</p>';
    console.error(error);
  }

  var slug = document.body.getAttribute('data-story-slug');
  if (slug) {
    fetchJson('/content/stories/' + encodeURIComponent(slug) + '.json').then(renderStory).catch(showError);
  } else {
    fetchJson(MANIFEST_URL).then(function (manifest) {
      return Promise.all(manifest.stories.map(fetchJson));
    }).then(renderIndex).catch(showError);
  }
}());
