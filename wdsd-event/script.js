/* ============================================================
   WORLD DOWN SYNDROME DAY — script.js
   Who's to Say? Foundation
   ============================================================ */

'use strict';

/* ─────────────────────────────────────────
   1. HERO CONFETTI (canvas)
───────────────────────────────────────── */
(function initConfetti() {
  const canvas = document.getElementById('hero-confetti');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const COLORS = ['#F6C644','#ffffff','#7ecfff','#ff9ec4','#a8e6cf','#ffda7a','#c8deff','#ffd700'];
  let pieces = [];
  let raf = null;

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  function piece(fromTop) {
    return {
      x:     Math.random() * canvas.width,
      y:     fromTop ? -12 - Math.random() * 50 : Math.random() * canvas.height,
      w:     5 + Math.random() * 8,
      h:     4 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      angle: Math.random() * Math.PI * 2,
      vx:    (Math.random() - 0.5) * 1.6,
      vy:    0.7 + Math.random() * 1.6,
      va:    (Math.random() - 0.5) * 0.07,
      shape: Math.random() > 0.55 ? 'circle' : 'rect',
      alpha: 0.65 + Math.random() * 0.35,
    };
  }

  function spawn(n, fromTop) {
    for (let i = 0; i < n; i++) pieces.push(piece(fromTop));
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      p.x += p.vx; p.y += p.vy; p.angle += p.va;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
      if (p.y > canvas.height + 20) pieces.splice(i, 1);
    }
    if (pieces.length > 0) raf = requestAnimationFrame(loop);
    else raf = null;
  }

  function start() {
    if (!raf) raf = requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize);

  // Initial burst
  spawn(80, false);
  start();

  // Periodic top-fall
  setInterval(() => { spawn(22, true); start(); }, 3800);

  // Expose for celebration use
  window.burstConfetti = function(n) { spawn(n || 120, true); start(); };
})();


/* ─────────────────────────────────────────
   2. COUNTDOWN
   Target: 2026-03-21 3:21:00 PM ET (EDT = UTC-4)
   DST begins 2026-03-08, so 3/21 is EDT.
   3:21 PM EDT = 19:21 UTC
───────────────────────────────────────── */
(function initCountdown() {
  const TARGET = Date.UTC(2026, 2, 21, 19, 21, 0); // month 0-indexed

  const dEl  = document.getElementById('cd-days');
  const hEl  = document.getElementById('cd-hours');
  const mEl  = document.getElementById('cd-mins');
  const sEl  = document.getElementById('cd-secs');
  const wrap = document.getElementById('countdown-wrap');
  const cel  = document.getElementById('cel-card');

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    const diff = TARGET - Date.now();
    if (diff <= 0) {
      if (wrap) wrap.hidden = true;
      if (cel)  { cel.hidden = false; if (window.burstConfetti) window.burstConfetti(150); }
      return;
    }
    const total = Math.floor(diff / 1000);
    sEl.textContent = pad(total % 60);
    mEl.textContent = pad(Math.floor(total / 60) % 60);
    hEl.textContent = pad(Math.floor(total / 3600) % 24);
    dEl.textContent = pad(Math.floor(total / 86400));
  }

  tick();
  setInterval(tick, 1000);
})();


