#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { BRAND_KIT_SCHEMA_VERSION, DESIGN_SYSTEM_REGISTRY, PARTICIPANT_COMFORT_LEVELS, WORKSHOP_AREAS, WORKSHOP_STATUSES, normalizeBrandKit } from '../js/participant-pages/brandKit.js'
import { PARTICIPANT_REGISTRY_SCHEMA_VERSION, normalizeParticipantRegistry } from '../js/participant-pages/participantRegistry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const errors = []
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALBUM_SCOPED_PHOTO_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9][a-z0-9._-]*$/i
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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

function validateImageMode(value, label) {
  assert(value === 'albumOrder' || value === 'manualSelection' || value === 'singlePhoto', `${label} must be albumOrder, manualSelection, or singlePhoto`)
}

function validatePhotoIds(value, label) {
  assert(Array.isArray(value), `${label} must be an array`)
  value.forEach((photoId, index) => {
    assert(typeof photoId === 'string' && (UUID_RE.test(photoId) || ALBUM_SCOPED_PHOTO_ID_RE.test(photoId)), `${label}[${index}] must be a Supabase photo UUID or legacy album-scoped photo ID`)
    assert(!/^https?:\/\//i.test(photoId), `${label}[${index}] must not be a URL`)
    assert(!photoId.includes('/album.html'), `${label}[${index}] must not be an album page URL`)
    assert(!/photos\.app\.goo\.gl|photos\.google\.com/i.test(photoId), `${label}[${index}] must not be a Google Photos URL`)
  })
}

const indexHtml = readText('djr/index.html')
const serviceHtml = readText('djr/service.html')
const cmsIndexHtml = readText('admin/cms/index.html')
const albumPhotoSelector = readText('admin/widgets/album-photo-selector.js')
const brandPalettePicker = readText('admin/widgets/brand-palette-picker.js')
const brandKitPreview = readText('admin/preview-templates/brand-kit-preview.js')
assert(indexHtml.includes('data-djr-page="home"'), '/djr/ entrypoint is not marked as the DJR home page')
assert(indexHtml.includes('/djr/js/djr-content.js'), '/djr/ does not load DJR content renderer')
assert(!indexHtml.includes('/djr/js/djr-section-galleries.js'), '/djr/ must not load the old JSON CMS album card renderer')
assert(serviceHtml.includes('data-djr-page="service"'), '/djr/service.html must be marked as the DJR service page')
assert(serviceHtml.includes('/djr/js/djr-content.js'), '/djr/service.html must load the DJR content renderer')
assert(indexHtml.includes('David J. Richards') || indexHtml.includes('DJR Photography'), '/djr/ lacks DJR identity in baseline HTML')
assert(cmsIndexHtml.includes('/admin/config.yml'), '/admin/cms/ must load the generated Decap config')
assert(cmsIndexHtml.includes('window.CMS_MANUAL_INIT = true'), '/admin/cms/ must enable Decap manual initialization before loading Decap')
assert(cmsIndexHtml.indexOf('window.CMS_MANUAL_INIT = true') < cmsIndexHtml.indexOf('decap-cms'), '/admin/cms/ must set CMS_MANUAL_INIT before loading Decap')
assert(cmsIndexHtml.includes('/admin/preview-templates/participant-page-preview.js?v=participant-preview-9'), '/admin/cms/ must load the cache-busted Participant Pages preview template')
assert(cmsIndexHtml.indexOf('participant-page-preview.js?v=participant-preview-9') < cmsIndexHtml.indexOf('window.CMS.init()'), '/admin/cms/ must load the Participant Pages preview before CMS.init()')
assert(cmsIndexHtml.includes('/admin/widgets/album-photo-selector.js?v=album-photo-selector-3'), '/admin/cms/ must load the cache-busted Album Photo Selector widget')
assert(cmsIndexHtml.includes('/admin/widgets/brand-palette-picker.js?v=brand-palette-picker-1'), '/admin/cms/ must load the Brand Palette Picker')
assert(cmsIndexHtml.includes('/admin/widgets/brand-palette-picker.css?v=brand-palette-picker-1'), '/admin/cms/ must load Brand Palette Picker styles')
assert(cmsIndexHtml.includes('/admin/preview-templates/brand-kit-preview.js?v=brand-kit-preview-1'), '/admin/cms/ must load the Brand Kit preview')
assert(cmsIndexHtml.includes('window.__brandPalettePickerRegistered') && cmsIndexHtml.includes('window.__brandKitPreviewRegistered'), '/admin/cms/ must wait for Brand Kit workshop registrations before CMS.init()')
assert(!cmsIndexHtml.includes('type="module" src="/admin/widgets/album-photo-selector.js'), '/admin/cms/ must load the Album Photo Selector as a normal script so it registers before CMS.init()')
assert(cmsIndexHtml.includes('window.__albumPhotoSelectorRegistered'), '/admin/cms/ must wait for the Album Photo Selector before CMS.init() when available')
assert(cmsIndexHtml.includes('[CMS Init] Initializing after registration wait timeout'), '/admin/cms/ should log diagnostics if widget/preview registration times out')
assert(cmsIndexHtml.includes('https://oiiluqrpzhujbvrblsko.supabase.co'), '/admin/cms/ CSP must allow the Supabase media source for the Album Photo Selector')

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
  'brandKit',
  'defaultAlbumId',
  'sections',
  'sections.hero',
  'sections.hero.enabled',
  'sections.hero.allowParticipantEdit',
  'sections.hero.tagline',
  'sections.hero.allowParticipantAlbum',
  'sections.hero.albumId',
  'sections.hero.imageMode',
  'sections.hero.selectedPhotoIds',
  'sections.hero.selectedPhotoIds[]',
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
  'sections.story.imageMode',
  'sections.story.selectedPhotoIds',
  'sections.story.selectedPhotoIds[]',
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
  'sections.featured.imageMode',
  'sections.featured.selectedPhotoIds',
  'sections.featured.selectedPhotoIds[]',
  'sections.featured.imageLimit',
  'sections.about',
  'sections.about.enabled',
  'sections.about.allowParticipantEdit',
  'sections.about.eyebrow',
  'sections.about.title',
  'sections.about.body',
  'sections.about.allowParticipantAlbum',
  'sections.about.albumId',
  'sections.about.imageMode',
  'sections.about.selectedPhotoIds',
  'sections.about.selectedPhotoIds[]',
  'sections.about.imageLimit',
  'sections.creative',
  'sections.creative.enabled',
  'sections.creative.allowParticipantEdit',
  'sections.creative.eyebrow',
  'sections.creative.title',
  'sections.creative.body',
  'sections.creative.allowParticipantAlbum',
  'sections.creative.albumId',
  'sections.creative.imageMode',
  'sections.creative.selectedPhotoIds',
  'sections.creative.selectedPhotoIds[]',
  'sections.creative.imageLimit',
  'sections.cta',
  'sections.cta.enabled',
  'sections.cta.allowParticipantEdit',
  'sections.cta.title',
  'sections.cta.sub',
  'sections.cta.buttonLabel',
  'contactPage',
  'contactPage.enabled',
  'contactPage.allowParticipantEdit',
  'contactPage.eyebrow',
  'contactPage.title',
  'contactPage.intro',
  'contactPage.availabilityTitle',
  'contactPage.availabilityBody',
  'contactPage.responseTitle',
  'contactPage.responseBody',
  'contactPage.sessionTypeLabel',
  'contactPage.submitButtonLabel',
  'footer',
  'footer.enabled',
  'footer.allowParticipantEdit',
  'footer.brandLine',
  'footer.contactLabel',
  'footer.locationText',
  'footer.copyrightNote',
  'footer.quickLinksTitle',
  'footer.socialTitle',
  'footer.partnerLabel',
  'services',
  'services.enabled',
  'services.allowParticipantEdit',
  'services.eyebrow',
  'services.title',
  'services.items',
  'services.items[]',
  'services.items[].serviceId',
  'services.items[].enabled',
  'services.items[].category',
  'services.items[].icon',
  'services.items[].title',
  'services.items[].summary',
  'services.items[].serviceDescription',
  'services.items[].packageDetails',
  'services.items[].packageDetails[]',
  'services.items[].albumId',
  'services.items[].imageMode',
  'services.items[].selectedPhotoIds',
  'services.items[].selectedPhotoIds[]',
  'services.items[].imageLimit',
  'services.items[].displayMode',
  'services.items[].ctaLabel',
])

