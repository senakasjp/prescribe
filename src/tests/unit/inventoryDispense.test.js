/**
 * Unit tests for inventory stock deduction on dispense
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ path: 'pharmacistInventory/item-1' })),
  getDoc: vi.fn(() => Promise.resolve({
    exists: () => true,
    data: () => ({ currentStock: 20 })
  })),
  updateDoc: vi.fn(() => Promise.resolve()),
  increment: vi.fn((value) => ({ __op: 'increment', value }))
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

describe('inventoryService.updateStockLevel', () => {
  let inventoryService
  let firestore

  beforeEach(async () => {
    const module = await import('../../services/pharmacist/inventoryService.js')
    inventoryService = module.default
    firestore = await import('firebase/firestore')
    vi.clearAllMocks()
  })

  it('should decrement stock when dispensing', async () => {
    await inventoryService.updateStockLevel('item-1', 5, 'dispatch')

    expect(firestore.updateDoc).toHaveBeenCalledTimes(1)
    const updatePayload = firestore.updateDoc.mock.calls[0][1]
    expect(updatePayload.currentStock).toEqual({ __op: 'increment', value: -5 })
  })
})
