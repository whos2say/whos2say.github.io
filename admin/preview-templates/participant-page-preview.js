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

  function toJS(value) {
    if (!value) return {};
    if (typeof value.toJS === 'function') return value.toJS();
    return value;
  }

  function safeGetIn(value, path) {
    try {
      return value && typeof value.getIn === 'function' ? value.getIn(path) : undefined;
    } catch (err) {
      return undefined;
    }
  }

  function getEntryData(entry) {
    return toJS(safeGetIn(entry, ['data']));
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
    var src = '/djr/?cmsPreview=participant-pages&previewSlug=' + encodeURIComponent(slug) + '&ts=' + Date.now();
    return src;
  }

  function reloadPreviewFrame(slug) {
    var frame = document.querySelector('.participant-page-preview__iframe');
    var previewSlug = slug || frame && frame.getAttribute('data-preview-slug') || 'djr';
    if (frame) frame.src = previewSrc(previewSlug);
  }

  function refreshPreview(slug, data) {
    writeDraft(slug, data);
    reloadPreviewFrame(slug);
  }

  function renderButton(label, className, onClick) {
    return h('button', {
      type: 'button',
      className: className,
      onClick: onClick
    }, label);
  }

  function ParticipantPagePreview(props) {
    props = props || {};
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
            ? 'Preview auto-updates as you edit'
            : 'Preview is using saved content because draft data could not be stored')
        ]),
        h('div', { className: 'participant-page-preview__actions' }, [
          renderButton('Refresh Preview', 'participant-page-preview__button participant-page-preview__button--primary', function () {
            refreshPreview(slug, data);
          }),
          h('a', {
            className: 'participant-page-preview__open',
            href: src,
            target: '_blank',
            rel: 'noopener'
          }, 'Open Full Preview')
        ])
      ]),
      h('p', { className: 'participant-page-preview__hint' }, 'Preview auto-updates as you edit. Use Refresh Preview if the iframe looks stale.'),
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
