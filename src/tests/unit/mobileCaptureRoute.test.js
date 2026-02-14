import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

describe('Mobile capture route wiring', () => {
  it('renders standalone mobile capture page when mobile-capture query is present', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const appPath = path.resolve(__dirname, '../../App.svelte')
    const appSource = fs.readFileSync(appPath, 'utf8')

    expect(appSource).toContain("import MobileCameraCapturePage from './components/MobileCameraCapturePage.svelte'")
    expect(appSource).toContain("mobileCaptureOnly = params.get('mobile-capture') === '1'")
    expect(appSource).toContain("mobileCaptureCode = (params.get('code') || '').trim().toUpperCase()")
    expect(appSource).toContain('<MobileCameraCapturePage accessCode={mobileCaptureCode} />')
  })

  it('mobile capture page enforces code format and keeps the new branded capture flow', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const pagePath = path.resolve(__dirname, '../../components/MobileCameraCapturePage.svelte')
    const pageSource = fs.readFileSync(pagePath, 'utf8')

    expect(pageSource).toContain('validateAccessCode')
    expect(pageSource).toContain('/^[A-Z0-9]{8,16}$/')
    expect(pageSource).toContain('BrandName')
    expect(pageSource).toContain("capture=\"environment\"")
    expect(pageSource).toContain('Take Photograph')
    expect(pageSource).toContain('Upload Photo')
    expect(pageSource).toContain('Photo uploaded successfully. You can return to desktop.')
    expect(pageSource).not.toContain('Access code:')
    expect(pageSource).not.toContain('download={`report-capture-${Date.now()}.jpg`}')
  })
})
