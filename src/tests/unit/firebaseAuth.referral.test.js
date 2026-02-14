import { beforeEach, describe, expect, it, vi } from 'vitest'

const firebaseStorageMock = vi.hoisted(() => ({
  getAllDoctors: vi.fn(),
  getDoctorByReferralCode: vi.fn(),
  getDoctorById: vi.fn(),
  getDoctorByEmail: vi.fn(),
  createDoctor: vi.fn(),
  updateDoctor: vi.fn(),
  createPatient: vi.fn(),
  createPrescription: vi.fn(),
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
  getOrCreateDeviceId: vi.fn(() => 'device-1')
}))

describe('firebaseAuth referral and access flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    firebaseStorageMock.getAllDoctors.mockResolvedValue([])
    firebaseStorageMock.getDoctorByReferralCode.mockResolvedValue(null)
    firebaseStorageMock.getDoctorById.mockResolvedValue(null)
    firebaseStorageMock.getDoctorByEmail.mockResolvedValue(null)
    firebaseStorageMock.createDoctor.mockResolvedValue({ id: 'new-doc-1', isApproved: false })
    firebaseStorageMock.createPatient.mockResolvedValue({ id: 'sample-patient-1' })
    firebaseStorageMock.createPrescription.mockResolvedValue({ id: 'sample-rx-1' })
    authMocks.createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: 'uid-1', email: 'new@doc.com' } })
    authMocks.signOut.mockResolvedValue(undefined)
    authMocks.onAuthStateChanged.mockImplementation(() => () => {})
  })

  it('resolves DR short referral code through doctors list', async () => {
    firebaseStorageMock.getAllDoctors.mockResolvedValue([
      { id: 'doc-100', doctorIdShort: 'DR12345' }
    ])
    const { default: firebaseAuth } = await import('../../services/firebaseAuth.js')

    const resolved = await firebaseAuth.resolveReferralDoctorId('dr12345')

    expect(resolved).toBe('doc-100')
    expect(firebaseStorageMock.getAllDoctors).toHaveBeenCalledTimes(1)
    expect(firebaseStorageMock.getDoctorByReferralCode).not.toHaveBeenCalled()
  })

  it('resolves non-DR referral code using referralCode lookup', async () => {
    firebaseStorageMock.getDoctorByReferralCode.mockResolvedValue({ id: 'doc-ref-code' })
    const { default: firebaseAuth } = await import('../../services/firebaseAuth.js')

    const resolved = await firebaseAuth.resolveReferralDoctorId('REF-CODE-01')

    expect(resolved).toBe('doc-ref-code')
    expect(firebaseStorageMock.getDoctorByReferralCode).toHaveBeenCalledWith('REF-CODE-01')
  })

  it('falls back to getDoctorById when referral code lookups fail', async () => {
    firebaseStorageMock.getDoctorByReferralCode.mockResolvedValue(null)
    firebaseStorageMock.getDoctorById.mockResolvedValue({ id: 'doc-fallback-1' })
    const { default: firebaseAuth } = await import('../../services/firebaseAuth.js')

    const resolved = await firebaseAuth.resolveReferralDoctorId('doctor-id-input')

    expect(resolved).toBe('doc-fallback-1')
    expect(firebaseStorageMock.getDoctorById).toHaveBeenCalledWith('doctor-id-input')
  })

  it('propagates resolved referral doctor id in registerDoctorWithEmailPassword payload', async () => {
    firebaseStorageMock.getDoctorByReferralCode.mockResolvedValue({ id: 'referrer-1' })
    const { default: firebaseAuth } = await import('../../services/firebaseAuth.js')

    await expect(
      firebaseAuth.registerDoctorWithEmailPassword('new@doc.com', 'pass-123', {
        firstName: 'New',
        lastName: 'Doctor',
        country: 'Sri Lanka',
        referredByDoctorId: 'REF-1'
      })
    ).rejects.toThrow('Your account is waiting for approval.')

    expect(firebaseStorageMock.createDoctor).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@doc.com',
        uid: 'uid-1',
        referredByDoctorId: 'referrer-1',
        authProvider: 'firebase-email'
      })
    )
    expect(authMocks.signOut).toHaveBeenCalled()
  })

  it('blocks doctor sign-in when access has expired', async () => {
    const { default: firebaseAuth } = await import('../../services/firebaseAuth.js')
    const pastDate = new Date(Date.now() - 60_000).toISOString()

    await expect(firebaseAuth.ensureDoctorAccess({
      id: 'doc-1',
      email: 'doc@example.com',
      isApproved: true,
      isDisabled: false,
      accessExpiresAt: pastDate
    })).rejects.toThrow('Your access period has expired. Please contact the administrator.')

    expect(authMocks.signOut).toHaveBeenCalled()
  })

  it('blocks doctor sign-in when account is disabled', async () => {
    const { default: firebaseAuth } = await import('../../services/firebaseAuth.js')

    await expect(firebaseAuth.ensureDoctorAccess({
      id: 'doc-1',
      email: 'doc@example.com',
      isApproved: true,
      isDisabled: true
    })).rejects.toThrow('Your account is disabled. Please contact the administrator.')

    expect(authMocks.signOut).toHaveBeenCalled()
  })

  it('blocks doctor sign-in when account is pending approval', async () => {
    const { default: firebaseAuth } = await import('../../services/firebaseAuth.js')

    await expect(firebaseAuth.ensureDoctorAccess({
      id: 'doc-1',
      email: 'doc@example.com',
      isApproved: false,
      isDisabled: false
    })).rejects.toThrow('Your account is waiting for approval.')

    expect(authMocks.signOut).toHaveBeenCalled()
  })

  it('blocks external doctor when owner doctor is disabled', async () => {
    const { default: firebaseAuth } = await import('../../services/firebaseAuth.js')
    firebaseStorageMock.getDoctorById.mockResolvedValue({
      id: 'owner-1',
      isApproved: true,
      isDisabled: true
    })

    await expect(firebaseAuth.ensureDoctorAccess({
      id: 'ext-1',
      email: 'ext@example.com',
      isApproved: true,
      isDisabled: false,
      externalDoctor: true,
      invitedByDoctorId: 'owner-1'
    })).rejects.toThrow('Owner doctor account is disabled. External access is not allowed.')

    expect(authMocks.signOut).toHaveBeenCalled()
  })
})
