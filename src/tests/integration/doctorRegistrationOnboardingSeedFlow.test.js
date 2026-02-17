import { beforeEach, describe, expect, it, vi } from 'vitest'

const firebaseStorageMock = vi.hoisted(() => ({
  getDoctorByEmail: vi.fn(),
  createDoctor: vi.fn(),
  seedOnboardingDummyDataForDoctor: vi.fn(),
  updateDoctor: vi.fn(),
  addAuthLog: vi.fn()
}))

const authMocks = vi.hoisted(() => ({
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn()
}))

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  createUserWithEmailAndPassword: authMocks.createUserWithEmailAndPassword,
  signInWithEmailAndPassword: vi.fn(),
  signOut: authMocks.signOut,
  onAuthStateChanged: authMocks.onAuthStateChanged,
  getAuth: vi.fn(() => ({}))
}))

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ options: {} })),
  getApps: vi.fn(() => [])
}))

vi.mock('../../firebase-config.js', () => ({
  default: { options: {} },
  auth: {},
  googleProvider: {}
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: firebaseStorageMock
}))

vi.mock('../../services/deviceIdService.js', () => ({
  getOrCreateDeviceId: vi.fn(() => 'device-reg-1')
}))

describe('doctor registration onboarding seed flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.createUserWithEmailAndPassword.mockResolvedValue({
      user: { uid: 'uid-reg-1', email: 'new@doc.com' }
    })
    authMocks.signOut.mockResolvedValue(undefined)
    authMocks.onAuthStateChanged.mockImplementation(() => () => {})

    firebaseStorageMock.getDoctorByEmail.mockResolvedValue(null)
    firebaseStorageMock.createDoctor.mockResolvedValue({
      id: 'new-doc-reg-1',
      email: 'new@doc.com',
      isApproved: false
    })
    firebaseStorageMock.seedOnboardingDummyDataForDoctor.mockResolvedValue(true)
  })

  it('registerDoctorWithEmailPassword seeds onboarding dummy data after doctor creation', async () => {
    const { default: firebaseAuth } = await import('../../services/firebaseAuth.js')

    await expect(
      firebaseAuth.registerDoctorWithEmailPassword('new@doc.com', 'pass-123', {
        firstName: 'New',
        lastName: 'Doctor',
        country: 'Sri Lanka'
      })
    ).rejects.toThrow('Your account is waiting for approval.')

    expect(firebaseStorageMock.createDoctor).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@doc.com',
        uid: 'uid-reg-1',
        authProvider: 'firebase-email'
      })
    )
    expect(firebaseStorageMock.seedOnboardingDummyDataForDoctor).toHaveBeenCalledTimes(1)
    expect(firebaseStorageMock.seedOnboardingDummyDataForDoctor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'new-doc-reg-1',
        email: 'new@doc.com'
      })
    )
    expect(authMocks.signOut).toHaveBeenCalledTimes(1)
  })

  it('continues registration flow when seeding fails and still enforces pending-approval sign-out', async () => {
    firebaseStorageMock.seedOnboardingDummyDataForDoctor.mockRejectedValueOnce(new Error('seed failed'))
    const { default: firebaseAuth } = await import('../../services/firebaseAuth.js')

    await expect(
      firebaseAuth.registerDoctorWithEmailPassword('new@doc.com', 'pass-123', {
        firstName: 'New',
        lastName: 'Doctor',
        country: 'Sri Lanka'
      })
    ).rejects.toThrow('Your account is waiting for approval.')

    expect(firebaseStorageMock.createDoctor).toHaveBeenCalledTimes(1)
    expect(firebaseStorageMock.seedOnboardingDummyDataForDoctor).toHaveBeenCalledTimes(1)
    expect(authMocks.signOut).toHaveBeenCalledTimes(1)
  })
})

