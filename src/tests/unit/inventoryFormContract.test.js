import { describe, it, expect } from 'vitest'
import inventoryService from '../../services/pharmacist/inventoryService.js'

const canonicalFormPayload = {
  brandName: 'Corex',
  genericName: 'Dextromethorphan',
  manufacturer: 'ACME Pharma',
  category: 'prescription',
  dosageForm: 'Liquid (bottles)',
  strength: '100',
  strengthUnit: 'ml',
  initialStock: '1500',
  minimumStock: '800',
  costPrice: '40',
  sellingPrice: '50',
  expiryDate: '2026-12-23',
  batchNumber: 'BATCH-A1',
  storageLocation: 'Rack R2',
  storageConditions: 'room temperature',
  description: 'Cough suppressant'
}

describe('inventory form contract unit tests', () => {
  it('accepts canonical add/edit form payload in validation', () => {
    expect(() => inventoryService.validateInventoryItem(canonicalFormPayload)).not.toThrow()
  })

  it('rejects canonical payload when required foundation fields are missing', () => {
    expect(() => inventoryService.validateInventoryItem({
      ...canonicalFormPayload,
      initialStock: ''
    })).toThrow('Missing required fields: initialStock')

    expect(() => inventoryService.validateInventoryItem({
      ...canonicalFormPayload,
      storageConditions: ''
    })).toThrow('Missing required fields: storageConditions')
  })

  it('rejects non-integer stock values from forms', () => {
    expect(() => inventoryService.validateInventoryItem({
      ...canonicalFormPayload,
      initialStock: '1500.5'
    })).toThrow('Initial stock must be an integer')

    expect(() => inventoryService.validateInventoryItem({
      ...canonicalFormPayload,
      minimumStock: '800.2'
    })).toThrow('Minimum stock must be an integer')
  })

  it('maps form payload into normalized inventory item data', () => {
    const prepared = inventoryService.prepareInventoryItemData('pharmacy-1', canonicalFormPayload)

    expect(prepared.brandName).toBe('Corex')
    expect(prepared.genericName).toBe('Dextromethorphan')
    expect(prepared.category).toBe('prescription')
    expect(prepared.dosageForm).toBe('Liquid (bottles)')
    expect(prepared.currentStock).toBe(1500)
    expect(prepared.minimumStock).toBe(800)
    expect(prepared.costPrice).toBe(40)
    expect(prepared.sellingPrice).toBe(50)
    expect(prepared.storageConditions).toBe('room temperature')
    expect(prepared.expiryDate).toBe('2026-12-23')
    expect(prepared.pharmacistId).toBe('pharmacy-1')
  })

  it('applies stable defaults for optional fields used by forms', () => {
    const prepared = inventoryService.prepareInventoryItemData('pharmacy-1', {
      ...canonicalFormPayload,
      category: '',
      dosageForm: '',
      costPrice: ''
    })

    expect(prepared.category).toBe('prescription')
    expect(prepared.dosageForm).toBe('tablet')
    expect(prepared.costPrice).toBeNull()
  })
})
