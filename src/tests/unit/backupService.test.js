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
      pharmacistId,
      pharmacist: { id: 'old', pharmacistNumber: '999999' },
      pharmacyUsers: [{ id: 'user-1', pharmacyId: pharmacistId }],
      inventoryItems: [
        { id: 'item-1', brandName: 'Drug A', pharmacistId },
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

  it('uses merge=true by default for conflict-safe restore writes', async () => {
    const pharmacistId = 'pharm-1'
    const backup = {
      type: 'pharmacist',
      pharmacistId,
      pharmacist: { id: 'old', pharmacistNumber: '999999' },
      pharmacyUsers: [{ id: 'user-1', pharmacyId: pharmacistId }],
      inventoryItems: [{ id: 'item-1', brandName: 'Drug A', pharmacistId }],
      receivedPrescriptions: [{ id: 'rx-1' }]
    }

    await backupService.restorePharmacistBackup(pharmacistId, backup)

    const options = firestoreMocks.setDoc.mock.calls.map((call) => call[2]).filter(Boolean)
    expect(options.length).toBeGreaterThan(0)
    expect(options.every((opt) => opt.merge === true)).toBe(true)
  })

  it('uses replace semantics when merge=false is provided', async () => {
    const pharmacistId = 'pharm-1'
    const backup = {
      type: 'pharmacist',
      pharmacistId,
      pharmacist: { id: 'old', pharmacistNumber: '999999' },
      pharmacyUsers: [{ id: 'user-1', pharmacyId: pharmacistId }],
      inventoryItems: [{ id: 'item-1', brandName: 'Drug A', pharmacistId }],
      receivedPrescriptions: [{ id: 'rx-1' }]
    }

    await backupService.restorePharmacistBackup(pharmacistId, backup, { merge: false })

    const options = firestoreMocks.setDoc.mock.calls.map((call) => call[2]).filter(Boolean)
    const hasNonMergeTrueOptions = options.some((opt) => opt.merge !== true)
    expect(hasNonMergeTrueOptions).toBe(true)
  })

  it('fails fast on write error and does not continue with remaining writes', async () => {
    const pharmacistId = 'pharm-1'
    const backup = {
      type: 'pharmacist',
      pharmacistId,
      pharmacist: { id: 'old', pharmacistNumber: '999999' },
      pharmacyUsers: [
        { id: 'user-1', pharmacyId: pharmacistId },
        { id: 'user-2', pharmacyId: pharmacistId }
      ],
      inventoryItems: [{ id: 'item-1', brandName: 'Drug A', pharmacistId }],
      receivedPrescriptions: [{ id: 'rx-1' }]
    }
    firestoreMocks.setDoc
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('simulated write failure'))

    await expect(
      backupService.restorePharmacistBackup('pharm-1', backup)
    ).rejects.toThrow('simulated write failure')

    expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(2)
  })

  it('rejects restore when backup pharmacistId does not match target pharmacist', async () => {
    const backup = {
      type: 'pharmacist',
      pharmacistId: 'pharm-source',
      pharmacist: { id: 'old', pharmacistNumber: '999999' },
      pharmacyUsers: [],
      inventoryItems: [],
      receivedPrescriptions: []
    }

    await expect(
      backupService.restorePharmacistBackup('pharm-target', backup)
    ).rejects.toThrow('Backup pharmacistId mismatch')
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled()
  })

  it('rejects oversized backup payload before writes', async () => {
    const backup = {
      type: 'pharmacist',
      pharmacistId: 'pharm-1',
      pharmacist: { id: 'old', pharmacistNumber: '999999' },
      pharmacyUsers: [],
      inventoryItems: [],
      receivedPrescriptions: [],
      oversized: 'A'.repeat(11 * 1024 * 1024)
    }

    await expect(
      backupService.restorePharmacistBackup('pharm-1', backup)
    ).rejects.toThrow('Backup payload too large')
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled()
  })
})
