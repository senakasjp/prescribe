/**
 * Unit tests for charge calculation service (memory-based)
 */
import { describe, it, expect, vi } from 'vitest'
import inventoryService from '../../services/pharmacist/inventoryService.js'
import chargeCalculationService from '../../services/pharmacist/chargeCalculationService.js'
import { resolveCurrencyFromCountry } from '../../utils/currencyByCountry.js'

vi.mock('../../services/pharmacist/inventoryService.js', () => ({
  default: {
    getInventoryItems: vi.fn()
  }
}))

describe('chargeCalculationService', () => {
  describe('roundTotalCharge', () => {
    it('should keep amount when rounding is none', () => {
      expect(chargeCalculationService.roundTotalCharge(1234, 'none')).toBe(1234)
    })

    it('should round to nearest 50', () => {
      expect(chargeCalculationService.roundTotalCharge(1224, 'nearest50')).toBe(1200)
      expect(chargeCalculationService.roundTotalCharge(1234, 'nearest50')).toBe(1250)
    })

    it('should round to nearest 100', () => {
      expect(chargeCalculationService.roundTotalCharge(1234, 'nearest100')).toBe(1200)
      expect(chargeCalculationService.roundTotalCharge(1270, 'nearest100')).toBe(1300)
    })
  })

  describe('calculateDoctorCharges', () => {
    it('should apply consultation + hospital charges with consultation discount', () => {
      const doctor = {
        consultationCharge: 1000,
        hospitalCharge: 500
      }
      const prescription = {
        discount: 10,
        discountScope: 'consultation'
      }

      const charges = chargeCalculationService.calculateDoctorCharges(prescription, doctor)
      expect(charges.totalBeforeDiscount).toBe(1500)
      expect(charges.discountAmount).toBe(100)
      expect(charges.totalAfterDiscount).toBe(1400)
    })

    it('should apply consultation + hospital discount when scope is consultation_hospital', () => {
      const doctor = {
        consultationCharge: 1000,
        hospitalCharge: 500
      }
      const prescription = {
        discount: 10,
        discountScope: 'consultation_hospital'
      }

      const charges = chargeCalculationService.calculateDoctorCharges(prescription, doctor)
      expect(charges.totalBeforeDiscount).toBe(1500)
      expect(charges.discountAmount).toBe(150)
      expect(charges.totalAfterDiscount).toBe(1350)
    })

    it('should exclude consultation charge when flagged', () => {
      const doctor = {
        consultationCharge: 1000,
        hospitalCharge: 500
      }
      const prescription = {
        excludeConsultationCharge: true
      }

      const charges = chargeCalculationService.calculateDoctorCharges(prescription, doctor)
      expect(charges.consultationCharge).toBe(0)
      expect(charges.totalBeforeDiscount).toBe(500)
    })

    it('should include procedure pricing from template settings', () => {
      const doctor = {
        consultationCharge: 1000,
        hospitalCharge: 500,
        templateSettings: {
          procedurePricing: [
            { name: 'ECG', price: 300 },
            { name: 'X-Ray', price: 500 }
          ]
        }
      }
      const prescription = {
        procedures: ['ECG', 'X-Ray']
      }

      const charges = chargeCalculationService.calculateDoctorCharges(prescription, doctor)
      expect(charges.procedureCharges.total).toBe(800)
      expect(charges.totalBeforeDiscount).toBe(2300)
    })
  })

  describe('calculatePrescriptionCharge', () => {
    it('should apply doctor rounding preference to total bill', async () => {
      const doctor = {
        id: 'doc-1',
        consultationCharge: 120,
        hospitalCharge: 30,
        roundingPreference: 'nearest100'
      }
      const prescription = {
        id: 'rx-1',
        doctorId: 'doc-1'
      }
      const pharmacist = {
        currency: 'LKR'
      }

      const doctorSpy = vi.spyOn(chargeCalculationService, 'getDoctorById')
        .mockResolvedValue(doctor)
      const drugSpy = vi.spyOn(chargeCalculationService, 'calculateDrugCharges')
        .mockResolvedValue({ totalCost: 0 })

      const breakdown = await chargeCalculationService.calculatePrescriptionCharge(prescription, pharmacist)

      expect(breakdown.roundingPreference).toBe('nearest100')
      expect(breakdown.totalBeforeRounding).toBe(150)
      expect(breakdown.totalCharge).toBe(200)

      doctorSpy.mockRestore()
      drugSpy.mockRestore()
    })
  })

  describe('parseMedicationQuantity', () => {
    it('should parse numeric quantities from strings', () => {
      expect(chargeCalculationService.parseMedicationQuantity('10 tablets')).toBe(10)
      expect(chargeCalculationService.parseMedicationQuantity('2.5')).toBe(2.5)
    })

    it('should return null when value is missing', () => {
      expect(chargeCalculationService.parseMedicationQuantity('')).toBe(null)
      expect(chargeCalculationService.parseMedicationQuantity(null)).toBe(null)
    })
  })

  describe('qts quantity pricing', () => {
    it('uses qts for non-tablet/capsule/syrup dosage forms', () => {
      const requested = chargeCalculationService.resolveRequestedQuantity({
        dosageForm: 'Suppository',
        qts: '3',
        amount: '30'
      })

      expect(requested).toBe(3)
    })

    it('falls back to amount for tablet/capsule dosage forms', () => {
      const requested = chargeCalculationService.resolveRequestedQuantity({
        dosageForm: 'Tablet',
        qts: '3',
        amount: '30'
      })

      expect(requested).toBe(30)
    })

    it('normalizes qts to positive integer', () => {
      const requested = chargeCalculationService.resolveRequestedQuantity({
        dosageForm: 'Suppository',
        qts: '2.9',
        amount: '30'
      })

      expect(requested).toBe(2)
    })

    it('falls back to entered qts when liquid quantity cannot be derived', () => {
      const requested = chargeCalculationService.resolveRequestedQuantity({
        dosageForm: 'Liquid (bottles)',
        qts: '3',
        strength: '',
        strengthUnit: '',
        frequency: '',
        duration: ''
      })

      expect(requested).toBe(3)
    })

    it('ignores zero amount and calculates measured-liquid quantity from strength/frequency/duration', () => {
      const requested = chargeCalculationService.resolveRequestedQuantity({
        dosageForm: 'Liquid (measured)',
        amount: '0',
        strength: '5',
        strengthUnit: 'ml',
        frequency: 'Four times daily (QDS)',
        duration: '5 days'
      })

      // 5 ml * 4/day * 5 days
      expect(requested).toBe(100)
    })
  })

  describe('formatCurrency', () => {
    it('should format LKR with currency code when doctor country is Sri Lanka', () => {
      const currency = resolveCurrencyFromCountry('Sri Lanka')
      const formatted = chargeCalculationService.formatCurrency(1234.5, currency)
      expect(currency).toBe('LKR')
      expect(formatted).toContain('1,234.50')
      expect(formatted).toContain('LKR')
    })

    it('should format currency with code when doctor country is not Sri Lanka', () => {
      const currency = resolveCurrencyFromCountry('United States')
      const formatted = chargeCalculationService.formatCurrency(1234.5, currency)
      expect(currency).toBe('USD')
      expect(formatted).toBe('USD 1,234.50')
    })
  })

  describe('liquid pricing', () => {
    it('prices measured liquid meds by ml using inventory strength', async () => {
      inventoryService.getInventoryItems.mockResolvedValue([
        {
          id: 'inv-1',
          brandName: 'Corex',
          strength: '100',
          strengthUnit: 'ml',
          dosageForm: 'Liquid (measured)',
          currentStock: 10,
          sellingPrice: 20
        }
      ])

      const prescription = {
        id: 'rx-1',
        prescriptions: [
          {
            id: 'rx-1',
            medications: [
              {
                name: 'Corex',
                dosageForm: 'Liquid (measured)',
                strength: '50',
                strengthUnit: 'ml',
                frequency: 'three times daily',
                duration: '2 days',
                isDispensed: true
              }
            ]
          }
        ]
      }

      const pharmacist = { id: 'ph-1' }
      const result = await chargeCalculationService.calculateDrugCharges(prescription, pharmacist)

      expect(result.totalCost).toBeCloseTo(60, 4)
      expect(result.medicationBreakdown[0].quantity).toBeCloseTo(300, 4)
    })

    it('prices Liquid (bottles) by bottle count, not per ml', async () => {
      inventoryService.getInventoryItems.mockResolvedValue([
        {
          id: 'inv-bottle-1',
          brandName: 'Corex',
          strength: '100',
          strengthUnit: 'ml',
          dosageForm: 'Liquid (bottles)',
          currentStock: 5,
          sellingPrice: 20
        }
      ])

      const prescription = {
        id: 'rx-bottle-1',
        prescriptions: [
          {
            id: 'rx-bottle-1',
            medications: [
              {
                name: 'Corex',
                dosageForm: 'Liquid (bottles)',
                amount: '2',
                isDispensed: true
              }
            ]
          }
        ]
      }

      const result = await chargeCalculationService.calculateDrugCharges(prescription, { id: 'ph-1' })

      // 2 bottles * LKR 20 per bottle
      expect(result.totalCost).toBe(40)
      expect(result.medicationBreakdown[0].quantity).toBe(2)
      expect(result.medicationBreakdown[0].unitCost).toBe(20)
    })

    it('prices Liquid (measured) as unit ml price × strength(ml) × daily frequency × duration(days)', async () => {
      inventoryService.getInventoryItems.mockResolvedValue([
        {
          id: 'inv-measured-1',
          brandName: 'Corex',
          strength: '100',
          strengthUnit: 'ml',
          dosageForm: 'Liquid (measured)',
          currentStock: 10,
          sellingPrice: 20
        }
      ])

      const prescription = {
        id: 'rx-measured-1',
        prescriptions: [
          {
            id: 'rx-measured-1',
            medications: [
              {
                name: 'Corex',
                dosageForm: 'Liquid (measured)',
                strength: '50',
                strengthUnit: 'ml',
                frequency: 'three times daily',
                duration: '2 days',
                isDispensed: true
              }
            ]
          }
        ]
      }

      const pharmacist = { id: 'ph-1' }
      const result = await chargeCalculationService.calculateDrugCharges(prescription, pharmacist)

      // Inventory unit ml price = 20 / 100 = 0.2
      // Required ml = 50 * 3 * 2 = 300
      // Total = 300 * 0.2 = 60
      expect(result.totalCost).toBeCloseTo(60, 4)
      expect(result.medicationBreakdown[0].quantity).toBeCloseTo(300, 4)
      expect(result.medicationBreakdown[0].unitCost).toBeCloseTo(0.2, 4)
    })

    it('prices Liquid (measured) directly from per-ml inventory price without pack-size metadata', async () => {
      inventoryService.getInventoryItems.mockResolvedValue([
        {
          id: 'inv-measured-2',
          brandName: 'Corex',
          strength: '1',
          strengthUnit: 'bottle',
          dosageForm: 'Liquid (measured)',
          currentStock: 200,
          sellingPrice: 20
        }
      ])

      const prescription = {
        id: 'rx-measured-2',
        prescriptions: [
          {
            id: 'rx-measured-2',
            medications: [
              {
                name: 'Corex',
                dosageForm: 'Liquid (measured)',
                strength: '5',
                strengthUnit: 'ml',
                frequency: 'twice daily',
                duration: '2 days',
                isDispensed: true
              }
            ]
          }
        ]
      }

      const pharmacist = { id: 'ph-1' }
      const result = await chargeCalculationService.calculateDrugCharges(prescription, pharmacist)

      // quantity = 5 ml * 2/day * 2 days = 20 ml
      // unit price = 20 per ml
      expect(result.totalCost).toBe(400)
      expect(result.medicationBreakdown[0].found).toBe(true)
      expect(result.medicationBreakdown[0].quantity).toBe(20)
      expect(result.medicationBreakdown[0].unitCost).toBe(20)
    })
  })

  describe('mixed qts and non-qts allocation', () => {
    it('prices mixed qts and tablet medications with multi-batch allocation', () => {
      const prescription = {
        id: 'rx-mixed',
        medications: [
          {
            name: 'TopiCream',
            dosageForm: 'Cream',
            qts: '3'
          },
          {
            name: 'Paracetamol',
            dosageForm: 'Tablet',
            amount: '4'
          }
        ]
      }

      const inventoryItems = [
        {
          id: 'cream-b1',
          brandName: 'TopiCream',
          dosageForm: 'Cream',
          currentStock: 2,
          sellingPrice: 10,
          expiryDate: '2026-06-01'
        },
        {
          id: 'cream-b2',
          brandName: 'TopiCream',
          dosageForm: 'Cream',
          currentStock: 2,
          sellingPrice: 20,
          expiryDate: '2026-07-01'
        },
        {
          id: 'tab-b1',
          brandName: 'Paracetamol',
          dosageForm: 'Tablet',
          currentStock: 10,
          sellingPrice: 5,
          expiryDate: '2026-08-01'
        }
      ]

      const result = chargeCalculationService.calculateExpectedDrugChargesFromInventory(
        prescription,
        inventoryItems
      )

      expect(result.totalMedications).toBe(2)
      expect(result.totalCost).toBeCloseTo(60, 4)

      const creamLine = result.medicationBreakdown.find((line) => line.medicationName === 'TopiCream')
      const tabletLine = result.medicationBreakdown.find((line) => line.medicationName === 'Paracetamol')

      expect(creamLine.quantity).toBe(3)
      expect(creamLine.totalCost).toBeCloseTo(40, 4)
      expect(creamLine.allocationDetails).toHaveLength(2)

      expect(tabletLine.quantity).toBe(4)
      expect(tabletLine.totalCost).toBeCloseTo(20, 4)
      expect(tabletLine.allocationDetails).toHaveLength(1)
    })

    it('does not apply ml liquid pricing to packet/qts medications even when strength unit is ml', () => {
      const prescription = {
        id: 'rx-packet-ml',
        medications: [
          {
            name: 'Jeewani',
            dosageForm: 'Packet',
            qts: '2',
            strength: '200',
            strengthUnit: 'ml'
          }
        ]
      }

      const inventoryItems = [
        {
          id: 'packet-1',
          brandName: 'Jeewani',
          dosageForm: 'Packet',
          strength: '200',
          strengthUnit: 'ml',
          currentStock: 20,
          sellingPrice: 50,
          expiryDate: '2027-06-18'
        }
      ]

      const result = chargeCalculationService.calculateExpectedDrugChargesFromInventory(
        prescription,
        inventoryItems
      )

      // Count pricing: 2 packets * 50 each = 100 (must not become per-ml pricing)
      expect(result.totalCost).toBe(100)
      expect(result.medicationBreakdown).toHaveLength(1)
      expect(result.medicationBreakdown[0].quantity).toBe(2)
      expect(result.medicationBreakdown[0].unitCost).toBe(50)
    })

    it('does not mix measured-liquid inventory into liquid-bottle pricing for same drug name', () => {
      const prescription = {
        id: 'rx-liquid-bottle-vs-measured',
        medications: [
          {
            name: 'Dompi Suspension 5mg/5ml',
            dosageForm: 'Liquid (bottles)',
            amount: '2',
            qts: '2',
            strength: '10',
            strengthUnit: 'ml'
          }
        ]
      }

      const inventoryItems = [
        {
          id: 'dompi-measured',
          brandName: 'Dompi Suspension 5mg/5ml',
          dosageForm: 'Liquid (measured)',
          unit: 'ml',
          currentStock: 1000,
          sellingPrice: 4, // per-ml price
          expiryDate: '2027-01-01'
        },
        {
          id: 'dompi-bottle',
          brandName: 'Dompi Suspension 5mg/5ml',
          dosageForm: 'Liquid (bottles)',
          currentStock: 20,
          sellingPrice: 120, // per-bottle price
          expiryDate: '2027-01-02'
        }
      ]

      const result = chargeCalculationService.calculateExpectedDrugChargesFromInventory(
        prescription,
        inventoryItems
      )

      expect(result.medicationBreakdown).toHaveLength(1)
      expect(result.medicationBreakdown[0].quantity).toBe(2)
      expect(result.medicationBreakdown[0].unitCost).toBe(120)
      expect(result.medicationBreakdown[0].totalCost).toBe(240)
      expect(result.medicationBreakdown[0].allocationDetails[0].inventoryItemId).toBe('dompi-bottle')
    })

    it('matches non-strength forms by capacity so 15 g is not priced as 10 g', () => {
      const prescription = {
        id: 'rx-cream-capacity',
        medications: [
          {
            name: 'Dermketa',
            dosageForm: 'Cream',
            qts: '2',
            totalVolume: '15',
            volumeUnit: 'g',
            strength: '15',
            strengthUnit: 'g'
          }
        ]
      }

      const inventoryItems = [
        {
          id: 'cream-10g',
          brandName: 'Dermketa',
          dosageForm: 'Cream',
          containerSize: 10,
          containerUnit: 'g',
          currentStock: 20,
          sellingPrice: 171,
          expiryDate: '2027-06-01'
        },
        {
          id: 'cream-15g',
          brandName: 'Dermketa',
          dosageForm: 'Cream',
          containerSize: 15,
          containerUnit: 'g',
          currentStock: 20,
          sellingPrice: 420,
          expiryDate: '2027-06-02'
        }
      ]

      const result = chargeCalculationService.calculateExpectedDrugChargesFromInventory(
        prescription,
        inventoryItems
      )

      expect(result.medicationBreakdown).toHaveLength(1)
      expect(result.medicationBreakdown[0].quantity).toBe(2)
      expect(result.medicationBreakdown[0].unitCost).toBe(420)
      expect(result.medicationBreakdown[0].totalCost).toBe(840)
      expect(result.medicationBreakdown[0].allocationDetails[0].inventoryItemId).toBe('cream-15g')
    })

    it('returns explicit pricing reason when inventory match has stock but missing selling price', async () => {
      inventoryService.getInventoryItems.mockResolvedValue([
        {
          id: 'antipa-b1',
          brandName: 'Antipa',
          genericName: 'Antipaa',
          dosageForm: 'Liquid (bottles)',
          currentStock: 200,
          sellingPrice: '',
          strength: '200',
          strengthUnit: 'ml',
          expiryDate: '2027-06-18'
        }
      ])

      const prescription = {
        id: 'rx-antipa-price-missing',
        prescriptions: [
          {
            id: 'rx-antipa-price-missing',
            medications: [
              {
                id: 'med-antipa',
                name: 'Antipa(Antipaa)',
                dosageForm: 'Liquid (bottles)',
                amount: '20',
                isDispensed: true
              }
            ]
          }
        ]
      }

      const result = await chargeCalculationService.calculateDrugCharges(prescription, { id: 'ph-1' })

      expect(result.medicationBreakdown).toHaveLength(1)
      expect(result.medicationBreakdown[0].found).toBe(false)
      expect(result.medicationBreakdown[0].note).toBe('Price missing in inventory')
    })

    it('marks partial allocation when qts exceeds available stock', async () => {
      inventoryService.getInventoryItems.mockResolvedValue([
        {
          id: 'cream-b1',
          brandName: 'TopiCream',
          dosageForm: 'Cream',
          currentStock: 3,
          sellingPrice: 10,
          expiryDate: '2026-06-01'
        }
      ])

      const prescription = {
        id: 'rx-partial',
        prescriptions: [
          {
            id: 'rx-partial',
            medications: [
              {
                name: 'TopiCream',
                dosageForm: 'Cream',
                qts: '5',
                isDispensed: true
              }
            ]
          }
        ]
      }

      const result = await chargeCalculationService.calculateDrugCharges(prescription, { id: 'ph-1' })

      expect(result.totalCost).toBeCloseTo(30, 4)
      expect(result.totalMedications).toBe(1)
      expect(result.medicationBreakdown[0].quantity).toBe(5)
      expect(result.medicationBreakdown[0].pricedQuantity).toBe(3)
      expect(result.medicationBreakdown[0].found).toBe(false)
      expect(result.medicationBreakdown[0].note).toContain('Only priced 3 of 5')
    })

    it('uses edited inventory stock and selling price values as calculation source of truth', () => {
      const prescription = {
        id: 'rx-edited',
        medications: [
          {
            name: 'Corex',
            dosageForm: 'Tablet',
            amount: '10'
          }
        ]
      }

      const baseline = chargeCalculationService.calculateExpectedDrugChargesFromInventory(
        prescription,
        [{
          id: 'corex-batch',
          brandName: 'Corex',
          dosageForm: 'Tablet',
          currentStock: 10,
          sellingPrice: 50,
          expiryDate: '2026-12-23'
        }]
      )

      const afterEdit = chargeCalculationService.calculateExpectedDrugChargesFromInventory(
        prescription,
        [{
          id: 'corex-batch',
          brandName: 'Corex',
          dosageForm: 'Tablet',
          currentStock: 10,
          sellingPrice: 80,
          expiryDate: '2026-12-23'
        }]
      )

      expect(baseline.totalCost).toBeCloseTo(500, 4)
      expect(afterEdit.totalCost).toBeCloseTo(800, 4)
      expect(afterEdit.totalCost).toBeGreaterThan(baseline.totalCost)
      expect(afterEdit.medicationBreakdown[0].pricedQuantity).toBe(10)
    })
  })
})
