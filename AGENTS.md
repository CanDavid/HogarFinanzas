# AGENTS.md — Hogar Finanzas

## Mission

Build an iPhone household-finance app for two people sharing the same household data through iCloud. The app must remain simple for users, financially correct, offline-first, and incrementally testable.

## Authoritative documents

Before changing code, read:

1. `docs/PRODUCT_SPEC.md`
2. `docs/TECHNICAL_SPEC.md`
3. `docs/IMPLEMENTATION_PLAN.md`

If code and docs disagree, stop expanding scope and reconcile the discrepancy by updating the relevant decision in `docs/IMPLEMENTATION_PLAN.md`.

## Working mode

- Work on exactly one implementation phase at a time.
- Do not pre-build features from future phases unless strictly required by the current phase.
- At the end of each phase: build, run relevant tests, review the diff, update the plan, and provide manual test steps.
- Never leave the repository in a knowingly non-compiling state at a phase checkpoint.
- Prefer a small working vertical slice over a large incomplete architecture.

## Product rules that must never be violated

- A transfer between owned accounts is not income or expense.
- Savings/investment destinations are not expenses merely because cash moved there.
- Goal allocations are virtual earmarks and do not change net worth by themselves.
- Closed months are read-only until explicitly reopened.
- Accounts/categories with history are archived, not destructively deleted.
- The shared household must work for two different Apple IDs.

## Money rules

- Never persist money as `Double` or `Float`.
- Persist money as `Int64` cents.
- Use `Decimal` only at UI/input boundaries when parsing/rounding.
- All calculation behavior must be covered by deterministic unit tests.

## Architecture constraints

- SwiftUI UI.
- Domain logic must not depend on SwiftUI, Core Data, or CloudKit.
- Core Data + `NSPersistentCloudKitContainer` + CloudKit Sharing for the shared MVP.
- Encapsulate persistence behind repositories/services.
- Use Apple frameworks only in MVP unless a new dependency is explicitly justified.
- Prefer dependency injection through `AppEnvironment`; avoid new global singletons.
- Use async/await where appropriate and keep UI work on `@MainActor`.

## CloudKit rules

- Treat sharing as an early technical risk; Phase 1 must prove bidirectional sync on two Apple IDs before expanding the model.
- The `Household` is the shared root concept.
- A transfer must be one persisted object with source and destination, not two separately synchronized records.
- Recurrence generation must be idempotent.
- Normal sync latency must not block the UI.
- Local data must remain usable offline.
- Do not log private financial descriptions or amounts in production logs.

## Testing requirements

Use Swift Testing for unit/integration logic and XCTest/XCUITest for UI automation.

Before marking a phase complete:

1. Run the target build.
2. Run all tests created/affected by the phase.
3. Run the broader suite when practical.
4. Fix new warnings or document why they are unavoidable.
5. Check that business logic exists in domain engines, not duplicated in views.
6. Update phase status and decisions in `docs/IMPLEMENTATION_PLAN.md`.

## Code quality

- Prefer clear code over clever abstractions.
- Add protocols when they improve testability/substitution, not automatically.
- Keep views focused; move calculations out of views.
- Keep business rules in domain engines.
- Use semantic names.
- Comments explain non-obvious reasoning, not obvious syntax.
- Avoid giant files; split by responsibility when clarity improves.
- Use `os.Logger`, not permanent `print` statements.

## UI expectations

- Spanish UI strings for MVP.
- Code identifiers in English.
- Native iOS appearance; no third-party design framework.
- Support Dynamic Type and dark mode.
- Never rely on color alone to convey budget/financial status.
- Registration of a normal expense should be fast and require minimal taps.

## Scope protection

Do not implement these during MVP phases unless the plan is explicitly amended:

- bank/Open Banking integration;
- broker/market price APIs;
- OCR;
- generative AI;
- widgets;
- Apple Watch;
- multi-currency;
- multi-household;
- subscription/paywall;
- expense splitting/debt settlement.

## Phase checkpoint response

When finishing a phase, report:

- What is implemented.
- Files/areas materially changed.
- Tests run and their result.
- Manual steps the user should test on simulator/device.
- Known limitations or follow-ups for the next phase.
- Whether `docs/IMPLEMENTATION_PLAN.md` was updated.

Do not silently continue to the next phase after a checkpoint unless explicitly asked.
