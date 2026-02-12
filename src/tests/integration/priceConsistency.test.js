import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getDoctorById: vi.fn()
  }
}))

vi.mock('../../services/pharmacist/inventoryService.js', () => ({
  default: {
    getInventoryItems: vi.fn()
  }
}))

import chargeCalculationService from '../../services/pharmacist/chargeCalculationService.js'
import firebaseStorage from '../../services/firebaseStorage.js'
import inventoryService from '../../services/pharmacist/inventoryService.js'

describe('Price consistency between doctor expected and pharmacy final', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('matches total charge within delta 1 with no rounding', async () => {
    const doctor = {
      id: 'doc-1',
      consultationCharge: 100,
      hospitalCharge: 50,
      roundingPreference: 'none',
      currency: 'USD'
    }

    const pharmacist = {
      id: 'ph-1',
      pharmacyId: 'ph-1',
      currency: 'USD'
    }

    const inventoryItems = [
      {
        id: 'inv-1',
        drugName: 'Amoxicillin',
        brandName: 'Amoxicillin',
        genericName: 'Amoxicillin',
        currentStock: 100,
        sellingPrice: 2
      }
    ]

    const prescription = {
      id: 'rx-1',
      doctorId: 'doc-1',
      discount: 0,
      discountScope: 'consultation',
      prescriptions: [
        {
          id: 'rx-1',
          medications: [
            {
              name: 'Amoxicillin',
              dosage: '500mg',
              frequency: 'Once daily (OD)',
              duration: '5 days',
              amount: 10,
              isDispensed: true
            }
          ]
        }
      ]
    }

    firebaseStorage.getDoctorById.mockResolvedValue(doctor)
    inventoryService.getInventoryItems.mockResolvedValue(inventoryItems)

    const expected = chargeCalculationService.calculateExpectedChargeFromStock(
      prescription,
      doctor,
      inventoryItems,
      {
        roundingPreference: 'none',
        currency: 'USD',
        ignoreAvailability: false,
        assumeDispensedForAvailable: true
      }
    )

    const finalBill = await chargeCalculationService.calculatePrescriptionCharge(prescription, pharmacist)

    const delta = Math.abs((expected?.totalCharge ?? 0) - (finalBill?.totalCharge ?? 0))
    expect(delta).toBeLessThanOrEqual(1)
  })
})
