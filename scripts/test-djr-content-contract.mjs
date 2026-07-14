#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const errors = []
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(message) {
  errors.push(message)
}

function readText(relativePath) {
  const fullPath = path.join(root, relativePath)
  if (!fs.existsSync(fullPath)) {
    fail(`Missing required file: ${relativePath}`)
    return ''
  }
  return fs.readFileSync(fullPath, 'utf8')
}

function readJson(relativePath) {
  const text = readText(relativePath)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (err) {
    fail(`Invalid JSON in ${relativePath}: ${err.message}`)
    return null
  }
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function localAssetExists(url, context) {
  if (!url || typeof url !== 'string') return
  if (!url.startsWith('/')) return
  if (url.startsWith('/album.html') || url.startsWith('/djr/') || url.startsWith('/content/')) return

  const cleanPath = url.split(/[?#]/)[0].replace(/^\/+/, '')
  const fullPath = path.join(root, cleanPath)
  assert(fs.existsSync(fullPath), `${context} references missing local asset: ${url}`)
}

function collectImageRefs(value, refs = []) {
  if (!value || typeof value !== 'object') return refs
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageRefs(item, refs))
    return refs
  }

  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && /(^|_)(image|photo|logo)$|^(src|coverImage|cover_image|backgroundImage|logoImage|photo)$/i.test(key)) {
      refs.push({ key, url: child })
    } else {
      collectImageRefs(child, refs)
    }
  }
  return refs
}

function listJsonFiles(relativeDir) {
  const fullDir = path.join(root, relativeDir)
  if (!fs.existsSync(fullDir)) return []
  return fs.readdirSync(fullDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(relativeDir, name).replace(/\\/g, '/'))
}

function collectPaths(value, prefix = '', paths = []) {
  if (!value || typeof value !== 'object') return paths
  if (Array.isArray(value)) {
    paths.push(`${prefix}[]`)
    value.forEach((item) => collectPaths(item, `${prefix}[]`, paths))
    return paths
  }

  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key
    paths.push(next)
    collectPaths(child, next, paths)
  }
  return paths
}

function extractCollection(config, collectionName) {
  const escaped = collectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return config.match(new RegExp(`- name: ${escaped}[\\s\\S]*?(?=\\n  - name: |\\n?$)`))?.[0] || ''
}

function isBlankOrUuid(value) {
  return value === '' || (typeof value === 'string' && UUID_RE.test(value))
}

