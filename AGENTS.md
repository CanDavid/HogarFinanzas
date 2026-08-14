# AGENTS.md — Hogar Finanzas

## Mission

Build a mobile-first household-finance PWA for David and Esther. It must be simple, financially correct, offline-first, incrementally testable, and permanently operable at zero mandatory cost.

## Authoritative documents

Before changing code, read:

1. `docs/PRODUCT_SPEC.md`
2. `docs/TECHNICAL_SPEC.md`
3. `docs/IMPLEMENTATION_PLAN.md`
4. `docs/ADR-001-ZERO-COST-PWA.md`

If code and docs disagree, stop expanding scope and reconcile the decision in `docs/IMPLEMENTATION_PLAN.md`.

## Working mode

- Work on exactly one implementation phase at a time.
- Do not pre-build future features unless the active phase strictly requires infrastructure for them.
- End every phase with lint, typecheck, tests, production build, diff review, plan update, and manual validation steps.
- Never leave the repository knowingly broken at a checkpoint.
- A phase requiring real Google/iPhone behavior remains pending until that behavior is observed.

## Invariants

- A transfer between owned accounts is not income or expense.
- Savings/investment destinations are not expenses merely because cash moved there.
- Goal allocations are virtual earmarks and do not change net worth by themselves.
- Closed months are read-only until explicitly reopened.
- Accounts/categories with history are archived, never destructively deleted.
- Shared data must converge for David and Esther without duplicates.
- Financial descriptions, amounts, household keys, and session tokens must never be logged.

## Money

- Persist and exchange money only as integer cents.
- In TypeScript/Apps Script, validate every amount with `Number.isSafeInteger`.
- Parse and format decimals only at UI boundaries.
- Cover calculations with deterministic unit tests.

## Architecture

- React + TypeScript + Vite PWA, hosted on GitHub Pages.
- IndexedDB is the local source used by the UI; local writes never wait for the network.
- Google Sheets is the shared remote store, accessed only through a Google Apps Script Web App.
- Keep domain rules independent of React, IndexedDB, fetch, Apps Script, and Sheets.
- Encapsulate persistence and transport behind repositories/services.
- GitHub Actions must use Linux runners only.
- Mandatory operating cost must remain €0. Add no paid service or required subscription.
- Do not add Swift, Xcode projects, Apple Developer dependencies, Core Data, CloudKit, TestFlight, or macOS runners.

## Sync and security

- Generate stable record and operation UUIDs client-side.
- Every syncable row includes `id`, timestamps, `deletedAt`, `createdBy`, `version`, and `changeSequence`.
- Synchronization is incremental and every pushed operation is idempotent.
- Serialize server mutations with `LockService`.
- Deletes are tombstones; a stale update cannot resurrect one.
- Store hashes and signing secrets in Script Properties, never in Sheets or Git.
- Only `david` and `esther` are valid identities for this single household.
- Never use JSONP, `no-cors`, financial values in URLs, or secrets in `VITE_*` variables.

## Testing

- Vitest for domain, storage, sync, and Apps Script adapter tests.
- Testing Library for UI behavior.
- `fake-indexeddb` for deterministic local persistence tests.
- Manual acceptance on both iPhones is mandatory for shared/offline checkpoints.

Before marking a phase complete:

1. Run `npm run lint`.
2. Run `npm run typecheck`.
3. Run `npm test`.
4. Run `npm run build`.
5. Fix new warnings or document unavoidable ones.
6. Review the complete diff and scan the tracked history for secrets.
7. Update `docs/IMPLEMENTATION_PLAN.md`.

## Code and UI quality

- Prefer clear code and small modules over speculative abstractions.
- Keep calculations out of views.
- Use semantic English identifiers and Spanish user-facing strings.
- Support small iPhone screens, safe areas, Dynamic Type/browser zoom, dark mode, and accessible names.
- Never rely on color alone to convey financial or sync status.
- Do not add permanent `console.log` statements containing application data.

## Scope protection

Do not implement unless the plan explicitly reaches the corresponding phase:

- banking/Open Banking, broker prices, OCR, generative AI;
- widgets, Apple Watch, native applications;
- multi-currency, multi-household, subscriptions/paywalls;
- expense splitting/debt settlement.

## Phase checkpoint response

Report what changed, tests and results, manual iPhone steps, limitations, external actions still required, and whether the implementation plan was updated. Stop after the active checkpoint until the user explicitly validates or advances it.
