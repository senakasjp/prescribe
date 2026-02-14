import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import BatchManagement from '../../components/pharmacist/BatchManagement.svelte'
import inventoryService from '../../services/pharmacist/inventoryService.js'
import { notifyError, notifySuccess } from '../../stores/notifications.js'

vi.mock('../../services/pharmacist/inventoryService.js', () => ({
  default: {
    addBatch: vi.fn()
  }
}))

vi.mock('../../stores/notifications.js', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn()
}))

const baseItem = {
  id: 'item-1',
  drugName: 'Corex',
  genericName: 'Dextromethorphan',
  packUnit: 'ml',
  currentStock: 100,
  currency: 'LKR',
  batches: []
}

describe('BatchManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inventoryService.addBatch.mockResolvedValue({ id: 'batch-1' })
  })

  it('rejects decimal quantity and does not submit batch', async () => {
    render(BatchManagement, {
      props: {
        item: baseItem,
        onClose: vi.fn()
      }
    })

    await userEvent.click(screen.getByRole('button', { name: /add batch/i }))
    await screen.findByRole('heading', { name: 'Add New Batch' })

    const form = document.querySelector('.z-60 form')
    const inputs = form.querySelectorAll('input')
    const batchNumberInput = inputs[0]
    const quantityInput = inputs[1]
    const expiryInput = form.querySelector('input[type="date"][required]')

    await fireEvent.input(batchNumberInput, { target: { value: 'BATCH-01' } })
    await fireEvent.input(quantityInput, { target: { value: '2.5' } })
    expiryInput.value = '2027-12-31'
    await fireEvent.input(expiryInput)
    await fireEvent.submit(form)

    expect(notifyError).toHaveBeenCalledWith('Quantity must be a positive integer')
    expect(inventoryService.addBatch).not.toHaveBeenCalled()
  })

  it('submits valid integer quantity as number', async () => {
    render(BatchManagement, {
      props: {
        item: baseItem,
        onClose: vi.fn()
      }
    })

    await userEvent.click(screen.getByRole('button', { name: /add batch/i }))
    await screen.findByRole('heading', { name: 'Add New Batch' })

    const form = document.querySelector('.z-60 form')
    const inputs = form.querySelectorAll('input')
    const batchNumberInput = inputs[0]
    const quantityInput = inputs[1]
    const expiryInput = form.querySelector('input[type="date"][required]')

    await fireEvent.input(batchNumberInput, { target: { value: 'BATCH-02' } })
    await fireEvent.input(quantityInput, { target: { value: '25' } })
    expiryInput.value = '2028-01-31'
    await fireEvent.input(expiryInput)
    await fireEvent.submit(form)

    await waitFor(() => {
      expect(inventoryService.addBatch).toHaveBeenCalledTimes(1)
    })

    expect(inventoryService.addBatch).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({
        batchNumber: 'BATCH-02',
        quantity: 25,
        expiryDate: '2028-01-31'
      })
    )
    expect(notifySuccess).toHaveBeenCalledWith('Batch added successfully')
  })
})
