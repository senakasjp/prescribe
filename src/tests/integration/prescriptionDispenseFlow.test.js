import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildInventoryDispensePlan } from '../../utils/inventoryDispensePlan.js'
import chargeCalculationService from '../../services/pharmacist/chargeCalculationService.js'
import inventoryService from '../../services/pharmacist/inventoryService.js'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ path: 'pharmacistStockMovements' })),
  addDoc: vi.fn(() => Promise.resolve({ id: 'movement-1' })),
  doc: vi.fn((_db, _collection, id) => ({ path: `pharmacistInventory/${id}`, id })),
  getDoc: vi.fn(() => Promise.resolve({
    exists: () => true,
    data: () => ({
      currentStock: 100,
      minimumStock: 5,
      batches: [],
      pharmacistId: 'ph-1',
      drugName: 'TopiCream'
    })
  })),
  updateDoc: vi.fn(() => Promise.resolve()),
  increment: vi.fn((value) => ({ __op: 'increment', value }))
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

describe('prescription -> dispense inventory flow', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })

  it('allocates FIFO quantities and creates dispatch stock movements for each allocated batch', async () => {
    const inventoryItems = [
      {
        id: 'cream-b1',
        brandName: 'TopiCream',
        dosageForm: 'Cream',
        currentStock: 2,
        sellingPrice: 10,
        expiryDate: '2026-06-01'
      },
      {
        id: 'cream-b2',
        brandName: 'TopiCream',
        dosageForm: 'Cream',
        currentStock: 2,
        sellingPrice: 20,
        expiryDate: '2026-07-01'
      }
    ]

    const medication = {
      id: 'med-1',
      name: 'TopiCream',
      dosageForm: 'Cream',
      qts: '3'
    }

    const pricing = chargeCalculationService.calculateExpectedDrugChargesFromInventory(
      { id: 'rx-1', medications: [medication] },
      inventoryItems
    )

    expect(pricing.totalCost).toBeCloseTo(40, 4)
    expect(pricing.medicationBreakdown).toHaveLength(1)
    expect(pricing.medicationBreakdown[0].allocationDetails).toHaveLength(2)

    const allocationDetails = pricing.medicationBreakdown[0].allocationDetails
    const allocationPreview = {
      orderedMatches: allocationDetails.map((entry) => ({
        inventoryItemId: entry.inventoryItemId,
        allocated: entry.quantity
      }))
    }

    const dispensePlan = buildInventoryDispensePlan({
      inventoryData: { matches: allocationPreview.orderedMatches },
      allocationPreview,
      fallbackQuantity: medication.qts
    })

    expect(dispensePlan).toEqual([
      { inventoryItemId: 'cream-b1', batchId: null, quantity: 2 },
      { inventoryItemId: 'cream-b2', batchId: null, quantity: 1 }
    ])

    for (const entry of dispensePlan) {
      await inventoryService.createStockMovement('ph-1', {
        itemId: entry.inventoryItemId,
        type: inventoryService.MOVEMENT_TYPES.DISPATCH,
        quantity: entry.quantity,
        unitCost: 0,
        reference: 'Prescription',
        referenceId: 'rx-1'
      })
    }

    const firestore = await import('firebase/firestore')
    expect(firestore.addDoc).toHaveBeenCalledTimes(2)
    expect(firestore.updateDoc).toHaveBeenCalledTimes(2)

    const deltas = firestore.updateDoc.mock.calls.map((call) => call[1].currentStock.value)
    expect(deltas).toEqual([-2, -1])
  })
})
