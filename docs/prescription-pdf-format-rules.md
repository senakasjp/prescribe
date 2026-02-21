# Prescription PDF Formatting Rules (Critical)

These rules are mandatory for medication rows in the generated prescription PDF.

## Line 1 (top row)
- Left side: medication name.
- Right side: `Strength` (only when it is a true strength value, e.g. `500 mg`).
- `Liquid (measured)` and `Liquid (bottles)` must show `Strength` on the right side when strength exists.
- Non-strength dispense forms must never show right-side strength:
  - `Cream`, `Ointment`, `Gel`, `Suppository`, `Inhaler`, `Spray`, `Shampoo`, `Packet`, `Roll`.

## Line 2 (meta row)
- `Vol:` must appear here for volume values (e.g. `Vol: 1000 ml`).
- `Vol:` must appear at most once per medication row (no duplicate `Vol` segment).
- `Count/Quantity` must appear here when available (e.g. `Packet | Quantity: 03`).
- If both are available, both must remain on line 2 (example: `Vol: 1000 ml | Packet | Quantity: 03`).
- For `Liquid (bottles)`, line 2 may contain both volume and quantity.
- `Amount` should not be printed when quantity is already present.
- Line 2 should wrap before the right-side strength column.

## Liquid (measured) Rule (Critical)
- `Liquid (measured)` must never be treated as tablet/capsule logic.
- For `Liquid (measured)`, there are two separate concepts:
  - `Strength`: how much the patient takes each time (dose, e.g. `5 ml`).
  - `Volume`: size of drug available (e.g. `100 ml` bottle/stock volume).
- `Strength` and `Volume` are not interchangeable and must not overwrite each other.
- Do not show tablet-based units (such as `tablets`) for `Liquid (measured)` rows.

## Forbidden output
- Do not print `Strength:` on line 2.
- Do not print volume on the right side of line 1 for non-measured-volume rows.

## Source of values
- `Strength` can come from inventory or from doctor-entered prescription data.
- `Vol:` can come from inventory or resolved volume fields (container/total-volume style fallbacks).

## Canonical labels (must stay identical across UI/PDF/Pharmacy payload)
- Volume prefix: `Vol:`
- Quantity prefix: `Quantity:`
- Form label for total stock size in add-medication UI: `Total volume`

## Payload parity rule
- Any medication metadata printed in PDF line 1/line 2 must also be present in pharmacy payload semantics.
- If a legacy prescription stores packet volume in `strength` as `ml/l`, normalize to `totalVolume + volumeUnit` on read before rendering/sending.
