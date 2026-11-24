# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two equally central audiences — neither is primary over the other:

- **Paying customers**: families/individuals booking courts via `/reservar`, academia parents enrolling and tracking kids (mensualidades, asistencia), and torneo team captains registering and following standings — interacting through the public site and its chat-based booking flow.
- **Facility staff/owner**: day-to-day operators running caja (point-of-sale/cash drawer), pagos, reportes, clientes/VIP program, and academia/torneos administration through the admin panel. A separate superadmin role monitors system health (DB/Redis).

## Product Purpose

Pro Futbol Antigua is the operating system for a real, already-live Guatemalan sports facility: court reservations, a youth soccer academy program, tournaments, and the facility's point-of-sale/cash operations — serving both the paying public and the staff who run the business day to day.

## Positioning

A hybrid of two things a generic booking app or a spreadsheet-plus-WhatsApp setup can't do:

1. Model this specific facility's real operating rules — academia schedule blackouts, cash-drawer reconciliation, DPI-based client records, WhatsApp receipt sharing, local Guatemalan payment gateways.
2. Replace what used to be several separate manual tools/processes with one system spanning reservations, academia, torneos, and caja end to end.

## Operating Context

- Guatemala timezone (`America/Guatemala`); court-reservation scheduling runs on local business hours.
- Academia runs recurring weekly class blocks with monthly billing (mensualidades) and blackout rules that override the court-booking calendar.
- Caja (cash-register) operations happen in person at the facility; receipts are shared with customers over WhatsApp.
- Payment-gateway integration exists alongside in-person cash/card handling (partially simulated outside production).
- Already live in production with real customers, real admin/superadmin credentials, and real Postgres data — not a prototype.

## Capabilities and Constraints

- Next.js 15 (App Router) web app + NestJS API + Postgres/Redis, deployed on Vercel (web) + Render (API), both auto-deploying from `main`.
- Render's free-tier Postgres has previously expired and caused an undetected 10-day outage; monitoring for a full DB outage is still an open gap.
- Academia `categoria` is free text, not a fixed enum.
- Tournament formats: liga (round-robin with standings table) and eliminación directa (bracket); public pages must show the same data (fixture, tabla) regardless of a tournament's lifecycle state.
- Payment amounts are always server-computed from the underlying record, never trusted from the client.

## Brand Commitments

- Name: "Pro Futbol Antigua".
- An existing navy/gold visual identity is already implemented sitewide — not to be treated as absent just because DESIGN.md hasn't been written yet.
- Real logo and facility photos exist outside this repo (confirmed by the user) but are not yet placed in the codebase — treat current placeholder/demo imagery as provisional until supplied.

## Evidence on Hand

- Real production data (reservations, academia enrollment, torneos, ventas) — not fabricated for marketing purposes.
- `seed-demo.ts` data exists for local development/testing only — not real testimonials or case studies.
- Real logo/photos exist outside the repo per the user, not yet supplied — do not fabricate placeholder branding as if final.

## Product Principles

- Model the facility's actual operating rules precisely rather than generic scheduling patterns.
- Treat paying customers and internal staff as equally core users — never let admin-efficiency tradeoffs silently degrade the public booking/torneos/academia experience, or vice versa.
- The server is the source of truth for anything money- or schedule-related; never trust client-supplied amounts or state.
- Prefer one unified system over point solutions — reservations, academia, torneos, and caja share data and conventions rather than drifting into separate silos.

## Accessibility & Inclusion

No formal contractual requirement confirmed. A voluntary WCAG 2.2 AA pass has already been completed (see PENDIENTES.md "Auditoría UI/UX") and should continue to be treated as the working bar for new UI.