/* ─────────────────────────────────────────
   3. GALLERY
   Loads from gallery-images.json, shuffles,
   renders masonry grid, opens lightbox.
───────────────────────────────────────── */
(function initGallery() {
  const grid     = document.getElementById('gallery-grid');
  const emptyEl  = document.getElementById('gallery-empty');
  const lightbox = document.getElementById('lightbox');
  const lbImg    = document.getElementById('lb-img');
  const lbCap    = document.getElementById('lb-caption');
  const lbClose  = document.getElementById('lb-close');
  const lbPrev   = document.getElementById('lb-prev');
  const lbNext   = document.getElementById('lb-next');

  if (!grid) return;

  let images = [];
  let current = 0;

  /* Fisher-Yates */
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* Lightbox */
  function open(idx) {
    current = idx;
    const img = images[idx];
    lbImg.src = img.src;
    lbImg.alt = img.alt || '';
    lbCap.textContent = img.alt || '';
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    lbClose.focus();
  }
  function close() {
    lightbox.hidden = true;
    lbImg.src = '';
    document.body.style.overflow = '';
  }
  function prev() { open((current - 1 + images.length) % images.length); }
  function next() { open((current + 1) % images.length); }

  lbClose.addEventListener('click', close);
  lbPrev.addEventListener('click',  prev);
  lbNext.addEventListener('click',  next);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) close(); });
  document.addEventListener('keydown', e => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape')     close();
    if (e.key === 'ArrowLeft')  prev();
    if (e.key === 'ArrowRight') next();
  });

  /* Render */
  function render(data) {
    grid.innerHTML = '';
    if (!data || !data.length) { emptyEl && (emptyEl.hidden = false); return; }
    images = shuffle(data);

    images.forEach((img, i) => {
      const item = document.createElement('div');
      item.className = 'gallery-item fade-up';
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', img.alt || `Photo ${i + 1}`);

      const el = document.createElement('img');
      el.src = img.src;
      el.alt = img.alt || '';
      el.loading = 'lazy';
      el.decoding = 'async';
      // Natural image size drives masonry height — no fixed height set in CSS

      const overlay = document.createElement('div');
      overlay.className = 'gallery-overlay';
      overlay.innerHTML = '<span class="gallery-overlay-icon">🔍</span>';

      item.appendChild(el);
      item.appendChild(overlay);
      grid.appendChild(item);

      item.addEventListener('click', () => open(i));
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); }
      });
    });

    // Staggered entrance
    requestAnimationFrame(() => {
      document.querySelectorAll('.gallery-item.fade-up').forEach((el, i) => {
        setTimeout(() => el.classList.add('visible'), i * 55);
      });
    });
  }

  fetch('gallery-images.json')
    .then(r => { if (!r.ok) throw new Error('no data'); return r.json(); })
    .then(data => render(data))
    .catch(() => { grid.innerHTML = ''; emptyEl && (emptyEl.hidden = false); });
})();


/* ─────────────────────────────────────────
   4. RSVP FORM
───────────────────────────────────────── */
(function initRSVP() {
  const form    = document.getElementById('rsvp-form');
  const success = document.getElementById('rsvp-success');
  if (!form) return;

  const radios     = form.querySelectorAll('input[name="attending"]');
  const guestGroup = document.getElementById('guest-count-group');
  const pills      = form.querySelectorAll('.radio-pill');

  // Show/hide guest count
  radios.forEach(r => {
    r.addEventListener('change', () => {
      if (guestGroup) guestGroup.hidden = r.value !== 'yes';
    });
  });

  // Visual pill selection (fallback for browsers without :has)
  pills.forEach(pill => {
    const input = pill.querySelector('input[type="radio"]');
    if (!input) return;
    input.addEventListener('change', () => {
      pills.forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
    });
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const action = form.getAttribute('action') || '';
    const btn = form.querySelector('button[type="submit"]');

    // Placeholder / dev mode
    if (!action || action === 'REPLACE_WITH_FORM_ENDPOINT' || action === '#') {
      form.hidden   = true;
      success.hidden = false;
      return;
    }

    // Disable button while submitting
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    try {
      const res = await fetch(action, {
        method:  'POST',
        body:    new FormData(form),
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        form.hidden   = true;
        success.hidden = false;
      } else {
        alert('Something went wrong. Please try again.');
        if (btn) { btn.disabled = false; btn.textContent = 'Send My RSVP 💙'; }
      }
    } catch {
      alert('Network error. Please check your connection and try again.');
      if (btn) { btn.disabled = false; btn.textContent = 'Send My RSVP 💙'; }
    }
  });
})();


/* ─────────────────────────────────────────
   5. ENTRANCE ANIMATIONS (IntersectionObserver)
───────────────────────────────────────── */
(function initAnimations() {
  const targets = document.querySelectorAll(
    '.event-card, .countdown-wrap, .memory-grid, .rsvp-grid, ' +
    '.section-title, .eyebrow, .form-card'
  );
  targets.forEach(el => el.classList.add('fade-up'));

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  targets.forEach(el => io.observe(el));
})();
