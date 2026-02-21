/**
 * Unit tests for inventory service helpers (memory-based)
 */
import { describe, it, expect } from 'vitest'
import inventoryService from '../../services/pharmacist/inventoryService.js'

describe('inventoryService', () => {
  describe('validateInventoryItem integer fields', () => {
    const validItem = {
      brandName: 'Test Brand',
      genericName: 'Test Generic',
      dosageForm: 'Tablet',
      strength: '500',
      strengthUnit: 'mg',
      initialStock: '10',
      minimumStock: '2',
      sellingPrice: '100',
      expiryDate: '2027-01-01',
      storageConditions: 'room temperature'
    }

    it('accepts valid integer values in stock fields', () => {
      expect(() => inventoryService.validateInventoryItem(validItem)).not.toThrow()
    })

    it('rejects alphabetic characters in integer stock fields', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        initialStock: '10abc'
      })).toThrow('Initial stock must be an integer')
    })

    it('rejects decimal values in integer stock fields', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        minimumStock: '2.5'
      })).toThrow('Minimum stock must be an integer')
    })

    it('allows Liquid (measured) without strength and strengthUnit', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        dosageForm: 'Liquid (measured)',
        strength: '',
        strengthUnit: ''
      })).not.toThrow()
    })

    it('allows Liquid (bottles) without strength and strengthUnit', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        dosageForm: 'Liquid (bottles)',
        strength: '',
        strengthUnit: ''
      })).not.toThrow()
    })

    it('allows container-size dispense forms without strength and strengthUnit', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        dosageForm: 'Injection',
        strength: '',
        strengthUnit: '',
        containerSize: '100',
        containerUnit: 'ml'
      })).not.toThrow()
    })

    it('requires strength and strengthUnit for Tablet', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        dosageForm: 'Tablet',
        strength: '',
        strengthUnit: ''
      })).toThrow('Missing required fields: strength, strengthUnit')
    })

    it('requires strength and strengthUnit for Capsule', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        dosageForm: 'Capsule',
        strength: '',
        strengthUnit: ''
      })).toThrow('Missing required fields: strength, strengthUnit')
    })

    it('accepts decimal strength values', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        dosageForm: 'Tablet',
        strength: '2.5',
        strengthUnit: 'mg'
      })).not.toThrow()
    })

    it('accepts strength values up to 3 decimal places', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        dosageForm: 'Tablet',
        strength: '2.123',
        strengthUnit: 'mg'
      })).not.toThrow()
    })

    it('rejects textual strength values', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        dosageForm: 'Tablet',
        strength: '2.5mg',
        strengthUnit: 'mg'
      })).toThrow('Strength must be a valid positive number')
    })

    it('rejects scientific notation strength values', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        dosageForm: 'Tablet',
        strength: '1e3',
        strengthUnit: 'mg'
      })).toThrow('Strength must be a valid positive number')
    })

    it('rejects strength values with more than 3 decimal places', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        dosageForm: 'Tablet',
        strength: '2.1234',
        strengthUnit: 'mg'
      })).toThrow('Strength must be a valid positive number')
    })

    it('accepts decimal total volume values', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        dosageForm: 'Cream',
        strength: '',
        strengthUnit: '',
        containerSize: '10.5',
        containerUnit: 'g'
      })).not.toThrow()
    })

    it('accepts total volume values up to 3 decimal places', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        dosageForm: 'Cream',
        strength: '',
        strengthUnit: '',
        containerSize: '10.125',
        containerUnit: 'g'
      })).not.toThrow()
    })

    it('rejects textual total volume values', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        dosageForm: 'Cream',
        strength: '',
        strengthUnit: '',
        containerSize: '10g',
        containerUnit: 'g'
      })).toThrow('Total volume must be a valid positive number')
    })

    it('rejects total volume values with more than 3 decimal places', () => {
      expect(() => inventoryService.validateInventoryItem({
        ...validItem,
        dosageForm: 'Cream',
        strength: '',
        strengthUnit: '',
        containerSize: '10.1234',
        containerUnit: 'g'
      })).toThrow('Total volume must be a valid positive number')
    })
  })

  describe('calculateStockTurnover', () => {
    it('should return 0 when sales are missing', () => {
      expect(inventoryService.calculateStockTurnover({ averageMonthlySales: 0, currentStock: 10 })).toBe(0)
    })

    it('should calculate turnover from monthly sales', () => {
      const turnover = inventoryService.calculateStockTurnover({ averageMonthlySales: 10, currentStock: 50 })
      expect(turnover).toBeCloseTo(2.4, 2)
    })
  })

  describe('calculateDaysToExpiry', () => {
    it('should return null when no active batches exist', () => {
      const days = inventoryService.calculateDaysToExpiry({ batches: [] })
      expect(days).toBeNull()
    })

    it('should return days to nearest expiry', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)
      const days = inventoryService.calculateDaysToExpiry({
        batches: [
          { expiryDate: futureDate.toISOString(), status: 'active' }
        ]
      })
      expect(days).toBeGreaterThanOrEqual(9)
      expect(days).toBeLessThanOrEqual(10)
    })
  })

  describe('getStockStatus', () => {
    it('should return out_of_stock when stock is 0', () => {
      expect(inventoryService.getStockStatus(0, 10, null)).toBe(inventoryService.STOCK_STATUS.OUT_OF_STOCK)
    })

    it('should return low_stock when below minimum', () => {
      expect(inventoryService.getStockStatus(5, 10, null)).toBe(inventoryService.STOCK_STATUS.LOW_STOCK)
    })

    it('should return expiring_soon when days to expiry <= 30', () => {
      expect(inventoryService.getStockStatus(50, 10, 20)).toBe(inventoryService.STOCK_STATUS.EXPIRING_SOON)
    })

    it('should return in_stock otherwise', () => {
      expect(inventoryService.getStockStatus(50, 10, 90)).toBe(inventoryService.STOCK_STATUS.IN_STOCK)
    })
  })

  describe('normalizeStockChange', () => {
    it('should reduce stock for dispatch even if quantity is negative', () => {
      const change = inventoryService.normalizeStockChange(-5, 'dispatch')
      expect(change).toBe(-5)
    })

    it('should return positive stock change for purchase', () => {
      const change = inventoryService.normalizeStockChange(7, inventoryService.MOVEMENT_TYPES.PURCHASE)
      expect(change).toBe(7)
    })
  })
})
