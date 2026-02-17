/**
 * Component tests for PatientPrescriptions
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import PatientPrescriptions from '../../components/patient/PatientPrescriptions.svelte'

const samplePrescription = {
  id: 'rx-1',
  createdAt: '2025-01-01T00:00:00.000Z',
  status: 'saved',
  medications: [
    { id: 'med-1', name: 'Amoxicillin', dosage: '500mg', frequency: 'Once daily' }
  ]
}

describe('PatientPrescriptions', () => {
  it('dispatches add-prescription when clicking New Prescription', async () => {
    const { component, getByText } = render(PatientPrescriptions, {
      props: {
        prescriptions: [samplePrescription],
        selectedPatient: { id: 'pat-1', firstName: 'John', lastName: 'Doe' },
        doctorId: 'doc-1'
      }
    })

    const handler = vi.fn()
    component.$on('add-prescription', handler)

    await fireEvent.click(getByText('New Prescription'))
    expect(handler).toHaveBeenCalled()
  })

  it('dispatches print-prescription when clicking Print', async () => {
    const { component, container } = render(PatientPrescriptions, {
      props: {
        prescriptions: [samplePrescription],
        selectedPatient: { id: 'pat-1', firstName: 'John', lastName: 'Doe' },
        doctorId: 'doc-1'
      }
    })

    const handler = vi.fn()
    component.$on('print-prescription', handler)

    const printButton = container.querySelector('button[title=\"Print prescription\"]')
    if (!printButton) {
      throw new Error('Print button not found')
    }
    await fireEvent.click(printButton)
    expect(handler).toHaveBeenCalled()
  })
})
