import { PHOTO_ALBUM_CONFIG } from './photo-album/config.js'
import { createUploadController } from './photo-album/features/upload/uploadController.js'
import { getCurrentUser } from './photo-album/services/authService.js'
import { buildUploadPath, getUploadedAssetPublicUrl, uploadPhotoAsset } from './photo-album/services/uploadService.js'
import { getAlbumIdFromUrl } from './photo-album/utils/dom.js'
import { isHeicFile, isVideoFile } from './photo-album/utils/media.js'

const uploadController = createUploadController({
  elements: {
    dropArea: document.getElementById('drop-area'),
    fileInput: document.getElementById('file-input'),
    uploadStatus: document.getElementById('upload-status'),
    albumIdDisplay: document.getElementById('album-id-display'),
    googlePhotosBtn: document.getElementById('google-photos-btn'),
    googlePhotosStatus: document.getElementById('google-photos-status'),
    googlePhotosSetupNote: document.getElementById('google-setup-note'),
    iosHint: document.getElementById('ios-hint'),
  },
  services: {
    getAlbumIdFromUrl,
    getCurrentUser,
    isHeicFile,
    isVideoFile,
    buildUploadPath,
    uploadPhotoAsset,
    getUploadedAssetPublicUrl,
    loadGooglePhotosPicker: () => import('./google-photos.js'),
  },
  config: PHOTO_ALBUM_CONFIG,
})

uploadController.init()
