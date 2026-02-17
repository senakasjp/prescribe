/**
 * Unit tests for inventory low-stock alerts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ path: 'pharmacistInventory/item-1' })),
  getDoc: vi.fn(() => Promise.resolve({
    exists: () => true,
    data: () => ({
      drugName: 'Amoxicillin',
      currentStock: 4,
      minimumStock: 5,
      pharmacistId: 'pharm-1'
    })
  })),
  collection: vi.fn((_, name) => ({ path: name })),
  addDoc: vi.fn(() => Promise.resolve({ id: 'alert-1' }))
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

describe('inventoryService.checkStockAlerts', () => {
  let inventoryService
  let firestore

  beforeEach(async () => {
    const module = await import('../../services/pharmacist/inventoryService.js')
    inventoryService = module.default
    firestore = await import('firebase/firestore')
    vi.clearAllMocks()
  })

  it('creates low-stock alert when current stock is below minimum', async () => {
    await inventoryService.checkStockAlerts('item-1')

    expect(firestore.addDoc).toHaveBeenCalledTimes(1)
    const alertPayload = firestore.addDoc.mock.calls[0][1]
    expect(alertPayload.type).toBe(inventoryService.ALERT_TYPES.LOW_STOCK)
    expect(alertPayload.itemId).toBe('item-1')
    expect(alertPayload.pharmacistId).toBe('pharm-1')
    expect(alertPayload.message).toContain('running low')
  })
})
