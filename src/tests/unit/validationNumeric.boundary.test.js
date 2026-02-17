import { describe, expect, it } from 'vitest'
import { validateNumeric } from '../../utils/validation.js'

describe('validation: numeric boundary and fuzz checks', () => {
  it('rejects non-numeric textual input used in calculation fields', () => {
    expect(validateNumeric('abc').isValid).toBe(false)
    expect(validateNumeric('12abc').isValid).toBe(false)
    expect(validateNumeric('one').isValid).toBe(false)
  })

  it('rejects invalid numeric formats and accepts clean integers', () => {
    expect(validateNumeric('1e3', { allowDecimals: false }).isValid).toBe(false)
    expect(validateNumeric('1.5', { allowDecimals: false }).isValid).toBe(false)
    expect(validateNumeric('10', { allowDecimals: false }).isValid).toBe(true)
  })

  it('enforces min/max bounds', () => {
    expect(validateNumeric('0', { min: 1 }).isValid).toBe(false)
    expect(validateNumeric('101', { max: 100 }).isValid).toBe(false)
    expect(validateNumeric('50', { min: 1, max: 100 }).isValid).toBe(true)
  })

  it('rejects negatives when allowNegative is false', () => {
    expect(validateNumeric('-1', { allowNegative: false }).isValid).toBe(false)
    expect(validateNumeric('0', { allowNegative: false }).isValid).toBe(true)
  })

  it('handles large but finite values without crashing', () => {
    const result = validateNumeric('999999999', { min: 0 })
    expect(result.isValid).toBe(true)
  })
})
