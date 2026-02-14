import { beforeEach, describe, expect, it } from 'vitest'
import adminAuthService from '../../services/adminAuthService.js'

describe('security: role-based access', () => {
  beforeEach(async () => {
    localStorage.clear()
    await adminAuthService.signOut()
  })

  it('denies admin sign-in for non-admin email', async () => {
    await expect(
      adminAuthService.signInAdmin('doctor@example.com', 'M-PrescribeAdmin2024!')
    ).rejects.toThrow('Access denied. Admin privileges required.')

    expect(adminAuthService.isAuthenticated()).toBe(false)
    expect(adminAuthService.isAdmin()).toBeFalsy()
  })

  it('denies admin sign-in with invalid password even for admin email', async () => {
    await expect(
      adminAuthService.signInAdmin('senakahks@gmail.com', 'wrong-password')
    ).rejects.toThrow('Invalid admin credentials')

    expect(adminAuthService.isAuthenticated()).toBe(false)
  })

  it('grants admin permissions only after valid admin sign-in and removes them on sign-out', async () => {
    await adminAuthService.signInAdmin('SENAKAHKS@GMAIL.COM', 'M-PrescribeAdmin2024!')

    expect(adminAuthService.isAuthenticated()).toBe(true)
    expect(adminAuthService.isAdmin()).toBe(true)
    expect(adminAuthService.hasPermission('manage_users')).toBe(true)
    expect(adminAuthService.hasPermission('non_existing_permission')).toBe(false)

    await adminAuthService.signOut()
    expect(adminAuthService.isAuthenticated()).toBe(false)
    expect(adminAuthService.isAdmin()).toBeFalsy()
    expect(adminAuthService.hasPermission('manage_users')).toBe(false)
  })
})
