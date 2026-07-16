(function () {
  'use strict';

  window.__albumPhotoSelectorScriptLoaded = true;
  console.log('[Album Photo Selector] script loaded v3');

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var STYLE_PATH = '/admin/widgets/album-photo-selector.css?v=album-photo-selector-3';
  var attempts = 0;
  var maxAttempts = 80;
  var retryDelay = 50;
  var createElement = null;
  var serviceModulesPromise = null;
  var stateByKey = Object.create(null);

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

  function safeGetIn(value, path) {
    try {
      return value && typeof value.getIn === 'function' ? value.getIn(path) : undefined;
    } catch (err) {
      return undefined;
    }
  }

  function safeGet(value, key) {
    try {
      return value && typeof value.get === 'function' ? value.get(key) : undefined;
    } catch (err) {
      return undefined;
    }
  }

  function normalizeIds(value) {
    var data = toJS(value);
    if (!Array.isArray(data)) return [];
    return data.map(function (item) {
      return String(item == null ? '' : item).trim();
    }).filter(Boolean);
  }

  function getEntryData(entry) {
    return toJS(safeGetIn(entry, ['data'])) || {};
  }

  function getDefaultAlbumId(entry) {
    var data = getEntryData(entry);
    return typeof data.defaultAlbumId === 'string' ? data.defaultAlbumId : '';
  }

  function getFieldName(field) {
    return safeGet(field, 'name') || field && field.name || 'selectedPhotoIds';
  }

  function getStateKey(props) {
    if (props && props.forID) return props.forID;
    var fieldName = getFieldName(props && props.field);
    var entry = props && props.entry;
    var slug = getEntryData(entry).slug || 'djr';
    return slug + ':' + fieldName;
  }

  function getState(props) {
    var key = getStateKey(props || {});
    if (!stateByKey[key]) {
      stateByKey[key] = {
        albumId: getDefaultAlbumId(props && props.entry),
        photos: [],
        status: 'Paste an Album UUID or use the page default, then load photos.',
        isLoading: false,
        modules: null
      };
    }
    return stateByKey[key];
  }

  function forceRerender(props) {
    if (props && typeof props.onChange === 'function') {
      props.onChange(normalizeIds(props.value).slice());
    }
  }

  function changeSelection(props, nextIds) {
    if (props && typeof props.onChange === 'function') props.onChange(nextIds);
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

  async function loadPhotos(props, state) {
    var normalizedAlbumId = String(state.albumId || '').trim();
    if (!normalizedAlbumId) {
      state.status = 'Paste an Album UUID to load selectable photos.';
      state.photos = [];
      forceRerender(props);
      return;
    }
    if (!UUID_RE.test(normalizedAlbumId)) {
      state.status = 'Album UUID must be a Supabase UUID.';
      state.photos = [];
      forceRerender(props);
      return;
    }

    state.isLoading = true;
    state.status = 'Loading album photos...';
    forceRerender(props);

    try {
      var modules = state.modules || await loadServiceModules();
      state.modules = modules;

      var albumResult = await modules.getAlbumById(normalizedAlbumId, 'id, name, is_private');
      var album = albumResult && albumResult.data;
      if ((albumResult && albumResult.error) || !album) {
        state.photos = [];
        state.status = 'Album not found or unavailable.';
        return;
      }
      if (album.is_private) {
        state.photos = [];
        state.status = 'Private albums cannot be selected for public Participant Pages.';
        return;
      }

      var photosResult = await modules.getOrderedAlbumPhotos(normalizedAlbumId);
      var data = photosResult && photosResult.data;
      if ((photosResult && photosResult.error) || !Array.isArray(data) || !data.length) {
        state.photos = [];
        state.status = 'No public photos were found in this album.';
        return;
      }

      state.photos = data.filter(function (photo) { return photo && photo.file_path; });
      state.status = 'Loaded ' + data.length + ' photos from ' + (album.name || 'album') + '.';
    } catch (err) {
      state.photos = [];
      state.status = 'Could not load album photos. Manual Photo ID fallback is still available. ' + (err && err.message ? err.message : '');
    } finally {
      state.isLoading = false;
      forceRerender(props);
    }
  }

  function AlbumPhotoSelectorControl(props) {
    var h = createElement || window.h || (window.React && window.React.createElement);
    var value = normalizeIds(props && props.value);
    var state = getState(props || {});
    var photos = Array.isArray(state.photos) ? state.photos : [];

    function isSelected(photo) {
      return value.some(function (selectedId) { return photoMatchesId(photo, selectedId, state.albumId); });
    }

    function selectedIndex(photo) {
      return value.findIndex(function (selectedId) { return photoMatchesId(photo, selectedId, state.albumId); });
    }

    function togglePhoto(photo) {
      var index = selectedIndex(photo);
      if (index >= 0) {
        changeSelection(props, value.filter(function (_, itemIndex) { return itemIndex !== index; }));
        return;
      }
      changeSelection(props, value.concat(photo.id));
    }

    function moveSelected(index, delta) {
      var nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= value.length) return;
      var next = value.slice();
      var item = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = item;
      changeSelection(props, next);
    }

    function removeSelected(index) {
      changeSelection(props, value.filter(function (_, itemIndex) { return itemIndex !== index; }));
    }

    function renderPhoto(photo) {
      var selected = isSelected(photo);
      var index = selectedIndex(photo);
      var modules = state.modules || {};
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
      var photo = photos.find(function (item) { return photoMatchesId(item, selectedId, state.albumId); });
      var label = photo ? photoLabel(photo) : selectedId;
      return h('span', { key: selectedId + '-' + index, className: 'album-photo-selector__chip' }, [
        String(index + 1) + '. ' + label,
        h('button', { type: 'button', onClick: function () { moveSelected(index, -1); }, disabled: index === 0, title: 'Move earlier' }, '↑'),
        h('button', { type: 'button', onClick: function () { moveSelected(index, 1); }, disabled: index === value.length - 1, title: 'Move later' }, '↓'),
        h('button', { type: 'button', onClick: function () { removeSelected(index); }, title: 'Remove' }, '×')
      ]);
    }

    ensureStyle();

    return h('div', { className: 'album-photo-selector' }, [
      h('p', { className: 'album-photo-selector__help' }, 'Images come from /albums.html. Add/manage photos there, then select them here. The Photo ID must come from the Album UUID above.'),
      h('div', { className: 'album-photo-selector__controls' }, [
        h('input', {
          className: 'album-photo-selector__input',
          type: 'text',
          value: state.albumId,
          placeholder: 'Paste Album UUID to load photos',
          onChange: function (event) {
            state.albumId = event && event.target ? event.target.value : '';
            forceRerender(props);
          }
        }),
        h('button', {
          className: 'album-photo-selector__button',
          type: 'button',
          disabled: state.isLoading,
          onClick: function () { loadPhotos(props, state); }
        }, state.isLoading ? 'Loading' : 'Load Photos')
      ]),
      h('p', { className: 'album-photo-selector__status' }, state.status),
      h('p', { className: 'album-photo-selector__meta' }, value.length + ' selected. Use the arrows on selected chips to change order.'),
      value.length ? h('div', { className: 'album-photo-selector__selected' }, value.map(renderSelectedChip)) : null,
      photos.length ? h('div', { className: 'album-photo-selector__grid' }, photos.map(renderPhoto)) : null,
      h('details', { className: 'album-photo-selector__details' }, [
        h('summary', null, 'Advanced / manual Photo IDs'),
        h('p', null, value.length ? value.join(', ') : 'No selected Photo IDs.'),
        h('button', {
          className: 'album-photo-selector__button album-photo-selector__button--secondary',
          type: 'button',
          onClick: function () { changeSelection(props, []); }
        }, 'Clear Selection')
      ])
    ]);
  }

  function findCreateElement() {
    return window.h || (window.React && window.React.createElement);
  }

  function registerAlbumPhotoSelector() {
    if (window.__albumPhotoSelectorRegistered) return;

    createElement = findCreateElement();
    if (!window.CMS || !createElement) {
      attempts += 1;
      if (attempts >= maxAttempts) {
        window.__albumPhotoSelectorRegistrationFailed = true;
        console.warn('[Album Photo Selector] registration failed after retries v3', {
          hasCMS: Boolean(window.CMS),
          hasH: Boolean(window.h),
          hasReact: Boolean(window.React),
          hasReactCreateElement: Boolean(window.React && window.React.createElement),
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
      console.log('[Album Photo Selector] registered v3');
    } catch (err) {
      window.__albumPhotoSelectorRegistrationFailed = true;
      console.warn('[Album Photo Selector] registration failed v3', err);
    }
  }

  registerAlbumPhotoSelector();
})();
