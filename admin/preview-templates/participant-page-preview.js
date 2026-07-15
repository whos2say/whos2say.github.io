(function () {
  'use strict';

  window.__participantPagesPreviewLoaded = true;
  console.log('[Participant Pages Preview] script loaded v7');

  var h = null;
  var attempts = 0;
  var maxAttempts = 60;
  var retryDelay = 100;
  var stylePath = '/admin/preview-templates/participant-page-preview.css?v=participant-preview-7';
  var previewKeys = ['participant-pages', 'djr', 'participant-pages-djr'];
  var storagePrefix = 'wtsParticipantPagePreview:';

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

  function previewSrc(slug) {
    return '/djr/?cmsPreview=participant-pages&previewSlug=' + encodeURIComponent(slug) + '&ts=' + Date.now();
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
        h('a', {
          className: 'participant-page-preview__open',
          href: src,
          target: '_blank',
          rel: 'noopener'
        }, 'Open full preview')
      ]),
      h('iframe', {
        className: 'participant-page-preview__iframe',
        src: src,
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
        console.warn('[Participant Pages Preview] registration failed after retries v7', {
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
      console.log('[Participant Pages Preview] registered for participant-pages v7');
    } catch (err) {
      console.warn('[Participant Pages Preview] registration failed v7:', err);
    }
  }

  registerParticipantPagePreview();
})();