for (const participantPath of collectPaths(participantPage)) {
  assert(participantPageAllowedPaths.has(participantPath), `participant page config exposes non-allowlisted field: ${participantPath}`)
}

assert(participantPage?.name === 'David J. Richards', 'DJR participant page config must identify David J. Richards')
assert(participantPage?.slug === 'djr', 'DJR participant page config slug must be djr')
assert(participantPage?.template === 'djr-photography', 'DJR participant page config must use the djr-photography template')
assert(participantPage?.brandKit === 'djr', 'DJR participant page config must reference the djr Brand Kit')
validateAlbumIdField(participantPage?.defaultAlbumId, 'defaultAlbumId')
for (const sectionKey of ['hero', 'story', 'featured', 'about', 'creative', 'cta']) {
  const section = participantPage?.sections?.[sectionKey]
  assert(section && typeof section === 'object', `participant page section ${sectionKey} must exist`)
  assert(typeof section.enabled === 'boolean', `participant page section ${sectionKey}.enabled must be boolean`)
  assert(typeof section.allowParticipantEdit === 'boolean', `participant page section ${sectionKey}.allowParticipantEdit must be boolean`)
  if (sectionKey !== 'cta') {
    assert(typeof section.allowParticipantAlbum === 'boolean', `participant page section ${sectionKey}.allowParticipantAlbum must be boolean`)
    validateAlbumIdField(section.albumId, `sections.${sectionKey}.albumId`)
    validateImageMode(section.imageMode, `sections.${sectionKey}.imageMode`)
    validatePhotoIds(section.selectedPhotoIds, `sections.${sectionKey}.selectedPhotoIds`)
    validateImageLimit(section.imageLimit, `sections.${sectionKey}.imageLimit`)
  }
}

const services = participantPage?.services
assert(services && typeof services === 'object', 'participant page services section must exist')
assert(typeof services.enabled === 'boolean', 'participant page services.enabled must be boolean')
assert(typeof services.allowParticipantEdit === 'boolean', 'participant page services.allowParticipantEdit must be boolean')
assert(Array.isArray(services.items) && services.items.length >= 1, 'participant page services.items must include at least one DJR service offering')
for (const [index, service] of (services.items || []).entries()) {
  assert(service && typeof service === 'object', `services.items[${index}] must be an object`)
  assert(typeof service.enabled === 'boolean', `services.items[${index}].enabled must be boolean`)
  assert(typeof service.serviceId === 'string' && SLUG_RE.test(service.serviceId), `services.items[${index}].serviceId must be URL-safe slug text`)
  for (const field of ['category', 'icon', 'title', 'summary', 'serviceDescription', 'ctaLabel']) {
    assert(typeof service[field] === 'string', `services.items[${index}].${field} must be a string`)
    assert(!/<[a-z][\s\S]*>/i.test(service[field]), `services.items[${index}].${field} must not contain raw HTML`)
  }
  assert(Array.isArray(service.packageDetails), `services.items[${index}].packageDetails must be an array`)
  service.packageDetails.forEach((detail, detailIndex) => {
    assert(typeof detail === 'string', `services.items[${index}].packageDetails[${detailIndex}] must be a string`)
    assert(!/<[a-z][\s\S]*>/i.test(detail), `services.items[${index}].packageDetails[${detailIndex}] must not contain raw HTML`)
  })
  validateAlbumIdField(service.albumId, `services.items[${index}].albumId`)
  validateImageMode(service.imageMode, `services.items[${index}].imageMode`)
  validatePhotoIds(service.selectedPhotoIds, `services.items[${index}].selectedPhotoIds`)
  validateImageLimit(service.imageLimit, `services.items[${index}].imageLimit`)
  assert(service.displayMode === 'grid' || service.displayMode === 'slideshow', `services.items[${index}].displayMode must be grid or slideshow`)
}
assert(services.items.some((service) => service.displayMode === 'slideshow'), 'participant page service offerings should support slideshow display mode')

