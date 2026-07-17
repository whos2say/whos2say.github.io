# Participant Brand Kit Schema — Version 1

Participant Brand Kits define reusable identity, audience, message, voice, visual direction, and approved design presets. They teach brand-first thinking; they are not page builders or style sheets.

## Ownership boundary

- `content/participant-brand-kits/{slug}.json` owns durable brand guidance and constrained design choices.
- `content/participant-pages/{slug}.json` owns template selection, section copy, visibility, and Media Hub album/photo references.
- `content/participants/{slug}.json` owns participant/resource relationships, assigned album UUIDs, and review governance metadata. It does not make authorization enforceable in the static repo.
- Templates own routes, structure, layout, HTML, CSS, scripts, forms, navigation, link destinations, and preset implementation.
- `/albums.html` and Supabase remain the source of truth for images.

A Participant Page connects to a kit with `"brandKit": "djr"`.

## Top-level contract

| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | number | Must be `1` |
| `slug` | string | Lowercase URL-safe identifier; does not create a route |
| `status` | enum | `draft`, `in-review`, or `approved` |
| `identity` | object | Brand name, participant name, tagline, short bio, long bio |
| `strategy` | object | Purpose, audiences, key/supporting messages, desired response |
| `voice` | object | Voice summary, teaching traits, contextual tone, vocabulary, writing rules |
| `messaging` | object | Origin story, public message, proof points, advocacy fields, CTA intents, prohibited claims |
| `visualDirection` | object | Photo guidance, color mood, design style, accessibility intent |
| `designSystem` | object | Closed, template-safe preset selections |
| `governance` | object | Editability, review requirement, approval metadata, notes |
| `workshop` | object | Guided progress, comfort, opt-out, and support metadata for six workshop areas |

The complete field shape is demonstrated by `content/participant-brand-kits/djr.json` and `content/participant-brand-kits/cody.json`.

## Safe normalization

`js/participant-pages/brandKit.js` constructs a new allowlisted object. It never merges source data into page or template data. Unknown properties are discarded. Raw-HTML-like text is discarded, strings and lists are bounded, identifiers are normalized, and design choices must match closed preset registries.

The normalized result has no fields for routes, navigation, link destinations, arbitrary URLs, forms, albums, photo IDs, uploads, HTML, scripts, raw CSS, layout, section ordering, markup, or DOM attributes.

CTA entries contain only `id`, `label`, semantic `intent`, and `description`. A template or admin-owned registry must map intent to an approved destination.

## Brand Workshop flow

The CMS presents six guided areas: Brand Foundation, Audience and Message, Voice and Language, Story and Invitations, Photo and Visual Direction, and Colors and Design. Each area stores:

- `enabled`: include the area in the current workshop.
- `status`: `not-started`, `in-progress`, `skip-for-now`, `needs-staff-help`, or `complete`.
- `participantComfort`: `comfortable`, `unsure`, `too-deep`, or `needs-support`.
- `notes`: plain-text decisions, questions, or reminders.

Skipping is a supported workshop choice, not a validation error. The Brand Board displays disabled and `skip-for-now` areas as “Skipped for now.” Areas marked `too-deep`, `needs-support`, or `needs-staff-help` display as “Needs support.” This lets a participant set boundaries and return later without losing work.

## Facilitator script: 20-minute Brand Kit workshop

The facilitator should read prompts conversationally and type short notes while the participant talks. The goal is shared understanding, not completing every field.

### 0–2 minutes: welcome and permission

Say: “We are making a guide for how your page should sound and feel. There are no wrong answers. You can skip anything, ask for help, or come back later. This Brand Board is for our workshop; it does not publish a new page by itself.”

Confirm how the participant wants to take part: speaking, choosing between examples, reviewing draft words, or having a support person help capture ideas.

### 2–6 minutes: what matters and who it is for

Ask:

- “What should people know about you or your work?”
- “Who do you hope sees this page?”
- “What should they feel or do after seeing it?”

DJR examples: “David is building a point of view through practice and attention.” “The page is for families, athletes and teams, community partners, and creative collaborators.” “Visitors should feel the energy in the work and want to see more or start a conversation.”

### 6–10 minutes: voice and words

Ask: “If this page sounded like you, what would it sound like?” Offer choices such as warm, direct, observant, playful, steady, bold, or reflective. For each chosen trait, ask: “What should we do to sound that way?” and “What would sound wrong?”

Then ask: “Which words sound like you?” and “Are there words, labels, stereotypes, or kinds of language we should not use?”

DJR examples: observant, human, cinematic; use “point of view,” “moment,” “attention,” and “practice”; avoid inflated promises, corporate language, and pity framing.

### 10–14 minutes: story and invitation

Ask:

- “Is there a short story that helps people understand how this started?”
- “What would you like to invite people to do?”
- “Is there anything private, inaccurate, or too personal that should stay off the page?”

DJR examples: the camera became a way to step into the world; invite people to see the work or contact DJR; distinguish imagined or AI-assisted scenes from documentary photography.

### 14–18 minutes: images, feeling, and palette

Ask: “What kinds of images feel right?” and “What should the page feel like visually?” Use the palette cards as choices rather than asking for color codes.

DJR examples: people in action, behind-the-scenes practice, human moments, eye-level connection, cinematic and photography-first design. Use **DJR Cinematic Blue** for deep navy surfaces, cool silver text, and electric blue highlights.

### 18–20 minutes: review and next step

Look at the Brand Board together. Say: “What feels right? What should change? What should we skip for now?” Mark each area complete, in progress, skipped, or needing staff help. Read back any important boundaries and identify one next action.

Finishing every section is not the goal. A participant choosing “This feels too deep today,” “Skip for now,” or “Needs staff help” is a successful workshop decision and should be respected.

## Design presets and publication

Version 1 accepts named presets for overall design, palette, typography, buttons, cards, images, backgrounds, rhythm, and motion. It does not apply them to DJR yet. Templates may consume only explicitly supported presets while preserving current design fallbacks.

The palette picker offers approved curated choices: DJR Cinematic Blue, Warm Documentary, Bold Advocate, Calm Focus, Electric Creative, Natural Community, Editorial Classic, and High Contrast Access. Each writes only a palette ID, approved mode, and approved accent name. Token examples and hex values live in code for the workshop preview; raw color inputs are not stored or exposed. Curated palettes keep the exercise approachable and provide reviewed contrast pairs.

`djr-cinematic-blue` mirrors the established DJR site's dark cinematic direction: near-black and deep navy surfaces, cool silver text, electric blue as the primary accent, subtle cyan highlights, and muted gold as an optional small emphasis. Selecting it changes the Brand Board only; it is not applied to `/djr/` public output.

The Decap preview is a visual Brand Board showing identity, palette, type, button, card, photo direction, voice, vocabulary, CTA intent, and workshop progress. It is not a preview of a public participant page and cannot create a route.

`status` is metadata, not a route generator. Cody remains draft-only until Cody's language and a separate `accidental-advocate` template are approved.

Brand Kits do not contain ownership, roles, contact profiles, social accounts, or authentication data. The DJR and draft Cody registry records reference their Brand Kits separately. Direct participant editing requires a future authenticated Studio with participant-scoped authorization; Decap remains staff-operated.

Consumers must check `schemaVersion`. Invalid versions normalize to a safe empty result and leave template fallbacks unchanged. Breaking changes require a new version and migration plan.
