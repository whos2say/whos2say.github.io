/**
 * Class availability widget for Creative Workshops page.
 *
 * Listens for 'w2s:page-rendered' (fired by render-full-pages.js after the
 * creative-workshops page body is written), then:
 *   1. Fetches /api/class-availability
 *   2. Groups sessions into weekly time slots
 *   3. Renders inquiry cards (submitting does not confirm enrollment)
 *   4. Submits to /api/class-signup and shows result messages
 */
(function () {
  'use strict';

  var AVAIL_API  = '/api/class-availability';
  var SIGNUP_API = '/api/class-signup';

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
    if (document.getElementById('class-sessions-styles')) return;
    var style = document.createElement('style');
    style.id  = 'class-sessions-styles';
    style.textContent = [
      '.class-sessions-list { display: flex; flex-direction: column; gap: 1.75rem; margin-top: 0.5rem; }',
      '.cs-section-notice { background: rgba(124,58,237,0.08); border: 1px solid rgba(124,58,237,0.2); border-radius: 8px; padding: 0.9rem 1.1rem; font-size: 0.9rem; line-height: 1.6; margin-bottom: 0.25rem; }',
      '.cs-slot-card { background: var(--card-bg, #1a1a2e); border: 1px solid var(--border, rgba(255,255,255,0.1)); border-left: 3px solid var(--accent, #7c3aed); border-radius: 12px; padding: 1.5rem; }',
      '.cs-slot-header { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.75rem; }',
      '.cs-slot-class-name { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; opacity: 0.6; margin: 0; }',
      '.cs-badge { display: inline-block; font-size: 0.78rem; font-weight: 600; padding: 0.25rem 0.65rem; border-radius: 20px; white-space: nowrap; }',
      '.cs-badge--available { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }',
      '.cs-badge--full       { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }',
      '.cs-slot-day-time { font-size: 1.2rem; font-weight: 700; margin: 0 0 0.5rem; line-height: 1.3; }',
      '.cs-slot-sub { font-size: 0.88rem; opacity: 0.7; margin: 0 0 0.85rem; }',
      '.cs-slot-sub span + span::before { content: "·"; margin: 0 0.45em; opacity: 0.5; }',
      '.cs-slot-dates { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.1rem; align-items: baseline; }',
      '.cs-slot-dates-label { font-size: 0.8rem; opacity: 0.6; flex-shrink: 0; }',
      '.cs-date-chip { font-size: 0.8rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 0.2rem 0.65rem; white-space: nowrap; }',
      '.cs-toggle { background: none; border: 1px solid var(--accent, #7c3aed); border-radius: 6px; padding: 0.5rem 1.1rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; color: var(--accent, #7c3aed); transition: background 0.15s; }',
      '.cs-toggle:hover { background: rgba(124,58,237,0.1); }',
      '.cs-form { margin-top: 1.25rem; border-top: 1px solid var(--border, rgba(255,255,255,0.1)); padding-top: 1.25rem; }',
      '.cs-inquiry-notice { background: rgba(255,255,255,0.05); border-left: 3px solid var(--accent, #7c3aed); border-radius: 0 6px 6px 0; padding: 0.65rem 0.9rem; font-size: 0.87rem; line-height: 1.55; margin-bottom: 1.1rem; }',
      '.cs-form-row { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }',
      '.cs-form-row label { font-size: 0.88rem; font-weight: 600; }',
      '.cs-form-row input, .cs-form-row textarea, .cs-form-row select { background: var(--input-bg, rgba(255,255,255,0.06)); border: 1px solid var(--border, rgba(255,255,255,0.15)); border-radius: 6px; padding: 0.55rem 0.75rem; font-size: 0.95rem; color: inherit; width: 100%; box-sizing: border-box; font-family: inherit; }',
      '.cs-form-row input:focus, .cs-form-row textarea:focus, .cs-form-row select:focus { outline: 2px solid var(--accent, #7c3aed); outline-offset: 1px; }',
      '.cs-form-row select option { background: #1a1a2e; color: inherit; }',
      '.cs-form-followup { font-size: 0.85rem; opacity: 0.7; margin: 0 0 1rem; line-height: 1.55; }',
      '.cs-form-actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }',
      '.cs-submit { background: var(--accent, #7c3aed); color: #fff; border: none; border-radius: 6px; padding: 0.55rem 1.4rem; font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: opacity 0.15s; }',
      '.cs-submit:hover:not(:disabled) { opacity: 0.88; }',
      '.cs-submit:disabled { opacity: 0.5; cursor: not-allowed; }',
      '.cs-cancel { background: none; border: none; font-size: 0.9rem; cursor: pointer; color: inherit; opacity: 0.6; padding: 0.55rem 0.25rem; }',
      '.cs-cancel:hover { opacity: 1; }',
      '.cs-msg { margin-top: 0.75rem; padding: 0.75rem 1rem; border-radius: 6px; font-size: 0.92rem; }',
      '.cs-msg--success  { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); color: #4ade80; }',
      '.cs-msg--waitlist { background: rgba(234,179,8,0.12); border: 1px solid rgba(234,179,8,0.3); color: #fde047; }',
      '.cs-msg--error    { background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #f87171; }',
      '.cs-msg--info     { background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); color: #a5b4fc; }',
      '.cs-empty, .cs-loading, .cs-api-error { padding: 1.25rem 0; font-size: 0.95rem; opacity: 0.75; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Date / time helpers ─────────────────────────────────────────────────────

  var DAY_PLURAL  = ['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays'];
  var DAY_SINGLE  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MONTH_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function parseDate(iso) {
    if (!iso) return null;
    try { return new Date(iso); } catch (e) { return null; }
  }

  function shortDate(d) {
    return d ? MONTH_SHORT[d.getMonth()] + ' ' + d.getDate() : '';
  }

  function longDate(d) {
    return d ? DAY_SINGLE[d.getDay()] + ', ' + MONTH_LONG[d.getMonth()] + ' ' + d.getDate() : '';
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

  // ── Session grouping ────────────────────────────────────────────────────────

  function makeSlotKey(session) {
    var d = parseDate(session.start), e = parseDate(session.end);
    if (!d) return session.classId + ':?';
    return [session.classId, d.getDay(), d.getHours(), d.getMinutes(),
            e ? e.getHours() : '', e ? e.getMinutes() : ''].join(':');
  }

  function groupSessions(sessions) {
    var map = {}, order = [];
    sessions.forEach(function (s) {
      var key = makeSlotKey(s);
      if (!map[key]) {
        var d = parseDate(s.start);
        map[key] = { key: key, classId: s.classId, dayOfWeek: d ? d.getDay() : -1,
                     location: s.location, capacity: s.capacity, instances: [] };
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

  function slotBadgeHtml(slot) {
    var avail = null;
    for (var i = 0; i < slot.instances.length; i++) {
      if (slot.instances[i].status === 'available') { avail = slot.instances[i]; break; }
    }
    if (avail) {
      return '<span class="cs-badge cs-badge--available">' + avail.seatsRemaining + ' of ' + avail.capacity + ' spots open</span>';
    }
    return '<span class="cs-badge cs-badge--full">Full — inquire for waitlist</span>';
  }

  function slotCardHtml(slot) {
    var first = slot.instances[0];
    if (!first) return '';

    var isRecurring  = slot.instances.length >= 2;
    var d            = parseDate(first.start);
    var dayPart      = slot.dayOfWeek >= 0 && d
      ? (isRecurring ? DAY_PLURAL[slot.dayOfWeek] : DAY_SINGLE[slot.dayOfWeek] + ', ' + shortDate(d))
      : '';
    var tr           = fmtTimeRange(first.start, first.end);
    var dayTimeLabel = dayPart && tr ? dayPart + ' · ' + tr : dayPart || tr;

    var subParts = [];
    if (slot.location) subParts.push('<span>' + esc(slot.location) + '</span>');
    subParts.push('<span>Up to ' + (slot.capacity || 3) + ' participants</span>');

    var datesHtml = '';
    if (isRecurring) {
      var chips = slot.instances.slice(0, 4).map(function (inst) {
        return '<span class="cs-date-chip">' + esc(longDate(parseDate(inst.start))) + '</span>';
      }).join('');
      if (slot.instances.length > 4) {
        chips += '<span class="cs-date-chip" style="opacity:0.55">+' + (slot.instances.length - 4) + ' more</span>';
      }
      datesHtml = '<div class="cs-slot-dates"><span class="cs-slot-dates-label">Upcoming: </span>' + chips + '</div>';
    }

    var anyAvail = slot.instances.some(function (i) { return i.status === 'available'; });

    return (
      '<div class="cs-slot-card" data-slot-key="' + esc(slot.key) + '">' +
        '<div class="cs-slot-header">' +
          '<p class="cs-slot-class-name">' + esc(classDisplayName(slot.classId)) + '</p>' +
          slotBadgeHtml(slot) +
        '</div>' +
        '<p class="cs-slot-day-time">' + esc(dayTimeLabel) + '</p>' +
        '<p class="cs-slot-sub">' + subParts.join('') + '</p>' +
        datesHtml +
        '<button class="cs-toggle" type="button" aria-expanded="false">' +
          esc(anyAvail ? 'Request This Time' : 'Express Interest') +
        '</button>' +
        '<div class="cs-form" hidden></div>' +
      '</div>'
    );
  }

  function inquiryFormHtml(slot, savedValues) {
    var v = savedValues || {};

    var dateFieldHtml = '';
    if (slot.instances.length >= 2) {
      var opts = slot.instances.map(function (inst) {
        var label = longDate(parseDate(inst.start)) + ' — ' + fmtTimeRange(inst.start, inst.end);
        var sel   = v.dateEventId === inst.eventId ? ' selected' : '';
        return '<option value="' + esc(inst.eventId) + '"' + sel + '>' + esc(label) + '</option>';
      }).join('');
      opts += '<option value="__flexible__"' + (v.dateEventId === '__flexible__' ? ' selected' : '') + '>Another time — I’m flexible</option>';
      dateFieldHtml = (
        '<div class="cs-form-row">' +
          '<label for="cs-date">Which date works best? <span style="font-weight:400;opacity:0.7">(optional)</span></label>' +
          '<select id="cs-date" name="date">' +
            '<option value="">— Select a date —</option>' +
            opts +
          '</select>' +
        '</div>'
      );
    }

    return (
      '<div class="cs-inquiry-notice">' +
        'Submitting this form does not confirm enrollment or reserve a spot. We’ll follow up to discuss fit, scheduling, and support needs.' +
      '</div>' +
      '<form class="cs-inquiry-form" novalidate>' +
        '<div class="cs-form-row">' +
          '<label for="cs-name">Name <span aria-hidden="true">*</span></label>' +
          '<input id="cs-name" name="name" type="text" autocomplete="name" required placeholder="Your full name" value="' + esc(v.name || '') + '" />' +
        '</div>' +
        '<div class="cs-form-row">' +
          '<label for="cs-email">Email <span aria-hidden="true">*</span></label>' +
          '<input id="cs-email" name="email" type="email" autocomplete="email" required placeholder="your@email.com" value="' + esc(v.email || '') + '" />' +
        '</div>' +
        '<div class="cs-form-row">' +
          '<label for="cs-phone">Phone <span style="font-weight:400;opacity:0.7">(optional)</span></label>' +
          '<input id="cs-phone" name="phone" type="tel" autocomplete="tel" placeholder="(555) 000-0000" value="' + esc(v.phone || '') + '" />' +
        '</div>' +
        dateFieldHtml +
        '<div class="cs-form-row">' +
          '<label for="cs-alttime">If another time works better, let us know <span style="font-weight:400;opacity:0.7">(optional)</span></label>' +
          '<textarea id="cs-alttime" name="alttime" rows="2" placeholder="e.g. Afternoons, weekday mornings, Thursdays…">' + esc(v.alttime || '') + '</textarea>' +
        '</div>' +
        '<div class="cs-form-row">' +
          '<label for="cs-notes">Anything else helpful to know <span style="font-weight:400;opacity:0.7">(optional)</span></label>' +
          '<textarea id="cs-notes" name="notes" rows="3" placeholder="Goals, interests, support preferences, accessibility needs…">' + esc(v.notes || '') + '</textarea>' +
        '</div>' +
        '<p class="cs-form-followup">After you send your inquiry, we’ll reach out to discuss scheduling, goals, and support needs before anything is confirmed.</p>' +
        '<div class="cs-form-actions">' +
          '<button class="cs-submit btn btn-primary" type="submit">Send My Inquiry</button>' +
          '<button class="cs-cancel" type="button">Cancel</button>' +
        '</div>' +
        '<div class="cs-msg" hidden role="status"></div>' +
      '</form>'
    );
  }

  // ── Form submission ─────────────────────────────────────────────────────────

  function getFormValues(form) {
    return {
      name:        ((form.querySelector('[name="name"]')    || {}).value || ''),
      email:       ((form.querySelector('[name="email"]')   || {}).value || ''),
      phone:       ((form.querySelector('[name="phone"]')   || {}).value || ''),
      alttime:     ((form.querySelector('[name="alttime"]') || {}).value || ''),
      notes:       ((form.querySelector('[name="notes"]')   || {}).value || ''),
      dateEventId: ((form.querySelector('[name="date"]')    || {}).value || ''),
    };
  }

  function showMsg(form, type, text) {
    var el = form.querySelector('.cs-msg');
    if (!el) return;
    el.className  = 'cs-msg cs-msg--' + type;
    el.textContent = text;
    el.hidden      = false;
  }

  function lockForm(form) {
    form.querySelectorAll('input, textarea, select').forEach(function (el) { el.disabled = true; });
    var sub = form.querySelector('.cs-submit');
    if (sub) sub.hidden = true;
    var btn = form.querySelector('.cs-cancel');
    if (btn) btn.hidden = true;
  }

  function submitInquiry(form, slot) {
    var v      = getFormValues(form);
    var submit = form.querySelector('.cs-submit');
    var msgEl  = form.querySelector('.cs-msg');

    if (!v.name.trim()) {
      showMsg(form, 'error', 'Please enter your name.');
      var nameEl = form.querySelector('[name="name"]');
      if (nameEl) nameEl.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) {
      showMsg(form, 'error', 'Please enter a valid email address.');
      var emailEl = form.querySelector('[name="email"]');
      if (emailEl) emailEl.focus();
      return;
    }

    // Resolve eventId: date dropdown choice, otherwise first available instance, otherwise first
    var eventId;
    if (v.dateEventId && v.dateEventId !== '__flexible__') {
      eventId = v.dateEventId;
    } else {
      var fallback = null;
      for (var i = 0; i < slot.instances.length; i++) {
        if (slot.instances[i].status === 'available') { fallback = slot.instances[i]; break; }
      }
      eventId = (fallback || slot.instances[0]).eventId;
    }

    // Compose notes: prefix with alternate time preference when provided
    var combinedNotes = '';
    if (v.alttime.trim()) {
      combinedNotes = 'Preferred alternate times: ' + v.alttime.trim();
      if (v.notes.trim()) combinedNotes += '\n\n' + v.notes.trim();
    } else {
      combinedNotes = v.notes.trim();
    }

    if (submit) { submit.disabled = true; submit.textContent = 'Sending…'; }
    if (msgEl)  { msgEl.hidden = true; }

    fetch(SIGNUP_API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:    v.name.trim(),
        email:   v.email.trim(),
        phone:   v.phone.trim(),
        notes:   combinedNotes,
        eventId: eventId,
        classId: slot.classId,
      }),
    })
    .then(function (res) { return res.json().then(function (d) { return { status: res.status, data: d }; }); })
    .then(function (r) {
      var d = r.data;
      if (d.result === 'pending') {
        showMsg(form, 'success', d.message || 'Your inquiry has been received. We’ll be in touch soon to discuss scheduling and next steps.');
        lockForm(form);
      } else if (d.result === 'waitlist') {
        showMsg(form, 'waitlist', d.message || 'You’re on our list for this time slot. We’ll reach out when a spot opens or to discuss other available times.');
        lockForm(form);
      } else if (d.result === 'duplicate') {
        showMsg(form, 'info', d.message || 'We already have your inquiry for this time slot. We’ll be in touch soon.');
        if (submit) { submit.disabled = false; submit.textContent = 'Send My Inquiry'; }
      } else {
        showMsg(form, 'error', d.error || 'Something went wrong. Please try again or contact us directly.');
        if (submit) { submit.disabled = false; submit.textContent = 'Send My Inquiry'; }
      }
    })
    .catch(function () {
      showMsg(form, 'error', 'Unable to submit right now. Please try again or reach out to us directly.');
      if (submit) { submit.disabled = false; submit.textContent = 'Send My Inquiry'; }
    });
  }

  // ── Card event binding ──────────────────────────────────────────────────────

  function bindSlotCard(card, slot) {
    var toggle  = card.querySelector('.cs-toggle');
    var formDiv = card.querySelector('.cs-form');
    if (!toggle || !formDiv) return;

    toggle.addEventListener('click', function () {
      var isOpen = !formDiv.hidden;
      if (isOpen) {
        formDiv.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = toggle.dataset.openLabel || 'Request This Time';
      } else {
        var savedValues  = {};
        var existingForm = formDiv.querySelector('.cs-inquiry-form');
        if (existingForm) savedValues = getFormValues(existingForm);

        toggle.dataset.openLabel = toggle.textContent;
        formDiv.innerHTML        = inquiryFormHtml(slot, savedValues);
        formDiv.hidden           = false;
        toggle.setAttribute('aria-expanded', 'true');
        toggle.textContent = 'Close';

        var nameInput = formDiv.querySelector('[name="name"]');
        if (nameInput) nameInput.focus();

        var cancelBtn = formDiv.querySelector('.cs-cancel');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', function () {
            formDiv.hidden = true;
            toggle.setAttribute('aria-expanded', 'false');
            toggle.textContent = toggle.dataset.openLabel || 'Request This Time';
          });
        }

        var inquiryForm = formDiv.querySelector('.cs-inquiry-form');
        if (inquiryForm) {
          inquiryForm.addEventListener('submit', function (e) {
            e.preventDefault();
            submitInquiry(inquiryForm, slot);
          });
        }
      }
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  function renderSlots(container, sessions) {
    if (!sessions.length) {
      container.innerHTML =
        '<p class="cs-empty">No sessions are currently listed. Check back soon, or <a href="/contact.html">reach out</a> to ask about upcoming availability or request a different time.</p>';
      return;
    }

    var slots   = groupSessions(sessions);
    var slotMap = {};
    slots.forEach(function (s) { slotMap[s.key] = s; });

    container.innerHTML =
      '<div class="cs-section-notice">Submitting an inquiry does not confirm enrollment or reserve a spot. We’ll follow up to discuss fit, scheduling, and support needs. If none of these times work, you can mention your preferred times in the form.</div>' +
      slots.map(slotCardHtml).join('');

    container.querySelectorAll('.cs-slot-card').forEach(function (card) {
      var slot = slotMap[card.dataset.slotKey];
      if (slot) bindSlotCard(card, slot);
    });
  }

  function renderError(container, msg) {
    container.innerHTML =
      '<p class="cs-api-error">' + esc(msg) + ' <a href="/contact.html">Contact us</a> to ask about upcoming sessions.</p>';
  }

  function init() {
    var container = document.getElementById('class-sessions-list');
    if (!container) return;

    injectStyles();
    container.innerHTML = '<p class="cs-loading">Loading weekly schedule…</p>';

    fetch(AVAIL_API)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data.error) { renderError(container, data.error); return; }
        renderSlots(container, data.sessions || []);
      })
      .catch(function () {
        renderError(container, 'Unable to load class schedule right now.');
      });
  }

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  document.addEventListener('w2s:page-rendered', function (e) {
    if (e && e.detail && e.detail.page === 'creative-workshops') {
      init();
    }
  });

})();
