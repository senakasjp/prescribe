export const STRENGTH_UNITS = ['mg', 'g', 'ml', 'l', 'mcg', 'IU', 'units', '%']

export const DOSAGE_FORM_OPTIONS = [
  'Tablet',
  'Capsule',
  'Liquid (bottles)',
  'Liquid (measured)',
  'Injection',
  'Cream',
  'Ointment',
  'Gel',
  'Suppository',
  'Inhaler',
  'Spray',
  'Shampoo',
  'Packet',
  'Roll'
]

export const normalizeStrengthUnitValue = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const match = STRENGTH_UNITS.find(unit => unit.toLowerCase() === raw.toLowerCase())
  return match || raw
}

export const normalizeDosageFormValue = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const lowered = raw.toLowerCase()
  if (lowered === 'liquid') return 'Liquid (bottles)'
  if (lowered === 'syrup') return 'Liquid (measured)'
  const match = DOSAGE_FORM_OPTIONS.find(option => option.toLowerCase() === raw.toLowerCase())
  return match || raw
}
