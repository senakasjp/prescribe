import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import adminAuthService from '../../services/adminAuthService.js'

const firebaseStorageMock = vi.hoisted(() => ({
  getPharmacistByEmail: vi.fn(),
  getPharmacyUserByEmail: vi.fn(),
  getPharmacistById: vi.fn()
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: firebaseStorageMock
}))

import pharmacistAuthService from '../../services/pharmacist/pharmacistAuthService.js'

const readSource = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

describe('Role Accessibility Matrix', () => {
  beforeEach(async () => {
    localStorage.clear()
    vi.clearAllMocks()
    await adminAuthService.signOut()
  })

  it('Admin: grants privileged access only after valid admin sign-in', async () => {
    await expect(
      adminAuthService.signInAdmin('doctor@example.com', 'M-PrescribeAdmin2024!')
    ).rejects.toThrow('Access denied. Admin privileges required.')

    await adminAuthService.signInAdmin('senakahks@gmail.com', 'M-PrescribeAdmin2024!')

    expect(adminAuthService.isAuthenticated()).toBe(true)
    expect(adminAuthService.isAdmin()).toBe(true)
    expect(adminAuthService.hasPermission('manage_users')).toBe(true)
    expect(adminAuthService.hasPermission('view_analytics')).toBe(true)
  })

  it('Doctor: keeps settings/reports/notifications available for non-external doctors', () => {
    const appSource = readSource('src/App.svelte')

    // Role split must exist: external doctor is a specific subset.
    expect(appSource).toContain("isExternalDoctor = user?.role === 'doctor' && user?.externalDoctor && user?.invitedByDoctorId")

    // Menus that should remain available for regular doctors are hidden only for external doctors.
    expect(appSource).toContain('{#if !isExternalDoctor}')
    expect(appSource).toContain("on:click={() => handleMenuNavigation('reports')}")
    expect(appSource).toContain('on:click={handleSettingsClick}')
    expect(appSource).toContain('on:click={handleNotificationsBellClick}')
    expect(appSource).toContain("showDoctorAlertsModal = true")
  })

  it('Admin panel gate is restricted to admin role/flag/email contract', () => {
    const appSource = readSource('src/App.svelte')
    expect(appSource).toContain('const canAccessAdminPanel = (currentUser) => {')
    expect(appSource).toContain('currentUser.isAdmin')
    expect(appSource).toContain("currentUser.role === 'admin'")
    expect(appSource).toContain("currentUser.email === 'senakahks@gmail.com'")
  })

  it('External Doctor: enforces navigation restrictions for settings/reports/notifications', () => {
    const appSource = readSource('src/App.svelte')

    expect(appSource).toContain("$: if (currentView === 'settings' && isExternalDoctor)")
    expect(appSource).toContain("$: if (currentView === 'reports' && isExternalDoctor)")
    expect(appSource).toContain("$: if (currentView === 'notifications' && isExternalDoctor)")
    expect(appSource).toContain("currentView = 'home'")

    // Settings click handler must block external-doctor entry.
    expect(appSource).toContain('const handleSettingsClick = () => {')
    expect(appSource).toContain('if (isExternalDoctor) {')
    expect(appSource).toContain('return')
  })

  it('Team Member: logs in as pharmacy user and carries restricted team-member flag', async () => {
    firebaseStorageMock.getPharmacistByEmail.mockResolvedValue(null)
    firebaseStorageMock.getPharmacyUserByEmail.mockResolvedValue({
      id: 'team-1',
      email: 'team@example.com',
      password: 'pass123',
      pharmacyId: 'ph-1'
    })
    firebaseStorageMock.getPharmacistById.mockResolvedValue({
      id: 'ph-1',
      businessName: 'Main Pharmacy',
      pharmacistNumber: 'PH-001',
      connectedDoctors: ['doc-1']
    })

    const member = await pharmacistAuthService.signInPharmacist('team@example.com', 'pass123 ')
    expect(member.role).toBe('pharmacist')
    expect(member.isPharmacyUser).toBe(true)
    expect(member.pharmacyId).toBe('ph-1')
    expect(member.connectedDoctors).toEqual(['doc-1'])

    const pharmacistSettingsSource = readSource('src/components/pharmacist/PharmacistSettings.svelte')
    expect(pharmacistSettingsSource).toContain('$: isTeamMember = !!pharmacist?.isPharmacyUser')
    expect(pharmacistSettingsSource).toContain('$: canEditProfile = isPrimaryPharmacy && !isTeamMember')
  })

  it('Pharmacy Owner: login remains pharmacist without team-member flag', async () => {
    firebaseStorageMock.getPharmacistByEmail.mockResolvedValue({
      id: 'ph-1',
      email: 'owner@example.com',
      password: 'ownerpass',
      role: 'pharmacist',
      connectedDoctors: ['doc-1']
    })

    const owner = await pharmacistAuthService.signInPharmacist('owner@example.com', 'ownerpass')
    expect(owner.role).toBe('pharmacist')
    expect(owner.isPharmacyUser).toBeFalsy()
  })
})
