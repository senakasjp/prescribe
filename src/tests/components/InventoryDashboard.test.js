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
  await fireEvent.input(document.getElementById('newItemStrength'), { target: { value: '250' } })
  await fireEvent.input(document.getElementById('newItemInitialStock'), { target: { value: '100' } })
  await fireEvent.input(document.getElementById('newItemSellingPrice'), { target: { value: '75' } })
  await fireEvent.input(document.getElementById('newItemExpiryDate'), {
    target: { value: '2028-01-15' }
  })
}

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

  it('opens edit modal and keeps primary-key fields read-only', async () => {
    await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit$/i })[0])

    expect(screen.getByLabelText(/Brand Name/i)).toBeDisabled()
    expect(screen.getByLabelText(/Strength Unit/i)).toBeDisabled()
    expect(screen.getByLabelText(/Selling Price/i)).toBeDisabled()
    expect(screen.getByLabelText(/Expiry Date/i)).toBeDisabled()
  })

  it('updates an inventory item and maps current stock to initialStock', async () => {
    const { container } = await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit$/i })[0])

    const genericName = screen.getByLabelText(/Generic Name/i)
    const currentStock = screen.getByLabelText(/Current Stock/i)

    await userEvent.clear(genericName)
    await userEvent.type(genericName, 'Acetaminophen')
    await userEvent.clear(currentStock)
    await userEvent.type(currentStock, '80')

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

    const currentStock = screen.getByLabelText(/Current Stock/i)
    await userEvent.clear(currentStock)
    await userEvent.type(currentStock, '80.2')

    const editForm = container.querySelector('form')
    expect(editForm).toBeTruthy()
    await fireEvent.submit(editForm)

    expect(notifyError).toHaveBeenCalledWith('Current Stock must be an integer')
    expect(inventoryService.updateInventoryItem).not.toHaveBeenCalled()
  })

  it('blocks edit submission when optional integer field is non-integer', async () => {
    const { container } = await renderDashboard()
    await userEvent.click(screen.getByText('Inventory Items'))
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit$/i })[0])

    const packSize = screen.getByLabelText(/Pack Size/i)
    await userEvent.clear(packSize)
    await userEvent.type(packSize, '12.5')

    const editForm = container.querySelector('form')
    expect(editForm).toBeTruthy()
    await fireEvent.submit(editForm)

    expect(notifyError).toHaveBeenCalledWith('Pack Size must be an integer')
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