for (const groupName of ['contactPage', 'footer']) {
  const group = participantPage[groupName]
  assert(group && typeof group === 'object', `participant page ${groupName} must exist`)
  assert(typeof group.enabled === 'boolean', `${groupName}.enabled must be boolean`)
  assert(typeof group.allowParticipantEdit === 'boolean', `${groupName}.allowParticipantEdit must be boolean`)
  for (const [key, value] of Object.entries(group)) {
    if (key === 'enabled' || key === 'allowParticipantEdit') continue
    assert(typeof value === 'string', `${groupName}.${key} must be plain text`)
    assert(!/<[a-z][\s\S]*>/i.test(value), `${groupName}.${key} must not contain raw HTML`)
  }
}

for (const invalidId of ['david-behind-the-lens', '/album.html?album=fe027096-7084-4f96-974a-315b98b484b2', 'https://photos.google.com/share/example', 'https://www.whostosay.org/album.html?album=fe027096-7084-4f96-974a-315b98b484b2']) {
  assert(!isBlankOrUuid(invalidId), `album ID validator must reject ${invalidId}`)
  assert(!(typeof invalidId === 'string' && UUID_RE.test(invalidId)), `photo ID validator must reject ${invalidId}`)
}

for (const relativePath of listJsonFiles('content/djr')) {
  const data = readJson(relativePath)
  collectImageRefs(data).forEach(({ url, key }) => localAssetExists(url, `${relativePath}.${key}`))
}

const djrContent = readText('djr/js/djr-content.js')
const brandKitLoader = readText('js/participant-pages/brandKit.js')
const djrBrandKit = readJson('content/participant-brand-kits/djr.json')
const codyBrandKit = readJson('content/participant-brand-kits/cody.json')
assert(BRAND_KIT_SCHEMA_VERSION === 1, 'Brand Kit loader must support schema version 1')
assert(djrBrandKit?.schemaVersion === 1 && djrBrandKit?.slug === 'djr', 'DJR Brand Kit must use schema version 1 and slug djr')
assert(djrBrandKit?.status === 'approved', 'DJR Brand Kit must be approved')
assert(djrBrandKit?.designSystem?.colors?.palette === 'djr-cinematic-blue', 'DJR Brand Kit must use the approved cinematic blue palette')
assert(djrBrandKit?.designSystem?.colors?.mode === 'dark', 'DJR cinematic blue palette must use dark mode')
assert(djrBrandKit?.designSystem?.colors?.accent === 'electric-blue', 'DJR cinematic blue palette must use the electric blue accent')
assert(DESIGN_SYSTEM_REGISTRY.palettes['djr-cinematic-blue']?.tokens?.accent === '#4da6ff', 'DJR cinematic blue registry should reflect the established DJR electric blue accent')
assert(codyBrandKit?.schemaVersion === 1 && codyBrandKit?.slug === 'cody', 'Cody Brand Kit must use schema version 1 and slug cody')
assert(codyBrandKit?.status === 'draft', 'Cody Brand Kit must remain draft-only')
assert(!fs.existsSync(path.join(root, 'cody')), 'Cody Brand Kit must not create a /cody route')
assert(!fs.existsSync(path.join(root, 'participants', 'cody')), 'Cody Brand Kit must not create a participant Cody route')

