import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import MedicationForm from '../../components/MedicationForm.svelte'
import openaiService from '../../services/openaiService.js'
import { pharmacyMedicationService } from '../../services/pharmacyMedicationService.js'

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

  it('locks and grays Dispense Form when medication comes from inventory', async () => {
    const { container, getByText } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'inventory',
          dosageForm: 'Liquid (measured)'
        })
      }
    })

    const formSelect = container.querySelector('#medicationDosageForm')
    expect(formSelect).toBeTruthy()
    expect(formSelect.disabled).toBe(true)
    expect(getByText('Dispense Form is locked from inventory record.')).toBeTruthy()
  })

  it('shows inventory dispense form as text in Count row without second input', async () => {
    const { container, getByText } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'inventory',
          dosageForm: 'Liquid (bottles)',
          qts: '2'
        })
      }
    })

    expect(container.querySelector('#liquidDosePerFrequencyMl')).toBeNull()
    expect(container.querySelectorAll('#medicationDosageForm option[value="Liquid (bottles)"]').length).toBe(1)
    expect(container.textContent).toContain('Liquid (bottles)')
  })

  it('shows fractional dosage options for tablets only', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'manual',
          dosageForm: 'Tablet',
          dosage: '1/2'
        })
      }
    })

    const dosageSelect = container.querySelector('#medicationDosage')
    const optionValues = Array.from(dosageSelect?.querySelectorAll('option') || []).map((o) => o.value)
    expect(optionValues).toContain('1/2')
  })

  it('hides fractional dosage options for capsules', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'manual',
          dosageForm: 'Capsule',
          dosage: '1'
        })
      }
    })

    const dosageSelect = container.querySelector('#medicationDosage')
    const optionValues = Array.from(dosageSelect?.querySelectorAll('option') || []).map((o) => o.value)
    expect(optionValues).not.toContain('1/2')
    expect(optionValues).toContain('1')
    expect(optionValues).toContain('2')
  })

  it('derives genericName from hyphenated brand at save-time when generic is empty', async () => {
    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'manual',
          name: 'Omeprazole-SPMC',
          genericName: '',
          dosageForm: 'Capsule',
          dosage: '1',
          strength: '20',
          strengthUnit: 'mg',
          frequency: 'Once daily (OD)',
          timing: 'After meals (PC)',
          duration: '5 days'
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
    expect(payload.name).toBe('Omeprazole-SPMC')
    expect(payload.genericName).toBe('Omeprazole')
  })

  it('submits manual drug even when not available in own pharmacy inventory', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValueOnce([
      {
        drugName: 'KnownDrug',
        genericName: 'Known Generic',
        quantity: 10
      }
    ])

    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'manual',
          name: 'UnknownBrand',
          genericName: '',
          dosageForm: 'Tablet',
          dosage: '1',
          strength: '10',
          strengthUnit: 'mg',
          frequency: 'Twice daily (BD)',
          timing: 'After meals (PC)',
          duration: '5 days'
        })
      }
    })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledTimes(1)
    })
  })

  it('submits unavailable manual drugs without extra prompt', async () => {
    pharmacyMedicationService.getPharmacyStock.mockResolvedValueOnce([
      {
        drugName: 'KnownDrug',
        genericName: 'Known Generic',
        quantity: 10
      }
    ])
    const confirmSpy = vi.spyOn(window, 'confirm')

    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'manual',
          name: 'UnknownBrand',
          genericName: '',
          dosageForm: 'Tablet',
          dosage: '1',
          strength: '10',
          strengthUnit: 'mg',
          frequency: 'Twice daily (BD)',
          timing: 'After meals (PC)',
          duration: '5 days'
        })
      }
    })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledTimes(1)
    })
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('shows Dosage Strength and editable Total volume inputs for manual liquid bottles', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'manual',
          dosageForm: 'Liquid (bottles)',
          strength: '5',
          strengthUnit: 'ml',
          totalVolume: '200',
          volumeUnit: 'ml'
        })
      }
    })

    expect(container.textContent).toContain('Dosage Strength')
    expect(container.querySelector('#medicationStrength')).toBeTruthy()
    expect(container.querySelector('#medicationTotalVolume')).toBeTruthy()
    expect(container.querySelector('#medicationVolumeUnit')).toBeTruthy()
    expect(container.querySelector('#medicationTotalVolume')?.disabled).toBe(false)
    expect(container.querySelector('#medicationVolumeUnit')?.disabled).toBe(false)
  })

  it('locks Total volume inputs for inventory liquid bottles while keeping strength editable', async () => {
    const { container, getByText } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'inventory',
          dosageForm: 'Liquid (bottles)',
          strength: '',
          strengthUnit: '',
          totalVolume: '100',
          volumeUnit: 'ml'
        })
      }
    })

    expect(container.querySelector('#medicationStrength')).toBeTruthy()
    expect(container.querySelector('#medicationStrength')?.disabled).toBe(false)
    expect(container.querySelector('#medicationTotalVolume')).toBeTruthy()
    expect(container.querySelector('#medicationVolumeUnit')).toBeTruthy()
    expect(container.querySelector('#medicationTotalVolume')?.disabled).toBe(true)
    expect(container.querySelector('#medicationVolumeUnit')?.disabled).toBe(true)
    expect(getByText('Total volume is locked from inventory record.')).toBeTruthy()
  })

  it('swaps inventory liquid-bottle volume from strength field into total volume field', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'inventory',
          dosageForm: 'Liquid (bottles)',
          strength: '1000',
          strengthUnit: 'ml',
          totalVolume: '',
          volumeUnit: ''
        })
      }
    })

    const strengthInput = container.querySelector('#medicationStrength')
    const totalVolumeInput = container.querySelector('#medicationTotalVolume')
    const volumeUnitSelect = container.querySelector('#medicationVolumeUnit')

    expect(strengthInput).toBeTruthy()
    expect(totalVolumeInput).toBeTruthy()
    expect(volumeUnitSelect).toBeTruthy()
    expect(strengthInput?.value).toBe('')
    expect(totalVolumeInput?.value).toBe('1000')
    expect(volumeUnitSelect?.value).toBe('ml')
  })

  it('swaps inventory liquid-bottle volume when strength already contains unit text', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'inventory',
          dosageForm: 'Liquid (bottles)',
          strength: '1000 ml',
          strengthUnit: 'ml',
          totalVolume: '',
          volumeUnit: ''
        })
      }
    })

    const strengthInput = container.querySelector('#medicationStrength')
    const totalVolumeInput = container.querySelector('#medicationTotalVolume')
    const volumeUnitSelect = container.querySelector('#medicationVolumeUnit')

    expect(strengthInput?.value).toBe('')
    expect(totalVolumeInput?.value).toBe('1000')
    expect(volumeUnitSelect?.value).toBe('ml')
  })

  it('prefers inventory total volume over strength text when selecting liquid-bottle suggestion', async () => {
    vi.useFakeTimers()
    try {
      pharmacyMedicationService.searchMedicationsFromPharmacies.mockResolvedValueOnce([
        {
          brandName: 'Dompi Suspension 5mg/5ml',
          genericName: 'Domperidone',
          dosageForm: 'Liquid (bottles)',
          strength: '10',
          strengthUnit: 'ml',
          totalVolume: '30',
          volumeUnit: 'ml',
          currentStock: 50
        }
      ])

      const { container, getByText } = render(MedicationForm, {
        props: {
          visible: true,
          doctorId: 'doc-1',
          editingMedication: null
        }
      })

      const brandInput = container.querySelector('#brandName')
      await fireEvent.input(brandInput, { target: { value: 'Dompi' } })
      vi.advanceTimersByTime(300)

      await waitFor(() => {
        expect(getByText('Dompi Suspension 5mg/5ml (Domperidone)')).toBeTruthy()
      })

      await fireEvent.click(getByText('Dompi Suspension 5mg/5ml (Domperidone)'))

      const totalVolumeInput = container.querySelector('#medicationTotalVolume')
      const volumeUnitSelect = container.querySelector('#medicationVolumeUnit')
      expect(totalVolumeInput?.value).toBe('30')
      expect(volumeUnitSelect?.value).toBe('ml')
      expect(totalVolumeInput?.disabled).toBe(true)
      expect(volumeUnitSelect?.disabled).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses manual numeric entry fields for Count and PDF liquid value in liquid bottles', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'manual',
          dosageForm: 'Liquid (bottles)',
          qts: '2'
        })
      }
    })

    const countInput = container.querySelector('#medicationQts')
    const liquidPdfInput = container.querySelector('#liquidDosePerFrequencyMl')

    expect(countInput).toBeTruthy()
    expect(countInput?.getAttribute('type')).toBe('text')
    expect(countInput?.getAttribute('inputmode')).toBe('numeric')
    expect(countInput?.getAttribute('pattern')).toBe('[0-9]*')

    expect(liquidPdfInput).toBeTruthy()
    expect(liquidPdfInput?.getAttribute('type')).toBe('text')
    expect(liquidPdfInput?.getAttribute('inputmode')).toBe('numeric')
    expect(liquidPdfInput?.getAttribute('pattern')).toBe('[0-9]*')
  })

  it('keeps Count row field heights consistent with standard input sizing', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'manual',
          dosageForm: 'Liquid (bottles)',
          qts: '2'
        })
      }
    })

    const countInput = container.querySelector('#medicationQts')
    const liquidPdfInput = container.querySelector('#liquidDosePerFrequencyMl')
    const dosageStrengthInput = container.querySelector('#medicationStrength')
    const dosageStrengthUnit = container.querySelector('#medicationStrengthUnit')

    expect(countInput?.className).not.toContain('h-12')
    expect(liquidPdfInput?.className).not.toContain('h-12')
    expect(dosageStrengthInput?.className).not.toContain('h-12')
    expect(dosageStrengthUnit?.className).not.toContain('h-12')
  })

  it('parses inventory strength text into payload strength/unit when fields are empty', async () => {
    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'inventory',
          dosageForm: 'Liquid (measured)',
          strength: '',
          strengthUnit: '',
          inventoryStrengthText: '100 ml',
          frequency: 'Three times daily (TDS)',
          timing: 'After meals (PC)',
          duration: '3 days'
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
    expect(payload.source).toBe('inventory')
    expect(payload.inventoryStrengthText).toBe('100 ml')
    expect(payload.strength).toBe('100')
    expect(payload.strengthUnit).toBe('ml')
  })

  it('allows inventory liquid bottles to submit using inventory strength fallback when strength is empty', async () => {
    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'inventory',
          dosageForm: 'Liquid (bottles)',
          strength: '',
          strengthUnit: '',
          inventoryStrengthText: '100 ml',
          totalVolume: '100',
          volumeUnit: 'ml',
          qts: '2'
        })
      }
    })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)
    await fireEvent.submit(container.querySelector('form'))

    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1))
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
    expect(payload.dosage).toBe('1')
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

  it('treats legacy syrup dosage form with ml strength as non-qts scenario', async () => {
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

  it('treats liquid dispense forms as qts scenario', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Liquid (bottles)',
          qts: '60',
          frequency: '',
          duration: '',
          timing: ''
        })
      }
    })

    expect(container.querySelector('#medicationQts')).toBeTruthy()
    expect(container.querySelector('#medicationTiming')).toBeNull()
    expect(container.querySelector('#medicationFrequency')?.required).toBe(false)
    expect(container.querySelector('#medicationDuration')?.required).toBe(false)
  })

  it('treats liquid (measured) as non-qts and hides count input', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Liquid (measured)',
          strength: '10',
          strengthUnit: 'ml',
          qts: '90',
          frequency: 'Three times daily (TDS)',
          duration: '3 days',
          timing: 'After meals (PC)'
        })
      }
    })

    expect(container.querySelector('#medicationQts')).toBeNull()
    expect(container.querySelector('#medicationTiming')).toBeTruthy()
  })

  it('keeps packet in qts mode even when strength unit is ml', async () => {
    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Packet',
          strength: '1000',
          strengthUnit: 'ml',
          qts: '',
          frequency: '',
          duration: ''
        })
      }
    })

    const countInput = container.querySelector('#medicationQts')
    expect(countInput).toBeTruthy()
    expect(container.querySelector('#medicationTiming')).toBeNull()

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.input(countInput, { target: { value: '3' } })
    await fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledTimes(1)
    })

    const payload = onAdded.mock.calls[0][0].detail
    expect(payload.qts).toBe('3')
  })

  it('maps liquid qts integer to liquidAmountMl in payload', async () => {
    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Liquid (bottles)',
          qts: '60',
          frequency: '',
          duration: '',
          timing: ''
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
    expect(payload.liquidAmountMl).toBe('60')
    expect(payload.qts).toBe('60')
  })

  it('submits liquid measured using dosage strength only with no qts payload', async () => {
    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Liquid (measured)',
          strength: '10',
          strengthUnit: 'ml',
          qts: '',
          frequency: 'Three times daily (TDS)',
          duration: '3 days',
          timing: 'After meals (PC)'
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
    expect(payload.dosage).toBe('')
    expect(payload.qts).toBe('')
    expect(payload.liquidAmountMl).toBe('')
    expect(payload.liquidDosePerFrequencyMl).toBe('')
    expect(payload.frequency).toBe('Three times daily (TDS)')
  })

  it('hides dosage fraction selector for liquid measured even when strength unit is empty', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Liquid (measured)',
          strength: '10',
          strengthUnit: '',
          dosage: '1/2',
          qts: '',
          frequency: 'Three times daily (TDS)',
          duration: '3 days',
          timing: 'After meals (PC)'
        })
      }
    })

    expect(container.querySelector('#medicationDosage')).toBeNull()
  })

  it('allows entering strength for inventory liquid measured and requires it', async () => {
    const { component, container, getByText } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'inventory',
          dosageForm: 'Liquid (measured)',
          strength: '',
          strengthUnit: '',
          qts: '',
          frequency: 'Three times daily (TDS)',
          duration: '3 days',
          timing: 'After meals (PC)'
        })
      }
    })

    const strengthInput = container.querySelector('#medicationStrength')
    expect(strengthInput).toBeTruthy()
    expect(strengthInput?.required).toBe(true)

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.submit(container.querySelector('form'))
    expect(onAdded).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(getByText('Please enter the strength for this medication')).toBeTruthy()
    })
  })

  it('does not persist legacy dosage value for non-tablet/capsule forms', async () => {
    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Cream',
          dosage: '1',
          qts: '4',
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
    expect(payload.dosage).toBe('')
    expect(payload.qts).toBe('4')
  })

  it('does not persist dosage for syrup even in non-qts flow', async () => {
    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Syrup',
          strength: '5',
          strengthUnit: 'ml',
          dosage: '1',
          frequency: 'Once daily (OD)',
          duration: '5 days',
          timing: 'After meals (PC)'
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
    expect(payload.dosage).toBe('')
    expect(payload.qts).toBe('')
    expect(payload.frequency).toBe('Once daily (OD)')
  })

  it('captures liquid bottle ml print value in payload while keeping amount', async () => {
    const { component, container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Liquid (bottles)',
          qts: '120',
          frequency: '',
          duration: ''
        })
      }
    })

    await fireEvent.input(container.querySelector('#liquidDosePerFrequencyMl'), {
      target: { value: '5' }
    })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)
    await fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledTimes(1)
    })

    const payload = onAdded.mock.calls[0][0].detail
    expect(payload.qts).toBe('120')
    expect(payload.liquidAmountMl).toBe('120')
    expect(payload.liquidDosePerFrequencyMl).toBe('5')
  })

  describe('dosage form matrix', () => {
    const DOSAGE_FORM_MATRIX = [
      { form: 'Tablet', expectsQts: false, expectsDosageInput: true },
      { form: 'Capsule', expectsQts: false, expectsDosageInput: true },
      { form: 'Syrup', expectsQts: false, expectsDosageInput: false },
      { form: 'Liquid (bottles)', expectsQts: true, expectsDosageInput: false },
      { form: 'Liquid (measured)', expectsQts: false, expectsDosageInput: false },
      { form: 'Injection', expectsQts: true, expectsDosageInput: false },
      { form: 'Cream', expectsQts: true, expectsDosageInput: false },
      { form: 'Ointment', expectsQts: true, expectsDosageInput: false },
      { form: 'Gel', expectsQts: true, expectsDosageInput: false },
      { form: 'Suppository', expectsQts: true, expectsDosageInput: false },
      { form: 'Inhaler', expectsQts: true, expectsDosageInput: false },
      { form: 'Spray', expectsQts: true, expectsDosageInput: false },
      { form: 'Shampoo', expectsQts: true, expectsDosageInput: false },
      { form: 'Packet', expectsQts: true, expectsDosageInput: false },
      { form: 'Roll', expectsQts: true, expectsDosageInput: false }
    ]

    it.each(DOSAGE_FORM_MATRIX)(
      'applies qts/timing visibility rules for $form',
      async ({ form, expectsQts, expectsDosageInput }) => {
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

        if (expectsDosageInput) {
          expect(container.querySelector('#medicationDosage')).toBeTruthy()
        } else {
          expect(container.querySelector('#medicationDosage')).toBeNull()
        }
      }
    )

    it('keeps qts mode for non-excluded forms even when strength unit is ml', async () => {
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

      expect(container.querySelector('#medicationQts')).toBeTruthy()
      expect(container.querySelector('#medicationTiming')).toBeNull()
      expect(container.querySelector('#medicationFrequency')?.required).toBe(false)
      expect(container.querySelector('#medicationDuration')?.required).toBe(false)
    })

    it.each(['Tablet', 'Capsule', 'Liquid (measured)'])(
      'keeps count hidden for excluded form %s even with ml strength unit',
      async (form) => {
        const { container } = render(MedicationForm, {
          props: {
            visible: true,
            doctorId: 'doc-1',
            editingMedication: buildEditingMedication({
              dosageForm: form,
              strength: '10',
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
      }
    )
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

  it('dispatches cancel when top-right close button is clicked', async () => {
    const { component, getByRole } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1'
      }
    })

    const onCancel = vi.fn()
    component.$on('cancel', onCancel)

    await fireEvent.click(getByRole('button', { name: /close medication form/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('shows container size next to drug name in brand suggestions when available', async () => {
    pharmacyMedicationService.searchMedicationsFromPharmacies.mockResolvedValue([
      {
        brandName: 'Corex',
        genericName: 'Gen-Corex',
        dosageForm: 'Liquid (measured)',
        strength: '',
        strengthUnit: '',
        containerSize: 100,
        containerUnit: 'ml',
        currentStock: 5
      }
    ])

    const { container, getByText } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1'
      }
    })

    await fireEvent.input(container.querySelector('#brandName'), {
      target: { value: 'co' }
    })
    await fireEvent.focus(container.querySelector('#brandName'))

    await waitFor(() => {
      expect(pharmacyMedicationService.searchMedicationsFromPharmacies).toHaveBeenCalledWith('doc-1', 'co', 20)
    })

    await waitFor(() => {
      expect(container.textContent).toContain('Corex')
      expect(container.textContent).toMatch(/100\s*ml/i)
    })
  })

  it('does not append container text in brand suggestions when container size is missing', async () => {
    pharmacyMedicationService.searchMedicationsFromPharmacies.mockResolvedValue([
      {
        brandName: 'Panadol',
        genericName: 'Paracetamol',
        dosageForm: 'Tablet',
        strength: '500',
        strengthUnit: 'mg',
        containerSize: '',
        containerUnit: 'ml',
        currentStock: 10
      }
    ])

    const { container, getByText, queryByText } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1'
      }
    })

    await fireEvent.input(container.querySelector('#brandName'), {
      target: { value: 'pa' }
    })
    await fireEvent.focus(container.querySelector('#brandName'))

    await waitFor(() => {
      expect(pharmacyMedicationService.searchMedicationsFromPharmacies).toHaveBeenCalledWith('doc-1', 'pa', 20)
    })

    await waitFor(() => {
      expect(getByText(/Panadol\s*\(Paracetamol\)/i)).toBeTruthy()
    })
    expect(queryByText(/Panadol\s+\d+\s*(ml|g|pcs|tube|vial|ampoule)/i)).toBeNull()
  })

  it('shows Total volume label when strength unit is volume-based', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Packet',
          strength: '200',
          strengthUnit: 'ml'
        })
      }
    })

    await waitFor(() => {
      expect(container.textContent).toContain('Total volume')
    })
    expect(container.textContent).not.toContain('Dosage Strength')
  })

  it('shows Total volume label for packet dispense form even before selecting volume unit', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Packet',
          strength: '200',
          strengthUnit: ''
        })
      }
    })

    await waitFor(() => {
      expect(container.textContent).toContain('Total volume')
    })
    expect(container.textContent).not.toContain('Dosage Strength')
  })

  it('hides strength inputs for inventory packet medications and keeps volume lock hint', async () => {
    const { container, getByText } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'inventory',
          dosageForm: 'Packet',
          strength: '1000',
          strengthUnit: 'ml'
        })
      }
    })

    expect(container.textContent).toContain('Total volume')
    expect(container.querySelector('#medicationStrength')).toBeNull()
    expect(container.querySelector('#medicationStrengthUnit')).toBeNull()
    expect(getByText('Total volume is locked from inventory record.')).toBeTruthy()
  })

  it('shows editable strength for inventory injection medications', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          source: 'inventory',
          dosageForm: 'Injection',
          strength: '',
          strengthUnit: '',
          inventoryStrengthText: '1 mg'
        })
      }
    })

    expect(container.textContent).toContain('Dosage Strength')
    expect(container.querySelector('#medicationStrength')).toBeTruthy()
    expect(container.querySelector('#medicationStrength')?.disabled).toBe(false)
    expect(container.querySelector('#medicationStrengthUnit')).toBeTruthy()
    expect(container.querySelector('#medicationStrengthUnit')?.disabled).toBe(false)
  })

  it('keeps Dosage Strength label for liquid measured even with ml unit', async () => {
    const { container } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1',
        editingMedication: buildEditingMedication({
          dosageForm: 'Liquid (measured)',
          strength: '10',
          strengthUnit: 'ml'
        })
      }
    })

    await waitFor(() => {
      expect(container.textContent).toContain('Dosage Strength')
    })
    expect(container.textContent).not.toContain('Total volume')
  })

  it('separates packet volume from strength and does not show legacy tablets stock unit', async () => {
    pharmacyMedicationService.searchMedicationsFromPharmacies.mockResolvedValue([
      {
        brandName: 'Jeewani',
        genericName: 'PacketGeneric',
        dosageForm: 'Packet',
        strength: '200',
        strengthUnit: 'ml',
        containerSize: '',
        containerUnit: '',
        currentStock: 20,
        packUnit: 'tablets'
      }
    ])

    const { container, getByText } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1'
      }
    })

    await fireEvent.input(container.querySelector('#brandName'), {
      target: { value: 'jee' }
    })
    await fireEvent.focus(container.querySelector('#brandName'))

    await waitFor(() => {
      expect(pharmacyMedicationService.searchMedicationsFromPharmacies).toHaveBeenCalledWith('doc-1', 'jee', 20)
    })

    await waitFor(() => {
      expect(getByText(/Jeewani\s*\(PacketGeneric\)/i)).toBeTruthy()
      expect(container.textContent).toContain('Form: Packet')
      expect(container.textContent).toContain('Total volume: 200 ml')
      expect(container.textContent).toContain('(20 Packet)')
    })

    expect(container.textContent).not.toContain('Strength: 200 ml')
    expect(container.textContent).not.toContain('(20 tablets)')
  })

  it('persists non-strength inventory pack size as volume metadata for cream', async () => {
    pharmacyMedicationService.searchMedicationsFromPharmacies.mockResolvedValue([
      {
        brandName: 'Derm Keta cream-SPC',
        genericName: 'Ketoconazole Cream 2%',
        dosageForm: 'Cream',
        strength: '10',
        strengthUnit: 'g',
        containerSize: '',
        containerUnit: '',
        currentStock: 8
      }
    ])

    const { component, container, getByText } = render(MedicationForm, {
      props: {
        visible: true,
        doctorId: 'doc-1'
      }
    })

    await fireEvent.input(container.querySelector('#brandName'), {
      target: { value: 'derm' }
    })
    await fireEvent.focus(container.querySelector('#brandName'))

    await waitFor(() => {
      expect(pharmacyMedicationService.searchMedicationsFromPharmacies).toHaveBeenCalledWith('doc-1', 'derm', 20)
      expect(getByText(/Derm Keta cream-SPC/i)).toBeTruthy()
    })

    await fireEvent.click(getByText(/Derm Keta cream-SPC/i))
    await fireEvent.input(container.querySelector('#medicationQts'), { target: { value: '1' } })

    const onAdded = vi.fn()
    component.$on('medication-added', onAdded)

    await fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledTimes(1)
    })

    const payload = onAdded.mock.calls[0][0].detail
    expect(payload.dosageForm).toBe('Cream')
    expect(payload.strength).toBe('')
    expect(payload.strengthUnit).toBe('')
    expect(payload.totalVolume).toBe('10')
    expect(payload.volumeUnit).toBe('g')
    expect(payload.containerSize).toBe('10')
    expect(payload.containerUnit).toBe('g')
    expect(payload.inventoryStrengthText).toBe('10 g')
    expect(payload.qts).toBe('1')
  })
})
