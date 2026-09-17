# UI Review — Pro Futbol Antigua

> **Audit:** 2026-09-13 · Tool: `ui-reviewer` (read-only static source audit; WCAG 2.2 AA + Nielsen Norman heuristics)
> **Scope:** all `apps/web/app/**` pages + `apps/web/components` (19 `.tsx` files + `globals.css`, `tailwind.config.js`)
> **Count:** 3 Critical · 10 Major · 13 Minor

Surface audited: public pages (`/`, `/login`, `/reservar`, `/torneos`, `/torneos/[id]`, `/pago/resultado`), the admin shell and all five `/admin/*` pages, the dashboard, `AdminLayout`, and `ChatWidget`. Theme: navy `#00205B`, red `#E4032C`, yellow-400 + Tailwind palette. Contrast ratios below are computed statically from declared hex/opacity pairs.

---

## CRITICAL

### C1. Admin section renders dark-theme white text on a light-grey surface (effectively invisible)
- **Severity:** Critical
- **Category:** 3 (Accessibility/contrast), 4 (Consistency), 7 (NN H1, H4)
- **Location:** root cause `apps/web/app/globals.css` (lines 5-7, `body { @apply bg-gray-50 ... }`) + `apps/web/components/AdminLayout.tsx` (line 42 `<div className="min-h-screen">`, line 67 `<main className="p-6 max-w-5xl mx-auto">`); symptom pages: `admin/torneos/page.tsx`, `admin/torneos/[id]/page.tsx`, `admin/academia/page.tsx`, `admin/academia/mensualidades/page.tsx`, `admin/academia/asistencia/page.tsx`
- **Standard:** WCAG 2.2 SC 1.4.3 (contrast), SC 1.4.11
- **Current code** (`admin/torneos/page.tsx` lines 62, 133-134):
```tsx
<form onSubmit={crear} className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4 max-w-xl mb-8">
...
<p className="text-sm text-white/70 mt-1">{t.descripcion}</p>
<p className="text-xs text-white/60">…</p>
```
  The `bg-white/5` panels sit directly on `body bg-gray-50`; `text-white/70`, `text-white/60`, `text-yellow-300` badges, `text-red-400` errors, `text-green-300/200`, `text-amber-200` are white-family text on a near-white surface → computed contrast ≈ 1.3:1 to 2.7:1.
- **Refactored alternative:** give the admin route-group its own dark surface instead of sharing the light dashboard shell:
```tsx
// AdminLayout.tsx
export default function AdminLayout({ children, oscuro }: { children: React.ReactNode; oscuro?: boolean }) {
  ...
  <main className={`p-6 max-w-5xl mx-auto ${oscuro ? 'bg-navy text-white min-h-screen' : ''}`}>{children}</main>
}

// admin/layout.tsx
return <AdminLayout oscuro>{children}</AdminLayout>;
```
  Then the `bg-white/5` panels and light text work as designed. Give form inputs an explicit background (transparent-navy-on-navy otherwise): `className="rounded bg-white px-3 py-2 text-sm text-navy"`.
- **Rationale:** the entire `/admin/*` sub-app was designed dark but renders on the light `gray-50` shell the dashboard uses, so body text, status badges and errors are illegible ~1.3–2.7:1.

### C2. "Pagar ahora" buttons: white text on green backgrounds — 2.3–3.3:1
- **Severity:** Critical
- **Category:** 3 (contrast), 2 (money-path CTA)
- **Location:** `apps/web/app/reservar/page.tsx` line 142 (`bg-green-500 … text-white`, ≈ 2.3:1); `apps/web/components/ChatWidget.tsx` line 138 (`bg-green-600 … text-white`, ≈ 3.3:1)
- **Standard:** WCAG 2.2 SC 1.4.3
- **Current code:**
```tsx
<button onClick={() => pagar(m)}
  className="mt-3 w-full rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-400 transition-colors">
```
- **Refactored alternative:**
```tsx
<button onClick={() => pagar(m)}
  className="mt-3 w-full rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition-colors">
```
  (`green-700 #15803d` ≈ 5.0:1 with white; or keep `green-500` with `text-navy` ≈ 6.8:1.)
- **Rationale:** the highest-stakes action on the conversion path (charging money) has text below the 4.5:1 AA threshold in both chat surfaces.

