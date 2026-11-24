---
name: Pro Futbol Antigua
description: Home Ground, Open Gate — club-heritage navy & gold, split across a confident public face and a crisp operate layer
colors:
  navy: "#00205B"
  brand-navy: "#0a3d7d"
  gold: "#d8b32d"
  gold-hover: "#d0a92a"
  gold-deep: "#8f6c1c"
  red: "#E4032C"
  action-red: "#dc2626"
  action-red-hover: "#b91c1c"
typography:
  display:
    fontFamily: "var(--font-geist-sans)"
    fontWeight: 700
  body:
    fontFamily: "var(--font-geist-sans)"
    fontWeight: 400
  label:
    fontFamily: "var(--font-geist-sans)"
    fontWeight: 700
    letterSpacing: "0.1em"
  mono:
    fontFamily: "var(--font-geist-mono)"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"
spacing:
  sm: "16px"
  md: "24px"
  lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.brand-navy}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.gold-hover}"
  button-admin-primary:
    backgroundColor: "{colors.navy}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-admin-secondary:
    backgroundColor: "#ffffff"
    textColor: "#4b5563"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  button-destructive:
    backgroundColor: "{colors.action-red}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  status-badge:
    rounded: "{rounded.pill}"
    padding: "4px 8px"
    typography: "{typography.label}"
  input-admin:
    backgroundColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card-admin:
    backgroundColor: "#ffffff"
    rounded: "{rounded.lg}"
---

# Design System: Pro Futbol Antigua

## Overview

**Creative North Star: "Home Ground, Open Gate"**

Pro Futbol Antigua runs on home-turf confidence: navy structure, gold accents, the visual language of an established club that has been here a while and is proud of it. But the gate stays open — gold isn't just a CTA color, it's a welcome, and the softer shadows and generous rounded corners on the public pages exist so a family booking its first court feels invited in, not processed.

