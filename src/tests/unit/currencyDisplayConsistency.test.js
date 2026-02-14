import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const readComponent = (relativePath) => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const filePath = path.resolve(__dirname, '../../', relativePath)
  return fs.readFileSync(filePath, 'utf8')
}

describe('currency display consistency', () => {
  it('avoids hardcoded Rs prefix next to locale formatter in pharmacist charge breakdown', () => {
    const source = readComponent('components/PharmacistDashboard.svelte')
    expect(source).not.toMatch(/Rs\s+\{formatCurrencyDisplay\(/)
  })

  it('avoids hardcoded Rs labels around formatted values in inventory screens', () => {
    const dashboardSource = readComponent('components/pharmacist/InventoryDashboard.svelte')
    const analyticsSource = readComponent('components/pharmacist/InventoryAnalytics.svelte')

    expect(dashboardSource).not.toMatch(/Rs\s+\{formatCurrency\(/)
    expect(dashboardSource).not.toContain('>Rs<')
    expect(analyticsSource).not.toContain('>Rs<')
  })
})
