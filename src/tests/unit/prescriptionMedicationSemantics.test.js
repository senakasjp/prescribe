import { describe, expect, it } from 'vitest'
import { DOSAGE_FORM_OPTIONS } from '../../utils/medicationOptions.js'
import {
  PRESCRIPTION_DISPLAY_LABELS,
  normalizeLegacyMedication,
  requiresCountForDosageForm
} from '../../utils/prescriptionMedicationSemantics.js'

describe('prescriptionMedicationSemantics', () => {
  it('keeps canonical display labels stable', () => {
    expect(PRESCRIPTION_DISPLAY_LABELS.volumePrefix).toBe('Vol:')
    expect(PRESCRIPTION_DISPLAY_LABELS.quantityPrefix).toBe('Quantity:')
    expect(PRESCRIPTION_DISPLAY_LABELS.totalVolumeField).toBe('Total volume')
  })

  it('enforces count semantics matrix for every dosage form option', () => {
    const expectedNoCount = new Set(['Tablet', 'Capsule', 'Liquid (measured)'])
    DOSAGE_FORM_OPTIONS.forEach((form) => {
      expect(requiresCountForDosageForm(form)).toBe(!expectedNoCount.has(form))
    })
  })

  it('normalizes legacy packet ml strength into total volume and clears header strength', () => {
    const normalized = normalizeLegacyMedication({
      name: 'ORS-Jeevanee',
      dosageForm: 'packet',
      strength: '1000',
      strengthUnit: 'ml'
    })

    expect(normalized.dosageForm).toBe('Packet')
    expect(normalized.totalVolume).toBe('1000')
    expect(normalized.volumeUnit).toBe('ml')
    expect(normalized.strength).toBe('')
    expect(normalized.strengthUnit).toBe('')
  })

  it('keeps liquid bottle strength for right-column rendering', () => {
    const normalized = normalizeLegacyMedication({
      name: 'Salbutamol',
      dosageForm: 'liquid',
      strength: '5',
      strengthUnit: 'ml',
      containerSize: '100',
      containerUnit: 'ml'
    })

    expect(normalized.dosageForm).toBe('Liquid (bottles)')
    expect(normalized.strength).toBe('5')
    expect(normalized.strengthUnit).toBe('ml')
    expect(normalized.totalVolume).toBe('100')
    expect(normalized.volumeUnit).toBe('ml')
  })
})
