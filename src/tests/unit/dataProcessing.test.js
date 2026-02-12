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
})
