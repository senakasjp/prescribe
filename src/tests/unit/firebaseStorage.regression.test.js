/**
 * Regression tests for FirebaseStorage critical flows
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where
} from 'firebase/firestore'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn()
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

describe('FirebaseStorage Regression Coverage', () => {
  let firebaseStorage

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('../../services/firebaseStorage.js')
    firebaseStorage = module.default
  })

  it('queries patients by doctor ID for isolation', async () => {
    getDocs.mockResolvedValue({ docs: [] })

    await firebaseStorage.getPatientsByDoctorId('doc-123')

    expect(where).toHaveBeenCalledWith('doctorId', '==', 'doc-123')
    expect(query).toHaveBeenCalled()
    expect(collection).toHaveBeenCalled()
  })

  it('deduplicates and sorts prescriptions by createdAt', async () => {
    const docs = [
      { id: 'rx-1', data: () => ({ doctorId: 'doc-1', createdAt: '2024-01-01T00:00:00Z' }) },
      { id: 'rx-1', data: () => ({ doctorId: 'doc-1', createdAt: '2024-02-01T00:00:00Z' }) },
      { id: 'rx-2', data: () => ({ doctorId: 'doc-1', createdAt: '2024-03-01T00:00:00Z' }) }
    ]

    getDocs.mockResolvedValue({ size: docs.length, docs })

    const result = await firebaseStorage.getPrescriptionsByDoctorId('doc-1')

    expect(where).toHaveBeenCalledWith('doctorId', '==', 'doc-1')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('rx-2')
    expect(result[1].id).toBe('rx-1')
    expect(result[1].createdAt).toBe('2024-02-01T00:00:00Z')
  })

  it('adds medication to existing prescription', async () => {
    const docRef = { id: 'rx-1' }
    doc.mockReturnValue(docRef)
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ medications: [] })
    })

    await firebaseStorage.addMedicationToPrescription('rx-1', {
      name: 'Amoxicillin',
      dosage: '500mg'
    })

    expect(updateDoc).toHaveBeenCalledWith(
      docRef,
      expect.objectContaining({
        medications: [expect.objectContaining({ name: 'Amoxicillin', dosage: '500mg' })]
      })
    )
  })

  it('creates prescriptions with an empty medications array', async () => {
    addDoc.mockResolvedValue({ id: 'new-prescription-id' })

    await firebaseStorage.createPrescription({
      patientId: 'pat-1',
      doctorId: 'doc-1',
      status: 'draft'
    })

    const addDocPayload = addDoc.mock.calls[0]?.[1]
    expect(addDocPayload.medications).toEqual([])
  })

  it('connects pharmacist to doctor and updates both records', async () => {
    const pharmacist = { id: 'ph-1', pharmacistNumber: '359536', connectedDoctors: [] }
    const doctor = { id: 'doc-1', connectedPharmacists: [] }

    vi.spyOn(firebaseStorage, 'getPharmacistByNumber').mockResolvedValue(pharmacist)
    vi.spyOn(firebaseStorage, 'getDoctorById').mockResolvedValue(doctor)
    vi.spyOn(firebaseStorage, 'updatePharmacist').mockResolvedValue({})
    vi.spyOn(firebaseStorage, 'updateDoctor').mockResolvedValue({})

    await firebaseStorage.connectPharmacistToDoctor('359536', 'doc-1')

    expect(firebaseStorage.updatePharmacist).toHaveBeenCalledWith({
      id: 'ph-1',
      connectedDoctors: ['doc-1']
    })

    expect(firebaseStorage.updateDoctor).toHaveBeenCalledWith({
      id: 'doc-1',
      connectedPharmacists: ['ph-1']
    })
  })
})
