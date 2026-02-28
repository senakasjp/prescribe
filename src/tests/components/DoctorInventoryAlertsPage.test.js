import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getDoctorById: vi.fn(() => Promise.resolve({ id: 'owner-doc-1', name: 'Owner Doctor' }))
  }
}))

vi.mock('../../services/pharmacyMedicationService.js', () => ({
  pharmacyMedicationService: {
    getConnectedPharmacies: vi.fn(() => Promise.resolve(['ph-1'])),
    getPharmacyStock: vi.fn(() => Promise.resolve([])),
    clearCache: vi.fn()
  }
}))

vi.mock('../../services/pharmacyInventoryIntegration.js', () => ({
  pharmacyInventoryIntegration: {
    getOwnPharmacies: vi.fn(() => Promise.resolve([{ id: 'ph-1', name: 'My Pharmacy' }])),
    clearCache: vi.fn()
  }
}))

describe('DoctorInventoryAlertsPage', () => {
  let DoctorInventoryAlertsPage
  let pharmacyMedicationService
  let pharmacyInventoryIntegration

  beforeEach(async () => {
    vi.clearAllMocks()
    DoctorInventoryAlertsPage = (await import('../../components/DoctorInventoryAlertsPage.svelte')).default
    pharmacyMedicationService = (await import('../../services/pharmacyMedicationService.js')).pharmacyMedicationService
    pharmacyInventoryIntegration = (await import('../../services/pharmacyInventoryIntegration.js')).pharmacyInventoryIntegration
    pharmacyMedicationService.getConnectedPharmacies.mockResolvedValue(['ph-1'])
    pharmacyInventoryIntegration.getOwnPharmacies.mockResolvedValue([{ id: 'ph-1', name: 'My Pharmacy' }])
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([])
  })

  it('prints stock alert report with current low-stock and expiry content', async () => {
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

    render(DoctorInventoryAlertsPage, {
      props: {
        user: { id: 'doc-1', name: 'Dr Demo' }
      }
    })

    await fireEvent.click(screen.getByRole('button', { name: /Print Report/i }))

    expect(openSpy).toHaveBeenCalled()
    expect(printWindowMock.document.open).toHaveBeenCalled()
    expect(printWindowMock.document.write).toHaveBeenCalledTimes(1)
    const printedHtml = printWindowMock.document.write.mock.calls[0][0]
    expect(printedHtml).toContain('Pharmacy Stock Alerts Report')
    expect(printedHtml).toContain('Low Stock Items')
    expect(printedHtml).toContain('Expiring Soon')
    expect(printWindowMock.print).toHaveBeenCalled()
  })

  it('emits alerts-updated summary for doctor portal notification badge', async () => {
    const nearFuture = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([
      {
        id: 'stock-low',
        pharmacyId: 'ph-1',
        drugName: 'Drug A',
        currentStock: 2,
        minimumStock: 10,
        expiryDate: nearFuture
      },
      {
        id: 'stock-expired',
        pharmacyId: 'ph-1',
        drugName: 'Drug B',
        currentStock: 20,
        minimumStock: 10,
        expiryDate: pastDate
      }
    ])

    const { component } = render(DoctorInventoryAlertsPage, {
      props: {
        user: { id: 'doc-1', name: 'Dr Demo' }
      }
    })

    const eventHandler = vi.fn()
    component.$on('alerts-updated', eventHandler)

    await fireEvent.click(screen.getByRole('button', { name: /Refresh/i }))

    const latestPayload = eventHandler.mock.calls.at(-1)?.[0]?.detail
    expect(latestPayload).toMatchObject({
      lowStock: 1,
      expiringSoon: 1,
      expired: 1,
      total: 3,
      hasOwnPharmacy: true
    })
  })

  it('keeps header actions clear of modal close button area', async () => {
    render(DoctorInventoryAlertsPage, {
      props: {
        user: { id: 'doc-1', name: 'Dr Demo' }
      }
    })

    const heading = await screen.findByRole('heading', { name: /Pharmacy Stock Alerts/i })
    const headerRow = heading.closest('div.flex')
    expect(headerRow).not.toBeNull()
    expect(headerRow.className).toContain('pr-12')
  })

  it('shows variant-identifying details for low stock and expired rows', async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    pharmacyMedicationService.getPharmacyStock.mockResolvedValue([
      {
        id: 'stock-zero',
        pharmacyId: 'ph-1',
        drugName: 'Corex',
        genericName: 'Dextromethorphan',
        dosageForm: 'Liquid (bottles)',
        strength: '5',
        strengthUnit: 'ml',
        totalVolume: '100',
        volumeUnit: 'ml',
        batchNumber: 'B-100',
        currentStock: 0,
        minimumStock: 5,
        expiryDate: pastDate
      }
    ])

    render(DoctorInventoryAlertsPage, {
      props: {
        user: { id: 'doc-1', name: 'Dr Demo' }
      }
    })

    await fireEvent.click(screen.getByRole('button', { name: /Refresh/i }))
    await waitFor(() => {
      expect(pharmacyMedicationService.getPharmacyStock).toHaveBeenCalled()
    })
    expect(await screen.findAllByText(/Corex \(Dextromethorphan\)/i)).not.toHaveLength(0)
    expect(screen.getAllByText(/Form: Liquid \(bottles\)/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Strength: 5 ml/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Volume: 100 ml/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Batch: B-100/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Out of stock/i)).toBeInTheDocument()
  })
})
