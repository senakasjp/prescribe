import { beforeEach, describe, expect, it, vi } from 'vitest'

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(() => ({ path: 'authLogs' })),
  addDoc: vi.fn(async () => ({ id: 'log-1' })),
  getDocs: vi.fn(async () => ({ size: 0, docs: [] })),
  query: vi.fn((...args) => ({ args })),
  orderBy: vi.fn((...args) => ({ args })),
  limit: vi.fn((value) => ({ value })),
  writeBatch: vi.fn(() => ({
    delete: vi.fn(),
    commit: vi.fn(async () => {})
  })),
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  where: vi.fn(),
  addDocCalls: []
}))

vi.mock('firebase/firestore', () => ({
  collection: firestoreMocks.collection,
  addDoc: firestoreMocks.addDoc,
  getDocs: firestoreMocks.getDocs,
  query: firestoreMocks.query,
  orderBy: firestoreMocks.orderBy,
  limit: firestoreMocks.limit,
  writeBatch: firestoreMocks.writeBatch,
  doc: firestoreMocks.doc,
  getDoc: firestoreMocks.getDoc,
  updateDoc: firestoreMocks.updateDoc,
  setDoc: firestoreMocks.setDoc,
  deleteDoc: firestoreMocks.deleteDoc,
  where: firestoreMocks.where,
  onSnapshot: vi.fn(),
  increment: vi.fn((value) => ({ value })),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn()
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

describe('firebaseStorage audit log integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds auth logs with required integrity fields and createdAt timestamp', async () => {
    const { default: firebaseStorage } = await import('../../services/firebaseStorage.js')
    const result = await firebaseStorage.addAuthLog({
      action: 'login',
      role: 'doctor',
      email: 'doctor@example.com',
      doctorId: 'doc-1',
      status: 'success'
    })

    expect(result).toBe(true)
    expect(firestoreMocks.addDoc).toHaveBeenCalledTimes(1)
    const payload = firestoreMocks.addDoc.mock.calls[0][1]
    expect(payload.action).toBe('login')
    expect(payload.role).toBe('doctor')
    expect(payload.email).toBe('doctor@example.com')
    expect(payload.doctorId).toBe('doc-1')
    expect(payload.status).toBe('success')
    expect(typeof payload.createdAt).toBe('string')
    expect(Number.isNaN(Date.parse(payload.createdAt))).toBe(false)
  })

  it('returns false when auth log write fails', async () => {
    firestoreMocks.addDoc.mockRejectedValueOnce(new Error('write failed'))
    const { default: firebaseStorage } = await import('../../services/firebaseStorage.js')

    const result = await firebaseStorage.addAuthLog({
      action: 'logout',
      role: 'doctor',
      email: 'doctor@example.com',
      doctorId: 'doc-1',
      status: 'success'
    })

    expect(result).toBe(false)
  })
})
