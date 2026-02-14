import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import PrescriptionsTab from '../../components/PrescriptionsTab.svelte'
import PrescriptionPDF from '../../components/PrescriptionPDF.svelte'

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

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({
    width: 1200,
    height: 200,
    toDataURL: () => 'data:image/png;base64,SYSTEM_HEADER'
  }))
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
    getDoctorById: vi.fn(() => Promise.resolve({ id: 'doc-1', currency: 'USD', consultationCharge: 100, hospitalCharge: 50 })),
    getDoctorByEmail: vi.fn(() => Promise.resolve({ id: 'doc-1', currency: 'USD', consultationCharge: 100, hospitalCharge: 50 })),
    getPharmacistById: vi.fn(() => Promise.resolve({ id: 'ph-1', currency: 'USD' })),
    getDoctorTemplateSettings: vi.fn(() => Promise.resolve(null))
  }
}))

vi.mock('../../services/doctor/doctorAuthService.js', () => ({
  default: {
    getCurrentDoctor: vi.fn(() => ({ id: 'doc-1' }))
  }
}))

vi.mock('../../stores/notifications.js', () => ({
  notifyWarning: vi.fn()
}))

vi.mock('../../services/pharmacist/chargeCalculationService.js', () => ({
  default: {
    calculateExpectedChargeFromStock: vi.fn(() => ({ totalCharge: 250 })),
    parseMedicationQuantity: vi.fn((value) => {
      const parsed = Number.parseInt(String(value || ''), 10)
      return Number.isFinite(parsed) ? parsed : 0
    })
  }
}))

describe('Prescription flow formatting parity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    global.open = vi.fn()
  })

  it('keeps QTY metadata consistent between prescription view and PDF output', async () => {
    const medication = {
      id: 'qty-1',
      name: 'Dandex',
      dosageForm: 'Shampoo',
      qts: '1',
      strength: '100',
      strengthUnit: 'mg',
      frequency: '',
      duration: 'days'
    }

    const view = render(PrescriptionsTab, {
      props: {
        selectedPatient: { id: 'pat-1', doctorId: 'doc-1' },
        showMedicationForm: false,
        editingMedication: null,
        doctorId: 'doc-1',
        currentMedications: [medication],
        prescriptionsFinalized: true,
        currentPrescription: { id: 'rx-1', doctorId: 'doc-1', status: 'finalized' },
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
      expect(view.getByText('Shampoo | Quantity: 01')).toBeTruthy()
    })

    const pdf = render(PrescriptionPDF, {
      props: {
        selectedPatient: {
          firstName: 'Test',
          lastName: 'Patient',
          idNumber: 'ID123',
          dateOfBirth: '1990-01-01'
        },
        illnesses: [],
        prescriptions: [medication],
        symptoms: []
      }
    })
    await fireEvent.click(pdf.getByText('Generate PDF'))

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    const merged = payloads.join(' ')
    expect(/Shampoo\s*\|\s*Quantity:\s*01/i.test(merged)).toBe(true)
    expect(/Duration:\s*days/i.test(merged)).toBe(false)
  })
})
