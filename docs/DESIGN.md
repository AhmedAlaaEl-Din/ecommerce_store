# Nile Goods: design system (Phase 1)

> Nile Goods is an invented demo brand. Nothing here refers to a real company.

## 1. Direction

**Warm, calm, editorial, crafted.**

Nile Goods sells well-made everyday objects for the home, kitchen, desk and bag. The site should feel like a
small, considered shop rather than a marketplace:

- **Warm**: linen-toned background instead of plain white, earthy clay and river-green colours.
- **Calm**: generous whitespace, few colours on screen at once, one clear primary action per view.
- **Editorial**: a characterful serif for headings, left-aligned layouts, an asymmetric hero, small eyebrow
  labels above headings.
- **Crafted**: hand-made flat SVG illustrations in one consistent style, soft rounded corners, subtle depth.

What we avoid: plain white page, default blue buttons, system font, everything centred, heavy shadows,
gradients for their own sake, stock photography.

## 2. Colour tokens

Implemented as CSS variables in `src/app/globals.css` and exposed to Tailwind with `@theme` (for example
`bg-surface`, `text-muted`, `bg-primary`).

| Token              | Value     | Use                                             |
| ------------------ | --------- | ----------------------------------------------- |
| `--background`     | `#F7F3EC` | Page background (linen)                         |
| `--surface`        | `#FFFDF9` | Cards, header, sheets                           |
| `--surface-sunken` | `#EFE8DC` | Image wells, skeletons, inputs on surface       |
| `--text`           | `#1F2A24` | Body and heading text (deep river ink)          |
| `--muted`          | `#5A635D` | Secondary text, meta                            |
| `--border`         | `#E3DACB` | Hairlines, card borders (decorative)            |
| `--border-strong`  | `#8C8577` | Form control borders (meets 3:1 for UI)         |
| `--primary`        | `#2F5D50` | Primary buttons, links, focus ring (Nile green) |
| `--primary-hover`  | `#244A40` | Primary hover/pressed                           |
| `--primary-soft`   | `#DCE8E2` | Soft primary fills (selected chip)              |
| `--accent`         | `#9A4A24` | Sale price, sale badge (terracotta clay)        |
| `--accent-soft`    | `#F3E1D5` | Sale badge background, hero shapes              |
| `--success`        | `#2E6B3F` | In-stock, success toast icon                    |
| `--warning`        | `#875400` | Low-stock text                                  |
| `--warning-soft`   | `#F6E9CF` | Low-stock badge background                      |
| `--danger`         | `#B3261E` | Errors, out of stock                            |
| `--danger-soft`    | `#F7DEDB` | Out-of-stock badge background                   |

Category accent colours (used for illustration backgrounds and category tiles; never for text):
home `#E8D9C4`, kitchen `#D9E4D6`, stationery `#E4DCEB`, bags `#F1D9C9`.

### Contrast (WCAG 2.x, computed with the relative-luminance formula)

| Pair                          | Ratio   | Requirement | Result |
| ----------------------------- | ------- | ----------- | ------ |
| text on background            | 13.42:1 | 4.5:1       | Pass   |
| text on surface               | 14.61:1 | 4.5:1       | Pass   |
| muted on background           | 5.62:1  | 4.5:1       | Pass   |
| muted on surface              | 6.12:1  | 4.5:1       | Pass   |
| muted on surface-sunken       | 5.11:1  | 4.5:1       | Pass   |
| white on primary              | 7.49:1  | 4.5:1       | Pass   |
| white on primary-hover        | 9.87:1  | 4.5:1       | Pass   |
| primary on background (links) | 6.77:1  | 4.5:1       | Pass   |
| primary on primary-soft       | 5.95:1  | 4.5:1       | Pass   |
| accent on background          | 5.62:1  | 4.5:1       | Pass   |
| accent on surface             | 6.12:1  | 4.5:1       | Pass   |
| accent on accent-soft         | 4.90:1  | 4.5:1       | Pass   |
| white on accent               | 6.21:1  | 4.5:1       | Pass   |
| warning on warning-soft       | 5.30:1  | 4.5:1       | Pass   |
| danger on danger-soft         | 5.11:1  | 4.5:1       | Pass   |
| danger on surface             | 6.43:1  | 4.5:1       | Pass   |
| success on surface            | 6.28:1  | 4.5:1       | Pass   |
| focus ring (primary) on bg    | 6.77:1  | 3:1 (UI)    | Pass   |
| border-strong on background   | 3.31:1  | 3:1 (UI)    | Pass   |

## 3. Typography

- **Display**: Fraunces (SIL Open Font License), variable, used for h1–h3, prices on the product page and the
  wordmark. Slightly soft optical style, weight 500–600.
- **Text**: DM Sans (SIL Open Font License), variable, used for body, UI and labels.
- Both are loaded with `next/font/google`, which downloads them at build time and self-hosts them. No runtime
  font CDN.

