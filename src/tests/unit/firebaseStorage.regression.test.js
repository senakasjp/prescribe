/**
 * Regression tests for FirebaseStorage critical flows
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  collection,
  doc,
  addDoc,
  setDoc,
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
  setDoc: vi.fn(),
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

  it('creates pharmacist with inherited currency when provided', async () => {
    addDoc.mockResolvedValue({ id: 'ph-1' })
    getDocs.mockResolvedValue({ empty: true, docs: [] })

    await firebaseStorage.createPharmacist({
      email: 'pharmacy@example.com',
      password: 'secret',
      role: 'pharmacist',
      businessName: 'City Pharmacy',
      pharmacistNumber: 'PH1234',
      currency: 'LKR'
    })

    const addDocPayload = addDoc.mock.calls[0]?.[1]
    expect(addDocPayload.currency).toBe('LKR')
  })

  it('resolves pharmacist currency from country when missing', async () => {
    addDoc.mockResolvedValue({ id: 'ph-2' })
    getDocs.mockResolvedValue({ empty: true, docs: [] })

    await firebaseStorage.createPharmacist({
      email: 'pharmacy2@example.com',
      password: 'secret',
      role: 'pharmacist',
      businessName: 'Coastal Pharmacy',
      pharmacistNumber: 'PH2222',
      country: 'Sri Lanka'
    })

    const addDocPayload = addDoc.mock.calls[0]?.[1]
    expect(addDocPayload.currency).toBe('LKR')
  })

  it('reuses existing pharmacist when creating with duplicate email', async () => {
    getDocs
      .mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'ph-existing',
            data: () => ({
              email: 'dupe@example.com',
              emailNormalized: 'dupe@example.com',
              createdAt: '2026-02-01T00:00:00.000Z',
              deleteCode: '123456',
              pharmacyIdShort: 'PH0001'
            })
          }
        ]
      })
      .mockResolvedValueOnce({ empty: true, docs: [] })

    const result = await firebaseStorage.createPharmacist({
      email: 'DUPE@example.com',
      password: 'secret',
      role: 'pharmacist',
      businessName: 'Duplicate Pharmacy',
      pharmacistNumber: 'PH5555'
    })

    expect(result.id).toBe('ph-existing')
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('reuses existing doctor when creating with duplicate email', async () => {
    getDocs
      .mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'doc-existing',
            data: () => ({
              email: 'dupe.doctor@example.com',
              emailLower: 'dupe.doctor@example.com',
              createdAt: '2026-02-01T00:00:00.000Z',
              deleteCode: '123456',
              doctorIdShort: 'DR12345'
            })
          }
        ]
      })
      .mockResolvedValueOnce({ empty: true, docs: [] })

    const result = await firebaseStorage.createDoctor({
      email: 'DUPE.DOCTOR@EXAMPLE.COM',
      firstName: 'Dupe',
      lastName: 'Doctor',
      role: 'doctor'
    })

    expect(result.id).toBe('doc-existing')
    expect(setDoc).not.toHaveBeenCalled()
  })

  it('creates doctor with normalized email as document id', async () => {
    doc.mockImplementation((database, collectionName, documentId) => ({ id: documentId, database, collectionName }))
    getDocs
      .mockResolvedValueOnce({ empty: true, docs: [] })
      .mockResolvedValueOnce({ empty: true, docs: [] })
    getDoc.mockResolvedValue({ exists: () => false })

    await firebaseStorage.createDoctor({
      email: 'Doctor+One@Example.COM',
      firstName: 'Doctor',
      lastName: 'One',
      role: 'doctor',
      uid: 'uid-1'
    })

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'doctor+one@example.com' }),
      expect.objectContaining({
        email: 'doctor+one@example.com',
        emailLower: 'doctor+one@example.com'
      })
    )
    expect(addDoc).not.toHaveBeenCalled()
  })
})
