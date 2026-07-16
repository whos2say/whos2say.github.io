export const BRAND_KIT_SCHEMA_VERSION = 1

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const STATUSES = new Set(['draft', 'in-review', 'approved'])
const READING_LEVELS = new Set(['plain', 'general', 'advanced'])
const PERSONS = new Set(['first-person', 'third-person', 'mixed'])
const DESIGN_PRESETS = new Set(['documentary-warm', 'advocacy-editorial'])
export const DESIGN_SYSTEM_REGISTRY = Object.freeze({
  palettes: Object.freeze({
    'djr-cinematic-blue': { label: 'DJR Cinematic Blue', modes: ['dark'], accents: ['electric-blue', 'cyan', 'muted-gold'], tokens: { background: '#07090d', surface: '#10141c', text: '#e8ecf2', muted: '#aeb9c8', accent: '#4da6ff', accentText: '#04111f', border: '#273246', image: '#22c7e8' } },
    'warm-documentary': { label: 'Warm Documentary', modes: ['dark', 'light'], accents: ['amber', 'rust'], tokens: { background: '#171411', surface: '#27211b', text: '#fffaf2', muted: '#d8cab8', accent: '#e9a23b', accentText: '#211506', border: '#5e4d3b', image: '#9d6737' } },
    'bold-advocate': { label: 'Bold Advocate', modes: ['light', 'dark'], accents: ['gold', 'coral'], tokens: { background: '#fff9ed', surface: '#ffffff', text: '#152238', muted: '#526077', accent: '#b86b00', accentText: '#ffffff', border: '#c8b58f', image: '#1f4777' } },
    'calm-focus': { label: 'Calm Focus', modes: ['light', 'dark'], accents: ['blue', 'teal'], tokens: { background: '#f1f7f8', surface: '#ffffff', text: '#17333a', muted: '#526c72', accent: '#176b78', accentText: '#ffffff', border: '#b9d0d4', image: '#7ca6ad' } },
    'electric-creative': { label: 'Electric Creative', modes: ['dark', 'light'], accents: ['violet', 'cyan'], tokens: { background: '#17122b', surface: '#282044', text: '#ffffff', muted: '#cec5ea', accent: '#a78bfa', accentText: '#17122b', border: '#5c4a88', image: '#22d3ee' } },
    'natural-community': { label: 'Natural Community', modes: ['light', 'dark'], accents: ['forest', 'clay'], tokens: { background: '#f6f3e8', surface: '#fffdf5', text: '#26382b', muted: '#637064', accent: '#3e704b', accentText: '#ffffff', border: '#bec9b9', image: '#a9674f' } },
    'editorial-classic': { label: 'Editorial Classic', modes: ['light', 'dark'], accents: ['burgundy', 'navy'], tokens: { background: '#f8f5ef', surface: '#ffffff', text: '#221f1d', muted: '#68615b', accent: '#7d2434', accentText: '#ffffff', border: '#c8c0b8', image: '#2d4059' } },
    'high-contrast-access': { label: 'High Contrast Access', modes: ['dark', 'light'], accents: ['yellow', 'cyan'], tokens: { background: '#000000', surface: '#171717', text: '#ffffff', muted: '#e5e5e5', accent: '#ffe500', accentText: '#000000', border: '#ffffff', image: '#00e5ff' } },
  }),
  typography: Object.freeze(['editorial-sans', 'bold-editorial']),
  buttons: Object.freeze(['solid-rounded', 'solid-square']),
  cards: Object.freeze(['quiet-bordered', 'editorial-bordered']),
  images: Object.freeze(['natural-cinematic', 'documentary-candid']),
  backgrounds: Object.freeze(['layered-dark', 'warm-light']),
  rhythm: Object.freeze(['spacious', 'balanced']),
  motion: Object.freeze(['subtle', 'minimal']),
})
const COLOR_PRESETS = new Set(Object.keys(DESIGN_SYSTEM_REGISTRY.palettes))
const TYPE_PRESETS = new Set(['editorial-sans', 'bold-editorial'])
const BUTTON_PRESETS = new Set(['solid-rounded', 'solid-square'])
const CARD_PRESETS = new Set(['quiet-bordered', 'editorial-bordered'])
const IMAGE_PRESETS = new Set(['natural-cinematic', 'documentary-candid'])
const BACKGROUND_PRESETS = new Set(['layered-dark', 'warm-light'])
const RHYTHM_PRESETS = new Set(['spacious', 'balanced'])
const MOTION_PRESETS = new Set(['subtle', 'minimal'])
export const WORKSHOP_STATUSES = Object.freeze(['not-started', 'in-progress', 'skip-for-now', 'needs-staff-help', 'complete'])
export const PARTICIPANT_COMFORT_LEVELS = Object.freeze(['comfortable', 'unsure', 'too-deep', 'needs-support'])
export const WORKSHOP_AREAS = Object.freeze(['brandFoundation', 'audienceMessage', 'voiceLanguage', 'storyCta', 'photoVisual', 'colorsDesign'])
const WORKSHOP_STATUS_SET = new Set(WORKSHOP_STATUSES)
const PARTICIPANT_COMFORT_SET = new Set(PARTICIPANT_COMFORT_LEVELS)

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function text(value, maxLength = 4000) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().slice(0, maxLength)
  return /<[a-z!/][\s\S]*>/i.test(normalized) ? '' : normalized
}

