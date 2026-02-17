import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import PrescriptionsTab from '../../components/PrescriptionsTab.svelte'
import PrescriptionPDF from '../../components/PrescriptionPDF.svelte'
import firebaseStorage from '../../services/firebaseStorage.js'
import { pharmacyMedicationService } from '../../services/pharmacyMedicationService.js'

let lastPdfProxy = null

vi.mock('jspdf', () => {
  const createPdfProxy = () => {
    const calls = {
      output: vi.fn(() => new Blob(['pdf'], { type: 'application/pdf' })),
      internal: { pageSize: { getWidth: () => 148, getHeight: () => 210 } },
      splitTextToSize: vi.fn((text) => [String(text)]),
      _fns: {}
    }
    calls._fns.splitTextToSize = calls.splitTextToSize

    const proxy = new Proxy(calls, {
      get(target, prop) {
        if (prop in target) return target[prop]
        if (target._fns[prop]) return target._fns[prop]
        const fn = vi.fn(() => proxy)
        target._fns[prop] = fn
        return fn
      }
    })

    return { proxy }
  }

  class MockJsPDF {
    constructor() {
      const { proxy } = createPdfProxy()
      lastPdfProxy = proxy
      return proxy
    }
  }
  return { default: MockJsPDF }
})

vi.mock('jsbarcode', () => ({
  default: vi.fn()
}))

vi.mock('../../firebase-config.js', () => ({
  auth: {
    currentUser: {
      uid: 'doc-1'
    }
  }
}))

vi.mock('../../services/doctor/doctorAuthService.js', () => ({
  default: {
    getCurrentDoctor: vi.fn(() => ({ id: 'doc-1', email: 'doctor@test.com' }))
  }
}))

vi.mock('../../services/pharmacyMedicationService.js', () => ({
  pharmacyMedicationService: {
    getConnectedPharmacies: vi.fn(() => Promise.resolve(['ph-1'])),
    getPharmacyStock: vi.fn(() => Promise.resolve([])),
    clearCache: vi.fn()
  }
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getDoctorById: vi.fn(() => Promise.resolve({ id: 'doc-1', currency: 'LKR' })),
    getDoctorByEmail: vi.fn(() => Promise.resolve({ id: 'doc-1', currency: 'LKR' })),
    getPharmacistById: vi.fn(() => Promise.resolve({ id: 'ph-1', currency: 'LKR' })),
    getDoctorTemplateSettings: vi.fn(() => Promise.resolve(null))
  }
}))

vi.mock('../../services/pharmacist/chargeCalculationService.js', () => ({
  default: {
    calculateExpectedChargeFromStock: vi.fn(() => ({ totalCharge: 0 })),
    parseMedicationQuantity: vi.fn((value) => {
      const parsed = Number(String(value ?? '').trim())
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
    })
  }
}))

const collectPdfStrings = () => {
  const textCalls = lastPdfProxy?._fns?.text?.mock?.calls || []
  const strings = []
  const visit = (value) => {
    if (typeof value === 'string') strings.push(value)
    if (Array.isArray(value)) value.forEach(visit)
  }
  textCalls.forEach((call) => call.forEach(visit))
  return strings
}

const collectSplitPayloads = () => {
  const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
  return splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
}