for (const [label, kit] of [['DJR', djrBrandKit], ['Cody', codyBrandKit]]) {
  assert(kit?.workshop && typeof kit.workshop === 'object', `${label} Brand Kit must include workshop metadata`)
  for (const area of WORKSHOP_AREAS) {
    assert(kit.workshop[area] && typeof kit.workshop[area] === 'object', `${label} workshop must include ${area}`)
    assert(typeof kit.workshop[area].enabled === 'boolean', `${label} workshop ${area}.enabled must be boolean`)
    assert(WORKSHOP_STATUSES.includes(kit.workshop[area].status), `${label} workshop ${area}.status must be approved`)
    assert(PARTICIPANT_COMFORT_LEVELS.includes(kit.workshop[area].participantComfort), `${label} workshop ${area}.participantComfort must be approved`)
    assert(typeof kit.workshop[area].notes === 'string', `${label} workshop ${area}.notes must be plain text`)
  }
  const colors = kit?.designSystem?.colors || {}
  const palette = DESIGN_SYSTEM_REGISTRY.palettes[colors.palette]
  assert(Boolean(palette), `${label} palette must be an approved palette ID`)
  assert(palette?.modes.includes(colors.mode), `${label} palette mode must be approved for its palette`)
  assert(palette?.accents.includes(colors.accent), `${label} accent must be approved for its palette`)
  assert(!/^#[0-9a-f]{3,8}$/i.test(colors.palette || ''), `${label} palette must not be a raw hex value`)
  assert(!/^#[0-9a-f]{3,8}$/i.test(colors.accent || ''), `${label} accent must not be a raw hex value`)
}

const hostileBrandKit = normalizeBrandKit({
  schemaVersion: 1,
  slug: 'djr',
  status: 'approved',
  route: '/hijack',
  href: 'javascript:alert(1)',
  url: 'https://example.com',
  formAction: 'https://example.com/collect',
  navigation: [{ href: '/hijack' }],
  albums: ['fe027096-7084-4f96-974a-315b98b484b2'],
  albumId: 'fe027096-7084-4f96-974a-315b98b484b2',
  scripts: ['https://example.com/evil.js'],
  css: 'body { display: none }',
  html: '<script>alert(1)</script>',
  layout: 'arbitrary-grid',
  participantId: 'participant-djr',
  ownership: { ownerUserIds: ['self-assigned'] },
  access: { role: 'superadmin' },
  userRoles: ['superadmin'],
  contactProfile: { email: 'private@example.com' },
  socialProfiles: [{ platform: 'example', url: 'https://example.com' }],
  identity: { brandName: '<img src=x onerror=alert(1)>', tagline: 'Safe tagline' },
  messaging: { approvedCallsToAction: [{ id: 'contact', label: 'Contact', intent: 'contact', href: 'javascript:alert(1)' }] },
  designSystem: { preset: 'unknown', colors: { palette: 'unknown', raw: '#000' } },
})
for (const forbiddenKey of ['route', 'href', 'url', 'formAction', 'navigation', 'albums', 'albumId', 'scripts', 'css', 'html', 'layout', 'participantId', 'ownership', 'access', 'userRoles', 'contactProfile', 'socialProfiles']) {
  assert(!(forbiddenKey in hostileBrandKit), `Brand Kit normalizer must discard forbidden field: ${forbiddenKey}`)
}
assert(hostileBrandKit.identity.brandName === '', 'Brand Kit normalizer must discard raw HTML text')
assert(hostileBrandKit.identity.tagline === 'Safe tagline', 'Brand Kit normalizer should preserve safe plain text')
assert(hostileBrandKit.messaging.approvedCallsToAction[0].intent === 'contact', 'Brand Kit normalizer should preserve CTA intent')
assert(!('href' in hostileBrandKit.messaging.approvedCallsToAction[0]), 'Brand Kit CTA must not expose arbitrary URLs')
assert(hostileBrandKit.designSystem.preset === '', 'Brand Kit normalizer must reject unknown design presets')
assert(!('raw' in hostileBrandKit.designSystem.colors), 'Brand Kit normalizer must discard raw color values')
assert(hostileBrandKit.designSystem.colors.palette === 'high-contrast-access', 'Unknown palettes must fall back to the safe high-contrast palette')
assert(hostileBrandKit.designSystem.colors.accent === 'yellow', 'Raw or unknown accents must fall back to an approved accent')
assert(brandKitLoader.includes("fetcher(`/content/participant-brand-kits/${slug}.json`"), 'Brand Kit loader must load only slug-addressed local JSON')
assert(djrContent.includes('loadParticipantBrandKit'), 'DJR renderer should safely load referenced Brand Kit metadata')
assert(!djrContent.includes('brandKit.designSystem'), 'DJR renderer must not apply Brand Kit design presets in version 1')
assert(!readText('djr/assets/djr.css').includes('djr-cinematic-blue'), 'DJR public stylesheet must remain independent from the Brand Kit palette preset')
assert(djrContent.includes('fetchOptionalJson'), 'DJR content renderer should preserve behavior when optional JSON files are missing')
assert(djrContent.includes('overlayParticipantCopy'), 'DJR content renderer should overlay participant copy through an allowlisted helper')
assert(djrContent.includes('/content/participant-pages/djr.json'), 'DJR content renderer should load the participant page config')
assert(djrContent.includes('cmsPreview') && djrContent.includes('participant-pages'), 'DJR content renderer should gate CMS preview mode behind cmsPreview=participant-pages')
assert(djrContent.includes('wtsParticipantPagePreview:'), 'DJR content renderer should read participant preview config from sessionStorage only in preview mode')
assert(djrContent.includes('readParticipantPreviewConfig'), 'DJR content renderer should isolate participant preview config reads')
assert(djrContent.includes('loadParticipantPageConfig'), 'DJR content renderer should fall back to saved participant config when preview data is unavailable')
assert(djrContent.includes('overlayParticipantAlbums'), 'DJR content renderer should overlay Supabase album images before rendering')
assert(djrContent.includes('overlayParticipantPageContent'), 'DJR content renderer should overlay safe Participant Pages copy')
assert(djrContent.includes('overlayParticipantServices'), 'DJR content renderer should overlay safe Participant Pages service offerings')
assert(djrContent.includes('allowParticipantEdit !== true'), 'DJR content renderer must only apply participant text overlays when allowParticipantEdit is true')
assert(djrContent.includes('applyNonEmptyString'), 'DJR content renderer must preserve fallback content for blank participant fields')
assert(djrContent.includes('applyParticipantSectionToggles'), 'DJR content renderer should apply participant section toggles')
assert(djrContent.includes('allowParticipantAlbum !== true'), 'DJR content renderer must only apply section album overlays when allowParticipantAlbum is true')
assert(djrContent.includes('section.albumId || config.defaultAlbumId'), 'DJR content renderer should use section album IDs before defaultAlbumId')
assert(djrContent.includes("section.imageMode === 'singlePhoto'"), 'DJR content renderer should support single-photo image mode')
assert(djrContent.includes("imageMode === 'singlePhoto' ? 1"), 'DJR content renderer should force image limit 1 for single-photo mode')
assert(djrContent.includes('/js/participant-pages/albumImages.js'), 'DJR content renderer should use the participant album image helper')
assert(djrContent.includes('renderServicePage'), 'DJR content renderer should render DJR service offering pages')
assert(djrContent.includes('/djr/service.html?service='), 'DJR service cards should link to service offering pages')
assert(djrContent.includes('loadServiceImages'), 'DJR service pages should load album images through the participant album helper')
assert(djrContent.includes('renderServiceSlideshow'), 'DJR service pages should render slideshow visual mode')
assert(djrContent.includes('initServiceSlideshow'), 'DJR service slideshow should initialize public controls')
assert(!djrContent.includes('content/djr-albums'), 'DJR content renderer must not depend on JSON CMS albums')

const albumImageHelper = readText('js/participant-pages/albumImages.js')
assert(albumImageHelper.includes('UUID_RE'), 'Participant album helper should validate UUID album IDs')
assert(albumImageHelper.includes('getAlbumById'), 'Participant album helper should fetch Supabase album metadata')
assert(albumImageHelper.includes('getOrderedAlbumPhotos'), 'Participant album helper should fetch ordered Supabase photos')
assert(albumImageHelper.includes('getPublicUrl'), 'Participant album helper should map storage paths to public URLs')
assert(albumImageHelper.includes('is_private'), 'Participant album helper should reject private albums')
assert(albumImageHelper.includes('selectedPhotoIds'), 'Participant album helper should support selected photo IDs')
assert(albumImageHelper.includes('manualSelection'), 'Participant album helper should support manual image selection mode')
assert(albumImageHelper.includes('singlePhoto'), 'Participant album helper should support single-photo image mode')
assert(albumImageHelper.includes('selectedPhotoIds.slice(0, 1)'), 'Participant album helper should use the first selected Photo ID for single-photo mode')
assert(albumImageHelper.includes('photoId'), 'Participant album helper should return normalized photo IDs')
assert(albumImageHelper.includes('ALBUM_SCOPED_PHOTO_ID_RE'), 'Participant album helper should preserve legacy album-scoped selected photo IDs')
assert(albumImageHelper.includes('selectedPhotoId === image.filePath'), 'Participant album helper should preserve legacy file_path selected photo IDs')

assert(albumPhotoSelector.includes("registerWidget('album-photo-selector'"), 'Album Photo Selector must register a Decap custom widget')
assert(!albumPhotoSelector.startsWith('import '), 'Album Photo Selector must not use top-level imports before widget registration')
assert(albumPhotoSelector.includes('window.__albumPhotoSelectorScriptLoaded = true'), 'Album Photo Selector should set a script-loaded diagnostic flag')
assert(albumPhotoSelector.includes('window.__albumPhotoSelectorRegistered = true'), 'Album Photo Selector should set a registration diagnostic flag')
assert(albumPhotoSelector.includes('window.__albumPhotoSelectorRegistrationFailed = true'), 'Album Photo Selector should set a failure diagnostic flag')
assert(albumPhotoSelector.includes('[Album Photo Selector] script loaded v3'), 'Album Photo Selector should log the v3 script-loaded marker')
assert(albumPhotoSelector.includes('[Album Photo Selector] registered v3'), 'Album Photo Selector should log the v3 registration marker')
assert(albumPhotoSelector.includes('window.h || (window.React && window.React.createElement)'), 'Album Photo Selector should use Decap h before falling back to React.createElement')
assert(!albumPhotoSelector.includes('React.useState'), 'Album Photo Selector must not rely on React hooks')
assert(!albumPhotoSelector.includes('React.useEffect'), 'Album Photo Selector must not rely on React hooks')
assert(albumPhotoSelector.includes("import('/js/photo-album/services/albumService.js')"), 'Album Photo Selector should dynamically import album services only when needed')
assert(albumPhotoSelector.includes('getOrderedAlbumPhotos'), 'Album Photo Selector should load ordered Supabase album photos')
assert(albumPhotoSelector.includes('getAlbumById'), 'Album Photo Selector should reject missing/private albums through album metadata')
assert(albumPhotoSelector.includes('props.onChange(nextIds)'), 'Album Photo Selector should write selected Photo IDs back to Decap')
assert(albumPhotoSelector.includes('Images come from /albums.html'), 'Album Photo Selector should explain the Media Hub workflow')

assert(brandPalettePicker.includes("registerWidget('brand-palette-picker'"), 'Brand Palette Picker must register a Decap custom widget')
assert(brandPalettePicker.includes('window.__brandPalettePickerRegistered = true'), 'Brand Palette Picker must expose a registration marker')
assert(brandPalettePicker.includes('This palette uses approved contrast pairs.'), 'Brand Palette Picker must explain accessible contrast')
for (const paletteId of Object.keys(DESIGN_SYSTEM_REGISTRY.palettes)) assert(brandPalettePicker.includes(paletteId), `Brand Palette Picker is missing ${paletteId}`)
assert(!brandPalettePicker.includes('type="color"'), 'Brand Palette Picker must not expose raw color inputs')

assert(brandKitPreview.includes("registerPreviewTemplate('participant-brand-kits'"), 'Brand Kit preview must register for participant-brand-kits')
assert(brandKitPreview.includes('Draft Brand Kit'), 'Brand Kit preview must clearly label drafts')
assert(brandKitPreview.includes('Skipped for now') && brandKitPreview.includes('Needs support'), 'Brand Kit preview must represent opt-out and support states')
assert(brandKitPreview.includes('This board is a workshop view, not a public page.'), 'Brand Kit preview must explain that it is not a public page')

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
assert(participantPreview.includes('function safeGetIn'), 'Participant Pages preview should defensively read Decap entry data')
assert(participantPreview.includes('props = props || {}'), 'Participant Pages preview should handle missing props without throwing')
assert(participantPreview.includes('console.log') && participantPreview.includes('console.warn'), 'Participant Pages preview should include admin-only registration logging')
assert(participantPreview.includes('[Participant Pages Preview] script loaded v8'), 'Participant Pages preview should log the v8 load marker')
assert(participantPreview.includes('[Participant Pages Preview] registered for participant-pages v8'), 'Participant Pages preview should log the v8 registration marker')
assert(participantPreview.includes('[Participant Pages Preview] iframe draft updated'), 'Participant Pages preview should log iframe draft updates')
for (const previewKey of ['participant-pages', 'djr', 'participant-pages-djr']) {
  assert(participantPreview.includes(`[Participant Pages Preview] registered for ' + key`) && participantPreview.includes(previewKey), `Participant Pages preview should register/log key: ${previewKey}`)
}
assert(!participantPreview.includes('CMS.init('), 'Participant Pages preview script must not initialize Decap')
assert(participantPreview.includes('participant-page-preview.css?v=participant-preview-8'), 'Participant Pages preview should cache-bust its preview CSS')
assert(participantPreview.includes('wtsParticipantPagePreview:'), 'Participant Pages preview should write draft data to sessionStorage')
assert(participantPreview.includes('sessionStorage.setItem'), 'Participant Pages preview should store draft data for the iframe')
assert(participantPreview.includes('/djr/?cmsPreview=participant-pages&previewSlug='), 'Participant Pages preview should render the live DJR page iframe in CMS preview mode')
assert(participantPreview.includes('/djr/contact.html?cmsPreview=participant-pages&previewSlug='), 'Participant Pages preview should offer the live DJR contact page in CMS preview mode')
assert(participantPreview.includes('participant-page-preview__iframe'), 'Participant Pages preview should render an iframe as the main preview')
assert(participantPreview.includes('Live DJR Page Preview'), 'Participant Pages preview should show a live preview toolbar')
assert(participantPreview.includes('Preview auto-updates as you edit'), 'Participant Pages preview should explain that edits auto-update the iframe')
assert(participantPreview.includes('Refresh Preview'), 'Participant Pages preview should keep an honest iframe refresh control')
assert(!participantPreview.includes('Undo preview'), 'Participant Pages preview must not show a fake undo control')
assert(!participantPreview.includes('undoPreview'), 'Participant Pages preview must not include iframe-only undo behavior')
assert(!participantPreview.includes('Story / The Photographer'), 'Participant Pages preview should not render admin section cards as the main preview')
assert(!participantPreview.includes('getAlbumById'), 'Participant Pages preview must not fetch Supabase album metadata')
assert(!participantPreview.includes('widget: image'), 'Participant Pages preview must not introduce upload widgets')

const cmsConfig = readText('admin/config.shared.yml')
const brandKitsCollection = extractCollection(cmsConfig, 'participant-brand-kits')
assert(brandKitsCollection, 'Decap shared config is missing the participant-brand-kits collection')
if (brandKitsCollection) {
  assert(brandKitsCollection.includes('folder: content/participant-brand-kits'), 'Brand Kits collection must expose content/participant-brand-kits')
  assert(brandKitsCollection.includes('create: false'), 'Brand Kits collection must not let participants create arbitrary kits')
  for (const expectedField of ['schemaVersion', 'slug', 'status', 'workshop', 'brandFoundation', 'audienceMessage', 'voiceLanguage', 'storyCta', 'photoVisual', 'colorsDesign', 'identity', 'strategy', 'voice', 'messaging', 'visualDirection', 'designSystem', 'governance']) {
    assert(hasFieldName(brandKitsCollection, expectedField), `Brand Kits collection is missing field: ${expectedField}`)
  }
  for (const forbiddenField of ['href', 'url', 'route', 'formAction', 'nav', 'navigation', 'albumId', 'albums', 'script', 'scripts', 'css', 'html', 'layout', 'image', 'src']) {
    assert(!hasFieldName(brandKitsCollection, forbiddenField), `Brand Kits collection must not expose field: ${forbiddenField}`)
  }
  assert(!brandKitsCollection.includes('widget: image'), 'Brand Kits collection must not expose image uploads')
  assert(brandKitsCollection.includes('widget: brand-palette-picker'), 'Brand Kits collection must use the visual Brand Palette Picker')
  assert(brandKitsCollection.includes('Skip for now') && brandKitsCollection.includes('Needs staff help') && brandKitsCollection.includes('This feels too deep today') && brandKitsCollection.includes('Come back later'), 'Brand Kits workshop must use participant-friendly opt-out labels')
  for (const prompt of ['What should people know about this participant?', 'Who is this page for?', 'What should people feel or do after seeing this?', 'Words that sound like this participant', 'Words that do not fit or should not be used', 'What kinds of images feel right?', 'What should the page feel like visually?']) {
    assert(brandKitsCollection.includes(prompt), `Brand Kits collection is missing participant-friendly prompt: ${prompt}`)
  }
  assert(brandKitsCollection.includes('Choose three or four qualities that sound like this participant.'), 'Voice Traits should include plain-language examples and do/don\'t guidance')
}
const participantPagesCollection = extractCollection(cmsConfig, 'participant-pages')
assert(participantPagesCollection, 'Decap shared config is missing the participant-pages collection')
if (participantPagesCollection) {
  assert(participantPagesCollection.includes('file: content/participant-pages/djr.json'), 'Participant Pages collection must expose content/participant-pages/djr.json')
  for (const expectedField of ['name', 'slug', 'template', 'brandKit', 'defaultAlbumId', 'sections', 'hero', 'story', 'featured', 'about', 'creative', 'cta', 'contactPage', 'intro', 'availabilityTitle', 'availabilityBody', 'responseTitle', 'responseBody', 'sessionTypeLabel', 'submitButtonLabel', 'footer', 'brandLine', 'contactLabel', 'locationText', 'copyrightNote', 'quickLinksTitle', 'socialTitle', 'partnerLabel', 'services', 'items', 'serviceId', 'category', 'icon', 'summary', 'serviceDescription', 'packageDetails', 'displayMode', 'ctaLabel', 'enabled', 'allowParticipantEdit', 'allowParticipantAlbum', 'albumId', 'imageMode', 'selectedPhotoIds', 'imageLimit', 'eyebrow', 'title', 'lead', 'body', 'quote', 'tagline', 'sub', 'buttonLabel']) {
    assert(hasFieldName(participantPagesCollection, expectedField), `Participant Pages collection is missing field: ${expectedField}`)
  }
  for (const forbiddenField of ['href', 'formAction', 'photoGalleryAlbumId', 'googlePhotosAlbumUrl', 'album_id', 'nav', 'partner', 'button', 'primaryButton', 'secondaryButton', 'sourceType', 'sectionId', 'html', 'image', 'src']) {
    assert(!hasFieldName(participantPagesCollection, forbiddenField), `Participant Pages collection must not expose field: ${forbiddenField}`)
  }
  assert(!participantPagesCollection.includes('widget: image'), 'Participant Pages collection must not expose media upload widgets')
  assert(participantPagesCollection.includes('Use custom text for this section'), 'Participant Pages collection should label text toggles clearly')
  assert(djrContent.includes('imageLimit: 1'), 'DJR renderer should limit service card album requests to the first resolved image')
  assert(djrContent.includes("overlayParticipantContact(data, participantConfig)"), 'DJR contact page should consume the safe Participant Pages contact overlay')
  assert(djrContent.includes("data.formAction"), 'DJR contact renderer must retain the admin-owned form action')
  assert(djrContent.includes("data.sessionTypes"), 'DJR contact renderer must retain admin-owned session choices')
  assert(djrContent.includes("partner.href"), 'DJR footer must retain the admin-owned partner destination')
  assert(participantPagesCollection.includes('Use album images for this section'), 'Participant Pages collection should label album toggles clearly')
  assert(participantPagesCollection.includes('Turn this off to show the official/default DJR copy for this section without deleting your draft text.'), 'Participant Pages collection should explain how to revert custom text without deleting drafts')
  assert(participantPagesCollection.includes('Turn this on to use images from the Album UUID below. Turn it off to use the default DJR images.'), 'Participant Pages collection should explain how album image toggles work')
  assert(participantPagesCollection.includes('Single selected photo'), 'Participant Pages collection should expose a single-photo image mode')
  assert(participantPagesCollection.includes('Photo UUIDs must come from the Album UUID above.'), 'Participant Pages collection should explain Photo UUIDs must match the Album UUID')
  assert(participantPagesCollection.includes('Albums and Photo IDs come from /albums.html. The public service page uses these images without showing media hub/admin controls.'), 'Participant Pages collection should explain the service offering media workflow')
  assert(participantPagesCollection.includes('widget: album-photo-selector'), 'Participant Pages collection should use the visual Album Photo Selector for selected photos')
  assert(participantPagesCollection.includes('default: slideshow'), 'Participant Pages service display mode should default to slideshow')
}

const djrCollection = extractCollection(cmsConfig, 'djr')
assert(djrCollection.includes('hide: true'), 'DJR Photography advanced/admin fallback collection should be hidden from the participant-facing sidebar')
assert(djrCollection.includes('Advanced/Admin Legacy'), 'DJR Photography collection should be labeled as advanced/admin legacy')
assert(djrCollection.includes('Section Gallery Mapper - Legacy/Admin'), 'Legacy section gallery mapper should be labeled as legacy/admin')

const djrCollectionMatch = extractCollection(cmsConfig, 'djr-gallery-albums')
assert(!djrCollectionMatch, 'Decap shared config must not expose the old JSON DJR album media collection')
assert(!cmsConfig.includes('folder: content/djr-albums'), 'Decap shared config must not expose content/djr-albums as participant media')

const participantRegistryLoader = readText('js/participant-pages/participantRegistry.js')
const ownershipDocs = readText('docs/participant-ownership-schema.md')
const participantRegistries = ['djr', 'cody'].map((registrySlug) => ({
  registrySlug,
  registry: readJson(`content/participants/${registrySlug}.json`),
}))
const participantIds = new Set()

function collectAlbumIds(value, found = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectAlbumIds(item, found))
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if ((key === 'albumId' || key === 'defaultAlbumId') && typeof item === 'string' && item) found.add(item)
      else collectAlbumIds(item, found)
    }
  }
  return found
}

