# Manual Testing Checklist (App-Wide)

Use this checklist after changes that can’t be fully covered by automated tests. This is a focused, high‑signal set of flows and edge cases for the whole app.

## 1. Authentication & Roles
- Doctor login with email/password.
- Doctor login with Google.
- Pharmacist login.
- Logout clears session and returns to login.
- Role routing: doctor sees doctor UI, pharmacist sees pharmacist UI, admin sees admin UI.

## 2. Patient Management (Doctor)
- Create patient (required fields, validation errors).
- Edit patient (name, age/DOB, gender, contact).
- Delete patient (confirmation flow).
- Patient list refreshes after add/edit/delete.
- Doctor‑patient isolation (Doctor A cannot see Doctor B patients).

## 3. Prescriptions
- New prescription creates a new record.
- Add drug flow works end‑to‑end.
- Prescriptions persist after refresh.
- Edit/delete a medication works and updates totals.
- Generate PDF works and includes correct patient + version.

## 4. Symptoms, Diagnoses, Reports
- Add symptom and diagnosis.
- Add report (image/pdf); preview renders.
- Delete report and verify removal.
- Pagination works if present.

## 5. Allergies & Long‑Term Medications
- Add allergies from overview.
- Edit allergies.
- Add long‑term meds.
- Edit long‑term meds.
- Empty state: “None recorded” when blank.

## 6. Medical Summary (AI)
- Refresh summary button regenerates content.
- Loading state shows while generating.
- Error state displays if AI is not configured.
- Summary content renders safely and correctly.

## 7. Settings & Profile
- Edit profile (name, country, city).
- Notification toggle works.
- Template header settings persist (if used).

## 8. Pharmacist Portal
- Inventory list loads.
- Allocate/dispense workflow works.
- Inventory updates reflect changes.
- Pharmacy settings save correctly.

## 9. Admin Panel
- Admin login works.
- User management actions execute safely.
- Logs and stats display without errors.

## 10. Notifications & Messaging
- Email/SMS/WhatsApp triggers only when intended.
- No unexpected notifications after simple edits.

## 11. Data Integrity & Refresh
- Hard refresh after edits keeps data.
- No duplicated values in UI.
- Version label matches current release.

## 12. Accessibility & UX
- Modal focus and ESC close behavior.
- Keyboard navigation works in modals.
- Required fields visually indicated.

## 13. Performance & Errors
- No console errors in browser dev tools.
- Large patient list still scrolls smoothly.

---

If you need a role‑specific checklist (doctor/pharmacist/admin), I can split this further.