const renderAndSendToPharmacy = async (medications) => {
  const onShowPharmacyModal = vi.fn()
  const view = render(PrescriptionsTab, {
    props: {
      selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
      showMedicationForm: false,
      editingMedication: null,
      doctorId: 'doc-1',
      currentMedications: medications,
      prescriptionsFinalized: true,
      currentPrescription: { id: 'rx-1', doctorId: 'doc-1', status: 'finalized' },
      onMedicationAdded: vi.fn(),
      onCancelMedication: vi.fn(),
      onEditPrescription: vi.fn(),
      onDeletePrescription: vi.fn(),
      onDeleteMedicationByIndex: vi.fn(),
      onFinalizePrescription: vi.fn(),
      onShowPharmacyModal,
      onGoToPreviousTab: vi.fn(),
      onGenerateAIDrugSuggestions: vi.fn(),
      onAddAISuggestedDrug: vi.fn(),
      onRemoveAISuggestedDrug: vi.fn(),
      loadingAIDrugSuggestions: false,
      onNewPrescription: vi.fn(),
      onAddDrug: vi.fn(),
      onPrintPrescriptions: vi.fn(),
      onPrintExternalPrescriptions: vi.fn(),
      onGenerateAIAnalysis: vi.fn(),
      openaiService: { isConfigured: () => true }
    }
  })

  await waitFor(() => {
    expect(view.getByText('Send to Pharmacy')).toBeTruthy()
  })
  await fireEvent.click(view.getByText('Send to Pharmacy'))
  await waitFor(() => {
    expect(onShowPharmacyModal).toHaveBeenCalledTimes(1)
  })
  return onShowPharmacyModal.mock.calls[0][0]
}

const renderAndGeneratePdf = async (medications) => {
  const view = render(PrescriptionPDF, {
    props: {
      selectedPatient: {
        firstName: 'Flow',
        lastName: 'Case',
        idNumber: 'ID500',
        dateOfBirth: '1990-01-01',
        doctorId: 'doc-1'
      },
      illnesses: [],
      prescriptions: medications,
      symptoms: []
    }
  })

  await fireEvent.click(view.getByText('Generate PDF'))
  await waitFor(() => {
    expect(global.URL.createObjectURL).toHaveBeenCalled()
    expect(global.open).toHaveBeenCalled()
  })
}

