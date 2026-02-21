import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDocs = vi.hoisted(() => vi.fn())

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: mockGetDocs,
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  writeBatch: vi.fn(),
  onSnapshot: vi.fn()
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

describe('firebaseStorage prescription read normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normalizes legacy packet ml strength into total volume in patient prescription reads', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{
        id: 'rx-1',
        data: () => ({
          createdAt: '2026-01-01T00:00:00.000Z',
          medications: [{
            name: 'ORS-Jeevanee',
            dosageForm: 'packet',
            strength: '1000',
            strengthUnit: 'ml'
          }]
        })
      }]
    })

    const module = await import('../../services/firebaseStorage.js')
    const result = await module.default.getPrescriptionsByPatientId('patient-1')
    const medication = result[0].medications[0]

    expect(medication.dosageForm).toBe('Packet')
    expect(medication.totalVolume).toBe('1000')
    expect(medication.volumeUnit).toBe('ml')
    expect(medication.strength).toBe('')
    expect(medication.strengthUnit).toBe('')
  })

  it('keeps liquid (bottles) strength while normalizing dosage-form alias in doctor prescription reads', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{
        id: 'rx-2',
        data: () => ({
          createdAt: '2026-01-02T00:00:00.000Z',
          medications: [{
            name: 'Salbutamol',
            dosageForm: 'liquid',
            strength: '5',
            strengthUnit: 'ml'
          }]
        })
      }]
    })

    const module = await import('../../services/firebaseStorage.js')
    const result = await module.default.getPrescriptionsByDoctorId('doctor-1')
    const medication = result[0].medications[0]

    expect(medication.dosageForm).toBe('Liquid (bottles)')
    expect(medication.strength).toBe('5')
    expect(medication.strengthUnit).toBe('ml')
  })
})