for (const { registrySlug, registry } of participantRegistries) {
  assert(registry && typeof registry === 'object', `${registrySlug} participant registry must exist`)
  if (!registry) continue
  assert(registry.schemaVersion === PARTICIPANT_REGISTRY_SCHEMA_VERSION, `${registrySlug} participant registry must use schema version ${PARTICIPANT_REGISTRY_SCHEMA_VERSION}`)
  assert(registry.slug === registrySlug, `${registrySlug} participant registry slug must match its filename`)
  assert(typeof registry.participantId === 'string' && /^participant-[a-z0-9-]+$/.test(registry.participantId), `${registrySlug} participantId must use the stable participant-* format`)
  assert(!participantIds.has(registry.participantId), `participantId must be unique: ${registry.participantId}`)
  participantIds.add(registry.participantId)
  assert(registry.resources && typeof registry.resources === 'object', `${registrySlug} registry must define resources`)
  assert(registry.access && typeof registry.access === 'object', `${registrySlug} registry must define future access assignments`)
  assert(registry.reviewRequirements && typeof registry.reviewRequirements === 'object', `${registrySlug} registry must define review requirements`)
  const normalized = normalizeParticipantRegistry(registry)
  assert(JSON.stringify(normalized) === JSON.stringify(registry), `${registrySlug} registry must contain only normalized allowlisted fields and values`)

  const brandKitSlug = registry.resources.brandKitSlug
  const brandKit = brandKitSlug ? readJson(`content/participant-brand-kits/${brandKitSlug}.json`) : null
  assert(!brandKitSlug || (brandKit && brandKit.slug === brandKitSlug), `${registrySlug} registry Brand Kit reference must resolve`)

  const pageSlug = registry.resources.pageSlug
  const page = pageSlug ? readJson(`content/participant-pages/${pageSlug}.json`) : null
  assert(!pageSlug || (page && page.slug === pageSlug), `${registrySlug} registry page reference must resolve`)
  assert(!page || page.brandKit === brandKitSlug, `${registrySlug} page and registry must reference the same Brand Kit`)
  const assignedAlbums = new Set(registry.resources.albumIds || [])
  for (const albumId of collectAlbumIds(page)) {
    assert(assignedAlbums.has(albumId), `${registrySlug} page album ${albumId} must be assigned in the participant registry`)
  }
}

