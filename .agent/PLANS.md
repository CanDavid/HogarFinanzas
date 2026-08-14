# Execution plan rules for Hogar Finanzas

For any change that spans multiple features, persistence migrations, CloudKit sharing behavior, or a complete implementation phase, use `docs/IMPLEMENTATION_PLAN.md` as the living execution plan.

An execution phase must be self-contained enough that another developer can resume from the repository and the plan alone.

For the active phase, keep the following information current:

- goal and user-visible outcome;
- concrete files/components to change;
- data-model changes;
- implementation steps;
- automated tests;
- manual tests;
- discoveries/risks;
- decisions made;
- completion state.

When an assumption is disproved by real implementation behavior—especially Core Data/CloudKit behavior—record the discovery and adjust the plan before continuing.

Never claim a phase is complete because code exists. Completion requires demonstrable behavior plus tests/build validation.
