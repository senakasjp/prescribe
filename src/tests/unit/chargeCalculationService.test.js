/**
 * Unit tests for charge calculation service (memory-based)
 */
import { describe, it, expect } from 'vitest'
import chargeCalculationService from '../../services/pharmacist/chargeCalculationService.js'

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
    it('should format LKR without currency symbol', () => {
      const formatted = chargeCalculationService.formatCurrency(1234.5, 'LKR')
      expect(formatted).toContain('1,234.50')
      expect(formatted).not.toContain('LKR')
      expect(formatted).not.toContain('$')
    })

    it('should format USD with currency symbol', () => {
      const formatted = chargeCalculationService.formatCurrency(1234.5, 'USD')
      expect(formatted).toMatch(/\$/)
    })
  })
})