function validateAlbumIdField(value, label) {
  assert(typeof value === 'string', `${label} must be a string`)
  assert(isBlankOrUuid(value), `${label} must be blank or a Supabase album UUID`)
  assert(!/^https?:\/\//i.test(value), `${label} must not be a URL`)
  assert(!value.includes('/album.html'), `${label} must not be an album page URL`)
  assert(!/photos\.app\.goo\.gl|photos\.google\.com/i.test(value), `${label} must not be a Google Photos URL`)
}

const indexHtml = readText('djr/index.html')
assert(indexHtml.includes('data-djr-page="home"'), '/djr/ entrypoint is not marked as the DJR home page')
assert(indexHtml.includes('/djr/js/djr-content.js'), '/djr/ does not load DJR content renderer')
assert(!indexHtml.includes('/djr/js/djr-section-galleries.js'), '/djr/ must not load the old JSON CMS album card renderer')
assert(indexHtml.includes('David J. Richards') || indexHtml.includes('DJR Photography'), '/djr/ lacks DJR identity in baseline HTML')

const site = readJson('content/djr/site.json')
const home = readJson('content/djr/home.json')
const participantCopy = readJson('content/djr/participant-copy.json')
const participantPage = readJson('content/participant-pages/djr.json')
assert(site?.brand?.wordmark === 'DJR', 'content/djr/site.json must identify the DJR brand')
assert(site?.brand?.name === 'David J. Richards', 'content/djr/site.json must identify David J. Richards')
assert(home?.hero?.tagline, 'content/djr/home.json must provide a hero tagline')
assert(home?.story?.title && home?.about?.body, 'content/djr/home.json must provide participant story/about content')
assert(participantCopy, 'content/djr/participant-copy.json must exist')
assert(participantPage, 'content/participant-pages/djr.json must exist')

const participantCopyAllowedPaths = new Set([
  '_comment',
  'hero',
  'hero.tagline',
  'story',
  'story.enabled',
  'story.eyebrow',
  'story.title',
  'story.lead',
  'story.body',
  'story.quote',
  'about',
  'about.enabled',
  'about.eyebrow',
  'about.title',
  'about.photo',
  'about.body',
  'creativeFeature',
  'creativeFeature.enabled',
  'creativeFeature.eyebrow',
  'creativeFeature.title',
  'creativeFeature.body',
  'creativeFeature.images',
  'creativeFeature.images[]',
  'creativeFeature.images[].src',
  'creativeFeature.images[].alt',
])

for (const participantPath of collectPaths(participantCopy)) {
  assert(participantCopyAllowedPaths.has(participantPath), `participant-copy.json exposes non-allowlisted field: ${participantPath}`)
}

for (const forbiddenKey of ['href', 'formAction', 'photoGalleryAlbumId', 'googlePhotosAlbumUrl', 'albumId', 'album_id', 'nav', 'partner', 'button', 'primaryButton', 'secondaryButton', 'sourceType', 'sectionId']) {
  assert(!collectPaths(participantCopy).some((participantPath) => participantPath.split('.').includes(forbiddenKey)), `participant-copy.json must not expose ${forbiddenKey}`)
}
assert(!collectPaths(participantCopy).some((participantPath) => /html/i.test(participantPath)), 'participant-copy.json must not expose raw HTML fields')

const participantPageAllowedPaths = new Set([
  '_comment',
  'name',
  'slug',
  'template',
  'defaultAlbumId',
  'sections',
  'sections.story',
  'sections.story.enabled',
  'sections.story.albumId',
  'sections.featured',
  'sections.featured.enabled',
  'sections.featured.albumId',
  'sections.about',
  'sections.about.enabled',
  'sections.about.albumId',
  'sections.creative',
  'sections.creative.enabled',
  'sections.creative.albumId',
])

for (const participantPath of collectPaths(participantPage)) {
  assert(participantPageAllowedPaths.has(participantPath), `participant page config exposes non-allowlisted field: ${participantPath}`)
}

assert(participantPage?.name === 'David J. Richards', 'DJR participant page config must identify David J. Richards')
assert(participantPage?.slug === 'djr', 'DJR participant page config slug must be djr')
assert(participantPage?.template === 'djr-photography', 'DJR participant page config must use the djr-photography template')
validateAlbumIdField(participantPage?.defaultAlbumId, 'defaultAlbumId')
for (const sectionKey of ['story', 'featured', 'about', 'creative']) {
  const section = participantPage?.sections?.[sectionKey]
  assert(section && typeof section === 'object', `participant page section ${sectionKey} must exist`)
  assert(typeof section.enabled === 'boolean', `participant page section ${sectionKey}.enabled must be boolean`)
  validateAlbumIdField(section.albumId, `sections.${sectionKey}.albumId`)
}

for (const invalidId of ['david-behind-the-lens', '/album.html?album=fe027096-7084-4f96-974a-315b98b484b2', 'https://photos.google.com/share/example', 'https://www.whostosay.org/album.html?album=fe027096-7084-4f96-974a-315b98b484b2']) {
  assert(!isBlankOrUuid(invalidId), `album ID validator must reject ${invalidId}`)
}

for (const relativePath of listJsonFiles('content/djr')) {
  const data = readJson(relativePath)
  collectImageRefs(data).forEach(({ url, key }) => localAssetExists(url, `${relativePath}.${key}`))
}

const djrContent = readText('djr/js/djr-content.js')
assert(djrContent.includes('fetchOptionalJson'), 'DJR content renderer should preserve behavior when optional JSON files are missing')
assert(djrContent.includes('overlayParticipantCopy'), 'DJR content renderer should overlay participant copy through an allowlisted helper')
assert(djrContent.includes('/content/participant-pages/djr.json'), 'DJR content renderer should load the participant page config')
assert(djrContent.includes('overlayParticipantAlbums'), 'DJR content renderer should overlay Supabase album images before rendering')
assert(djrContent.includes('applyParticipantSectionToggles'), 'DJR content renderer should apply participant section toggles')
assert(djrContent.includes('/js/participant-pages/albumImages.js'), 'DJR content renderer should use the participant album image helper')
assert(!djrContent.includes('content/djr-albums'), 'DJR content renderer must not depend on JSON CMS albums')

const albumImageHelper = readText('js/participant-pages/albumImages.js')
assert(albumImageHelper.includes('UUID_RE'), 'Participant album helper should validate UUID album IDs')
assert(albumImageHelper.includes('getAlbumById'), 'Participant album helper should fetch Supabase album metadata')
assert(albumImageHelper.includes('getOrderedAlbumPhotos'), 'Participant album helper should fetch ordered Supabase photos')
assert(albumImageHelper.includes('getPublicUrl'), 'Participant album helper should map storage paths to public URLs')
assert(albumImageHelper.includes('is_private'), 'Participant album helper should reject private albums')

const cmsConfig = readText('admin/config.shared.yml')
const participantPagesCollection = extractCollection(cmsConfig, 'participant-pages')
assert(participantPagesCollection, 'Decap shared config is missing the participant-pages collection')
if (participantPagesCollection) {
  assert(participantPagesCollection.includes('file: content/participant-pages/djr.json'), 'Participant Pages collection must expose content/participant-pages/djr.json')
  for (const expectedField of ['name', 'slug', 'template', 'defaultAlbumId', 'sections', 'story', 'featured', 'about', 'creative', 'enabled', 'albumId']) {
    assert(participantPagesCollection.includes(`name: ${expectedField}`), `Participant Pages collection is missing field: ${expectedField}`)
  }
  for (const forbiddenField of ['href', 'formAction', 'photoGalleryAlbumId', 'googlePhotosAlbumUrl', 'album_id', 'nav', 'partner', 'button', 'primaryButton', 'secondaryButton', 'sourceType', 'sectionId', 'html', 'image', 'src']) {
    assert(!participantPagesCollection.includes(`name: ${forbiddenField}`), `Participant Pages collection must not expose field: ${forbiddenField}`)
  }
  assert(!participantPagesCollection.includes('widget: image'), 'Participant Pages collection must not expose media upload widgets')
}

const djrCopyCollection = extractCollection(cmsConfig, 'djr-participant-copy')
assert(djrCopyCollection, 'Decap shared config is missing the djr-participant-copy collection')
if (djrCopyCollection) {
  assert(djrCopyCollection.includes('file: content/djr/participant-copy.json'), 'DJR participant copy collection must expose content/djr/participant-copy.json')
  for (const forbiddenPath of ['content/site.json', 'content/navigation.json', 'content/homepage.json', 'content/programs', 'content/stories', 'content/djr/site.json', 'content/djr/home.json', 'content/djr/contact.json', 'content/djr/section-gallery-map.json']) {
    assert(!djrCopyCollection.includes(forbiddenPath), `DJR participant copy collection must not expose admin path: ${forbiddenPath}`)
  }
  for (const forbiddenField of ['href', 'formAction', 'photoGalleryAlbumId', 'googlePhotosAlbumUrl', 'albumId', 'album_id', 'nav', 'partner', 'button', 'primaryButton', 'secondaryButton', 'sourceType', 'sectionId', 'html']) {
    assert(!djrCopyCollection.includes(`name: ${forbiddenField}`), `DJR participant copy collection must not expose admin field: ${forbiddenField}`)
  }
  for (const expectedField of ['hero', 'tagline', 'story', 'enabled', 'eyebrow', 'title', 'lead', 'body', 'quote', 'about', 'photo', 'creativeFeature', 'images', 'src', 'alt']) {
    assert(djrCopyCollection.includes(`name: ${expectedField}`), `DJR participant copy collection is missing safe field: ${expectedField}`)
  }
}

const djrCollectionMatch = extractCollection(cmsConfig, 'djr-gallery-albums')
assert(!djrCollectionMatch, 'Decap shared config must not expose the old JSON DJR album media collection')
assert(!cmsConfig.includes('folder: content/djr-albums'), 'Decap shared config must not expose content/djr-albums as participant media')

if (errors.length) {
  console.error('DJR content contract failed:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('DJR content contract passed')
console.log('Checked /djr/, participant page album config, and Decap participant-page scope.')
