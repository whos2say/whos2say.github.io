
// Google Analytics 4 Event Tracking for Who's to Say ? Foundation
document.addEventListener('DOMContentLoaded', function () {
  // Track "Donate" button clicks
  const donateButton = document.querySelector('a.btn-primary[href*="givebutter.com"]');
  if (donateButton) {
    donateButton.addEventListener('click', function () {
      gtag('event', 'donate_click', {
        event_category: 'Donations',
        event_label: 'Givebutter Button'
      });
    });
  }

  // Track "Partnership Email" button clicks
  const partnershipButton = document.querySelector('a.btn-secondary[href^="mailto:partnership@whostosay.org"]');
  if (partnershipButton) {
    partnershipButton.addEventListener('click', function () {
      gtag('event', 'partnership_email_click', {
        event_category: 'Outreach',
        event_label: 'Partnership CTA'
      });
    });
  }

  // Track scroll depth (50%)
  let scrollTracked = false;
  window.addEventListener('scroll', function () {
    if (!scrollTracked && (window.scrollY + window.innerHeight) >= document.body.scrollHeight / 2) {
      gtag('event', 'scroll_50_percent', {
        event_category: 'Engagement',
        event_label: 'Scrolled 50%'
      });
      scrollTracked = true;
    }
  });

  // Timer-based engagement (30 seconds)
  setTimeout(function () {
    gtag('event', 'engaged_30_seconds', {
      event_category: 'Engagement',
      event_label: 'Stayed 30s on Page'
    });
  }, 30000);

  // Page exit intent (desktop only)
  document.addEventListener('mouseout', function (e) {
    if (!e.toElement && !e.relatedTarget && e.clientY < 10) {
      gtag('event', 'exit_intent', {
        event_category: 'Engagement',
        event_label: 'Mouse Exit Top'
      });
    }
  });
});