const codyRegistry = participantRegistries.find((item) => item.registrySlug === 'cody')?.registry
assert(codyRegistry?.status === 'draft', 'Cody participant registry must remain draft')
assert(codyRegistry?.resources?.pageSlug === '', 'Cody participant registry must not authorize a public page')
assert(!fs.existsSync(path.join(root, 'content/participant-pages/cody.json')), 'Cody participant page must not exist')
assert(!djrContent.includes('/content/participants/'), 'Public DJR rendering must not consume the ownership registry yet')
assert(!extractCollection(cmsConfig, 'participants'), 'Decap must not expose the ownership registry in this implementation')

const hostileRegistry = normalizeParticipantRegistry({
  schemaVersion: 1,
  participantId: 'participant-hostile',
  slug: 'hostile',
  displayName: '<img src=x onerror=alert(1)>',
  route: '/hostile',
  template: 'unsafe',
  href: 'javascript:alert(1)',
  url: 'https://example.com',
  formAction: 'https://example.com/collect',
  navigation: [{ href: '/hostile' }],
  contactProfile: { email: 'private@example.com' },
  socialProfiles: [{ platform: 'example', url: 'https://example.com' }],
  scripts: ['evil.js'],
  css: 'body{}',
  html: '<p>unsafe</p>',
  layout: 'unsafe',
  resources: { pageSlug: 'hostile', brandKitSlug: 'hostile', albumIds: ['not-a-uuid'] },
  access: { ownerUserIds: ['not-a-supabase-user-id'], role: 'superadmin' },
})
for (const forbiddenKey of ['route', 'template', 'href', 'url', 'formAction', 'navigation', 'contactProfile', 'socialProfiles', 'scripts', 'css', 'html', 'layout']) {
  assert(!(forbiddenKey in hostileRegistry), `Participant registry normalizer must discard forbidden field: ${forbiddenKey}`)
}
assert(hostileRegistry.displayName === '', 'Participant registry normalizer must discard raw HTML display names')
assert(hostileRegistry.resources.albumIds.length === 0, 'Participant registry normalizer must discard invalid album IDs')
assert(hostileRegistry.access.ownerUserIds.length === 0, 'Participant registry normalizer must accept only Supabase UUID user IDs')
assert(!('role' in hostileRegistry.access), 'Participant registry access must not accept self-assigned roles')
assert(participantRegistryLoader.includes("fetcher(`/content/participants/${slugValue}.json`"), 'Participant registry loader must load only slug-addressed local JSON')
assert(!participantRegistryLoader.includes('participantRegistry') || !djrContent.includes('loadParticipantRegistry'), 'Participant registry must not be connected to public DJR rendering')
assert(ownershipDocs.includes('Google OAuth') && ownershipDocs.includes('Supabase Auth'), 'Ownership docs must recommend Google OAuth through Supabase Auth for the next Studio phase')
for (const authorizationTable of ['participants', 'user_roles', 'participant_user_access', 'participant_album_access', 'review_requests', 'publish_events', 'audit_events']) {
  assert(ownershipDocs.includes('`' + authorizationTable + '`'), `Ownership docs must name authorization record: ${authorizationTable}`)
}
assert(ownershipDocs.includes('is not the authorization system'), 'Ownership docs must distinguish Google OAuth authentication from authorization')

