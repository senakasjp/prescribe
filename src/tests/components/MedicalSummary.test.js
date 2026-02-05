import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import MedicalSummary from '../../components/MedicalSummary.svelte'

const mockGenerate = vi.fn()
const mockIsConfigured = vi.fn()

vi.mock('../../services/openaiService.js', () => ({
  default: {
    isConfigured: (...args) => mockIsConfigured(...args),
    generatePatientSummary: (...args) => mockGenerate(...args)
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
})
