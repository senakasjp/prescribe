import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetDoctorById,
  mockGetDoctorByEmail,
  mockGetAllPharmacists,
  mockGetInventoryItems
} = vi.hoisted(() => ({
  mockGetDoctorById: vi.fn(),
  mockGetDoctorByEmail: vi.fn(),
  mockGetAllPharmacists: vi.fn(),
  mockGetInventoryItems: vi.fn()
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getDoctorById: mockGetDoctorById,
    getDoctorByEmail: mockGetDoctorByEmail,
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
    mockGetAllPharmacists.mockReset()
    mockGetInventoryItems.mockReset()

    mockGetDoctorById.mockResolvedValue({
      id: 'doc-1',
      connectedPharmacists: ['ph-1']
    })
    mockGetDoctorByEmail.mockResolvedValue(null)
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
})