const studioAuthPlan = readText('docs/studio-auth-plan.md')
const studioAuthSchema = readText('supabase/studio-auth-schema.sql')
const studioIndex = readText('studio/index.html')
const studioCallback = readText('studio/auth/callback/index.html')
const studioAuth = readText('studio/js/studio-auth.js')
const studioAuthCallback = readText('studio/js/auth-callback.js')
const studioStyles = readText('studio/assets/studio.css')
const studioFoundationFiles = [studioAuthPlan, studioAuthSchema, studioIndex, studioCallback, studioAuth, studioAuthCallback, studioStyles]

assert(studioAuthPlan.includes('Supabase Auth') && studioAuthPlan.includes('Google OAuth'), 'Studio auth plan must document Supabase Auth with Google OAuth')
assert(studioAuthPlan.includes('openid email profile'), 'Studio auth plan must limit Google identity scopes to openid, email, and profile')
assert(studioAuthPlan.includes('Optional magic-link fallback'), 'Studio auth plan must document the optional magic-link fallback')
assert(studioAuthPlan.includes('/studio/auth/callback/'), 'Studio auth plan must document the callback route')
assert(studioAuthPlan.includes('Google Photos') && studioAuthPlan.includes('does not request'), 'Studio auth plan must explicitly defer Google Photos scopes')
assert(studioAuthPlan.includes('contact or social') || studioAuthPlan.includes('contact/social'), 'Studio auth plan must defer contact/social editing')

