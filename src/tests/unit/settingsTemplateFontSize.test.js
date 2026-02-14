import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

describe('Doctor template font size settings regression', () => {
  it('loads, binds, and saves headerFontSize in settings editor', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const settingsPagePath = path.resolve(__dirname, '../../components/SettingsPage.svelte')
    const source = fs.readFileSync(settingsPagePath, 'utf8')

    expect(source).toContain('let headerFontSize = 16')
    expect(source).toContain('const parseHeaderFontSize = (value, fallback = 16) => {')
    expect(source).toContain("parseFloat(String(value || ''))")
    expect(source).toContain('headerFontSize = parseHeaderFontSize(user.templateSettings.headerFontSize, 16)')
    expect(source).toContain('headerFontSize = parseHeaderFontSize(size, 16)')
    expect(source).toContain('bind:headerFontSize={headerFontSize}')
    expect(source).toContain('headerFontSize: headerFontSize || 16')
    expect(source).not.toContain('style="font-size: {headerFontSize}px;"')
    expect(source).not.toContain('Prescription Preview')
  })

  it('applies selected font size in header editor and PDF rendering', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const headerEditorPath = path.resolve(__dirname, '../../components/HeaderEditor.svelte')
    const prescriptionPdfPath = path.resolve(__dirname, '../../components/PrescriptionPDF.svelte')
    const patientDetailsPath = path.resolve(__dirname, '../../components/PatientDetails.svelte')

    const headerEditorSource = fs.readFileSync(headerEditorPath, 'utf8')
    const prescriptionPdfSource = fs.readFileSync(prescriptionPdfPath, 'utf8')
    const patientDetailsSource = fs.readFileSync(patientDetailsPath, 'utf8')

    expect(headerEditorSource).toContain('export let headerFontSize = 16')
    expect(headerEditorSource).toContain('Selected Text Size')
    expect(headerEditorSource).toContain("quill.format('size', selectedTextSize)")
    expect(headerEditorSource).toContain('onFontSizeChange(selectedTextSize)')
    expect(headerEditorSource).toContain('selectedTextSize = `${parsed}px`')
    expect(headerEditorSource).toContain("SizeStyle.whitelist = FONT_SIZE_OPTIONS.map((size) => `${size}px`)")

    expect(prescriptionPdfSource).toContain('const headerFontSize = Number(templateSettings.headerFontSize || 24)')
    expect(prescriptionPdfSource).toContain('font-size: ${headerFontSize}px !important;')
    expect(patientDetailsSource).toContain('const headerFontSize = Number(templateSettings.headerFontSize || 24)')
    expect(patientDetailsSource).toContain('font-size: ${headerFontSize}px !important;')
  })
})
