export const albumState = {
  currentAlbumId: null,
  coverPhotoId: null,
  currentUser: null,
  isAlbumOwner: false,
  isAdmin: false,
  selectedPhotos: new Set(),
  allPhotos: [],
}

export function setAlbumState(nextState) {
  Object.assign(albumState, nextState)
  return albumState
}

export function resetSelection() {
  albumState.selectedPhotos.clear()
}
