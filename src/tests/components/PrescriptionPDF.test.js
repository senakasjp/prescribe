/**
 * Component tests for PrescriptionPDF PDF generation
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import PrescriptionPDF from '../../components/PrescriptionPDF.svelte'

vi.mock('jspdf', () => {
  const createPdfProxy = () => {
    const calls = {
      output: vi.fn(() => new Blob(['pdf'], { type: 'application/pdf' }))
    }

    const proxy = new Proxy(calls, {
      get(target, prop) {
        if (prop in target) return target[prop]
        if (prop === 'internal') {
          return { pageSize: { getWidth: () => 148, getHeight: () => 210 } }
        }
        return vi.fn(() => proxy)
      }
    })

    return { proxy, calls }
  }

  const { proxy } = createPdfProxy()
  class MockJsPDF {
    constructor() {
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
    getCurrentDoctor: vi.fn(() => null)
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
})