for (const tableName of ['profiles', 'participants', 'user_roles', 'participant_user_access', 'participant_album_access', 'audit_events']) {
  assert(studioAuthSchema.includes(`public.${tableName}`), `Studio SQL draft must include public.${tableName}`)
  assert(studioAuthSchema.includes(`alter table public.${tableName} enable row level security`), `Studio SQL draft must enable RLS on public.${tableName}`)
}
assert(studioAuthSchema.includes('is_studio_superadmin') && studioAuthSchema.includes('has_participant_access'), 'Studio SQL draft must centralize participant-scoped authorization checks')
assert(studioAuthSchema.includes('No client insert policy is granted'), 'Studio SQL draft must keep audit event writes server-controlled')
assert(!/alter table public\.(albums|photos)\b/i.test(studioAuthSchema), 'Studio SQL draft must not alter existing album/photo tables')
assert(!/google[_ ]?(email|domain).*grant/i.test(studioAuthSchema), 'Studio SQL draft must not authorize from Google identity attributes')

assert(studioIndex.includes("Who's to Say Studio"), 'Studio shell must identify Who\'s to Say Studio')
assert(studioIndex.includes('Sign in with Google'), 'Studio shell must offer Google sign-in')
assert(studioIndex.includes('My Participants'), 'Studio shell must include the locked My Participants placeholder')
assert(studioIndex.includes('Participant editing is not enabled yet'), 'Studio shell must clearly keep participant editing disabled')
assert(!/<input\b/i.test(studioIndex), 'Studio shell must not expose participant, contact, or social editing fields')
assert(studioCallback.includes('/studio/js/auth-callback.js'), 'Studio callback route must load the callback handler')
assert(studioAuth.includes("provider: 'google'"), 'Studio auth must use the Supabase Google provider')
assert(studioAuth.includes("scopes: 'openid email profile'"), 'Studio auth must request identity scopes only')
assert(studioAuth.includes("import { supabase } from '../../js/supabase.js'"), 'Studio auth must reuse the existing public Supabase client without duplicating credentials')
assert(!studioAuth.includes(".from('participants')") && !studioAuth.includes('.from("participants")'), 'Studio shell must not query participant authorization data before policies are deployed')
assert(!/photoslibrary|drive\.google|googleapis\.com\/auth/i.test(studioAuthPlan + studioAuth), 'Studio foundation must not request Google Photos or Drive scopes')

for (const [index, fileText] of studioFoundationFiles.entries()) {
  assert(!/sb_secret_[A-Za-z0-9_-]+/.test(fileText), `Studio foundation file ${index + 1} must not contain a Supabase secret key`)
  assert(!/\b(?:service_role|service-role)\b\s*[:=]\s*['"][^'"]+/i.test(fileText), `Studio foundation file ${index + 1} must not contain a service-role credential`)
  assert(!/GOCSPX-[A-Za-z0-9_-]+/.test(fileText), `Studio foundation file ${index + 1} must not contain a Google client secret`)
}

if (errors.length) {
  console.error('DJR content contract failed:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('DJR content contract passed')
console.log('Checked /djr/, participant page album config, and Decap participant-page scope.')
