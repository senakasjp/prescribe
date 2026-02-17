import { describe, expect, it } from 'vitest'
import { isUnreadableText, UNREADABLE_TEXT_INDICATORS } from '../../utils/unreadableText.js'

describe('isUnreadableText', () => {
  it('returns false for empty-like values', () => {
    expect(isUnreadableText('')).toBe(false)
    expect(isUnreadableText('   ')).toBe(false)
    expect(isUnreadableText(null)).toBe(false)
    expect(isUnreadableText(undefined)).toBe(false)
  })

  it('detects every configured unreadable indicator (case-insensitive)', () => {
    for (const indicator of UNREADABLE_TEXT_INDICATORS) {
      expect(isUnreadableText(`The image quality is ${indicator}.`)).toBe(true)
      expect(isUnreadableText(`OCR RESULT: ${indicator.toUpperCase()}`)).toBe(true)
    }
  })

  it('detects unreadable hints embedded in longer OCR responses', () => {
    const extractedText = 'Unable to read prescription dosage due to blurry lower half of the image.'
    expect(isUnreadableText(extractedText)).toBe(true)
  })

  it('returns false for valid extracted medical text', () => {
    const extractedText = 'Tab. Amoxicillin 500mg, take 1 tablet three times daily for 5 days.'
    expect(isUnreadableText(extractedText)).toBe(false)
  })
})
