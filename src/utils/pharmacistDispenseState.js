export const buildDispensedMedicationKey = (prescriptionId, medicationId) => `${prescriptionId}-${medicationId}`

export const buildPersistedDispensedSet = (selectedPrescription) => {
  const nextKeys = new Set()
  const entries = Array.isArray(selectedPrescription?.dispensedMedications)
    ? selectedPrescription.dispensedMedications
    : []

  for (const entry of entries) {
    if (!entry || entry.isDispensed === false) continue
    if (!entry.prescriptionId || !entry.medicationId) continue
    nextKeys.add(buildDispensedMedicationKey(entry.prescriptionId, entry.medicationId))
  }

  return nextKeys
}

export const isMedicationAlreadyDispensed = ({
  selectedPrescription,
  persistedDispensedMedications,
  prescriptionId,
  medicationId
}) => {
  const key = buildDispensedMedicationKey(prescriptionId, medicationId)
  if (persistedDispensedMedications?.has(key)) {
    return true
  }

  return selectedPrescription?.status === 'dispensed'
}

