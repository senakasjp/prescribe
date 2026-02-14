/**
 * Component tests for PrescriptionsTab
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/svelte'
import PrescriptionsTab from '../../components/PrescriptionsTab.svelte'
import { pharmacyMedicationService } from '../../services/pharmacyMedicationService.js'
import { notifyWarning } from '../../stores/notifications.js'

vi.mock('../../services/pharmacyMedicationService.js', () => ({
  pharmacyMedicationService: {
    getConnectedPharmacies: vi.fn(() => Promise.resolve(['ph-1'])),
    getPharmacyStock: vi.fn(() => Promise.resolve([
      {
        pharmacyId: 'ph-1',
        drugName: 'Amoxicillin',
        genericName: 'Amoxicillin',
        strength: '500',
        strengthUnit: 'mg',
        dosage: '500mg',
        quantity: 100,
        minimumStock: 10
      }
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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends internal medications when they are available in stock', async () => {
    const onShowPharmacyModal = vi.fn()
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
        onShowPharmacyModal,
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
    await waitFor(() => {
      expect(pharmacyMedicationService.getPharmacyStock).toHaveBeenCalled()
    })

    await fireEvent.click(getByText('Send to Pharmacy'))
    expect(onShowPharmacyModal).toHaveBeenCalledTimes(1)
    const payload = onShowPharmacyModal.mock.calls[0][0]
    expect(Array.isArray(payload)).toBe(true)
    expect(payload).toHaveLength(1)
    expect(payload[0]).toEqual(expect.objectContaining({
      name: 'Amoxicillin',
      dosage: '500mg'
    }))
    const warningMessages = notifyWarning.mock.calls.map((call) => call[0])
    expect(warningMessages).not.toContain('All medications are marked for external pharmacy or not in stock.')
  })

  it('shows warning when all medications are external/unavailable and there are no chargeable items', async () => {
    const onShowPharmacyModal = vi.fn()
    const { getByText } = render(PrescriptionsTab, {
      props: {
        selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
        showMedicationForm: false,
        editingMedication: null,
        doctorId: 'doc-1',
        currentMedications: [
          { name: 'Amoxicillin', dosage: '500mg', amount: '10', sendToExternalPharmacy: true }
        ],
        prescriptionsFinalized: true,
        currentPrescription: { id: 'rx-1', doctorId: 'doc-1' },
        excludeConsultationCharge: true,
        prescriptionProcedures: [],
        otherProcedurePrice: '',
        onNewPrescription: vi.fn(),
        onAddDrug: vi.fn(),
        onFinalizePrescription: vi.fn(),
        onShowPharmacyModal,
        onPrintPrescriptions: vi.fn(),
        onPrintExternalPrescriptions: vi.fn(),
        onGenerateAIAnalysis: vi.fn(),
        openaiService: { isConfigured: () => true }
      }
    })

    await waitFor(() => {
      expect(getByText('Send to Pharmacy')).toBeTruthy()
    })

    await fireEvent.click(getByText('Send to Pharmacy'))
    expect(onShowPharmacyModal).not.toHaveBeenCalled()
    expect(notifyWarning).toHaveBeenCalledWith(
      'All medications are marked for external pharmacy or not in stock.'
    )
  })

  it('sends empty medication list when all medications are external but chargeable items exist', async () => {
    const onShowPharmacyModal = vi.fn()
    const { getByText } = render(PrescriptionsTab, {
      props: {
        selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
        showMedicationForm: false,
        editingMedication: null,
        doctorId: 'doc-1',
        currentMedications: [
          { name: 'Amoxicillin', dosage: '500mg', amount: '10', sendToExternalPharmacy: true }
        ],
        prescriptionsFinalized: true,
        currentPrescription: { id: 'rx-2', doctorId: 'doc-1' },
        excludeConsultationCharge: false,
        prescriptionProcedures: [],
        otherProcedurePrice: '',
        onNewPrescription: vi.fn(),
        onAddDrug: vi.fn(),
        onFinalizePrescription: vi.fn(),
        onShowPharmacyModal,
        onPrintPrescriptions: vi.fn(),
        onPrintExternalPrescriptions: vi.fn(),
        onGenerateAIAnalysis: vi.fn(),
        openaiService: { isConfigured: () => true }
      }
    })

    await waitFor(() => {
      expect(getByText('Send to Pharmacy')).toBeTruthy()
    })

    await fireEvent.click(getByText('Send to Pharmacy'))
    expect(onShowPharmacyModal).toHaveBeenCalledTimes(1)
    expect(onShowPharmacyModal).toHaveBeenCalledWith([])
  })

  it('sends non-external medications for new prescriptions when stock lookup is not ready', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValueOnce([])

    const onShowPharmacyModal = vi.fn()
    const { getByText } = render(PrescriptionsTab, {
      props: {
        selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
        showMedicationForm: false,
        editingMedication: null,
        doctorId: 'doc-1',
        currentMedications: [
          { name: 'Derm, Keta Cream', dosage: '10g', amount: '1', sendToExternalPharmacy: false }
        ],
        prescriptionsFinalized: true,
        currentPrescription: { id: 'rx-new-1', doctorId: 'doc-1', status: 'finalized' },
        excludeConsultationCharge: true,
        prescriptionProcedures: [],
        otherProcedurePrice: '',
        onNewPrescription: vi.fn(),
        onAddDrug: vi.fn(),
        onFinalizePrescription: vi.fn(),
        onShowPharmacyModal,
        onPrintPrescriptions: vi.fn(),
        onPrintExternalPrescriptions: vi.fn(),
        onGenerateAIAnalysis: vi.fn(),
        openaiService: { isConfigured: () => true }
      }
    })

    await waitFor(() => {
      expect(getByText('Send to Pharmacy')).toBeTruthy()
    })

    await fireEvent.click(getByText('Send to Pharmacy'))
    expect(onShowPharmacyModal).toHaveBeenCalledTimes(1)
    expect(onShowPharmacyModal.mock.calls[0][0]).toEqual([
      expect.objectContaining({ name: 'Derm, Keta Cream' })
    ])
  })
})
