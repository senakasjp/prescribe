/**
 * Integration test for pharmacy team member access:
 * - login via pharmacistAuthService
 * - patient registration via PharmacistDashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'

const firebaseStorageMock = vi.hoisted(() => ({
  getPharmacistByEmail: vi.fn(() => Promise.resolve(null)),
  getPharmacyUserByEmail: vi.fn(() => Promise.resolve(null)),
  getPharmacistById: vi.fn(() => Promise.resolve(null)),
  getPharmacistPrescriptions: vi.fn(() => Promise.resolve([])),
  getDoctorById: vi.fn(() => Promise.resolve(null)),
  getDoctorByEmail: vi.fn(() => Promise.resolve(null)),
  getAllDoctors: vi.fn(() => Promise.resolve([])),
  updatePharmacist: vi.fn(() => Promise.resolve()),
  updateDoctor: vi.fn(() => Promise.resolve()),
  createPharmacist: vi.fn(() => Promise.resolve({ id: 'ph-1' })),
  getPatientsByDoctorId: vi.fn(() => Promise.resolve([])),
  createPatient: vi.fn(() => Promise.resolve({ id: 'patient-1' }))
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ path: 'pharmacistInventory/mock' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({ currentStock: 10 }) })),
  setDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true }))
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: firebaseStorageMock
}))

vi.mock('../../services/firebaseAuth.js', () => ({
  default: {
    generatePharmacistNumber: vi.fn(() => 'PH-001')
  }
}))

vi.mock('../../services/authService.js', () => ({
  default: {
    signOut: vi.fn(() => Promise.resolve())
  }
}))

vi.mock('../../services/pharmacist/pharmacistAuthService.js', async () => {
  const module = await vi.importActual('../../services/pharmacist/pharmacistAuthService.js')
  return { default: module.default }
})

vi.mock('../../stores/notifications.js', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn()
}))

vi.mock('jsbarcode', () => ({
  default: vi.fn()
}))

vi.mock('../../services/pharmacist/chargeCalculationService.js', () => ({
  default: {
    calculatePrescriptionCharge: vi.fn(() => Promise.resolve({ totalCharge: 0 }))
  }
}))

vi.mock('../../services/pharmacist/inventoryService.js', () => ({
  default: {
    getInventoryItems: vi.fn(() => Promise.resolve([])),
    findMatchingDrugs: vi.fn(() => [])
  }
}))

import pharmacistAuthService from '../../services/pharmacist/pharmacistAuthService.js'
import PharmacistDashboard from '../../components/PharmacistDashboard.svelte'

describe('Pharmacy team member access (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('allows team member login and patient registration', async () => {
    firebaseStorageMock.getPharmacistByEmail.mockResolvedValue(null)
    firebaseStorageMock.getPharmacyUserByEmail.mockResolvedValue({
      id: 'team-1',
      email: 'team@example.com',
      password: 'pass123',
      pharmacyId: 'ph-1'
    })
    firebaseStorageMock.getPharmacistById.mockResolvedValue({
      id: 'ph-1',
      businessName: 'Main Pharmacy',
      connectedDoctors: ['doc-1']
    })
    firebaseStorageMock.getDoctorById.mockResolvedValue({
      id: 'doc-1',
      name: 'Dr One'
    })

    const teamMember = await pharmacistAuthService.signInPharmacist('team@example.com', 'pass123 ')
    expect(teamMember.isPharmacyUser).toBe(true)

    const user = userEvent.setup()
    const { findByText, container, getByRole } = render(PharmacistDashboard, {
      props: {
        pharmacist: teamMember
      }
    })

    const registrationsTab = await findByText('Registrations')
    await user.click(registrationsTab)

    const firstNameInput = container.querySelector('#firstName')
    const ageYearsInput = container.querySelector('#ageYears')

    expect(firstNameInput).toBeTruthy()
    expect(ageYearsInput).toBeTruthy()

    await user.type(firstNameInput, 'John')
    await user.type(ageYearsInput, '30')

    const form = container.querySelector('form')
    expect(form).toBeTruthy()
    const saveButton = within(form).getByRole('button', { name: /save patient/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(firebaseStorageMock.createPatient).toHaveBeenCalledWith(
        expect.objectContaining({
          doctorId: 'doc-1',
          firstName: 'John'
        })
      )
    })
  })
})
