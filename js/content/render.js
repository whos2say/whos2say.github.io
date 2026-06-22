/**
 * Who's to Say Foundation — site content loader & renderers.
 *
 * Public pages read copy from JSON files in /content/.
 * Edit JSON directly, or use Decap CMS at /admin/ (see docs/CONTENT_EDITING.md).
 *
 * HTML pages keep their layout as fallback; this script syncs live copy on load.
 */
(function (global) {
  'use strict';

  var CACHE = {};

  function fetchJson(url) {
    if (CACHE[url]) return Promise.resolve(CACHE[url]);
    return fetch(url, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load ' + url + ' (' + res.status + ')');
        return res.json();
      })
      .then(function (data) {
        CACHE[url] = data;
        return data;
      });
  }

  function setMeta(title, description) {
    if (title) document.title = title;
    if (description) {
      var meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', description);
    }
  }

  function renderBlocks(blocks) {
    return (blocks || [])
      .map(function (block) {
        switch (block.type) {
          case 'paragraph':
            return '<p>' + block.html + '</p>';
          case 'h3':
            return '<h3>' + block.text + '</h3>';
          case 'ul':
            return (
              '<ul>' +
              (block.items || []).map(function (item) {
                return '<li>' + item + '</li>';
              }).join('') +
              '</ul>'
            );
          case 'html':
            return block.html;
          default:
            return '';
        }
      })
      .join('\n');
  }

  function renderProgramSections(sections) {
    return (sections || [])
      .map(function (section) {
        return (
          '<section class="program-section">' +
          '<h2>' + section.title + '</h2>' +
          renderBlocks(section.blocks) +
          '</section>'
        );
      })
      .join('\n');
  }

  function renderProgramSidebar(sidebar) {
    if (!sidebar) return '';
    var gs = sidebar.getStarted || {};
    var accordions = (sidebar.accordions || [])
      .map(function (acc) {
        return (
          '<details class="accordion"' + (acc.open ? ' open=""' : '') + '>' +
          '<summary>' + acc.summary + '</summary>' +
          '<div class="accordion-body">' +
          renderBlocks(acc.blocks) +
          '</div></details>'
        );
      })
      .join('');

    return (
      '<div class="program-sidebar-card">' +
      '<h3>' + sidebar.sessionStyle.title + '</h3>' +
      '<ul>' +
      sidebar.sessionStyle.items.map(function (i) {
        return '<li>' + i + '</li>';
      }).join('') +
      '</ul></div>' +
      '<div class="program-sidebar-card">' +
      '<h3>' + gs.title + '</h3>' +
      '<p>' + gs.prompt + '</p>' +
      '<div class="btn-row">' +
      '<a class="btn btn-primary" href="' + gs.primaryHref + '">' + gs.primaryLabel + '</a>' +
      '<a class="btn btn-secondary" href="' + gs.secondaryHref + '">' + gs.secondaryLabel + '</a>' +
      '</div></div>' +
      '<div class="accordion-stack">' +
      accordions +
      '</div>'
    );
  }

  function renderProgramPage(data) {
    setMeta(data.meta && data.meta.title, data.meta && data.meta.description);

    var hero = data.hero;
    var heroMedia = document.querySelector('.program-hero-media img, .program-hero .program-hero-media img');
    if (heroMedia && hero.image) {
      heroMedia.src = hero.image;
    }

    var heroBody = document.querySelector('.program-hero-body');
    if (heroBody && hero) {
      heroBody.innerHTML =
        '<div class="breadcrumb">' +
        '<a href="/programs.html">Programs</a><span>›</span><span>' + hero.breadcrumb + '</span>' +
        '</div>' +
        '<h1>' + hero.title + '</h1>' +
        '<p class="program-subtitle">' + hero.subtitle + '</p>' +
        '<div class="pills">' +
        hero.pills.map(function (p) {
          return '<span class="pill">' + p + '</span>';
        }).join('') +
        '</div>' +
        '<div class="best-for-inline"><strong>Best for:</strong> ' + hero.bestFor + '</div>';
    }

    var content = document.querySelector('.program-content');
    if (content) content.innerHTML = renderProgramSections(data.sections);

    var sidebar = document.querySelector('.program-sidebar');
    if (sidebar) sidebar.innerHTML = renderProgramSidebar(data.sidebar);
  }

  function renderHomepage(data, site) {
    setMeta(data.meta && data.meta.title, data.meta && data.meta.description);

    var kicker = document.querySelector('.home-kicker');
    if (kicker && data.hero) kicker.textContent = data.hero.kicker;

    var h1 = document.querySelector('.home-hero h1');
    if (h1 && data.hero) h1.textContent = data.hero.title;

    var sub = document.querySelector('.home-subhead');
    if (sub && data.hero) sub.innerHTML = data.hero.subheadHtml || data.hero.subhead;

    var notes = document.querySelectorAll('.home-note');
    if (notes[0] && data.hero) notes[0].textContent = data.hero.note;
    if (notes[1] && data.hero) notes[1].innerHTML = data.hero.legalLine;

    var actions = document.querySelector('.home-actions');
    if (actions && data.actions) {
      actions.innerHTML = data.actions
        .map(function (a) {
          var ext = a.external ? ' rel="noopener" target="_blank"' : '';
          return (
            '<a class="btn btn-' + (a.style || 'primary') + '" href="' + a.href + '"' + ext + '>' + a.label + '</a>'
          );
        })
        .join('\n');
    }

    var autism = data.autismMonth;
    var section = document.querySelector('.autism-month');
    if (section && autism) {
      section.style.display = autism.enabled === false ? 'none' : '';
      var eyebrow = section.querySelector('.autism-eyebrow');
      if (eyebrow) eyebrow.textContent = autism.eyebrow;
      var title = section.querySelector('.autism-title');
      if (title) title.innerHTML = autism.title + '<br><span class="autism-gold">' + autism.titleAccent + '</span>';
      var body = section.querySelector('.autism-body');
      if (body) body.innerHTML = autism.bodyHtml || autism.body.replace(/\n\n/g, '<br><br>');
      var actWrap = section.querySelector('.autism-actions');
      if (actWrap && autism.actions) {
        actWrap.innerHTML = autism.actions
          .map(function (a) {
            var cls = a.style === 'ghost' ? 'btn-autism-ghost' : 'btn-autism-primary';
            var ext = a.external ? ' rel="noopener" target="_blank"' : '';
            return '<a class="' + cls + '" href="' + a.href + '"' + ext + '>' + a.label + '</a>';
          })
          .join('\n');
      }
      var link = section.querySelector('.autism-wdsd-link');
      if (link && autism.link) {
        link.href = autism.link.href;
        link.textContent = autism.link.label;
      }
    }
  }

  function renderProgramsIndex(data) {
    setMeta(data.meta && data.meta.title);

    var heroTitle = document.querySelector('.programs-hero h1');
    if (heroTitle) heroTitle.textContent = data.hero.title;
    var heroSub = document.querySelector('.programs-hero p');
    if (heroSub) heroSub.textContent = data.hero.subtitle;

    var heading = document.querySelector('.section-heading h2');
    if (heading) heading.textContent = data.gridHeading.title;
    var headingP = document.querySelector('.section-heading > p');
    if (headingP) headingP.textContent = data.gridHeading.subtitle;

    var grid = document.querySelector('.program-grid');
    if (grid && data.programs) {
      grid.innerHTML = data.programs
        .map(function (p) {
          return (
            '<a class="program-card" id="' + p.id + '" data-path="' + p.id + '" href="' + p.href + '">' +
            '<div class="card-media"><img alt="" decoding="async" loading="lazy" src="' + p.image + '"/></div>' +
            '<div class="card-content">' +
            '<span class="program-label">' + p.label + '</span>' +
            '<h3>' + p.title + '</h3>' +
            '<p>' + p.summary + '</p>' +
            '</div></a>'
          );
        })
        .join('\n');
    }

    var how = data.howPathways;
    if (how) {
      var howTitle = document.querySelector('.how-pathways h2');
      if (howTitle) howTitle.textContent = how.title;
      var howSub = document.querySelector('.how-sub');
      if (howSub) howSub.textContent = how.subtitle;
      var howGrid = document.querySelector('.how-grid');
      if (howGrid) {
        howGrid.innerHTML = how.steps
          .map(function (s) {
            return (
              '<div class="how-card">' +
              '<div class="how-icon" aria-hidden="true">' + s.icon + '</div>' +
              '<h3>' + s.title + '</h3>' +
              '<p>' + s.body + '</p></div>'
            );
          })
          .join('\n');
      }
    }
  }

  function renderContact(data, faqs, site) {
    setMeta(data.meta && data.meta.title, data.meta && data.meta.description);

    var h1 = document.querySelector('.contact-hero h1, .program-hero-body h1');
    if (h1) h1.textContent = data.hero.title;
    var sub = document.querySelector('.program-subtitle');
    if (sub) sub.textContent = data.hero.subtitle;

    var pills = document.querySelector('.pills');
    if (pills && data.hero.pills) {
      pills.innerHTML = data.hero.pills.map(function (p) {
        return '<span class="pill">' + p + '</span>';
      }).join('');
    }

    var formTitle = document.querySelector('.program-section h2');
    if (formTitle) formTitle.textContent = data.form.title;
    var formIntro = document.querySelector('.program-section > p');
    if (formIntro) formIntro.textContent = data.form.intro;

    var email = site && site.contact ? site.contact.email : 'info@whostosay.org';
    var phone = site && site.contact ? site.contact.phone : '(732) 314-1943';
    var phoneTel = site && site.contact ? site.contact.phoneTel : '+17323141943';

    document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
      a.href = 'mailto:' + email;
      a.textContent = email;
    });
    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      a.href = 'tel:' + phoneTel;
      a.textContent = phone;
    });

    var bestFor = document.querySelector('.program-sidebar-card:nth-of-type(2) ul');
    if (bestFor && data.sidebar.bestForItems) {
      bestFor.innerHTML = data.sidebar.bestForItems.map(function (i) {
        return '<li>' + i + '</li>';
      }).join('');
    }

    var accordionStack = document.querySelector('.accordion-stack');
    if (accordionStack && faqs && faqs.items) {
      var contactFaqs = faqs.items.filter(function (f) {
        return (f.tags || []).indexOf('contact') !== -1;
      });
      accordionStack.innerHTML = contactFaqs
        .map(function (f) {
          return (
            '<details class="accordion">' +
            '<summary>' + f.question + '</summary>' +
            '<div class="accordion-body"><p>' + f.answer + '</p></div></details>'
          );
        })
        .join('\n');
    }

    var wc = data.sidebar.workshopCard;
    if (wc && wc.enabled) {
      var aside = document.querySelector('.program-sidebar');
      if (aside) {
        var card = document.createElement('div');
        card.className = 'program-sidebar-card';
        card.innerHTML =
          '<h3>' + wc.title + '</h3><p>' + wc.body + '</p>' +
          '<a class="btn btn-primary" href="' + wc.buttonHref + '">' + wc.buttonLabel + '</a>';
        aside.insertBefore(card, aside.firstChild);
      }
    }
  }

  function bindStoryText(selector, text, html) {
    var el = document.querySelector(selector);
    if (!el) return;
    if (html) el.innerHTML = html;
    else if (text !== undefined) el.textContent = text;
  }

  function initFromBody() {
    var page = document.body.getAttribute('data-content-page');
    if (!page) return Promise.resolve();

    var loads = [fetchJson('/content/site.json')];

    if (page === 'homepage') {
      return fetchJson('/content/homepage.json').then(function (data) {
        return fetchJson('/content/site.json').then(function (site) {
          renderHomepage(data, site);
        });
      });
    }
    if (page === 'programs-index') {
      return fetchJson('/content/programs-index.json').then(renderProgramsIndex);
    }
    if (page === 'contact') {
      return Promise.all([
        fetchJson('/content/contact.json'),
        fetchJson('/content/faqs.json'),
        fetchJson('/content/site.json'),
      ]).then(function (arr) {
        renderContact(arr[0], arr[1], arr[2]);
      });
    }
    if (page.indexOf('programs/') === 0) {
      return fetchJson('/content/' + page + '.json').then(renderProgramPage);
    }
    if (page === 'creative-workshops' || page === 'support-coordinators') {
      return fetchJson('/content/' + page + '.json').then(function (data) {
        if (global.W2SContentRenderFullPage) global.W2SContentRenderFullPage(page, data);
      });
    }

    return Promise.resolve();
  }

  global.W2SContent = {
    fetchJson: fetchJson,
    renderProgramPage: renderProgramPage,
    renderHomepage: renderHomepage,
    renderProgramsIndex: renderProgramsIndex,
    renderContact: renderContact,
    init: initFromBody,
  };

  if (document.body && document.body.hasAttribute('data-content-page')) {
    document.addEventListener('DOMContentLoaded', function () {
      initFromBody().catch(function (err) {
        console.warn('[W2SContent] Content sync skipped:', err.message);
      });
    });
  }
})(window);
