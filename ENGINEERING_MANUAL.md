# Engineering Manual

## Scope
Primary technical reference for architecture, setup, deployment, and runtime operations.

## Stack
- Frontend: Svelte + Tailwind + Flowbite
- Backend: Firebase Functions + Firestore + Auth + Hosting
- Integrations: OpenAI, Stripe, Twilio/Notify (where configured)

## Architecture
- Role-based app routing for doctor/pharmacist/admin experiences.
- Firestore as source of record.
- Cloud Functions for privileged operations (Stripe checkout, OCR proxy, messaging helpers).

## Environment
Required:
- Node.js 18+
- npm 8+
- Firebase CLI

Typical env vars:
- `VITE_FIREBASE_*`
- `VITE_FUNCTIONS_REGION`
- `VITE_FUNCTIONS_BASE_URL` (optional override)

Functions secrets (example set):
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Messaging-related secrets

## Local Development
```bash
npm install
npm run dev
```

## Testing
Use `TESTING_GUIDE.md` as canonical source.

Common commands:
```bash
npm test
npm run test:run
npm run test:e2e
```

## Prescription Data Rule
- `MedicationForm` persists `dosage` only when `dosageForm` is `Tablet` or `Capsule`.
- Fractional dosage values (for example `1/2`, `1/4`) are allowed only when `dosageForm` is `Tablet`.
- `Capsule` must use whole-number dosage options only (`1`, `2`, `3`, `4`).
- Non-tablet/capsule forms must submit `dosage: ''` to avoid legacy fallback values like `1` appearing in prescription displays.
- Keep count-based quantity logic (`qts`) unchanged for forms that require count entry.
- `Liquid (measured)` has two mandatory separate values:
  - `Strength` = how much the patient takes each dose.
  - `Volume` = total available drug size.
- `Liquid (measured)` must never be treated as tablet/capsule semantics and must never display tablet units.
- Canonical labels must be unchanged across screens: `Vol:`, `Quantity:`, and `Total volume`.
- Read-time normalization is required for legacy prescriptions:
  - Normalize dosage form names to current canonical options.
  - For `Packet` rows that stored volume as `strength` in `ml/l`, move to `totalVolume`/`volumeUnit` and clear strength so right-side line 1 stays true-strength only.

## Deployment
Build + deploy:
```bash
npm run build
firebase deploy
```

Selective deploys (examples):
```bash
firebase deploy --only hosting
firebase deploy --only functions:createStripeCheckoutSession,functions:confirmStripeCheckoutSuccess
```

## Payments Technical Notes
- Stripe checkout session is created server-side.
- Base plan catalog is defined in Functions.
- Admin overrides come from `systemSettings/paymentPricing`.
- Scope logic:
  - `new_customers`: apply only for doctors without prior payment markers.
  - `all_customers`: apply for all doctors.
- Promo and admin discounts are applied on top of effective plan price, then validated server-side.

## Documentation Governance
- Maintain this file for technical truth.
- Keep `README.md` concise and link here.
- Add release deltas to `CHANGELOG.md` only.
