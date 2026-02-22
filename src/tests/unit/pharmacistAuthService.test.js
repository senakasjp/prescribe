import { describe, it, expect, vi, beforeEach } from 'vitest'
const firebaseStorageMock = vi.hoisted(() => ({
  getPharmacistByEmail: vi.fn(),
  getPharmacyUserByEmail: vi.fn(),
  getPharmacistById: vi.fn(),
  getDoctorById: vi.fn(),
  getAllDoctors: vi.fn()
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
      country: 'Sri Lanka',
      connectedDoctors: ['doc-1']
    })
    firebaseStorageMock.getDoctorById.mockResolvedValue({
      id: 'doc-1',
      country: 'Sri Lanka',
      currency: 'LKR'
    })

    const result = await pharmacistAuthService.signInPharmacist('team@example.com', 'pass123 ')

    expect(result.isPharmacyUser).toBe(true)
    expect(result.pharmacyId).toBe('ph-1')
    expect(result.connectedDoctors).toEqual(['doc-1'])
    expect(result.country).toBe('Sri Lanka')
    expect(result.currency).toBe('LKR')
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

  it('resolves team-member currency from connected doctor fallback when pharmacy connectedDoctors is empty', async () => {
    firebaseStorageMock.getPharmacistByEmail.mockResolvedValue(null)
    firebaseStorageMock.getPharmacyUserByEmail.mockResolvedValue({
      id: 'team-2',
      email: 'team2@example.com',
      password: 'pass123',
      pharmacyId: 'ph-2'
    })
    firebaseStorageMock.getPharmacistById.mockResolvedValue({
      id: 'ph-2',
      businessName: 'Fallback Pharmacy',
      connectedDoctors: []
    })
    firebaseStorageMock.getDoctorById.mockResolvedValue(null)
    firebaseStorageMock.getAllDoctors.mockResolvedValue([
      { id: 'doc-22', country: 'Sri Lanka', currency: 'LKR', connectedPharmacists: ['ph-2'] }
    ])

    const result = await pharmacistAuthService.signInPharmacist('team2@example.com', 'pass123')

    expect(result.currency).toBe('LKR')
    expect(result.country).toBe('Sri Lanka')
    expect(result.doctorCountry).toBe('Sri Lanka')
  })
})
