import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDocs } from 'firebase/firestore'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ path: 'pharmacistInventory' })),
  doc: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(() => ({ kind: 'query' })),
  where: vi.fn(() => ({ kind: 'where' })),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
  increment: vi.fn(),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn()
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

describe('inventory primary key uniqueness', () => {
  let inventoryService

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('../../services/pharmacist/inventoryService.js')
    inventoryService = module.default
  })

  it('treats same brand/strength/unit/expiry but different selling price as non-duplicate', async () => {
    getDocs.mockResolvedValueOnce({
      forEach: (cb) => {
        cb({
          id: 'item-1',
          data: () => ({
            pharmacistId: 'pharm-1',
            brandName: 'Amoxicillin',
            strength: '500',
            strengthUnit: 'mg',
            expiryDate: '2027-01-01',
            sellingPrice: 100
          })
        })
      }
    })

    await expect(
      inventoryService.checkDuplicatePrimaryKey(
        'pharm-1',
        'Amoxicillin',
        '500',
        'mg',
        '2027-01-01',
        120
      )
    ).resolves.toBe(false)
  })

  it('rejects duplicate when selling price is also identical', async () => {
    getDocs.mockResolvedValueOnce({
      forEach: (cb) => {
        cb({
          id: 'item-1',
          data: () => ({
            pharmacistId: 'pharm-1',
            brandName: 'Amoxicillin',
            strength: '500',
            strengthUnit: 'mg',
            expiryDate: '2027-01-01',
            sellingPrice: '100'
          })
        })
      }
    })

    await expect(
      inventoryService.checkDuplicatePrimaryKey(
        'pharm-1',
        'Amoxicillin',
        '500',
        'mg',
        '2027-01-01',
        '100'
      )
    ).rejects.toThrow('brand name + strength + unit + expiry + selling price')
  })
})

