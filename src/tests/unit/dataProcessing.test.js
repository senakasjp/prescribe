import { describe, it, expect } from 'vitest'
import { formatDate } from '../../utils/dataProcessing.js'

describe('formatDate', () => {
  it('formats date using country locale', () => {
    const date = new Date('2024-01-02T00:00:00Z')
    const us = formatDate(date, { country: 'United States' })
    const gb = formatDate(date, { country: 'United Kingdom' })

    expect(us).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(gb).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('returns Unknown for empty date', () => {
    expect(formatDate(null)).toBe('Unknown')
  })

  it('formats time in AM/PM when using time format', () => {
    const value = formatDate('2026-02-15T15:31:10.000Z', { locale: 'en-US', format: 'time' })
    expect(value).toMatch(/AM|PM/i)
  })

  it('formats includeTime output in AM/PM style', () => {
    const value = formatDate('2026-02-15T15:31:10.000Z', { locale: 'en-US', includeTime: true })
    expect(value).toMatch(/AM|PM/i)
  })
})
