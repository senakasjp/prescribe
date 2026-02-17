# Changelog - Prescribe Medical System

## Version 2.3.14 - Admin Payment Pricing Controls + Scope Rules (February 17, 2026)

### 💳 Admin Payment Pricing Module
- Implemented a real Payments configuration module in Admin:
  - Editable plan prices for:
    - USD monthly
    - USD annual
    - LKR monthly
    - LKR annual
  - Scope selection:
    - `new_customers`
    - `all_customers`
  - Enable/disable toggle for custom pricing.
- Implemented in:
  - `src/components/AdminDashboard.svelte`
  - `src/services/firebaseStorage.js`

### ☁️ Stripe Checkout Pricing Enforcement
- Checkout now reads admin-configured pricing from Firestore (`systemSettings/paymentPricing`).
- Scope is enforced server-side:
  - Apply only to new customers when `appliesTo = new_customers`
  - Apply to everyone when `appliesTo = all_customers`
- Keeps default catalog pricing when settings are missing/disabled/invalid.
- Implemented in:
  - `functions/index.js`

### 🧪 Tests
- Added Admin UI coverage:
  - `src/tests/components/AdminDashboard.test.js`
  - Verifies loading and saving payment pricing values + scope.
- Added Firestore service coverage:
  - `src/tests/unit/firebaseStorage.paymentPricingSettings.test.js`
  - Verifies get/save behavior for `paymentPricing` settings.
- Added backend pricing-rule coverage:
  - `src/tests/unit/stripePricingConfig.test.js`
  - Verifies default fallback, `new_customers` scope, `all_customers` scope, and invalid-value handling.

## Version 2.3.13 - Quantity Fallback + PDF Volume Labeling (February 16, 2026)

### 💊 Count-Based Quantity Fallback (Pricing + Pharmacy Payload)
- Fixed quantity mapping for count-based medications when derived quantity cannot be computed from frequency/duration/strength.
- The system now falls back to the entered prescription count (`qts`) so these medications are still priced and sent with a usable amount.
- Applied in:
  - `src/services/pharmacist/chargeCalculationService.js`
  - `src/components/PrescriptionsTab.svelte`
  - `src/components/PatientDetails.svelte`

### 🧾 PDF Second-Line Labeling
- Standardized second-line inventory labeling:
  - Use `Vol:` when inventory value represents volume (volume dispense forms and `ml/l` values).
  - Use `Strength:` for non-volume inventory strength values.
- Applied in:
  - `src/components/PrescriptionPDF.svelte`
  - `src/components/PatientDetails.svelte`

### 🧪 Tests
- Added/updated targeted regression tests:
  - `src/tests/unit/chargeCalculationService.test.js` (entered-count fallback coverage)
  - `src/tests/integration/inventoryToPdfAndPharmacyFlow.test.js` (inventory-to-PDF volume label flow)
  - `src/tests/components/PrescriptionPDF.test.js` (second-line label behavior)

## Version 2.3.12 - Doctor Payments + Stripe Checkout (February 15, 2026)

### 💳 New In-App Payments Page
- Added a dedicated doctor payments page:
- `src/components/PaymentsPage.svelte`
- Added a new `Payments` tab in doctor navigation in:
- `src/App.svelte`
- Supports two plans per currency (USD/LKR):
- Professional Monthly
- Professional Annual
- Payment button shows a busy state during checkout session creation.

