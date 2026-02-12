/**
 * Role-based access tests for PharmacistSettings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import PharmacistSettings from '../../components/pharmacist/PharmacistSettings.svelte'

vi.mock('../../services/pharmacist/pharmacistAuthService.js', () => ({
  default: {
    signOut: vi.fn(() => Promise.resolve())
  }
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getDoctorByEmail: vi.fn(() => Promise.resolve(null)),
    getPharmacyUsersByPharmacyId: vi.fn(() => Promise.resolve([]))
  }
}))

vi.mock('../../stores/notifications.js', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn()
}))

vi.mock('../../services/backupService.js', () => ({
  default: {
    createPharmacistBackup: vi.fn(),
    restorePharmacistBackup: vi.fn()
  }
}))

describe('PharmacistSettings role-based access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks settings for team members', () => {
    const { getByText, queryByText } = render(PharmacistSettings, {
      props: {
        pharmacist: {
          id: 'team-1',
          email: 'team@example.com',
          isPharmacyUser: true,
          pharmacyId: 'ph-1'
        }
      }
    })

    expect(getByText(/Settings access is restricted/i)).toBeTruthy()
    expect(queryByText(/Add Team Member/i)).toBeNull()
  })

  it('shows team tab for primary pharmacy owner', () => {
    const { getByText } = render(PharmacistSettings, {
      props: {
        pharmacist: {
          id: 'ph-1',
          email: 'owner@example.com',
          businessName: 'Main Pharmacy'
        }
      }
    })

    expect(getByText(/Team/i)).toBeTruthy()
    expect(getByText(/Edit Profile/i)).toBeTruthy()
  })
})