### C3. User chat bubbles: white text on `bg-blue-500` ≈ 3.7:1
- **Severity:** Critical
- **Category:** 3 (contrast / core reading content)
- **Location:** `apps/web/app/reservar/page.tsx` line 118
- **Standard:** WCAG 2.2 SC 1.4.3
- **Current code:**
```tsx
esUsuario
  ? 'ml-auto bg-blue-500 text-white'
  : 'bg-white/10 border border-white/10 text-white'
```
- **Refactored alternative:**
```tsx
esUsuario
  ? 'ml-auto bg-blue-700 text-white'
  : 'bg-white/10 border border-white/10 text-white'
```
  The floating `ChatWidget` already uses `bg-blue-600` (≈ 5.2:1) for the same bubble — `blue-700` also fixes the cross-surface inconsistency.
- **Rationale:** the primary reading content of the booking flow fails 4.5:1 for small text, and the two chat surfaces use different blues.

---

## MAJOR

### M1. Confirmation modal: no dialog semantics, no Escape, no focus trap, no backdrop dismissal
- **Severity:** Major · **Category:** 2, 3 · **Standard:** SC 1.3.1, 2.1.2, 2.4.3, 3.2.1; NN H3
- **Location:** `apps/web/app/(dashboard)/reservas/page.tsx` lines 60-87, 315-331
- **Current code:**
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
  <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-3">
    <h2 className="text-base font-bold text-navy">{titulo}</h2>
```
  No `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape handler, initial focus, backdrop-click cancel; Tab walks behind the overlay.
- **Refactored alternative:** focus element on open; `role="dialog" aria-modal="true" aria-labelledby="dialog-title"`; `keydown` listener for Escape → `onCancelar`; `tabIndex={-1}` on the panel to hold focus; trap Tab; restore focus to trigger on close.
- **Rationale:** a blocking modal is unreachable and unclosable for keyboard-only users; Escape is the platform-standard dismissal.

### M2. Form controls labeled only by `placeholder`
- **Severity:** Major · **Category:** 3 (labels), 7 (NN H6) · **Standard:** SC 1.3.1, 3.3.2, 4.1.2
- **Location:** `torneos/[id]/page.tsx` lines 101-103; `admin/torneos/page.tsx` lines 65-117; `admin/academia/page.tsx` lines 80-86; `admin/perfil/page.tsx` lines 48-74 (labels present but no `htmlFor`/input `id`)
- **Current code:**
```tsx
<input value={nombre} placeholder="Nombre del equipo" required className="w-full rounded px-3 py-2 text-sm text-navy" />
```
- **Refactored alternative:**
```tsx
<label className="block text-sm text-white/80 mb-1" htmlFor="eq-nombre">Nombre del equipo *</label>
<input id="eq-nombre" aria-required="true" className="w-full rounded bg-white px-3 py-2 text-sm text-navy" />
```
- **Rationale:** placeholders disappear on input and are unreliable names for assistive tech and autofill.

### M3. `text-gray-400` on white ≈ 2.5:1 for small metadata text
- **Severity:** Major · **Category:** 3 · **Standard:** SC 1.4.3
- **Location:** `admin/reportes/page.tsx` lines 98, 109, 137, 166, 178, 182; `(dashboard)/reservas/page.tsx` line 277
- **Refactored alternative:** `text-gray-400` → `text-gray-600` (≈ 7.6:1 on white)
- **Rationale:** 11-12px auxiliary text at 2.5:1 is below the 4.5:1 threshold throughout reports/reservations tables.

### M4. No reflow at 200% zoom / small phones — data tables
- **Severity:** Major · **Category:** 1 · **Standard:** SC 1.4.4, 1.4.10
- **Location:** `admin/academia/page.tsx` lines 103-131; `admin/academia/asistencia/page.tsx` lines 65-103; `admin/academia/mensualidades/page.tsx` lines 55-82; `admin/torneos/[id]/page.tsx` lines 175-200, 281-300 (10-column standings)
- **Current code:** most tables have **no** overflow container (only the LIGA standings wraps in `overflow-x-auto`).
- **Refactored alternative:** wrap every `<table>` in `<div className="overflow-x-auto">`; `whitespace-nowrap` where cells would wrap mid-token; verify no clip at 320px and 200% zoom.
- **Rationale:** unconstrained full-width tables cause clipping or two-dimensional scroll, violating 1.4.10.

