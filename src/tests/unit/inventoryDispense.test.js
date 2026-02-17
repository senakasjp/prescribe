/**
 * Unit tests for inventory stock deduction on dispense
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ path: 'pharmacistStockMovements' })),
  addDoc: vi.fn(() => Promise.resolve({ id: 'movement-1' })),
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

  it('should decrement stock when selling', async () => {
    await inventoryService.updateStockLevel('item-1', 3, inventoryService.MOVEMENT_TYPES.SALE)

    const updatePayload = firestore.updateDoc.mock.calls[0][1]
    expect(updatePayload.currentStock).toEqual({ __op: 'increment', value: -3 })
  })

  it('should normalize negative dispatch quantity to deduction', async () => {
    await inventoryService.updateStockLevel('item-1', -6, inventoryService.MOVEMENT_TYPES.DISPATCH)

    const updatePayload = firestore.updateDoc.mock.calls[0][1]
    expect(updatePayload.currentStock).toEqual({ __op: 'increment', value: -6 })
  })

  it('should parse string dispatch quantity and deduct stock', async () => {
    await inventoryService.updateStockLevel('item-1', '2.5', 'dispatch')

    const updatePayload = firestore.updateDoc.mock.calls[0][1]
    expect(updatePayload.currentStock).toEqual({ __op: 'increment', value: -2.5 })
  })

  it('should increment stock when purchasing', async () => {
    await inventoryService.updateStockLevel('item-1', 7, inventoryService.MOVEMENT_TYPES.PURCHASE)

    const updatePayload = firestore.updateDoc.mock.calls[0][1]
    expect(updatePayload.currentStock).toEqual({ __op: 'increment', value: 7 })
  })

  it('should include lastUpdated timestamp', async () => {
    await inventoryService.updateStockLevel('item-1', 1, inventoryService.MOVEMENT_TYPES.PURCHASE)

    const updatePayload = firestore.updateDoc.mock.calls[0][1]
    expect(typeof updatePayload.lastUpdated).toBe('string')
    expect(updatePayload.lastUpdated.length).toBeGreaterThan(0)
  })

  it('should throw when inventory item does not exist', async () => {
    firestore.getDoc.mockResolvedValueOnce({
      exists: () => false
    })

    await expect(
      inventoryService.updateStockLevel('missing-item', 2, inventoryService.MOVEMENT_TYPES.PURCHASE)
    ).rejects.toThrow('does not exist')

    expect(firestore.updateDoc).not.toHaveBeenCalled()
  })

  it('should record a dispatch movement and deduct stock', async () => {
    await inventoryService.createStockMovement('ph-1', {
      itemId: 'item-1',
      type: inventoryService.MOVEMENT_TYPES.DISPATCH,
      quantity: 4,
      unitCost: 12,
      reference: 'Prescription',
      referenceId: 'rx-1'
    })

    expect(firestore.addDoc).toHaveBeenCalledTimes(1)
    const movementPayload = firestore.addDoc.mock.calls[0][1]
    expect(movementPayload.type).toBe(inventoryService.MOVEMENT_TYPES.DISPATCH)
    expect(movementPayload.quantity).toBe(4)

    const updatePayload = firestore.updateDoc.mock.calls[0][1]
    expect(updatePayload.currentStock).toEqual({ __op: 'increment', value: -4 })
  })

  it.each([
    ['sale', () => inventoryService.MOVEMENT_TYPES.SALE],
    ['expired', () => inventoryService.MOVEMENT_TYPES.EXPIRED],
    ['damaged', () => inventoryService.MOVEMENT_TYPES.DAMAGED],
    ['dispatch-constant', () => inventoryService.MOVEMENT_TYPES.DISPATCH],
    ['dispatch-literal', () => 'dispatch']
  ])('deduction movement type %s should always deduct stock', async (_label, getType) => {
    await inventoryService.updateStockLevel('item-1', 9, getType())

    const updatePayload = firestore.updateDoc.mock.calls[0][1]
    expect(updatePayload.currentStock).toEqual({ __op: 'increment', value: -9 })
  })

  it.each([
    ['purchase', () => inventoryService.MOVEMENT_TYPES.PURCHASE],
    ['adjustment', () => inventoryService.MOVEMENT_TYPES.ADJUSTMENT],
    ['transfer', () => inventoryService.MOVEMENT_TYPES.TRANSFER],
    ['return', () => inventoryService.MOVEMENT_TYPES.RETURN]
  ])('non-deduction movement type %s should add stock', async (_label, getType) => {
    await inventoryService.updateStockLevel('item-1', 9, getType())

    const updatePayload = firestore.updateDoc.mock.calls[0][1]
    expect(updatePayload.currentStock).toEqual({ __op: 'increment', value: 9 })
  })

  it.each([
    ['not-a-number', 'abc'],
    ['empty-string', ''],
    ['undefined', undefined],
    ['null', null]
  ])('invalid quantity %s should apply zero stock change', async (_label, qty) => {
    await inventoryService.updateStockLevel('item-1', qty, inventoryService.MOVEMENT_TYPES.DISPATCH)

    const updatePayload = firestore.updateDoc.mock.calls[0][1]
    expect(updatePayload.currentStock).toEqual({ __op: 'increment', value: 0 })
  })
})
