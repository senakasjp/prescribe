import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const readSource = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

describe('Doctor notification popup flow contract', () => {
  it('uses message-count badge and bell toggle handler', () => {
    const appSource = readSource('src/App.svelte')
    expect(appSource).toContain('doctorNotificationMessageCount')
    expect(appSource).toContain('on:click={handleNotificationsBellClick}')
    expect(appSource).toContain("doctorNotificationMessageCount > 99 ? '99+' : doctorNotificationMessageCount")
  })

  it('opens stock alerts in modal popup with top-right close button', () => {
    const appSource = readSource('src/App.svelte')
    expect(appSource).toContain('{#if showDoctorAlertsModal}')
    expect(appSource).toContain('handleCloseDoctorAlertsModal')
    expect(appSource).toContain('fa-times')
    expect(appSource).toContain('<DoctorInventoryAlertsPage user={effectiveUser} on:alerts-updated={handleDoctorAlertsUpdated} />')
  })

  it('routes notification item links to target views through shared navigation handler', () => {
    const appSource = readSource('src/App.svelte')
    const utilSource = readSource('src/utils/doctorNotificationItems.js')
    expect(appSource).toContain("import { buildDoctorNotificationItems } from './utils/doctorNotificationItems.js'")
    expect(appSource).toContain('doctorNotificationItems = buildDoctorNotificationItems')
    expect(appSource).toContain('handleNotificationItemClick')
    expect(appSource).toContain('handleMenuNavigation(targetView)')
    expect(utilSource).toContain("targetView: 'notifications'")
    expect(utilSource).toContain("targetView: 'payments'")
  })
})
