# Foundation Stories System

## Pre-coding audit (2026-07-18)

### Current state

- `stories/index.html` is a hand-authored index with one hard-coded Baseball Cards card.
- `stories/brendan.html` and `stories/baseball-cards.html` are full, independent page implementations. They duplicate document chrome, metadata, navigation, footer, and layout markup.
- Brendan has partial JSON content in `content/stories/brendan.json`, but its schema mirrors Brendan's one-off layout and the route still contains the same copy. Baseball Cards has no content record.
- `assets/css/story-base.css`, `assets/css/story.css`, and `assets/css/casestudy.css` contain useful shared tokens/components, but the routes also include large page-local style blocks and inline styles.
- `js/content/render.js` includes no generic story renderer. It only dispatches Brendan's legacy JSON into page-specific DOM slots.
- `content/navigation.json` contains a Brendan-specific subnavigation key.
- Decap already has a minimal `stories` folder collection, but it exposes only a subset of Brendan's fields, has no type/status/listing model, and permits records that cannot render generically.
- Story assets are inconsistent: Baseball Cards uses a slug directory; Brendan assets were deleted and later restored through Git history; brand assets sit in a separate story directory.
- Relevant Brendan history: `19f9347` introduced the one-off page, `2c62d5b` added partial JSON, `3f79290` removed the story/assets, and `e337ef1` restored the current structure. This explains the current duplicate-volume and index drift risk.
- `/djr/` is a separately branded participant portfolio with its own CMS content and renderer. It is not a Foundation story route and must not be replaced.
- The named `Participant Stories-David Richards.zip` handoff was not present in the workspace or adjacent repository directory at audit time. David's migration therefore uses only currently published, CMS-managed DJR facts and assets and does not introduce unsupported claims.
- The working tree began with an unrelated edit to `supabase/studio-auth-djr-bootstrap.example.sql`; it is excluded from this change.

### Problems to solve

1. Content, route, listing, and SEO can drift independently.
2. A new story currently requires bespoke HTML/CSS/JavaScript.
3. Draft content has no enforceable public-listing behavior.
4. Unrestricted HTML fields make CMS previews and validation unreliable.
5. Route shells cannot prove which record they represent.
6. Volume numbers and slugs can collide.
7. Images, internal links, canonical URLs, and index membership are not validated together.

## Proposed file structure

```text
stories/
  index.html                         # thin data-driven listing shell
  david-richards.html                # thin route shell
  brendan.html                       # thin route shell, existing URL retained
  baseball-cards.html                # thin route shell, existing URL/SEO retained
content/stories/
  david-richards.json
  brendan.json
  baseball-cards.json
content/stories-manifest.json          # ordered record paths for GitHub Pages
assets/css/story-system.css          # shared story and index presentation
assets/images/stories/
  david-richards/                    # future story-owned uploads
  brendan/
  baseball-cards/
js/stories/
  story-system.js                    # one renderer for routes and index
scripts/
  validate-stories.mjs               # schema/route/asset/SEO/index/link checks
docs/
  STORY_SYSTEM.md                    # schema, audit, migration, editorial guide
admin/
  config.shared.yml                  # source Decap collection
  config.yml                         # generated production config
package.json                         # validation scripts
```

Existing `story-base.css`, `story.css`, and `casestudy.css` remain temporarily for unrelated consumers/history but migrated routes load only the new shared system stylesheet.

## Story content schema

Each `content/stories/<slug>.json` record is a complete renderable story:

```json
{
  "schemaVersion": 1,
  "slug": "example-story",
  "type": "participant-story",
  "status": "draft",
  "volume": 3,
  "publishedAt": "2026-07-18",
  "featured": false,
  "theme": { "accent": "#0a8b7e" },
  "seo": {
    "title": "Required, unique page title",
    "description": "Required search/social description",
    "canonical": "https://www.whostosay.org/stories/example-story.html",
    "image": "/assets/images/stories/example-story/hero.jpg"
  },
  "listing": {
    "title": "Card title",
    "summary": "Card summary",
    "label": "Participant Story",
    "image": "/assets/images/stories/example-story/hero.jpg",
    "imageAlt": "Meaningful image description",
    "order": 30
  },
  "hero": {
    "eyebrow": "A Who's to Say story · Vol. 03",
    "title": "Plain-text title",
    "lead": "Plain-text lead",
    "image": "/assets/images/stories/example-story/hero.jpg",
    "imageAlt": "Meaningful image description",
    "primaryAction": { "label": "Read the story", "href": "#story" }
  },
  "sections": []
}
```

Allowed `type` values are `participant-story` and `case-study`. Allowed `status` values are `draft` and `published`. Participant stories require a positive, globally unique `volume`; case studies omit it.

Allowed reusable section types:

- `rich-text`: eyebrow, heading, and an array of plain-text paragraphs.
- `image-text`: the same text fields plus image, alt text, caption, and left/right placement.
- `quote`: quote text, attribution, and optional role.
- `cards`: heading/lead plus reusable title/body cards.
- `steps`: heading/lead plus ordered title/body steps.
- `gallery`: heading/lead plus image/alt/caption items.
- `feature-image`: a reusable full-width photograph with an accessible text overlay.
- `callout`: heading/body plus an optional validated link.
- `final-cta`: heading/body plus one or two validated actions.

Every reusable section accepts controlled layout settings:

```json
{
  "spacing": { "top": "compact", "bottom": "tight" },
  "width": "standard"
}
```

