#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const errors = []

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

const indexHtml = readText('djr/index.html')
assert(indexHtml.includes('data-djr-page="home"'), '/djr/ entrypoint is not marked as the DJR home page')
assert(indexHtml.includes('/djr/js/djr-content.js'), '/djr/ does not load DJR content renderer')
assert(indexHtml.includes('/djr/js/djr-section-galleries.js'), '/djr/ does not load section gallery renderer')
assert(indexHtml.includes('David J. Richards') || indexHtml.includes('DJR Photography'), '/djr/ lacks DJR identity in baseline HTML')

const site = readJson('content/djr/site.json')
const home = readJson('content/djr/home.json')
const participantCopy = readJson('content/djr/participant-copy.json')
const sectionMap = readJson('content/djr/section-gallery-map.json')
assert(site?.brand?.wordmark === 'DJR', 'content/djr/site.json must identify the DJR brand')
assert(site?.brand?.name === 'David J. Richards', 'content/djr/site.json must identify David J. Richards')
assert(home?.hero?.tagline, 'content/djr/home.json must provide a hero tagline')
assert(home?.story?.title && home?.about?.body, 'content/djr/home.json must provide participant story/about content')
assert(participantCopy, 'content/djr/participant-copy.json must exist')

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

for (const relativePath of listJsonFiles('content/djr')) {
  const data = readJson(relativePath)
  collectImageRefs(data).forEach(({ url, key }) => localAssetExists(url, `${relativePath}.${key}`))
}

const albumFiles = listJsonFiles('content/djr-albums')
assert(albumFiles.length > 0, 'Expected at least one DJR CMS album fixture in content/djr-albums')

const albumsById = new Map()
for (const relativePath of albumFiles) {
  const album = readJson(relativePath)
  if (!album) continue
  assert(/^[a-z0-9-]+$/.test(album.album_id || ''), `${relativePath} has an invalid album_id`)
  assert(album.title, `${relativePath} is missing title`)
  assert(Array.isArray(album.images), `${relativePath} images must be a list, even when empty`)
  albumsById.set(album.album_id, { album, relativePath })
  collectImageRefs(album).forEach(({ url, key }) => localAssetExists(url, `${relativePath}.${key}`))
  for (const [index, image] of (album.images || []).entries()) {
    assert(image.image, `${relativePath} image ${index + 1} is missing image`)
    assert(image.alt, `${relativePath} image ${index + 1} is missing alt text`)
  }
}

const enabledCmsMappings = (sectionMap?.sections || []).filter((section) => section.enabled && (section.sourceType === 'cmsAlbum' || section.album_id))
assert(enabledCmsMappings.length > 0, 'Expected at least one enabled CMS album mapping for the DJR page')
for (const mapping of enabledCmsMappings) {
  const match = albumsById.get(mapping.album_id)
  assert(match, `Section mapping "${mapping.sectionId}" points to missing CMS album "${mapping.album_id}"`)
  if (match) {
    assert(match.album.images.length > 0, `Mapped CMS album "${mapping.album_id}" must contain at least one image for public rendering`)
  }
}

const sectionRenderer = readText('djr/js/djr-section-galleries.js')
assert(sectionRenderer.includes('Album has no images'), 'DJR section renderer should show a safe empty-album fallback')
assert(sectionRenderer.includes('CMS album unavailable'), 'DJR section renderer should show a safe missing-album fallback')
assert(readText('djr/js/djr-content.js').includes('fetchOptionalJson'), 'DJR content renderer should preserve behavior when participant-copy.json is missing')
assert(readText('djr/js/djr-content.js').includes('overlayParticipantCopy'), 'DJR content renderer should overlay participant copy through an allowlisted helper')

const cmsConfig = readText('admin/config.shared.yml')
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
assert(djrCollectionMatch, 'Decap shared config is missing the djr-gallery-albums collection')
if (djrCollectionMatch) {
  const collection = djrCollectionMatch
  assert(collection.includes('folder: content/djr-albums'), 'DJR participant album collection must be scoped to content/djr-albums')
  for (const forbiddenPath of ['content/site.json', 'content/navigation.json', 'content/homepage.json', 'content/programs', 'content/stories']) {
    assert(!collection.includes(forbiddenPath), `DJR participant collection must not expose global/admin path: ${forbiddenPath}`)
  }
  for (const expectedField of ['album_id', 'title', 'description', 'cover_image', 'images', 'alt', 'caption', 'credit', 'tags', 'orientation']) {
    assert(collection.includes(`name: ${expectedField}`), `DJR participant album collection is missing safe field: ${expectedField}`)
  }
}

if (errors.length) {
  console.error('DJR content contract failed:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('DJR content contract passed')
console.log(`Checked /djr/, ${albumFiles.length} CMS album file(s), and ${enabledCmsMappings.length} enabled CMS album mapping(s).`)
