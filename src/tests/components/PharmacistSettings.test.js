/**
 * Role-based access tests for PharmacistSettings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import PharmacistSettings from '../../components/pharmacist/PharmacistSettings.svelte'
import { notifyError, notifySuccess } from '../../stores/notifications.js'

const firebaseStorageMock = vi.hoisted(() => ({
  getDoctorByEmail: vi.fn(() => Promise.resolve(null)),
  getPharmacyUsersByPharmacyId: vi.fn(() => Promise.resolve([])),
  createPharmacyUser: vi.fn(() => Promise.resolve({ id: 'team-user-1' })),
  updatePharmacyUser: vi.fn(() => Promise.resolve()),
  deletePharmacyUser: vi.fn(() => Promise.resolve())
}))

const backupServiceMock = vi.hoisted(() => ({
  exportPharmacistBackup: vi.fn(() => Promise.resolve({ type: 'pharmacist' })),
  restorePharmacistBackup: vi.fn(() => Promise.resolve({
    inventoryItems: 0,
    receivedPrescriptions: 0
  }))
}))

vi.mock('../../services/pharmacist/pharmacistAuthService.js', () => ({
  default: {
    updatePharmacist: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => Promise.resolve())
  }
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: firebaseStorageMock
}))

vi.mock('../../stores/notifications.js', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn()
}))

vi.mock('../../services/backupService.js', () => ({
  default: backupServiceMock
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

  it('shows team and backup tabs for primary pharmacy owner', () => {
    const { getByText } = render(PharmacistSettings, {
      props: {
        pharmacist: {
          id: 'ph-1',
          email: 'owner@example.com',
          businessName: 'Main Pharmacy',
          pharmacistNumber: 'PH-001'
        }
      }
    })

    expect(getByText(/Team/i)).toBeTruthy()
    expect(getByText(/Backup & Restore/i)).toBeTruthy()
    expect(getByText(/Edit Profile/i)).toBeTruthy()
  })

  it('restricts non-primary linked account from profile edits and team management', () => {
    const { getByText, getByRole, getByLabelText } = render(PharmacistSettings, {
      props: {
        pharmacist: {
          id: 'staff-2',
          pharmacyId: 'ph-1',
          email: 'staff@example.com',
          businessName: 'Main Pharmacy',
          pharmacistNumber: 'PH-001'
        }
      }
    })

    expect(getByText(/Only the primary pharmacy account can edit this profile/i)).toBeTruthy()
    expect(getByLabelText(/Business Name/i)).toBeDisabled()
    expect(getByRole('button', { name: /Save Changes/i })).toBeDisabled()
    expect(getByRole('button', { name: /^Team$/i })).toBeDisabled()
  })

  it('blocks restore action for non-primary linked account', async () => {
    const user = userEvent.setup()
    const { getByRole, container } = render(PharmacistSettings, {
      props: {
        pharmacist: {
          id: 'staff-2',
          pharmacyId: 'ph-1',
          email: 'staff@example.com',
          businessName: 'Main Pharmacy',
          pharmacistNumber: 'PH-001'
        }
      }
    })

    await user.click(getByRole('button', { name: /Backup & Restore/i }))

    const fileInput = container.querySelector('input[type="file"]')
    expect(fileInput).toBeTruthy()
    const backupFile = new File([JSON.stringify({ type: 'pharmacist' })], 'backup.json', { type: 'application/json' })
    await fireEvent.change(fileInput, { target: { files: [backupFile] } })
    await user.click(getByRole('button', { name: /Restore Backup/i }))

    await waitFor(() => {
      expect(notifyError).toHaveBeenCalledWith('Only the primary pharmacy account can restore data.')
    })
    expect(backupServiceMock.restorePharmacistBackup).not.toHaveBeenCalled()
  })

  it('allows primary owner to add a team member', async () => {
    const user = userEvent.setup()
    const { getByRole, getByLabelText } = render(PharmacistSettings, {
      props: {
        pharmacist: {
          id: 'ph-1',
          email: 'owner@example.com',
          businessName: 'Main Pharmacy',
          pharmacistNumber: 'PH-001'
        }
      }
    })

    await user.click(getByRole('button', { name: /^Team$/i }))

    await user.type(getByLabelText(/First Name/i), 'Jane')
    await user.type(getByLabelText(/Last Name/i), 'Doe')
    await user.type(getByLabelText(/^Email/i), 'jane@example.com')
    await user.type(getByLabelText(/Temporary Password/i), 'pass123')
    await user.type(getByLabelText(/Confirm Password/i), 'pass123')

    await user.click(getByRole('button', { name: /Add Team Member/i }))

    await waitFor(() => {
      expect(firebaseStorageMock.createPharmacyUser).toHaveBeenCalledWith(expect.objectContaining({
        pharmacyId: 'ph-1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com'
      }))
    })
    expect(notifySuccess).toHaveBeenCalledWith('Team member added successfully')
  })

  it('allows primary owner to change a team member password', async () => {
    firebaseStorageMock.getPharmacyUsersByPharmacyId.mockResolvedValueOnce([
      {
        id: 'team-user-9',
        firstName: 'Nisha',
        lastName: 'Demo',
        email: 'nisha@example.com',
        status: 'active'
      }
    ])

    const user = userEvent.setup()
    const { getByRole, container } = render(PharmacistSettings, {
      props: {
        pharmacist: {
          id: 'ph-1',
          email: 'owner@example.com',
          businessName: 'Main Pharmacy',
          pharmacistNumber: 'PH-001'
        }
      }
    })

    await user.click(getByRole('button', { name: /^Team$/i }))
    await waitFor(() => {
      expect(getByRole('button', { name: /Change Password/i })).toBeTruthy()
    })

    await user.click(getByRole('button', { name: /Change Password/i }))
    const newPasswordInput = container.querySelector('#teamChangePassword-team-user-9')
    const confirmPasswordInput = container.querySelector('#teamChangePasswordConfirm-team-user-9')
    expect(newPasswordInput).toBeTruthy()
    expect(confirmPasswordInput).toBeTruthy()

    await user.type(newPasswordInput, 'newpass123')
    await user.type(confirmPasswordInput, 'newpass123')
    await user.click(getByRole('button', { name: /Save Password/i }))

    await waitFor(() => {
      expect(firebaseStorageMock.updatePharmacyUser).toHaveBeenCalledWith('team-user-9', {
        password: 'newpass123'
      })
    })
    expect(notifySuccess).toHaveBeenCalledWith('Team member password updated successfully')
  })
})
