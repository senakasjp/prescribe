import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import chargeCalculationService from '../../services/pharmacist/chargeCalculationService.js'
import { buildInventoryDispensePlan } from '../../utils/inventoryDispensePlan.js'
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

vi.mock('../../services/doctor/doctorAuthService.js', () => ({
  default: {
    getCurrentDoctor: vi.fn(() => ({ id: 'doc-1', email: 'doctor@test.com' }))
  }
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getDoctorById: vi.fn(() => Promise.resolve({ id: 'doc-1', currency: 'LKR' })),
    getDoctorByEmail: vi.fn(() => Promise.resolve({ id: 'doc-1', currency: 'LKR' })),
    getDoctorTemplateSettings: vi.fn(() => Promise.resolve(null))
  }
}))

vi.mock('../../services/pharmacyMedicationService.js', () => ({
  pharmacyMedicationService: {
    getPharmacyStock: vi.fn(() => Promise.resolve([]))
  }
}))

const collectPdfSplitPayloads = () => {
  const splitCalls = lastPdfProxy?._fns?.splitTextToSize?.mock?.calls || []
  return splitCalls.map((call) => call[0]).filter((value) => typeof value === 'string')
}

describe('critical workflow breakage guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.URL.createObjectURL = vi.fn(() => 'blob:critical')
    global.open = vi.fn()
  })

  it('doctor -> pharmacy -> dispense -> billing with mixed forms preserves expected totals and allocation', () => {
    const prescription = {
      id: 'rx-critical-1',
      discount: 0,
      medications: [
        {
          id: 'm-tab',
          name: 'Paracetamol',
          dosageForm: 'Tablet',
          amount: '10',
          dosage: '1',
          strength: '500',
          strengthUnit: 'mg'
        },
        {
          id: 'm-bottle',
          name: 'Dompi Suspension 5mg/5ml',
          dosageForm: 'Liquid (bottles)',
          amount: '2',
          qts: '2',
          strength: '10',
          strengthUnit: 'ml'
        },
        {
          id: 'm-cream',
          name: 'Dermketa',
          dosageForm: 'Cream',
          qts: '2',
          totalVolume: '15',
          volumeUnit: 'g',
          strength: '15',
          strengthUnit: 'g'
        },
        {
          id: 'm-packet',
          name: 'ORS-Jeevanee',
          dosageForm: 'Packet',
          qts: '1',
          strength: '200',
          strengthUnit: 'ml'
        },
        {
          id: 'm-measured',
          name: 'Antipa',
          dosageForm: 'Liquid (measured)',
          strength: '5',
          strengthUnit: 'ml',
          frequency: 'Twice daily (BD)',
          duration: '2 days'
        }
      ]
    }

    const inventoryItems = [
      { id: 'i-tab', brandName: 'Paracetamol', dosageForm: 'Tablet', currentStock: 100, sellingPrice: 5, expiryDate: '2028-01-01' },
      { id: 'i-bottle', brandName: 'Dompi Suspension 5mg/5ml', dosageForm: 'Liquid (bottles)', currentStock: 20, sellingPrice: 120, expiryDate: '2028-01-02' },
      { id: 'i-cream-10', brandName: 'Dermketa', dosageForm: 'Cream', containerSize: 10, containerUnit: 'g', currentStock: 50, sellingPrice: 171, expiryDate: '2028-01-03' },
      { id: 'i-cream-15', brandName: 'Dermketa', dosageForm: 'Cream', containerSize: 15, containerUnit: 'g', currentStock: 50, sellingPrice: 420, expiryDate: '2028-01-04' },
      { id: 'i-packet', brandName: 'ORS-Jeevanee', dosageForm: 'Packet', strength: '200', strengthUnit: 'ml', currentStock: 50, sellingPrice: 50, expiryDate: '2028-01-05' },
      { id: 'i-measured', brandName: 'Antipa', dosageForm: 'Liquid (measured)', unit: 'ml', currentStock: 1000, sellingPrice: 2, expiryDate: '2028-01-06' }
    ]

    const drugOnly = chargeCalculationService.calculateExpectedDrugChargesFromInventory(
      prescription,
      inventoryItems
    )
    expect(drugOnly.totalCost).toBe(1220)

    const fullCharge = chargeCalculationService.calculateExpectedChargeFromStock(
      prescription,
      { consultationCharge: 600, hospitalCharge: 150, roundingPreference: 'none' },
      inventoryItems,
      { currency: 'LKR', roundingPreference: 'none' }
    )
    expect(fullCharge.drugCharges.totalCost).toBe(1220)
    expect(fullCharge.totalCharge).toBe(1970)

    const bottleLine = drugOnly.medicationBreakdown.find((line) => line.medicationName === 'Dompi Suspension 5mg/5ml')
    expect(bottleLine).toBeTruthy()
    const allocationPreview = {
      orderedMatches: (bottleLine?.allocationDetails || []).map((entry) => ({
        inventoryItemId: entry.inventoryItemId,
        allocated: entry.quantity
      }))
    }
    const dispensePlan = buildInventoryDispensePlan({
      inventoryData: { matches: allocationPreview.orderedMatches },
      allocationPreview,
      fallbackQuantity: '2'
    })
    expect(dispensePlan).toEqual([{ inventoryItemId: 'i-bottle', batchId: null, quantity: 2 }])
  })

  it('cross-form inventory collision matrix always selects compatible inventory rows', () => {
    const cases = [
      {
        medication: { name: 'Dompi', dosageForm: 'Liquid (bottles)', amount: '2', qts: '2' },
        inventory: [
          { id: 'm-measured', brandName: 'Dompi', dosageForm: 'Liquid (measured)', currentStock: 1000, sellingPrice: 4 },
          { id: 'm-bottle', brandName: 'Dompi', dosageForm: 'Liquid (bottles)', currentStock: 20, sellingPrice: 120 }
        ],
        expectedInventoryId: 'm-bottle'
      },
      {
        medication: { name: 'Dompi', dosageForm: 'Liquid (measured)', strength: '5', strengthUnit: 'ml', frequency: 'Twice daily (BD)', duration: '2 days' },
        inventory: [
          { id: 'x-bottle', brandName: 'Dompi', dosageForm: 'Liquid (bottles)', currentStock: 20, sellingPrice: 120 },
          { id: 'x-measured', brandName: 'Dompi', dosageForm: 'Liquid (measured)', unit: 'ml', currentStock: 1000, sellingPrice: 2 }
        ],
        expectedInventoryId: 'x-measured'
      },
      {
        medication: { name: 'Dermketa', dosageForm: 'Cream', qts: '2', totalVolume: '15', volumeUnit: 'g', strength: '15', strengthUnit: 'g' },
        inventory: [
          { id: 'c-10', brandName: 'Dermketa', dosageForm: 'Cream', containerSize: 10, containerUnit: 'g', currentStock: 20, sellingPrice: 171 },
          { id: 'c-15', brandName: 'Dermketa', dosageForm: 'Cream', containerSize: 15, containerUnit: 'g', currentStock: 20, sellingPrice: 420 }
        ],
        expectedInventoryId: 'c-15'
      },
      {
        medication: { name: 'ORS-Jeevanee', dosageForm: 'Packet', qts: '3', totalVolume: '1000', volumeUnit: 'ml', strength: '1000', strengthUnit: 'ml' },
        inventory: [
          { id: 'p-200', brandName: 'ORS-Jeevanee', dosageForm: 'Packet', containerSize: 200, containerUnit: 'ml', currentStock: 20, sellingPrice: 50 },
          { id: 'p-1000', brandName: 'ORS-Jeevanee', dosageForm: 'Packet', containerSize: 1000, containerUnit: 'ml', currentStock: 20, sellingPrice: 240 }
        ],
        expectedInventoryId: 'p-1000'
      }
    ]

    for (const testCase of cases) {
      const result = chargeCalculationService.calculateExpectedDrugChargesFromInventory(
        { id: `rx-${testCase.expectedInventoryId}`, medications: [testCase.medication] },
        testCase.inventory
      )
      expect(result.medicationBreakdown).toHaveLength(1)
      expect(result.medicationBreakdown[0].allocationDetails[0].inventoryItemId).toBe(testCase.expectedInventoryId)
    }
  })

  it('mixed-form PDF still keeps non-strength forms off right header while preserving volume metadata', async () => {
    const prescriptions = [
      {
        id: 'pdf-cream',
        source: 'inventory',
        name: 'Dermketa',
        dosageForm: 'Cream',
        strength: '15',
        strengthUnit: 'g',
        qts: '2',
        frequency: 'Twice daily (BD)',
        duration: '7 days'
      },
      {
        id: 'pdf-packet',
        source: 'inventory',
        name: 'ORS-Jeevanee',
        dosageForm: 'Packet',
        strength: '200',
        strengthUnit: 'ml',
        qts: '1',
        frequency: 'As needed (PRN-SOS)',
        duration: '1 days'
      }
    ]

    const view = render(PrescriptionPDF, {
      props: {
        selectedPatient: {
          firstName: 'Critical',
          lastName: 'Flow',
          idNumber: 'ID-C1',
          dateOfBirth: '1990-01-01'
        },
        illnesses: [],
        prescriptions,
        symptoms: []
      }
    })

    await fireEvent.click(view.getByText('Generate PDF'))
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled()
      expect(global.open).toHaveBeenCalled()
    })

    const splitPayloads = collectPdfSplitPayloads()
    expect(splitPayloads.some((value) => /Vol:\s*15\s*g/i.test(value))).toBe(true)
    expect(splitPayloads.some((value) => /Vol:\s*200\s*ml/i.test(value))).toBe(true)
    expect(splitPayloads.some((value) => /Vol:\s*200\s*ml\s*\|\s*Vol:\s*200\s*ml/i.test(value))).toBe(false)
  })
})
