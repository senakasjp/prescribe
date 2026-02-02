/**
 * Component tests for PrescriptionsTab
 */
import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/svelte'
import PrescriptionsTab from '../../components/PrescriptionsTab.svelte'

vi.mock('../../services/pharmacyMedicationService.js', () => ({
  pharmacyMedicationService: {
    getConnectedPharmacies: vi.fn(() => Promise.resolve(['ph-1'])),
    getPharmacyStock: vi.fn(() => Promise.resolve([
      { pharmacyId: 'ph-1', name: 'Amoxicillin', currentStock: 100, minimumStock: 10 }
    ])),
    clearCache: vi.fn()
  }
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getDoctorById: vi.fn(() => Promise.resolve({ id: 'doc-1', currency: 'USD', consultationCharge: 100, hospitalCharge: 50 })),
    getDoctorByEmail: vi.fn(() => Promise.resolve({ id: 'doc-1', currency: 'USD', consultationCharge: 100, hospitalCharge: 50 })),
    getPharmacistById: vi.fn(() => Promise.resolve({ id: 'ph-1', currency: 'USD' }))
  }
}))

vi.mock('../../stores/notifications.js', () => ({
  notifyWarning: vi.fn()
}))

vi.mock('../../services/pharmacist/chargeCalculationService.js', () => ({
  default: {
    calculateExpectedChargeFromStock: vi.fn(() => ({ totalCharge: 250 })),
    parseMedicationQuantity: vi.fn(() => 10)
  }
}))

describe('PrescriptionsTab', () => {
  it('renders finalized actions and expected price', async () => {
    const { getByText } = render(PrescriptionsTab, {
      props: {
        selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
        showMedicationForm: false,
        editingMedication: null,
        doctorId: 'doc-1',
        currentMedications: [{ name: 'Amoxicillin', dosage: '500mg', amount: '10' }],
        prescriptionsFinalized: true,
        currentPrescription: { id: 'rx-1', doctorId: 'doc-1' },
        onNewPrescription: vi.fn(),
        onAddDrug: vi.fn(),
        onFinalizePrescription: vi.fn(),
        onShowPharmacyModal: vi.fn(),
        onPrintPrescriptions: vi.fn(),
        onPrintExternalPrescriptions: vi.fn(),
        onGenerateAIAnalysis: vi.fn(),
        openaiService: { isConfigured: () => true }
      }
    })

    await waitFor(() => {
      expect(getByText('Send to Pharmacy')).toBeTruthy()
      expect(getByText('Print (Full)')).toBeTruthy()
    })

    await waitFor(() => {
      expect(getByText(/Expected Price:/)).toBeTruthy()
    })
  })
})
