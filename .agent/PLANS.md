# Execution plan rules for Hogar Finanzas

Use `docs/IMPLEMENTATION_PLAN.md` as the living plan for every complete phase or change involving persistence, synchronization, security, or financial behavior.

Keep the active phase current with:

- goal and observable outcome;
- model/protocol changes;
- implementation and automated tests;
- external setup and manual iPhone tests;
- risks, discoveries, decisions, and completion state.

Work on one phase only. Do not silently expand into the next phase.

Never claim completion because code exists. Completion requires lint, typecheck, tests, production build, diff/secret review, and all phase-specific real-device behavior. When actual Apps Script, browser, IndexedDB, or GitHub Pages behavior disproves an assumption, record the evidence and update the architecture decision before adding a workaround.
