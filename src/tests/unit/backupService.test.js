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
  getDoctorById: vi.fn(() => Promise.resolve(null)),
  getPatientsByDoctorId: vi.fn(() => Promise.resolve([])),
  getSymptomsByPatientId: vi.fn(() => Promise.resolve([])),
  getIllnessesByPatientId: vi.fn(() => Promise.resolve([])),
  getPrescriptionsByPatientId: vi.fn(() => Promise.resolve([])),
  getLongTermMedicationsByPatientId: vi.fn(() => Promise.resolve([])),
  getReportsByPatientId: vi.fn(() => Promise.resolve([])),
  getDoctorReport: vi.fn(() => Promise.resolve(null)),
  getPharmacistById: vi.fn(() => Promise.resolve({ pharmacistNumber: '123456' })),
  getPharmacistByUid: vi.fn(() => Promise.resolve(null)),
  getPharmacistByEmail: vi.fn(() => Promise.resolve(null)),
  getPharmacyUsersByPharmacyId: vi.fn(() => Promise.resolve([])),
  getPharmacistPrescriptions: vi.fn(() => Promise.resolve([]))
}))

const inventoryServiceMocks = vi.hoisted(() => ({
  getInventoryItems: vi.fn(() => Promise.resolve([]))
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
  default: inventoryServiceMocks
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
    firebaseStorageMocks.getDoctorById.mockClear()
    firebaseStorageMocks.getPatientsByDoctorId.mockClear()
    firebaseStorageMocks.getSymptomsByPatientId.mockClear()
    firebaseStorageMocks.getIllnessesByPatientId.mockClear()
    firebaseStorageMocks.getPrescriptionsByPatientId.mockClear()
    firebaseStorageMocks.getLongTermMedicationsByPatientId.mockClear()
    firebaseStorageMocks.getReportsByPatientId.mockClear()
    firebaseStorageMocks.getDoctorReport.mockClear()
    firebaseStorageMocks.getPharmacistById.mockClear()
    firebaseStorageMocks.getPharmacistByUid.mockClear()
    firebaseStorageMocks.getPharmacistByEmail.mockClear()
    firebaseStorageMocks.getPharmacyUsersByPharmacyId.mockClear()
    firebaseStorageMocks.getPharmacistPrescriptions.mockClear()
    inventoryServiceMocks.getInventoryItems.mockClear()
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

describe('backupService.exportDoctorBackup (unit)', () => {
  beforeEach(() => {
    firebaseStorageMocks.getDoctorById.mockReset()
    firebaseStorageMocks.getPatientsByDoctorId.mockReset()
    firebaseStorageMocks.getSymptomsByPatientId.mockReset()
    firebaseStorageMocks.getIllnessesByPatientId.mockReset()
    firebaseStorageMocks.getPrescriptionsByPatientId.mockReset()
    firebaseStorageMocks.getLongTermMedicationsByPatientId.mockReset()
    firebaseStorageMocks.getReportsByPatientId.mockReset()
    firebaseStorageMocks.getDoctorReport.mockReset()
    firebaseStorageMocks.getPharmacistById.mockReset()
    firebaseStorageMocks.getPharmacistByUid.mockReset()
    firebaseStorageMocks.getPharmacistByEmail.mockReset()
    firebaseStorageMocks.getPharmacyUsersByPharmacyId.mockReset()
    firebaseStorageMocks.getPharmacistPrescriptions.mockReset()
    inventoryServiceMocks.getInventoryItems.mockReset()
  })

  it('includes pharmacy backup when doctor owns a pharmacy', async () => {
    firebaseStorageMocks.getDoctorById.mockResolvedValue({ id: 'doc-1', email: 'doc@example.com' })
    firebaseStorageMocks.getPatientsByDoctorId.mockResolvedValue([{ id: 'p-1' }])
    firebaseStorageMocks.getSymptomsByPatientId.mockResolvedValue([{ id: 's-1' }])
    firebaseStorageMocks.getIllnessesByPatientId.mockResolvedValue([{ id: 'i-1' }])
    firebaseStorageMocks.getPrescriptionsByPatientId.mockResolvedValue([{ id: 'm-1' }])
    firebaseStorageMocks.getLongTermMedicationsByPatientId.mockResolvedValue([{ id: 'ltm-1' }])
    firebaseStorageMocks.getReportsByPatientId.mockResolvedValue([{ id: 'r-1' }])
    firebaseStorageMocks.getDoctorReport.mockResolvedValue({ id: 'doc-1', overview: 'ok' })
    firebaseStorageMocks.getPharmacistById.mockResolvedValueOnce(null).mockResolvedValue({ id: 'ph-1', email: 'doc@example.com' })
    firebaseStorageMocks.getPharmacistByUid.mockResolvedValue(null)
    firebaseStorageMocks.getPharmacistByEmail.mockResolvedValue({ id: 'ph-1', email: 'doc@example.com' })
    firebaseStorageMocks.getPharmacyUsersByPharmacyId.mockResolvedValue([{ id: 'u-1', pharmacyId: 'ph-1' }])
    firebaseStorageMocks.getPharmacistPrescriptions.mockResolvedValue([{ id: 'rx-1' }])
    inventoryServiceMocks.getInventoryItems.mockResolvedValue([{ id: 'inv-1', pharmacistId: 'ph-1' }])

    const backup = await backupService.exportDoctorBackup('doc-1')

    expect(backup.patients).toHaveLength(1)
    expect(backup.symptoms).toHaveLength(1)
    expect(backup.illnesses).toHaveLength(1)
    expect(backup.prescriptions).toHaveLength(1)
    expect(backup.longTermMedications).toHaveLength(1)
    expect(backup.reports).toHaveLength(1)
    expect(backup.pharmacyBackup).toBeTruthy()
    expect(backup.pharmacyBackup).toMatchObject({
      pharmacistId: 'ph-1'
    })
    expect(backup.pharmacyBackup.inventoryItems).toHaveLength(1)
  })

  it('omits pharmacy backup when doctor does not own a pharmacy', async () => {
    firebaseStorageMocks.getDoctorById.mockResolvedValue({ id: 'doc-2', email: 'doc2@example.com' })
    firebaseStorageMocks.getPatientsByDoctorId.mockResolvedValue([{ id: 'p-1' }])
    firebaseStorageMocks.getSymptomsByPatientId.mockResolvedValue([])
    firebaseStorageMocks.getIllnessesByPatientId.mockResolvedValue([])
    firebaseStorageMocks.getPrescriptionsByPatientId.mockResolvedValue([])
    firebaseStorageMocks.getLongTermMedicationsByPatientId.mockResolvedValue([])
    firebaseStorageMocks.getReportsByPatientId.mockResolvedValue([])
    firebaseStorageMocks.getDoctorReport.mockResolvedValue(null)
    firebaseStorageMocks.getPharmacistById.mockResolvedValue(null)
    firebaseStorageMocks.getPharmacistByUid.mockResolvedValue(null)
    firebaseStorageMocks.getPharmacistByEmail.mockResolvedValue(null)

    const backup = await backupService.exportDoctorBackup('doc-2')

    expect(backup.pharmacyBackup).toBeUndefined()
  })
})

describe('backupService.exportPharmacistBackup (unit)', () => {
  beforeEach(() => {
    firebaseStorageMocks.getPharmacistById.mockReset()
    firebaseStorageMocks.getPharmacyUsersByPharmacyId.mockReset()
    firebaseStorageMocks.getPharmacistPrescriptions.mockReset()
    inventoryServiceMocks.getInventoryItems.mockReset()
  })

  it('exports inventory-only pharmacy backup payload', async () => {
    inventoryServiceMocks.getInventoryItems.mockResolvedValue([
      { id: 'inv-1', pharmacistId: 'ph-1', brandName: 'Drug A' }
    ])

    const backup = await backupService.exportPharmacistBackup('ph-1')

    expect(backup.type).toBe('pharmacist')
    expect(backup.pharmacistId).toBe('ph-1')
    expect(backup.inventoryItems).toHaveLength(1)
    expect(backup.pharmacyUsers).toBeUndefined()
    expect(backup.receivedPrescriptions).toBeUndefined()
    expect(backup.pharmacist).toBeUndefined()
  })
})
