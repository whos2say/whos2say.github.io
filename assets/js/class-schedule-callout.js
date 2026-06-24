/**
 * Programs-page class schedule callout.
 *
 * Fetches /api/class-availability, groups sessions into weekly time slots,
 * and renders a compact preview inside #class-schedule-callout with a link
 * to the Creative Workshops page. Hides itself completely on error or when
 * no sessions are scheduled — the Programs page never shows a broken widget.
 */
(function () {
  'use strict';

  var AVAIL_API     = '/api/class-availability';
  var WORKSHOP_HREF = '/creative-workshops.html#class-sessions';

  var CLASS_NAMES = {
    'digital-content-production': 'Digital Content Production',
    'sports-media-community':     'Sports Media & Community',
  };

  function classDisplayName(classId) {
    return CLASS_NAMES[classId] ||
      classId.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('class-callout-styles')) return;
    var style = document.createElement('style');
    style.id  = 'class-callout-styles';
    style.textContent = [
      '.cc-section { background: rgba(124,58,237,0.08); border-top: 1px solid rgba(124,58,237,0.22); border-bottom: 1px solid rgba(124,58,237,0.12); padding: 3rem 1.5rem; }',
      '.cc-inner { max-width: 1024px; margin: 0 auto; }',

      // Header row: eyebrow + title left, CTA right
      '.cc-header { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 1rem 2rem; margin-bottom: 2rem; }',
      '.cc-heading { flex: 1; min-width: 0; }',
      '.cc-eyebrow { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: var(--accent, #7c3aed); margin: 0 0 0.45rem; }',
      '.cc-title { font-size: 1.45rem; font-weight: 800; margin: 0 0 0.3rem; line-height: 1.25; }',
      '.cc-sub { font-size: 0.9rem; opacity: 0.7; margin: 0; line-height: 1.5; }',
      '.cc-cta-wrap { display: flex; align-items: center; padding-top: 0.25rem; }',

      // Slot grid
      '.cc-slot-grid { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem; }',
      '.cc-slot-tile { flex: 1; min-width: 200px; max-width: 300px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-left: 3px solid var(--accent, #7c3aed); border-radius: 10px; padding: 1.1rem 1.25rem; }',
      '.cc-slot-day { font-size: 1.05rem; font-weight: 700; margin: 0 0 0.2rem; line-height: 1.2; }',
      '.cc-slot-time { font-size: 0.88rem; opacity: 0.78; margin: 0 0 0.55rem; }',
      '.cc-slot-name { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.55; margin: 0 0 0.45rem; }',
      '.cc-slot-badge { display: inline-block; font-size: 0.72rem; font-weight: 600; padding: 0.18rem 0.55rem; border-radius: 20px; }',
      '.cc-slot-badge--avail { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }',
      '.cc-slot-badge--full  { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.25); }',

      // CTA button (shared)
      '.cc-btn { display: inline-flex; align-items: center; gap: 0.45rem; background: var(--accent, #7c3aed); color: #fff; text-decoration: none; border-radius: 8px; padding: 0.7rem 1.5rem; font-size: 0.95rem; font-weight: 700; line-height: 1; transition: opacity 0.15s; white-space: nowrap; }',
      '.cc-btn:hover { color: #fff; opacity: 0.88; }',
      '.cc-btn-arrow { font-size: 1.05rem; }',

      // Footer CTA (mobile only)
      '.cc-footer { display: none; justify-content: center; }',

      // Responsive
      '@media (max-width: 640px) {',
      '  .cc-cta-wrap { display: none; }',
      '  .cc-footer { display: flex; }',
      '  .cc-slot-tile { min-width: 100%; max-width: 100%; }',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Date / time helpers ─────────────────────────────────────────────────────

  var DAY_PLURAL = ['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays'];
  var DAY_SINGLE = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  function parseDate(iso) {
    if (!iso) return null;
    try { return new Date(iso); } catch (e) { return null; }
  }

  function fmtTimeRange(startIso, endIso) {
    var s = parseDate(startIso), e = parseDate(endIso);
    if (!s) return '';
    try {
      var st = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      if (e) {
        var et = e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
        return st + ' – ' + et;
      }
      return s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    } catch (err) { return ''; }
  }

  // ── Grouping ────────────────────────────────────────────────────────────────

  function makeSlotKey(s) {
    var d = parseDate(s.start), e = parseDate(s.end);
    if (!d) return s.classId + ':?';
    return [s.classId, d.getDay(), d.getHours(), d.getMinutes(),
            e ? e.getHours() : '', e ? e.getMinutes() : ''].join(':');
  }

  function groupSessions(sessions) {
    var map = {}, order = [];
    sessions.forEach(function (s) {
      var key = makeSlotKey(s);
      if (!map[key]) {
        var d = parseDate(s.start);
        map[key] = { classId: s.classId, dayOfWeek: d ? d.getDay() : -1,
                     capacity: s.capacity, instances: [] };
        order.push(key);
      }
      map[key].instances.push(s);
    });
    return order.map(function (k) { return map[k]; });
  }

  // ── HTML helpers ────────────────────────────────────────────────────────────

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function slotTileHtml(slot) {
    var first = slot.instances[0];
    if (!first) return '';

    var isRecurring = slot.instances.length >= 2;
    var d           = parseDate(first.start);
    var dayLabel    = slot.dayOfWeek >= 0 && d
      ? (isRecurring ? DAY_PLURAL[slot.dayOfWeek] : DAY_SINGLE[slot.dayOfWeek])
      : '';
    var tr = fmtTimeRange(first.start, first.end);

    var avail = null;
    for (var i = 0; i < slot.instances.length; i++) {
      if (slot.instances[i].status === 'available') { avail = slot.instances[i]; break; }
    }
    var badge = avail
      ? '<span class="cc-slot-badge cc-slot-badge--avail">' + avail.seatsRemaining + ' of ' + avail.capacity + ' spots open</span>'
      : '<span class="cc-slot-badge cc-slot-badge--full">Full — join waitlist</span>';

    return (
      '<div class="cc-slot-tile">' +
        '<p class="cc-slot-day">' + esc(dayLabel) + '</p>' +
        (tr ? '<p class="cc-slot-time">' + esc(tr) + '</p>' : '') +
        '<p class="cc-slot-name">' + esc(classDisplayName(slot.classId)) + '</p>' +
        badge +
      '</div>'
    );
  }

  function ctaHtml() {
    return (
      '<a class="cc-btn" href="' + WORKSHOP_HREF + '">' +
        'View Schedule &amp; Request a Spot' +
        '<span class="cc-btn-arrow" aria-hidden="true">→</span>' +
      '</a>'
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  function render(container, sessions) {
    var slots = groupSessions(sessions).slice(0, 4);
    if (!slots.length) { container.hidden = true; return; }

    injectStyles();

    container.innerHTML =
      '<section class="cc-section" aria-label="Open class sessions">' +
        '<div class="cc-inner">' +
          '<div class="cc-header">' +
            '<div class="cc-heading">' +
              '<p class="cc-eyebrow">Open Classes · Now Scheduling</p>' +
              '<h2 class="cc-title">Weekly Class Sessions</h2>' +
              '<p class="cc-sub">Small group · Open to adults with and without disabilities · Up to 3 participants per session</p>' +
            '</div>' +
            '<div class="cc-cta-wrap">' + ctaHtml() + '</div>' +
          '</div>' +
          '<div class="cc-slot-grid">' + slots.map(slotTileHtml).join('') + '</div>' +
          '<div class="cc-footer">' + ctaHtml() + '</div>' +
        '</div>' +
      '</section>';
  }

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  function init() {
    var container = document.getElementById('class-schedule-callout');
    if (!container) return;

    fetch(AVAIL_API)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var sessions = data && data.sessions;
        if (!sessions || !sessions.length) { container.hidden = true; return; }
        render(container, sessions);
      })
      .catch(function () {
        container.hidden = true;
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
