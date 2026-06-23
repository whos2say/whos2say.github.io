/**
 * Class availability widget for Creative Workshops page.
 *
 * Listens for 'w2s:page-rendered' (fired by render-full-pages.js after the
 * creative-workshops page body is written), then:
 *   1. Fetches /api/class-availability
 *   2. Renders session cards with seat counts
 *   3. Provides an inline signup form per session
 *   4. Submits to /api/class-signup and shows result messages
 */
(function () {
  'use strict';

  var AVAIL_API  = '/api/class-availability';
  var SIGNUP_API = '/api/class-signup';

  // ── Styles ────────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('class-sessions-styles')) return;
    var style = document.createElement('style');
    style.id  = 'class-sessions-styles';
    style.textContent = [
      '.class-sessions-list { display: flex; flex-direction: column; gap: 1.5rem; margin-top: 1rem; }',
      '.cs-card { background: var(--card-bg, #1a1a2e); border: 1px solid var(--border, rgba(255,255,255,0.1)); border-radius: 12px; padding: 1.5rem; }',
      '.cs-card-header { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 0.75rem; margin-bottom: 1rem; }',
      '.cs-title { font-size: 1.1rem; font-weight: 700; margin: 0; }',
      '.cs-badge { display: inline-block; font-size: 0.78rem; font-weight: 600; padding: 0.25rem 0.65rem; border-radius: 20px; white-space: nowrap; }',
      '.cs-badge--available { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }',
      '.cs-badge--full     { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }',
      '.cs-meta { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; font-size: 0.9rem; opacity: 0.82; margin-bottom: 1rem; }',
      '.cs-meta span::before { margin-right: 0.3rem; }',
      '.cs-seats { font-size: 0.88rem; opacity: 0.75; margin-bottom: 1rem; }',
      '.cs-toggle { background: none; border: 1px solid currentColor; border-radius: 6px; padding: 0.45rem 1rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; color: inherit; opacity: 0.9; transition: opacity 0.15s; }',
      '.cs-toggle:hover { opacity: 1; }',
      '.cs-form { margin-top: 1.25rem; border-top: 1px solid var(--border, rgba(255,255,255,0.1)); padding-top: 1.25rem; }',
      '.cs-form-row { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }',
      '.cs-form-row label { font-size: 0.88rem; font-weight: 600; }',
      '.cs-form-row input, .cs-form-row textarea { background: var(--input-bg, rgba(255,255,255,0.06)); border: 1px solid var(--border, rgba(255,255,255,0.15)); border-radius: 6px; padding: 0.55rem 0.75rem; font-size: 0.95rem; color: inherit; width: 100%; box-sizing: border-box; font-family: inherit; }',
      '.cs-form-row input:focus, .cs-form-row textarea:focus { outline: 2px solid var(--accent, #7c3aed); outline-offset: 1px; }',
      '.cs-form-actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }',
      '.cs-submit { background: var(--accent, #7c3aed); color: #fff; border: none; border-radius: 6px; padding: 0.55rem 1.4rem; font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: opacity 0.15s; }',
      '.cs-submit:hover:not(:disabled) { opacity: 0.88; }',
      '.cs-submit:disabled { opacity: 0.5; cursor: not-allowed; }',
      '.cs-cancel { background: none; border: none; font-size: 0.9rem; cursor: pointer; color: inherit; opacity: 0.65; padding: 0.55rem 0.25rem; }',
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

  // ── Date formatting ───────────────────────────────────────────────────────

  function formatDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } catch (e) { return iso; }
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    } catch (e) { return ''; }
  }

  function formatTimeRange(start, end) {
    var s = formatTime(start);
    var e = end ? formatTime(end) : '';
    return e ? s + ' – ' + e : s;
  }

  // ── HTML helpers ──────────────────────────────────────────────────────────

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function sessionCardHtml(session) {
    var available = session.status === 'available';
    var badge     = available
      ? '<span class="cs-badge cs-badge--available">' + session.seatsRemaining + ' of ' + session.capacity + ' seats open</span>'
      : '<span class="cs-badge cs-badge--full">Full — waitlist open</span>';

    var meta = '<div class="cs-meta">';
    meta += '<span>' + escHtml(formatDate(session.start)) + '</span>';
    var timeRange = formatTimeRange(session.start, session.end);
    if (timeRange) meta += '<span>' + escHtml(timeRange) + '</span>';
    if (session.location) meta += '<span>' + escHtml(session.location) + '</span>';
    meta += '</div>';

    var toggleLabel = available ? 'Sign Up' : 'Join Waitlist';

    return (
      '<div class="cs-card" data-event-id="' + escHtml(session.eventId) + '" data-class-id="' + escHtml(session.classId) + '">' +
        '<div class="cs-card-header">' +
          '<p class="cs-title">' + escHtml(session.title) + '</p>' +
          badge +
        '</div>' +
        meta +
        '<button class="cs-toggle btn btn-secondary" type="button" aria-expanded="false">' + toggleLabel + '</button>' +
        '<div class="cs-form" hidden></div>' +
      '</div>'
    );
  }

  function signupFormHtml(session, savedValues) {
    var v = savedValues || {};
    return (
      '<form class="cs-signup-form" novalidate>' +
        '<div class="cs-form-row">' +
          '<label for="cs-name">Name <span aria-hidden="true">*</span></label>' +
          '<input id="cs-name" name="name" type="text" autocomplete="name" required placeholder="Your full name" value="' + escHtml(v.name || '') + '" />' +
        '</div>' +
        '<div class="cs-form-row">' +
          '<label for="cs-email">Email <span aria-hidden="true">*</span></label>' +
          '<input id="cs-email" name="email" type="email" autocomplete="email" required placeholder="your@email.com" value="' + escHtml(v.email || '') + '" />' +
        '</div>' +
        '<div class="cs-form-row">' +
          '<label for="cs-phone">Phone <span style="font-weight:400;opacity:0.7">(optional)</span></label>' +
          '<input id="cs-phone" name="phone" type="tel" autocomplete="tel" placeholder="(555) 000-0000" value="' + escHtml(v.phone || '') + '" />' +
        '</div>' +
        '<div class="cs-form-row">' +
          '<label for="cs-notes">Notes <span style="font-weight:400;opacity:0.7">(optional)</span></label>' +
          '<textarea id="cs-notes" name="notes" rows="3" placeholder="Anything helpful to know before the session…">' + escHtml(v.notes || '') + '</textarea>' +
        '</div>' +
        '<div class="cs-form-actions">' +
          '<button class="cs-submit btn btn-primary" type="submit">Submit Request</button>' +
          '<button class="cs-cancel" type="button">Cancel</button>' +
        '</div>' +
        '<div class="cs-msg" hidden role="status"></div>' +
      '</form>'
    );
  }

  // ── Form submission ───────────────────────────────────────────────────────

  function getFormValues(form) {
    return {
      name:  (form.querySelector('[name="name"]')  || {}).value || '',
      email: (form.querySelector('[name="email"]') || {}).value || '',
      phone: (form.querySelector('[name="phone"]') || {}).value || '',
      notes: (form.querySelector('[name="notes"]') || {}).value || '',
    };
  }

  function showMsg(form, type, text) {
    var el = form.querySelector('.cs-msg');
    if (!el) return;
    el.className = 'cs-msg cs-msg--' + type;
    el.textContent = text;
    el.hidden = false;
  }

  function submitSignup(form, eventId, classId) {
    var values  = getFormValues(form);
    var submit  = form.querySelector('.cs-submit');
    var msgEl   = form.querySelector('.cs-msg');

    if (!values.name.trim()) {
      showMsg(form, 'error', 'Please enter your name.');
      form.querySelector('[name="name"]').focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      showMsg(form, 'error', 'Please enter a valid email address.');
      form.querySelector('[name="email"]').focus();
      return;
    }

    if (submit) { submit.disabled = true; submit.textContent = 'Submitting…'; }
    if (msgEl)  { msgEl.hidden = true; }

    fetch(SIGNUP_API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:    values.name.trim(),
        email:   values.email.trim(),
        phone:   values.phone.trim(),
        notes:   values.notes.trim(),
        eventId: eventId,
        classId: classId,
      }),
    })
    .then(function (res) { return res.json().then(function (d) { return { status: res.status, data: d }; }); })
    .then(function (r) {
      var d = r.data;
      if (d.result === 'pending') {
        showMsg(form, 'success', d.message || 'Signup request received!');
        form.querySelectorAll('input, textarea').forEach(function (el) { el.disabled = true; });
        if (submit) { submit.hidden = true; }
        form.querySelector('.cs-cancel') && (form.querySelector('.cs-cancel').hidden = true);
      } else if (d.result === 'waitlist') {
        showMsg(form, 'waitlist', d.message || "You've been added to the waitlist.");
        form.querySelectorAll('input, textarea').forEach(function (el) { el.disabled = true; });
        if (submit) { submit.hidden = true; }
        form.querySelector('.cs-cancel') && (form.querySelector('.cs-cancel').hidden = true);
      } else if (d.result === 'duplicate') {
        showMsg(form, 'info', d.message || 'You are already signed up for this session.');
        if (submit) { submit.disabled = false; submit.textContent = 'Submit Request'; }
      } else {
        showMsg(form, 'error', d.error || 'Something went wrong. Please try again.');
        if (submit) { submit.disabled = false; submit.textContent = 'Submit Request'; }
      }
    })
    .catch(function () {
      showMsg(form, 'error', 'Unable to submit. Please try again or contact us directly.');
      if (submit) { submit.disabled = false; submit.textContent = 'Submit Request'; }
    });
  }

  // ── Card event binding ────────────────────────────────────────────────────

  function bindCard(card) {
    var eventId = card.dataset.eventId;
    var classId = card.dataset.classId;
    var toggle  = card.querySelector('.cs-toggle');
    var formDiv = card.querySelector('.cs-form');

    if (!toggle || !formDiv) return;

    toggle.addEventListener('click', function () {
      var isOpen = !formDiv.hidden;
      if (isOpen) {
        formDiv.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = toggle.dataset.openLabel || 'Sign Up';
      } else {
        var savedValues = {};
        var existingForm = formDiv.querySelector('.cs-signup-form');
        if (existingForm) savedValues = getFormValues(existingForm);

        toggle.dataset.openLabel = toggle.textContent;
        formDiv.innerHTML = signupFormHtml({ eventId: eventId, classId: classId }, savedValues);
        formDiv.hidden    = false;
        toggle.setAttribute('aria-expanded', 'true');
        toggle.textContent = 'Close';

        var nameInput = formDiv.querySelector('[name="name"]');
        if (nameInput) nameInput.focus();

        formDiv.querySelector('.cs-cancel').addEventListener('click', function () {
          formDiv.hidden = true;
          toggle.setAttribute('aria-expanded', 'false');
          toggle.textContent = toggle.dataset.openLabel || 'Sign Up';
        });

        formDiv.querySelector('.cs-signup-form').addEventListener('submit', function (e) {
          e.preventDefault();
          submitSignup(formDiv.querySelector('.cs-signup-form'), eventId, classId);
        });
      }
    });
  }

  // ── Main render ───────────────────────────────────────────────────────────

  function renderSessions(container, sessions) {
    if (sessions.length === 0) {
      container.innerHTML = '<p class="cs-empty">No sessions are currently scheduled. Check back soon or <a href="/contact.html">contact us</a> to be notified when new dates are added.</p>';
      return;
    }

    container.innerHTML = sessions.map(sessionCardHtml).join('');
    container.querySelectorAll('.cs-card').forEach(bindCard);
  }

  function renderError(container, msg) {
    container.innerHTML = '<p class="cs-api-error">' + escHtml(msg) + ' <a href="/contact.html">Contact us</a> to ask about upcoming sessions.</p>';
  }

  function init() {
    var container = document.getElementById('class-sessions-list');
    if (!container) return;

    injectStyles();
    container.innerHTML = '<p class="cs-loading">Loading available sessions…</p>';

    fetch(AVAIL_API)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data.error) {
          renderError(container, data.error);
          return;
        }
        renderSessions(container, data.sessions || []);
      })
      .catch(function () {
        renderError(container, 'Unable to load class schedule right now.');
      });
  }

  // ── Bootstrap — wait for the page render event ───────────────────────────

  document.addEventListener('w2s:page-rendered', function (e) {
    if (e && e.detail && e.detail.page === 'creative-workshops') {
      init();
    }
  });

})();
