(function () {
  'use strict';

  window.__brandKitPreviewLoaded = true;
  console.log('[Brand Kit Preview] script loaded v1');
  var h;
  var attempts = 0;
  var palettes = {
    'djr-cinematic-blue': { label: 'DJR Cinematic Blue', colors: ['#07090d', '#10141c', '#e8ecf2', '#4da6ff', '#22c7e8'], bg: '#07090d', surface: '#10141c', text: '#e8ecf2', muted: '#aeb9c8', accent: '#4da6ff', accentText: '#04111f', border: '#273246' },
    'warm-documentary': { label: 'Warm Documentary', colors: ['#171411', '#fffaf2', '#e9a23b', '#9d6737'], bg: '#171411', surface: '#27211b', text: '#fffaf2', muted: '#d8cab8', accent: '#e9a23b', accentText: '#211506', border: '#5e4d3b' },
    'bold-advocate': { label: 'Bold Advocate', colors: ['#152238', '#fff9ed', '#b86b00', '#1f4777'], bg: '#fff9ed', surface: '#ffffff', text: '#152238', muted: '#526077', accent: '#b86b00', accentText: '#ffffff', border: '#c8b58f' },
    'calm-focus': { label: 'Calm Focus', colors: ['#17333a', '#f1f7f8', '#176b78', '#7ca6ad'], bg: '#f1f7f8', surface: '#ffffff', text: '#17333a', muted: '#526c72', accent: '#176b78', accentText: '#ffffff', border: '#b9d0d4' },
    'electric-creative': { label: 'Electric Creative', colors: ['#17122b', '#a78bfa', '#22d3ee', '#ffffff'], bg: '#17122b', surface: '#282044', text: '#ffffff', muted: '#cec5ea', accent: '#a78bfa', accentText: '#17122b', border: '#5c4a88' },
    'natural-community': { label: 'Natural Community', colors: ['#26382b', '#f6f3e8', '#3e704b', '#a9674f'], bg: '#f6f3e8', surface: '#fffdf5', text: '#26382b', muted: '#637064', accent: '#3e704b', accentText: '#ffffff', border: '#bec9b9' },
    'editorial-classic': { label: 'Editorial Classic', colors: ['#221f1d', '#f8f5ef', '#7d2434', '#2d4059'], bg: '#f8f5ef', surface: '#ffffff', text: '#221f1d', muted: '#68615b', accent: '#7d2434', accentText: '#ffffff', border: '#c8c0b8' },
    'high-contrast-access': { label: 'High Contrast Access', colors: ['#000000', '#ffffff', '#ffe500', '#00e5ff'], bg: '#000000', surface: '#171717', text: '#ffffff', muted: '#e5e5e5', accent: '#ffe500', accentText: '#000000', border: '#ffffff' }
  };
  var areaLabels = { brandFoundation: 'Brand foundation', audienceMessage: 'Audience & message', voiceLanguage: 'Voice & language', storyCta: 'Story & invitations', photoVisual: 'Photo direction', colorsDesign: 'Colors & design' };

  function plain(value) { return value && typeof value.toJS === 'function' ? value.toJS() : value || {}; }
  function list(value) { return Array.isArray(value) ? value : []; }
  function workshopState(area) {
    if (!area || area.enabled === false || area.status === 'skip-for-now') return { label: 'Skipped for now', state: 'skip' };
    if (area.participantComfort === 'too-deep' || area.participantComfort === 'needs-support' || area.status === 'needs-staff-help') return { label: 'Needs support', state: 'support' };
    if (area.status === 'complete') return { label: 'Complete', state: 'complete' };
    if (area.status === 'in-progress') return { label: 'In progress', state: 'progress' };
    return { label: 'Come back later', state: 'later' };
  }

  function chips(items, className) {
    return h('div', { className: 'brand-board__chips ' + className }, list(items).map(function (item) { return h('span', null, typeof item === 'string' ? item : item.name || ''); }));
  }

  function BrandKitPreview(props) {
    props = props || {};
    var data = plain(props.entry && props.entry.getIn ? props.entry.getIn(['data']) : {});
    var identity = data.identity || {};
    var voice = data.voice || {};
    var messaging = data.messaging || {};
    var visual = data.visualDirection || {};
    var design = data.designSystem || {};
    var colors = design.colors || {};
    var palette = palettes[colors.palette] || palettes['high-contrast-access'];
    var isDraft = data.status !== 'approved';
    var workshop = data.workshop || {};
    var workshopItems = Object.keys(areaLabels).map(function (key) { return { key: key, result: workshopState(workshop[key]) }; });
    var completeCount = workshopItems.filter(function (item) { return item.result.state === 'complete'; }).length;
    var cta = list(messaging.approvedCallsToAction)[0] || {};
    var boardStyle = { '--board-bg': palette.bg, '--board-surface': palette.surface, '--board-text': palette.text, '--board-muted': palette.muted, '--board-accent': palette.accent, '--board-accent-text': palette.accentText, '--board-border': palette.border };

    return h('main', { className: 'brand-board', style: boardStyle }, [
      h('header', { className: 'brand-board__hero' }, [
        h('div', null, [h('span', { className: 'brand-board__status' }, isDraft ? 'Draft Brand Kit' : 'Approved Brand Kit'), h('p', { className: 'brand-board__participant' }, identity.participantName || 'Participant'), h('h1', null, identity.brandName || 'Your brand name'), h('p', { className: 'brand-board__tagline' }, identity.tagline || 'Your tagline will appear here.')]),
        h('div', { className: 'brand-board__palette' }, [h('strong', null, palette.label), h('div', null, palette.colors.map(function (color) { return h('span', { style: { backgroundColor: color } }); })), h('small', null, 'Approved contrast pairs · ' + (colors.mode || 'default') + ' mode · ' + (colors.accent || 'default') + ' accent')])
      ]),
      h('section', { className: 'brand-board__sample' }, [
        h('div', { className: 'brand-board__image-frame' }, [h('span', null, visual.photoStyle && visual.photoStyle.summary || 'Your photo treatment will appear here.')]),
        h('div', null, [h('p', { className: 'brand-board__eyebrow' }, 'Typography & message sample'), h('h2', null, messaging.publicMessage || identity.tagline || 'A clear message in your voice.'), h('p', null, identity.shortBio || voice.summary || 'Use this board to see how your words and visual choices work together.'), h('button', { type: 'button' }, cta.label || 'Example invitation'), h('article', null, [h('strong', null, 'Card sample'), h('p', null, data.strategy && data.strategy.keyMessage || 'A card can hold a key message, story, or invitation.')])])
      ]),
      h('section', { className: 'brand-board__voice' }, [
        h('div', null, [h('p', { className: 'brand-board__eyebrow' }, 'Voice traits'), chips(voice.traits, 'brand-board__chips--traits')]),
        h('div', null, [h('p', { className: 'brand-board__eyebrow' }, 'Words that sound like us'), chips(voice.wordsToUse, 'brand-board__chips--use')]),
        h('div', null, [h('p', { className: 'brand-board__eyebrow' }, 'Words to avoid'), chips(voice.wordsToAvoid, 'brand-board__chips--avoid')])
      ]),
      h('section', { className: 'brand-board__workshop' }, [
        h('div', { className: 'brand-board__workshop-heading' }, [h('div', null, [h('p', { className: 'brand-board__eyebrow' }, 'Workshop progress'), h('h2', null, completeCount + ' of ' + workshopItems.length + ' areas complete')]), h('p', null, 'Skipping an area is allowed. This board is a workshop view, not a public page.')]),
        h('div', { className: 'brand-board__progress' }, workshopItems.map(function (item) { return h('div', { className: 'brand-board__progress-item is-' + item.result.state }, [h('strong', null, areaLabels[item.key]), h('span', null, item.result.label)]); }))
      ])
    ]);
  }

  function register() {
    h = window.h || (window.React && window.React.createElement);
    if (!window.CMS || !h) {
      attempts += 1;
      if (attempts >= 60) { window.__brandKitPreviewRegistrationFailed = true; console.warn('[Brand Kit Preview] registration failed v1'); return; }
      window.setTimeout(register, 100);
      return;
    }
    if (window.__brandKitPreviewRegistered) return;
    window.CMS.registerPreviewStyle('/admin/preview-templates/brand-kit-preview.css?v=brand-kit-preview-1');
    window.CMS.registerPreviewTemplate('participant-brand-kits', BrandKitPreview);
    window.__brandKitPreviewRegistered = true;
    console.log('[Brand Kit Preview] registered v1');
  }
  register();
})();
