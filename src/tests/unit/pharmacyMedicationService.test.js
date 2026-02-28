import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetDoctorById,
  mockGetDoctorByEmail,
  mockGetDoctorByUid,
  mockGetAllPharmacists,
  mockGetInventoryItems
} = vi.hoisted(() => ({
  mockGetDoctorById: vi.fn(),
  mockGetDoctorByEmail: vi.fn(),
  mockGetDoctorByUid: vi.fn(),
  mockGetAllPharmacists: vi.fn(),
  mockGetInventoryItems: vi.fn()
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getDoctorById: mockGetDoctorById,
    getDoctorByEmail: mockGetDoctorByEmail,
    getDoctorByUid: mockGetDoctorByUid,
    getAllPharmacists: mockGetAllPharmacists
  }
}))

vi.mock('../../services/pharmacist/inventoryService.js', () => ({
  default: {
    getInventoryItems: mockGetInventoryItems
  }
}))

import { pharmacyMedicationService } from '../../services/pharmacyMedicationService.js'

describe('pharmacyMedicationService', () => {
  beforeEach(() => {
    pharmacyMedicationService.clearAllCache()
    mockGetDoctorById.mockReset()
    mockGetDoctorByEmail.mockReset()
    mockGetDoctorByUid.mockReset()
    mockGetAllPharmacists.mockReset()
    mockGetInventoryItems.mockReset()

    mockGetDoctorById.mockResolvedValue({
      id: 'doc-1',
      email: 'doctor@example.com',
      connectedPharmacists: ['ph-1']
    })
    mockGetDoctorByEmail.mockResolvedValue(null)
    mockGetDoctorByUid.mockResolvedValue(null)
    mockGetAllPharmacists.mockResolvedValue([])
  })

  it('keeps same brand/generic packet variants when total volume differs', async () => {
    mockGetInventoryItems.mockResolvedValue([
      {
        id: 'a',
        brandName: 'ORS-Jeevanee',
        genericName: 'ORS',
        dosageForm: 'Packet',
        strength: '200',
        strengthUnit: 'ml',
        containerSize: '200',
        containerUnit: 'ml'
      },
      {
        id: 'b',
        brandName: 'ORS-Jeevanee',
        genericName: 'ORS',
        dosageForm: 'Packet',
        strength: '1000',
        strengthUnit: 'ml',
        containerSize: '1000',
        containerUnit: 'ml'
      }
    ])

    const result = await pharmacyMedicationService.getMedicationNamesFromPharmacies('doc-1')

    expect(result).toHaveLength(2)
    expect(result.map(item => item.containerSize)).toEqual(expect.arrayContaining(['200', '1000']))
  })

  it('deduplicates exact duplicates with same total volume fields', async () => {
    mockGetInventoryItems.mockResolvedValue([
      {
        id: 'a',
        brandName: 'ORS-Jeevanee',
        genericName: 'ORS',
        dosageForm: 'Packet',
        strength: '200',
        strengthUnit: 'ml',
        containerSize: '200',
        containerUnit: 'ml'
      },
      {
        id: 'b',
        brandName: 'ORS-Jeevanee',
        genericName: 'ORS',
        dosageForm: 'Packet',
        strength: '200',
        strengthUnit: 'ml',
        containerSize: '200',
        containerUnit: 'ml'
      }
    ])

    const result = await pharmacyMedicationService.getMedicationNamesFromPharmacies('doc-1')

    expect(result).toHaveLength(1)
    expect(result[0].containerSize).toBe('200')
    expect(result[0].containerUnit).toBe('ml')
  })

  it('uses canonical duplicate doctor with real pharmacy links', async () => {
    mockGetDoctorById.mockImplementation(async (id) => {
      if (id === 'dup-empty') {
        return {
          id: 'dup-empty',
          email: 'kmamithakaru@gmail.com',
          uid: 'doctor-uid-1',
          connectedPharmacists: []
        }
      }

      return null
    })

    mockGetDoctorByEmail.mockImplementation(async (email) => {
      if (email === 'kmamithakaru@gmail.com') {
        return {
          id: 'kmamithakaru@gmail.com',
          email: 'kmamithakaru@gmail.com',
          uid: 'doctor-uid-1',
          connectedPharmacists: ['ph-1']
        }
      }

      return null
    })

    mockGetDoctorByUid.mockResolvedValue({
      id: 'dup-empty',
      email: 'kmamithakaru@gmail.com',
      uid: 'doctor-uid-1',
      connectedPharmacists: []
    })

    mockGetAllPharmacists.mockResolvedValue([
      { id: 'ph-2', connectedDoctors: ['kmamithakaru@gmail.com'] },
      { id: 'ph-3', connectedDoctors: ['other-doc'] }
    ])

    const result = await pharmacyMedicationService.getConnectedPharmacies('dup-empty')
    expect(result.sort()).toEqual(['ph-1', 'ph-2'])
  })
})
