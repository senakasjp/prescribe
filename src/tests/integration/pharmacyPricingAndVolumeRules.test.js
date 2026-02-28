import { describe, it, expect } from 'vitest'
import chargeCalculationService from '../../services/pharmacist/chargeCalculationService.js'
import inventoryService from '../../services/pharmacist/inventoryService.js'

describe('pharmacy pricing + volume rules (comprehensive regression)', () => {
  it('prices Liquid (bottles) by bottle count and ignores measured-liquid rows with same name', () => {
    const prescription = {
      id: 'rx-bottle-only',
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
        sellingPrice: 4
      },
      {
        id: 'dompi-bottle',
        brandName: 'Dompi Suspension 5mg/5ml',
        dosageForm: 'Liquid (bottles)',
        currentStock: 20,
        sellingPrice: 120
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

  it('keeps measured-liquid per-ml pricing behavior unchanged', () => {
    const prescription = {
      id: 'rx-measured',
      medications: [
        {
          name: 'Antipa',
          dosageForm: 'Liquid (measured)',
          strength: '5',
          strengthUnit: 'ml',
          frequency: 'Four times daily (QDS)',
          duration: '2 days'
        }
      ]
    }

    const inventoryItems = [
      {
        id: 'antipa-ml',
        brandName: 'Antipa',
        dosageForm: 'Liquid (measured)',
        unit: 'ml',
        currentStock: 1000,
        sellingPrice: 2
      }
    ]

    const result = chargeCalculationService.calculateExpectedDrugChargesFromInventory(
      prescription,
      inventoryItems
    )

    // 5 ml * 4/day * 2 days = 40 ml, at 2 per ml => 80
    expect(result.medicationBreakdown[0].quantity).toBe(40)
    expect(result.medicationBreakdown[0].unitCost).toBe(2)
    expect(result.medicationBreakdown[0].totalCost).toBe(80)
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
        sellingPrice: 171
      },
      {
        id: 'cream-15g',
        brandName: 'Dermketa',
        dosageForm: 'Cream',
        containerSize: 15,
        containerUnit: 'g',
        currentStock: 20,
        sellingPrice: 420
      }
    ]

    const result = chargeCalculationService.calculateExpectedDrugChargesFromInventory(
      prescription,
      inventoryItems
    )

    expect(result.medicationBreakdown[0].quantity).toBe(2)
    expect(result.medicationBreakdown[0].unitCost).toBe(420)
    expect(result.medicationBreakdown[0].totalCost).toBe(840)
    expect(result.medicationBreakdown[0].allocationDetails[0].inventoryItemId).toBe('cream-15g')
  })

  it('keeps packet ml rows count-priced (never measured-liquid ml pricing)', () => {
    const prescription = {
      id: 'rx-packet',
      medications: [
        {
          name: 'ORS-Jeevanee',
          dosageForm: 'Packet',
          qts: '2',
          strength: '200',
          strengthUnit: 'ml'
        }
      ]
    }

    const inventoryItems = [
      {
        id: 'ors-packet',
        brandName: 'ORS-Jeevanee',
        dosageForm: 'Packet',
        strength: '200',
        strengthUnit: 'ml',
        currentStock: 100,
        sellingPrice: 50
      }
    ]

    const result = chargeCalculationService.calculateExpectedDrugChargesFromInventory(
      prescription,
      inventoryItems
    )

    expect(result.medicationBreakdown[0].quantity).toBe(2)
    expect(result.medicationBreakdown[0].unitCost).toBe(50)
    expect(result.medicationBreakdown[0].totalCost).toBe(100)
  })

  it('accepts up to 3 decimals for strength/total volume and rejects text', () => {
    const base = {
      brandName: 'Test Brand',
      genericName: 'Test Generic',
      dosageForm: 'Cream',
      strength: '',
      strengthUnit: '',
      initialStock: '10',
      minimumStock: '2',
      sellingPrice: '100',
      expiryDate: '2027-01-01',
      storageConditions: 'room temperature'
    }

    expect(() => inventoryService.validateInventoryItem({
      ...base,
      containerSize: '10.125',
      containerUnit: 'g'
    })).not.toThrow()

    expect(() => inventoryService.validateInventoryItem({
      ...base,
      dosageForm: 'Tablet',
      strength: '2.123',
      strengthUnit: 'mg',
      containerSize: ''
    })).not.toThrow()

    expect(() => inventoryService.validateInventoryItem({
      ...base,
      containerSize: '10g',
      containerUnit: 'g'
    })).toThrow('Total volume must be a valid positive number')

    expect(() => inventoryService.validateInventoryItem({
      ...base,
      dosageForm: 'Tablet',
      strength: '2.5mg',
      strengthUnit: 'mg'
    })).toThrow('Strength must be a valid positive number')
  })
})
