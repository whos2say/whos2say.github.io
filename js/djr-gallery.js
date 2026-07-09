(function () {
  'use strict';

  var albumCache = {};

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isAdminView() {
    return window.location.search.indexOf('admin=1') !== -1 ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
  }

  function fetchJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Failed to load ' + url + ' (' + res.status + ')');
      return res.json();
    });
  }

  function fetchAlbum(albumId) {
    if (!albumId) return Promise.resolve(null);
    if (albumCache[albumId]) return Promise.resolve(albumCache[albumId]);
    return fetchJson('/content/djr-albums/' + encodeURIComponent(albumId) + '.json')
      .then(function (album) {
        albumCache[albumId] = album;
        return album;
      });
  }

  function imageAlt(image, album) {
    return image.alt || image.caption || album.title || 'DJR Photography image';
  }

  function albumImages(album) {
    return (album && album.images || []).filter(function (item) {
      return item && item.image;
    });
  }

  function fallbackHtml(section, reason) {
    var admin = isAdminView();
    if (!admin) {
      return '<div class="djr-fallback">Gallery images are being prepared.</div>';
    }
    return (
      '<div class="djr-fallback djr-admin-warning">' +
      '<strong>DJR CMS warning:</strong> ' +
      escapeHtml(reason || 'Missing album_id') +
      (section && section.album_id ? ' <code>' + escapeHtml(section.album_id) + '</code>' : '') +
      '</div>'
    );
  }

  function renderHero(data, coverAlbum) {
    var hero = data.hero || {};
    var cover = coverAlbum && (coverAlbum.cover_image || (albumImages(coverAlbum)[0] || {}).image);
    var caption = coverAlbum && (coverAlbum.title || coverAlbum.description);
    var el = document.querySelector('[data-djr-hero]');
    if (!el) return;
    el.innerHTML =
      '<div class="djr-hero-inner">' +
      '<div class="djr-hero-copy">' +
      '<p class="djr-eyebrow">' + escapeHtml(hero.kicker || 'DJR Photography') + '</p>' +
      '<h1>' + escapeHtml(hero.title || '') + '</h1>' +
      '<p>' + escapeHtml(hero.subtitle || '') + '</p>' +
      '</div>' +
      (cover ? '<figure class="djr-hero-card">' +
        '<img src="' + escapeHtml(cover) + '" alt="' + escapeHtml(caption || 'DJR Photography featured image') + '" decoding="async" />' +
        '<figcaption>' + escapeHtml(caption || '') + '</figcaption>' +
      '</figure>' : '') +
      '</div>';
  }

  function renderSectionHead(section) {
    return (
      '<header class="djr-section-head">' +
      (section.eyebrow ? '<p class="djr-eyebrow">' + escapeHtml(section.eyebrow) + '</p>' : '') +
      '<h2>' + escapeHtml(section.title || '') + '</h2>' +
      (section.body ? '<p>' + escapeHtml(section.body) + '</p>' : '') +
      '</header>'
    );
  }

  function renderStory(section) {
    return (
      '<section class="djr-section djr-story" id="' + escapeHtml(section.id || '') + '">' +
      '<div class="djr-wrap">' + renderSectionHead(section) + '</div>' +
      '</section>'
    );
  }

  function renderServices(section) {
    var items = (section.items || []).map(function (item) {
      return (
        '<article class="djr-service-card">' +
        '<h3>' + escapeHtml(item.title || '') + '</h3>' +
        '<p>' + escapeHtml(item.body || '') + '</p>' +
        '</article>'
      );
    }).join('');
    return (
      '<section class="djr-section" id="' + escapeHtml(section.id || '') + '">' +
      '<div class="djr-wrap">' +
      renderSectionHead(section) +
      '<div class="djr-services">' + items + '</div>' +
      '</div></section>'
    );
  }

  function renderFeaturedImage(section) {
    if (!section.image) return renderStory(section);
    return (
      '<section class="djr-section" id="' + escapeHtml(section.id || '') + '">' +
      '<div class="djr-wrap">' +
      renderSectionHead(section) +
      '<figure class="djr-hero-card">' +
      '<img src="' + escapeHtml(section.image) + '" alt="' + escapeHtml(section.alt || section.title || '') + '" loading="lazy" decoding="async" />' +
      (section.caption ? '<figcaption>' + escapeHtml(section.caption) + '</figcaption>' : '') +
      '</figure></div></section>'
    );
  }

  function renderAlbumSlideshow(section, album) {
    var images = albumImages(album);
    if (!album || !images.length) return fallbackHtml(section, album ? 'Album has no images.' : 'Album not found for album_id');
    var first = images[0];
    var tags = [];
    images.forEach(function (image) {
      (image.tags || []).forEach(function (tag) {
        if (tags.indexOf(tag) === -1) tags.push(tag);
      });
    });
    return (
      '<div class="djr-album" data-djr-slideshow data-images="' + escapeHtml(JSON.stringify(images)) + '" data-title="' + escapeHtml(album.title || '') + '">' +
      '<div class="djr-slideshow">' +
      '<div class="djr-slide-frame">' +
      '<img data-djr-slide-image src="' + escapeHtml(first.image) + '" alt="' + escapeHtml(imageAlt(first, album)) + '" loading="lazy" decoding="async" />' +
      '<div class="djr-slide-caption"><strong data-djr-slide-caption>' + escapeHtml(first.caption || album.title || '') + '</strong>' +
      '<span data-djr-slide-credit>' + escapeHtml(first.credit || '') + '</span></div>' +
      '</div>' +
      '<div class="djr-slide-controls">' +
      '<button class="djr-icon-btn" type="button" data-djr-prev aria-label="Previous image">&larr;</button>' +
      '<span class="djr-slide-count" data-djr-count>1 / ' + images.length + '</span>' +
      '<button class="djr-icon-btn" type="button" data-djr-next aria-label="Next image">&rarr;</button>' +
      '</div></div>' +
      '<aside class="djr-album-meta">' +
      '<h3>' + escapeHtml(album.title || section.title || '') + '</h3>' +
      '<p>' + escapeHtml(album.description || '') + '</p>' +
      '<div class="djr-tags">' + tags.map(function (tag) {
        return '<span class="djr-tag">' + escapeHtml(tag) + '</span>';
      }).join('') + '</div>' +
      '</aside></div>'
    );
  }

  function renderAlbumGrid(section, album) {
    var images = albumImages(album);
    if (!album || !images.length) return fallbackHtml(section, album ? 'Album has no images.' : 'Album not found for album_id');
    return (
      '<div class="djr-grid">' +
      images.map(function (image) {
        return (
          '<figure>' +
          '<img src="' + escapeHtml(image.image) + '" alt="' + escapeHtml(imageAlt(image, album)) + '" loading="lazy" decoding="async" />' +
          '<figcaption>' + escapeHtml(image.caption || image.credit || album.title || '') + '</figcaption>' +
          '</figure>'
        );
      }).join('') +
      '</div>'
    );
  }

  function renderAlbumSection(section, album, mode) {
    return (
      '<section class="djr-section" id="' + escapeHtml(section.id || '') + '">' +
      '<div class="djr-wrap">' +
      renderSectionHead(section) +
      (mode === 'grid' ? renderAlbumGrid(section, album) : renderAlbumSlideshow(section, album)) +
      '</div></section>'
    );
  }

  function renderContact(section) {
    return (
      '<section class="djr-section djr-contact" id="' + escapeHtml(section.id || '') + '">' +
      '<div class="djr-wrap">' +
      renderSectionHead(section) +
      '<a class="btn" href="' + escapeHtml(section.button_href || '/contact.html') + '">' +
      escapeHtml(section.button_label || 'Contact us') +
      '</a></div></section>'
    );
  }

  function bindSlideshows() {
    document.querySelectorAll('[data-djr-slideshow]').forEach(function (root) {
      var images;
      try { images = JSON.parse(root.getAttribute('data-images') || '[]'); }
      catch (err) { images = []; }
      if (!images.length) return;
      var index = 0;
      var img = root.querySelector('[data-djr-slide-image]');
      var caption = root.querySelector('[data-djr-slide-caption]');
      var credit = root.querySelector('[data-djr-slide-credit]');
      var count = root.querySelector('[data-djr-count]');

      function show(nextIndex) {
        index = (nextIndex + images.length) % images.length;
        var item = images[index];
        img.src = item.image;
        img.alt = imageAlt(item, { title: root.getAttribute('data-title') });
        caption.textContent = item.caption || root.getAttribute('data-title') || '';
        credit.textContent = item.credit || '';
        count.textContent = (index + 1) + ' / ' + images.length;
      }

      root.querySelector('[data-djr-prev]').addEventListener('click', function () { show(index - 1); });
      root.querySelector('[data-djr-next]').addEventListener('click', function () { show(index + 1); });
    });
  }

  function init() {
    fetchJson('/content/djr.json').then(function (data) {
      var sections = data.sections || [];
      var albumIds = sections
        .map(function (section) { return section.album_id; })
        .filter(function (id, index, list) { return id && list.indexOf(id) === index; });

      return Promise.all(albumIds.map(function (id) {
        return fetchAlbum(id).catch(function () { return null; });
      })).then(function (albums) {
        var albumMap = {};
        albums.forEach(function (album) {
          if (album && album.album_id) albumMap[album.album_id] = album;
        });

        document.title = data.meta && data.meta.title || document.title;
        var meta = document.querySelector('meta[name="description"]');
        if (meta && data.meta && data.meta.description) meta.content = data.meta.description;

        renderHero(data, albums[0]);
        document.querySelector('[data-djr-sections]').innerHTML = sections.map(function (section) {
          switch (section.type) {
            case 'story':
              return renderStory(section);
            case 'services':
              return renderServices(section);
            case 'featured_image':
              return renderFeaturedImage(section);
            case 'gallery_album':
            case 'story_slideshow':
              return renderAlbumSection(section, albumMap[section.album_id], 'slideshow');
            case 'image_grid':
              return renderAlbumSection(section, albumMap[section.album_id], 'grid');
            case 'contact':
              return renderContact(section);
            default:
              return renderStory(section);
          }
        }).join('');
        bindSlideshows();
      });
    }).catch(function (err) {
      var target = document.querySelector('[data-djr-sections]');
      if (target) target.innerHTML = fallbackHtml(null, err.message);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
