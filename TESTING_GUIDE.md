# Testing Guide

This project uses Vitest for unit/component tests and Firebase emulators for integration-style runs.

## Prerequisites
- Node.js + npm
- Firebase CLI (`firebase --version`)
- Java (required by Firestore emulator)

Install deps:
```bash
npm install
```

## Test Commands
```bash
# Fast local loop (no emulators)
npm test

# Run once (no emulators)
npm run test

# Run with emulators (Firestore + Auth)
npm run test:run

# Run Firestore security rule integration tests only
npm run test:security:rules

# Coverage
npm run test:coverage

# UI runner
npm run test:ui
```

## What Each Command Does
- `npm test`: Vitest watch mode. Good for local development.
- `npm run test:run`: Uses `firebase emulators:exec` to run tests against Firestore/Auth emulators.
- `npm run test:security:rules`: Runs Firestore rules integration tests against emulator.
- `npm run test:coverage`: Generates coverage via Vitest.

## Test Layout
```
src/tests/
├── setup.js
├── mocks/
├── unit/
├── integration/
└── components/
```

## Manual QA Checklist (Core Flows)
- Auth: doctor login, pharmacist login.
- Patient management: create/edit/delete patient.
- Prescriptions: new prescription flow, add drug, persistence after refresh.
- Reports: upload + view report.
- Data isolation: doctors only see their own patients.

## Recent Automated Coverage
- Medical Summary: error state, summary rendering, refresh regeneration.
- Patient Form (doctor + pharmacy portals):
- DOB selected => age years/months/days auto-calculated and readonly.
- DOB cleared/not provided => manual age entry allowed (years/months/days).
- Manual mode validation accepts any one age part (years or months or days).
- PDF: footer includes current version string.
- Security rules:
- Doctor/pharmacist tenant isolation.
- Unauthenticated deny checks.
- Admin override checks.
- Ownership reassignment-deny checks.
- Security-focused tests:
- OpenAI proxy auth and endpoint sanitization.
- Optimized OpenAI service auth/token forwarding.
- Backup/restore signed-out deny behavior.
- SMS trigger guard-path behavior (template disabled, missing sender, invalid recipient).
- Input sanitization guard checks for script/event-handler patterns.
- Onboarding dummy-data lifecycle:
- seed/check/delete behavior for new-doctor sample data in Firebase storage.
- auth-path assertions that new doctor creation triggers dummy-data seeding.
- Medication form dosage constraints:
- dosage selector appears only for `Tablet`/`Capsule`.
- fractional dosage options (`1/2`, `1/4`, etc.) appear only for `Tablet`.
- `Capsule` dosage options are whole-number only.
- non-tablet/capsule payloads save `dosage: ''` even when legacy records contain `1`.
- Pharmacist prescription detail safeguards:
- rack/location label rendering in medication cards.
- patient age/sex modal fallback resolution (top-level + nested patient snapshots).
- modal corner rendering regression guard through modal component tests.
- End-to-end smoke coverage:
- doctor/pharmacy core flows, inventory form combinations, send-to-pharmacy and mixed medication print/send routes.

## Current Baseline
- Full suite status at last run: `786` passed, `0` failed (`npm run test:run`).
- Latest targeted checks for prescription/pharmacy UI updates:
- `npx vitest run src/tests/components/ConfirmationModal.test.js src/tests/components/PharmacistDashboard.test.js` => `32` passed.
- `npm run test:e2e` => `18` passed, `1` skipped.

## Emulator Notes
`npm run test:run` uses Firebase emulators for Firestore + Auth.
If it fails:
- Ensure Firebase CLI is installed and logged in.
- Ensure Java is installed (Firestore emulator).
- Try `firebase emulators:start --only firestore,auth` separately to validate.

## Troubleshooting
- **Tests hang**: check emulator startup output.
- **Auth/Firestore errors**: confirm `.env` and Firebase project settings.
- **Component failures**: run `npm test` to reproduce in watch mode.

## See Also
- `docs/legacy/MANUAL_TESTING_CHECKLIST.md`
- `docs/legacy/TESTING_QUICK_START.md`
- `docs/legacy/TESTING_BEST_PRACTICES.md`
- `docs/legacy/HIPAA_COMPLIANCE_CHECKLIST.md`
