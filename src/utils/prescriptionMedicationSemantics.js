import { normalizeDosageFormValue, normalizeStrengthUnitValue } from './medicationOptions.js'

export const PRESCRIPTION_DISPLAY_LABELS = Object.freeze({
  volumePrefix: 'Vol:',
  quantityPrefix: 'Quantity:',
  totalVolumeField: 'Total volume'
})

export const canonicalDosageForm = (value) => normalizeDosageFormValue(value || '')

const canonicalDosageFormLower = (value) => canonicalDosageForm(value).toLowerCase()

const STRENGTH_ENABLED_FORMS = new Set([
  'tablet',
  'capsule',
  'liquid (measured)',
  'liquid (bottles)',
  'injection'
])

const INVENTORY_LOCKED_STRENGTH_FORMS = new Set([
  'tablet',
  'capsule'
])

export const isMeasuredLiquidForm = (value) => canonicalDosageFormLower(value) === 'liquid (measured)'

export const isBottledLiquidForm = (value) => canonicalDosageFormLower(value) === 'liquid (bottles)'

export const supportsStrengthForDosageForm = (value) => STRENGTH_ENABLED_FORMS.has(canonicalDosageFormLower(value))

export const isInventoryLockedStrengthDosageForm = (value) => INVENTORY_LOCKED_STRENGTH_FORMS.has(canonicalDosageFormLower(value))

export const requiresCountForDosageForm = (value) => {
  const form = canonicalDosageFormLower(value)
  if (!form) return false
  return !(
    form.includes('tablet') ||
    form.includes('tab') ||
    form.includes('capsule') ||
    form.includes('cap') ||
    form === 'liquid (measured)'
  )
}

export const normalizeLegacyMedication = (medication) => {
  if (!medication || typeof medication !== 'object') {
    return medication
  }

  const normalized = { ...medication }
  const dosageForm = canonicalDosageForm(normalized.dosageForm || normalized.form || '')
  if (dosageForm) {
    normalized.dosageForm = dosageForm
    if (!normalized.form) normalized.form = dosageForm
  }

  if (normalized.strengthUnit !== undefined && normalized.strengthUnit !== null && normalized.strengthUnit !== '') {
    normalized.strengthUnit = normalizeStrengthUnitValue(normalized.strengthUnit)
  }
  if (normalized.volumeUnit !== undefined && normalized.volumeUnit !== null && normalized.volumeUnit !== '') {
    normalized.volumeUnit = normalizeStrengthUnitValue(normalized.volumeUnit)
  }
  if (normalized.containerUnit !== undefined && normalized.containerUnit !== null && normalized.containerUnit !== '') {
    normalized.containerUnit = normalizeStrengthUnitValue(normalized.containerUnit)
  }

  const strength = String(normalized.strength ?? '').trim()
  const strengthUnit = String(normalized.strengthUnit ?? '').trim().toLowerCase()
  const totalVolume = String(normalized.totalVolume ?? '').trim()
  const volumeUnit = String(normalized.volumeUnit ?? '').trim()

  if (!totalVolume && normalized.containerSize) {
    normalized.totalVolume = normalized.containerSize
  }
  if (!volumeUnit && normalized.containerUnit) {
    normalized.volumeUnit = normalized.containerUnit
  }

  // Legacy packet rows sometimes stored container volume under strength (e.g. 1000 ml).
  // Move it to totalVolume so UI/PDF can keep volume in line 2 and reserve line 1 right side for true strength.
  if (dosageForm === 'Packet' && strength && (strengthUnit === 'ml' || strengthUnit === 'l')) {
    if (!String(normalized.totalVolume ?? '').trim()) {
      normalized.totalVolume = strength
    }
    if (!String(normalized.volumeUnit ?? '').trim()) {
      normalized.volumeUnit = normalized.strengthUnit
    }
    normalized.strength = ''
    normalized.strengthUnit = ''
  }

  return normalized
}

export const normalizeLegacyPrescription = (prescription) => {
  if (!prescription || typeof prescription !== 'object') {
    return prescription
  }

  if (!Array.isArray(prescription.medications)) {
    return prescription
  }

  return {
    ...prescription,
    medications: prescription.medications.map(normalizeLegacyMedication)
  }
}
