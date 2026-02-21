/**
 * Component tests for PharmacistDashboard
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/svelte'
import PharmacistDashboard from '../../components/PharmacistDashboard.svelte'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

const chargeCalculationServiceMock = vi.hoisted(() => ({
  calculatePrescriptionCharge: vi.fn(() => Promise.resolve({
    doctorCharges: {
      consultationCharge: 0,
      excludeConsultationCharge: false,
      baseConsultationCharge: 0,
      hospitalCharge: 0,
      procedureCharges: {
        breakdown: []
      },
      discountPercentage: 0,
      discountScope: 'consultation_only',
      discountAmount: 0
    },
    drugCharges: {
      medicationBreakdown: [],
      totalCost: 0
    },
    totalBeforeRounding: 0,
    roundingAdjustment: 0,
    roundingPreference: 'none',
    totalCharge: 0
  }))
}))

vi.mock('../../services/pharmacist/chargeCalculationService.js', () => ({
  default: chargeCalculationServiceMock
}))

const inventoryServiceMock = vi.hoisted(() => ({
  getInventoryItems: vi.fn(() => Promise.resolve([])),
  findMatchingDrugs: vi.fn(() => []),
  migrateDrugStockToInventory: vi.fn(() => Promise.resolve({ migrated: 0 }))
}))

vi.mock('../../services/pharmacist/inventoryService.js', () => ({
  default: inventoryServiceMock
}))

describe('PharmacistDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chargeCalculationServiceMock.calculatePrescriptionCharge.mockResolvedValue({
      doctorCharges: {
        consultationCharge: 0,
        excludeConsultationCharge: false,
        baseConsultationCharge: 0,
        hospitalCharge: 0,
        procedureCharges: { breakdown: [] },
        discountPercentage: 0,
        discountScope: 'consultation_only',
        discountAmount: 0
      },
      drugCharges: {
        medicationBreakdown: [],
        totalCost: 0
      },
      totalBeforeRounding: 0,
      roundingAdjustment: 0,
      roundingPreference: 'none',
      totalCharge: 0
    })
    inventoryServiceMock.getInventoryItems.mockResolvedValue([])
    firebaseStorageMock.getPharmacistPrescriptions.mockResolvedValue([])
  })

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

  it('keeps patient Age and Sex fields visible with fallback values in prescription details modal', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const sourcePath = path.resolve(__dirname, '../../components/PharmacistDashboard.svelte')
    const source = fs.readFileSync(sourcePath, 'utf8')

    expect(source).toContain("<strong>Age:</strong> {selectedPrescription.patientAge || selectedPrescription.age || 'Not specified'}")
    expect(source).toContain("<strong>Sex:</strong> {selectedPrescription.patientSex || selectedPrescription.patientGender || selectedPrescription.sex || selectedPrescription.gender || 'Not specified'}")
  })

  it('keeps Liquid (bottles) remaining/allocation units in bottle counts (not ml conversion)', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const sourcePath = path.resolve(__dirname, '../../components/PharmacistDashboard.svelte')
    const source = fs.readFileSync(sourcePath, 'utf8')

    expect(source).toContain("return form === 'liquid (measured)'")
    expect(source).toContain("return form === 'liquid (bottles)'")
    expect(source).toContain("if (isLiquidBottlesMedication(medication)) return 'bottles'")
    expect(source).toContain("if (!isTabletOrCapsule && (normalized === 'tablet' || normalized === 'tablets' || !normalized))")
    expect(source).toContain('const liquidMode = isMeasuredLiquidMedication(medication)')
    expect(source).not.toContain('const liquidMode = isLiquidMedication(medication)')
  })

  it('shows strength in DOSAGE display when dosage value is blank', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const sourcePath = path.resolve(__dirname, '../../components/PharmacistDashboard.svelte')
    const source = fs.readFileSync(sourcePath, 'utf8')

    expect(source).toContain('const getDisplayDosageText = (medication) => {')
    expect(source).toContain("const dosage = String(medication?.dosage || '').trim()")
    expect(source).toContain('medication?.strength ?? \'\'')
    // Guard: both desktop + mobile dosage labels must render through helper,
    // so empty dosage falls back to strength/unit instead of blank cell.
    expect(source).toContain('{getDisplayDosageText(medication)}')
    // Guard against reverting back to direct dosage binding in either view.
    expect(source).not.toContain('>{medication.dosage}<')
  })

  it('normalizes legacy measured-liquid pricing error note in UI', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const sourcePath = path.resolve(__dirname, '../../components/PharmacistDashboard.svelte')
    const source = fs.readFileSync(sourcePath, 'utf8')

    expect(source).toContain('const normalizeChargeNote = (note) => {')
    expect(source).toContain('/inventory volume\\/strength missing for measured liquid/i.test(value)')
    expect(source).toContain("return 'Price missing in inventory'")
    expect(source).toContain('{normalizeChargeNote(medication.note) || \'Not available\'}')
  })

  it('shows amount unit hint under amount input in desktop and mobile views', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const sourcePath = path.resolve(__dirname, '../../components/PharmacistDashboard.svelte')
    const source = fs.readFileSync(sourcePath, 'utf8')

    expect(source).toContain('const getAmountUnitLabel = (prescriptionId, medication) => {')
    expect(source).toContain("if (form === 'liquid (measured)' || form.includes('syrup')) return 'ml'")
    expect(source).toContain("if (form === 'liquid (bottles)' || form === 'liquid') return 'bottles'")
    expect(source).toContain('{getAmountUnitLabel(prescription.id, medication)}')
  })

  it('mirrors edited amount into qts for count-based pricing forms', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const sourcePath = path.resolve(__dirname, '../../components/PharmacistDashboard.svelte')
    const source = fs.readFileSync(sourcePath, 'utf8')

    expect(source).toContain('const shouldMirrorAmountToQts = chargeCalculationService.isQtsMedication(medication)')
    expect(source).toContain('qts: qtsValue')
  })

  it('prevents measured-liquid and bottle-liquid rows from mixing in Remaining', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const sourcePath = path.resolve(__dirname, '../../components/PharmacistDashboard.svelte')
    const source = fs.readFileSync(sourcePath, 'utf8')

    expect(source).toContain('const isLiquidFormCompatible = (medicationForm, inventoryForm) => {')
    expect(source).toContain('if (medicationMeasured && inventoryBottle) return false')
    expect(source).toContain('if (medicationBottle && inventoryMeasured) return false')
    expect(source).toContain('if (!isLiquidFormCompatible(medicationForm, inventoryForm)) {')
  })

})
