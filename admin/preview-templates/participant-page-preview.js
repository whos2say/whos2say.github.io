(function () {
  'use strict';

  window.__participantPagesPreviewLoaded = true;
  console.log('[Participant Pages Preview] script loaded v6');

  var h = null;
  var registered = {};
  var attempts = 0;
  var maxAttempts = 60;
  var retryDelay = 100;
  var stylePath = '/admin/preview-templates/participant-page-preview.css?v=participant-preview-6';
  var previewKeys = ['participant-pages', 'djr', 'participant-pages-djr'];

  var SECTION_ORDER = [
    {
      key: 'hero',
      label: 'Hero',
      fallbackKey: 'hero',
      textFields: [
        ['tagline', 'Tagline']
      ],
      album: true
    },
    {
      key: 'story',
      label: 'Story / The Photographer',
      fallbackKey: 'story',
      textFields: [
        ['eyebrow', 'Eyebrow'],
        ['title', 'Title'],
        ['lead', 'Lead'],
        ['body', 'Body'],
        ['quote', 'Quote']
      ],
      album: true
    },
    {
      key: 'featured',
      label: 'Featured Story',
      fallbackKey: 'pictureOfTheWeek',
      textFields: [
        ['eyebrow', 'Eyebrow'],
        ['title', 'Title'],
        ['body', 'Body'],
        ['buttonLabel', 'Button label', 'button.label']
      ],
      album: true
    },
    {
      key: 'about',
      label: 'About David',
      fallbackKey: 'about',
      textFields: [
        ['eyebrow', 'Eyebrow'],
        ['title', 'Title'],
        ['body', 'Body']
      ],
      album: true
    },
    {
      key: 'creative',
      label: 'Creative Feature',
      fallbackKey: 'creativeFeature',
      textFields: [
        ['eyebrow', 'Eyebrow'],
        ['title', 'Title'],
        ['body', 'Body']
      ],
      album: true
    },
    {
      key: 'cta',
      label: 'CTA / Contact',
      fallbackKey: 'cta',
      textFields: [
        ['title', 'Title'],
        ['sub', 'Supporting text'],
        ['buttonLabel', 'Button label', 'button.label']
      ],
      album: false
    }
  ];

  function toJS(value) {
    if (!value) return {};
    if (typeof value.toJS === 'function') return value.toJS();
    return value;
  }

  function getEntryData(entry) {
    return toJS(entry && entry.getIn ? entry.getIn(['data']) : {});
  }

  function getPath(source, path) {
    if (!source || !path) return '';
    return path.split('.').reduce(function (value, part) {
      return value && value[part] != null ? value[part] : '';
    }, source);
  }

  function textValue(section, fieldName, fallbackSection, fallbackPath) {
    var value = section && typeof section[fieldName] === 'string' ? section[fieldName].trim() : '';
    if (value) return { value: value, fallback: false };

    var fallback = getPath(fallbackSection, fallbackPath || fieldName);
    if (typeof fallback === 'string' && fallback.trim()) {
      return { value: fallback.trim(), fallback: true };
    }

    return { value: 'Blank - live page keeps default DJR content.', fallback: true };
  }

  function boolBadge(label, value) {
    var on = value === true;
    return h('span', { className: 'participant-page-preview__badge ' + (on ? 'is-on' : 'is-off') }, label + ': ' + (on ? 'ON' : 'OFF'));
  }

  function field(label, text) {
    return h('div', { className: 'participant-page-preview__field' }, [
      h('p', { className: 'participant-page-preview__field-label' }, label),
      h('p', { className: 'participant-page-preview__field-value' + (text.fallback ? ' participant-page-preview__fallback' : '') }, text.value)
    ]);
  }

  function meta(label, value) {
    return h('div', { className: 'participant-page-preview__meta' }, [
      h('p', { className: 'participant-page-preview__meta-label' }, label),
      h('div', { className: 'participant-page-preview__meta-value' }, value || 'Blank')
    ]);
  }

  function albumBox(section, defaultAlbumId) {
    var allow = section && section.allowParticipantAlbum === true;
    var albumId = section && typeof section.albumId === 'string' && section.albumId.trim()
      ? section.albumId.trim()
      : (allow && defaultAlbumId ? defaultAlbumId : '');
    var limit = section && section.imageLimit ? String(section.imageLimit) : '';

    return h('div', { className: 'participant-page-preview__album' }, [
      h('strong', null, 'Album images'),
      h('p', null, 'Album override ' + (allow ? 'ON' : 'OFF')),
      h('p', null, 'Album UUID: ' + (albumId || 'Blank - live page keeps default DJR content.')),
      limit ? h('p', null, 'Image limit: ' + limit) : null,
      h('p', null, 'Images come from /albums.html using this Supabase album UUID.')
    ]);
  }

  function renderSection(data, fallbackHome, definition) {
    var sections = data.sections || {};
    var section = sections[definition.key] || {};
    var fallbackSection = fallbackHome[definition.fallbackKey] || {};
    var enabled = section.enabled !== false;
    var allowEdit = section.allowParticipantEdit === true;
    var badges = [
      boolBadge('Enabled', enabled),
      boolBadge('Text edits', allowEdit)
    ];

    if (definition.album) badges.push(boolBadge('Album override', section.allowParticipantAlbum === true));

    return h('section', { className: 'participant-page-preview__section' + (enabled ? '' : ' is-disabled') }, [
      h('div', { className: 'participant-page-preview__section-head' }, [
        h('h2', { className: 'participant-page-preview__section-title' }, definition.label),
        h('div', { className: 'participant-page-preview__badges' }, badges)
      ]),
      h('div', { className: 'participant-page-preview__fields' }, definition.textFields.map(function (item) {
        return field(item[1], textValue(section, item[0], fallbackSection, item[2]));
      })),
      definition.album ? albumBox(section, data.defaultAlbumId) : null
    ]);
  }

  function renderPreview(props, state) {
    var data = getEntryData(props.entry);
    var fallbackHome = (state && state.fallbackHome) || {};
    var sections = SECTION_ORDER.map(function (definition) {
      return renderSection(data, fallbackHome, definition);
    });

    return h('div', { className: 'participant-page-preview' },
      h('div', { className: 'participant-page-preview__shell' }, [
        h('header', { className: 'participant-page-preview__header' }, [
          h('p', { className: 'participant-page-preview__eyebrow' }, 'Participant Pages Preview'),
          h('h1', { className: 'participant-page-preview__title' }, data.name || 'DJR Participant Page'),
          h('p', { className: 'participant-page-preview__subtitle' }, 'Section-by-section editing context. Blank fields keep the default DJR content on the live page.'),
          h('div', { className: 'participant-page-preview__grid' }, [
            meta('Slug', data.slug),
            meta('Template', data.template),
            meta('Default Album UUID', data.defaultAlbumId),
            meta('Fallback copy', 'Fallback notices shown')
          ])
        ]),
        sections
      ])
    );
  }

  function ParticipantPagePreview(props) {
    window.__participantPagesPreviewRenderCount = (window.__participantPagesPreviewRenderCount || 0) + 1;
    console.log('[Participant Pages Preview] render called', window.__participantPagesPreviewRenderCount);
    return renderPreview(props, { fallbackHome: {}, fallbackLoaded: false });
  }

  function findCreateElement() {
    return window.h || (window.React && window.React.createElement);
  }

  function registerParticipantPagePreview() {
    var CMS = window.CMS;
    h = findCreateElement();

    if (window.__participantPagesPreviewRegistered) return;

    if (!CMS || !h) {
      attempts += 1;
      if (attempts >= maxAttempts) {
        window.__participantPagesPreviewRegistrationFailed = true;
        console.warn('[Participant Pages Preview] registration failed after retries v6', {
          hasCMS: Boolean(window.CMS),
          hasH: Boolean(window.h),
          hasReact: Boolean(window.React),
          hasReactCreateElement: Boolean(window.React && window.React.createElement),
          hasCreateClass: Boolean(window.createClass)
        });
        return;
      }
      window.setTimeout(registerParticipantPagePreview, retryDelay);
      return;
    }

    try {
      CMS.registerPreviewStyle(stylePath);
      previewKeys.forEach(function (key) {
        CMS.registerPreviewTemplate(key, ParticipantPagePreview);
        registered[key] = true;
        console.log('[Participant Pages Preview] registered for ' + key);
      });
      window.__participantPagesPreviewRegistered = true;
      console.log('[Participant Pages Preview] registered for participant-pages v6');
    } catch (err) {
      console.warn('[Participant Pages Preview] registration failed v6:', err);
    }
  }

  registerParticipantPagePreview();
})();
