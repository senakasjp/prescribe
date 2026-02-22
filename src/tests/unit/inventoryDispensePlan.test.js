import { describe, it, expect } from 'vitest'
import { buildInventoryDispensePlan, resolveDispenseQuantity } from '../../utils/inventoryDispensePlan.js'

describe('inventoryDispensePlan', () => {
  it('uses allocated matches when available', () => {
    const plan = buildInventoryDispensePlan({
      inventoryData: { matches: [{ inventoryItemId: 'item-a' }] },
      allocationPreview: {
        orderedMatches: [
          { inventoryItemId: 'item-a', allocated: 2 },
          { inventoryItemId: 'item-b', allocated: 1 }
        ]
      },
      fallbackQuantity: 5
    })

    expect(plan).toEqual([
      { inventoryItemId: 'item-a', batchId: null, quantity: 2 },
      { inventoryItemId: 'item-b', batchId: null, quantity: 1 }
    ])
  })

  it('falls back to inventory item id with parsed quantity', () => {
    const plan = buildInventoryDispensePlan({
      inventoryData: { inventoryItemId: 'item-x', matches: [] },
      allocationPreview: { orderedMatches: [] },
      fallbackQuantity: '1/2'
    })

    expect(plan).toEqual([{ inventoryItemId: 'item-x', quantity: 0.5 }])
  })

  it('parses fractional dosage values', () => {
    expect(resolveDispenseQuantity('1/4')).toBeCloseTo(0.25, 5)
    expect(resolveDispenseQuantity('1 1/2')).toBeCloseTo(1.5, 5)
  })
})
