/**
 * Component tests for PrescriptionPDF PDF generation
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import PrescriptionPDF from '../../components/PrescriptionPDF.svelte'
import { pharmacyMedicationService } from '../../services/pharmacyMedicationService.js'

let lastPdfProxy = null

vi.mock('jspdf', () => {
  const createPdfProxy = () => {
    const calls = {
      output: vi.fn(() => new Blob(['pdf'], { type: 'application/pdf' })),
      internal: { pageSize: { getWidth: () => 148, getHeight: () => 210 } },
      _fns: {}
    }

    const proxy = new Proxy(calls, {
      get(target, prop) {
        if (prop in target) return target[prop]
        if (target._fns[prop]) return target._fns[prop]
        const fn = vi.fn(() => proxy)
        target._fns[prop] = fn
        return fn
      }
    })

    return { proxy, calls }
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

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getDoctorById: vi.fn(() => Promise.resolve(null)),
    getDoctorByEmail: vi.fn(() => Promise.resolve(null)),
    getDoctorTemplateSettings: vi.fn(() => Promise.resolve(null))
  }
}))

vi.mock('../../services/doctor/doctorAuthService.js', () => ({
  default: {
    getCurrentDoctor: vi.fn(() => ({ id: 'doctor-1' }))
  }
}))

vi.mock('../../services/pharmacyMedicationService.js', () => ({
  pharmacyMedicationService: {
    getPharmacyStock: vi.fn(() => Promise.resolve([
      {
        drugName: 'Test Drug 500',
        brandName: 'Test Drug 500',
        genericName: 'Test Generic',
        strength: '500',
        strengthUnit: 'mg'
      }
    ]))
  }
}))

beforeEach(() => {
  vi.restoreAllMocks()
  global.URL.createObjectURL = vi.fn(() => 'blob:mock')
  global.open = vi.fn()
})

describe('PrescriptionPDF', () => {
  it('opens a PDF blob in a new window on generate', async () => {
    const selectedPatient = {
      firstName: 'Test',
      lastName: 'Patient',
      idNumber: 'ID123',
      dateOfBirth: '1990-01-01'
    }

    const { getByText } = render(PrescriptionPDF, {
      props: {
        selectedPatient,
        illnesses: [],
        prescriptions: [],
        symptoms: []
      }
    })

    await fireEvent.click(getByText('Generate PDF'))

    expect(global.URL.createObjectURL).toHaveBeenCalled()
    expect(global.open).toHaveBeenCalled()
  })

  it('includes unit from pharmacy inventory in PDF dosage text', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([
      {
        drugName: 'Test Drug 500',
        brandName: 'Test Drug 500',
        genericName: 'Test Generic',
        strength: '500',
        strengthUnit: 'mg'
      }
    ])

    const selectedPatient = {
      firstName: 'Test',
      lastName: 'Patient',
      idNumber: 'ID123',
      dateOfBirth: '1990-01-01'
    }

    const prescriptions = [
      {
        id: 'med-1',
        name: 'Test Drug 500',
        genericName: 'Test Generic',
        dosage: '500',
        frequency: 'Once daily (OD)',
        duration: '7 days',
        timing: 'After meals (PC)'
      }
    ]

    const { getByText } = render(PrescriptionPDF, {
      props: {
        selectedPatient,
        illnesses: [],
        prescriptions,
        symptoms: []
      }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const textCalls = lastPdfProxy?._fns?.text?.mock?.calls || []
    const flattened = textCalls.flat()
    const hasUnit = flattened.some(value =>
      typeof value === 'string' && /500\s*mg/i.test(value)
    )

    expect(hasUnit).toBe(true)
  })

  it('includes unit from prescription when inventory does not have the drug', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])

    const selectedPatient = {
      firstName: 'Test',
      lastName: 'Patient',
      idNumber: 'ID123',
      dateOfBirth: '1990-01-01'
    }

    const prescriptions = [
      {
        id: 'med-2',
        name: 'Unknown Drug',
        dosage: '500',
        strength: '500',
        strengthUnit: 'mg',
        frequency: 'Once daily (OD)',
        duration: '10 days',
        timing: 'After meals (PC)'
      }
    ]

    const { getByText } = render(PrescriptionPDF, {
      props: {
        selectedPatient,
        illnesses: [],
        prescriptions,
        symptoms: []
      }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const textCalls = lastPdfProxy?._fns?.text?.mock?.calls || []
    const flattened = textCalls.flat()
    const hasUnit = flattened.some(value =>
      typeof value === 'string' && /500\s*mg/i.test(value)
    )

    expect(hasUnit).toBe(true)
  })
})
