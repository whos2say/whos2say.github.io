(function () {
  'use strict';

  window.__albumPhotoSelectorScriptLoaded = true;
  console.log('[Album Photo Selector] script loaded v2');

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var STYLE_PATH = '/admin/widgets/album-photo-selector.css?v=album-photo-selector-2';
  var attempts = 0;
  var maxAttempts = 80;
  var retryDelay = 50;
  var serviceModulesPromise = null;

  function ensureStyle() {
    if (document.querySelector('link[href="' + STYLE_PATH + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLE_PATH;
    document.head.appendChild(link);
  }

  function toJS(value) {
    if (!value) return null;
    if (typeof value.toJS === 'function') return value.toJS();
    return value;
  }

  function normalizeIds(value) {
    var data = toJS(value);
    if (!Array.isArray(data)) return [];
    return data.map(function (item) {
      return String(item == null ? '' : item).trim();
    }).filter(Boolean);
  }

  function getEntryData(entry) {
    return toJS(entry && entry.getIn ? entry.getIn(['data']) : {}) || {};
  }

  function getDefaultAlbumId(entry) {
    var data = getEntryData(entry);
    return typeof data.defaultAlbumId === 'string' ? data.defaultAlbumId : '';
  }

  function getFileName(filePath) {
    return String(filePath || '').split('/').filter(Boolean).pop() || '';
  }

  function photoMatchesId(photo, selectedId, albumId) {
    if (!photo || !selectedId) return false;
    if (photo.id === selectedId) return true;
    if (photo.file_path === selectedId) return true;
    return selectedId === albumId + '/' + getFileName(photo.file_path);
  }

  function photoLabel(photo) {
    return photo.caption || photo.title || photo.description || getFileName(photo.file_path) || photo.id;
  }

  function loadServiceModules() {
    if (!serviceModulesPromise) {
      serviceModulesPromise = Promise.all([
        import('/js/photo-album/services/albumService.js'),
        import('/js/photo-album/services/photoService.js'),
        import('/js/photo-album/services/storageService.js'),
        import('/js/photo-album/utils/media.js')
      ]).then(function (modules) {
        return {
          getAlbumById: modules[0].getAlbumById,
          getOrderedAlbumPhotos: modules[1].getOrderedAlbumPhotos,
          getPublicUrl: modules[2].getPublicUrl,
          isVideoPath: modules[3].isVideoPath
        };
      });
    }
    return serviceModulesPromise;
  }

  function AlbumPhotoSelectorControl(props) {
    var React = window.React;
    var h = React.createElement;
    var value = normalizeIds(props.value);
    var albumState = React.useState(getDefaultAlbumId(props.entry));
    var albumId = albumState[0];
    var setAlbumId = albumState[1];
    var photoState = React.useState([]);
    var photos = photoState[0];
    var setPhotos = photoState[1];
    var statusState = React.useState('Paste an Album UUID or use the page default, then load photos.');
    var status = statusState[0];
    var setStatus = statusState[1];
    var loadingState = React.useState(false);
    var isLoading = loadingState[0];
    var setIsLoading = loadingState[1];
    var moduleState = React.useState(null);
    var serviceModules = moduleState[0];
    var setServiceModules = moduleState[1];

    function changeSelection(nextIds) {
      props.onChange(nextIds);
    }

    async function loadPhotos() {
      var normalizedAlbumId = String(albumId || '').trim();
      if (!normalizedAlbumId) {
        setStatus('Paste an Album UUID to load selectable photos.');
        setPhotos([]);
        return;
      }
      if (!UUID_RE.test(normalizedAlbumId)) {
        setStatus('Album UUID must be a Supabase UUID.');
        setPhotos([]);
        return;
      }

      setIsLoading(true);
      setStatus('Loading album photos...');
      try {
        var modules = serviceModules || await loadServiceModules();
        setServiceModules(modules);

        var albumResult = await modules.getAlbumById(normalizedAlbumId, 'id, name, is_private');
        var album = albumResult && albumResult.data;
        if ((albumResult && albumResult.error) || !album) {
          setPhotos([]);
          setStatus('Album not found or unavailable.');
          return;
        }
        if (album.is_private) {
          setPhotos([]);
          setStatus('Private albums cannot be selected for public Participant Pages.');
          return;
        }

        var photosResult = await modules.getOrderedAlbumPhotos(normalizedAlbumId);
        var data = photosResult && photosResult.data;
        if ((photosResult && photosResult.error) || !Array.isArray(data) || !data.length) {
          setPhotos([]);
          setStatus('No public photos were found in this album.');
          return;
        }

        setPhotos(data.filter(function (photo) { return photo && photo.file_path; }));
        setStatus('Loaded ' + data.length + ' photos from ' + (album.name || 'album') + '.');
      } catch (err) {
        setPhotos([]);
        setStatus('Could not load album photos. Manual Photo ID fallback is still available. ' + (err && err.message ? err.message : ''));
      } finally {
        setIsLoading(false);
      }
    }

    function isSelected(photo) {
      return value.some(function (selectedId) { return photoMatchesId(photo, selectedId, albumId); });
    }

    function selectedIndex(photo) {
      return value.findIndex(function (selectedId) { return photoMatchesId(photo, selectedId, albumId); });
    }

    function togglePhoto(photo) {
      var index = selectedIndex(photo);
      if (index >= 0) {
        changeSelection(value.filter(function (_, itemIndex) { return itemIndex !== index; }));
        return;
      }
      changeSelection(value.concat(photo.id));
    }

    function moveSelected(index, delta) {
      var nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= value.length) return;
      var next = value.slice();
      var item = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = item;
      changeSelection(next);
    }

    function removeSelected(index) {
      changeSelection(value.filter(function (_, itemIndex) { return itemIndex !== index; }));
    }

    function renderPhoto(photo) {
      var selected = isSelected(photo);
      var index = selectedIndex(photo);
      var modules = serviceModules || {};
      var isVideo = modules.isVideoPath ? modules.isVideoPath(photo.file_path) : /\.(mp4|mov|webm)$/i.test(photo.file_path || '');
      var src = modules.getPublicUrl ? modules.getPublicUrl(photo.file_path) : '';
      return h('button', {
        key: photo.id,
        type: 'button',
        className: 'album-photo-selector__photo' + (selected ? ' is-selected' : ''),
        onClick: function () { togglePhoto(photo); }
      }, [
        selected ? h('span', { className: 'album-photo-selector__badge' }, String(index + 1)) : null,
        isVideo
          ? h('span', { className: 'album-photo-selector__video' }, 'Video')
          : h('img', { src: src, alt: photoLabel(photo), loading: 'lazy' }),
        h('span', { className: 'album-photo-selector__caption' }, photoLabel(photo))
      ]);
    }

    function renderSelectedChip(selectedId, index) {
      var photo = photos.find(function (item) { return photoMatchesId(item, selectedId, albumId); });
      var label = photo ? photoLabel(photo) : selectedId;
      return h('span', { key: selectedId + '-' + index, className: 'album-photo-selector__chip' }, [
        String(index + 1) + '. ' + label,
        h('button', { type: 'button', onClick: function () { moveSelected(index, -1); }, disabled: index === 0, title: 'Move earlier' }, '↑'),
        h('button', { type: 'button', onClick: function () { moveSelected(index, 1); }, disabled: index === value.length - 1, title: 'Move later' }, '↓'),
        h('button', { type: 'button', onClick: function () { removeSelected(index); }, title: 'Remove' }, '×')
      ]);
    }

    React.useEffect(function () {
      ensureStyle();
    }, []);

    return h('div', { className: 'album-photo-selector' }, [
      h('p', { className: 'album-photo-selector__help' }, 'Images come from /albums.html. Add/manage photos there, then select them here. The Photo ID must come from the Album UUID above.'),
      h('div', { className: 'album-photo-selector__controls' }, [
        h('input', {
          className: 'album-photo-selector__input',
          type: 'text',
          value: albumId,
          placeholder: 'Paste Album UUID to load photos',
          onChange: function (event) { setAlbumId(event.target.value); }
        }),
        h('button', {
          className: 'album-photo-selector__button',
          type: 'button',
          disabled: isLoading,
          onClick: loadPhotos
        }, isLoading ? 'Loading' : 'Load Photos')
      ]),
      h('p', { className: 'album-photo-selector__status' }, status),
      h('p', { className: 'album-photo-selector__meta' }, value.length + ' selected. Drag-free order controls are shown on selected chips.'),
      value.length ? h('div', { className: 'album-photo-selector__selected' }, value.map(renderSelectedChip)) : null,
      photos.length ? h('div', { className: 'album-photo-selector__grid' }, photos.map(renderPhoto)) : null,
      h('details', { className: 'album-photo-selector__details' }, [
        h('summary', null, 'Advanced / manual Photo IDs'),
        h('p', null, value.length ? value.join(', ') : 'No selected Photo IDs.'),
        h('button', {
          className: 'album-photo-selector__button album-photo-selector__button--secondary',
          type: 'button',
          onClick: function () { changeSelection([]); }
        }, 'Clear Selection')
      ])
    ]);
  }

  function registerAlbumPhotoSelector() {
    if (window.__albumPhotoSelectorRegistered) return;

    if (!window.CMS || !window.React) {
      attempts += 1;
      if (attempts >= maxAttempts) {
        window.__albumPhotoSelectorRegistrationFailed = true;
        console.warn('[Album Photo Selector] registration failed after retries v2', {
          hasCMS: Boolean(window.CMS),
          hasReact: Boolean(window.React),
          hasRegisterWidget: Boolean(window.CMS && window.CMS.registerWidget)
        });
        return;
      }
      window.setTimeout(registerAlbumPhotoSelector, retryDelay);
      return;
    }

    try {
      ensureStyle();
      window.CMS.registerWidget('album-photo-selector', AlbumPhotoSelectorControl);
      window.__albumPhotoSelectorRegistered = true;
      console.log('[Album Photo Selector] registered v2');
    } catch (err) {
      window.__albumPhotoSelectorRegistrationFailed = true;
      console.warn('[Album Photo Selector] registration failed v2', err);
    }
  }

  registerAlbumPhotoSelector();
})();