describe('inventory -> pdf + pharmacy send flow matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    global.open = vi.fn()
  })

  it('Non-QTY inventory tablet: keeps inventory strength for PDF and sends medication to pharmacy', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValueOnce([
      {
        pharmacyId: 'ph-1',
        drugName: 'Paracetamol',
        genericName: 'Acetaminophen',
        strength: '500',
        strengthUnit: 'mg',
        quantity: 120,
        minimumStock: 10
      }
    ])

    const medications = [
      {
        id: 'med-1',
        source: 'inventory',
        name: 'Paracetamol',
        genericName: 'Acetaminophen',
        dosageForm: 'Tablet',
        dosage: '1',
        inventoryStrengthText: '500 mg',
        frequency: 'Twice daily (BD)',
        duration: '5 days'
      }
    ]

    const payload = await renderAndSendToPharmacy(medications)
    expect(payload).toHaveLength(1)
    expect(payload[0]).toEqual(expect.objectContaining({
      name: 'Paracetamol',
      dosageForm: 'Tablet',
      inventoryStrengthText: '500 mg'
    }))

    await renderAndGeneratePdf(medications)
    const splitPayloads = collectSplitPayloads()
    expect(splitPayloads.some((value) => /Strength:\s*500\s*mg/i.test(value))).toBe(true)
  })

  it('Liquid (measured) inventory: sends full medication payload and prints Vol + Dose + Total + Amount in PDF', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValueOnce([
      {
        pharmacyId: 'ph-1',
        drugName: 'Corex',
        genericName: 'Corex',
        strength: '100',
        strengthUnit: 'ml',
        quantity: 50,
        minimumStock: 5
      }
    ])

    const medications = [
      {
        id: 'med-2',
        source: 'inventory',
        name: 'Corex',
        genericName: 'Corex',
        dosageForm: 'Liquid (measured)',
        dosage: '1',
        inventoryStrengthText: '100 ml',
        liquidDosePerFrequencyMl: '10',
        liquidAmountMl: '90',
        frequency: 'Three times daily (TDS)',
        duration: '2 days'
      }
    ]

    const payload = await renderAndSendToPharmacy(medications)
    expect(payload).toHaveLength(1)
    expect(payload[0]).toEqual(expect.objectContaining({
      name: 'Corex',
      dosageForm: 'Liquid (measured)',
      inventoryStrengthText: '100 ml',
      liquidDosePerFrequencyMl: '10',
      liquidAmountMl: '90'
    }))

    await renderAndGeneratePdf(medications)
    const splitPayloads = collectSplitPayloads()
    const fullText = splitPayloads.join(' ')
    expect(/Vol:\s*100\s*ml/i.test(fullText)).toBe(true)
    expect(/Dose:\s*10\s+.+\/frequency/i.test(fullText)).toBe(true)
    expect(/Total:\s*60\s+.+/i.test(fullText)).toBe(true)
    expect(/Amount:\s*90\s+.+/i.test(fullText)).toBe(true)
  })

  it('Special QTY cream: sends qts to pharmacy and avoids right-side count/form header text in PDF', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValueOnce([
      {
        pharmacyId: 'ph-1',
        drugName: 'Dermox',
        genericName: 'Dermox',
        strength: '',
        strengthUnit: '',
        quantity: 20,
        minimumStock: 2
      }
    ])

    const medications = [
      {
        id: 'med-3',
        source: 'inventory',
        name: 'Dermox',
        genericName: 'Dermox',
        dosageForm: 'Cream',
        dosage: '1',
        qts: '2',
        frequency: 'Twice daily (BD)',
        duration: '7 days'
      }
    ]

    const payload = await renderAndSendToPharmacy(medications)
    expect(payload).toHaveLength(1)
    expect(payload[0]).toEqual(expect.objectContaining({
      name: 'Dermox',
      dosageForm: 'Cream',
      qts: '2'
    }))

    await renderAndGeneratePdf(medications)
    const splitPayloads = collectSplitPayloads()
    expect(splitPayloads.some((value) => /Cream\s*\|\s*Quantity:\s*02/i.test(value))).toBe(true)

    const textStrings = collectPdfStrings()
    const merged = textStrings.join(' ')
    expect(/1\s*Cream/i.test(merged)).toBe(false)
  })

  it('uses Vol label when inventory strength is resolved from pharmacy lookup', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValueOnce([
      {
        pharmacyId: 'ph-1',
        drugName: 'LookupCorex',
        genericName: 'LookupCorex',
        strength: '120',
        strengthUnit: 'ml',
        dosageForm: 'Liquid (bottles)',
        quantity: 20,
        minimumStock: 1
      }
    ])

    const medications = [
      {
        id: 'med-lookup-vol-1',
        source: 'inventory',
        name: 'LookupCorex',
        genericName: 'LookupCorex',
        dosageForm: 'Liquid (bottles)',
        dosage: '1',
        frequency: 'Twice daily (BD)',
        duration: '3 days'
      }
    ]

    await renderAndGeneratePdf(medications)
    const splitPayloads = collectSplitPayloads()
    const fullText = splitPayloads.join(' ')
    expect(/Vol:\s*120\s*ml/i.test(fullText)).toBe(true)
    expect(/Strength:\s*120\s*ml/i.test(fullText)).toBe(false)
  })

  it('strips unit-only values from pharmacy payload and PDF details when number is missing', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValueOnce([
      {
        pharmacyId: 'ph-1',
        drugName: 'EdgeCaseDrug',
        genericName: 'EdgeCaseDrug',
        strength: '',
        strengthUnit: '',
        quantity: 15,
        minimumStock: 1
      }
    ])

    const medications = [
      {
        id: 'med-edge-1',
        source: 'inventory',
        name: 'EdgeCaseDrug',
        genericName: 'EdgeCaseDrug',
        dosageForm: 'Tablet',
        dosage: '1',
        strength: '',
        strengthUnit: 'mg',
        frequency: 'Twice daily (BD)',
        duration: 'days'
      }
    ]

    const payload = await renderAndSendToPharmacy(medications)
    expect(payload).toHaveLength(1)
    expect(payload[0].duration).toBe('')
    expect(payload[0].strength).toBe('')
    expect(payload[0].strengthUnit).toBe('')

    await renderAndGeneratePdf(medications)
    const splitPayloads = collectSplitPayloads()
    const fullText = splitPayloads.join(' ')
    expect(/Duration:\s*days/i.test(fullText)).toBe(false)
    expect(/\|\s*days\s*(\||$)/i.test(fullText)).toBe(false)
  })
})
