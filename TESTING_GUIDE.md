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

# Coverage
npm run test:coverage

# UI runner
npm run test:ui
```

## What Each Command Does
- `npm test`: Vitest watch mode. Good for local development.
- `npm run test:run`: Uses `firebase emulators:exec` to run tests against Firestore/Auth emulators.
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
- PDF: footer includes current version string.

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
- `MANUAL_TESTING_CHECKLIST.md`
- `TESTING_QUICK_START.md`
- `TESTING_BEST_PRACTICES.md`
- `HIPAA_COMPLIANCE_CHECKLIST.md`
