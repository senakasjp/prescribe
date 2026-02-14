import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import MedicalSummary from '../../components/MedicalSummary.svelte'

const mockGenerate = vi.fn()
const mockIsConfigured = vi.fn()
const mockGetPatientById = vi.fn()
const mockUpdatePatient = vi.fn()

vi.mock('../../services/openaiService.js', () => ({
  default: {
    isConfigured: (...args) => mockIsConfigured(...args),
    generatePatientSummary: (...args) => mockGenerate(...args)
  }
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getPatientById: (...args) => mockGetPatientById(...args),
    updatePatient: (...args) => mockUpdatePatient(...args)
  }
}))

describe('MedicalSummary', () => {
  const selectedPatient = {
    id: 'patient-1',
    firstName: 'Test',
    lastName: 'Patient',
    age: '34'
  }

  beforeEach(() => {
    mockGenerate.mockReset()
    mockIsConfigured.mockReset()
    mockGetPatientById.mockReset()
    mockUpdatePatient.mockReset()
    mockGetPatientById.mockResolvedValue({})
    mockUpdatePatient.mockResolvedValue()
    localStorage.clear()
  })

  it('shows error when OpenAI is not configured', async () => {
    mockIsConfigured.mockReturnValue(false)

    const { findByText } = render(MedicalSummary, {
      props: { selectedPatient, illnesses: [], prescriptions: [], symptoms: [], doctorId: 'doc-1' }
    })

    expect(await findByText(/AI summary is unavailable/i)).toBeInTheDocument()
  })

  it('renders summary content when generated', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockGenerate.mockResolvedValue({ summary: '<p>Summary content</p>' })

    const { findByText } = render(MedicalSummary, {
      props: { selectedPatient, illnesses: [], prescriptions: [], symptoms: [], doctorId: 'doc-1' }
    })

    expect(await findByText('Summary content')).toBeInTheDocument()
  })

  it('refresh button triggers regeneration', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockGenerate.mockResolvedValue({ summary: '<p>Summary content</p>' })

    const { getByText, findByText } = render(MedicalSummary, {
      props: { selectedPatient, illnesses: [], prescriptions: [], symptoms: [], doctorId: 'doc-1' }
    })

    await findByText('Summary content')

    const refreshButton = getByText('Refresh')
    await fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledTimes(2)
    })
  })

  it('includes patient reports when generating summary', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockGenerate.mockResolvedValue({ summary: '<p>Report-aware summary</p>' })
    const reports = [
      {
        id: 'rep-1',
        title: 'FBC Report',
        type: 'pdf',
        date: '2026-02-01',
        content: 'Hemoglobin improved'
      }
    ]

    const { findByText } = render(MedicalSummary, {
      props: { selectedPatient, illnesses: [], prescriptions: [], symptoms: [], reports, doctorId: 'doc-1' }
    })

    expect(await findByText('Report-aware summary')).toBeInTheDocument()
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        recentReports: reports
      }),
      'doc-1'
    )
  })

  it('includes current non-finalized prescriptions when generating summary', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockGenerate.mockResolvedValue({ summary: '<p>Includes current prescription</p>' })
    const prescriptions = [
      {
        id: 'rx-current',
        status: 'pending',
        createdAt: '2026-02-12T10:00:00.000Z',
        medications: [
          { id: 'med-1', name: 'Corex', dosage: '1', frequency: 'TDS', duration: '20 days' }
        ]
      }
    ]

    const { findByText } = render(MedicalSummary, {
      props: { selectedPatient, illnesses: [], prescriptions, symptoms: [], doctorId: 'doc-1' }
    })

    expect(await findByText('Includes current prescription')).toBeInTheDocument()
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        prescriptions: expect.arrayContaining([
          expect.objectContaining({
            id: 'rx-current'
          })
        ])
      }),
      'doc-1'
    )
  })
})
