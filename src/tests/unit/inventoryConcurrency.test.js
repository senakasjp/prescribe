import { beforeEach, describe, expect, it, vi } from 'vitest'
import inventoryService from '../../services/pharmacist/inventoryService.js'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ path: 'pharmacistStockMovements' })),
  addDoc: vi.fn(async () => ({ id: `movement-${Math.random().toString(36).slice(2, 8)}` })),
  doc: vi.fn((_db, _collection, id) => ({ path: `pharmacistInventory/${id}`, id })),
  getDoc: vi.fn(async () => ({
    exists: () => true,
    data: () => ({
      currentStock: 500,
      minimumStock: 5,
      batches: [],
      pharmacistId: 'ph-1',
      drugName: 'Concurrent Drug'
    })
  })),
  updateDoc: vi.fn(async () => {}),
  increment: vi.fn((value) => ({ __op: 'increment', value }))
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

describe('inventoryService concurrent stock movements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies all concurrent dispatch deductions without dropping any update call', async () => {
    await Promise.all([
      inventoryService.createStockMovement('ph-1', {
        itemId: 'item-1',
        type: inventoryService.MOVEMENT_TYPES.DISPATCH,
        quantity: 5,
        reference: 'Prescription',
        referenceId: 'rx-1'
      }),
      inventoryService.createStockMovement('ph-1', {
        itemId: 'item-1',
        type: inventoryService.MOVEMENT_TYPES.DISPATCH,
        quantity: 7,
        reference: 'Prescription',
        referenceId: 'rx-2'
      })
    ])

    const firestore = await import('firebase/firestore')
    expect(firestore.addDoc).toHaveBeenCalledTimes(2)
    expect(firestore.updateDoc).toHaveBeenCalledTimes(2)

    const deltas = firestore.updateDoc.mock.calls.map((call) => call[1].currentStock.value).sort((a, b) => a - b)
    expect(deltas).toEqual([-7, -5])
  })

  it('applies mixed concurrent movement types with correct signed deltas', async () => {
    await Promise.all([
      inventoryService.createStockMovement('ph-1', {
        itemId: 'item-1',
        type: inventoryService.MOVEMENT_TYPES.DISPATCH,
        quantity: 4
      }),
      inventoryService.createStockMovement('ph-1', {
        itemId: 'item-1',
        type: inventoryService.MOVEMENT_TYPES.PURCHASE,
        quantity: 10
      }),
      inventoryService.createStockMovement('ph-1', {
        itemId: 'item-1',
        type: inventoryService.MOVEMENT_TYPES.SALE,
        quantity: 3
      })
    ])

    const firestore = await import('firebase/firestore')
    const deltas = firestore.updateDoc.mock.calls.map((call) => call[1].currentStock.value).sort((a, b) => a - b)
    expect(deltas).toEqual([-4, -3, 10])
  })

  it('normalizes string and negative dispatch quantities deterministically under concurrency', async () => {
    await Promise.all([
      inventoryService.createStockMovement('ph-1', {
        itemId: 'item-1',
        type: inventoryService.MOVEMENT_TYPES.DISPATCH,
        quantity: '-6'
      }),
      inventoryService.createStockMovement('ph-1', {
        itemId: 'item-1',
        type: inventoryService.MOVEMENT_TYPES.DISPATCH,
        quantity: '2'
      })
    ])

    const firestore = await import('firebase/firestore')
    const deltas = firestore.updateDoc.mock.calls.map((call) => call[1].currentStock.value).sort((a, b) => a - b)
    expect(deltas).toEqual([-6, -2])
  })
})
