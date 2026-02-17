import { describe, it, expect, beforeAll } from 'vitest'
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, db } from '../../firebase-config.js'
import backupService from '../../services/backupService.js'

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || ''
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
const shouldRun = emulatorHost.length > 0

let emulatorConnected = false
let authEmulatorConnected = false
let emulatorAvailable = shouldRun

const getEmulatorTarget = () => {
  const [host, portString] = emulatorHost.split(':')
  const port = Number(portString || 8080)
  return { host: host || 'localhost', port }
}

const checkEmulatorAvailable = async () => {
  if (!shouldRun) return false
  const { host, port } = getEmulatorTarget()
  const projectId =
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'demo-test'
  const probeUrl =
    `http://${host}:${port}/v1/projects/${projectId}/databases/(default)/documents`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1000)
  try {
    await fetch(probeUrl, { signal: controller.signal })
    return true
  } catch (error) {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

const connectEmulatorIfNeeded = () => {
  if (!shouldRun || !emulatorAvailable || emulatorConnected) return
  const { host, port } = getEmulatorTarget()
  connectFirestoreEmulator(db, host, port)
  emulatorConnected = true
}

const connectAuthIfNeeded = () => {
  if (!shouldRun || !emulatorAvailable || authEmulatorConnected) return
  const [host, portString] = authEmulatorHost.split(':')
  const url = `http://${host || '127.0.0.1'}:${Number(portString || 9099)}`
  connectAuthEmulator(auth, url, { disableWarnings: true })
  authEmulatorConnected = true
}

const ensureAdminSignedIn = async () => {
  const adminEmail = 'senakahks@gmail.com'
  const adminPassword = 'TestAdmin#123'
  try {
    await createUserWithEmailAndPassword(auth, adminEmail, adminPassword)
  } catch (error) {
    if (error?.code !== 'auth/email-already-in-use') {
      throw error
    }
  }
  await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
}

describe('backupService (integration)', () => {
  beforeAll(async () => {
    emulatorAvailable = await checkEmulatorAvailable()
    if (!emulatorAvailable) {
      console.warn('Firestore emulator not reachable, skipping integration test.')
      return
    }
    connectEmulatorIfNeeded()
    connectAuthIfNeeded()
    try {
      await ensureAdminSignedIn()
    } catch (error) {
      emulatorAvailable = false
      console.warn('Auth emulator sign-in unavailable, skipping backup integration tests.', error?.message || error)
    }
  })

  it.skipIf(!shouldRun)(
    'exports and restores pharmacist backup using Firestore emulator',
    async () => {
      if (!emulatorAvailable) return
      const runId = Date.now()
      const pharmacistA = `test-pharm-a-${runId}`
    const pharmacyUserId = `test-user-${runId}`
    const itemA = `test-item-a-${runId}`
    const itemB = `test-item-b-${runId}`
    const rxId = `test-rx-${runId}`

    await setDoc(doc(db, 'pharmacists', pharmacistA), {
      id: pharmacistA,
      email: `pharm-a-${runId}@example.com`,
      pharmacistNumber: '123456',
      createdAt: new Date().toISOString()
    })

    await setDoc(doc(db, 'pharmacyUsers', pharmacyUserId), {
      id: pharmacyUserId,
      email: `user-${runId}@example.com`,
      pharmacyId: pharmacistA,
      pharmacistNumber: '123456',
      role: 'pharmacist',
      createdAt: new Date().toISOString()
    })

    await setDoc(doc(db, 'pharmacistInventory', itemA), {
      id: itemA,
      pharmacistId: pharmacistA,
      pharmacyId: pharmacistA,
      brandName: 'Test Drug A',
      currentStock: 5,
      createdAt: new Date().toISOString()
    })

    await setDoc(doc(db, 'pharmacistInventory', itemB), {
      id: itemB,
      pharmacistId: pharmacistA,
      pharmacyId: pharmacistA,
      brandName: 'Test Drug B',
      currentStock: 10,
      createdAt: new Date().toISOString()
    })

    await setDoc(doc(collection(doc(db, 'pharmacists', pharmacistA), 'receivedPrescriptions'), rxId), {
      id: rxId,
      patientName: 'Test Patient',
      createdAt: new Date().toISOString()
    })

    const backup = await backupService.exportPharmacistBackup(pharmacistA)
    expect(backup.type).toBe('pharmacist')
    expect(backup.inventoryItems.length).toBe(2)
    expect(backup.pharmacyUsers.length).toBe(1)
    expect(backup.receivedPrescriptions.length).toBe(1)

    await backupService.restorePharmacistBackup(pharmacistA, backup)

    const inventoryQuery = query(
      collection(db, 'pharmacistInventory'),
      where('pharmacistId', '==', pharmacistA)
    )
    const inventorySnap = await getDocs(inventoryQuery)
    expect(inventorySnap.size).toBe(2)

    const restoredUserSnap = await getDoc(doc(db, 'pharmacyUsers', pharmacyUserId))
    expect(restoredUserSnap.exists()).toBe(true)
    expect(restoredUserSnap.data().pharmacyId).toBe(pharmacistA)

    const rxSnap = await getDocs(
      collection(doc(db, 'pharmacists', pharmacistA), 'receivedPrescriptions')
    )
    expect(rxSnap.size).toBe(1)
  },
  30000
  )

  it.skipIf(!shouldRun)(
    'exports and restores doctor backup data using Firestore emulator',
    async () => {
      if (!emulatorAvailable) return
      const runId = Date.now()
      const sourceDoctorId = `test-doc-src-${runId}`
      const patientId = `test-patient-${runId}`
      const symptomId = `test-symptom-${runId}`
      const illnessId = `test-illness-${runId}`
      const prescriptionId = `test-prescription-${runId}`
      const longTermMedicationId = `test-ltm-${runId}`
      const reportId = `test-report-${runId}`

      await setDoc(doc(db, 'doctors', sourceDoctorId), {
        id: sourceDoctorId,
        email: `doctor-src-${runId}@example.com`,
        createdAt: new Date().toISOString()
      })

      await setDoc(doc(db, 'doctorReports', sourceDoctorId), {
        id: sourceDoctorId,
        doctorId: sourceDoctorId,
        overview: 'Source doctor report'
      })

      await setDoc(doc(db, 'patients', patientId), {
        id: patientId,
        doctorId: sourceDoctorId,
        firstName: 'Backup',
        lastName: 'Patient',
        createdAt: new Date().toISOString()
      })

      await setDoc(doc(db, 'symptoms', symptomId), {
        id: symptomId,
        patientId,
        doctorId: sourceDoctorId,
        symptoms: ['fever'],
        createdAt: new Date().toISOString()
      })

      await setDoc(doc(db, 'illnesses', illnessId), {
        id: illnessId,
        patientId,
        doctorId: sourceDoctorId,
        illnessName: 'Flu',
        createdAt: new Date().toISOString()
      })

      await setDoc(doc(db, 'medications', prescriptionId), {
        id: prescriptionId,
        patientId,
        doctorId: sourceDoctorId,
        medications: [{ name: 'Paracetamol' }],
        createdAt: new Date().toISOString()
      })

      await setDoc(doc(db, 'longTermMedications', longTermMedicationId), {
        id: longTermMedicationId,
        patientId,
        doctorId: sourceDoctorId,
        medicationName: 'Vitamin D',
        createdAt: new Date().toISOString()
      })

      await setDoc(doc(db, 'reports', reportId), {
        id: reportId,
        patientId,
        doctorId: sourceDoctorId,
        title: 'CBC',
        type: 'text',
        content: 'Normal',
        createdAt: new Date().toISOString()
      })

      const backup = await backupService.exportDoctorBackup(sourceDoctorId)
      expect(backup.type).toBe('doctor')
      expect(backup.patients.length).toBe(1)
      expect(backup.symptoms.length).toBe(1)
      expect(backup.illnesses.length).toBe(1)
      expect(backup.prescriptions.length).toBe(1)
      expect(backup.longTermMedications.length).toBe(1)
      expect(backup.reports.length).toBe(1)
      expect(backup.doctorReport?.overview).toBe('Source doctor report')

      const restoreResult = await backupService.restoreDoctorBackup(sourceDoctorId, backup)
      expect(restoreResult).toMatchObject({
        patients: 1,
        symptoms: 1,
        reports: 1,
        illnesses: 1,
        prescriptions: 1,
        longTermMedications: 1
      })

      const restoredDoctorSnap = await getDoc(doc(db, 'doctors', sourceDoctorId))
      expect(restoredDoctorSnap.exists()).toBe(true)

      const restoredDoctorReportSnap = await getDoc(doc(db, 'doctorReports', sourceDoctorId))
      expect(restoredDoctorReportSnap.exists()).toBe(true)
      expect(restoredDoctorReportSnap.data().overview).toBe('Source doctor report')

      const restoredPatientQuery = query(
        collection(db, 'patients'),
        where('doctorId', '==', sourceDoctorId)
      )
      const restoredPatientSnap = await getDocs(restoredPatientQuery)
      expect(restoredPatientSnap.size).toBe(1)

      const restoredSymptomSnap = await getDoc(doc(db, 'symptoms', symptomId))
      expect(restoredSymptomSnap.exists()).toBe(true)
      expect(restoredSymptomSnap.data().doctorId).toBe(sourceDoctorId)

      const restoredPrescriptionSnap = await getDoc(doc(db, 'medications', prescriptionId))
      expect(restoredPrescriptionSnap.exists()).toBe(true)
      expect(restoredPrescriptionSnap.data().doctorId).toBe(sourceDoctorId)

      const restoredReportSnap = await getDoc(doc(db, 'reports', reportId))
      expect(restoredReportSnap.exists()).toBe(true)
      expect(restoredReportSnap.data().doctorId).toBe(sourceDoctorId)
    },
    30000
  )

  it.skipIf(!shouldRun)(
    'rejects cross-tenant restore when backup owner id does not match target id',
    async () => {
      if (!emulatorAvailable) return

      await expect(backupService.restoreDoctorBackup('doc-target', {
        type: 'doctor',
        doctorId: 'doc-source',
        patients: [],
        symptoms: [],
        reports: [],
        illnesses: [],
        prescriptions: [],
        longTermMedications: []
      })).rejects.toThrow('Backup doctorId mismatch')

      await expect(backupService.restorePharmacistBackup('ph-target', {
        type: 'pharmacist',
        pharmacistId: 'ph-source',
        pharmacyUsers: [],
        inventoryItems: [],
        receivedPrescriptions: []
      })).rejects.toThrow('Backup pharmacistId mismatch')
    }
  )

  it.skipIf(!shouldRun)(
    'blocks backup export and restore attempts when signed out',
    async () => {
      if (!emulatorAvailable) return
      const runId = Date.now()
      const pharmacistId = `test-pharm-auth-${runId}`

      await setDoc(doc(db, 'pharmacists', pharmacistId), {
        id: pharmacistId,
        email: 'senakahks@gmail.com',
        pharmacistNumber: '654321',
        createdAt: new Date().toISOString()
      })

      await signOut(auth)

      await expect(backupService.exportPharmacistBackup(pharmacistId)).rejects.toMatchObject({
        code: 'permission-denied'
      })

      await expect(backupService.restorePharmacistBackup(pharmacistId, {
        type: 'pharmacist',
        pharmacist: { id: pharmacistId, email: 'senakahks@gmail.com' },
        pharmacyUsers: [],
        inventoryItems: [],
        receivedPrescriptions: []
      })).rejects.toMatchObject({
        code: 'permission-denied'
      })

      await ensureAdminSignedIn()
    },
    30000
  )
})