### M5. Admin header overflows horizontally on small screens (no wrap)
- **Severity:** Major · **Category:** 1, 3 · **Standard:** SC 1.4.10; NN H4
- **Location:** `apps/web/components/AdminLayout.tsx` lines 43-57, 58-65
- **Current code:** brand + 4 nav links + "Mi perfil" + "Cerrar sesión" in a non-wrapping `flex … justify-between`
- **Refactored alternative:**
```tsx
<header className="bg-navy text-white px-6 py-3 flex flex-wrap items-center justify-between gap-4">
  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
```
- **Rationale:** the chrome on every admin page forces side-scrolling on phones.

### M6. ChatWidget panel fixed `w-[370px]` clips on small viewports
- **Severity:** Major · **Category:** 1 · **Standard:** SC 1.4.10
- **Location:** `apps/web/components/ChatWidget.tsx` line 167
- **Current code:** `fixed bottom-6 right-6 z-[9999] flex h-[500px] w-[370px] flex-col …`
- **Refactored alternative:** `… h-[500px] max-h-[calc(100dvh-3rem)] w-[min(370px,calc(100vw-3rem))] …`
- **Rationale:** at ≤375px wide the 370px panel overflows the viewport; viewport-bound width + dvh-bound height handle landscape/keyboard.

### M7. Focus indicator removed without a visible replacement on the main chat input
- **Severity:** Major · **Category:** 3 · **Standard:** SC 2.4.7 (and 1.4.11)
- **Location:** `apps/web/app/reservar/page.tsx` line 241
- **Current code:** `… outline-none focus:border-white/30` (only a 1.2:1 border tint change on navy)
- **Refactored alternative:** `… outline-none focus:ring-2 focus:ring-yellow-400`
- **Rationale:** the focus change is not perceptible to keyboard users.

### M8. `text-white/40` on navy ≈ 3.2:1 (footer + placeholder)
- **Severity:** Major · **Category:** 3 · **Standard:** SC 1.4.3
- **Location:** `reservar/page.tsx` line 257 (footer), line 241 (placeholder)
- **Refactored alternative:** `text-white/40` → `text-white/60` (≈ 6.3:1)
- **Rationale:** 12px footer/placeholder text fails 4.5:1 on the navy page.

### M9. Public torneo registration inputs have no background/border on the navy page
- **Severity:** Major · **Category:** 4, 1 · **Standard:** NN H4; SC 1.4.3 risk
- **Location:** `apps/web/app/torneos/[id]/page.tsx` lines 101-103
- **Current code:** `className="w-full rounded px-3 py-2 text-sm text-navy"` inside `bg-white/5` on `bg-navy` — `text-navy` with no explicit `bg-*` → invisible navy-on-navy or stark UA-white box.
- **Refactored alternative:** `className="w-full rounded bg-white border border-white/20 px-3 py-2 text-sm text-navy"`
- **Rationale:** the input disappears or looks like a raw browser widget — the only form in the app without a background class.

### M10. Toggle-style state conveyed only by background color (no `aria-pressed`)
- **Severity:** Major · **Category:** 3, 5 · **Standard:** SC 1.4.1
- **Location:** `admin/academia/asistencia/page.tsx` lines 81-96; filter chips `(dashboard)/reservas/page.tsx` lines 223-235
- **Refactored alternative:** `aria-pressed={estado[a.id] === true}` on Presente/Ausente buttons; `aria-pressed={activo}` on filter chips.
- **Rationale:** selected state is signalled solely by a subtle tint shift; screen readers and low-vision users get no state info.

---

## MINOR

### m1. Touch targets below 44×44px (SC 2.5.8)
Filter chips `reservas/page.tsx:226` (≈28px), row actions `:292-301` (≈24px), export buttons `reportes/page.tsx:84-95` (≈24px), chat chips `reservar/page.tsx:131` + `ChatWidget.tsx:127` (≈26px), ChatWidget close `:183` (18px). **Fix:** `min-h-11` (or `p-3` for icon buttons).

