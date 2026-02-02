# Comprehensive Testing Learning Plan (vttest/Vitest)

This plan assumes the new testing flow is **vttest** and maps it to the Vitest tooling already configured in this repo. If “vttest” refers to a different runner or wrapper, replace the command names in this plan accordingly.

## Outcomes
By the end, you will be able to:
- Run the full test suite in watch, run-once, UI, and coverage modes.
- Write unit, component, and integration tests using repo utilities and mocks.
- Validate critical Firebase-only workflows and HIPAA isolation rules.
- Debug failures efficiently and keep coverage targets on track.
- Perform regression testing to ensure new changes do not break existing features.

## Quick Commands (vttest/Vitest)
- Watch mode: `npm test`
- Run once: `npm run test:run`
- Coverage: `npm run test:coverage`
- UI runner: `npm run test:ui`
- Target a specific file/pattern: `vitest --run <pattern>`

## Learning Path (4 Phases)

### Phase 1: Orientation and Environment (Day 1)
**Goals**
- Understand test structure, utilities, and the Firebase-only testing context.
- Confirm local test runner works.

**Read**
- `TESTING_QUICK_START.md`
- `TESTING_GUIDE.md`
- `TESTING_BEST_PRACTICES.md`

**Do**
- Run `npm test` and confirm watch mode starts.
- Run `npm run test:run` to ensure the suite passes once.
- Skim test folder structure at `src/tests/`.
- Identify the top 5 user flows that must never regress.

**Milestone**
- You can describe where to place each test type and how to run tests.

---

### Phase 2: Unit Testing Fundamentals (Days 2–3)
**Goals**
- Write unit tests for services and utilities.
- Use mocks and shared helpers correctly.

**Read**
- `TESTING_QUICK_START.md` (unit test template section)
- `TESTING_IMPLEMENTATION_COMPLETE.md` (overview of existing coverage)

**Do**
- Add one unit test for a service module in `src/services/`.
- Use `vi` mocks and `beforeEach` initialization.
- Use `global.testUtils.createMock*()` helpers if available.

**Milestone**
- At least 1–2 new unit tests pass in watch mode.

---

### Phase 3: Component Testing (Days 4–6)
**Goals**
- Test Svelte components with Testing Library.
- Validate UI behaviors and props.

**Read**
- `TESTING_QUICK_START.md` (component test template)
- `COMPONENT_GUIDE.md`

**Do**
- Create a test for a UI component in `src/components/` using `@testing-library/svelte`.
- Assert rendered content and props.
- Add one interaction test with `@testing-library/user-event`.

**Milestone**
- A component test passes and is stable across reruns.

---

### Phase 4: Integration + Firebase Workflow Coverage (Week 2)
**Goals**
- Validate critical workflows (auth, patient isolation, prescriptions).
- Ensure Firebase mocks/stubs are used consistently.

**Read**
- `TESTING_GUIDE.md` (Firebase-only flow checks)
- `TEST_IMPLEMENTATION_SUMMARY.md`

**Do**
- Add an integration test that covers a key workflow (e.g., new prescription creation).
- Add a HIPAA isolation test (doctor-patient isolation).
- Confirm no Firebase index errors surface in logs for tested flows.
- Create a small regression suite that runs on every change.

**Milestone**
- Integration tests execute with stable deterministic results.

---

## Regression Testing Focus (Always-On)
Regression testing is the primary guardrail to make sure new changes do not break existing features. Use a stable, repeatable “golden path” suite and run it for every change set.

### Regression Suite: Golden Paths
Run these every time you touch UI, services, or data flow:
1. **Auth (Local)**: Login (email/password) + logout.
2. **Auth (Google)**: Login (Google) + logout.
3. **Profile**: Edit profile modal opens, fields prefill, save persists, UI updates.
4. **Patients**: Create patient, list updates, persistence on refresh.
5. **Prescriptions**: New Prescription -> Add Drug -> refresh -> still visible.
6. **Isolation**: Doctor A cannot see Doctor B’s data (patients + prescriptions).
7. **Pharmacist**: Connect pharmacist to doctor, verify linkage.

### Regression Matrix (Map Changes to Tests)
Before you ship, map the change to at least one regression check:
- **Auth change**: Auth + Profile + Isolation.
- **Component change**: Component test + relevant Golden Path.
- **Data model change**: Integration test + persistence check on refresh.
- **Prescription flow change**: New Prescription -> Add Drug -> refresh.
- **UI/UX change**: Snapshot or interaction test + Golden Path.

### Regression Checklist (Per Change)
- [ ] Run the Golden Paths relevant to the change.
- [ ] Run full `npm run test:run` before merge.
- [ ] Add at least one regression test if a bug was fixed.
- [ ] Confirm no unexpected console errors in tested flows.
- [ ] Verify tests are deterministic (no real network calls).

## Practical Exercises (Pick 3)
1. **Service Unit Test**: Validate a helper or service method handles empty input gracefully.
2. **Component Test**: Render a form component and verify it pre-fills values.
3. **Integration Test**: Simulate “New Prescription” -> “Add Drug” happy path.
4. **Regression Test**: Cover a recently fixed bug from `RECENT_FIXES_SUMMARY.md`.
5. **Security Test**: Ensure doctor A cannot access doctor B’s patient list.
6. **Smoke Regression**: Run the Golden Paths and log results in PR notes.

## Debugging and Triage Checklist
- Re-run failed tests in isolation using `vitest --run <pattern>`.
- Use `debug()` output from Testing Library to inspect DOM.
- Verify mocks are reset in `beforeEach`.
- Ensure Firebase mocks are in place for database calls.
- Confirm test data is deterministic (no real network calls).
- If a regression is detected, add a test that fails before the fix and passes after.

## Coverage Targets
- Unit tests: 80%+ for core services.
- Integration tests: all critical workflows.
- Component tests: all user-facing pages/components.

## Suggested Weekly Schedule
- **Week 1**: Phases 1–3 (setup + unit + component testing).
- **Week 2**: Phase 4 (integration, workflows, HIPAA checks).

## Completion Criteria
- All tests pass in `npm run test:run` and `npm run test:coverage`.
- At least one new unit, component, and integration test created.
- HIPAA isolation verified with automated test coverage.
- Documented any flaky tests and how they were stabilized.
- Regression suite is run and documented for each significant change.

## Optional Enhancements
- Add a CI step for `npm run test:run` and coverage enforcement.
- Add smoke tests for the most critical UI flows.
- Create a lightweight “test data builder” module for reusable fixtures.
