/**
 * Regression tests for EditProfile component
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { tick } from 'svelte'
import EditProfile from '../../components/EditProfile.svelte'
import authService from '../../services/authService.js'
import firebaseStorage from '../../services/firebaseStorage.js'
import { notifySuccess } from '../../stores/notifications.js'

vi.mock('../../services/authService.js', () => ({
  default: {
    updateDoctor: vi.fn(() => Promise.resolve())
  }
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getDoctorByEmail: vi.fn(() => Promise.resolve({ deleteCode: 'DEL-123' }))
  }
}))

vi.mock('../../services/backupService.js', () => ({
  default: {
    createBackup: vi.fn(),
    restoreBackup: vi.fn(),
    listBackups: vi.fn()
  }
}))

vi.mock('../../stores/notifications.js', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn()
}))

describe('EditProfile Component - Regression Flows', () => {
  let user

  beforeEach(() => {
    user = userEvent.setup()
  })

  it('prefills profile fields and saves updates', async () => {
    const profile = global.testUtils.createMockUser({
      firstName: 'Test',
      lastName: 'Doctor',
      email: 'doctor@example.com',
      country: 'United States',
      city: 'New York',
      consultationCharge: '120',
      hospitalCharge: '80'
    })

    const handleProfileUpdated = vi.fn()
    const { component, getByLabelText, getByRole } = render(EditProfile, { props: { user: profile } })

    component.$on('profile-updated', handleProfileUpdated)

    await waitFor(() => {
      expect(getByLabelText(/first name/i).value).toBe('Test')
      expect(getByLabelText(/last name/i).value).toBe('Doctor')
      expect(getByLabelText(/country/i).value).toBe('United States')
      expect(getByLabelText(/city/i).value).toBe('New York')
    })

    const firstNameInput = getByLabelText(/first name/i)
    const lastNameInput = getByLabelText(/last name/i)

    await fireEvent.input(firstNameInput, { target: { value: 'Updated' } })
    await fireEvent.input(lastNameInput, { target: { value: 'Name' } })
    await tick()

    const form = document.querySelector('#edit-profile-form')
    if (form) {
      await fireEvent.submit(form)
    } else {
      await user.click(getByRole('button', { name: /save changes/i }))
    }

    await waitFor(() => {
      expect(authService.updateDoctor).toHaveBeenCalled()
      expect(notifySuccess).toHaveBeenCalled()
      expect(handleProfileUpdated).toHaveBeenCalled()
    })
  })

  it('loads delete code from Firebase profile', async () => {
    const profile = global.testUtils.createMockUser({ email: 'doctor@example.com' })

    render(EditProfile, { props: { user: profile } })

    await waitFor(() => {
      expect(firebaseStorage.getDoctorByEmail).toHaveBeenCalledWith('doctor@example.com')
    })
  })
})
