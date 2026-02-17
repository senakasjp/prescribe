/**
 * Firebase Mock Module
 * 
 * Provides mock implementations of Firebase services for testing.
 * This allows tests to run without connecting to real Firebase.
 */

import { vi } from 'vitest'

/**
 * Mock Firestore database
 */
export const mockDb = {
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(() => mockDocRef)
}

/**
 * Mock Firestore collection reference
 */
export const mockCollectionRef = {
  doc: vi.fn(() => mockDocRef),
  add: vi.fn(() => Promise.resolve(mockDocRef)),
  get: vi.fn(() => Promise.resolve(mockQuerySnapshot)),
  where: vi.fn(() => mockQuery),
  orderBy: vi.fn(() => mockQuery),
  limit: vi.fn(() => mockQuery)
}

/**
 * Mock Firestore document reference
 */
export const mockDocRef = {
  id: 'mock-doc-id',
  get: vi.fn(() => Promise.resolve(mockDocSnapshot)),
  set: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  delete: vi.fn(() => Promise.resolve()),
  collection: vi.fn(() => mockCollectionRef),
  onSnapshot: vi.fn((callback) => {
    callback(mockDocSnapshot)
    return vi.fn() // Return unsubscribe function
  })
}

/**
 * Mock Firestore document snapshot
 */
export const mockDocSnapshot = {
  id: 'mock-doc-id',
  exists: () => true,
  data: vi.fn(() => ({
    id: 'mock-doc-id',
    name: 'Test Document',
    createdAt: new Date().toISOString()
  }))
}

/**
 * Mock Firestore query snapshot
 */
export const mockQuerySnapshot = {
  empty: false,
  size: 1,
  docs: [mockDocSnapshot],
  forEach: vi.fn((callback) => {
    [mockDocSnapshot].forEach(callback)
  })
}

/**
 * Mock Firestore query
 */
export const mockQuery = {
  get: vi.fn(() => Promise.resolve(mockQuerySnapshot)),
  where: vi.fn(() => mockQuery),
  orderBy: vi.fn(() => mockQuery),
  limit: vi.fn(() => mockQuery),
  onSnapshot: vi.fn((callback) => {
    callback(mockQuerySnapshot)
    return vi.fn() // Return unsubscribe function
  })
}

/**
 * Mock Firebase Auth
 */
export const mockAuth = {
  currentUser: null,
  signInWithEmailAndPassword: vi.fn(() => 
    Promise.resolve({
      user: {
        uid: 'mock-user-id',
        email: 'test@example.com',
        displayName: 'Test User'
      }
    })
  ),
  createUserWithEmailAndPassword: vi.fn(() =>
    Promise.resolve({
      user: {
        uid: 'mock-user-id',
        email: 'test@example.com',
        displayName: 'Test User'
      }
    })
  ),
  signOut: vi.fn(() => Promise.resolve()),
  onAuthStateChanged: vi.fn((callback) => {
    callback(null)
    return vi.fn() // Return unsubscribe function
  })
}

/**
 * Mock Firestore functions
 */
export const collection = vi.fn(() => mockCollectionRef)
export const doc = vi.fn(() => mockDocRef)
export const addDoc = vi.fn(() => Promise.resolve(mockDocRef))
export const getDoc = vi.fn(() => Promise.resolve(mockDocSnapshot))
export const getDocs = vi.fn(() => Promise.resolve(mockQuerySnapshot))
export const updateDoc = vi.fn(() => Promise.resolve())
export const deleteDoc = vi.fn(() => Promise.resolve())
export const query = vi.fn(() => mockQuery)
export const where = vi.fn(() => mockQuery)
export const orderBy = vi.fn(() => mockQuery)
export const limit = vi.fn(() => mockQuery)
export const onSnapshot = vi.fn((target, callback) => {
  callback(mockQuerySnapshot)
  return vi.fn() // Return unsubscribe function
})

/**
 * Reset all Firebase mocks
 */
export const resetFirebaseMocks = () => {
  vi.clearAllMocks()
  mockAuth.currentUser = null
  mockDocSnapshot.data.mockReturnValue({
    id: 'mock-doc-id',
    name: 'Test Document',
    createdAt: new Date().toISOString()
  })
}

