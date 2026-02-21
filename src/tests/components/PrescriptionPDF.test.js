/**
 * Component tests for PrescriptionPDF PDF generation
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import PrescriptionPDF from '../../components/PrescriptionPDF.svelte'
import { pharmacyMedicationService } from '../../services/pharmacyMedicationService.js'
import doctorAuthService from '../../services/doctor/doctorAuthService.js'
import firebaseStorage from '../../services/firebaseStorage.js'
import JsBarcode from 'jsbarcode'
import html2canvas from 'html2canvas'

const collectPdfTextStrings = () => {
  const textCalls = lastPdfProxy?._fns?.text?.mock?.calls || []
  const strings = []
  const visit = (value) => {
    if (typeof value === 'string') {
      strings.push(value)
      return
    }
    if (Array.isArray(value)) {
      value.forEach(visit)
    }
  }
  textCalls.forEach((call) => call.forEach(visit))
  return strings
}

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const squish = (value) => normalizeText(value).replace(/\s+/g, '')
const normalizeHtml = (value) => {
  const container = document.createElement('div')
  container.innerHTML = String(value || '')
  return container.innerHTML.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim()
}

const parityPatient = {
  firstName: 'Parity',
  lastName: 'Check',
  idNumber: 'ID501',
  dateOfBirth: '1985-01-01'
}

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

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({
    width: 1200,
    height: 200,
    toDataURL: () => 'data:image/png;base64,SYSTEM_HEADER'
  }))
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
  const renderAndGenerate = async (settings, patient = parityPatient) => {
    doctorAuthService.getCurrentDoctor.mockReturnValue({ id: 'doctor-1', email: 'doc@test.com' })
    firebaseStorage.getDoctorByEmail.mockResolvedValue({ id: 'doctor-1' })
    firebaseStorage.getDoctorTemplateSettings.mockResolvedValue(settings)

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient: patient, illnesses: [], prescriptions: [], symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled()
      expect(global.open).toHaveBeenCalled()
    })
  }

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

  it('opens print window for HTML5 print/save path', async () => {
    const selectedPatient = {
      firstName: 'Test',
      lastName: 'Patient',
      idNumber: 'ID123',
      dateOfBirth: '1990-01-01'
    }

    const printWindowMock = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn()
      },
      focus: vi.fn(),
      print: vi.fn()
    }
    global.open = vi.fn(() => printWindowMock)

    const { getByText } = render(PrescriptionPDF, {
      props: {
        selectedPatient,
        illnesses: [],
        prescriptions: [],
        symptoms: []
      }
    })

    await fireEvent.click(getByText('Print / Save PDF (HTML5)'))

    await waitFor(() => {
      expect(global.open).toHaveBeenCalled()
      expect(printWindowMock.document.write).toHaveBeenCalledTimes(1)
    })
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

  it('renders Qts scenario second line as dosage form with padded quantity', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])

    const selectedPatient = {
      firstName: 'Test',
      lastName: 'Patient',
      idNumber: 'ID123',
      dateOfBirth: '1990-01-01'
    }

    const prescriptions = [
      {
        id: 'med-qts-1',
        name: 'Dandex',
        dosageForm: 'Shampoo',
        qts: '1',
        strength: '100',
        strengthUnit: 'mg',
        frequency: 'Once daily (OD)',
        duration: '7 days'
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

    const textStrings = collectPdfTextStrings()
    const mergedText = normalizeText(textStrings.join(' '))
    const hasQtsLine = /Shampoo\s*\|\s*Quantity:\s*01/i.test(mergedText)
    expect(hasQtsLine).toBe(true)
  })

  it('omits placeholder duration text for Qts scenario when duration is only "days"', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])

    const selectedPatient = {
      firstName: 'Test',
      lastName: 'Patient',
      idNumber: 'ID123',
      dateOfBirth: '1990-01-01'
    }

    const prescriptions = [
      {
        id: 'med-qts-2',
        name: 'Dandex',
        dosageForm: 'Shampoo',
        qts: '1',
        strength: '100',
        strengthUnit: 'mg',
        frequency: '',
        duration: 'days'
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

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    expect(payloads.some((value) => /Shampoo\s*\|\s*Quantity:\s*01/i.test(value))).toBe(true)
    expect(payloads.some((value) => /Duration:\s*days/i.test(value))).toBe(false)
  })

  it('omits unit-only duration text (weeks/months/etc) when no numeric value is present', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])

    const selectedPatient = {
      firstName: 'Test',
      lastName: 'Patient',
      idNumber: 'ID123',
      dateOfBirth: '1990-01-01'
    }

    const prescriptions = [
      {
        id: 'med-duration-edge-1',
        name: 'Edge Duration Drug',
        dosage: '1',
        strength: '',
        strengthUnit: 'mg',
        frequency: 'Once daily (OD)',
        duration: 'weeks'
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

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    const fullText = payloads.join(' ')
    expect(/Duration:\s*weeks/i.test(fullText)).toBe(false)
    expect(/\|\s*weeks\s*(\||$)/i.test(fullText)).toBe(false)
  })

  it('does not include liquid amount in prescription details when quantity/meta is available', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])

    const selectedPatient = {
      firstName: 'Test',
      lastName: 'Patient',
      idNumber: 'ID123',
      dateOfBirth: '1990-01-01'
    }

    const prescriptions = [
      {
        id: 'med-liquid-1',
        name: 'Cough Relief',
        dosageForm: 'Liquid (bottles)',
        liquidAmountMl: '60',
        strength: '5',
        strengthUnit: 'ml',
        frequency: 'Twice daily (BD)',
        duration: '5 days'
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

    const textStrings = collectPdfTextStrings()
    const mergedText = normalizeText(textStrings.join(' '))
    expect(/Amount:\s*60\s*ml/i.test(mergedText)).toBe(false)
  })

  it('includes current version label in PDF footer', async () => {
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

    const textCalls = lastPdfProxy?._fns?.text?.mock?.calls || []
    const flattened = textCalls.flat()
    const hasVersion = flattened.some(value =>
      typeof value === 'string' && /M-Prescribe v2\.3/i.test(value)
    )

    expect(hasVersion).toBe(true)
  })

  it('includes medication name and dosage for full PDF list', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])

    const selectedPatient = {
      firstName: 'Test',
      lastName: 'Patient',
      idNumber: 'ID123',
      dateOfBirth: '1990-01-01'
    }

    const prescriptions = [
      {
        id: 'med-3',
        name: 'Full Drug',
        dosage: '250',
        strength: '250',
        strengthUnit: 'mg',
        frequency: 'Once daily (OD)'
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
    const hasName = flattened.some(value =>
      typeof value === 'string' && /Full Drug/i.test(value)
    )
    const hasDosage = flattened.some(value =>
      typeof value === 'string' && /250\s*mg/i.test(value)
    )

    expect(hasName).toBe(true)
    expect(hasDosage).toBe(true)
  })

  it('formats medication name in PDF as Brand (Generic)', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])

    const selectedPatient = {
      firstName: 'Test',
      lastName: 'Patient',
      idNumber: 'ID123',
      dateOfBirth: '1990-01-01'
    }

    const prescriptions = [
      {
        id: 'med-generic-first',
        name: 'Panadol',
        genericName: 'Paracetamol',
        dosage: '500',
        strength: '500',
        strengthUnit: 'mg',
        frequency: 'Once daily (OD)'
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
    const hasBrandFirstName = flattened.some(value =>
      typeof value === 'string' && /Panadol\s*\(Paracetamol\)/i.test(value)
    )

    expect(hasBrandFirstName).toBe(true)
  })

  it('falls back to inventory generic name when prescription genericName is missing', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([
      {
        drugName: 'Panadol',
        brandName: 'Panadol',
        genericName: 'Paracetamol',
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
        id: 'med-generic-fallback',
        name: 'Panadol',
        genericName: '',
        dosage: '500',
        strength: '500',
        strengthUnit: 'mg',
        frequency: 'Once daily (OD)'
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
    const hasGenericFromLookup = flattened.some(value =>
      typeof value === 'string' && /Panadol\s*\(Paracetamol\)/i.test(value)
    )

    expect(hasGenericFromLookup).toBe(true)
  })

  it('derives generic name from hyphenated brand when explicit generic is missing', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])

    const selectedPatient = {
      firstName: 'Test',
      lastName: 'Patient',
      idNumber: 'ID777',
      dateOfBirth: '1990-01-01'
    }

    const prescriptions = [
      {
        id: 'med-generic-derive-1',
        name: 'Omeprazole-SPMC',
        genericName: '',
        dosageForm: 'Capsule',
        dosage: '1',
        strength: '20',
        strengthUnit: 'mg',
        frequency: 'Once daily (OD)',
        duration: '5 days'
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
    const hasDerivedGeneric = flattened.some(value =>
      typeof value === 'string' && /Omeprazole-SPMC\s*\(Omeprazole\)/i.test(value)
    )

    expect(hasDerivedGeneric).toBe(true)
  })

  it('includes only external medications when prescriptions list is filtered', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])

    const selectedPatient = {
      firstName: 'Test',
      lastName: 'Patient',
      idNumber: 'ID123',
      dateOfBirth: '1990-01-01'
    }

    const prescriptions = [
      {
        id: 'med-4',
        name: 'External Only Drug',
        dosage: '100',
        strength: '100',
        strengthUnit: 'mg',
        frequency: 'Once daily (OD)'
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
    const hasExternalName = flattened.some(value =>
      typeof value === 'string' && /External Only Drug/i.test(value)
    )
    const hasUnexpected = flattened.some(value =>
      typeof value === 'string' && /Internal Drug/i.test(value)
    )

    expect(hasExternalName).toBe(true)
    expect(hasUnexpected).toBe(false)
  })

  it('renders timing and instructions text for medications in generated PDF', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])
    const selectedPatient = {
      firstName: 'Comprehensive',
      lastName: 'Case',
      idNumber: 'ID456',
      dateOfBirth: '1995-05-21'
    }
    const prescriptions = [{
      id: 'med-5',
      name: 'Complex Drug',
      dosage: '1',
      dosageForm: 'tablet',
      frequency: 'Twice daily (BID)',
      duration: '14 days',
      timing: 'After meals (PC)',
      instructions: 'Take with warm water'
    }]

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    expect(payloads.some((value) => /Duration:\s*14 days/i.test(value))).toBe(true)
    expect(payloads.some((value) => /After meals/i.test(value))).toBe(true)
    expect(payloads.some((value) => /Instructions:\s*Take with warm water/i.test(value))).toBe(true)
  })

  it('renders liquid measured strength on header and keeps total on second line in generated PDF', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])
    const selectedPatient = {
      firstName: 'Liquid',
      lastName: 'Case',
      idNumber: 'ID657',
      dateOfBirth: '1995-05-21'
    }
    const prescriptions = [{
      id: 'med-liquid-1',
      name: 'Cough Mixture',
      dosage: '1',
      dosageForm: 'Liquid (measured)',
      strength: '5',
      strengthUnit: 'mg',
      liquidAmountMl: '90',
      liquidDosePerFrequencyMl: '10',
      frequency: 'Three times daily (TDS)',
      duration: '2 days'
    }]

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const textCalls = lastPdfProxy?._fns?.text?.mock?.calls || []
    expect(
      textCalls.some((call) => call[0] === '5 mg' && call[3]?.align === 'right')
    ).toBe(true)

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    expect(payloads.some((value) => /Dose:\s*10\s*ml\/frequency/i.test(value))).toBe(true)
    expect(payloads.some((value) => /Total:\s*60\s*ml/i.test(value))).toBe(true)
    expect(payloads.some((value) => /Amount:\s*90\s*ml/i.test(value))).toBe(false)
    expect(payloads.some((value) => /Three times daily\s*\(TDS\)/i.test(value))).toBe(true)
  })

  it('renders liquid measured strength in right header when dose-per-frequency is absent', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])
    const selectedPatient = {
      firstName: 'Measured',
      lastName: 'Strength',
      idNumber: 'ID659',
      dateOfBirth: '1995-05-21'
    }
    const prescriptions = [{
      id: 'med-liquid-3',
      name: 'Measured Mix',
      dosageForm: 'Liquid (measured)',
      strength: '5',
      strengthUnit: 'ml',
      frequency: 'Twice daily (BD)',
      duration: '3 days'
    }]

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const textCalls = lastPdfProxy?._fns?.text?.mock?.calls || []
    expect(
      textCalls.some((call) => call[0] === '5 ml' && call[3]?.align === 'right')
    ).toBe(true)

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    expect(payloads.some((value) => /Vol:\s*5\s*ml/i.test(value))).toBe(false)
    expect(payloads.some((value) => /Strength:\s*5\s*ml/i.test(value))).toBe(false)
  })

  it('does not render liquid bottles pack meta on second line', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([
      {
        drugName: 'Corex',
        brandName: 'Corex',
        genericName: 'Corex',
        strength: '100',
        strengthUnit: 'ml'
      }
    ])

    const selectedPatient = {
      firstName: 'Bottle',
      lastName: 'Case',
      idNumber: 'ID658',
      dateOfBirth: '1992-05-21'
    }
    const prescriptions = [{
      id: 'med-liquid-2',
      name: 'Corex',
      dosageForm: 'Liquid (bottles)',
      liquidAmountMl: '120',
      liquidDosePerFrequencyMl: '5',
      frequency: '',
      duration: ''
    }]

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    expect(payloads.some((value) => /Pack:\s*100\s*ml/i.test(value))).toBe(false)
    expect(payloads.some((value) => /Amount:\s*120\s*ml/i.test(value))).toBe(false)
  })

  it('renders liquid bottles strength on right while keeping volume + quantity on second line', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])
    const selectedPatient = {
      firstName: 'Bottle',
      lastName: 'Strength',
      idNumber: 'ID907',
      dateOfBirth: '1992-05-21'
    }
    const prescriptions = [{
      id: 'med-liquid-bottle-strength-1',
      source: 'inventory',
      name: 'Salbutamol Syrup-Ace',
      dosageForm: 'Liquid (bottles)',
      strength: '5',
      strengthUnit: 'mg',
      inventoryStrengthText: '100 ml',
      qts: '1',
      frequency: 'Three times daily (TDS)',
      duration: '5 days',
      liquidAmountMl: '1'
    }]

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const textCalls = lastPdfProxy?._fns?.text?.mock?.calls || []
    expect(
      textCalls.some((call) => call[0] === '5 mg' && call[3]?.align === 'right')
    ).toBe(true)

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    expect(payloads.some((value) => /Vol:\s*100\s*ml/i.test(value))).toBe(true)
    expect(payloads.some((value) => /Liquid\s*\(bottles\)\s*\|\s*Quantity:\s*01/i.test(value))).toBe(true)
    expect(payloads.some((value) => /Amount:/i.test(value))).toBe(false)
  })

  it('shows 5 ml strength on right for liquid bottles while keeping Vol 100 ml + quantity on second line', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])
    const selectedPatient = {
      firstName: 'Salbutamol',
      lastName: 'Case',
      idNumber: 'ID908',
      dateOfBirth: '1992-05-21'
    }
    const prescriptions = [{
      id: 'med-liquid-bottle-strength-2',
      source: 'inventory',
      name: 'Salbutamol Syrup-Ace',
      dosageForm: 'Liquid (bottles)',
      strength: '5',
      strengthUnit: 'ml',
      inventoryStrengthText: '100 ml',
      qts: '1',
      frequency: 'Three times daily (TDS)',
      duration: '5 days'
    }]

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const textCalls = lastPdfProxy?._fns?.text?.mock?.calls || []
    expect(
      textCalls.some((call) => call[0] === '5 ml' && call[3]?.align === 'right')
    ).toBe(true)
    expect(
      textCalls.some((call) => call[0] === '100 ml' && call[3]?.align === 'right')
    ).toBe(false)

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    expect(payloads.some((value) => /Vol:\s*100\s*ml/i.test(value))).toBe(true)
    expect(payloads.some((value) => /Liquid\s*\(bottles\)\s*\|\s*Quantity:\s*01/i.test(value))).toBe(true)
  })

  it('renders inventory strength in right header without duplicating second-line strength for non-QTY medication', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])
    const selectedPatient = {
      firstName: 'Inventory',
      lastName: 'Strength',
      idNumber: 'ID900',
      dateOfBirth: '1992-05-21'
    }
    const prescriptions = [{
      id: 'med-nonqty-1',
      source: 'inventory',
      name: 'Paracetamol',
      dosageForm: 'Tablet',
      strength: '',
      strengthUnit: '',
      inventoryStrengthText: '500 mg',
      dosage: '1',
      frequency: 'Twice daily (BD)',
      duration: '5 days'
    }]

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const textCalls = lastPdfProxy?._fns?.text?.mock?.calls || []
    expect(
      textCalls.some((call) => call[0] === '500 mg' && call[3]?.align === 'right')
    ).toBe(true)

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    expect(payloads.some((value) => /Strength:\s*500\s*mg/i.test(value))).toBe(false)
  })

  it('renders inventory volume as Vol on second line for inventory medication', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])
    const selectedPatient = {
      firstName: 'Inventory',
      lastName: 'Volume',
      idNumber: 'ID901',
      dateOfBirth: '1992-05-21'
    }
    const prescriptions = [{
      id: 'med-inv-vol-1',
      source: 'inventory',
      name: 'Corex',
      dosageForm: 'Liquid (bottles)',
      strength: '',
      strengthUnit: '',
      inventoryStrengthText: '100 ml',
      dosage: '1',
      frequency: 'Twice daily (BD)',
      duration: '5 days'
    }]

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    expect(payloads.some((value) => /Vol:\s*100\s*ml/i.test(value))).toBe(true)
    expect(payloads.some((value) => /Strength:\s*100\s*ml/i.test(value))).toBe(false)
  })

  it('renders inventory volume as Vol on second line for liter units', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])
    const selectedPatient = {
      firstName: 'Inventory',
      lastName: 'Liter',
      idNumber: 'ID902',
      dateOfBirth: '1992-05-21'
    }
    const prescriptions = [{
      id: 'med-inv-vol-l-1',
      source: 'inventory',
      name: 'Saline',
      dosageForm: 'Liquid (bottles)',
      strength: '',
      strengthUnit: '',
      inventoryStrengthText: '1 l',
      dosage: '1',
      frequency: 'Once daily (OD)',
      duration: '3 days'
    }]

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    expect(payloads.some((value) => /Vol:\s*1\s*l/i.test(value))).toBe(true)
    expect(payloads.some((value) => /Strength:\s*1\s*l/i.test(value))).toBe(false)
  })

  it('does not render packet volume in right header label and keeps it as Vol second line', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])
    const selectedPatient = {
      firstName: 'Packet',
      lastName: 'Volume',
      idNumber: 'ID904',
      dateOfBirth: '1992-05-21'
    }
    const prescriptions = [{
      id: 'med-packet-vol-1',
      source: 'inventory',
      name: 'Jeewani',
      dosageForm: 'Packet',
      strength: '200',
      strengthUnit: 'ml',
      inventoryStrengthText: '200 ml',
      dosage: '1',
      frequency: 'Once daily (OD)',
      duration: '5 days'
    }]

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    expect(payloads.some((value) => /Vol:\s*200\s*ml/i.test(value))).toBe(true)

    const textStrings = collectPdfTextStrings().map((value) => normalizeText(value))
    expect(textStrings).not.toContain('200 ml')
  })

  it('renders packet volume and quantity together on second line and keeps volume out of right header', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])
    const selectedPatient = {
      firstName: 'Packet',
      lastName: 'Qty',
      idNumber: 'ID905',
      dateOfBirth: '1992-05-21'
    }
    const prescriptions = [{
      id: 'med-packet-qty-1',
      source: 'inventory',
      name: 'ORS-Jeevanee',
      dosageForm: 'Packet',
      strength: '1000',
      strengthUnit: 'ml',
      inventoryStrengthText: '1000 ml',
      qts: '3',
      frequency: 'As needed (PRN-SOS)',
      duration: '2 days'
    }]

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const textCalls = lastPdfProxy?._fns?.text?.mock?.calls || []
    expect(
      textCalls.some((call) => call[0] === '1000 ml' && call[3]?.align === 'right')
    ).toBe(false)

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    expect(payloads.some((value) => /Packet\s*\|\s*Quantity:\s*03/i.test(value))).toBe(true)
    expect(payloads.some((value) => /Vol:\s*1000\s*ml/i.test(value))).toBe(true)
    expect(payloads.some((value) => /Vol:\s*1000\s*ml\s*\|\s*Packet\s*\|\s*Quantity:\s*03/i.test(value))).toBe(true)
    expect(payloads.some((value) => /Vol:\s*1000\s*ml\s*\|\s*Vol:\s*1000\s*ml/i.test(value))).toBe(false)
  })

  it('keeps non-strength dispense forms off right header and moves inventory amount to second line', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])
    const selectedPatient = {
      firstName: 'Qty',
      lastName: 'Strength',
      idNumber: 'ID906',
      dateOfBirth: '1992-05-21'
    }
    const prescriptions = [{
      id: 'med-qty-strength-1',
      source: 'inventory',
      name: 'Dandex',
      dosageForm: 'Shampoo',
      strength: '',
      strengthUnit: '',
      inventoryStrengthText: '500 mg',
      qts: '1',
      frequency: '',
      duration: '5 days'
    }]

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const textCalls = lastPdfProxy?._fns?.text?.mock?.calls || []
    expect(
      textCalls.some((call) => call[0] === '500 mg' && call[3]?.align === 'right')
    ).toBe(false)

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    expect(payloads.some((value) => /Shampoo\s*\|\s*Quantity:\s*01/i.test(value))).toBe(true)
    expect(payloads.some((value) => /Vol:\s*500\s*mg/i.test(value))).toBe(true)
    expect(payloads.some((value) => /Strength:\s*500\s*mg/i.test(value))).toBe(false)
  })

  it.each([
    'Cream',
    'Ointment',
    'Gel',
    'Suppository',
    'Inhaler',
    'Spray',
    'Shampoo',
    'Packet',
    'Roll'
  ])('treats unit-only %s rows as non-strength forms and keeps 15 g off right header', async (dispenseUnit) => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])
    const selectedPatient = {
      firstName: 'UnitOnly',
      lastName: dispenseUnit,
      idNumber: 'ID915',
      dateOfBirth: '1992-05-21'
    }
    const prescriptions = [{
      id: `med-unit-only-${dispenseUnit.toLowerCase()}-1`,
      source: 'inventory',
      name: `UnitOnly ${dispenseUnit}`,
      dosageForm: '',
      form: '',
      unit: dispenseUnit,
      strength: '15',
      strengthUnit: 'g',
      qts: '1',
      frequency: 'Twice daily (BD)',
      duration: '7 days'
    }]

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const textCalls = lastPdfProxy?._fns?.text?.mock?.calls || []
    expect(
      textCalls.some((call) => call[0] === '15 g' && call[3]?.align === 'right')
    ).toBe(false)

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    expect(payloads.some((value) => /Vol:\s*15\s*g/i.test(value))).toBe(true)
    const quantityPattern = new RegExp(`${dispenseUnit}\\s*\\|\\s*Quantity:\\s*01`, 'i')
    expect(payloads.some((value) => quantityPattern.test(value))).toBe(true)
  })

  it('does not print count + dispense-form in right header label', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])
    const selectedPatient = {
      firstName: 'Header',
      lastName: 'Label',
      idNumber: 'ID903',
      dateOfBirth: '1992-05-21'
    }
    const prescriptions = [
      {
        id: 'med-header-1',
        source: 'manual',
        name: 'Corexb',
        dosageForm: 'Liquid (bottles)',
        dosage: '1',
        qts: '3',
        frequency: 'Four times daily (QDS)',
        duration: '15 days',
        strength: '',
        strengthUnit: ''
      },
      {
        id: 'med-header-2',
        source: 'manual',
        name: 'Dermox',
        dosageForm: 'Cream',
        dosage: '1',
        qts: '5',
        frequency: 'Twice daily (BD)',
        duration: '7 days',
        strength: '',
        strengthUnit: ''
      }
    ]

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))
    const textStrings = collectPdfTextStrings().map((v) => normalizeText(v))

    expect(textStrings).not.toContain('1 Liquid (bottles)')
    expect(textStrings).not.toContain('1 Cream')
  })

  it.each([
    {
      title: 'qts scenario with placeholder duration',
      medications: [{
        id: 'sep-qts-1',
        name: 'Dandex',
        dosageForm: 'Shampoo',
        qts: '1',
        strength: '100',
        strengthUnit: 'mg',
        frequency: '',
        duration: 'days'
      }]
    },
    {
      title: 'non-qts scenario with missing timing and duration',
      medications: [{
        id: 'sep-tab-1',
        name: 'Paracetamol',
        dosageForm: 'Tablet',
        dosage: '1',
        strength: '500',
        strengthUnit: 'mg',
        frequency: 'Once daily (OD)',
        duration: ''
      }]
    }
  ])('does not emit malformed separators for $title', async ({ medications }) => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])
    const selectedPatient = {
      firstName: 'Separator',
      lastName: 'Guard',
      idNumber: 'ID650',
      dateOfBirth: '1990-01-01'
    }

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions: medications, symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
    const payloads = splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
    const merged = normalizeText(payloads.join(' '))
    expect(merged).not.toMatch(/\|\|/)
    expect(merged).not.toMatch(/\|\s*\|/)
    expect(merged).not.toMatch(/\|\s*Duration:\s*days\b/i)
  })

  it('shows no medications fallback when prescription list is empty', async () => {
    const selectedPatient = {
      firstName: 'NoMed',
      lastName: 'Patient',
      idNumber: 'ID789',
      dateOfBirth: '2000-01-01'
    }
    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions: [], symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const strings = collectPdfTextStrings()
    expect(strings.some((value) => /No medications prescribed\./i.test(value))).toBe(true)
  })

  it('uses selectedPatient.doctorId for pharmacy stock lookup when auth doctor id is missing', async () => {
    doctorAuthService.getCurrentDoctor.mockReturnValue({ email: '' })

    const selectedPatient = {
      firstName: 'Lookup',
      lastName: 'Fallback',
      idNumber: 'ID999',
      dateOfBirth: '1988-11-02',
      doctorId: 'doc-from-patient'
    }
    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions: [], symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    expect(pharmacyMedicationService.getPharmacyStock).toHaveBeenCalledWith('doc-from-patient')
  })

  it('still generates PDF when pharmacy stock lookup fails', async () => {
    pharmacyMedicationService.getPharmacyStock.mockRejectedValueOnce(new Error('Stock service down'))

    const selectedPatient = {
      firstName: 'Resilient',
      lastName: 'PDF',
      idNumber: 'ID200',
      dateOfBirth: '1992-03-10'
    }

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions: [], symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    expect(global.URL.createObjectURL).toHaveBeenCalled()
    expect(global.open).toHaveBeenCalled()
  })

  it('uses printed template settings and skips default header text', async () => {
    doctorAuthService.getCurrentDoctor.mockReturnValue({ id: 'doctor-1', email: 'doc@test.com' })
    firebaseStorage.getDoctorByEmail.mockResolvedValue({ id: 'doctor-1' })
    firebaseStorage.getDoctorTemplateSettings.mockResolvedValue({
      templateType: 'printed',
      headerSize: 200
    })

    const selectedPatient = {
      firstName: 'Template',
      lastName: 'Printed',
      idNumber: 'ID300',
      dateOfBirth: '1991-06-18'
    }

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions: [], symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    const strings = collectPdfTextStrings()
    const hasDefaultHeader = strings.some((value) => /MEDICAL PRESCRIPTION/i.test(value))
    expect(hasDefaultHeader).toBe(false)
    expect(global.URL.createObjectURL).toHaveBeenCalled()
    expect(global.open).toHaveBeenCalled()
  })

  it('renders uploaded template header image in PDF generation', async () => {
    doctorAuthService.getCurrentDoctor.mockReturnValue({ id: 'doctor-1', email: 'doc@test.com' })
    firebaseStorage.getDoctorByEmail.mockResolvedValue({ id: 'doctor-1' })
    firebaseStorage.getDoctorTemplateSettings.mockResolvedValue({
      templateType: 'upload',
      uploadedHeader: 'data:image/png;base64,AAAA',
      headerSize: 220
    })

    const originalImage = global.Image
    class MockImage {
      constructor() {
        this.width = 1000
        this.height = 200
      }
      set src(_value) {
        if (this.onload) {
          this.onload()
        }
      }
    }
    global.Image = MockImage

    try {
      const selectedPatient = {
        firstName: 'Template',
        lastName: 'Uploaded',
        idNumber: 'ID301',
        dateOfBirth: '1993-08-22'
      }

      const { getByText } = render(PrescriptionPDF, {
        props: { selectedPatient, illnesses: [], prescriptions: [], symptoms: [] }
      })

      await fireEvent.click(getByText('Generate PDF'))

      const addImageCalls = lastPdfProxy?._fns?.addImage?.mock?.calls || []
      const hasUploadedHeader = addImageCalls.some((call) =>
        typeof call?.[0] === 'string' && call[0].startsWith('data:image/png;base64,AAAA')
      )

      expect(hasUploadedHeader).toBe(true)
      expect(global.URL.createObjectURL).toHaveBeenCalled()
      expect(global.open).toHaveBeenCalled()
    } finally {
      global.Image = originalImage
    }
  })

  it('still generates PDF when barcode rendering fails', async () => {
    JsBarcode.mockImplementationOnce(() => {
      throw new Error('Barcode render failed')
    })

    const selectedPatient = {
      firstName: 'Barcode',
      lastName: 'Failure',
      idNumber: 'ID302',
      dateOfBirth: '1994-02-12'
    }

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions: [], symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    expect(global.URL.createObjectURL).toHaveBeenCalled()
    expect(global.open).toHaveBeenCalled()
  })

  it('renders a long medication list (first and last entries) and generates PDF', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])

    const selectedPatient = {
      firstName: 'Long',
      lastName: 'List',
      idNumber: 'ID400',
      dateOfBirth: '1990-02-01'
    }

    const prescriptions = Array.from({ length: 140 }, (_, index) => ({
      id: `med-${index + 1}`,
      name: `Drug ${index + 1}`,
      dosage: '1',
      strength: '1',
      strengthUnit: 'mg',
      frequency: 'Once daily (OD)',
      duration: '1 day',
      instructions: 'Very long instruction text to force wrapping and vertical growth in the PDF layout'
    }))

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [] }
    })

    if (lastPdfProxy?._fns?.splitTextToSize) {
      lastPdfProxy._fns.splitTextToSize.mockImplementation((text) =>
        Array.from({ length: 20 }, () => String(text || ''))
      )
    }

    await fireEvent.click(getByText('Generate PDF'))

    const strings = collectPdfTextStrings()
    expect(strings.some((value) => /Drug 1/i.test(value))).toBe(true)
    expect(strings.some((value) => /Drug 140/i.test(value))).toBe(true)
    expect(lastPdfProxy?._fns?.addPage?.mock?.calls?.length || 0).toBeGreaterThan(0)
    expect(global.URL.createObjectURL).toHaveBeenCalled()
    expect(global.open).toHaveBeenCalled()
  })

  it('renders system template header via html2canvas capture', async () => {
    doctorAuthService.getCurrentDoctor.mockReturnValue({ id: 'doctor-1', email: 'doc@test.com' })
    firebaseStorage.getDoctorByEmail.mockResolvedValue({ id: 'doctor-1' })
    firebaseStorage.getDoctorTemplateSettings.mockResolvedValue({
      templateType: 'system',
      templatePreview: {
        formattedHeader: '<h1>Doctor Header</h1>'
      }
    })

    const selectedPatient = {
      firstName: 'System',
      lastName: 'Template',
      idNumber: 'ID500',
      dateOfBirth: '1985-01-01'
    }

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient, illnesses: [], prescriptions: [], symptoms: [] }
    })

    await fireEvent.click(getByText('Generate PDF'))

    await waitFor(() => {
      expect(html2canvas).toHaveBeenCalled()
      expect(global.URL.createObjectURL).toHaveBeenCalled()
      expect(global.open).toHaveBeenCalled()
    })
  })

  it('keeps system template preview content in generated PDF header capture (preview/save parity)', async () => {
    await renderAndGenerate({
      templateType: 'system',
      templatePreview: {
        formattedHeader: '<h1>Dr Saved Header</h1><p>Reg 17607</p>'
      }
    })

    await waitFor(() => {
      expect(html2canvas).toHaveBeenCalled()
    })

    const captureNode = html2canvas.mock.calls[0]?.[0]
    const capturedText = squish(captureNode?.textContent)
    const expectedPreviewText = squish('Dr Saved Header Reg 17607')
    expect(capturedText).toContain(expectedPreviewText)

    const addImageCalls = lastPdfProxy?._fns?.addImage?.mock?.calls || []
    const hasCapturedSystemHeader = addImageCalls.some((call) =>
      typeof call?.[0] === 'string' && call[0].includes('SYSTEM_HEADER')
    )
    expect(hasCapturedSystemHeader).toBe(true)
  })

  it('uses formattedHeader over headerText when both are present', async () => {
    await renderAndGenerate({
      templateType: 'system',
      templatePreview: {
        formattedHeader: '<h1>Preferred Preview Header</h1>'
      },
      headerText: 'Fallback Header Text'
    })

    const captureNode = html2canvas.mock.calls[0]?.[0]
    const captured = squish(captureNode?.textContent)
    expect(captured).toContain(squish('Preferred Preview Header'))
    expect(captured).not.toContain(squish('Fallback Header Text'))
  })

  it('uses the exact saved editor HTML for system header capture', async () => {
    const editorHtml = `
      <h3 style="margin: 0;">Dr. Exact Match</h3>
      <p><strong>Reg:</strong> 17607</p>
      <p>Mobile: 0718454397</p>
    `

    await renderAndGenerate({
      templateType: 'system',
      templatePreview: {
        formattedHeader: editorHtml
      },
      headerText: editorHtml
    })

    const captureNode = html2canvas.mock.calls[0]?.[0]
    const editorNode = captureNode?.querySelector('.ql-editor')
    expect(editorNode).toBeTruthy()
    expect(normalizeHtml(editorNode?.innerHTML)).toBe(normalizeHtml(editorHtml))
  })

  it('falls back to headerText when templatePreview.formattedHeader is missing', async () => {
    await renderAndGenerate({
      templateType: 'system',
      templatePreview: null,
      headerText: '<p>Legacy Saved Header</p>'
    })

    const captureNode = html2canvas.mock.calls[0]?.[0]
    const captured = squish(captureNode?.textContent)
    expect(captured).toContain(squish('Legacy Saved Header'))
  })

  it('preserves rich preview structure (heading, paragraph, image) in capture node before PDF rendering', async () => {
    await renderAndGenerate({
      templateType: 'system',
      templatePreview: {
        formattedHeader: '<h2>Clinic Name</h2><p>Address Line</p><img src="data:image/png;base64,AAAA" />'
      }
    })

    const captureNode = html2canvas.mock.calls[0]?.[0]
    const heading = captureNode?.querySelector('h2')
    const paragraph = captureNode?.querySelector('p')
    const image = captureNode?.querySelector('img')

    expect(heading?.textContent || '').toContain('Clinic Name')
    expect(paragraph?.textContent || '').toContain('Address Line')
    expect(image?.getAttribute('src') || '').toContain('data:image/png;base64,AAAA')
  })

  it('keeps saved system header preview and generated capture text semantically equal with mixed markup', async () => {
    await renderAndGenerate({
      templateType: 'system',
      templatePreview: {
        formattedHeader: `
          <h1>Dr. Amitha Karunanayake</h1>
          <p>S.L.M.C. Reg No: 17607</p>
          <p>Mobile: 071 845 4397</p>
        `
      },
      headerText: '<p>fallback text should not be used</p>'
    })

    const captureNode = html2canvas.mock.calls[0]?.[0]
    const capturedText = normalizeText(captureNode?.textContent)
    const expected = normalizeText('Dr. Amitha Karunanayake S.L.M.C. Reg No: 17607 Mobile: 071 845 4397')

    expect(capturedText).toContain(expected)
    expect(capturedText).not.toContain('fallback text should not be used')
  })

  it('sanitizes system header HTML before capture (no script or inline handlers)', async () => {
    await renderAndGenerate({
      templateType: 'system',
      templatePreview: {
        formattedHeader: '<h2 onclick="alert(1)">Safe Header</h2><script>alert(2)</script><img src="javascript:alert(3)" onerror="alert(4)" />'
      }
    })

    const captureNode = html2canvas.mock.calls[0]?.[0]
    const html = captureNode?.innerHTML || ''

    expect(html.toLowerCase()).not.toContain('<script')
    expect(html.toLowerCase()).not.toContain('onclick=')
    expect(html.toLowerCase()).not.toContain('onerror=')
    expect(html.toLowerCase()).not.toContain('javascript:')
    expect(captureNode?.textContent || '').toContain('Safe Header')
  })

  it('keeps entered system header content identical in HTML5 print output (preview-to-pdf parity)', async () => {
    doctorAuthService.getCurrentDoctor.mockReturnValue({ id: 'doctor-1', email: 'doc@test.com' })
    firebaseStorage.getDoctorByEmail.mockResolvedValue({ id: 'doctor-1' })

    const enteredHeaderHtml = `
      <h2>Dr. WYSIWYG Match</h2>
      <p><strong>Reg No:</strong> 17607</p>
      <p>Mobile: 071 845 4397</p>
    `
    firebaseStorage.getDoctorTemplateSettings.mockResolvedValue({
      templateType: 'system',
      templatePreview: {
        formattedHeader: enteredHeaderHtml
      },
      headerText: '<p>fallback should not appear</p>'
    })

    const printWindowMock = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn()
      },
      focus: vi.fn(),
      print: vi.fn()
    }
    global.open = vi.fn(() => printWindowMock)

    const { getByText } = render(PrescriptionPDF, {
      props: { selectedPatient: parityPatient, illnesses: [], prescriptions: [], symptoms: [] }
    })

    await fireEvent.click(getByText('Print / Save PDF (HTML5)'))

    await waitFor(() => {
      expect(printWindowMock.document.write).toHaveBeenCalledTimes(1)
    })

    const printedHtml = printWindowMock.document.write.mock.calls[0][0]
    const container = document.createElement('div')
    container.innerHTML = printedHtml

    const printedEditor = container.querySelector('.rx-system-header .ql-editor')
    expect(printedEditor).toBeTruthy()
    expect(normalizeHtml(printedEditor?.innerHTML)).toBe(normalizeHtml(enteredHeaderHtml))

    const printedText = normalizeText(container.textContent)
    expect(printedText).toContain(normalizeText('Dr. WYSIWYG Match Reg No: 17607 Mobile: 071 845 4397'))
    expect(printedText).not.toContain('fallback should not appear')

    const printedStyles = normalizeText(container.querySelector('style')?.textContent || '')
    expect(printedStyles).toContain(normalizeText('@page { size: A5 portrait; margin: 8mm; }'))
    expect(printedStyles).toContain(normalizeText('.rx-paper'))
  })
})
