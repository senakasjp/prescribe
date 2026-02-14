import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'

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
})
