import { describe, expect, it } from 'vitest'
import {
  buildDispensedMedicationKey,
  buildPersistedDispensedSet,
  isMedicationAlreadyDispensed
} from '../../utils/pharmacistDispenseState.js'

describe('pharmacistDispenseState', () => {
  it('builds deterministic dispense keys', () => {
    expect(buildDispensedMedicationKey('rx-1', 'med-1')).toBe('rx-1-med-1')
  })

  it('derives persisted dispensed keys only from server prescription payload', () => {
    const selectedPrescription = {
      status: 'pending',
      dispensedMedications: [
        { prescriptionId: 'rx-1', medicationId: 'med-1', isDispensed: true },
        { prescriptionId: 'rx-1', medicationId: 'med-2', isDispensed: false },
        { prescriptionId: '', medicationId: 'med-3', isDispensed: true }
      ]
    }

    const persisted = buildPersistedDispensedSet(selectedPrescription)
    expect(persisted.has('rx-1-med-1')).toBe(true)
    expect(persisted.has('rx-1-med-2')).toBe(false)
    expect(persisted.size).toBe(1)
  })

  it('keeps pending medications selectable when not in persisted dispensed list', () => {
    const selectedPrescription = { status: 'pending', dispensedMedications: [] }
    const persisted = buildPersistedDispensedSet(selectedPrescription)

    const locked = isMedicationAlreadyDispensed({
      selectedPrescription,
      persistedDispensedMedications: persisted,
      prescriptionId: 'rx-1',
      medicationId: 'med-1'
    })

    expect(locked).toBe(false)
  })

  it('locks medications when prescription is already dispensed', () => {
    const selectedPrescription = { status: 'dispensed', dispensedMedications: [] }

    const locked = isMedicationAlreadyDispensed({
      selectedPrescription,
      persistedDispensedMedications: new Set(),
      prescriptionId: 'rx-1',
      medicationId: 'med-1'
    })

    expect(locked).toBe(true)
  })
})