Spacing values are `none`, `tight`, `compact`, `standard`, and `spacious`; top and bottom are independent. Content widths are `narrow`, `standard`, `wide`, and `full`. Missing spacing values intentionally render as `compact` for backward compatibility. Normal story sections should stay compact; reserve larger spacing for deliberate editorial pauses. The hero keeps its larger fixed presentation and is not affected by section defaults.

Image presentation is also controlled: `cover`, `contain`, or `natural`. Use `cover` for photography, `contain` when the complete artwork must remain visible inside the component, and `natural` when the original intrinsic ratio should determine height.

No arbitrary HTML, inline scripts, style attributes, or page-specific renderer functions are allowed in content. Emphasis is represented by plain text and component styling.

## Migration plan

1. Add the generic schema, renderer, stylesheet, route/index shells, and validator.
2. Convert David from existing `/djr/` editorial facts while linking back to, not replacing, his portfolio.
3. Convert Brendan's current published JSON/page copy to reusable sections and restore index membership.
4. Convert Baseball Cards while preserving `/stories/baseball-cards.html`, its title, description, canonical/OG URL, and substantive claims.
5. Replace the minimal Decap collection with fields that exactly match the reusable schema.
6. Validate all records/routes/assets/SEO/links/index membership/volumes, then browser-smoke the index and each story at desktop/mobile widths.

## Migration risks

- David's original ZIP is the authoritative source for his participant-story narrative and visual identity. Its publication assets are copied into the story-owned directory; its authoring/runtime scaffolding is excluded.
- Existing Brendan donation-tier claims are not independently supported in repository content. The migration keeps supported story facts but avoids carrying specific funding-equivalency claims into the new generic record.
- Baseball Cards has substantial bespoke art direction. Moving to shared components may change presentation while retaining its URL, SEO metadata, images, quote attribution, and editorial meaning.
- Decap editorial workflow controls Git publication state, while the record's `status` controls public rendering/listing. Editors must set both deliberately.
- GitHub Pages cannot generate routes dynamically, so every new published story requires a small static shell in addition to its CMS record. Validation enforces the pair.

## Exact files expected to change

- `docs/STORY_SYSTEM.md`
- `package.json`
- `admin/config.shared.yml`
- `admin/config.yml` (generated)
- `content/navigation.json` (remove Brendan-only story subnav)
- `content/stories/brendan.json`
- `content/stories/baseball-cards.json` (new)
- `content/stories/david-richards.json` (new)
- `content/stories-manifest.json` (new)
- `stories/index.html`
- `stories/brendan.html`
- `stories/baseball-cards.html`
- `stories/david-richards.html` (new)
- `assets/css/story-system.css` (new)
- `js/stories/story-system.js` (new)
- `scripts/validate-stories.mjs` (new)

No `/djr/` file changes. David's five source-used identity assets are copied into `assets/images/stories/david-richards/`; the story no longer depends on `/assets/images/djr/` for its core identity.

## David source-handoff comparison

The original story is organized as: hero; self-designed DJR business card; photography practice and 740-photo archive; “Dream big” pull quote; three-part business pathway; full-width in-field learning moment; support appeal; and closing Foundation CTA.

The initial reusable migration contained a general “behind the lens” introduction, one practice image, a three-image `/djr/` gallery, a slogan quote, a portfolio callout, and a general support CTA. It omitted the self-designed brand narrative, exact archive/practice copy, original pathway language, in-field learning moment, handoff imagery, hero badge, and “Fund his next chapter” CTA.

The source-backed migration restores those elements with shared `image-text`, `quote`, `cards`, `callout`, `rich-text`, and `final-cta` components. It adds one genuinely reusable `feature-image` section and optional reusable hero badge/secondary action fields. Core identity assets now live in `assets/images/stories/david-richards/`.

Intentional differences from the handoff:

- The Foundation's shared site header/footer and reusable typography/spacing remain, rather than publishing a second one-off page shell.
- Text emphasis is expressed by component hierarchy rather than unrestricted inline HTML.
- The DJR logo is presented as an accessible contained image instead of a decorative stacked business-card animation.
- The full-width field photograph retains its overlay treatment without handoff-only parallax/authoring controls.
- The handoff's donation-tier equivalencies, placeholder `#` links, and nonfunctional custom amount form are not published. The verified Foundation Givebutter destination is used instead.
- The unused AI/Pixar image, React, ReactDOM, Babel, tweak panels, JSX design canvas, screen labels, and authoring scaffolding are excluded.
- `/djr/` remains separate and is linked from both the story body and final CTA.

## Editorial guide

### Create and preview

1. In Decap CMS, open **Stories** and choose **New Story**.
2. Use a lowercase hyphenated slug. Add the matching thin shell at `stories/<slug>.html` by copying an existing shell and changing only `data-story-slug`.
3. Start with `status: draft`. Complete SEO, listing, hero, and reusable sections. Put new assets in `assets/images/stories/<slug>/`.
4. Save the Decap draft and use its editorial preview deployment. Draft records render a clear preview notice and never appear on the public Stories index.

The CMS shell can be reviewed at `/admin/` on a feature preview without participant authentication. GitHub OAuth is not supported as a general feature-preview capability; test CMS login, save, review, and publish at `https://staging.whostosay.org/admin/`.

### Approve and publish

1. Review facts, consent, image rights, alt text, links, title/description, and mobile layout.
2. Run `npm run test:stories`. Resolve every error.
3. Set `status: published` and add `publishedAt`. Move the Decap entry through review to published.
4. Confirm the route and Stories index on the deployed site.

### Update later

Edit the same CMS record; do not create a second volume or route. Return it to draft only when it must temporarily disappear from the public index. Keep the slug/canonical stable unless a redirect plan is approved, and rerun story validation before publishing.