### m2. No skip-to-content links anywhere
`AdminLayout.tsx`, `reservar/page.tsx:154`, `torneos/page.tsx:34`. **Standard:** SC 2.4.1. **Fix:** first focusable element per layout → `<a href="#main" className="sr-only focus:not-sr-only focus:absolute …">Saltar al contenido</a>` + `id="main"` on `<main>`.

### m3. No `prefers-reduced-motion` handling
`ChatWidget.tsx:174` (`animate-pulse`), `:48` (`scrollIntoView smooth`); `reservar/page.tsx:59`, `:79` (`animate-spin`). **Standard:** SC 2.3.3. **Fix:** `behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'`; `motion-reduce:` variants.

### m4. Hardcoded magic values where tokens expected
`z-[9999]` (`ChatWidget.tsx:158,167`), `w-[370px] h-[500px]` (`:167`), `min-h-[400px]` (`reservar:211`), `max-w-[85%]` (`:116,223`), `text-[10px]` (`:177`). **Fix:** move to tailwind theme, at minimum `z-chat`/`size-chat`.

### m5. Inconsistent button hierarchy / chat styles for equivalent actions
Report exports split colors for one object type — `text-navy border-navy` (Excel) vs `text-red border-red` (PDF) at `reportes:84/92,154/163`; send button yellow on `/reservar:247` vs blue in `ChatWidget:221`; user bubbles `blue-500` vs `blue-600`; footer present on reservar/dashboard, absent on torneos. **Standard:** NN H4.

### m6. Month selector shows bare numbers instead of month names
`admin/academia/mensualidades/page.tsx:33-37`. **Fix:** `Intl.DateTimeFormat('es', { month: 'long' })` labels.

### m7. Asistencia optimistic update not rolled back on error
`admin/academia/asistencia/page.tsx:37-45` — `setEstado` applied before awaiting; on failure UI keeps wrong state. **Standard:** NN H1. **Fix:** revert in the `catch`.

### m8. Missing `autoComplete` on credential fields
`login/page.tsx:42-50` (`email`), `:57-66` (`current-password`); `admin/perfil/page.tsx:50-73`. **Fix:** add `autoComplete` attributes (enables password managers).

### m9. Empty-state flash before data loads (no loading gate)
`torneos/page.tsx:22-31/41`; `admin/torneos/page.tsx:29-35/125`. **Fix:** track a `cargando` flag like other admin pages.

### m10. No success feedback after "Crear torneo"
`admin/torneos/page.tsx:36-55` — list refreshes silently (perfil page does it right). **Standard:** NN H1. **Fix:** confirmation message.

### m11. Unlabeled date/period inputs
`reservas/page.tsx:197`, `reportes/page.tsx:64-66`, `asistencia/page.tsx:51`, `mensualidades/page.tsx:33-42`. **Fix:** `aria-label` on each control.

### m12. Error surfaced via native `alert()` in one flow
`reservas/page.tsx:180` — inconsistent with styled inline errors elsewhere. **Standard:** NN H4.

### m13. Inconsistent destructive-action pattern
`desactivar` uses native `confirm()` (`admin/academia/page.tsx:49`) vs custom cancel modal (`reservas`). **Standard:** NN H4. **Fix:** one confirmation pattern app-wide.

---

## Positive notes (verified strengths, retained)
- `role="log"` + `aria-live="polite"` on both chat message regions (`reservar:213`, `ChatWidget:191`).
- The confirm modal disables buttons while a request is in flight; destructive copy warns "Esta accion no se puede deshacer."
- Native `<details>/<summary>` for "Ver desglose diario" (`reportes/page.tsx:112`).
- Login labels use `htmlFor` with matching `id`.
- Public pages consistently use semantic `<header>/<main>(/footer)`; admin shell uses `<nav>`.

---

## Limitations
Static-source inspection only — no browser involved. Computed contrast and composite colors come from declared hex/opacity/Tailwind classes; actual rendered values depend on UA form defaults (notably the transparent-vs-white input background in C1/M9), font rendering, and opacity compositing (votes could shift ±0.3:1). Real touch-target size, whether a table actually clips at a given viewport, focus-visible rings, and CLS cannot be measured from source. Final verification of C1, C2, C3, M3, M8, M4, M5, M6, and m1 should be paired with browser-based inspection (axe/Pa11y, tab-order walkthrough, 200% zoom, 320px/375px widths) against a running instance.