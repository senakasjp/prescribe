import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import InventoryDashboard from '../../components/pharmacist/InventoryDashboard.svelte'
import { notifyError, notifySuccess } from '../../stores/notifications.js'
import inventoryService from '../../services/pharmacist/inventoryService.js'
import firebaseStorage from '../../services/firebaseStorage.js'

const baseInventoryItem = {
  id: 'item-1',
  brandName: 'Panadol',
  drugName: 'Panadol',
  genericName: 'Paracetamol',
  manufacturer: 'GSK',
  category: 'prescription',
  strength: '500',
  strengthUnit: 'mg',
  dosageForm: 'tablet',
  packSize: '10',
  packUnit: 'tablets',
  currentStock: 50,
  minimumStock: 10,
  maximumStock: 1000,
  costPrice: 10,
  sellingPrice: 20,
  expiryDate: '2027-12-31',
  storageConditions: 'room temperature',
  status: 'in_stock'
}

vi.mock('../../services/pharmacist/inventoryService.js', () => ({
  default: {
    getInventoryItems: vi.fn(),
    migrateDrugStockToInventory: vi.fn(),
    getInventoryAnalytics: vi.fn(),
    createInventoryItem: vi.fn(),
    updateInventoryItem: vi.fn(),
    deleteInventoryItem: vi.fn(),
    createTestInventoryItems: vi.fn(),
    deleteTestInventoryItems: vi.fn()
  }
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getPharmacistById: vi.fn(),
    getDoctorByEmail: vi.fn()
  }
}))

vi.mock('../../services/adminAuthService.js', () => ({
  default: {
    isAdminEmail: vi.fn(() => false)
  }
}))

vi.mock('../../stores/notifications.js', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn()
}))

const pharmacist = {
  id: 'pharmacy-1',
  email: 'pharmacy@example.com',
  pharmacyId: 'pharmacy-1',
  country: 'LK',
  currency: 'LKR'
}

const renderDashboard = async () => {
  const utils = render(InventoryDashboard, { props: { pharmacist } })
  await waitFor(() => {
    expect(screen.queryByText('Loading inventory data...')).not.toBeInTheDocument()
  })
  return utils
}

const fillRequiredAddFields = async () => {
  await fireEvent.input(document.getElementById('newItemBrandName'), { target: { value: 'Amoxil' } })
  await fireEvent.input(document.getElementById('newItemGenericName'), { target: { value: 'Amoxicillin' } })
  const dosageSelect = document.getElementById('newItemDosageForm')
  await fireEvent.change(dosageSelect, { target: { value: 'Tablet' } })
  await fireEvent.input(document.getElementById('newItemStrength'), { target: { value: '250' } })
  await fireEvent.input(document.getElementById('newItemInitialStock'), { target: { value: '100' } })
  await fireEvent.input(document.getElementById('newItemSellingPrice'), { target: { value: '75' } })
  await fireEvent.input(document.getElementById('newItemExpiryDate'), {
    target: { value: '2028-01-15' }
  })
}

const ADD_FIELD_IDS = [
  'newItemBrandName',
  'newItemGenericName',
  'newItemManufacturer',
  'newItemCategory',
  'newItemDosageForm',
  'newItemStrength',
  'newItemStrengthUnit',
  'newItemInitialStock',
  'newItemMinimumStock',
  'newItemCostPrice',
  'newItemSellingPrice',
  'newItemExpiryDate',
  'newItemBatchNumber',
  'newItemStorageLocation',
  'newItemStorageConditions',
  'newItemDescription'
]

const EDIT_FIELD_IDS = [
  'editItemBrandName',
  'editItemGenericName',
  'editItemManufacturer',
  'editItemCategory',
  'editItemDosageForm',
  'editItemStrength',
  'editItemStrengthUnit',
  'editItemInitialStock',
  'editItemMinimumStock',
  'editItemCostPrice',
  'editItemSellingPrice',
  'editItemExpiryDate',
  'editItemBatchNumber',
  'editItemStorageLocation',
  'editItemStorageConditions',
  'editItemDescription'
]

