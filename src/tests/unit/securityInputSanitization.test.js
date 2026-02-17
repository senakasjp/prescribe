import { describe, expect, it } from 'vitest'
import { sanitizeInput } from '../../utils/validation.js'

describe('security: malicious input sanitization', () => {
  it('strips HTML tags, javascript protocol, and inline event handlers', () => {
    const payload = '<img src=x onerror=alert(1)><a href="javascript:alert(2)">Click</a><script>alert(3)</script>'
    const sanitized = sanitizeInput(payload)

    expect(sanitized).not.toMatch(/[<>]/)
    expect(sanitized.toLowerCase()).not.toContain('javascript:')
    expect(sanitized.toLowerCase()).not.toContain('onerror=')
    expect(sanitized.toLowerCase()).not.toContain('<script')
  })

  it('keeps normal text content while trimming whitespace', () => {
    const sanitized = sanitizeInput('  Follow up in 7 days  ')
    expect(sanitized).toBe('Follow up in 7 days')
  })

  it('removes common inline event handler patterns used in rich text payloads', () => {
    const payload = '<div onclick=alert(1) onmouseover=alert(2)>Preview</div>'
    const sanitized = sanitizeInput(payload)

    expect(sanitized.toLowerCase()).not.toContain('onclick=')
    expect(sanitized.toLowerCase()).not.toContain('onmouseover=')
    expect(sanitized).toContain('Preview')
  })

  it('keeps template placeholders while stripping dangerous wrappers', () => {
    const payload = '<p>{{doctorName}}</p><script>alert(1)</script>'
    const sanitized = sanitizeInput(payload)

    expect(sanitized).toContain('{{doctorName}}')
    expect(sanitized).not.toMatch(/[<>]/)
    expect(sanitized.toLowerCase()).not.toContain('javascript:')
  })

  it('returns empty string for non-string input', () => {
    expect(sanitizeInput(null)).toBe('')
    expect(sanitizeInput(undefined)).toBe('')
    expect(sanitizeInput(123)).toBe('')
    expect(sanitizeInput({ unsafe: true })).toBe('')
  })
})
