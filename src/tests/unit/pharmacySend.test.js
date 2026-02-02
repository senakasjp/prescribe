/**
 * Unit tests for pharmacy sending persistence (firebaseStorage)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ path: 'pharmacists/mock' })),
  collection: vi.fn(() => ({ path: 'pharmacists/mock/receivedPrescriptions' })),
  getDocs: vi.fn(() => Promise.resolve({ size: 0, docs: [] })),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-doc' })),
  deleteDoc: vi.fn(() => Promise.resolve())
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

describe('firebaseStorage.savePharmacistPrescriptions', () => {
  let firebaseStorage
  let firestore

  beforeEach(async () => {
    const module = await import('../../services/firebaseStorage.js')
    firebaseStorage = module.default
    firestore = await import('firebase/firestore')
    vi.clearAllMocks()
  })

  it('should add receivedAt when saving prescriptions', async () => {
    const prescriptions = [
      {
        id: 'rx-1',
        doctorId: 'doc-1',
        patientId: 'pat-1',
        createdAt: '2024-01-01T00:00:00.000Z'
      }
    ]

    await firebaseStorage.savePharmacistPrescriptions('pharm-1', prescriptions)

    expect(firestore.addDoc).toHaveBeenCalledTimes(1)
    const payload = firestore.addDoc.mock.calls[0][1]
    expect(payload.receivedAt).toBeDefined()
  })

  it('should prefer sentAt when available', async () => {
    const prescriptions = [
      {
        id: 'rx-2',
        doctorId: 'doc-1',
        patientId: 'pat-1',
        sentAt: '2025-01-02T10:00:00.000Z'
      }
    ]

    await firebaseStorage.savePharmacistPrescriptions('pharm-2', prescriptions)

    const payload = firestore.addDoc.mock.calls[0][1]
    expect(payload.receivedAt).toBe('2025-01-02T10:00:00.000Z')
  })

  it('should preserve pharmacist prescription payload structure', async () => {
    const prescriptions = [
      {
        id: 'rx-struct-1',
        doctorId: 'doc-1',
        doctorName: 'Dr. Test',
        patientId: 'pat-1',
        patientName: 'John Doe',
        discount: 5,
        discountScope: 'consultation',
        prescriptions: [
          {
            id: 'p1',
            medications: [
              { name: 'Amoxicillin', dosage: '500mg', isDispensed: true }
            ],
            procedures: ['ECG'],
            otherProcedurePrice: 0,
            excludeConsultationCharge: false
          }
        ],
        createdAt: '2025-01-01T00:00:00.000Z',
        sentAt: '2025-01-02T10:00:00.000Z',
        status: 'pending'
      }
    ]

    await firebaseStorage.savePharmacistPrescriptions('pharm-3', prescriptions)

    const payload = firestore.addDoc.mock.calls[0][1]
    expect(payload.doctorId).toBe('doc-1')
    expect(payload.doctorName).toBe('Dr. Test')
    expect(payload.patientId).toBe('pat-1')
    expect(payload.patientName).toBe('John Doe')
    expect(payload.discount).toBe(5)
    expect(payload.discountScope).toBe('consultation')
    expect(Array.isArray(payload.prescriptions)).toBe(true)
    expect(payload.prescriptions[0].medications[0].name).toBe('Amoxicillin')
    expect(payload.status).toBe('pending')
  })
})