### 🔗 Stripe Integration
- Added new Firebase Cloud Function endpoint:
- `createStripeCheckoutSession`
- Added Stripe post-checkout verification endpoint:
- `confirmStripeCheckoutSuccess`
- Added Stripe webhook endpoint:
- `stripeWebhook`
- Endpoint verifies authenticated Firebase bearer token (`getAuthorizedUser`).
- Stripe checkout session is created server-side with a fixed plan catalog to prevent client-side amount tampering.
- Session creation is logged in Firestore collection:
- `stripeCheckoutLogs`
- Added return URL host allow-list guard for checkout success/cancel redirects.
- Webhook events now update doctor payment status automatically:
- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.deleted`
- On successful payment, doctor account is marked paid and `accessExpiresAt` is extended based on plan interval.
- Activated post-payment notifications for successful payments:
- Sends `paymentThanksEmail` automatically to the doctor (when enabled/configured).
- Sends payment-success SMS automatically using messaging templates:
  `paymentSuccessTemplateEnabled` / `paymentSuccessTemplate` (with fallback text).
- Added backend idempotency guard for Stripe payment references to prevent duplicate success processing (e.g., webhook + manual confirmation for the same checkout session).

### ⚙️ Backend Dependency
- Added Stripe SDK to Cloud Functions:
- `functions/package.json` (`stripe`)

### 🧪 Tests
- Added new component test:
- `src/tests/components/PaymentsPage.test.js`
- Verifies checkout session request is sent to:
- `createStripeCheckoutSession`
- Verifies auth bearer token and selected plan are included in request payload.
- Verifies auth-token missing case shows the correct payment error state.
- Verifies backend checkout failures surface the server error message to doctors.
- Added new functions unit test suite:
- `src/tests/unit/stripeFunctions.test.js`
- Verifies Stripe endpoints/webhook guardrails:
- auth required for checkout endpoint,
- missing Stripe secret handling,
- required `sessionId` validation for checkout confirmation,
- webhook method + signature/config validation.
- Added idempotency notification test:
- `src/tests/unit/stripePaymentNotifications.test.js`
- Verifies duplicate payment callbacks (same Stripe payment reference) do not send duplicate payment-success email/SMS and do not duplicate payment ledger records.
- Fixed doctor resolution for Stripe updates by adding UID-based fallback matching (`uid` / `firebaseUid` / `userUid` / `authUid`) in payment confirmation and webhook handling so doctor billing wallet/status updates reliably apply.
- Added admin doctor-wallet detail coverage:
- `src/tests/components/AdminDashboard.test.js`
- Verifies doctor detail page shows billing wallet records and referral free-month availability.

### 🧾 Admin Doctor Billing Page
- Extended Admin doctor detail view with a dedicated billing wallet section.
- Added wallet summary metrics:
- wallet value (months),
- payment status,
- referral free months available,
- referred doctor counts and referral status counts.
- Added billing ledger table per doctor (payments + referral credits).
- Added new storage service APIs:
- `getDoctorPaymentRecords`
- `getDoctorReferralWalletStats`
- `addDoctorPaymentRecord`

## Version 2.3.11 - Global Small Theme + Flowbite Alignment (February 15, 2026)

### 🎨 System-Wide UI Standardization
- Enforced a global small-size baseline in `src/app.css`:
- `body` now defaults to `text-sm`.
- Standardized default styles for `input`, `select`, and `textarea` (Flowbite-like small controls with cyan focus ring).
- Standardized base button text size to `text-sm`.

### 🧩 Flowbite Configuration Alignment
- Enabled Tailwind plugins in `tailwind.config.js`:
- `@tailwindcss/forms`
- `flowbite/plugin`
- Removed CDN Flowbite runtime from `index.html` to avoid version drift.
- Added Flowbite runtime import from installed package in `src/main.js`:
- `flowbite/dist/flowbite.min.js`

### ✅ Validation
- Production build verified successfully (`npm run build`).
- Targeted component tests verified:
- `src/tests/components/InventoryDashboard.test.js`
- `src/tests/components/DoctorInventoryAlertsPage.test.js`

## Version 2.3.10 - HTML5 WYSIWYG Prescription Export (February 14, 2026)

### 🧾 Same-Look Preview and PDF
- Added a new HTML5-based prescription print/export path in `PrescriptionPDF`:
- New action button: `Print / Save PDF (HTML5)`.
- Uses browser print-to-PDF from HTML/CSS (`@page A5`) so output matches preview layout.
- Added WYSIWYG prescription paper preview inside the modal using the same HTML structure and CSS used for printing.

### 🔁 Backward Compatibility
- Kept existing `Generate PDF` (jsPDF) flow unchanged for compatibility.

### 🧪 Tests
- Added test coverage for the HTML5 export button in:
- `src/tests/components/PrescriptionPDF.test.js`
- Verified: `27/27` tests passing for PrescriptionPDF component tests.

## Version 2.3.9 - Patient Title Prefix Expansion (February 14, 2026)

### 👤 Patient Registration + Edit Title Options
- Added new patient title options in registration form:
- `Dr`
- `Prof`
- `Rev.`
- Updated patient edit/bio edit title options to match new registration options.

### 🔎 Name Parsing Compatibility
- Expanded title parsing support for patient names to recognize:
- `Dr`, `Prof`, `Rev.`
- Also accepts dotted/alias variants for existing records:
- `Dr.`, `Prof.`, `Rev`

### 🧪 Test Coverage
- Extended component tests in:
- `src/tests/components/PatientForm.test.js`
- Added unit tests for title parsing in:
- `src/tests/unit/patientName.test.js`

## Version 2.3.8 - Onboarding Dummy Data + Tour Toolbar Controls (February 14, 2026)

### 🧪 New Doctor Onboarding Seed Data
- Added automatic onboarding dummy-data seeding for newly created doctors.
- Seed package now includes:
- 5 dummy drugs in doctor drug database.
- 1 dummy patient.
- 1 dummy prescription linked to the dummy patient.
- Dummy PDF template editor settings in doctor `templateSettings`.
- All onboarding seed records are tagged with `isOnboardingDummy: true` for safe cleanup.

### 🧹 Dummy Data Cleanup Action
- Added `Delete dummy data` button next to `Start tour` in app top bar (desktop + mobile icon variant).
- Button visibility is data-driven:
- Visible only when onboarding dummy data exists for the logged-in doctor.
- Automatically hides after successful deletion.
- Cleanup removes only records marked as onboarding dummy data and clears dummy template settings.

### ✅ Test Coverage Expansion
- Added dedicated unit tests for onboarding dummy-data lifecycle:
- `src/tests/unit/firebaseStorage.onboardingDummyData.test.js`
- Expanded auth flow tests to assert onboarding seed behavior for new doctor creation paths:
- `src/tests/unit/firebaseAuth.referral.test.js`
- Current full suite baseline: `73/73` test files, `528/528` tests passing.

## Version 2.3.7 - Camera Capture UX + OCR Guardrails (February 14, 2026)

### 📱 Mobile Camera Capture Flow Refinement
- Added branded mobile capture header using `BrandName`.
- Removed access code display from mobile capture page.
- Removed manual file-browse style UI and switched to a guided flow:
- `Take Photograph` first.
- After capture: preview + `Upload Photo` + `Retake`.
- Removed mobile `Download Image` option.
- Added success confirmation after upload:
- `Photo uploaded successfully. You can return to desktop.`

### 🖥️ Desktop Camera Tab Simplification
- Simplified camera OCR controls in report form to keep only `Extract Text` under captured preview.
- Removed extra controls and helper text in desktop camera section:
- `Camera Capture` label removed.
- `Retake` button removed from that action row.
- `Detect 4 Corners` button removed from that action row.
- `Extracted Text (Editable)` label removed.
- `Extracted text will appear here after OCR is generated.` helper removed.
- Improved corner-handle visibility by replacing subtle circles with high-contrast cross markers.

### 🧠 OCR Unreadable Handling
- Added reusable unreadable-text detector utility:
- `src/utils/unreadableText.js`
- Integrated unreadable detection in camera OCR flow:
- If unreadable signals are detected, keep extracted text box closed and show explicit retake message.

### 🧪 Test Updates
- Added new unit test file:
- `src/tests/unit/unreadableText.test.js`
- Updated mobile capture component tests for the new flow and success message:
- `src/tests/components/MobileCameraCapturePage.test.js`
- Updated mobile route wiring tests to remove old download-link expectation and assert new branded flow:
- `src/tests/unit/mobileCaptureRoute.test.js`
- Updated camera OCR regression expectations in:
- `src/tests/unit/patientDetailsImportRegression.test.js`
- Full suite verified green after updates:
- `69/69` test files, `497/497` tests passing.

## Version 2.3.6 - Security Hardening and Authorization Test Expansion (February 13, 2026)

### 🔐 Firestore Rule Hardening
- Added explicit secured rules for `pharmacistInventory` and `drugStock`.
- Added admin-safe doctor create path for migration/admin operations.
- Locked ownership on updates:
- Doctor-owned records cannot be reassigned by changing `doctorId`.
- Pharmacy inventory/stock records cannot be reassigned by changing `pharmacistId`.

### 🧪 Security Test Coverage Expansion
- Expanded integration rules tests in `src/tests/integration/firestoreRules.security.test.js` with:
- Cross-tenant deny checks for doctor/pharmacist data.
- Ownership reassignment attack-deny checks.
- Unauthenticated deny checks for inventory data.
- Added backup auth-deny integration case in `src/tests/integration/backupRestore.test.js`.
- Added OpenAI proxy/client security unit tests:
- `src/tests/unit/openaiProxy.security.test.js`
- `src/tests/unit/optimizedOpenaiService.security.test.js`
- Expanded SMS trigger security/guard tests in `src/tests/unit/doctorNotificationSmsTriggers.test.js`.
- Expanded sanitization tests in `src/tests/unit/securityInputSanitization.test.js`.

### ✅ Validation Status
- Full suite green after changes: `431/431` tests passing.

## Version 2.3.6 (Docs Addendum) - Dispense Form Categories (February 15, 2026)

### 💊 Medication Category Documentation Update
- Added documentation for three medication categories:
- **QTY (sell as units)**: `Injection`, `Cream`, `Ointment`, `Gel`, `Suppository`, `Inhaler`, `Spray`, `Shampoo`, `Packet`, `Roll`
- **Non-QTY**: `Tablet`, `Capsule`, `Liquid (measured)`
- **Special QTY**: `Liquid (bottles)`
- Updated wording in docs from **Dosage Form** context to **Dispense Form** category context.

## Version 2.3.5 - Qts-Based Non-Tablet Pricing (February 13, 2026)

### 💊 Qts Input + Pricing Rule
- **New Qts workflow** for non-`Tablet`/`Capsule`/`Syrup` dosage forms (for example: ointment, suppository, drops, spray).
- **Qts input moved next to Strength** in the `Add New Medication` form for faster entry.
- **Qts is integer-only** (positive whole number).
- **Qts is compulsory** whenever it is shown.
- **Dosage Fraction hidden** when Qts-based dosage forms are selected.
- **PRN Amount hidden** in Qts mode.
- **When to take hidden** in Qts mode.
- **Frequency and Duration are optional** in Qts mode.

### 💰 Price Calculation Logic
- For non-`Tablet`/`Capsule`/`Syrup` dosage forms:  
  `Drug Price = Qts × unit selling price`
- For syrups/liquids: pricing continues with ml-based quantity logic.
- For tablets/capsules: pricing continues with amount/dosage logic.
- Multi-batch inventory allocation is still supported; total cost is summed across allocated batches.

## Version 2.3.4 - Patient Workflow & Prescription Routing (February 10, 2026)

### 👤 Patient Registration UX
- **Scrollable registration modals** in doctor and pharmacy portals
- **Age entry upgraded to Years/Months/Days** with auto‑calculation from DOB
- **Validation rule**: if DOB missing, manual age accepts Years, Months, or Days (at least one required)
- **Success notifications + auto‑close** after adding a patient

### 🔎 Patient Search
- Doctor portal search now matches **short patient IDs** (PAxxxxxxx)

### 🧾 Prescriptions Safety
- **Warning prompt** when starting a new prescription with unfinalized drugs
- **Save Drug progress** shown on the button during save
- **External pharmacy routing**: checkbox per drug; any out‑of‑stock or flagged drug goes to external PDF and is excluded from own‑pharmacy send

### 🩺 Medical Summary
- Auto‑refreshes on changes to **symptoms, allergies, drugs, and reports**

## Version 2.3.3 - Messaging Templates & App URL (February 3, 2026)

### 📩 SMS + Email Template Upgrades
- **App URL setting**: Admins can set a custom `{{appUrl}}` under System Settings
- **Template support**: `{{appUrl}}` now works in SMS and email templates
- **SMS test number**: Configurable test phone number with inline save
- **Test buttons**: Send test SMS for Registration, Appointment Reminder, Doctor Registration, and Doctor Approved templates

### ✅ Doctor Registration SMS Enhancements
- **Auto SMS triggers**: New doctor registration + approval messages
- **Copy to test**: Optional checkbox to copy registration SMS to the test number

## Version 2.3.2 - Workflow & Billing Enhancements (January 24, 2026)

### ✅ Prescriptions: Procedures + Consultation Controls
- Added a procedures/treatments checklist in the doctor prescription flow
- Added “Exclude consultation charge” option for doctor prescriptions
- Procedures + exclusion flags are persisted through finalize and send-to-pharmacy

### 💰 Pharmacist Billing Alignment
- Procedure pricing is included in pharmacist billing totals
- Doctor charges respect “exclude consultation charge” when present
- Pharmacist billing table shows procedures in breakdown

### 🧾 Doctor Expected Price
- Doctor portal shows “Expected Price” after finalizing
- Uses the same pharmacist billing logic (rounding, currency, discount) for consistency

### 🗓️ Pharmacist Date/Time Accuracy
- Prescription list now shows **sent time** (not creation time)
- Date/time is localized to the doctor’s country timezone

### 🔐 Delete Code Confirmation
- Each doctor gets a 6‑digit delete code stored in profile
- Destructive actions require the delete code confirmation
- Code is shown only in doctor Settings (Edit Profile)

### 👤 External Doctor Username Login
- External doctor creation now uses a username (not email)
- External doctors log in with **username + password**
- Normal doctors continue to use email login

## Version 2.2.26 - Pharmacist Drug Charge Accuracy (January 2025)

### 💰 Responsive Drug Charge Calculation
- **Inventory-Enriched Charges**:
  - ✅ Passes matched inventory snapshots (selling price, identifiers) from the pharmacist dashboard into the billing service
  - ✅ Automatically recalculates charges after inventory lookups finish so modal totals stay in sync
  - ✅ Supports multi-batch fulfilment by allocating requested quantities across sequential inventory batches
- **Robust Pricing Logic**:
  - ✅ Charge service revalidates medication amounts, parses unit pricing strings, and multiplies quantity × selling price
  - ✅ Falls back to dynamic inventory matching when cached data is unavailable
- **User Impact**:
  - Pharmacists now see accurate drug totals that mirror the editable “Amount” field
  - Eliminates “Not available” placeholders for in-stock items and speeds up checkout workflows

## Version 2.2.25 - Pharmacist Inventory Matching Reliability (January 2025)

### ✅ Inventory Visibility Fix
- **Accurate Matching**:
  - ✅ Normalizes brand, generic, and combined medication labels to align with pharmacist inventory entries
  - ✅ Supports medications written as `Brand(Generic)` or with extra whitespace/punctuation
  - ✅ Reduces false “Not in inventory” warnings inside the prescription detail modal
- **Reactive Updates**:
  - ✅ Stores inventory snapshots in lightweight keyed objects with explicit version bumps for Svelte reactivity
  - ✅ Ensures expiry date and stock figures immediately reflect matched inventory items

### 🩺 Pharmacist Portal Impact
- Pharmacists now see real-time stock/expiry details for medications that already exist in inventory
- Dispensing workflows no longer require manual verification for matched drugs
- Maintains HIPAA-compliant separation while improving day-to-day fulfilment accuracy

## Version 2.2.24 - Brand Name Autofill Fix (January 2025)

### 🔧 **Autofill Enhancement**
- **Brand Name Autofill**: 
  - ✅ Fixed autofill not working with brand names from pharmacist portal inventory
  - ✅ Improved data mapping in pharmacyMedicationService to prioritize brandName over drugName
  - ✅ Enhanced search logic with comprehensive matching (includes, startsWith)
  - ✅ Added debugging logs for better troubleshooting
- **Data Structure Improvements**:
  - ✅ Updated medication display to show generic names in brackets when available
  - ✅ Duration now displays as "30 days" instead of just "30"
  - ✅ Improved brand/generic name handling across all medication components

### 🐛 **Bug Fixes**
- **MedicationForm**: Fixed "S.trim is not a function" error by adding proper null checks
- **PharmacyMedicationService**: Fixed brand name mapping from inventory data
- **Display Components**: Updated all medication display components to show generic names

## Version 2.2.23 - Enhanced Medication Form Fields (January 2025)

### 🔧 **Form Field Improvements**
- **Duration Field**: 
  - ✅ Changed to number-only input with minimum value of 1
  - ✅ Updated label to "Duration in days" for clarity
  - ✅ Simplified placeholder to "e.g., 30" (removed "days" text)
- **Dosage Field**: 
  - ✅ Changed from text to number input for validation
  - ✅ Added decimal support (step="0.1") for precise dosages
  - ✅ Added minimum value of 0 to prevent negative entries
- **Route of Administration**: 
  - ✅ Updated dropdown options to show "Full Word (Abbreviation)" format
  - ✅ Right-side input field now displays same format as dropdown
  - ✅ Added comprehensive mapping for all route types
  - ✅ Examples: "Oral (PO)", "Intramuscular (IM)", "Intravenous (IV)"

### 🎯 **User Experience Enhancements**
- **Better Validation**: Number inputs prevent invalid text entries
- **Consistent Formatting**: All route displays follow medical standards
- **Improved Clarity**: Clear labels and placeholders guide users
- **Mobile-Friendly**: Number inputs provide appropriate mobile keyboards
- **Professional Appearance**: Medical-standard formatting throughout

### 📱 **Technical Implementation**
- **Input Type Changes**: Text → Number for dosage and duration fields
- **Reactive Display**: Dynamic route formatting with Svelte reactivity
- **Validation Rules**: Min/max values and step controls for precise input
- **Mapping System**: Comprehensive route abbreviation to full name conversion

## Version 2.2.22 - Drug Identification System Update (January 2025)

### 🔑 Enhanced Drug Identification System
- **New Primary Key**: Updated to Brand Name + Strength + Strength Unit + Expiry Date
- **Composite Key Benefits**: 
  - ✅ Unique identification for each drug batch
  - ✅ Proper FIFO management with expiry date tracking
  - ✅ Prevents duplicate entries with same drug but different expiry dates
  - ✅ Better batch tracking and inventory management
- **Implementation**: Updated inventory service, UI components, and validation logic
- **Documentation**: Updated all relevant documentation files

### 🏥 Patient Age Input Enhancement
- **Age Type Selection**: Added dropdown to choose between "Years" and "Days"
- **Days Support**: Can now enter age in days for very young patients (e.g., "40 days old")
- **Auto-calculation**: Automatic age calculation from date of birth based on selected type
- **Display Format**: Smart conversion (e.g., "1 year 50 days" for 415 days)

### 🔥 Firebase Security Rules
- **Deployed Rules**: Successfully deployed Firebase security rules via CLI
- **Authentication**: Implemented proper user authentication checks
- **Data Security**: Maintained HIPAA compliance with proper access controls

### 📅 Date Format Standardization
- **Consistent Format**: All dates now display in DD/MM/YYYY format across the entire application
- **Fixed Components**: Updated PharmacistDashboard, SettingsPage, PatientManagement, AdminDashboard, PharmacistManagement, and BatchManagement
- **Standardized Locale**: All date formatting now uses `en-GB` locale with explicit formatting options
- **User Experience**: Consistent date display improves user experience and reduces confusion
- **Technical Implementation**: Replaced inconsistent `en-US` and browser-default formats with standardized `en-GB` format

## Version 2.2.21 - PDF Formatting Refinements (January 2025)

### 📄 Prescription PDF Typography Enhancement
- **Section Headings**: Reduced font size from 12pt to 11pt for better visual balance
- **Affected Sections**: "PATIENT INFORMATION", "PRESCRIPTION MEDICATIONS", "ADDITIONAL NOTES"
- **Font Hierarchy**: More professional and balanced typography throughout PDF
- **Visual Impact**: Improved readability with appropriately sized section headings

### 🎯 Technical Details
- **Font Size Optimization**: Section headings now 11pt instead of 12pt
- **Consistency**: All three main section headings use same font size
- **Professional Appearance**: Better proportions between headings and body text
- **Version**: Updated to v2.2.21 across all components

## Version 2.2.20 - Patient Information Enhancement (January 2025)

### 👤 Patient Sex/Gender Field Addition
- **New Field**: Added patient sex/gender to prescription PDF
- **Placement**: Third line of patient information section
- **Fallback Handling**: Shows "Not specified" if gender data not available
- **Field Priority**: Checks both `gender` and `sex` fields for maximum compatibility

### 📋 Patient Information Layout
1. **Line 1**: Name (left) | Date (right)
2. **Line 2**: Age (left) | Prescription # (right)
3. **Line 3**: Sex/Gender (left) ← NEW
4. **Spacing**: 6mm between each line

## Version 2.2.19 - Multi-Page Consistency (January 2025)

### 📄 Horizontal Lines on All Pages
- **Separator Lines**: Added horizontal line after header on every PDF page
- **Line Specifications**: 0.5pt width, 2mm below header
- **Multi-Page Support**: Consistent header + line on all continuation pages
- **Professional Appearance**: Clear visual separation between header and content

### 🔄 Page Break Enhancement
- **Medication Overflow**: Header + line added when medications continue to new page
- **Notes Overflow**: Header + line added when additional notes overflow
- **Consistent Layout**: Every page follows same header structure

## Version 2.2.18 - PDF Header Lines (January 2025)

### ➖ Horizontal Line After Headers
- **Visual Separator**: Added 0.5pt horizontal line after all header types
- **Consistent Placement**: 2mm below header content
- **Content Positioning**: All content starts 5mm below the line
- **Professional Look**: Clear separation between header and prescription body

## Version 2.2.17-2.2.15 - PDF Layout Refinements (January 2025)

### 📐 Layout Improvements
- **Removed Doctor Signature Section**: Cleaner, more streamlined PDF layout
- **Increased Header Dimensions**: Better visibility and readability (250mm x 120mm max)
- **Enhanced Font Scaling**: More aggressive font size management for PDF clarity
- **Centered Layout**: Improved signature and date positioning (later removed)

## Version 2.2.14-2.2.12 - Margin and Multi-Page Fixes (January 2025)

### 📏 Margin Adjustments
- **Increased Margins**: Left and right margins increased from 10mm to 20mm
- **Better Readability**: More comfortable reading space on printed documents
- **Multi-Page Headers**: Fixed header appearing on all pages for all template types
- **Consistent Spacing**: Proper margin application throughout document

## Version 2.2.11-2.2.9 - Header Capture and Multi-Page Support (January 2025)

### 🎨 Exact Preview Header Capture
- **HTML to Image**: Captures exact preview header for PDF using html2canvas
- **Multi-Page Headers**: Captured header appears on every page
- **Browser Preview**: PDFs now open in new browser window instead of downloading
- **Reduced Margins**: Optimized header margin spacing (5mm top)

### 📊 Technical Implementation
- **Image Storage**: Stores captured header data for reuse on multiple pages
- **Position Tracking**: Maintains header X position for consistent alignment
- **Scope Fixes**: Proper variable scoping for multi-page header rendering

## Version 2.2.8 - PDF Font Size Enhancement (January 2025)

### 🔤 Header Font Scaling Improvements
- **Increased Font Sizes**: Larger minimum font sizes (32px for text, 36-48px for headings)
- **Heading-Specific Scaling**: H1: 48px, H2: 42px, H3: 38px, H4-H6: 36px
- **Higher Quality Capture**: html2canvas scale increased to 4 for sharper text
- **Better Readability**: More aggressive font scaling (1.8x) for PDF clarity

## Version 2.2.7-2.2.6 - Upload Preview and Version Updates (January 2025)

### 🖼️ Upload Preview Enhancement
- **Automatic Preview**: Upload header option now shows automatic preview
- **Reactive Updates**: Preview updates automatically when image is uploaded
- **Removed Manual Button**: Eliminated redundant "Preview Uploaded Header" button
- **Streamlined UX**: Cleaner interface with automatic preview generation

## Version 2.2.5 - Header Editor System Enhancement



### 🎨 Prescription Template Header Editor Improvements
- **Streamlined Interface**: Removed redundant "Preview System Header" button from third option (System Header)
- **Cleaner UI**: Third option now shows only the "Professional Header Editor" section
- **Enhanced User Experience**: Simplified workflow for custom header creation
- **Version Tracking**: Updated all components to v2.2.5 for consistent versioning
- **Functionality Preserved**: All header editing capabilities remain intact
- **Status**: ✅ **FULLY DEPLOYED AND FUNCTIONAL**

### 🔧 Technical Implementation
- **Component Cleanup**: Removed unnecessary preview button from SettingsPage.svelte
- **Version Synchronization**: Updated version indicators across all components
- **Interface Optimization**: Streamlined header editor interface for better usability
- **Deployment**: Successfully deployed to https://mprescribe.net (legacy host: https://prescribe-7e1e8.web.app)

### 📋 Files Modified
- `src/components/SettingsPage.svelte` - Removed redundant preview button
- `src/App.svelte` - Updated version to v2.2.5
- `src/components/PharmacistDashboard.svelte` - Updated version to v2.2.5
- `src/components/PatientDetails.svelte` - Updated PDF version watermark to v2.2.5

### 🎯 User Experience Impact
- **Before**: Redundant preview button created UI clutter in system header option
- **After**: Clean, focused interface with only essential editing tools
- **Benefit**: Improved workflow efficiency for prescription header customization

## Version 2.3.1 - Add New Patient Button Fix

### 🏥 Critical Bug Fix - Add New Patient Functionality
- **Issue**: "+ Add New Patient" button was not working - button clicks were registered and state was updated, but PatientForm component was not rendering
- **Root Cause**: PatientForm conditional rendering was in the wrong location within the component architecture
- **Solution**: Moved PatientForm conditional rendering to the correct location within the patients view section
- **Impact**: Restored core functionality for adding new patients to the system
- **Status**: ✅ **FULLY RESOLVED AND DEPLOYED**

### 🔧 Technical Implementation
- **Component Architecture Fix**: Corrected conditional rendering structure in PatientManagement.svelte
- **State Management**: Maintained proper state management for showPatientForm
- **UI Restoration**: Cleaned up all debugging code and restored professional interface
- **Testing**: Comprehensive manual testing verified all functionality works correctly

### 📋 Files Modified
- `src/components/PatientManagement.svelte` - Fixed conditional rendering structure
- `src/components/PatientForm.svelte` - Cleaned up debug styling
- All debugging code removed and professional UI restored

### 🎯 User Experience Impact
- **Before**: Users unable to add new patients (critical functionality broken)
- **After**: Seamless patient addition workflow with professional UI
- **Verification**: Manual testing confirmed button works on all devices and screen sizes

## Version 2.3.0 - Dispensed Status Integration & Enhanced Doctor-Pharmacy Communication

### 🏥 Doctor Portal - Dispensed Status Integration
- **Real-time Dispensed Status**: Doctors can now see which medications have been dispensed from connected pharmacies
- **Last Prescription Card**: Enhanced with dispensed badges showing medication status
- **Decoupled Architecture**: Maintains strict separation between doctor and pharmacist portals
- **Service Layer Integration**: Uses dedicated `prescriptionStatusService` for secure data access
- **Visual Indicators**: Clear "Dispensed" badges with green styling and checkmark icons

### 🔄 Prescription ID Mapping System
- **Multi-format Support**: Handles different prescription ID formats between doctor and pharmacist systems
- **Automatic Mapping**: Maps pharmacist prescription IDs to doctor prescription IDs automatically
- **Robust Lookup**: Uses multiple mapping strategies including prescriptions field and ID extraction
- **Error Handling**: Graceful fallback when mapping fails
- **Debug Logging**: Comprehensive logging for troubleshooting ID mapping issues

### 🧹 Medical Summary Cleanup
- **Removed Redundant Status**: Cleaned up Medical Summary to remove unnecessary dispensed status indicators
- **Focused Display**: Medical Summary now focuses purely on medication history without dispensed status
- **Performance Optimization**: Removed unused dispensed status tracking code
- **Cleaner Interface**: Simplified medication display in Medical Summary component

### 🔧 Technical Implementation
- **Enhanced Service Layer**: Updated `prescriptionStatusService.js` with improved ID mapping logic
- **Component Optimization**: Streamlined `MedicalSummary.svelte` by removing dispensed status code
- **Data Flow**: Maintained proper data flow between doctor and pharmacist systems
- **Error Recovery**: Added fallback mechanisms for prescription ID resolution

### 📋 Rules & Implementation Guidelines
- **Strict Decoupling**: Doctor and pharmacist portals remain completely independent
- **Service Layer Only**: All cross-portal communication goes through dedicated service layers
- **No Direct Access**: No direct database access between portals
- **Secure Communication**: All data exchange is properly authenticated and authorized
- **Maintainable Architecture**: Clear separation of concerns for future development

## Version 2.2.0 - Prescription Notes & Enhanced Doctor Portal

### 📝 Prescription Notes System
- **Notes Field**: Added prescription notes textarea in doctor portal
- **Strategic Placement**: Notes field appears at bottom of prescription form
- **PDF Integration**: Notes automatically included in prescription PDF generation
- **Two-Way Binding**: Seamless data binding between components
- **Professional Styling**: Consistent with app design using Flowbite components
- **Icon Integration**: Added sticky note icon for visual clarity

### 🏥 Doctor Portal Enhancements
- **Enhanced Workflow**: Notes field integrated into existing prescription flow
- **Data Persistence**: Notes saved with prescription data
- **User Experience**: Clear placeholder text and intuitive interface
- **Accessibility**: Proper form labels and focus management

### 🔧 Technical Implementation
- **Component Updates**: Modified `PrescriptionsTab.svelte` to include notes field
- **Data Binding**: Added `bind:prescriptionNotes` between components
- **Form Integration**: Notes field positioned after medications list
- **PDF Support**: Existing PDF generation automatically includes notes

## Version 2.1.0 - Individual Drug Dispatch & Enhanced UX

### 💊 Individual Drug Dispatch System
- **Granular Control**: Added individual checkboxes for each medication in prescriptions
- **Selective Dispensing**: Pharmacists can now mark specific medications as dispensed
- **Smart Button**: "Mark as Dispensed" button shows count of selected medications
- **Responsive Design**: Works seamlessly on both desktop and mobile devices
- **Visual Feedback**: Clear checkboxes with teal styling for consistency
- **Validation**: Button disabled until at least one medication is selected

### ⚠️ Enhanced Warning System
- **User Guidance**: Clear warning message when no medications are selected
- **Helpful Instructions**: Explains exactly what users need to do
- **Professional Notifications**: Uses existing notification system with error styling
- **Improved UX**: Prevents user confusion and guides proper workflow

### 🎨 UI/UX Enhancements
- **Mobile Optimization**: Pharmacy portal fully responsive for mobile use
- **Professional Notifications**: Enhanced notification system with animations and stacking
- **Contrast Improvements**: Fixed all accessibility contrast issues across the app
- **Button Consistency**: Standardized all buttons to use Flowbite styling
- **Modal Improvements**: Updated all popups to follow Flowbite design patterns

### 🔧 Technical Improvements
- **State Management**: Enhanced medication selection state tracking
- **Error Handling**: Improved validation and user feedback
- **Code Quality**: Better function organization and documentation
- **Performance**: Optimized component rendering for mobile devices

## Version 2.0.0 - Major UI/UX Overhaul

### 🎨 UI/UX Enhancements
- **Flowbite Migration**: Converted all Bootstrap components to Flowbite for modern, consistent UI
- **Theme Update**: Applied teal color scheme throughout the application
- **Responsive Design**: Enhanced mobile responsiveness across all components
- **Button Styling**: Fixed outline button styles for History/Edit buttons
- **Loading States**: Improved loading indicators with ThreeDots component

### 🤖 AI Token Management System
- **Quota Management**: Added monthly token quotas for individual doctors
- **Usage Tracking**: Real-time token usage monitoring with progress bars
- **Cost Estimation**: Token pricing configuration (price per 1M tokens)
- **Default Quotas**: Set default quotas for all doctors
- **Admin Controls**: Admin panel for managing doctor quotas and pricing

### 👥 Patient Data Management
- **Conditional Rendering**: Hide empty patient information fields for cleaner UI
- **Current Medications Card**: Display active medications with remaining duration
- **Data Privacy**: Enhanced doctor isolation - each doctor only sees their own patients
- **HIPAA Compliance**: Proper data access controls and patient data protection

### 💊 Prescription Workflow Improvements
- **Clean Slate Prescriptions**: New prescriptions clear previous medications completely
- **Enhanced AI Context**: AI prompts now include patient country, allergies, current medications
- **Medication Tracking**: Better management of current and long-term medications
- **PDF Generation**: Professional prescription PDFs with proper formatting

### 🔕 Notification System Overhaul
- **Removed Alerts**: Eliminated all notification popups for cleaner user experience
- **Console Logging**: Replaced with console logging for debugging purposes
- **Silent Error Handling**: Errors handled gracefully without interrupting user flow

### 🏥 Pharmacist Portal Enhancements
- **Flowbite Components**: Converted all modals and forms to Flowbite
- **Prescription Management**: Improved prescription viewing and management
- **Stock Management**: Enhanced inventory tracking interface
- **Connection System**: Streamlined pharmacist-doctor connection process

### 🔧 Technical Improvements
- **Code Modularity**: Improved code organization with proper comments
- **Error Handling**: Enhanced error handling throughout the application
- **Performance**: Optimized component rendering and data loading
- **Accessibility**: Improved A11y compliance with proper ARIA labels

## Version 1.0.0 - Initial Release

### Core Features
- Doctor portal with patient management
- Prescription creation and management
- AI-powered drug suggestions
- Pharmacist portal for prescription handling
- Admin dashboard for system management
- Firebase integration for data storage
- User authentication and authorization

### Initial Components
- PatientDetails.svelte - Patient management interface
- PatientManagement.svelte - Patient list and overview
- AdminDashboard.svelte - Administrative controls
- PharmacistDashboard.svelte - Pharmacist interface
- AIRecommendations.svelte - AI drug suggestion system

## Recent Bug Fixes

### Send to Pharmacy Button Functionality
- **Issue**: "Send to 1 Pharmacy" button was not working due to undefined variable
- **Fix**: Fixed `prescriptionsToSend` variable reference to use correct `prescriptions` variable
- **Enhancement**: Added success/error notifications and proper cleanup after sending
- **Result**: Pharmacy sending functionality now works correctly with user feedback

### Font Contrast Issues Across All Components
- **Issue**: Multiple components had poor text contrast in dark mode using `text-muted` classes
- **Components Fixed**: PatientDetails, PatientManagement, EditProfile, PatientList, ConfirmationModal, PrescriptionPDF, AdminDashboard, PharmacistManagement
- **Fix**: Replaced all `text-muted` classes with `text-gray-600 dark:text-gray-300` for proper contrast
- **Result**: All text is now clearly readable in both light and dark modes

### Popup Modal Contrast Issues
- **Issue**: Various popup windows had contrast problems with buttons and text
- **Components Fixed**: Connect to Pharmacist modal, Confirmation modals, PDF preview modals
- **Fix**: Updated button and text colors to ensure high contrast in dark mode
- **Result**: All popups now have excellent readability and accessibility

### AI Token Tracking Data Retention
- **Issue**: AI usage data wasn't retaining for doctors due to null doctorId values
- **Fix**: Added validation to ensure doctorId is never null/undefined, defaulting to 'unknown-doctor'
- **Enhancement**: Added migration function to fix existing data with missing doctorId
- **Result**: AI token usage is now properly tracked and retained for all doctors

### AI Suggestions Availability
- **Issue**: AI suggestions were only available when drugs were manually added first
- **Fix**: Removed dependency on manual drugs for AI suggestions button
- **Enhancement**: AI suggestions now display even when no manual drugs are added
- **Result**: Doctors can get AI drug recommendations immediately after adding symptoms

### Dashboard Values Fluctuation
- **Issue**: Dashboard statistics were fluctuating due to multiple reactive calls
- **Fix**: Added `statisticsLoading` flag to prevent multiple `loadStatistics()` calls
- **Result**: Stable dashboard values that don't fluctuate

### AI Prompts Country Context
- **Issue**: AI prompts weren't sending doctor's country information
- **Fix**: Updated AI service to include doctor country in prompts
- **Enhancement**: Added fallback logic to use patient country if specified, otherwise doctor country

### Prescription Drug Persistence
- **Issue**: Previously added drugs were showing after clicking "New Prescription"
- **Fix**: Added `clearPrescriptionMedications()` method to clear Firebase data
- **Result**: Clean slate for each new prescription

### Button Outline Styling
- **Issue**: History and Edit buttons had inconsistent outline styling
- **Fix**: Applied consistent Flowbite outline button styles
- **Result**: Uniform button appearance across mobile and desktop

## Performance Improvements

### Bundle Optimization
- Reduced bundle size through code splitting
- Optimized Firebase queries
- Improved component lazy loading
- Enhanced caching strategies

### UI Responsiveness
- Faster component rendering
- Improved mobile performance
- Better touch interactions
- Optimized image loading

## Security Enhancements

### Data Protection
- Enhanced doctor data isolation
- Improved authentication checks
- Better input validation
- Secure API key management

### HIPAA Compliance
- Patient data access controls
- Audit logging capabilities
- Data encryption in transit
- Secure data storage practices

## Future Roadmap

### Planned Features
- Advanced analytics dashboard
- Mobile app development
- Integration with pharmacy systems
- Enhanced AI capabilities
- Multi-language support
- Offline functionality

### Technical Debt
- Remove unused CSS classes
- Improve accessibility compliance
- Optimize bundle size further
- Enhance error boundaries
- Add comprehensive testing suite
