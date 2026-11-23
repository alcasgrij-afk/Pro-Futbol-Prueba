---
description: Reconcile PENDIENTES.md against commits since the last reconciliation, then commit (no push)
---

Reconcile this repo's `PENDIENTES.md` against what's actually shipped. Read-only investigation
first, then one scoped edit, then one commit — nothing else. This is the on-demand version of
the `SessionStart` hook that normally does this automatically — use it when the hook didn't fire
(e.g. the session started outside the repo tree) or whenever you want it updated mid-session.

1. Find the last reconciliation point: `git log -1 --format=%H -- PENDIENTES.md`. This file is
   only ever touched for reconciliation, so the last commit that touched it is the baseline. If
   it has never been committed, treat the repo's first commit as the baseline.

2. `git log --oneline <baseline>..HEAD` — list every commit since then. Read each commit's full
   message (`git log -1 --format="%ci%n%B" <sha>`) to understand what it actually did, not just
   its title.

3. Read `PENDIENTES.md` in full — the resolved-items table at the bottom, the narrative sections
   above it, and any inline `⚠️`/"pendiente" flags (e.g. the DB-outage-monitoring gap, the
   Postgres free-tier renewal date, the "ponytail" debt items).

4. For each commit in that range, decide:
   - Does it deserve a new row in the resolved-items table? Follow the existing row style
     exactly: `| Título corto | Qué cambió, en una frase | ✅ resuelto (YYYY-MM-DD, commit
     \`sha\`): detalle/tests si aplica |`.
   - Does it fully or partially resolve an open item flagged elsewhere in the file (the ⚠️ rows,
     the ponytail debt list, an open incident)? If fully resolved, update that row/section to
     say so. If only partially resolved, say so precisely — don't silently mark the whole thing
     done.
   - Never invent completion. If you're not sure whether something is actually done, say so in
     your final reply instead of guessing in the file.

5. Show the diff for review, then commit it yourself:
   - Commit message style: `docs: reconciliar PENDIENTES.md tras <resumen corto>` (Spanish,
     matching this repo's commit convention) — see commit `2f0d878` for an example.
   - Do **not** add a `Co-Authored-By` trailer — this user's standing instruction is no commit
     attribution, full stop.
   - Do **not** `git push` after committing. The repo's usual standing policy is to push
     automatically once a commit exists — this command is the one exception: the user pushes
     this one on demand themselves.

6. Scope boundary: only ever edit `PENDIENTES.md` in this command. If `CLAUDE.md`, `README.md`,
   or anything else looks stale while you're doing this, name it in your final reply instead of
   editing it — that's a separate, explicit decision for the user to make, not something this
   command does on its own.

Finish with a short summary: what rows were added/updated, the commit hash, and a reminder that
it still needs to be pushed.
