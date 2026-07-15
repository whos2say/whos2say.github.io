(function () {
  'use strict';

  window.__participantPagesPreviewLoaded = true;
  console.log('[Participant Pages Preview] script loaded v8');

  var h = null;
  var attempts = 0;
  var maxAttempts = 60;
  var retryDelay = 100;
  var stylePath = '/admin/preview-templates/participant-page-preview.css?v=participant-preview-8';
  var previewKeys = ['participant-pages', 'djr', 'participant-pages-djr'];
  var storagePrefix = 'wtsParticipantPagePreview:';
  var savedConfigCache = {};
  var sectionAnchors = {
    hero: '',
    story: 'story',
    featured: 'story',
    about: 'about',
    creative: 'story',
    cta: 'contact'
  };
  var sectionLabels = {
    hero: 'Hero',
    story: 'Story',
    featured: 'Featured',
    about: 'About',
    creative: 'Creative',
    cta: 'CTA'
  };

  function toJS(value) {
    if (!value) return {};
    if (typeof value.toJS === 'function') return value.toJS();
    return value;
  }

  function getEntryData(entry) {
    return toJS(entry && entry.getIn ? entry.getIn(['data']) : {});
  }

  function getPreviewSlug(data) {
    return data && typeof data.slug === 'string' && data.slug.trim() ? data.slug.trim() : 'djr';
  }

  function writeDraft(slug, data) {
    try {
      window.sessionStorage.setItem(storagePrefix + slug, JSON.stringify(data || {}));
      console.log('[Participant Pages Preview] iframe draft updated');
      return true;
    } catch (err) {
      console.warn('[Participant Pages Preview] could not write draft data:', err);
      return false;
    }
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value || {}));
    } catch (err) {
      return {};
    }
  }

  function previewSrc(slug, sectionKey) {
    var anchor = sectionAnchors[sectionKey] || '';
    var src = '/djr/?cmsPreview=participant-pages&previewSlug=' + encodeURIComponent(slug) + '&ts=' + Date.now();
    return anchor ? src + '#' + encodeURIComponent(anchor) : src;
  }

  function reloadPreviewFrame(sectionKey) {
    var frame = document.querySelector('.participant-page-preview__iframe');
    var slug = frame && frame.getAttribute('data-preview-slug') || 'djr';
    if (frame) frame.src = previewSrc(slug, sectionKey);
  }

  function loadSavedConfig(slug) {
    if (savedConfigCache[slug]) return Promise.resolve(clone(savedConfigCache[slug]));

    return window.fetch('/content/participant-pages/' + encodeURIComponent(slug) + '.json', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Saved participant page config not available');
        return response.json();
      })
      .then(function (data) {
        savedConfigCache[slug] = clone(data);
        return clone(data);
      });
  }

  function replaceSection(currentData, savedData, sectionKey) {
    var nextData = clone(currentData);
    nextData.sections = nextData.sections || {};

    if (sectionKey) {
      nextData.sections[sectionKey] = clone(savedData && savedData.sections && savedData.sections[sectionKey]);
      return nextData;
    }

    return clone(savedData);
  }

  function refreshPreview(slug, data, sectionKey) {
    writeDraft(slug, data);
    reloadPreviewFrame(sectionKey);
  }

  function undoPreview(slug, data, sectionKey) {
    loadSavedConfig(slug)
      .then(function (savedData) {
        var nextData = replaceSection(data, savedData, sectionKey);
        writeDraft(slug, nextData);
        reloadPreviewFrame(sectionKey);
        console.log('[Participant Pages Preview] undo preview applied', sectionKey || 'all');
      })
      .catch(function (err) {
        console.warn('[Participant Pages Preview] could not undo preview:', err);
      });
  }

  function renderButton(label, className, onClick) {
    return h('button', {
      type: 'button',
      className: className,
      onClick: onClick
    }, label);
  }

  function renderSectionControls(slug, data) {
    return h('div', { className: 'participant-page-preview__sections', 'aria-label': 'Preview section controls' },
      Object.keys(sectionLabels).map(function (sectionKey) {
        return h('div', { className: 'participant-page-preview__section-control', key: sectionKey }, [
          h('span', { className: 'participant-page-preview__section-name' }, sectionLabels[sectionKey]),
          h('div', { className: 'participant-page-preview__button-group' }, [
            renderButton('Refresh', 'participant-page-preview__button', function () {
              refreshPreview(slug, data, sectionKey);
            }),
            renderButton('Undo preview', 'participant-page-preview__button participant-page-preview__button--muted', function () {
              undoPreview(slug, data, sectionKey);
            })
          ])
        ]);
      })
    );
  }

  function ParticipantPagePreview(props) {
    var data = getEntryData(props.entry);
    var slug = getPreviewSlug(data);
    var stored = writeDraft(slug, data);
    var src = previewSrc(slug);

    window.__participantPagesPreviewRenderCount = (window.__participantPagesPreviewRenderCount || 0) + 1;
    console.log('[Participant Pages Preview] render called', window.__participantPagesPreviewRenderCount);

    return h('div', { className: 'participant-page-preview participant-page-preview--iframe' }, [
      h('div', { className: 'participant-page-preview__toolbar' }, [
        h('div', null, [
          h('h1', { className: 'participant-page-preview__toolbar-title' }, 'Live DJR Page Preview'),
          h('p', { className: 'participant-page-preview__toolbar-subtitle' }, stored
            ? 'Draft data from Participant Pages'
            : 'Preview is using saved content because draft data could not be stored')
        ]),
        h('div', { className: 'participant-page-preview__actions' }, [
          renderButton('Refresh preview', 'participant-page-preview__button participant-page-preview__button--primary', function () {
            refreshPreview(slug, data);
          }),
          renderButton('Undo preview to saved', 'participant-page-preview__button participant-page-preview__button--muted', function () {
            undoPreview(slug, data);
          }),
          h('a', {
            className: 'participant-page-preview__open',
            href: src,
            target: '_blank',
            rel: 'noopener'
          }, 'Open full preview')
        ])
      ]),
      renderSectionControls(slug, data),
      h('iframe', {
        className: 'participant-page-preview__iframe',
        src: src,
        'data-preview-slug': slug,
        title: 'Live DJR Page Preview'
      }),
      h('details', { className: 'participant-page-preview__details' }, [
        h('summary', null, 'Preview details'),
        h('p', null, 'This iframe renders /djr/ with cmsPreview=participant-pages and reads draft Participant Pages data from sessionStorage.'),
        h('p', null, 'Storage key: ' + storagePrefix + slug)
      ])
    ]);
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
        console.warn('[Participant Pages Preview] registration failed after retries v8', {
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
        console.log('[Participant Pages Preview] registered for ' + key);
      });
      window.__participantPagesPreviewRegistered = true;
      console.log('[Participant Pages Preview] registered for participant-pages v8');
    } catch (err) {
      console.warn('[Participant Pages Preview] registration failed v8:', err);
    }
  }

  registerParticipantPagePreview();
})();
