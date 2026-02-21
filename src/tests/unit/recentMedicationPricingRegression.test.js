import { describe, it, expect, vi, beforeEach } from 'vitest'
import inventoryService from '../../services/pharmacist/inventoryService.js'
import chargeCalculationService from '../../services/pharmacist/chargeCalculationService.js'

vi.mock('../../services/pharmacist/inventoryService.js', () => ({
  default: {
    getInventoryItems: vi.fn()
  }
}))

describe('recent medication pricing regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guard: Liquid (measured) accepts direct per-ml inventory selling price even without pack-size metadata', async () => {
    // What this protects:
    // Measured-liquid inventory can be modeled as "sellingPrice per ml".
    // We must not require pack-size conversion metadata for this path.
    inventoryService.getInventoryItems.mockResolvedValue([
      {
        id: 'm1',
        brandName: 'Antipa',
        dosageForm: 'Liquid (measured)',
        currentStock: 200,
        unit: 'ml',
        sellingPrice: 20
      }
    ])

    const prescription = {
      id: 'rx-measured-direct-per-ml',
      prescriptions: [
        {
          id: 'rx-measured-direct-per-ml',
          medications: [
            {
              name: 'Antipa',
              dosageForm: 'Liquid (measured)',
              strength: '5',
              strengthUnit: 'ml',
              frequency: 'Four times daily (QDS)',
              duration: '1 days',
              isDispensed: true
            }
          ]
        }
      ]
    }

    const result = await chargeCalculationService.calculateDrugCharges(prescription, { id: 'ph-1' })

    // 5 ml * 4/day * 1 day = 20 ml requested.
    // Unit cost is direct per-ml value = 20.
    expect(result.totalCost).toBe(400)
    expect(result.medicationBreakdown[0].quantity).toBe(20)
    expect(result.medicationBreakdown[0].unitCost).toBe(20)
    expect(result.medicationBreakdown[0].found).toBe(true)
  })

  it('guard: Liquid (bottles) uses bottle-count amount and never converts to per-ml pricing', async () => {
    // What this protects:
    // Bottle-based liquids must price as count * sellingPrice-per-bottle,
    // even if strength/unit metadata contains ml.
    inventoryService.getInventoryItems.mockResolvedValue([
      {
        id: 'b1',
        brandName: 'Corex',
        dosageForm: 'Liquid (bottles)',
        strength: '100',
        strengthUnit: 'ml',
        currentStock: 5,
        sellingPrice: 20
      }
    ])

    const prescription = {
      id: 'rx-bottle-count-pricing',
      prescriptions: [
        {
          id: 'rx-bottle-count-pricing',
          medications: [
            {
              name: 'Corex',
              dosageForm: 'Liquid (bottles)',
              amount: '2',
              // These fields should NOT drive ml-derived quantity for bottle pricing.
              strength: '5',
              strengthUnit: 'ml',
              frequency: 'Three times daily (TDS)',
              duration: '5 days',
              isDispensed: true
            }
          ]
        }
      ]
    }

    const result = await chargeCalculationService.calculateDrugCharges(prescription, { id: 'ph-1' })

    expect(result.totalCost).toBe(40)
    expect(result.medicationBreakdown[0].quantity).toBe(2)
    expect(result.medicationBreakdown[0].unitCost).toBe(20)
    expect(result.medicationBreakdown[0].found).toBe(true)
  })

  it('guard: pricing failure reason distinguishes missing-price from not-in-inventory', async () => {
    // What this protects:
    // Dashboard should explain why pricing failed, not collapse everything into "Not available".
    inventoryService.getInventoryItems.mockResolvedValue([
      {
        id: 'x1',
        brandName: 'Antipa',
        dosageForm: 'Liquid (measured)',
        currentStock: 200,
        sellingPrice: ''
      }
    ])

    const prescription = {
      id: 'rx-missing-price-reason',
      prescriptions: [
        {
          id: 'rx-missing-price-reason',
          medications: [
            {
              name: 'Antipa',
              dosageForm: 'Liquid (measured)',
              strength: '5',
              strengthUnit: 'ml',
              frequency: 'Twice daily (BD)',
              duration: '1 days',
              isDispensed: true
            },
            {
              name: 'NoSuchDrug',
              dosageForm: 'Tablet',
              amount: '1',
              isDispensed: true
            }
          ]
        }
      ]
    }

    const result = await chargeCalculationService.calculateDrugCharges(prescription, { id: 'ph-1' })
    const byName = Object.fromEntries(result.medicationBreakdown.map((row) => [row.medicationName, row]))

    expect(byName.Antipa.note).toBe('Price missing in inventory')
    expect(byName.NoSuchDrug.note).toBe('Not available in inventory')
  })
})
