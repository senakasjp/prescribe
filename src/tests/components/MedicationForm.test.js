import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import MedicationForm from '../../components/MedicationForm.svelte'
import openaiService from '../../services/openaiService.js'

vi.mock('../../services/pharmacyMedicationService.js', () => ({
  pharmacyMedicationService: {
    getPharmacyStock: vi.fn(async () => []),
    searchMedicationsFromPharmacies: vi.fn(async () => []),
    getConnectedPharmacies: vi.fn(async () => [])
  }
}))

vi.mock('../../services/openaiService.js', () => ({
  default: {
    improveText: vi.fn(async (text) => ({ improvedText: text, tokensUsed: 0 }))
  }
}))

vi.mock('../../services/doctor/doctorAuthService.js', () => ({
  default: {
    getCurrentDoctor: vi.fn(() => ({ id: 'doc-1' }))
  }
}))

describe('MedicationForm qty behavior', () => {
  const buildEditingMedication = (overrides = {}) => ({
    id: 'med-1',
    name: 'Dandex',
    genericName: 'Dandex',
    dosage: '1',
    dosageForm: 'Ointment',
    strength: '100',
    strengthUnit: 'mg',
    route: 'PO',
    instructions: '',
    frequency: 'As needed (PRN)',
    timing: '',
    duration: '5 days',
    startDate: '2026-02-13',
    endDate: null,
    notes: '',
    ...overrides
  })
  const setSelectValue = async (element, value) => {
    await fireEvent.change(element, { target: { value } })
    if (element.value !== value) {
      element.value = value
      await fireEvent.change(element)
    }
  }

  it('shows Qunatity and hides when-to-take for qts dosage forms', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication()
      }
    })

    await waitFor(() => {
      expect(container.querySelector('#medicationQts')).toBeTruthy()
    })
    expect(container.querySelector('#medicationTiming')).toBeNull()
  })

  it('requires Qunatity when qts mode is active', async () => {
    const { component, container, getByText } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({ qts: '' })
      }
    })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.submit(container.querySelector('form'))

    expect(onAdded).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(getByText('Please enter Qts as a positive integer')).toBeTruthy()
    })
  })

  it('submits with qts and includes qts in payload', async () => {
    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({ qts: '3' })
      }
    })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.input(container.querySelector('#medicationQts'), {
      target: { value: '3' }
    })

    await fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledTimes(1)
    })

    const payload = onAdded.mock.calls[0][0].detail
    expect(payload.qts).toBe('3')
    expect(payload.timing).toBe('')
    expect(payload.prnAmount).toBe('')
  })

  it('allows empty frequency and duration in qts mode', async () => {
    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          qts: '2',
          frequency: '',
          duration: ''
        })
      }
    })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledTimes(1)
    })

    const payload = onAdded.mock.calls[0][0].detail
    expect(payload.qts).toBe('2')
    expect(payload.frequency).toBe('')
    expect(payload.duration).toBe(' days')
  })

  it('hides Qunatity and shows When to take for non-qts dosage forms', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Tablet',
          frequency: 'Once daily (OD)',
          duration: '5 days',
          timing: 'After meals (PC)'
        })
      }
    })

    expect(container.querySelector('#medicationQts')).toBeNull()
    expect(container.querySelector('#medicationTiming')).toBeTruthy()
    expect(container.querySelector('#medicationTiming')?.required).toBe(true)
    expect(container.querySelector('#medicationFrequency')?.required).toBe(true)
    expect(container.querySelector('#medicationDuration')?.required).toBe(true)
  })

  it('requires frequency and duration for non-qts dosage forms', async () => {
    const { component, container, getByText } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Tablet',
          frequency: '',
          duration: '',
          timing: 'After meals (PC)'
        })
      }
    })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.submit(container.querySelector('form'))

    expect(onAdded).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(getByText('Please fill in all required fields')).toBeTruthy()
    })
  })

  it('requires duration to be a positive integer for non-qts dosage forms', async () => {
    const { component, container, getByText } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Tablet',
          frequency: 'Once daily (OD)',
          duration: 'abc days',
          timing: 'After meals (PC)'
        })
      }
    })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.submit(container.querySelector('form'))

    expect(onAdded).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(getByText('Please enter duration as a positive integer')).toBeTruthy()
    })
  })

  it('requires when-to-take for non-qts dosage forms', async () => {
    const { component, container, getByText } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Capsule',
          frequency: 'Twice daily (BD)',
          duration: '5 days',
          timing: ''
        })
      }
    })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.submit(container.querySelector('form'))

    expect(onAdded).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(getByText('Please select when to take')).toBeTruthy()
    })
  })

  it('requires PRN amount for non-qts PRN medications', async () => {
    const { component, container, getByText } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Tablet',
          frequency: 'As needed (PRN)',
          duration: '5 days',
          timing: 'After meals (PC)',
          prnAmount: ''
        })
      }
    })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.submit(container.querySelector('form'))

    expect(onAdded).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(getByText('Please enter the PRN amount')).toBeTruthy()
    })
  })

  it('hides PRN amount input in qts mode even when frequency is PRN', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Cream',
          frequency: 'As needed (PRN)',
          qts: '2'
        })
      }
    })

    expect(container.querySelector('#prnAmount')).toBeNull()
  })

  it('clears qts in payload for non-qts dosage forms', async () => {
    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Tablet',
          frequency: 'Once daily (OD)',
          duration: '5 days',
          timing: 'After meals (PC)',
          qts: '4'
        })
      }
    })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledTimes(1)
    })

    const payload = onAdded.mock.calls[0][0].detail
    expect(payload.qts).toBe('')
  })

  it('requires brand name for non-qts dosage forms', async () => {
    const { component, container, getByText } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          name: '',
          dosageForm: 'Tablet',
          frequency: 'Once daily (OD)',
          duration: '5 days',
          timing: 'After meals (PC)'
        })
      }
    })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.submit(container.querySelector('form'))

    expect(onAdded).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(getByText('Please fill in all required fields')).toBeTruthy()
    })
  })

  it('submits non-qts non-PRN medication with empty prnAmount', async () => {
    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Tablet',
          frequency: 'Twice daily (BD)',
          duration: '5 days',
          timing: 'After meals (PC)',
          prnAmount: ''
        })
      }
    })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledTimes(1)
    })

    const payload = onAdded.mock.calls[0][0].detail
    expect(payload.qts).toBe('')
    expect(payload.prnAmount).toBe('')
    expect(payload.frequency).toBe('Twice daily (BD)')
    expect(payload.timing).toBe('After meals (PC)')
    expect(payload.duration).toBe('5 days')
  })

  it('submits non-qts PRN medication with prnAmount', async () => {
    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Capsule',
          frequency: 'As needed (PRN)',
          duration: '3 days',
          timing: 'At bedtime (HS)',
          prnAmount: '2'
        })
      }
    })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledTimes(1)
    })

    const payload = onAdded.mock.calls[0][0].detail
    expect(payload.qts).toBe('')
    expect(payload.prnAmount).toBe('2')
    expect(payload.frequency).toBe('As needed (PRN)')
    expect(payload.timing).toBe('At bedtime (HS)')
    expect(payload.duration).toBe('3 days')
  })

  it('keeps qts hidden for syrup dosage form', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Syrup',
          strength: '5',
          strengthUnit: 'ml',
          frequency: 'Once daily (OD)',
          duration: '5 days',
          timing: 'After meals (PC)'
        })
      }
    })

    expect(container.querySelector('#medicationQts')).toBeNull()
    expect(container.querySelector('#medicationTiming')).toBeTruthy()
  })

  describe('dosage form matrix', () => {
    const DOSAGE_FORM_MATRIX = [
      { form: 'Tablet', expectsQts: false },
      { form: 'Capsule', expectsQts: false },
      { form: 'Syrup', expectsQts: false },
      { form: 'Liquid', expectsQts: false },
      { form: 'Injection', expectsQts: true },
      { form: 'Cream', expectsQts: true },
      { form: 'Ointment', expectsQts: true },
      { form: 'Gel', expectsQts: true },
      { form: 'Suppository', expectsQts: true },
      { form: 'Drops', expectsQts: true },
      { form: 'Inhaler', expectsQts: true },
      { form: 'Spray', expectsQts: true },
      { form: 'Shampoo', expectsQts: true },
      { form: 'Packet', expectsQts: true },
      { form: 'Roll', expectsQts: true }
    ]

    it.each(DOSAGE_FORM_MATRIX)(
      'applies qts/timing visibility rules for $form',
      async ({ form, expectsQts }) => {
        const { container } = render(MedicationForm, {
          props: {
            visible: true,
            doctorId: 'doc-1',
            editingMedication: buildEditingMedication({
              dosageForm: form,
              qts: expectsQts ? '2' : '',
              frequency: expectsQts ? '' : 'Once daily (OD)',
              duration: expectsQts ? '' : '5 days',
              timing: expectsQts ? '' : 'After meals (PC)'
            })
          }
        })

        if (expectsQts) {
          await waitFor(() => {
            expect(container.querySelector('#medicationQts')).toBeTruthy()
          })
          expect(container.querySelector('#medicationTiming')).toBeNull()
          expect(container.querySelector('#medicationFrequency')?.required).toBe(false)
          expect(container.querySelector('#medicationDuration')?.required).toBe(false)
        } else {
          expect(container.querySelector('#medicationQts')).toBeNull()
          expect(container.querySelector('#medicationTiming')).toBeTruthy()
          expect(container.querySelector('#medicationTiming')?.required).toBe(true)
          expect(container.querySelector('#medicationFrequency')?.required).toBe(true)
          expect(container.querySelector('#medicationDuration')?.required).toBe(true)
        }
      }
    )

    it('treats ml strength units as non-qts even for qts forms', async () => {
      const { container } = render(MedicationForm, {
        props: {
          visible: true,
          doctorId: 'doc-1',
          editingMedication: buildEditingMedication({
            dosageForm: 'Cream',
            strength: '100',
            strengthUnit: 'ml',
            qts: '2',
            frequency: 'Once daily (OD)',
            duration: '5 days',
            timing: 'After meals (PC)'
          })
        }
      })

      expect(container.querySelector('#medicationQts')).toBeNull()
      expect(container.querySelector('#medicationTiming')).toBeTruthy()
      expect(container.querySelector('#medicationTiming')?.required).toBe(true)
    })
  })

  describe('qts validation matrix', () => {
    it.each(['0', '-1', '2.5', 'abc', '   '])(
      'rejects invalid qts value "%s"',
      async (invalidValue) => {
        const { component, container, getByText } = render(MedicationForm, {
          props: {
            visible: true,
            doctorId: 'doc-1',
            editingMedication: buildEditingMedication({
              dosageForm: 'Cream',
              qts: '',
              frequency: '',
              duration: ''
            })
          }
        })

        const onAdded = vi.fn()
        component.$on('medication-added', onAdded)

        await fireEvent.input(container.querySelector('#medicationQts'), {
          target: { value: invalidValue }
        })
        await fireEvent.submit(container.querySelector('form'))

        expect(onAdded).not.toHaveBeenCalled()
        await waitFor(() => {
          expect(getByText('Please enter Qts as a positive integer')).toBeTruthy()
        })
      }
    )

    it('accepts a valid integer qts value', async () => {
      const { component, container } = render(MedicationForm, {
        props: {
          visible: true,
          doctorId: 'doc-1',
          editingMedication: buildEditingMedication({
            dosageForm: 'Cream',
            qts: '',
            frequency: '',
            duration: ''
          })
        }
      })

      const onAdded = vi.fn()
      component.$on('medication-added', onAdded)

      await fireEvent.input(container.querySelector('#medicationQts'), {
        target: { value: '4' }
      })
      await fireEvent.submit(container.querySelector('form'))

      await waitFor(() => {
        expect(onAdded).toHaveBeenCalledTimes(1)
      })

      const payload = onAdded.mock.calls[0][0].detail
      expect(payload.qts).toBe('4')
    })
  })

  it('passes medication context when improving brand name text', async () => {
    const { container, getByRole } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1'
      }
    })

    const brandInput = container.querySelector('#brandName')
    await fireEvent.input(brandInput, { target: { value: 'amoxcillin 500mg' } })

    await fireEvent.click(getByRole('button', { name: /Fix Spelling/i }))

    await waitFor(() => {
      expect(openaiService.improveText).toHaveBeenCalled()
    })

    expect(openaiService.improveText).toHaveBeenCalledWith(
      'amoxcillin 500mg',
      'doc-1',
      { context: 'medication-name' }
    )
  })
})
