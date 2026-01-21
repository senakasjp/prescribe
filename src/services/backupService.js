import { collection, doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase-config.js'
import firebaseStorage from './firebaseStorage.js'
import inventoryService from './pharmacist/inventoryService.js'

const BACKUP_VERSION = 1

const sanitizeDocData = (item) => {
  if (!item || typeof item !== 'object') {
    return {}
  }

  const { id, ...data } = item
  return data
}

const writeDoc = async (collectionName, item, overrides = {}, options = {}) => {
  if (!item?.id) {
    return
  }

  const payload = { ...sanitizeDocData(item), ...overrides }
  await setDoc(doc(db, collectionName, item.id), payload, options)
}

const writeSubDoc = async (parentRef, subcollectionName, item, overrides = {}, options = {}) => {
  if (!item?.id) {
    return
  }

  const payload = { ...sanitizeDocData(item), ...overrides }
  await setDoc(doc(collection(parentRef, subcollectionName), item.id), payload, options)
}

const exportDoctorBackup = async (doctorId) => {
  if (!doctorId) {
    throw new Error('Doctor ID is required for backup')
  }

  const doctor = await firebaseStorage.getDoctorById(doctorId)
  const patients = await firebaseStorage.getPatientsByDoctorId(doctorId)

  let symptoms = []
  let illnesses = []
  let prescriptions = []
  let longTermMedications = []

  for (const patient of patients) {
    const patientId = patient.id
    const [patientSymptoms, patientIllnesses, patientPrescriptions, patientLongTermMeds] = await Promise.all([
      firebaseStorage.getSymptomsByPatientId(patientId),
      firebaseStorage.getIllnessesByPatientId(patientId),
      firebaseStorage.getPrescriptionsByPatientId(patientId),
      firebaseStorage.getLongTermMedicationsByPatientId(patientId)
    ])

    symptoms = symptoms.concat(patientSymptoms)
    illnesses = illnesses.concat(patientIllnesses)
    prescriptions = prescriptions.concat(patientPrescriptions)
    longTermMedications = longTermMedications.concat(patientLongTermMeds)
  }

  const doctorReport = await firebaseStorage.getDoctorReport(doctorId)

  return {
    version: BACKUP_VERSION,
    type: 'doctor',
    createdAt: new Date().toISOString(),
    doctorId,
    doctor: doctor || null,
    doctorReport: doctorReport || null,
    patients,
    symptoms,
    illnesses,
    prescriptions,
    longTermMedications
  }
}

const restoreDoctorBackup = async (doctorId, backup, options = {}) => {
  if (!doctorId) {
    throw new Error('Doctor ID is required for restore')
  }
  if (!backup || backup.type !== 'doctor') {
    throw new Error('Invalid doctor backup file')
  }

  const writeOptions = options.merge === false ? undefined : { merge: true }

  if (backup.doctor) {
    await setDoc(
      doc(db, 'doctors', doctorId),
      {
        ...sanitizeDocData(backup.doctor),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    )
  }

  if (backup.doctorReport) {
    await setDoc(
      doc(db, 'doctorReports', doctorId),
      {
        ...sanitizeDocData(backup.doctorReport),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    )
  }

  const patients = Array.isArray(backup.patients) ? backup.patients : []
  for (const patient of patients) {
    await writeDoc('patients', patient, { doctorId }, writeOptions)
  }

  const symptoms = Array.isArray(backup.symptoms) ? backup.symptoms : []
  for (const symptom of symptoms) {
    await writeDoc('symptoms', symptom, { doctorId }, writeOptions)
  }

  const illnesses = Array.isArray(backup.illnesses) ? backup.illnesses : []
  for (const illness of illnesses) {
    await writeDoc('illnesses', illness, { doctorId }, writeOptions)
  }

  const prescriptions = Array.isArray(backup.prescriptions) ? backup.prescriptions : []
  for (const prescription of prescriptions) {
    await writeDoc('medications', prescription, { doctorId }, writeOptions)
  }

  const longTermMedications = Array.isArray(backup.longTermMedications) ? backup.longTermMedications : []
  for (const medication of longTermMedications) {
    await writeDoc('longTermMedications', medication, { doctorId }, writeOptions)
  }

  return {
    patients: patients.length,
    symptoms: symptoms.length,
    illnesses: illnesses.length,
    prescriptions: prescriptions.length,
    longTermMedications: longTermMedications.length
  }
}

const exportPharmacistBackup = async (pharmacistId) => {
  if (!pharmacistId) {
    throw new Error('Pharmacist ID is required for backup')
  }

  const pharmacist = await firebaseStorage.getPharmacistById(pharmacistId)
  const pharmacyUsers = await firebaseStorage.getPharmacyUsersByPharmacyId(pharmacistId)
  const inventoryItems = await inventoryService.getInventoryItems(pharmacistId)
  const receivedPrescriptions = await firebaseStorage.getPharmacistPrescriptions(pharmacistId)

  return {
    version: BACKUP_VERSION,
    type: 'pharmacist',
    createdAt: new Date().toISOString(),
    pharmacistId,
    pharmacist: pharmacist || null,
    pharmacyUsers,
    inventoryItems,
    receivedPrescriptions
  }
}

const restorePharmacistBackup = async (pharmacistId, backup, options = {}) => {
  if (!pharmacistId) {
    throw new Error('Pharmacist ID is required for restore')
  }
  if (!backup || backup.type !== 'pharmacist') {
    throw new Error('Invalid pharmacist backup file')
  }

  const writeOptions = options.merge === false ? undefined : { merge: true }

  if (backup.pharmacist) {
    await setDoc(
      doc(db, 'pharmacists', pharmacistId),
      {
        ...sanitizeDocData(backup.pharmacist),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    )
  }

  const pharmacyUsers = Array.isArray(backup.pharmacyUsers) ? backup.pharmacyUsers : []
  for (const user of pharmacyUsers) {
    await writeDoc('pharmacyUsers', user, { pharmacyId: pharmacistId }, writeOptions)
  }

  const inventoryItems = Array.isArray(backup.inventoryItems) ? backup.inventoryItems : []
  for (const item of inventoryItems) {
    await writeDoc('drugStock', item, { pharmacistId }, writeOptions)
  }

  const receivedPrescriptions = Array.isArray(backup.receivedPrescriptions) ? backup.receivedPrescriptions : []
  const pharmacistRef = doc(db, 'pharmacists', pharmacistId)
  for (const prescription of receivedPrescriptions) {
    await writeSubDoc(pharmacistRef, 'receivedPrescriptions', prescription, {}, writeOptions)
  }

  return {
    pharmacyUsers: pharmacyUsers.length,
    inventoryItems: inventoryItems.length,
    receivedPrescriptions: receivedPrescriptions.length
  }
}

export default {
  exportDoctorBackup,
  restoreDoctorBackup,
  exportPharmacistBackup,
  restorePharmacistBackup
}
