import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    addAuthLog: vi.fn()
  }
}))

const loadService = async () => {
  vi.resetModules()
  const module = await import('../../services/doctor/doctorAuthService.js')
  return module.default
}

describe('security: doctor session integrity', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('clears malformed local doctor session lacking required identity fields', async () => {
    localStorage.setItem('prescribe-current-doctor', JSON.stringify({ id: 'doc-1', role: 'doctor' }))
    const doctorAuthService = await loadService()

    expect(doctorAuthService.getCurrentDoctor()).toBeNull()
    expect(localStorage.getItem('prescribe-current-doctor')).toBeNull()
  })

  it('clears disabled or unapproved doctor session loaded from localStorage', async () => {
    localStorage.setItem('prescribe-current-doctor', JSON.stringify({
      id: 'doc-1',
      role: 'doctor',
      email: 'doctor@example.com',
      isDisabled: true
    }))
    const doctorAuthService = await loadService()
    expect(doctorAuthService.getCurrentDoctor()).toBeNull()

    localStorage.setItem('prescribe-current-doctor', JSON.stringify({
      id: 'doc-1',
      role: 'doctor',
      email: 'doctor@example.com',
      isApproved: false
    }))
    const doctorAuthService2 = await loadService()
    expect(doctorAuthService2.getCurrentDoctor()).toBeNull()
  })

  it('clears expired local doctor session based on accessExpiresAt', async () => {
    localStorage.setItem('prescribe-current-doctor', JSON.stringify({
      id: 'doc-1',
      role: 'doctor',
      email: 'doctor@example.com',
      accessExpiresAt: '2000-01-01T00:00:00.000Z'
    }))
    const doctorAuthService = await loadService()

    expect(doctorAuthService.getCurrentDoctor()).toBeNull()
    expect(localStorage.getItem('prescribe-current-doctor')).toBeNull()
  })
})
