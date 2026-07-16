export const BRAND_KIT_SCHEMA_VERSION = 1

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const STATUSES = new Set(['draft', 'in-review', 'approved'])
const READING_LEVELS = new Set(['plain', 'general', 'advanced'])
const PERSONS = new Set(['first-person', 'third-person', 'mixed'])
const DESIGN_PRESETS = new Set(['documentary-warm', 'advocacy-editorial'])
const COLOR_PRESETS = new Set(['djr', 'accidental-advocate'])
const TYPE_PRESETS = new Set(['editorial-sans', 'bold-editorial'])
const BUTTON_PRESETS = new Set(['solid-rounded', 'solid-square'])
const CARD_PRESETS = new Set(['quiet-bordered', 'editorial-bordered'])
const IMAGE_PRESETS = new Set(['natural-cinematic', 'documentary-candid'])
const BACKGROUND_PRESETS = new Set(['layered-dark', 'warm-light'])
const RHYTHM_PRESETS = new Set(['spacious', 'balanced'])
const MOTION_PRESETS = new Set(['subtle', 'minimal'])

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
      colors: { palette: choice(colors.palette, COLOR_PRESETS), mode: choice(colors.mode, new Set(['dark', 'light'])), accent: text(colors.accent, 40) },
      typography: { preset: choice(typography.preset, TYPE_PRESETS) },
      buttons: { preset: choice(buttons.preset, BUTTON_PRESETS) },
      cards: { preset: choice(cards.preset, CARD_PRESETS) },
      images: { preset: choice(images.preset, IMAGE_PRESETS) },
      backgrounds: { preset: choice(backgrounds.preset, BACKGROUND_PRESETS) },
      rhythm: { preset: choice(rhythm.preset, RHYTHM_PRESETS) },
      motion: { preset: choice(motion.preset, MOTION_PRESETS), reducedMotionRequired: motion.reducedMotionRequired !== false },
    },
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
