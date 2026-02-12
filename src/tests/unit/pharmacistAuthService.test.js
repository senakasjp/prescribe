import { describe, it, expect, vi, beforeEach } from 'vitest'
const firebaseStorageMock = vi.hoisted(() => ({
  getPharmacistByEmail: vi.fn(),
  getPharmacyUserByEmail: vi.fn(),
  getPharmacistById: vi.fn()
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: firebaseStorageMock
}))

import pharmacistAuthService from '../../services/pharmacist/pharmacistAuthService.js'

describe('pharmacistAuthService team member login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('logs in pharmacy user with trimmed password', async () => {
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

    const result = await pharmacistAuthService.signInPharmacist('team@example.com', 'pass123 ')

    expect(result.isPharmacyUser).toBe(true)
    expect(result.pharmacyId).toBe('ph-1')
    expect(result.connectedDoctors).toEqual(['doc-1'])
  })

  it('rejects invalid team member password', async () => {
    firebaseStorageMock.getPharmacistByEmail.mockResolvedValue(null)
    firebaseStorageMock.getPharmacyUserByEmail.mockResolvedValue({
      id: 'team-1',
      email: 'team@example.com',
      password: 'pass123',
      pharmacyId: 'ph-1'
    })

    await expect(
      pharmacistAuthService.signInPharmacist('team@example.com', 'wrong')
    ).rejects.toThrow('Invalid password')
  })
})
