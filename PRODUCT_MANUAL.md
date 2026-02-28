# Product Manual

## Scope
This is the primary user-facing operations manual for M-Prescribe.

## Access
- Primary domain: `https://mprescribe.net`
- Legacy host: `https://prescribe-7e1e8.web.app`

## Roles
1. Doctor
- Manage patients, symptoms, diagnoses, reports, prescriptions.
- Use AI recommendations and medication suggestions.
- Generate PDF prescriptions and send to pharmacy.
- Use Payments page for Stripe subscription billing.

2. Pharmacist
- Register/login pharmacist account.
- Connect with doctors by pharmacist number/PH code.
- Receive prescriptions and manage dispensing workflow.
- Maintain inventory and stock availability.

3. Admin
- Manage doctors and system-level settings.
- Configure messaging/email templates.
- Manage promotions (promo code generation and activation).
- Configure payment pricing in Admin -> Payments:
  - USD monthly/annual
  - LKR monthly/annual
  - Scope: `new_customers` or `all_customers`
  - Custom pricing enable/disable

## Core Workflows

### Patient + Prescription
1. Add/select patient.
2. Open Prescriptions tab.
3. Create prescription and add medications.
4. Finalize prescription when ready; action changes to `Unfinalize Prescription`.
5. Send to pharmacy (button becomes disabled after send and re-enables only after unfinalize).
6. Save/print PDF as needed.

### Finalize + Send Rules
- Finalized prescriptions are treated as locked until unfinalized.
- Sending to pharmacy uses a progress state on the button to prevent duplicate sends.
- To edit after send/finalize, click `Unfinalize Prescription` first.

### Quantity + Unit Rules
- For count-based medications where computed quantity is unavailable, entered count (`qts`) is used.
- Prescription fractional dosage values (for example `1/2`, `1/4`) are available only for `Tablet`.
- `Capsule` uses whole-number dosage values only.
- For all other dispense forms (for example `Syrup`, `Cream`, `Liquid (bottles)`, `Liquid (measured)`), dosage is hidden and saved as empty.
- In prescription outputs (PDF/pharmacy payload), units are omitted when value is missing.

### Inventory Selection Safety (Doctor Medication Add)
- For inventory-selected `Tablet`, `Capsule`, and `Liquid (measured)` rows:
  - If chosen batch cannot satisfy requested amount, system warns with the exact available amount from that batch.
  - System asks remaining quantity to be sourced from another batch.
  - If no second batch exists, user is advised to prescribe via external pharmacy.

### Pharmacist Prescription Details
- Each medication card shows:
  - Rack/location (when available in inventory record)
  - Remaining amount and batch allocation details
- If rack data is missing in source inventory, `Not specified` is shown.

### OCR Report Upload
- Reports support camera/image/PDF upload and OCR extraction.
- Large OCR payloads are reduced/compressed client-side and accepted by backend proxy limits.

### Payments
- Stripe checkout is created server-side.
- Final price is server-enforced (catalog + admin pricing scope + admin discount + promo rules).

## Security and Isolation
- Doctor data isolation: doctors see only their own patient domain data.
- Role-based access enforced in UI + backend/firestore rules.

## Canonical References
- Release details: `CHANGELOG.md`
- Technical details: `ENGINEERING_MANUAL.md`
- Testing: `TESTING_GUIDE.md`
