# Participant Brand Kit Schema — Version 1

Participant Brand Kits define reusable identity, audience, message, voice, visual direction, and approved design presets. They teach brand-first thinking; they are not page builders or style sheets.

## Ownership boundary

- `content/participant-brand-kits/{slug}.json` owns durable brand guidance and constrained design choices.
- `content/participant-pages/{slug}.json` owns template selection, section copy, visibility, and Media Hub album/photo references.
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

The complete field shape is demonstrated by `content/participant-brand-kits/djr.json` and `content/participant-brand-kits/cody.json`.

## Safe normalization

`js/participant-pages/brandKit.js` constructs a new allowlisted object. It never merges source data into page or template data. Unknown properties are discarded. Raw-HTML-like text is discarded, strings and lists are bounded, identifiers are normalized, and design choices must match closed preset registries.

The normalized result has no fields for routes, navigation, link destinations, arbitrary URLs, forms, albums, photo IDs, uploads, HTML, scripts, raw CSS, layout, section ordering, markup, or DOM attributes.

CTA entries contain only `id`, `label`, semantic `intent`, and `description`. A template or admin-owned registry must map intent to an approved destination.

## Design presets and publication

Version 1 accepts named presets for overall design, palette, typography, buttons, cards, images, backgrounds, rhythm, and motion. It does not apply them to DJR yet. Templates may consume only explicitly supported presets while preserving current design fallbacks.

`status` is metadata, not a route generator. Cody remains draft-only until Cody's language and a separate `accidental-advocate` template are approved.

Consumers must check `schemaVersion`. Invalid versions normalize to a safe empty result and leave template fallbacks unchanged. Breaking changes require a new version and migration plan.
