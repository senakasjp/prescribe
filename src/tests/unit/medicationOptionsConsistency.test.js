import { describe, it, expect } from 'vitest'
import {
  STRENGTH_UNITS,
  DOSAGE_FORM_OPTIONS,
  normalizeStrengthUnitValue,
  normalizeDosageFormValue
} from '../../utils/medicationOptions.js'

describe('medication option consistency', () => {
  it('exposes a stable strength unit list', () => {
    expect(STRENGTH_UNITS).toEqual(['mg', 'g', 'ml', 'l', 'mcg', 'IU', 'units', '%'])
    expect(new Set(STRENGTH_UNITS).size).toBe(STRENGTH_UNITS.length)
  })

  it('exposes a stable dosage form list', () => {
    expect(DOSAGE_FORM_OPTIONS).toEqual([
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
    ])
    expect(new Set(DOSAGE_FORM_OPTIONS).size).toBe(DOSAGE_FORM_OPTIONS.length)
  })

  it('normalizes inventory values to shared options', () => {
    expect(normalizeStrengthUnitValue('ML')).toBe('ml')
    expect(normalizeStrengthUnitValue('%')).toBe('%')
    expect(normalizeDosageFormValue('tablet')).toBe('Tablet')
    expect(normalizeDosageFormValue('syrup')).toBe('Liquid (measured)')
    expect(normalizeDosageFormValue('liquid')).toBe('Liquid (bottles)')
  })
})
