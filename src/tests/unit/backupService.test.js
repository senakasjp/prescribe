import { describe, it, expect, vi, beforeEach } from 'vitest'

const firestoreMocks = vi.hoisted(() => ({
  setDoc: vi.fn(() => Promise.resolve()),
  getDocs: vi.fn(() => Promise.resolve({ size: 0, docs: [] })),
  doc: vi.fn((...args) => ({ __type: 'doc', args })),
  collection: vi.fn((...args) => ({ __type: 'collection', args })),
  query: vi.fn((...args) => ({ __type: 'query', args })),
  where: vi.fn((...args) => ({ __type: 'where', args }))
}))

const firebaseStorageMocks = vi.hoisted(() => ({
  getPharmacistById: vi.fn(() => Promise.resolve({ pharmacistNumber: '123456' }))
}))

vi.mock('../../firebase-config.js', () => ({
  db: { __test: true }
}))

vi.mock('firebase/firestore', () => ({
  collection: firestoreMocks.collection,
  doc: firestoreMocks.doc,
  setDoc: firestoreMocks.setDoc,
  getDocs: firestoreMocks.getDocs,
  query: firestoreMocks.query,
  where: firestoreMocks.where
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: firebaseStorageMocks
}))

vi.mock('../../services/pharmacist/inventoryService.js', () => ({
  default: {
    getInventoryItems: vi.fn(() => Promise.resolve([]))
  }
}))

import backupService from '../../services/backupService.js'

describe('backupService.restorePharmacistBackup (unit)', () => {
  beforeEach(() => {
    firestoreMocks.setDoc.mockClear()
    firestoreMocks.getDocs.mockClear()
    firestoreMocks.doc.mockClear()
    firestoreMocks.collection.mockClear()
    firestoreMocks.query.mockClear()
    firestoreMocks.where.mockClear()
    firebaseStorageMocks.getPharmacistById.mockClear()
  })

  it('writes restored items with pharmacistId, pharmacyId, and pharmacistNumber', async () => {
    const pharmacistId = 'pharm-123'
    const backup = {
      type: 'pharmacist',
      pharmacist: { id: 'old', pharmacistNumber: '999999' },
      pharmacyUsers: [{ id: 'user-1', pharmacyId: 'old' }],
      inventoryItems: [
        { id: 'item-1', brandName: 'Drug A' },
        { brandName: 'Drug B' }
      ],
      receivedPrescriptions: [{ id: 'rx-1' }]
    }

    await backupService.restorePharmacistBackup(pharmacistId, backup)

    const payloads = firestoreMocks.setDoc.mock.calls.map((call) => call[1])
    const inventoryPayloads = payloads.filter((p) => p?.brandName)

    expect(inventoryPayloads.length).toBe(4)
    inventoryPayloads.forEach((payload) => {
      expect(payload.pharmacistId).toBe(pharmacistId)
      expect(payload.pharmacyId).toBe(pharmacistId)
      expect(payload.pharmacistNumber).toBe('123456')
    })
  })
})