function textList(value, maxItems = 20, maxLength = 240) {
  if (!Array.isArray(value)) return []
  return value.map((item) => text(item, maxLength)).filter(Boolean).slice(0, maxItems)
}

function choice(value, allowed, fallback = '') {
  return typeof value === 'string' && allowed.has(value) ? value : fallback
}

function normalizeTrait(value) {
  const trait = object(value)
  return {
    name: text(trait.name, 80),
    description: text(trait.description, 500),
    do: text(trait.do, 500),
    dont: text(trait.dont, 500),
  }
}

function normalizeCallToAction(value) {
  const cta = object(value)
  return {
    id: text(cta.id, 80).toLowerCase().replace(/[^a-z0-9-]/g, ''),
    label: text(cta.label, 80),
    intent: text(cta.intent, 80).toLowerCase().replace(/[^a-z0-9-]/g, ''),
    description: text(cta.description, 300),
  }
}

function normalizeWorkshopArea(value) {
  const area = object(value)
  return {
    enabled: area.enabled !== false,
    status: choice(area.status, WORKSHOP_STATUS_SET, 'not-started'),
    participantComfort: choice(area.participantComfort, PARTICIPANT_COMFORT_SET, 'comfortable'),
    notes: text(area.notes, 1000),
  }
}

export function getPalettePreview(palette) {
  return DESIGN_SYSTEM_REGISTRY.palettes[palette] || DESIGN_SYSTEM_REGISTRY.palettes['high-contrast-access']
}