That confidence-plus-invitation idea only governs the **public, Persuade-mode surfaces** (home, landing, academia, reservar's booking flow, the shared `SiteHeader`). The admin panel and the superadmin diagnostics panel are **Operate-mode** work surfaces — staff running caja, academia, torneos, reportes all day — and ambition there shows as precision and restraint, not narrative. This file documents three zones, not one undifferentiated palette, because that is what is actually shipped:

1. **Public / Persuade** — "Home Ground, Open Gate." Navy + gold, soft bespoke shadows, pill CTAs.
2. **Admin / Operate** — "Crisp and procedural." White cards, flat borders, one repeated shell for every screen so staff never relearn a page.
3. **Superadmin / diagnostic** — a deliberately separate dark zone (slate/amber), explicitly built to never be mistaken for the business panel. Out of this file's detailed scope; see the Components note.

**Key Characteristics:**
- Two navies in active use, each scoped to its zone, never interchanged (see "The Zone Rule" below).
- Two reds in active use, same zone-scoping logic.
- Elevation is a deliberate split: flat in Operate, soft-shadowed in Persuade — not an inconsistency to unify.
- Icons are a deliberate split: Phosphor Icons in Admin/Superadmin, hand-written inline SVG in Public — not an inconsistency to unify.
- Geist (Sans + Mono) is the only type family anywhere in the app.

## Colors

Two families — gold (warmth, action, celebration) and navy (structure, trust) — plus a zone-scoped red for destructive/alert states. The palette is intentionally not unified across zones; see "The Zone Rule."

### Primary
- **Open Gate Gold** (`#d8b32d`): primary CTA fill across every public page — "Reservar Ahora," landing/academia CTAs. Always paired with `brand-navy` text for contrast, never white text.
- **Gold Hover** (`#d0a92a`): hover state for gold-filled buttons only.
- **Gold Deep** (`#8f6c1c`): nav-link hover text and underline color on the white `SiteHeader` chrome — a muted, readable-on-white variant of the same gold family (the underline itself renders at `#bf9b1f`, one step lighter than the text-hover shade).

### Secondary
- **Operate Navy** (`#00205B`): the actual Tailwind `navy` token. Used by the admin panel (sidebar, active nav, primary buttons, headings) and by public *utility* pages that aren't trying to sell anything — torneos list/detail, login, pago/resultado, the staff-facing `(dashboard)/reservas` summary.
- **Home Ground Navy** (`#0a3d7d`): the brighter blue that is the actual front door of the brand — `SiteHeader`, the home/landing hero, academia's hero gradient. This is the color a first-time visitor sees first; it is not a secondary or legacy shade even though it's not the literal `navy` config token.

### Neutral
- **Admin Shell** (`#eef2f8`): the outer background behind every admin page, distinct from and slightly cooler than stock Tailwind gray-50/100.
- **Card/Border Grays**: `gray-50`/`gray-100`/`gray-200` for admin borders, table rules, and secondary-button chrome — no custom gray tokens, stock Tailwind throughout.
- **Public dark base**: `bg-navy` (the Operate navy) also doubles as the dark page background on torneos list/detail, with translucent white (`white/5`, `white/10`) cards layered on top — a different neutral-surface strategy from admin's opaque white cards.

### Named Rules
**The Zone Rule.** `navy` and `brand-navy` are not interchangeable, and neither are `red` and `action-red`. Operate surfaces (admin, superadmin-adjacent utility pages) never use `brand-navy`; Persuade surfaces (home, landing, academia, SiteHeader) never use the stock `navy` token. Adding a UI element to a zone means reaching for that zone's color, not "whichever navy looks closest."

## Typography

**Display/Body Font:** Geist Sans (`var(--font-geist-sans)`, via the `geist` npm package — not `next/font/google`)
**Mono Font:** Geist Mono (`var(--font-geist-mono)`)

**Character:** One typeface family for everything, everywhere. Zones are differentiated by weight and color, never by a second font.

### Hierarchy
- **Display** (`font-black`, `text-3xl`, admin only): admin page H1s are deliberately heavier than public headings — e.g. `admin/page.tsx`'s dashboard title. This is the one place Admin out-weighs Public.
- **Headline** (`font-bold`, `text-3xl`, public): home/landing/academia section H2s — bold, not black.
- **Label** (`font-bold`, `text-xs`, `tracking-widest`, `uppercase`, `text-gray-400`): admin eyebrow labels above a page title or KPI tile.
- **Body** (`font-normal`, `text-sm`/`text-base`): everywhere else.
- **Table/caption** (`text-xs`/`text-sm`, `text-gray-500`): table headers and status-badge text.

## Layout

- **Public marketing container**: `max-w-[1180px] mx-auto px-6` — a hand-picked width, not a Tailwind `max-w-*` step, shared identically by `SiteHeader`, `SiteFooter`, and every landing/academia section.
- **Public utility container**: `max-w-4xl mx-auto` — torneos list/detail, simpler pages that don't need the wide marketing canvas.
- **Admin container**: `max-w-5xl mx-auto`.
- **Superadmin container**: `max-w-6xl mx-auto` — wider, for density of system-health data.
- **Modals**: `max-w-sm` for confirm dialogs/small forms, `max-w-md` for richer forms, always `w-full mx-4` for mobile.
- **Padding scale**: `p-4` for compact cards/table wrappers, `p-6` for standard forms/panels, `p-8` for standalone full-page cards (login, pago/resultado).
- **Grid gaps**: `gap-4`/`gap-5` in admin dashboards, `gap-7`–`gap-12` in public marketing sections — Public is deliberately more generous with whitespace.

## Elevation & Depth

Two systems by design, not drift:

- **Operate (flat)**: admin and superadmin use only Tailwind's shadow scale (`shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`) and only Tailwind's radius scale. No arbitrary bracket values anywhere in `app/admin/**`. Depth is mostly conveyed by `border` + flat white-on-`#eef2f8`, not by shadow.
- **Persuade (soft)**: public marketing pages (`landing-page.tsx`, `academia/page.tsx`, `reservar/page.tsx`, `WeekDatePicker.tsx`) use bespoke, hand-tuned shadows — `shadow-[0_18px_40px_rgba(6,32,70,.12)]`, `shadow-[0_10px_30px_rgba(15,60,130,.08)]` — and bespoke radii (`rounded-[22px]`, `rounded-[14px]`) rather than the Tailwind steps.

### Named Rules
**The Flat-Operate Rule.** Nothing in `app/admin/**` or `app/superadmin/**` gets a custom shadow or a bracket-value radius. If it needs to pop, reach for `shadow-lg`/`shadow-xl`, not a bespoke value — Operate's restraint is the brand signal there, not decoration.

## Shapes

- **Pill** (`rounded-full`, `9999px`): status badges and every gold CTA button.
- **md/lg** (`rounded-md` 8px / `rounded-lg` 12px): the default for admin cards, buttons, and inputs.
- **xl** (`rounded-xl`, 16px): modals.
- **Public bespoke**: `rounded-[22px]`/`rounded-[14px]`/`rounded-[28px]` on marketing cards — intentionally outside the scale, part of Persuade's softer, hand-crafted feel.

A known shape drift, not yet reconciled: `EstadoTorneoBadge` uses the pill radius (`rounded-full`), but the admin torneo-detail page's "Cuota pagada/Pendiente" pill uses plain `rounded` (4px) for the same status-pill concept. See Do's and Don'ts.

## Components

### Buttons
- **Primary (public)**: gold pill — `bg-gold text-brand-navy px-6 py-3 rounded-full font-semibold hover:bg-gold-hover hover:-translate-y-0.5 shadow-lg`. The one button in the whole system with a lift-on-hover micro-interaction.
- **Primary (admin)**: `bg-navy text-white rounded-md` — solid, no lift, no shadow beyond the card it sits in.
- **Secondary (admin)**: white with gray border — `bg-white border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50`. The single most-repeated button pattern in the admin codebase; every modal's "Cancelar" and most filter-bar buttons use this exact class string.
- **Destructive (admin)**: `bg-action-red text-white rounded hover:bg-action-red-hover active:scale-[0.98]` — the academia "Desactivar" button is the canonical example. One admin component (`ConfirmarModal`) still uses the `red` brand token instead of `action-red`; treat `action-red` as the standard for new destructive buttons.

### Status Badges
`EstadoTorneoBadge` is the canonical pattern: `rounded-full px-2 py-1 text-xs font-medium`, one background/text pair per state (gray/yellow/blue/green/red-100-and-700). New status pills should follow this component's shape and color-per-state convention, not the plain-`rounded` variant found on the torneo-detail payment pill.

### Inputs (admin)
`rounded-md border border-gray-300 px-3 py-2 text-sm` — extremely consistent across every admin form. **Gap**: almost none of these define an explicit focus state beyond the browser default; only the login page adds `focus:ring-2 focus:ring-navy`. New admin inputs should adopt the login page's focus-ring treatment rather than relying on the browser default.

### Cards
- **Admin**: `bg-white border border-gray-200 rounded-lg shadow-sm p-4|p-6` — the one card shell used everywhere in the admin panel (torneos, clientes, pagos, caja, academia).
- **Admin dashboard tiles**: a looser variant — `rounded-2xl`/`rounded-xl` with a tinted background (stock Tailwind `blue-50`/`amber-50`/`emerald-50`/`violet-50`/`cyan-50`/`orange-50`/`rose-50`/`lime-50`/`indigo-50` per category) and `hover:shadow-md`. These tints are a categorical navigation aid, not brand colors — don't read them as part of the Colors palette above.
- **Public (torneos list/detail)**: `bg-white/5 border border-white/10 rounded-lg hover:bg-white/10` — a translucent glass card over the dark `navy` background, a different surface strategy from admin's opaque white.
- **Public (marketing)**: bespoke rounded corners + soft shadows (see Elevation & Depth).

### Navigation
Three distinct chrome systems, one per zone — this is intentional, not an inconsistency:
- **`SiteHeader`** (public): white, `backdrop-blur-sm`, sticky, `brand-navy` text with `gold-deep` hover, gold-pill CTA.
- **`AdminLayout`**: white sidebar, `navy` text, `navy`-filled active state, Phosphor icons (`weight="fill"` when active).
- **`SuperadminLayout`**: dark `slate-950`/`slate-900` chrome with `amber-400` accents — explicitly coded as a separate theme ("slate/amber instead of navy/yellow, so it's never confused with the business panel"). Documented here as existing and deliberate; its own component system is out of this file's detailed scope.

### Signature exception: reservar's chat widget
`reservar/page.tsx`'s booking-chat UI uses its own bespoke blue family (`#f7fbff`→`#edf7ff` backgrounds, `#0d76e8` accent, `#173f70`/`#032c65`/`#193f79`/`#07345d`/`#06366d` text/chrome) found nowhere else in the app. This is a local, single-component exception, not a fourth global navy — left as-is rather than forced into `navy`/`brand-navy`, but flagged here so it isn't mistaken for a new global token if touched again.

## Do's and Don'ts

### Do:
- **Do** use `navy`/`action-red` on Operate surfaces (admin, superadmin-adjacent public utility pages) and `brand-navy`/`red` on Persuade surfaces (home, landing, academia, SiteHeader) — per the Zone Rule.
- **Do** use Phosphor Icons (`@phosphor-icons/react`) in admin/superadmin and hand-written inline SVG in public pages — this split is deliberate.
- **Do** use `rounded-full` for any new status/pill badge, matching `EstadoTorneoBadge`.
- **Do** give new admin inputs a `focus:ring-2 focus:ring-navy` treatment, matching the login page rather than the browser default most admin forms currently fall back to.

### Don't:
- **Don't** invent a fourth navy or a third red. If an existing token doesn't fit, that's a signal to ask, not to pick a new arbitrary hex.
- **Don't** add a custom shadow or bracket-value radius inside `app/admin/**` or `app/superadmin/**` — the Flat-Operate Rule holds there.
- **Don't** apply `navy`/`brand-navy`/`gold` tokens to the superadmin panel — its dark slate/amber theme is intentionally its own system.
- **Don't** promote reservar's chat-widget blues to a global token without an explicit decision to do so.
