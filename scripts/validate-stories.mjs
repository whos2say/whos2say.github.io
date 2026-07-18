#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = path.join(root, 'content', 'stories')
const allowedTypes = new Set(['participant-story', 'case-study'])
const allowedStatuses = new Set(['draft', 'published'])
const allowedSections = new Set(['rich-text', 'image-text', 'quote', 'cards', 'steps', 'gallery', 'feature-image', 'callout', 'final-cta'])
const errors = []
const assert = (condition, message) => { if (!condition) errors.push(message) }
const read = file => fs.readFileSync(file, 'utf8')
const existsFromUrl = url => fs.existsSync(path.join(root, url.replace(/^\/+/, '').split(/[?#]/)[0]))
const records = fs.readdirSync(contentDir).filter(name => name.endsWith('.json')).map(name => {
  const file = path.join(contentDir, name)
  try { return { file, name, data: JSON.parse(read(file)) } } catch (error) {
    errors.push(`${name}: invalid JSON (${error.message})`)
    return null
  }
}).filter(Boolean)
const manifest = JSON.parse(read(path.join(root, 'content', 'stories-manifest.json')))
const manifestPaths = new Set(manifest.stories)
const volumes = new Map()
const slugs = new Set()

function requiredString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`)
}

function validateAction(action, label, optional = false) {
  if (!action && optional) return
  assert(action && typeof action === 'object', `${label} must be an action`)
  if (!action) return
  requiredString(action.label, `${label}.label`)
  requiredString(action.href, `${label}.href`)
  assert(/^(https:\/\/|\/|#)/.test(action.href || ''), `${label}.href must be https, root-relative, or an anchor`)
}

function validateLocalLink(href, label, shell) {
  if (!href || /^https:\/\//.test(href)) return
  if (href.startsWith('#')) {
    assert(shell.includes(`id="${href.slice(1)}"`) || label.includes('hero.primaryAction'), `${label}: missing anchor ${href}`)
    return
  }
  assert(existsFromUrl(href) || href === '/stories/' || href === '/djr/', `${label}: missing local target ${href}`)
}

for (const { name, data } of records) {
  const prefix = name
  assert(data.schemaVersion === 1, `${prefix}: schemaVersion must be 1`)
  requiredString(data.slug, `${prefix}.slug`)
  assert(name === `${data.slug}.json`, `${prefix}: filename must match slug`)
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug || ''), `${prefix}: invalid slug`)
  assert(!slugs.has(data.slug), `${prefix}: duplicate slug ${data.slug}`)
  slugs.add(data.slug)
  assert(allowedTypes.has(data.type), `${prefix}: invalid type`)
  assert(allowedStatuses.has(data.status), `${prefix}: invalid status`)
  assert(/^#[0-9a-f]{6}$/i.test(data.theme?.accent || ''), `${prefix}: theme.accent must be a hex color`)
  if (data.type === 'participant-story') {
    assert(Number.isInteger(data.volume) && data.volume > 0, `${prefix}: participant stories require a positive integer volume`)
    if (volumes.has(data.volume)) errors.push(`${prefix}: duplicate participant volume ${data.volume} also used by ${volumes.get(data.volume)}`)
    volumes.set(data.volume, name)
  } else {
    assert(data.volume == null, `${prefix}: case studies must not have a volume`)
  }
  if (data.status === 'published') assert(/^\d{4}-\d{2}-\d{2}$/.test(data.publishedAt || ''), `${prefix}: published stories require publishedAt`)

  const routeUrl = `/stories/${data.slug}.html`
  const routeFile = path.join(root, routeUrl.slice(1))
  assert(fs.existsSync(routeFile), `${prefix}: missing route ${routeUrl}`)
  const shell = fs.existsSync(routeFile) ? read(routeFile) : ''
  assert(shell.includes(`data-story-slug="${data.slug}"`), `${prefix}: route shell slug mismatch`)
  assert(shell.includes('/js/stories/story-system.js'), `${prefix}: route does not load shared renderer`)

  for (const key of ['title', 'description', 'canonical', 'image']) requiredString(data.seo?.[key], `${prefix}.seo.${key}`)
  assert(data.seo?.canonical === `https://www.whostosay.org${routeUrl}`, `${prefix}: canonical must match route`)
  assert(shell.includes(`<title>${data.seo?.title}</title>`), `${prefix}: shell title must match content SEO`)
  assert(shell.includes(`rel="canonical" href="${data.seo?.canonical}"`), `${prefix}: shell canonical must match content SEO`)
  assert(existsFromUrl(data.seo?.image || ''), `${prefix}: missing SEO image ${data.seo?.image}`)

  for (const key of ['title', 'summary', 'label', 'image', 'imageAlt']) requiredString(data.listing?.[key], `${prefix}.listing.${key}`)
  assert(Number.isFinite(data.listing?.order), `${prefix}: listing.order must be numeric`)
  assert(existsFromUrl(data.listing?.image || ''), `${prefix}: missing listing image ${data.listing?.image}`)
  for (const key of ['eyebrow', 'title', 'lead', 'image', 'imageAlt']) requiredString(data.hero?.[key], `${prefix}.hero.${key}`)
  assert(existsFromUrl(data.hero?.image || ''), `${prefix}: missing hero image ${data.hero?.image}`)
  validateAction(data.hero?.primaryAction, `${prefix}.hero.primaryAction`)
  validateAction(data.hero?.secondaryAction, `${prefix}.hero.secondaryAction`, true)

  assert(Array.isArray(data.sections) && data.sections.length > 0, `${prefix}: sections must not be empty`)
  const ids = new Set((data.sections || []).map(section => section.id).filter(Boolean))
  for (const [index, section] of (data.sections || []).entries()) {
    const label = `${prefix}.sections[${index}]`
    assert(allowedSections.has(section.type), `${label}: invalid section type ${section.type}`)
    assert(!JSON.stringify(section).match(/<[a-z][\s\S]*>/i), `${label}: HTML is not allowed`)
    if (['rich-text', 'image-text'].includes(section.type)) {
      assert(Array.isArray(section.paragraphs) && section.paragraphs.length > 0, `${label}: paragraphs required`)
    }
    if (section.type === 'image-text') {
      requiredString(section.imageAlt, `${label}.imageAlt`)
      assert(existsFromUrl(section.image || ''), `${label}: missing image ${section.image}`)
      assert(!section.imageFit || ['cover', 'contain'].includes(section.imageFit), `${label}: imageFit must be cover or contain`)
    }
    if (section.type === 'feature-image') {
      requiredString(section.heading, `${label}.heading`)
      requiredString(section.imageAlt, `${label}.imageAlt`)
      assert(existsFromUrl(section.image || ''), `${label}: missing image ${section.image}`)
    }
    if (section.type === 'gallery') for (const [itemIndex, item] of (section.items || []).entries()) {
      requiredString(item.imageAlt, `${label}.items[${itemIndex}].imageAlt`)
      assert(existsFromUrl(item.image || ''), `${label}: missing image ${item.image}`)
    }
    for (const actionKey of ['action', 'primaryAction', 'secondaryAction']) {
      validateAction(section[actionKey], `${label}.${actionKey}`, true)
      if (section[actionKey]) validateLocalLink(section[actionKey].href, `${label}.${actionKey}`, shell)
    }
  }
  if (data.hero?.primaryAction?.href?.startsWith('#')) {
    assert(ids.has(data.hero.primaryAction.href.slice(1)), `${prefix}: hero action anchor is not provided by a section`)
  }
  if (data.hero?.secondaryAction?.href?.startsWith('#')) {
    assert(ids.has(data.hero.secondaryAction.href.slice(1)), `${prefix}: secondary hero action anchor is not provided by a section`)
  }
  assert(manifestPaths.has(`/content/stories/${name}`), `${prefix}: missing from stories manifest`)
}

for (const item of manifest.stories) {
  assert(existsFromUrl(item), `stories manifest references missing content ${item}`)
}
assert(manifest.stories.length === records.length, 'stories manifest membership does not match story records')

if (errors.length) {
  console.error(`Story validation failed (${errors.length}):\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log(`Story validation passed: ${records.length} records, ${volumes.size} unique participant volumes, all routes/assets/SEO/links/index entries valid.`)