export function normalizeBrandKit(value) {
  const source = object(value)
  const identity = object(source.identity)
  const strategy = object(source.strategy)
  const voice = object(source.voice)
  const tone = object(voice.toneByContext)
  const rules = object(voice.writingRules)
  const messaging = object(source.messaging)
  const visual = object(source.visualDirection)
  const photo = object(visual.photoStyle)
  const design = object(source.designSystem)
  const colors = object(design.colors)
  const typography = object(design.typography)
  const buttons = object(design.buttons)
  const cards = object(design.cards)
  const images = object(design.images)
  const backgrounds = object(design.backgrounds)
  const rhythm = object(design.rhythm)
  const motion = object(design.motion)
  const governance = object(source.governance)
  const workshop = object(source.workshop)

  return {
    schemaVersion: source.schemaVersion === BRAND_KIT_SCHEMA_VERSION ? BRAND_KIT_SCHEMA_VERSION : null,
    slug: typeof source.slug === 'string' && SLUG_RE.test(source.slug) ? source.slug : '',
    status: choice(source.status, STATUSES, 'draft'),
    identity: {
      brandName: text(identity.brandName, 120),
      participantName: text(identity.participantName, 120),
      tagline: text(identity.tagline, 180),
      shortBio: text(identity.shortBio, 600),
      longBio: text(identity.longBio, 4000),
    },
    strategy: {
      purpose: text(strategy.purpose, 1000),
      primaryAudience: textList(strategy.primaryAudience),
      secondaryAudience: textList(strategy.secondaryAudience),
      keyMessage: text(strategy.keyMessage, 1000),
      supportingMessages: textList(strategy.supportingMessages, 20, 500),
      desiredAudienceResponse: text(strategy.desiredAudienceResponse, 500),
    },
    voice: {
      summary: text(voice.summary, 1000),
      traits: Array.isArray(voice.traits) ? voice.traits.map(normalizeTrait).filter((item) => item.name).slice(0, 12) : [],
      toneByContext: {
        introduction: text(tone.introduction, 500),
        story: text(tone.story, 500),
        invitation: text(tone.invitation, 500),
        sensitiveTopics: text(tone.sensitiveTopics, 1000),
      },
      wordsToUse: textList(voice.wordsToUse),
      wordsToAvoid: textList(voice.wordsToAvoid),
      writingRules: {
        readingLevel: choice(rules.readingLevel, READING_LEVELS, 'plain'),
        sentenceStyle: text(rules.sentenceStyle, 120),
        person: choice(rules.person, PERSONS, 'third-person'),
        accessibilityNotes: textList(rules.accessibilityNotes, 20, 500),
      },
    },
    messaging: {
      originStory: text(messaging.originStory, 4000),
      publicMessage: text(messaging.publicMessage, 2000),
      proofPoints: textList(messaging.proofPoints, 20, 500),
      advocacyTopics: textList(messaging.advocacyTopics, 20, 500),
      personalBoundaries: textList(messaging.personalBoundaries, 20, 500),
      approvedCallsToAction: Array.isArray(messaging.approvedCallsToAction)
        ? messaging.approvedCallsToAction.map(normalizeCallToAction).filter((item) => item.id && item.label && item.intent).slice(0, 12)
        : [],
      claimsToAvoid: textList(messaging.claimsToAvoid, 20, 500),
    },
    visualDirection: {
      photoStyle: {
        summary: text(photo.summary, 1000),
        subjects: textList(photo.subjects),
        composition: textList(photo.composition),
        lighting: textList(photo.lighting),
        mood: textList(photo.mood),
        avoid: textList(photo.avoid),
      },
      colorMood: textList(visual.colorMood),
      designStyle: textList(visual.designStyle),
      accessibilityIntent: text(visual.accessibilityIntent, 1000),
    },
    designSystem: {
      preset: choice(design.preset, DESIGN_PRESETS),
      colors: (() => {
        const palette = choice(colors.palette, COLOR_PRESETS, 'high-contrast-access')
        const definition = getPalettePreview(palette)
        return {
          palette,
          mode: choice(colors.mode, new Set(definition.modes), definition.modes[0]),
          accent: choice(colors.accent, new Set(definition.accents), definition.accents[0]),
        }
      })(),
      typography: { preset: choice(typography.preset, TYPE_PRESETS) },
      buttons: { preset: choice(buttons.preset, BUTTON_PRESETS) },
      cards: { preset: choice(cards.preset, CARD_PRESETS) },
      images: { preset: choice(images.preset, IMAGE_PRESETS) },
      backgrounds: { preset: choice(backgrounds.preset, BACKGROUND_PRESETS) },
      rhythm: { preset: choice(rhythm.preset, RHYTHM_PRESETS) },
      motion: { preset: choice(motion.preset, MOTION_PRESETS), reducedMotionRequired: motion.reducedMotionRequired !== false },
    },
    workshop: Object.fromEntries(WORKSHOP_AREAS.map((area) => [area, normalizeWorkshopArea(workshop[area])])),
    governance: {
      participantEditable: governance.participantEditable === true,
      reviewRequired: governance.reviewRequired !== false,
      approvedBy: text(governance.approvedBy, 120),
      approvedAt: text(governance.approvedAt, 40),
      notes: text(governance.notes, 1000),
    },
  }
}

export async function loadBrandKit(slug, options = {}) {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) return normalizeBrandKit({})
  const fetcher = options.fetcher || globalThis.fetch
  if (typeof fetcher !== 'function') return normalizeBrandKit({})
  try {
    const response = await fetcher(`/content/participant-brand-kits/${slug}.json`, { cache: 'no-cache' })
    if (!response || !response.ok) return normalizeBrandKit({})
    return normalizeBrandKit(await response.json())
  } catch (error) {
    return normalizeBrandKit({})
  }
}
