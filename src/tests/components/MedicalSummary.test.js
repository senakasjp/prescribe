import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import MedicalSummary from '../../components/MedicalSummary.svelte'

const mockGenerate = vi.fn()
const mockIsConfigured = vi.fn()
const mockGetPatientById = vi.fn()
const mockUpdatePatient = vi.fn()
const mockGetReportsByPatientId = vi.fn()

vi.mock('../../services/openaiService.js', () => ({
  default: {
    isConfigured: (...args) => mockIsConfigured(...args),
    generatePatientSummary: (...args) => mockGenerate(...args)
  }
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getPatientById: (...args) => mockGetPatientById(...args),
    updatePatient: (...args) => mockUpdatePatient(...args),
    getReportsByPatientId: (...args) => mockGetReportsByPatientId(...args)
  }
}))

describe('MedicalSummary - comprehensive contract', () => {
  const selectedPatient = {
    id: 'patient-1',
    firstName: 'Test',
    lastName: 'Patient',
    age: '34',
    weight: '76',
    bloodGroup: 'A+',
    gender: 'male',
    dateOfBirth: '1992-07-02',
    allergies: 'Penicillin',
    longTermMedications: 'Metformin',
    medicalHistory: 'Hypertension'
  }

  beforeEach(() => {
    mockGenerate.mockReset()
    mockIsConfigured.mockReset()
    mockGetPatientById.mockReset()
    mockUpdatePatient.mockReset()
    mockGetReportsByPatientId.mockReset()
    mockGetPatientById.mockResolvedValue({})
    mockUpdatePatient.mockResolvedValue()
    mockGetReportsByPatientId.mockResolvedValue([])
    localStorage.clear()
  })

  it('shows fallback error when OpenAI is not configured and no stored summary exists', async () => {
    mockIsConfigured.mockReturnValue(false)

    const { findByText } = render(MedicalSummary, {
      props: {
        selectedPatient,
        illnesses: [],
        prescriptions: [],
        symptoms: [],
        reports: [],
        doctorId: 'doc-1'
      }
    })

    expect(await findByText(/AI summary is unavailable because OpenAI is not configured/i)).toBeInTheDocument()
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('uses patient-provided stored summary when OpenAI is not configured', async () => {
    mockIsConfigured.mockReturnValue(false)

    const { findByText } = render(MedicalSummary, {
      props: {
        selectedPatient: {
          ...selectedPatient,
          medicalSummary: {
            content: '<p>Stored from patient payload</p>',
            signature: 'sig-1'
          }
        },
        illnesses: [],
        prescriptions: [],
        symptoms: [],
        reports: [],
        doctorId: 'doc-1'
      }
    })

    expect(await findByText('Stored from patient payload')).toBeInTheDocument()
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('renders generated summary and strips Risk Factors section', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockGenerate.mockResolvedValue({
      summary: '<h3>Assessment</h3><p>Stable.</p><h3>Risk Factors</h3><p>Should be removed</p><h3>Plan</h3><p>Follow up</p>'
    })

    const { findByText, queryByText } = render(MedicalSummary, {
      props: {
        selectedPatient,
        illnesses: [],
        prescriptions: [],
        symptoms: [],
        reports: [],
        doctorId: 'doc-1'
      }
    })

    expect(await findByText('Stable.')).toBeInTheDocument()
    expect(await findByText('Follow up')).toBeInTheDocument()
    expect(queryByText('Should be removed')).not.toBeInTheDocument()
  })

  it('sends complete patient summary payload (patient fields + symptoms + illnesses + reports + doctorId)', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockGenerate.mockResolvedValue({ summary: '<p>Summary content</p>' })

    const symptoms = [{ id: 's1', symptom: 'Cough', createdAt: '2026-02-01T00:00:00.000Z' }]
    const illnesses = [{ id: 'i1', diagnosis: 'Flu', createdAt: '2026-02-02T00:00:00.000Z' }]
    const reports = [{ id: 'r1', title: 'CBC', date: '2026-02-03', content: 'Normal' }]

    render(MedicalSummary, {
      props: {
        selectedPatient,
        illnesses,
        prescriptions: [],
        symptoms,
        reports,
        doctorId: 'doc-77'
      }
    })

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledTimes(1)
    })

    const [payload, doctorId] = mockGenerate.mock.calls[0]
    expect(doctorId).toBe('doc-77')
    expect(payload).toEqual(expect.objectContaining({
      firstName: 'Test',
      lastName: 'Patient',
      age: '34',
      weight: '76',
      bloodGroup: 'A+',
      gender: 'male',
      dateOfBirth: '1992-07-02',
      allergies: 'Penicillin',
      longTermMedications: 'Metformin',
      medicalHistory: 'Hypertension',
      symptoms,
      illnesses,
      recentReports: reports
    }))
  })

  it('includes saved reports from storage when local reports prop is empty', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockGenerate.mockResolvedValue({ summary: '<p>Summary with saved reports</p>' })
    mockGetReportsByPatientId.mockResolvedValue([
      {
        id: 'saved-r1',
        title: 'Saved Liver Panel',
        type: 'pdf',
        date: '2026-02-08',
        content: 'ALT mild elevation'
      }
    ])

    render(MedicalSummary, {
      props: {
        selectedPatient,
        illnesses: [],
        prescriptions: [],
        symptoms: [],
        reports: [],
        doctorId: 'doc-1'
      }
    })

    await waitFor(() => {
      const hasSavedReport = mockGenerate.mock.calls.some(([payload]) =>
        Array.isArray(payload?.recentReports)
        && payload.recentReports.some((report) => report?.id === 'saved-r1')
      )
      expect(hasSavedReport).toBe(true)
    })
  })

  it('includes only non-deleted prescriptions with medications', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockGenerate.mockResolvedValue({ summary: '<p>Uses clean prescriptions</p>' })

    const prescriptions = [
      {
        id: 'rx-active',
        status: 'pending',
        createdAt: '2026-02-15T10:00:00.000Z',
        medications: [{ id: 'm1', name: 'Corex', frequency: 'TDS', duration: '5 days' }]
      },
      {
        id: 'rx-deleted-flag',
        status: 'active',
        deleted: true,
        medications: [{ id: 'm2', name: 'ShouldDrop' }]
      },
      {
        id: 'rx-cancelled',
        status: 'cancelled',
        medications: [{ id: 'm3', name: 'ShouldDrop2' }]
      },
      {
        id: 'rx-no-meds',
        status: 'active',
        medications: []
      }
    ]

    render(MedicalSummary, {
      props: {
        selectedPatient,
        illnesses: [],
        prescriptions,
        symptoms: [],
        reports: [],
        doctorId: 'doc-1'
      }
    })

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalled()
    })

    const [payload] = mockGenerate.mock.calls[0]
    expect(payload.prescriptions).toHaveLength(1)
    expect(payload.prescriptions[0].id).toBe('rx-active')
  })

  it('saves generated summary into patient record with ai metadata', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockGenerate.mockResolvedValue({ summary: '<p>Persist me</p>' })

    const { findByText } = render(MedicalSummary, {
      props: {
        selectedPatient,
        illnesses: [],
        prescriptions: [],
        symptoms: [],
        reports: [],
        doctorId: 'doc-1'
      }
    })

    expect(await findByText('Persist me')).toBeInTheDocument()
    await waitFor(() => {
      expect(mockUpdatePatient).toHaveBeenCalledWith(
        'patient-1',
        expect.objectContaining({
          medicalSummary: expect.objectContaining({
            content: '<p>Persist me</p>',
            source: 'ai',
            signature: expect.any(String),
            updatedAt: expect.any(String)
          })
        })
      )
    })
  })

  it('uses cache for unchanged signature and avoids duplicate generation', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockGenerate.mockResolvedValue({ summary: '<p>Cached summary</p>' })

    const props = {
      selectedPatient,
      illnesses: [],
      prescriptions: [],
      symptoms: [{ id: 's1', symptom: 'Fever', createdAt: '2026-02-01T00:00:00.000Z' }],
      reports: [],
      doctorId: 'doc-1'
    }

    const first = render(MedicalSummary, { props })
    expect(await first.findByText('Cached summary')).toBeInTheDocument()
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledTimes(1)
    })

    first.unmount()

    const second = render(MedicalSummary, { props })
    expect(await second.findByText('Cached summary')).toBeInTheDocument()
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledTimes(1)
    })
  })

  it('regenerates when summary signature changes', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockGenerate.mockResolvedValue({ summary: '<p>Dynamic summary</p>' })

    const { component, findByText } = render(MedicalSummary, {
      props: {
        selectedPatient,
        illnesses: [],
        prescriptions: [],
        symptoms: [{ id: 's1', symptom: 'Headache', createdAt: '2026-02-01T00:00:00.000Z' }],
        reports: [],
        doctorId: 'doc-1'
      }
    })

    expect(await findByText('Dynamic summary')).toBeInTheDocument()
    await waitFor(() => expect(mockGenerate).toHaveBeenCalledTimes(1))

    await component.$set({
      selectedPatient: {
        ...selectedPatient,
        updatedAt: '2026-02-03T00:00:00.000Z'
      }
    })

    await waitFor(() => expect(mockGenerate).toHaveBeenCalledTimes(2))
  })

  it('refresh button triggers explicit regeneration', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockGenerate.mockResolvedValue({ summary: '<p>Summary content</p>' })

    const { getByRole, findByText } = render(MedicalSummary, {
      props: {
        selectedPatient,
        illnesses: [],
        prescriptions: [],
        symptoms: [],
        reports: [],
        doctorId: 'doc-1'
      }
    })

    await findByText('Summary content')
    await fireEvent.click(getByRole('button', { name: /Refresh/i }))

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledTimes(2)
    })
  })

  it('shows generation error when OpenAI call fails', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockGenerate.mockRejectedValue(new Error('AI generation failed'))

    const { findByText } = render(MedicalSummary, {
      props: {
        selectedPatient,
        illnesses: [],
        prescriptions: [],
        symptoms: [],
        reports: [],
        doctorId: 'doc-1'
      }
    })

    expect(await findByText(/AI generation failed/i)).toBeInTheDocument()
  })
})
