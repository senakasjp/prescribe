import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((arg1, arg2) => {
    if (arg2) return { path: `${arg1.path}/${arg2}` }
    return { path: String(arg1) }
  }),
  doc: vi.fn((_db, collectionName, id) => ({ path: `${collectionName}/${id}` })),
  addDoc: vi.fn(async () => ({ id: 'added-1' })),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [], size: 0, empty: true })),
  updateDoc: vi.fn(async () => {}),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  query: vi.fn((...args) => ({ args })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  orderBy: vi.fn(),
  limit: vi.fn(),
  writeBatch: vi.fn(),
  onSnapshot: vi.fn()
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

describe('security: tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scopes patient queries by doctorId', async () => {
    const firebaseStorage = (await import('../../services/firebaseStorage.js')).default
    const firestore = await import('firebase/firestore')

    await firebaseStorage.getPatientsByDoctorId('doctor-A')

    expect(firestore.where).toHaveBeenCalledWith('doctorId', '==', 'doctor-A')
    expect(firestore.query).toHaveBeenCalled()
  })

  it('rejects unscoped patient fetch when doctorId is missing', async () => {
    const firebaseStorage = (await import('../../services/firebaseStorage.js')).default

    await expect(firebaseStorage.getPatients('')).rejects.toThrow('Doctor ID is required to access patients')
  })

  it('reads pharmacist prescriptions only from that pharmacist subcollection', async () => {
    const firebaseStorage = (await import('../../services/firebaseStorage.js')).default
    const firestore = await import('firebase/firestore')

    await firebaseStorage.getPharmacistPrescriptions('pharmacist-123')

    expect(firestore.doc).toHaveBeenCalledWith({}, 'pharmacists', 'pharmacist-123')
    expect(firestore.collection).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'pharmacists/pharmacist-123' }),
      'receivedPrescriptions'
    )
  })

  it('writes pharmacist prescriptions only into the provided pharmacist tenant path', async () => {
    const firebaseStorage = (await import('../../services/firebaseStorage.js')).default
    const firestore = await import('firebase/firestore')

    await firebaseStorage.savePharmacistPrescriptions('pharmacist-abc', [
      { id: 'rx-1', sentAt: '2026-02-13T00:00:00.000Z' }
    ])

    const addDocPaths = firestore.addDoc.mock.calls.map((call) => call[0]?.path)
    expect(addDocPaths.every((path) => path === 'pharmacists/pharmacist-abc/receivedPrescriptions')).toBe(true)
    expect(addDocPaths.some((path) => String(path || '').includes('pharmacist-other'))).toBe(false)
  })
})
