import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/svelte'
import PrescriptionList from '../../components/PrescriptionList.svelte'
import firebaseStorage from '../../services/firebaseStorage.js'
import chargeCalculationService from '../../services/pharmacist/chargeCalculationService.js'
import { formatDate } from '../../utils/dataProcessing.js'

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getPatientById: vi.fn(() => Promise.resolve(null)),
    getDoctorById: vi.fn(() => Promise.resolve({
      id: 'doc-1',
      connectedPharmacists: ['ph-1']
    })),
    getDoctorByEmail: vi.fn(() => Promise.resolve(null)),
    getAllPharmacists: vi.fn(() => Promise.resolve([
      { id: 'ph-1', connectedDoctors: ['doc-1'], currency: 'LKR' }
    ]))
  }
}))

vi.mock('../../services/pharmacist/chargeCalculationService.js', () => ({
  default: {
    parseMedicationQuantity: vi.fn(() => 1),
    calculatePrescriptionCharge: vi.fn(() => Promise.resolve({ totalCharge: 1250 }))
  }
}))

describe('PrescriptionList currency display in patient history', () => {
  const prescriptions = [
    {
      id: 'rx-1',
      doctorId: 'doc-1',
      createdAt: '2026-02-13T12:00:00.000Z',
      medications: [{ id: 'm1', name: 'Paracetamol', duration: '5 days', frequency: 'Twice daily' }]
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a single LKR currency label in history (no duplicate Rs + LKR)', async () => {
    render(PrescriptionList, {
      props: {
        prescriptions,
        currency: 'LKR'
      }
    })

    await waitFor(() => {
      expect(chargeCalculationService.calculatePrescriptionCharge).toHaveBeenCalled()
    })

    expect(await screen.findByText(/LKR/i)).toBeInTheDocument()
    expect(screen.queryByText(/Rs\s+LKR/i)).not.toBeInTheDocument()
  })

  it('does not show Rs prefix for non-LKR currency in history', async () => {
    render(PrescriptionList, {
      props: {
        prescriptions,
        currency: 'USD'
      }
    })

    await waitFor(() => {
      expect(chargeCalculationService.calculatePrescriptionCharge).toHaveBeenCalled()
    })

    expect(screen.queryByText(/Rs\s+/i)).not.toBeInTheDocument()
    expect(await screen.findByText(/USD/i)).toBeInTheDocument()
  })

  it('calculates totals with expected pharmacist context', async () => {
    render(PrescriptionList, {
      props: {
        prescriptions,
        currency: 'USD'
      }
    })

    await waitFor(() => {
      expect(chargeCalculationService.calculatePrescriptionCharge).toHaveBeenCalledWith(
        expect.objectContaining({
          doctorId: 'doc-1'
        }),
        expect.objectContaining({
          id: 'ph-1'
        })
      )
    })

    expect(firebaseStorage.getDoctorById).toHaveBeenCalledWith('doc-1')
    expect(firebaseStorage.getAllPharmacists).toHaveBeenCalled()
  })

  it('renders patient history date using shared formatDate output', async () => {
    const timestamp = '2026-02-13T12:00:00.000Z'
    const expected = formatDate(timestamp)

    render(PrescriptionList, {
      props: {
        prescriptions: [
          {
            id: 'rx-date-1',
            doctorId: 'doc-1',
            createdAt: timestamp,
            medications: [{ id: 'm1', name: 'Paracetamol', duration: '5 days', frequency: 'Twice daily' }]
          }
        ],
        currency: 'USD'
      }
    })

    const matches = await screen.findAllByText(new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    expect(matches.length).toBeGreaterThan(0)
  })

  it('renders "Unknown date" when createdAt is missing in patient history', async () => {
    render(PrescriptionList, {
      props: {
        prescriptions: [
          {
            id: 'rx-date-2',
            doctorId: 'doc-1',
            medications: [{ id: 'm1', name: 'Paracetamol', duration: '5 days', frequency: 'Twice daily' }]
          }
        ],
        currency: 'USD'
      }
    })

    const matches = await screen.findAllByText(/Unknown date/i)
    expect(matches.length).toBeGreaterThan(0)
  })
})
