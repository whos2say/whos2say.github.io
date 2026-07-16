(function () {
  'use strict';

  window.__brandPalettePickerScriptLoaded = true;
  console.log('[Brand Palette Picker] script loaded v1');

  var attempts = 0;
  var maxAttempts = 60;
  var palettes = {
    'djr-cinematic-blue': { label: 'DJR Cinematic Blue', modes: ['dark'], accents: ['electric-blue', 'cyan', 'muted-gold'], swatches: ['#07090d', '#10141c', '#e8ecf2', '#4da6ff', '#22c7e8'], tokens: ['#07090d', '#10141c', '#e8ecf2', '#aeb9c8', '#4da6ff', '#04111f', '#273246'] },
    'warm-documentary': { label: 'Warm Documentary', modes: ['dark', 'light'], accents: ['amber', 'rust'], swatches: ['#171411', '#fffaf2', '#e9a23b', '#9d6737'], tokens: ['#171411', '#27211b', '#fffaf2', '#d8cab8', '#e9a23b', '#211506', '#5e4d3b'] },
    'bold-advocate': { label: 'Bold Advocate', modes: ['light', 'dark'], accents: ['gold', 'coral'], swatches: ['#152238', '#fff9ed', '#b86b00', '#1f4777'], tokens: ['#fff9ed', '#ffffff', '#152238', '#526077', '#b86b00', '#ffffff', '#c8b58f'] },
    'calm-focus': { label: 'Calm Focus', modes: ['light', 'dark'], accents: ['blue', 'teal'], swatches: ['#17333a', '#f1f7f8', '#176b78', '#7ca6ad'], tokens: ['#f1f7f8', '#ffffff', '#17333a', '#526c72', '#176b78', '#ffffff', '#b9d0d4'] },
    'electric-creative': { label: 'Electric Creative', modes: ['dark', 'light'], accents: ['violet', 'cyan'], swatches: ['#17122b', '#a78bfa', '#22d3ee', '#ffffff'], tokens: ['#17122b', '#282044', '#ffffff', '#cec5ea', '#a78bfa', '#17122b', '#5c4a88'] },
    'natural-community': { label: 'Natural Community', modes: ['light', 'dark'], accents: ['forest', 'clay'], swatches: ['#26382b', '#f6f3e8', '#3e704b', '#a9674f'], tokens: ['#f6f3e8', '#fffdf5', '#26382b', '#637064', '#3e704b', '#ffffff', '#bec9b9'] },
    'editorial-classic': { label: 'Editorial Classic', modes: ['light', 'dark'], accents: ['burgundy', 'navy'], swatches: ['#221f1d', '#f8f5ef', '#7d2434', '#2d4059'], tokens: ['#f8f5ef', '#ffffff', '#221f1d', '#68615b', '#7d2434', '#ffffff', '#c8c0b8'] },
    'high-contrast-access': { label: 'High Contrast Access', modes: ['dark', 'light'], accents: ['yellow', 'cyan'], swatches: ['#000000', '#ffffff', '#ffe500', '#00e5ff'], tokens: ['#000000', '#171717', '#ffffff', '#e5e5e5', '#ffe500', '#000000', '#ffffff'] }
  };

  function valueGet(value, key, fallback) {
    if (value && typeof value.get === 'function') return value.get(key) || fallback;
    return value && value[key] || fallback;
  }

  function setValue(props, paletteId, mode, accent) {
    var current = props.value;
    if (current && typeof current.set === 'function') {
      props.onChange(current.set('palette', paletteId).set('mode', mode).set('accent', accent));
      return;
    }
    props.onChange({ palette: paletteId, mode: mode, accent: accent });
  }

  function BrandPalettePicker(props) {
    var h = window.h || (window.React && window.React.createElement);
    var selectedId = valueGet(props.value, 'palette', 'high-contrast-access');
    var selected = palettes[selectedId] || palettes['high-contrast-access'];
    var mode = valueGet(props.value, 'mode', selected.modes[0]);
    var accent = valueGet(props.value, 'accent', selected.accents[0]);
    var t = selected.tokens;
    var previewStyle = { background: t[0], color: t[2], borderColor: t[6] };

    return h('div', { className: 'brand-palette-picker' }, [
      h('div', { className: 'brand-palette-picker__intro' }, [
        h('strong', null, 'Choose a feeling, not a color code.'),
        h('span', null, 'Each palette is curated and uses approved contrast pairs.')
      ]),
      h('div', { className: 'brand-palette-picker__grid' }, Object.keys(palettes).map(function (id) {
        var item = palettes[id];
        return h('button', {
          type: 'button',
          className: 'brand-palette-card' + (id === selectedId ? ' is-selected' : ''),
          'aria-pressed': id === selectedId ? 'true' : 'false',
          onClick: function () { setValue(props, id, item.modes[0], item.accents[0]); }
        }, [
          h('span', { className: 'brand-palette-card__name' }, item.label),
          h('span', { className: 'brand-palette-card__swatches' }, item.swatches.map(function (color) {
            return h('span', { className: 'brand-palette-card__swatch', style: { backgroundColor: color } });
          }))
        ]);
      })),
      h('div', { className: 'brand-palette-picker__choices' }, [
        h('label', null, ['Light or dark mood', h('select', { value: mode, onChange: function (event) { setValue(props, selectedId, event.target.value, accent); } }, selected.modes.map(function (item) { return h('option', { value: item }, item); }))]),
        h('label', null, ['Accent personality', h('select', { value: accent, onChange: function (event) { setValue(props, selectedId, mode, event.target.value); } }, selected.accents.map(function (item) { return h('option', { value: item }, item); }))])
      ]),
      h('div', { className: 'brand-palette-example', style: previewStyle }, [
        h('div', { className: 'brand-palette-example__image', style: { background: 'linear-gradient(135deg,' + selected.swatches[3] + ',' + t[4] + ')' } }),
        h('p', { className: 'brand-palette-example__eyebrow', style: { color: t[4] } }, selected.label),
        h('h3', null, 'Your story deserves a clear point of view.'),
        h('p', { style: { color: t[3] } }, 'This sample shows how headings, paragraphs, buttons, cards, and image frames work together.'),
        h('button', { type: 'button', tabIndex: -1, style: { background: t[4], color: t[5] } }, 'Example invitation'),
        h('div', { className: 'brand-palette-example__card', style: { background: t[1], borderColor: t[6] } }, 'A calm card for a key message or story moment.')
      ]),
      h('p', { className: 'brand-palette-picker__access' }, '✓ This palette uses approved contrast pairs. Raw hex colors are intentionally unavailable.')
    ]);
  }

  function register() {
    var CMS = window.CMS;
    if (!CMS || !(window.h || (window.React && window.React.createElement))) {
      attempts += 1;
      if (attempts >= maxAttempts) {
        window.__brandPalettePickerRegistrationFailed = true;
        console.warn('[Brand Palette Picker] registration failed v1');
        return;
      }
      window.setTimeout(register, 100);
      return;
    }
    if (window.__brandPalettePickerRegistered) return;
    CMS.registerWidget('brand-palette-picker', BrandPalettePicker);
    window.__brandPalettePickerRegistered = true;
    console.log('[Brand Palette Picker] registered v1');
  }

  register();
})();
