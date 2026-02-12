/**
 * Component tests for PharmacistDashboard
 */
import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/svelte'
import PharmacistDashboard from '../../components/PharmacistDashboard.svelte'

const firebaseStorageMock = vi.hoisted(() => ({
  getPharmacistByEmail: vi.fn(() => Promise.resolve(null)),
  createPharmacist: vi.fn(() => Promise.resolve({ id: 'ph-1', email: 'ph@example.com', businessName: 'Pharmacy' })),
  updatePharmacist: vi.fn(() => Promise.resolve()),
  getDoctorByEmail: vi.fn(() => Promise.resolve(null)),
  updateDoctor: vi.fn(() => Promise.resolve()),
  getPharmacistPrescriptions: vi.fn(() => Promise.resolve([])),
  getDoctorById: vi.fn(() => Promise.resolve(null)),
  getAllDoctors: vi.fn(() => Promise.resolve([])),
  getPharmacistById: vi.fn(() => Promise.resolve(null))
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ path: 'pharmacistInventory/mock' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({ currentStock: 10 }) })),
  setDoc: vi.fn(() => Promise.resolve())
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

describe('PharmacistDashboard', () => {
  it('renders header and actions', async () => {
    const { getByText } = render(PharmacistDashboard, {
      props: {
        pharmacist: {
          id: 'ph-1',
          email: 'ph@example.com',
          businessName: 'Pharmacy',
          connectedDoctors: []
        }
      }
    })

    await waitFor(() => {
      expect(getByText('Pharmacist Portal')).toBeTruthy()
      expect(getByText('Logout')).toBeTruthy()
      expect(getByText('Settings')).toBeTruthy()
    })
  })

  it('shows registrations tab for team member with connected doctors via parent pharmacy', async () => {
    const teamMember = {
      id: 'team-1',
      email: 'team@example.com',
      isPharmacyUser: true,
      pharmacyId: 'ph-parent',
      connectedDoctors: ['doc-1']
    }

    firebaseStorageMock.getPharmacistByEmail.mockResolvedValue(null)
    firebaseStorageMock.getPharmacistById.mockResolvedValue({
      id: 'ph-parent',
      connectedDoctors: ['doc-1']
    })
    firebaseStorageMock.getDoctorById.mockResolvedValue({
      id: 'doc-1',
      name: 'Dr One'
    })

    const { getByText, findByText } = render(PharmacistDashboard, {
      props: {
        pharmacist: teamMember
      }
    })

    await findByText('New')
    expect(getByText('New')).toBeTruthy()
  })
})
