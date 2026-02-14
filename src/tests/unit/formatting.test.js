import { describe, it, expect } from 'vitest'
import { resolveLocaleFromCountry } from '../../utils/localeByCountry.js'
import { formatCurrency } from '../../utils/formatting.js'
import { formatDate, htmlDateToDisplay, displayDateToHtml } from '../../utils/dataProcessing.js'

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

  it('keeps HTML/display date conversion consistent', () => {
    const htmlDate = '2025-12-31'
    const displayDate = htmlDateToDisplay(htmlDate)
    const roundTrip = displayDateToHtml(displayDate)
    expect(displayDate).toBe('31/12/2025')
    expect(roundTrip).toBe(htmlDate)
  })

  it('returns stable locale-specific day/month ordering for same ISO date across countries', () => {
    const isoDate = '2026-02-13T10:30:00.000Z'
    const us = formatDate(isoDate, { country: 'United States' })
    const gb = formatDate(isoDate, { country: 'United Kingdom' })
    const lk = formatDate(isoDate, { country: 'Sri Lanka' })
    const expectedLk = new Date(isoDate).toLocaleDateString('en-LK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })

    expect(us).toBe('02/13/2026')
    expect(gb).toBe('13/02/2026')
    expect(lk).toBe(expectedLk)
  })

  it('gracefully handles invalid and empty dates', () => {
    expect(formatDate('not-a-date', { country: 'United States' })).toBe('Invalid Date')
    expect(formatDate('', { country: 'United States' })).toBe('Unknown')
  })
})
