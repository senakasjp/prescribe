import { describe, it, expect } from 'vitest'
import { resolveLocaleFromCountry } from '../../utils/localeByCountry.js'
import { formatCurrency } from '../../utils/formatting.js'
import { formatDate } from '../../utils/dataProcessing.js'

describe('localeByCountry', () => {
  it('resolves locale from country name', () => {
    expect(resolveLocaleFromCountry('United States')).toBe('en-US')
    expect(resolveLocaleFromCountry('United Kingdom')).toBe('en-GB')
  })

  it('falls back to en-GB when country is missing', () => {
    expect(resolveLocaleFromCountry('')).toBe('en-GB')
  })
})

describe('formatCurrency', () => {
  it('formats LKR with currency code', () => {
    const result = formatCurrency(1234.5, { currency: 'LKR', locale: 'en-GB' })
    expect(result).toContain('LKR')
  })

  it('formats USD using currency code', () => {
    const result = formatCurrency(1234.5, { currency: 'USD', locale: 'en-US' })
    expect(result).toContain('USD')
  })
})

describe('formatDate', () => {
  it('uses US locale for United States', () => {
    const result = formatDate('2025-01-02', { country: 'United States' })
    expect(result).toBe('01/02/2025')
  })

  it('uses GB locale for United Kingdom', () => {
    const result = formatDate('2025-01-02', { country: 'United Kingdom' })
    expect(result).toBe('02/01/2025')
  })
})
