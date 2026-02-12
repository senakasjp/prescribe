/**
 * Integration test for pharmacy owner registration flow (E2E smoke)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'

const firebaseStorageMock = vi.hoisted(() => ({
  getPharmacistByEmail: vi.fn(() => Promise.resolve(null)),
  createPharmacist: vi.fn(() => Promise.resolve({ id: 'ph-1' })),
  updatePharmacist: vi.fn(() => Promise.resolve()),
  getDoctorByEmail: vi.fn(() => Promise.resolve(null)),
  updateDoctor: vi.fn(() => Promise.resolve()),
  getPharmacistPrescriptions: vi.fn(() => Promise.resolve([])),
  getDoctorById: vi.fn(() => Promise.resolve(null)),
  getAllDoctors: vi.fn(() => Promise.resolve([])),
  getPharmacistById: vi.fn(() => Promise.resolve(null)),
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

vi.mock('../../services/pharmacist/pharmacistAuthService.js', () => ({
  default: {
    signOut: vi.fn(() => Promise.resolve())
  }
}))

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

import PharmacistDashboard from '../../components/PharmacistDashboard.svelte'

describe('Pharmacy owner registration flow (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('allows owner to register a patient for a connected doctor', async () => {
    const pharmacist = {
      id: 'ph-1',
      email: 'owner@example.com',
      businessName: 'Main Pharmacy',
      connectedDoctors: ['doc-1']
    }

    firebaseStorageMock.getPharmacistByEmail.mockResolvedValue(pharmacist)
    firebaseStorageMock.getDoctorById.mockResolvedValue({ id: 'doc-1', name: 'Dr One' })

    const user = userEvent.setup()
    const { findByText, container } = render(PharmacistDashboard, {
      props: { pharmacist }
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
