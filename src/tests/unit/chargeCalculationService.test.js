/**
 * Unit tests for charge calculation service (memory-based)
 */
import { describe, it, expect, vi } from 'vitest'
import chargeCalculationService from '../../services/pharmacist/chargeCalculationService.js'
import { resolveCurrencyFromCountry } from '../../utils/currencyByCountry.js'

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

  describe('formatCurrency', () => {
    it('should format LKR without currency symbol when doctor country is Sri Lanka', () => {
      const currency = resolveCurrencyFromCountry('Sri Lanka')
      const formatted = chargeCalculationService.formatCurrency(1234.5, currency)
      expect(currency).toBe('LKR')
      expect(formatted).toContain('1,234.50')
      expect(formatted).not.toContain('LKR')
      expect(formatted).not.toContain('$')
    })

    it('should format currency with symbol when doctor country is not Sri Lanka', () => {
      const currency = resolveCurrencyFromCountry('United States')
      const formatted = chargeCalculationService.formatCurrency(1234.5, currency)
      expect(currency).toBe('USD')
      expect(formatted).toBe('USD 1,234.50')
    })
  })
})