const getModalButton = (modal, text) => {
  const buttons = Array.from(modal.querySelectorAll('button'))
  return buttons.find((btn) => (btn.textContent || '').trim().includes(text))
}

describe('InventoryDashboard add/edit inventory item flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inventoryService.getInventoryItems.mockResolvedValue([baseInventoryItem])
    inventoryService.migrateDrugStockToInventory.mockResolvedValue({ migrated: 0 })
    inventoryService.getInventoryAnalytics.mockResolvedValue({
      totalItems: 1,
      totalStockValue: 1000,
      lowStockItems: 0,
      expiringItems: 0
    })
    inventoryService.createInventoryItem.mockResolvedValue({ id: 'new-item-1' })
    inventoryService.updateInventoryItem.mockImplementation(async (_id, _pharmacyId, itemData) => itemData)
    firebaseStorage.getPharmacistById.mockResolvedValue({ id: 'pharmacy-1', pharmacistNumber: 'PH-001' })
    firebaseStorage.getDoctorByEmail.mockResolvedValue(null)
  })

  it('validates required fields when adding an item', async () => {
    const { container } = await renderDashboard()

    await userEvent.click(screen.getByRole('button', { name: /Add Inventory Item/i }))
    const addForm = container.querySelector('form')
    expect(addForm).toBeTruthy()
    await fireEvent.submit(addForm)

    expect(notifyError).toHaveBeenCalledWith('Please fill in Brand Name')
    expect(inventoryService.createInventoryItem).not.toHaveBeenCalled()
  })

  it('adds an inventory item successfully with required fields', async () => {
    const { container } = await renderDashboard()

    await userEvent.click(screen.getByRole('button', { name: /Add Inventory Item/i }))
    await fillRequiredAddFields()
    const addForm = container.querySelector('form')
    expect(addForm).toBeTruthy()
    await fireEvent.submit(addForm)

    await waitFor(() => {
      expect(inventoryService.createInventoryItem).toHaveBeenCalled()
    })

    const [, payload] = inventoryService.createInventoryItem.mock.calls[0]
    expect(payload).toEqual(expect.objectContaining({
      brandName: 'Amoxil',
      genericName: 'Amoxicillin',
      strength: 250,
      initialStock: 100,
      sellingPrice: 75,
      dosageForm: 'Tablet',
      expiryDate: '2028-01-15'
    }))
    expect(notifySuccess).toHaveBeenCalledWith('Inventory item added successfully!')
  })

  it('shows service error when adding an item fails', async () => {
    inventoryService.createInventoryItem.mockRejectedValueOnce(new Error('Primary key exists'))
    const { container } = await renderDashboard()

    await userEvent.click(screen.getByRole('button', { name: /Add Inventory Item/i }))
    await fillRequiredAddFields()
    const addForm = container.querySelector('form')
    expect(addForm).toBeTruthy()
    await fireEvent.submit(addForm)

    await waitFor(() => {
      expect(notifyError).toHaveBeenCalledWith('Failed to add inventory item: Primary key exists')
    })
  })

  it('blocks add submission when required integer field is non-integer', async () => {
    const { container } = await renderDashboard()

    await userEvent.click(screen.getByRole('button', { name: /Add Inventory Item/i }))
    await fillRequiredAddFields()
    await fireEvent.input(document.getElementById('newItemInitialStock'), { target: { value: '10.5' } })
    const addForm = container.querySelector('form')
    expect(addForm).toBeTruthy()
    await fireEvent.submit(addForm)

    expect(notifyError).toHaveBeenCalledWith('Initial Stock must be an integer')
    expect(inventoryService.createInventoryItem).not.toHaveBeenCalled()
  })

  it('renders complete add form field contract', async () => {
    await renderDashboard()
    await userEvent.click(screen.getByRole('button', { name: /Add Inventory Item/i }))

    ADD_FIELD_IDS.forEach((id) => {
      expect(document.getElementById(id)).toBeTruthy()
    })
  })

  it('blocks add submission when minimum stock is non-integer', async () => {
    const { container } = await renderDashboard()
    await userEvent.click(screen.getByRole('button', { name: /Add Inventory Item/i }))
    await fillRequiredAddFields()
    await fireEvent.input(document.getElementById('newItemMinimumStock'), { target: { value: '10.5' } })
    const addForm = container.querySelector('form')
    expect(addForm).toBeTruthy()
    await fireEvent.submit(addForm)

    expect(notifyError).toHaveBeenCalledWith('Minimum Stock must be an integer')
    expect(inventoryService.createInventoryItem).not.toHaveBeenCalled()
  })

  it('keeps add and edit forms field-identical by label', async () => {
    const { container } = await renderDashboard()

    await userEvent.click(screen.getByRole('button', { name: /Add Inventory Item/i }))
    const dosageSelect = document.getElementById('newItemDosageForm')
    await fireEvent.change(dosageSelect, { target: { value: 'Tablet' } })
    const addForm = container.querySelector('form')
    expect(addForm).toBeTruthy()
    const addLabels = Array.from(addForm.querySelectorAll('label'))
      .map((label) => (label.textContent || '').replace('*', '').trim())
      .filter(Boolean)
    await userEvent.click(screen.getByLabelText(/Close add item modal/i))

    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit$/i })[0])
    const editForm = container.querySelector('form')
    expect(editForm).toBeTruthy()
    const editLabels = Array.from(editForm.querySelectorAll('label'))
      .map((label) => (label.textContent || '').replace('*', '').trim())
      .filter(Boolean)

    expect([...new Set(addLabels)].sort()).toEqual([...new Set(editLabels)].sort())
  })

  it('opens edit modal and keeps primary-key fields read-only', async () => {
    await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit$/i })[0])

    expect(screen.getByLabelText(/Brand Name/i)).toBeDisabled()
    expect(screen.getByLabelText(/(Volume unit|Strength Unit)/i)).toBeDisabled()
    expect(screen.getByLabelText(/Selling Price/i)).toBeDisabled()
    expect(screen.getByLabelText(/Expiry Date/i)).toBeDisabled()
  })

  it('renders complete edit form field contract and editability rules', async () => {
    await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit$/i })[0])

    EDIT_FIELD_IDS.forEach((id) => {
      expect(document.getElementById(id)).toBeTruthy()
    })

    expect(document.getElementById('editItemBrandName')).toBeDisabled()
    expect(document.getElementById('editItemStrength')).toBeDisabled()
    expect(document.getElementById('editItemStrengthUnit')).toBeDisabled()
    expect(document.getElementById('editItemSellingPrice')).toBeDisabled()
    expect(document.getElementById('editItemExpiryDate')).toBeDisabled()

    expect(document.getElementById('editItemGenericName')).not.toBeDisabled()
    expect(document.getElementById('editItemCategory')).not.toBeDisabled()
    expect(document.getElementById('editItemInitialStock')).not.toBeDisabled()
    expect(document.getElementById('editItemMinimumStock')).not.toBeDisabled()
  })

  it('hides strength fields and shows per ml labels in edit when dispense form is Liquid (measured)', async () => {
    inventoryService.getInventoryItems.mockResolvedValue([
      {
        ...baseInventoryItem,
        dosageForm: 'Liquid (measured)',
        strength: '',
        strengthUnit: ''
      }
    ])
    await renderDashboard()
    const getLabelTextByFor = (forId) => {
      const label = document.querySelector(`label[for="${forId}"]`)
      return (label?.textContent || '').replace(/\s+/g, ' ').trim()
    }
    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit$/i })[0])
    await waitFor(() => {
      expect(document.getElementById('editItemStrength')).toBeNull()
      expect(document.getElementById('editItemStrengthUnit')).toBeNull()
      expect(getLabelTextByFor('editItemInitialStock')).toMatch(/Initial Stock in ml/i)
      expect(getLabelTextByFor('editItemMinimumStock')).toMatch(/Minimum Stock ml/i)
      expect(getLabelTextByFor('editItemCostPrice')).toMatch(/Cost Price per ml/i)
      expect(getLabelTextByFor('editItemSellingPrice')).toMatch(/Selling Price per ml/i)
    })
  })

  it('shows Total volume and Volume unit labels for Liquid (bottles) in edit', async () => {
    inventoryService.getInventoryItems.mockResolvedValue([
      {
        ...baseInventoryItem,
        dosageForm: 'Liquid (bottles)',
        strength: '100',
        strengthUnit: 'ml'
      }
    ])
    await renderDashboard()

    const getLabelTextByFor = (forId) => {
      const label = document.querySelector(`label[for="${forId}"]`)
      return (label?.textContent || '').replace(/\s+/g, ' ').trim()
    }

    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit$/i })[0])

    expect(getLabelTextByFor('editItemStrength')).toMatch(/Total volume/i)
    expect(getLabelTextByFor('editItemStrengthUnit')).toMatch(/Volume unit/i)
  })

  it('shows Total volume and Volume unit labels for QTY item Ointment in edit', async () => {
    inventoryService.getInventoryItems.mockResolvedValue([
      {
        ...baseInventoryItem,
        dosageForm: 'Ointment',
        strength: '100',
        strengthUnit: 'mg'
      }
    ])
    await renderDashboard()

    const getLabelTextByFor = (forId) => {
      const label = document.querySelector(`label[for="${forId}"]`)
      return (label?.textContent || '').replace(/\s+/g, ' ').trim()
    }

    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit$/i })[0])

    expect(getLabelTextByFor('editItemStrength')).toMatch(/Total volume/i)
    expect(getLabelTextByFor('editItemStrengthUnit')).toMatch(/Volume unit/i)
  })

  it('renders a single currency label format without Rs + currency duplication', async () => {
    const { container } = await renderDashboard()
    expect(container.textContent || '').toMatch(/\b(?:USD|LKR|GBP|EUR)\b/)
    expect(screen.queryByText(/Rs\s+LKR/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Rs$/i)).not.toBeInTheDocument()
  })

  it('shows liquid-specific stock units instead of default tablets', async () => {
    inventoryService.getInventoryItems.mockResolvedValue([
      {
        ...baseInventoryItem,
        currentStock: 5,
        packUnit: 'tablets',
        dosageForm: 'Liquid (bottles)'
      },
      {
        ...baseInventoryItem,
        id: 'item-2',
        brandName: 'LiquidMeasured',
        dosageForm: 'Liquid (measured)',
        currentStock: 120,
        packUnit: 'tablets'
      }
    ])

    await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))

    expect(screen.getAllByText(/5 Liquid \(bottles\)/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/120 ml/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/5 tablets/i)).not.toBeInTheDocument()
  })

  it('keeps packUnit stock display for non-liquid items', async () => {
    inventoryService.getInventoryItems.mockResolvedValue([
      {
        ...baseInventoryItem,
        id: 'item-pack',
        brandName: 'SprayItem',
        dosageForm: 'Spray',
        currentStock: 8,
        packUnit: 'packs'
      }
    ])

    await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))

    expect(screen.getAllByText(/8 packs/i).length).toBeGreaterThan(0)
  })

  it('updates an inventory item and maps current stock to initialStock', async () => {
    const { container } = await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit$/i })[0])

    const genericName = screen.getByLabelText(/Generic Name/i)
    const initialStock = screen.getByLabelText(/Initial Stock/i)

    await userEvent.clear(genericName)
    await userEvent.type(genericName, 'Acetaminophen')
    await userEvent.clear(initialStock)
    await userEvent.type(initialStock, '80')

    const editForm = container.querySelector('form')
    expect(editForm).toBeTruthy()
    await fireEvent.submit(editForm)

    await waitFor(() => {
      expect(inventoryService.updateInventoryItem).toHaveBeenCalled()
    })

    const [itemId, pharmacyId, payload] = inventoryService.updateInventoryItem.mock.calls[0]
    expect(itemId).toBe('item-1')
    expect(pharmacyId).toBe('pharmacy-1')
    expect(payload.genericName).toBe('Acetaminophen')
    expect(String(payload.currentStock)).toBe('80')
    expect(String(payload.initialStock)).toBe('80')
    expect(String(payload.sellingPrice)).toBe('20')
    expect(payload.brandName).toBe('Panadol')
    expect(notifySuccess).toHaveBeenCalledWith('Inventory item updated successfully')
  })

  it('updates edit form with shared schema values and forwards payload for calculations', async () => {
    const { container } = await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit$/i })[0])

    const genericName = document.getElementById('editItemGenericName')
    const category = document.getElementById('editItemCategory')
    const dispenseForm = document.getElementById('editItemDosageForm')
    const initialStock = document.getElementById('editItemInitialStock')
    const minimumStock = document.getElementById('editItemMinimumStock')
    const costPrice = document.getElementById('editItemCostPrice')
    const storageLocation = document.getElementById('editItemStorageLocation')
    const storageConditions = document.getElementById('editItemStorageConditions')
    const batchNumber = document.getElementById('editItemBatchNumber')
    const description = document.getElementById('editItemDescription')

    expect(genericName).toBeTruthy()
    expect(category).toBeTruthy()
    expect(dispenseForm).toBeTruthy()
    expect(initialStock).toBeTruthy()
    expect(minimumStock).toBeTruthy()
    expect(costPrice).toBeTruthy()
    expect(storageLocation).toBeTruthy()
    expect(storageConditions).toBeTruthy()
    expect(batchNumber).toBeTruthy()
    expect(description).toBeTruthy()

    await userEvent.clear(genericName)
    await userEvent.type(genericName, 'Paracetamol Revised')
    await fireEvent.change(category, { target: { value: 'otc' } })
    await userEvent.clear(initialStock)
    await userEvent.type(initialStock, '120')
    await userEvent.clear(minimumStock)
    await userEvent.type(minimumStock, '25')
    await userEvent.clear(costPrice)
    await userEvent.type(costPrice, '12.5')
    await userEvent.clear(storageLocation)
    await userEvent.type(storageLocation, 'Shelf B2')
    await userEvent.clear(batchNumber)
    await userEvent.type(batchNumber, 'B-7788')
    await userEvent.clear(description)
    await userEvent.type(description, 'Keep away from sunlight')

    const editForm = container.querySelector('form')
    expect(editForm).toBeTruthy()
    await fireEvent.submit(editForm)

    await waitFor(() => {
      expect(inventoryService.updateInventoryItem).toHaveBeenCalled()
    })

    const [, , payload] = inventoryService.updateInventoryItem.mock.calls.at(-1)
    expect(payload).toEqual(expect.objectContaining({
      genericName: 'Paracetamol Revised',
      currentStock: 120,
      initialStock: 120,
      minimumStock: 25,
      costPrice: 12.5,
      storageLocation: 'Shelf B2',
      batchNumber: 'B-7788',
      description: 'Keep away from sunlight'
    }))
    expect(payload).toHaveProperty('category')
    expect(payload).toHaveProperty('dosageForm')
    expect(payload).toHaveProperty('storageConditions')
  })

  it('blocks edit submission when strength metadata is missing', async () => {
    inventoryService.getInventoryItems.mockResolvedValue([{
      ...baseInventoryItem,
      id: 'item-2',
      brandName: 'NoStrengthDrug',
      strength: '',
      strengthUnit: ''
    }])
    const { container } = await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit$/i })[0])
    const editForm = container.querySelector('form')
    expect(editForm).toBeTruthy()
    await fireEvent.submit(editForm)

    expect(notifyError).toHaveBeenCalledWith('Strength and strength unit are required')
    expect(inventoryService.updateInventoryItem).not.toHaveBeenCalled()
  })

  it('shows service error when editing fails', async () => {
    inventoryService.updateInventoryItem.mockRejectedValueOnce(new Error('Update failed'))
    const { container } = await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit$/i })[0])
    const editForm = container.querySelector('form')
    expect(editForm).toBeTruthy()
    await fireEvent.submit(editForm)

    await waitFor(() => {
      expect(notifyError).toHaveBeenCalledWith('Error updating inventory item: Update failed')
    })
  })

  it('blocks edit submission when required integer field is non-integer', async () => {
    const { container } = await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit$/i })[0])

    const initialStock = screen.getByLabelText(/Initial Stock/i)
    await userEvent.clear(initialStock)
    await userEvent.type(initialStock, '80.2')

    const editForm = container.querySelector('form')
    expect(editForm).toBeTruthy()
    await fireEvent.submit(editForm)

    expect(notifyError).toHaveBeenCalledWith('Initial Stock must be an integer')
    expect(inventoryService.updateInventoryItem).not.toHaveBeenCalled()
  })

  it('blocks edit submission when minimum stock is non-integer', async () => {
    const { container } = await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit$/i })[0])

    const minimumStock = screen.getByLabelText(/Minimum Stock/i)
    await userEvent.clear(minimumStock)
    await userEvent.type(minimumStock, '25.5')

    const editForm = container.querySelector('form')
    expect(editForm).toBeTruthy()
    await fireEvent.submit(editForm)

    expect(notifyError).toHaveBeenCalledWith('Minimum Stock must be an integer')
    expect(inventoryService.updateInventoryItem).not.toHaveBeenCalled()
  })

  it('handles search safely when inventory fields are non-string values', async () => {
    inventoryService.getInventoryItems.mockResolvedValue([
      {
        ...baseInventoryItem,
        id: 'item-non-string',
        brandName: 'Cetrizine',
        genericName: 12345,
        manufacturer: null
      }
    ])

    await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))
    const callCountBeforeSearch = inventoryService.getInventoryItems.mock.calls.length

    const searchInput = screen.getByLabelText(/Search/i)
    await userEvent.clear(searchInput)
    await userEvent.type(searchInput, 'cetri')

    await waitFor(() => {
      expect(screen.getAllByText('Cetrizine').length).toBeGreaterThan(0)
    })
    expect(notifyError).not.toHaveBeenCalledWith(
      expect.stringContaining('toLowerCase is not a function')
    )
    expect(inventoryService.getInventoryItems.mock.calls.length).toBe(callCountBeforeSearch)
  })

  it('shows low-stock and expiring alerts in alerts tab', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowIso = tomorrow.toISOString().slice(0, 10)

    inventoryService.getInventoryItems.mockResolvedValue([
      {
        ...baseInventoryItem,
        id: 'item-low-stock',
        brandName: 'LowStockDrug',
        currentStock: 2,
        minimumStock: 10,
        expiryDate: '2030-01-01'
      },
      {
        ...baseInventoryItem,
        id: 'item-expiring',
        brandName: 'ExpiringDrug',
        currentStock: 100,
        minimumStock: 10,
        expiryDate: tomorrowIso
      }
    ])

    await renderDashboard()
    await userEvent.click(screen.getByRole('button', { name: /alerts/i }))

    await waitFor(() => {
      expect(screen.getByText(/LowStockDrug is below minimum stock/i)).toBeInTheDocument()
      expect(screen.getByText(/ExpiringDrug expires in/i)).toBeInTheDocument()
    })
  })

  it('prints low-stock and expiring alerts from alerts tab', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowIso = tomorrow.toISOString().slice(0, 10)

    inventoryService.getInventoryItems.mockResolvedValue([
      {
        ...baseInventoryItem,
        id: 'item-low-stock',
        brandName: 'LowStockDrug',
        currentStock: 2,
        minimumStock: 10,
        expiryDate: '2030-01-01'
      },
      {
        ...baseInventoryItem,
        id: 'item-expiring',
        brandName: 'ExpiringDrug',
        currentStock: 100,
        minimumStock: 10,
        expiryDate: tomorrowIso
      }
    ])

    const printWindowMock = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn()
      },
      focus: vi.fn(),
      print: vi.fn()
    }
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(printWindowMock)

    await renderDashboard()
    await userEvent.click(screen.getByRole('button', { name: /alerts/i }))

    await waitFor(() => {
      expect(screen.getByText(/LowStockDrug is below minimum stock/i)).toBeInTheDocument()
      expect(screen.getByText(/ExpiringDrug expires in/i)).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: /Print Low Stock & Expiring/i }))

    expect(openSpy).toHaveBeenCalled()
    expect(printWindowMock.document.write).toHaveBeenCalledTimes(1)
    const printedHtml = printWindowMock.document.write.mock.calls[0][0]
    expect(printedHtml).toContain('Inventory Alerts Report')
    expect(printedHtml).toContain('Low Stock Items')
    expect(printedHtml).toContain('Expiring & Expired Items')
    expect(printedHtml).toContain('LowStockDrug is below minimum stock')
    expect(printedHtml).toContain('ExpiringDrug expires in')
    expect(printWindowMock.print).toHaveBeenCalled()
  })

  it('opens inventory item context when clicking alert view details', async () => {
    inventoryService.getInventoryItems.mockResolvedValue([
      {
        ...baseInventoryItem,
        id: 'item-low-stock',
        brandName: 'LowStockDrug',
        currentStock: 2,
        minimumStock: 10,
        expiryDate: '2030-01-01'
      }
    ])

    await renderDashboard()
    await userEvent.click(screen.getByRole('button', { name: /alerts/i }))

    await waitFor(() => {
      expect(screen.getByText(/LowStockDrug is below minimum stock/i)).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: /View Details/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/Search/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Search/i)).toHaveValue('LowStockDrug')
      expect(screen.getAllByText('LowStockDrug').length).toBeGreaterThan(0)
    })
  })

  it('does not delete inventory item when delete modal is cancelled', async () => {
    await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Delete$/i })[0])
    await waitFor(() => {
      expect(screen.getByText('Delete Inventory Item')).toBeInTheDocument()
    })
    const modal = document.getElementById('confirmationModal')
    expect(modal).toBeTruthy()
    const cancelBtn = getModalButton(modal, 'Cancel')
    expect(cancelBtn).toBeTruthy()
    await userEvent.click(cancelBtn)

    expect(inventoryService.deleteInventoryItem).not.toHaveBeenCalled()
  })

  it('deletes inventory item when delete modal is confirmed', async () => {
    await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Delete$/i })[0])
    await waitFor(() => {
      expect(screen.getByText('Delete Inventory Item')).toBeInTheDocument()
    })
    const modal = document.getElementById('confirmationModal')
    expect(modal).toBeTruthy()
    const confirmBtn = getModalButton(modal, 'Delete')
    expect(confirmBtn).toBeTruthy()
    await userEvent.click(confirmBtn)

    await waitFor(() => {
      expect(inventoryService.deleteInventoryItem).toHaveBeenCalledWith('item-1')
    })
    expect(notifySuccess).toHaveBeenCalledWith('Inventory item deleted successfully')
  })

  it('requires doctor delete code before allowing confirm when doctor-owned pharmacy', async () => {
    firebaseStorage.getDoctorByEmail.mockResolvedValue({
      id: 'doctor-1',
      deleteCode: '123456'
    })
    await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Delete$/i })[0])
    await waitFor(() => {
      expect(screen.getByText('Delete Inventory Item')).toBeInTheDocument()
    })

    const modal = document.getElementById('confirmationModal')
    expect(modal).toBeTruthy()
    const confirmBtn = getModalButton(modal, 'Delete')
    const codeInput = document.getElementById('confirmationCodeInput')
    expect(confirmBtn).toBeTruthy()
    expect(codeInput).toBeTruthy()
    expect(confirmBtn).toBeDisabled()

    await fireEvent.input(codeInput, { target: { value: '111111' } })
    expect(confirmBtn).toBeDisabled()

    await fireEvent.input(codeInput, { target: { value: '123456' } })
    expect(confirmBtn).not.toBeDisabled()

    await userEvent.click(confirmBtn)
    await waitFor(() => {
      expect(inventoryService.deleteInventoryItem).toHaveBeenCalledWith('item-1')
    })
  })
})
