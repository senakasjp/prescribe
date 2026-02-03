/**
 * Regression tests for DoctorAuth authentication flows
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import DoctorAuth from '../../components/DoctorAuth.svelte'
import firebaseAuthService from '../../services/firebaseAuth.js'

vi.mock('../../services/firebaseAuth.js', () => ({
  default: {
    registerDoctorWithEmailPassword: vi.fn(() => Promise.resolve({ id: 'doc-1' })),
    signInWithEmailPassword: vi.fn(() => Promise.resolve({ id: 'doc-1' })),
    signInWithGoogle: vi.fn(() => Promise.resolve({ id: 'doc-1' }))
  }
}))

describe('DoctorAuth Component - Regression Flows', () => {
  let user

  beforeEach(() => {
    user = userEvent.setup()
  })

  it('logs in with email and password (local auth)', async () => {
    const { getByLabelText, getByRole } = render(DoctorAuth, { props: { allowRegister: true } })

    await user.type(getByLabelText(/email or username/i), 'doctor@example.com')
    await user.type(getByLabelText(/^password$/i), 'Secure@123')

    await user.click(getByRole('button', { name: /^login$/i }))

    await waitFor(() => {
      expect(firebaseAuthService.signInWithEmailPassword).toHaveBeenCalledWith(
        'doctor@example.com',
        'Secure@123'
      )
    })
  })

  it('shows validation error when required register fields are missing', async () => {
    const { getByLabelText, getByRole, container } = render(DoctorAuth, { props: { allowRegister: true, registerOnly: true } })

    await waitFor(() => {
      expect(getByLabelText(/first name/i)).toBeTruthy()
    })

    const firstNameInput = getByLabelText(/first name/i)
    const lastNameInput = getByLabelText(/last name/i)
    const emailInput = getByLabelText(/email address/i)

    await fireEvent.input(firstNameInput, { target: { value: 'Jane' } })
    await fireEvent.input(lastNameInput, { target: { value: 'Smith' } })
    await fireEvent.input(emailInput, { target: { value: 'jane.smith@example.com' } })

    const countrySelect = getByLabelText(/country/i)
    const options = Array.from(countrySelect.options)
    const usIndex = options.findIndex((opt) => opt.value === 'United States')
    if (usIndex >= 0) {
      countrySelect.selectedIndex = usIndex
      options[usIndex].selected = true
    }
    Object.defineProperty(countrySelect, 'value', { value: 'United States', writable: true })
    await fireEvent.input(countrySelect, { target: { value: 'United States' } })
    await fireEvent.change(countrySelect, { target: { value: 'United States', selectedIndex: usIndex } })

    const passwordInput = getByLabelText(/^password$/i)
    const confirmPasswordInput = getByLabelText(/confirm password/i)

    await fireEvent.input(passwordInput, { target: { value: 'Secure@123' } })
    await fireEvent.input(confirmPasswordInput, { target: { value: 'Secure@123' } })

    await waitFor(() => {
      expect(getByLabelText(/first name/i).value).toBe('Jane')
      expect(getByLabelText(/last name/i).value).toBe('Smith')
      expect(getByLabelText(/email address/i).value).toBe('jane.smith@example.com')
      expect(passwordInput.value).toBe('Secure@123')
      expect(confirmPasswordInput.value).toBe('Secure@123')
    })

    const form = container.querySelector('form')
    if (form) {
      await fireEvent.submit(form)
    } else {
      await user.click(getByRole('button', { name: /^register$/i }))
    }

    await waitFor(() => {
      const alert = container.querySelector('[role="alert"]')
      expect(alert).toBeTruthy()
      expect(firebaseAuthService.registerDoctorWithEmailPassword).not.toHaveBeenCalled()
    })
  })

  it('logs in with Google', async () => {
    const { getByRole } = render(DoctorAuth, { props: { allowRegister: true } })

    await user.click(getByRole('button', { name: /google/i }))

    await waitFor(() => {
      expect(firebaseAuthService.signInWithGoogle).toHaveBeenCalledWith('doctor')
    })
  })
})
