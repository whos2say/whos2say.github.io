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

function hasFieldName(config, fieldName) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`name:\\s*${escaped}(?:\\s|,|\\]|\\})`).test(config)
}

function isBlankOrUuid(value) {
  return value === '' || (typeof value === 'string' && UUID_RE.test(value))
}

function validateAlbumIdField(value, label) {
  assert(typeof value === 'string', `${label} must be a string`)
  assert(isBlankOrUuid(value), `${label} must be blank or, when provided, a Supabase album UUID`)
  assert(!/^https?:\/\//i.test(value), `${label} must not be a URL`)
  assert(!value.includes('/album.html'), `${label} must not be an album page URL`)
  assert(!/photos\.app\.goo\.gl|photos\.google\.com/i.test(value), `${label} must not be a Google Photos URL`)
}

function validateImageLimit(value, label) {
  assert(Number.isInteger(value) && value > 0, `${label} must be a positive integer`)
}

const indexHtml = readText('djr/index.html')
const cmsIndexHtml = readText('admin/cms/index.html')
assert(indexHtml.includes('data-djr-page="home"'), '/djr/ entrypoint is not marked as the DJR home page')
assert(indexHtml.includes('/djr/js/djr-content.js'), '/djr/ does not load DJR content renderer')
assert(!indexHtml.includes('/djr/js/djr-section-galleries.js'), '/djr/ must not load the old JSON CMS album card renderer')
assert(indexHtml.includes('David J. Richards') || indexHtml.includes('DJR Photography'), '/djr/ lacks DJR identity in baseline HTML')
assert(cmsIndexHtml.includes('/admin/config.yml'), '/admin/cms/ must load the generated Decap config')
assert(cmsIndexHtml.includes('window.CMS_MANUAL_INIT = true'), '/admin/cms/ must enable Decap manual initialization before loading Decap')
assert(cmsIndexHtml.indexOf('window.CMS_MANUAL_INIT = true') < cmsIndexHtml.indexOf('decap-cms'), '/admin/cms/ must set CMS_MANUAL_INIT before loading Decap')
assert(cmsIndexHtml.includes('/admin/preview-templates/participant-page-preview.js?v=participant-preview-7'), '/admin/cms/ must load the cache-busted Participant Pages preview template')
assert(cmsIndexHtml.indexOf('participant-page-preview.js?v=participant-preview-7') < cmsIndexHtml.indexOf('window.CMS.init()'), '/admin/cms/ must load the Participant Pages preview before CMS.init()')

const site = readJson('content/djr/site.json')
const home = readJson('content/djr/home.json')
const participantPage = readJson('content/participant-pages/djr.json')
assert(site?.brand?.wordmark === 'DJR', 'content/djr/site.json must identify the DJR brand')
assert(site?.brand?.name === 'David J. Richards', 'content/djr/site.json must identify David J. Richards')
assert(home?.hero?.tagline, 'content/djr/home.json must provide a hero tagline')
assert(home?.story?.title && home?.about?.body, 'content/djr/home.json must provide participant story/about content')
assert(participantPage, 'content/participant-pages/djr.json must exist')

const participantPageAllowedPaths = new Set([
  '_comment',
  'name',
  'slug',
  'template',
  'defaultAlbumId',
  'sections',
  'sections.hero',
  'sections.hero.enabled',
  'sections.hero.allowParticipantEdit',
  'sections.hero.tagline',
  'sections.hero.allowParticipantAlbum',
  'sections.hero.albumId',
  'sections.hero.imageLimit',
  'sections.story',
  'sections.story.enabled',
  'sections.story.allowParticipantEdit',
  'sections.story.eyebrow',
  'sections.story.title',
  'sections.story.lead',
  'sections.story.body',
  'sections.story.quote',
  'sections.story.allowParticipantAlbum',
  'sections.story.albumId',
  'sections.story.imageLimit',
  'sections.featured',
  'sections.featured.enabled',
  'sections.featured.allowParticipantEdit',
  'sections.featured.eyebrow',
  'sections.featured.title',
  'sections.featured.body',
  'sections.featured.buttonLabel',
  'sections.featured.allowParticipantAlbum',
  'sections.featured.albumId',
  'sections.featured.imageLimit',
  'sections.about',
  'sections.about.enabled',
  'sections.about.allowParticipantEdit',
  'sections.about.eyebrow',
  'sections.about.title',
  'sections.about.body',
  'sections.about.allowParticipantAlbum',
  'sections.about.albumId',
  'sections.about.imageLimit',
  'sections.creative',
  'sections.creative.enabled',
  'sections.creative.allowParticipantEdit',
  'sections.creative.eyebrow',
  'sections.creative.title',
  'sections.creative.body',
  'sections.creative.allowParticipantAlbum',
  'sections.creative.albumId',
  'sections.creative.imageLimit',
  'sections.cta',
  'sections.cta.enabled',
  'sections.cta.allowParticipantEdit',
  'sections.cta.title',
  'sections.cta.sub',
  'sections.cta.buttonLabel',
])

for (const participantPath of collectPaths(participantPage)) {
  assert(participantPageAllowedPaths.has(participantPath), `participant page config exposes non-allowlisted field: ${participantPath}`)
}

assert(participantPage?.name === 'David J. Richards', 'DJR participant page config must identify David J. Richards')
assert(participantPage?.slug === 'djr', 'DJR participant page config slug must be djr')
assert(participantPage?.template === 'djr-photography', 'DJR participant page config must use the djr-photography template')
validateAlbumIdField(participantPage?.defaultAlbumId, 'defaultAlbumId')
for (const sectionKey of ['hero', 'story', 'featured', 'about', 'creative', 'cta']) {
  const section = participantPage?.sections?.[sectionKey]
  assert(section && typeof section === 'object', `participant page section ${sectionKey} must exist`)
  assert(typeof section.enabled === 'boolean', `participant page section ${sectionKey}.enabled must be boolean`)
  assert(typeof section.allowParticipantEdit === 'boolean', `participant page section ${sectionKey}.allowParticipantEdit must be boolean`)
  if (sectionKey !== 'cta') {
    assert(typeof section.allowParticipantAlbum === 'boolean', `participant page section ${sectionKey}.allowParticipantAlbum must be boolean`)
    validateAlbumIdField(section.albumId, `sections.${sectionKey}.albumId`)
    validateImageLimit(section.imageLimit, `sections.${sectionKey}.imageLimit`)
  }
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
assert(djrContent.includes('cmsPreview') && djrContent.includes('participant-pages'), 'DJR content renderer should gate CMS preview mode behind cmsPreview=participant-pages')
assert(djrContent.includes('wtsParticipantPagePreview:'), 'DJR content renderer should read participant preview config from sessionStorage only in preview mode')
assert(djrContent.includes('readParticipantPreviewConfig'), 'DJR content renderer should isolate participant preview config reads')
assert(djrContent.includes('loadParticipantPageConfig'), 'DJR content renderer should fall back to saved participant config when preview data is unavailable')
assert(djrContent.includes('overlayParticipantAlbums'), 'DJR content renderer should overlay Supabase album images before rendering')
assert(djrContent.includes('overlayParticipantPageContent'), 'DJR content renderer should overlay safe Participant Pages copy')
assert(djrContent.includes('allowParticipantEdit !== true'), 'DJR content renderer must only apply participant text overlays when allowParticipantEdit is true')
assert(djrContent.includes('applyNonEmptyString'), 'DJR content renderer must preserve fallback content for blank participant fields')
assert(djrContent.includes('applyParticipantSectionToggles'), 'DJR content renderer should apply participant section toggles')
assert(djrContent.includes('allowParticipantAlbum !== true'), 'DJR content renderer must only apply section album overlays when allowParticipantAlbum is true')
assert(djrContent.includes('section.albumId || config.defaultAlbumId'), 'DJR content renderer should use section album IDs before defaultAlbumId')
assert(djrContent.includes('/js/participant-pages/albumImages.js'), 'DJR content renderer should use the participant album image helper')
assert(!djrContent.includes('content/djr-albums'), 'DJR content renderer must not depend on JSON CMS albums')

const albumImageHelper = readText('js/participant-pages/albumImages.js')
assert(albumImageHelper.includes('UUID_RE'), 'Participant album helper should validate UUID album IDs')
assert(albumImageHelper.includes('getAlbumById'), 'Participant album helper should fetch Supabase album metadata')
assert(albumImageHelper.includes('getOrderedAlbumPhotos'), 'Participant album helper should fetch ordered Supabase photos')
assert(albumImageHelper.includes('getPublicUrl'), 'Participant album helper should map storage paths to public URLs')
assert(albumImageHelper.includes('is_private'), 'Participant album helper should reject private albums')

const participantPreview = readText('admin/preview-templates/participant-page-preview.js')
assert(participantPreview.includes('registerPreviewTemplate') && participantPreview.includes('participant-pages'), 'Participant Pages preview template must register with Decap')
assert(participantPreview.includes("previewKeys = ['participant-pages', 'djr', 'participant-pages-djr']"), 'Participant Pages preview should bind to the collection and likely DJR file-entry keys')
assert(participantPreview.includes('CMS.registerPreviewTemplate(key, ParticipantPagePreview)'), 'Participant Pages preview should register each preview key with Decap')
assert(participantPreview.includes('registerParticipantPagePreview'), 'Participant Pages preview should retry registration when Decap globals load late')
assert(participantPreview.includes('window.setTimeout(registerParticipantPagePreview'), 'Participant Pages preview should wait for Decap globals instead of exiting permanently')
assert(!participantPreview.includes('if (!CMS || !h) return'), 'Participant Pages preview must not permanently return before registration retry')
assert(participantPreview.includes('window.__participantPagesPreviewLoaded = true'), 'Participant Pages preview should set a hard script load marker')
assert(participantPreview.includes('window.__participantPagesPreviewRegistered = true'), 'Participant Pages preview should set a registration marker')
assert(participantPreview.includes('window.__participantPagesPreviewRegistrationFailed = true'), 'Participant Pages preview should set a failure marker after retries')
assert(participantPreview.includes('console.log') && participantPreview.includes('console.warn'), 'Participant Pages preview should include admin-only registration logging')
assert(participantPreview.includes('[Participant Pages Preview] script loaded v7'), 'Participant Pages preview should log the v7 load marker')
assert(participantPreview.includes('[Participant Pages Preview] registered for participant-pages v7'), 'Participant Pages preview should log the v7 registration marker')
assert(participantPreview.includes('[Participant Pages Preview] iframe draft updated'), 'Participant Pages preview should log iframe draft updates')
for (const previewKey of ['participant-pages', 'djr', 'participant-pages-djr']) {
  assert(participantPreview.includes(`[Participant Pages Preview] registered for ' + key`) && participantPreview.includes(previewKey), `Participant Pages preview should register/log key: ${previewKey}`)
}
assert(!participantPreview.includes('CMS.init('), 'Participant Pages preview script must not initialize Decap')
assert(participantPreview.includes('participant-page-preview.css?v=participant-preview-7'), 'Participant Pages preview should cache-bust its preview CSS')
assert(participantPreview.includes('wtsParticipantPagePreview:'), 'Participant Pages preview should write draft data to sessionStorage')
assert(participantPreview.includes('sessionStorage.setItem'), 'Participant Pages preview should store draft data for the iframe')
assert(participantPreview.includes('/djr/?cmsPreview=participant-pages&previewSlug='), 'Participant Pages preview should render the live DJR page iframe in CMS preview mode')
assert(participantPreview.includes('participant-page-preview__iframe'), 'Participant Pages preview should render an iframe as the main preview')
assert(participantPreview.includes('Live DJR Page Preview'), 'Participant Pages preview should show a live preview toolbar')
assert(!participantPreview.includes('Story / The Photographer'), 'Participant Pages preview should not render admin section cards as the main preview')
assert(!participantPreview.includes('getAlbumById'), 'Participant Pages preview must not fetch Supabase album metadata')
assert(!participantPreview.includes('widget: image'), 'Participant Pages preview must not introduce upload widgets')

const cmsConfig = readText('admin/config.shared.yml')
const participantPagesCollection = extractCollection(cmsConfig, 'participant-pages')
assert(participantPagesCollection, 'Decap shared config is missing the participant-pages collection')
if (participantPagesCollection) {
  assert(participantPagesCollection.includes('file: content/participant-pages/djr.json'), 'Participant Pages collection must expose content/participant-pages/djr.json')
  for (const expectedField of ['name', 'slug', 'template', 'defaultAlbumId', 'sections', 'hero', 'story', 'featured', 'about', 'creative', 'cta', 'enabled', 'allowParticipantEdit', 'allowParticipantAlbum', 'albumId', 'imageLimit', 'eyebrow', 'title', 'lead', 'body', 'quote', 'tagline', 'sub', 'buttonLabel']) {
    assert(hasFieldName(participantPagesCollection, expectedField), `Participant Pages collection is missing field: ${expectedField}`)
  }
  for (const forbiddenField of ['href', 'formAction', 'photoGalleryAlbumId', 'googlePhotosAlbumUrl', 'album_id', 'nav', 'partner', 'button', 'primaryButton', 'secondaryButton', 'sourceType', 'sectionId', 'html', 'image', 'src']) {
    assert(!hasFieldName(participantPagesCollection, forbiddenField), `Participant Pages collection must not expose field: ${forbiddenField}`)
  }
  assert(!participantPagesCollection.includes('widget: image'), 'Participant Pages collection must not expose media upload widgets')
}

const djrCollection = extractCollection(cmsConfig, 'djr')
assert(djrCollection.includes('hide: true'), 'DJR Photography advanced/admin fallback collection should be hidden from the participant-facing sidebar')
assert(djrCollection.includes('Advanced/Admin Legacy'), 'DJR Photography collection should be labeled as advanced/admin legacy')
assert(djrCollection.includes('Section Gallery Mapper - Legacy/Admin'), 'Legacy section gallery mapper should be labeled as legacy/admin')

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
