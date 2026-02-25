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

  it('disables send to pharmacy when prescription is already sent', async () => {
    const onShowPharmacyModal = vi.fn()
    const { getByText } = render(PrescriptionsTab, {
      props: {
        selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
        showMedicationForm: false,
        editingMedication: null,
        doctorId: 'doc-1',
        currentMedications: [{ name: 'Amoxicillin', dosage: '500mg', amount: '10' }],
        prescriptionsFinalized: true,
        currentPrescription: { id: 'rx-1', doctorId: 'doc-1', status: 'sent', sentToPharmacy: true },
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

    const sendButton = getByText('Send to Pharmacy')
    expect(sendButton.hasAttribute('disabled')).toBe(true)
    await fireEvent.click(sendButton)
    expect(onShowPharmacyModal).not.toHaveBeenCalled()
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

  it('allows send to pharmacy for procedure-only prescriptions without drugs', async () => {
    const onShowPharmacyModal = vi.fn()
    const { getByText } = render(PrescriptionsTab, {
      props: {
        selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
        showMedicationForm: false,
        editingMedication: null,
        doctorId: 'doc-1',
        currentMedications: [],
        prescriptionsFinalized: true,
        currentPrescription: { id: 'rx-proc-only-1', doctorId: 'doc-1' },
        excludeConsultationCharge: true,
        prescriptionProcedures: ['ECG'],
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

  it('allows finalize action for procedure-only prescriptions without drugs', async () => {
    const onFinalizePrescription = vi.fn()
    const { getByText } = render(PrescriptionsTab, {
      props: {
        selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
        showMedicationForm: false,
        editingMedication: null,
        doctorId: 'doc-1',
        currentMedications: [],
        prescriptionsFinalized: false,
        currentPrescription: { id: 'rx-proc-only-finalize-1', doctorId: 'doc-1' },
        excludeConsultationCharge: true,
        prescriptionProcedures: ['ECG'],
        otherProcedurePrice: '',
        onNewPrescription: vi.fn(),
        onAddDrug: vi.fn(),
        onFinalizePrescription,
        onShowPharmacyModal: vi.fn(),
        onPrintPrescriptions: vi.fn(),
        onPrintExternalPrescriptions: vi.fn(),
        onGenerateAIAnalysis: vi.fn(),
        openaiService: { isConfigured: () => true }
      }
    })

    await waitFor(() => {
      expect(getByText('Finalize Prescription')).toBeTruthy()
    })

    await fireEvent.click(getByText('Finalize Prescription'))
    expect(onFinalizePrescription).toHaveBeenCalledTimes(1)
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

  it('keeps a stable pharmacy payload schema for mixed medication fields', async () => {
    const onShowPharmacyModal = vi.fn()
    const medication = {
      id: 'med-contract-1',
      name: 'Amoxicillin',
      genericName: 'Amoxicillin',
      dosage: '500mg',
      dosageForm: 'Tablet',
      frequency: 'Twice daily (BD)',
      duration: 'days',
      strength: '',
      strengthUnit: 'mg',
      qts: '2',
      amount: '12',
      liquidDosePerFrequencyMl: '5',
      liquidAmountMl: '80',
      inventoryStrengthText: '100 ml',
      sendToExternalPharmacy: false
    }

    const { getByText } = render(PrescriptionsTab, {
      props: {
        selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
        showMedicationForm: false,
        editingMedication: null,
        doctorId: 'doc-1',
        currentMedications: [medication],
        prescriptionsFinalized: true,
        currentPrescription: { id: 'rx-contract-1', doctorId: 'doc-1', status: 'finalized' },
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
    const payload = onShowPharmacyModal.mock.calls[0][0]
    expect(payload).toHaveLength(1)
    expect(payload[0]).toEqual(expect.objectContaining({
      id: 'med-contract-1',
      name: 'Amoxicillin',
      genericName: 'Amoxicillin',
      dosage: '500mg',
      dosageForm: 'Tablet',
      frequency: 'Twice daily (BD)',
      duration: '',
      strength: '',
      strengthUnit: '',
      qts: '2',
      amount: '12',
      liquidDosePerFrequencyMl: '5',
      liquidAmountMl: '80',
      inventoryStrengthText: '100 ml',
      sendToExternalPharmacy: false
    }))
  })

  it('shows QTY scenario subtitle as dosage form and quantity', async () => {
    const { getByText } = render(PrescriptionsTab, {
      props: {
        selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
        showMedicationForm: false,
        editingMedication: null,
        doctorId: 'doc-1',
        currentMedications: [
          {
            name: 'Dandex',
            dosageForm: 'Shampoo',
            qts: '1',
            frequency: '',
            duration: ''
          }
        ],
        prescriptionsFinalized: true,
        currentPrescription: { id: 'rx-qty-1', doctorId: 'doc-1', status: 'finalized' },
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
      expect(getByText('Shampoo | Quantity: 01')).toBeTruthy()
    })
  })

  it('shows Vol on send line for volume-based QTY medications', async () => {
    const { getByText } = render(PrescriptionsTab, {
      props: {
        selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
        showMedicationForm: false,
        editingMedication: null,
        doctorId: 'doc-1',
        currentMedications: [
          {
            name: 'ORS-Jeevanee',
            dosageForm: 'Packet',
            strength: '1000',
            strengthUnit: 'ml',
            qts: '3',
            frequency: '',
            duration: ''
          }
        ],
        prescriptionsFinalized: true,
        currentPrescription: { id: 'rx-qty-vol-1', doctorId: 'doc-1', status: 'finalized' },
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
      expect(getByText('Vol: 1000 ml | Packet | Quantity: 03')).toBeTruthy()
    })
  })

  it('resolves Vol value from container fallback fields when strength is missing', async () => {
    const { getByText } = render(PrescriptionsTab, {
      props: {
        selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
        showMedicationForm: false,
        editingMedication: null,
        doctorId: 'doc-1',
        currentMedications: [
          {
            name: 'ORS-Jeevanee',
            dosageForm: 'Packet',
            strength: '',
            strengthUnit: '',
            containerSize: '1000',
            containerUnit: 'ml',
            qts: '3',
            frequency: '',
            duration: ''
          }
        ],
        prescriptionsFinalized: true,
        currentPrescription: { id: 'rx-qty-vol-fallback-1', doctorId: 'doc-1', status: 'finalized' },
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
      expect(getByText('Vol: 1000 ml | Packet | Quantity: 03')).toBeTruthy()
    })
  })

  it('supports core prescription actions without flow regression', async () => {
    const onNewPrescription = vi.fn()
    const onAddDrug = vi.fn()
    const onFinalizePrescription = vi.fn()
    const onUnfinalizePrescription = vi.fn()
    const onPrintPrescriptions = vi.fn()

    const { getByText, queryByText, rerender } = render(PrescriptionsTab, {
      props: {
        selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
        showMedicationForm: false,
        editingMedication: null,
        doctorId: 'doc-1',
        currentMedications: [{ name: 'Dandex', dosageForm: 'Shampoo', qts: '1' }],
        prescriptionsFinalized: false,
        currentPrescription: { id: 'rx-flow-1', doctorId: 'doc-1' },
        onNewPrescription,
        onAddDrug,
        onFinalizePrescription,
        onUnfinalizePrescription,
        onShowPharmacyModal: vi.fn(),
        onPrintPrescriptions,
        onPrintExternalPrescriptions: vi.fn(),
        onGenerateAIAnalysis: vi.fn(),
        openaiService: { isConfigured: () => true }
      }
    })

    await fireEvent.click(getByText('New Prescription'))
    await fireEvent.click(getByText('Add Drug'))
    await fireEvent.click(getByText('Finalize Prescription'))

    expect(onNewPrescription).toHaveBeenCalledTimes(1)
    expect(onAddDrug).toHaveBeenCalledTimes(1)
    expect(onFinalizePrescription).toHaveBeenCalledTimes(1)
    expect(queryByText('Print (Full)')).toBeNull()

    await rerender({
      selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
      showMedicationForm: false,
      editingMedication: null,
      doctorId: 'doc-1',
      currentMedications: [{ name: 'Dandex', dosageForm: 'Shampoo', qts: '1' }],
      prescriptionsFinalized: true,
      currentPrescription: { id: 'rx-flow-1', doctorId: 'doc-1' },
      onNewPrescription,
      onAddDrug,
      onFinalizePrescription,
      onUnfinalizePrescription,
      onShowPharmacyModal: vi.fn(),
      onPrintPrescriptions,
      onPrintExternalPrescriptions: vi.fn(),
      onGenerateAIAnalysis: vi.fn(),
      openaiService: { isConfigured: () => true }
    })

    await waitFor(() => {
      expect(getByText('Print (Full)')).toBeTruthy()
      expect(getByText('Unfinalize Prescription')).toBeTruthy()
    })
    await fireEvent.click(getByText('Unfinalize Prescription'))
    await fireEvent.click(getByText('Print (Full)'))
    expect(onUnfinalizePrescription).toHaveBeenCalledTimes(1)
    expect(onPrintPrescriptions).toHaveBeenCalledTimes(1)
  })

  it('applies doctor note templates from settings into prescription notes', async () => {
    const { getByLabelText, container } = render(PrescriptionsTab, {
      props: {
        selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
        showMedicationForm: false,
        editingMedication: null,
        doctorId: 'doc-1',
        currentMedications: [{ name: 'Amoxicillin', dosage: '500mg', amount: '10' }],
        prescriptionsFinalized: true,
        currentPrescription: { id: 'rx-note-template-1', doctorId: 'doc-1', status: 'finalized' },
        prescriptionNotes: '',
        doctorProfileFallback: {
          id: 'doc-1',
          templateSettings: {
            prescriptionNoteTemplates: [
              { id: 'standard-follow-up', name: 'Standard Follow-up', content: 'Review after 2 weeks.' },
              { id: 'diet-advice', name: 'Diet Advice', content: 'Avoid oily foods and stay hydrated.' }
            ]
          }
        },
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

    const notesToggle = getByLabelText('Prescription Notes')
    await fireEvent.click(notesToggle)

    const templateSelect = getByLabelText('Use Template')
    await fireEvent.change(templateSelect, { target: { value: 'diet-advice' } })

    const notesInput = container.querySelector('#prescriptionNotes')
    expect(notesInput.value).toBe('Avoid oily foods and stay hydrated.')
  })

  it.each([
    {
      title: 'keeps QTY form label when qts is missing/invalid',
      medication: { name: 'Dandex', dosageForm: 'Shampoo', qts: 'abc', frequency: '', duration: '' },
      expected: 'Shampoo',
      containsQuantity: false
    },
    {
      title: 'shows padded quantity for qts values',
      medication: { name: 'Dandex', dosageForm: 'Cream', qts: '7', frequency: '', duration: '' },
      expected: 'Cream | Quantity: 07',
      containsQuantity: true
    },
    {
      title: 'does not apply QTY format to tablet forms',
      medication: { name: 'Paracetamol', dosageForm: 'Tablet', qts: '5', frequency: 'Once daily (OD)', duration: '5 days' },
      expected: 'Once daily (OD)',
      containsQuantity: false
    }
  ])('$title', async ({ medication, expected, containsQuantity }) => {
    const { getByText, container } = render(PrescriptionsTab, {
      props: {
        selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
        showMedicationForm: false,
        editingMedication: null,
        doctorId: 'doc-1',
        currentMedications: [medication],
        prescriptionsFinalized: true,
        currentPrescription: { id: 'rx-qty-matrix', doctorId: 'doc-1', status: 'finalized' },
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
      expect(getByText(new RegExp(expected.replace(/[|()[\]\\.?+*^$]/g, '\\$&'), 'i'))).toBeTruthy()
    })

    const viewText = container.textContent || ''
    expect(viewText).not.toMatch(/\|\|/)
    if (containsQuantity) {
      expect(viewText).toMatch(/Quantity:\s*\d{2}/i)
    } else {
      expect(viewText).not.toMatch(/Quantity:/i)
    }
  })

  it('keeps secondary-line text snapshots stable for key medication scenarios', async () => {
    const cases = [
      {
        name: 'QTY',
        medication: { name: 'Dandex', dosageForm: 'Shampoo', qts: '1', frequency: '', duration: '' },
        expected: 'Shampoo | Quantity: 01'
      },
      {
        name: 'Tablet',
        medication: {
          name: 'Paracetamol',
          dosageForm: 'Tablet',
          dosage: '1',
          frequency: 'Once daily (OD)',
          duration: '5 days'
        },
        expected: '1 • Once daily (OD) • 5 days • Tablet'
      },
      {
        name: 'Liquid',
        medication: {
          name: 'Cough Syrup',
          dosageForm: 'Liquid',
          dosage: '5',
          strength: '5',
          strengthUnit: 'ml',
          frequency: 'Twice daily (BID)',
          duration: '3 days'
        },
        expected: 'Vol: 5 ml | Liquid'
      }
    ]

    for (const item of cases) {
      const { container, unmount } = render(PrescriptionsTab, {
        props: {
          selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
          showMedicationForm: false,
          editingMedication: null,
          doctorId: 'doc-1',
          currentMedications: [item.medication],
          prescriptionsFinalized: true,
          currentPrescription: { id: `rx-snapshot-${item.name}`, doctorId: 'doc-1', status: 'finalized' },
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
        const line = container.querySelector('.text-gray-500.text-sm')
        expect(line?.textContent?.replace(/\s+/g, ' ').trim()).toBe(item.expected)
      })

      unmount()
    }
  })
})