| Step   | Size  | Line height | Use                                                  |
| ------ | ----- | ----------- | ---------------------------------------------------- |
| `xs`   | 12 px | 16 px       | Badges, eyebrow labels (uppercase, +0.08em tracking) |
| `sm`   | 14 px | 20 px       | Meta, captions, secondary buttons                    |
| `base` | 16 px | 24 px       | Body                                                 |
| `lg`   | 18 px | 28 px       | Lead paragraphs, card titles                         |
| `xl`   | 24 px | 32 px       | h3, section headings on mobile                       |
| `2xl`  | 32 px | 40 px       | h2, product name on mobile                           |
| `3xl`  | 48 px | 54 px       | h1 (hero) desktop, product name desktop              |

Headings use `text-wrap: balance` to avoid orphaned words; paragraphs use `text-wrap: pretty`.

## 4. Spacing, radius, shadow, motion

- **Spacing**: 4 px base (Tailwind's default `0.25rem` unit). Common steps: 4, 8, 12, 16, 24, 32, 48, 64, 96.
  Page gutter: 16 px mobile, 24 px tablet, 40 px desktop. Max content width 1280 px.
- **Radius**: `--radius-sm` 6 px (badges, inputs), `--radius-md` 10 px (buttons), `--radius-lg` 16 px (cards,
  image wells), `--radius-xl` 24 px (hero panel, sheets). Pills use full radius.
- **Shadows** (warm-tinted, subtle):
  - `--shadow-1`: `0 1px 2px rgb(31 42 36 / 0.06)` (header on scroll, resting cards)
  - `--shadow-2`: `0 4px 16px -4px rgb(31 42 36 / 0.12)` (card hover, sticky summary)
  - `--shadow-3`: `0 16px 40px -12px rgb(31 42 36 / 0.22)` (toast, drawer, bottom sheet)
- **Motion**: durations `--dur-fast` 150 ms (press, colour), `--dur-base` 200 ms (hover lift, badge bump),
  `--dur-slow` 250 ms (drawer, toast). One easing curve: `--ease: cubic-bezier(0.2, 0.8, 0.2, 1)`.
  Under `prefers-reduced-motion: reduce`, transforms and keyframe animations are disabled; only opacity/colour
  changes remain, at near-zero duration.
- **Focus**: 2 px solid `--primary` outline with 2 px offset on every interactive element (`:focus-visible`).
- **Touch targets**: minimum 44×44 px on mobile for every button, link-button and stepper control.

## 5. Components

All in `src/components/ui/` unless noted.

| Component         | Variants / states                                                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`          | `primary`, `secondary`, `ghost`; sizes `sm` (36 px, 44 px touch on mobile), `md` (44 px), `lg` (52 px); `loading` (spinner + `aria-busy`, label kept for width), `disabled`; `fullWidth`; renders as a link with `href` |
| `Input`           | Label, hint, error message (`aria-invalid`, `aria-describedby`), leading icon (search)                                                                                                                                  |
| `Select`          | Native select, styled, custom chevron, label                                                                                                                                                                            |
| `Badge`           | `sale` (accent), `low` (warning, "Only 2 left"), `out` (danger, "Out of stock"), `neutral`                                                                                                                              |
| `ProductCard`     | Image well in category colour, name, short description, `Price`, badges; hover lift                                                                                                                                     |
| `Price`           | Current price; when on sale: accent colour + struck-through compare-at price + screen-reader text "was $X, now $Y"                                                                                                      |
| `QuantityStepper` | − / value / + ; min 1, max stock; buttons disabled at bounds; `aria-live` value; 44 px targets                                                                                                                          |
| `Skeleton`        | Pulse block (static under reduced motion); `ProductCardSkeleton`                                                                                                                                                        |
| `Toast`           | Provider + `useToast()`; success/info/error; optional action (link or button, e.g. "View cart", "Undo"); `role="status"`; auto-dismiss 5 s, pause on hover/focus                                                        |
| `EmptyState`      | Illustration, title, text, primary action                                                                                                                                                                               |
| `Breadcrumbs`     | `nav[aria-label=Breadcrumb]`, `aria-current="page"` on the last item                                                                                                                                                    |
| `Pagination`      | Previous / page numbers / Next as links (URL state), `aria-current="page"`                                                                                                                                              |

Layout components (`src/components/layout/`): `SiteHeader` (sticky, shadow on scroll, wordmark, category nav,
search, cart button with animated count badge), `MobileMenu` (dialog, focus trap, Esc closes, returns focus),
`SiteFooter` (Shop / Help / About columns, demo disclaimer), `SkipLink`.

## 6. Illustration style

- 600×600 viewBox, soft rounded-square background in the category accent colour with one large, lighter
  circle behind the object and a soft ellipse shadow beneath it.
- Objects are flat shapes in 3–4 tones from a shared palette (ink `#1F2A24`, clay `#C0754A`, river green
  `#3F7464`, sand `#D8B98F`, cream `#FBF6EE`, plus the category tone), no outlines, no text, no gradients.
- Same light direction (highlight top-left, darker tone on the right side) across all 24 products.

## 7. Technical note

Phase 1 runs Next.js 16 with `cacheComponents` off, so that product and unknown routes can return a real HTTP
404 (with Cache Components the static shell is streamed with a 200 before a request-time `notFound()` runs).
