/**
 * Unit tests for inventory service helpers (memory-based)
 */
import { describe, it, expect } from 'vitest'
import inventoryService from '../../services/pharmacist/inventoryService.js'

describe('inventoryService', () => {
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
