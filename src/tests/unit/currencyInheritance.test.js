import { describe, it, expect } from 'vitest'
import { resolveInheritedCurrency } from '../../utils/currencyInheritance.js'

describe('resolveInheritedCurrency', () => {
  it('uses owner doctor currency when available', () => {
    const result = resolveInheritedCurrency({
      ownerDoctor: { currency: 'lkr', country: 'United States' }
    })
    expect(result).toBe('LKR')
  })

  it('falls back to owner doctor country when currency missing', () => {
    const result = resolveInheritedCurrency({
      ownerDoctor: { country: 'Sri Lanka' }
    })
    expect(result).toBe('LKR')
  })

  it('falls back to provided country when owner missing', () => {
    const result = resolveInheritedCurrency({
      fallbackCountry: 'United Kingdom'
    })
    expect(result).toBe('GBP')
  })
})
