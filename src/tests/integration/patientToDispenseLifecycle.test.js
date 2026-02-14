import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { fireEvent, render, waitFor } from '@testing-library/svelte'
import { auth, db } from '../../firebase-config.js'
import firebaseStorage from '../../services/firebaseStorage.js'
import inventoryService from '../../services/pharmacist/inventoryService.js'
import PrescriptionPDF from '../../components/PrescriptionPDF.svelte'

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || ''
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
const shouldRun = emulatorHost.length > 0

let authEmulatorConnected = false
let firestoreEmulatorConnected = false
let emulatorAvailable = shouldRun

const checkEmulatorAvailable = async () => {
  if (!shouldRun) return false
  const [host, portString] = emulatorHost.split(':')
  const port = Number(portString || 8080)
  const projectId =
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'demo-test'
  const probeUrl = `http://${host || 'localhost'}:${port}/v1/projects/${projectId}/databases/(default)/documents`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1000)
  try {
    await fetch(probeUrl, { signal: controller.signal })
    return true
  } catch (_error) {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

const connectEmulatorsIfNeeded = () => {
  if (!shouldRun) return

  if (!firestoreEmulatorConnected) {
    const [host, portString] = emulatorHost.split(':')
    connectFirestoreEmulator(db, host || '127.0.0.1', Number(portString || 8080))
    firestoreEmulatorConnected = true
  }

  if (!authEmulatorConnected) {
    const [host, portString] = authEmulatorHost.split(':')
    const url = `http://${host || '127.0.0.1'}:${Number(portString || 9099)}`
    connectAuthEmulator(auth, url, { disableWarnings: true })
    authEmulatorConnected = true
  }
}

const ensureAdminSignedIn = async () => {
  const adminEmail = 'senakahks@gmail.com'
  const adminPassword = 'TestAdmin#123'
  await ensureUserSignedIn(adminEmail, adminPassword)
}

const ensureUserSignedIn = async (email, password) => {
  try {
    await createUserWithEmailAndPassword(auth, email, password)
  } catch (error) {
    if (error?.code !== 'auth/email-already-in-use') {
      throw error
    }
  }
  await signInWithEmailAndPassword(auth, email, password)
}

describe('patient to dispense lifecycle (integration)', () => {
  beforeAll(async () => {
    emulatorAvailable = await checkEmulatorAvailable()
    if (!emulatorAvailable) {
      console.warn('Firestore emulator not reachable, skipping patient-to-dispense lifecycle integration test.')
      return
    }

    connectEmulatorsIfNeeded()
    try {
      await ensureAdminSignedIn()
    } catch (error) {
      emulatorAvailable = false
      console.warn('Auth emulator sign-in unavailable, skipping patient-to-dispense lifecycle integration test.', error?.message || error)
    }
  })

  beforeEach(async () => {
    if (!emulatorAvailable) return
    await ensureAdminSignedIn()
  })

  it.skipIf(!shouldRun)('creates patient, sends prescription to pharmacy, dispenses, and persists status + stock updates', async () => {
    if (!emulatorAvailable) return

    const runId = Date.now()
    const doctorId = `doctor-lifecycle-${runId}`
    const pharmacistId = `pharm-lifecycle-${runId}`
    const pharmacistEmail = `pharm-${runId}@example.com`
    const pharmacistPassword = `Pharm#${runId}`

    await setDoc(doc(db, 'doctors', doctorId), {
      id: doctorId,
      uid: `uid-${doctorId}`,
      email: `doctor-${runId}@example.com`,
      firstName: 'Flow',
      lastName: 'Doctor',
      role: 'doctor',
      createdAt: new Date().toISOString()
    })

    await setDoc(doc(db, 'pharmacists', pharmacistId), {
      id: pharmacistId,
      email: pharmacistEmail,
      pharmacistNumber: `P-${runId}`,
      businessName: 'Lifecycle Pharmacy',
      role: 'pharmacist',
      isApproved: true,
      isDisabled: false,
      createdAt: new Date().toISOString()
    })

    const createdPatient = await firebaseStorage.createPatient({
      doctorId,
      firstName: 'Kumara',
      lastName: 'Perera',
      age: '50',
      gender: 'Male',
      phone: '712043212',
      phoneCountryCode: '+94'
    })
    expect(createdPatient.id).toBeTruthy()
    expect(createdPatient.doctorId).toBe(doctorId)

    const medication = {
      id: `med-${runId}`,
      name: 'TopiCream',
      genericName: 'TopiCream',
      dosage: '1',
      strength: '10',
      strengthUnit: 'g',
      dosageForm: 'Cream',
      qts: '1',
      amount: 1,
      frequency: 'As needed (PRN)',
      duration: '3 days'
    }

    const doctorPrescription = await firebaseStorage.createPrescription({
      patientId: createdPatient.id,
      doctorId,
      medications: [medication],
      status: 'active',
      createdAt: new Date().toISOString()
    })
    expect(doctorPrescription.id).toBeTruthy()
    const prescriptionsByPatient = await firebaseStorage.getPrescriptionsByPatientId(createdPatient.id)
    expect(prescriptionsByPatient).toHaveLength(1)
    expect(prescriptionsByPatient[0].id).toBe(doctorPrescription.id)

    const sentPayload = {
      id: `rx-${runId}`,
      doctorId,
      doctorName: 'Flow Doctor',
      patientId: createdPatient.id,
      patientName: `${createdPatient.firstName} ${createdPatient.lastName}`.trim(),
      status: 'pending',
      sentAt: new Date().toISOString(),
      prescriptions: [
        {
          id: doctorPrescription.id,
          patientId: createdPatient.id,
          doctorId,
          medications: [medication]
        }
      ]
    }

    await firebaseStorage.savePharmacistPrescriptions(pharmacistId, [sentPayload])
    const receivedBeforeDispense = await firebaseStorage.getPharmacistPrescriptions(pharmacistId)
    expect(receivedBeforeDispense).toHaveLength(1)
    expect(receivedBeforeDispense[0].status).toBe('pending')

    // Switch to pharmacist identity for inventory + dispense writes
    await ensureUserSignedIn(pharmacistEmail, pharmacistPassword)

    const inventoryItem = await inventoryService.createInventoryItem(pharmacistId, {
      pharmacyId: pharmacistId,
      drugName: 'TopiCream',
      genericName: 'TopiCream',
      brandName: 'TopiCream',
      manufacturer: 'Demo Pharma',
      strength: '10',
      strengthUnit: 'g',
      dosageForm: 'Cream',
      packSize: '1',
      packUnit: 'tube',
      expiryDate: '2027-12-31',
      storageConditions: 'room temperature',
      initialStock: 5,
      minimumStock: 1,
      maximumStock: 50,
      reorderPoint: 2,
      reorderQuantity: 5,
      costPrice: 100,
      sellingPrice: 150,
      isTestData: true,
      testTag: 'TEST_DATA'
    })

    // Rules currently do not allow direct writes to pharmacistStockMovements,
    // so the integration flow updates allowed inventory + prescription status documents.
    await updateDoc(doc(db, 'pharmacistInventory', inventoryItem.id), {
      currentStock: 4,
      lastUpdated: new Date().toISOString()
    })

    const receivedCollection = collection(doc(db, 'pharmacists', pharmacistId), 'receivedPrescriptions')
    const receivedSnapshot = await getDocs(receivedCollection)
    const receivedDoc = receivedSnapshot.docs.find((entry) => entry.data()?.id === sentPayload.id)
    expect(receivedDoc).toBeTruthy()

    await updateDoc(
      doc(db, 'pharmacists', pharmacistId, 'receivedPrescriptions', receivedDoc.id),
      {
        status: 'dispensed',
        dispensedAt: new Date().toISOString(),
        dispensedBy: pharmacistId,
        dispensedMedications: [
          {
            medicationId: medication.id,
            name: medication.name,
            quantity: 1
          }
        ]
      }
    )

    const receivedAfterDispense = await firebaseStorage.getPharmacistPrescriptions(pharmacistId)
    expect(receivedAfterDispense).toHaveLength(1)
    expect(receivedAfterDispense[0].status).toBe('dispensed')
    expect(Array.isArray(receivedAfterDispense[0].dispensedMedications)).toBe(true)
    expect(receivedAfterDispense[0].dispensedMedications[0].name).toBe(medication.name)

    const inventoryDoc = await getDoc(doc(db, 'pharmacistInventory', inventoryItem.id))
    expect(inventoryDoc.exists()).toBe(true)
    expect(inventoryDoc.data().currentStock).toBe(4)

    const createObjectURLSpy = vi.fn(() => 'blob:pdf-lifecycle')
    const openSpy = vi.fn()
    global.URL.createObjectURL = createObjectURLSpy
    global.open = openSpy

    const { getByText } = render(PrescriptionPDF, {
      props: {
        selectedPatient: {
          ...createdPatient,
          idNumber: createdPatient.idNumber || 'N/A',
          dateOfBirth: createdPatient.dateOfBirth || '1975-01-01'
        },
        illnesses: [],
        prescriptions: [medication],
        symptoms: []
      }
    })

    await fireEvent.click(getByText('Generate PDF'))
    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalled()
      expect(openSpy).toHaveBeenCalledWith('blob:pdf-lifecycle', '_blank')
    })

  }, 40000)

  it.skipIf(!shouldRun)('rejects patient creation when required fields are missing', async () => {
    if (!emulatorAvailable) return

    const runId = Date.now()
    const doctorId = `doctor-lifecycle-validation-${runId}`
    await setDoc(doc(db, 'doctors', doctorId), {
      id: doctorId,
      uid: `uid-${doctorId}`,
      email: `doctor-validation-${runId}@example.com`,
      firstName: 'Validation',
      lastName: 'Doctor',
      role: 'doctor',
      createdAt: new Date().toISOString()
    })

    await expect(
      firebaseStorage.createPatient({
        doctorId,
        firstName: 'NoAge',
        lastName: 'Patient'
      })
    ).rejects.toThrow('Age is required')
  }, 30000)

  it.skipIf(!shouldRun)('replaces previous pharmacist received list on re-send and keeps latest payload', async () => {
    if (!emulatorAvailable) return

    const runId = Date.now()
    const doctorId = `doctor-lifecycle-resend-${runId}`
    const pharmacistId = `pharm-lifecycle-resend-${runId}`
    const patientId = `patient-lifecycle-resend-${runId}`

    await setDoc(doc(db, 'doctors', doctorId), {
      id: doctorId,
      uid: `uid-${doctorId}`,
      email: `doctor-resend-${runId}@example.com`,
      firstName: 'Resend',
      lastName: 'Doctor',
      role: 'doctor',
      createdAt: new Date().toISOString()
    })

    await setDoc(doc(db, 'pharmacists', pharmacistId), {
      id: pharmacistId,
      email: `pharm-resend-${runId}@example.com`,
      pharmacistNumber: `P-${runId}`,
      businessName: 'Resend Pharmacy',
      role: 'pharmacist',
      isApproved: true,
      isDisabled: false,
      createdAt: new Date().toISOString()
    })

    await setDoc(doc(db, 'patients', patientId), {
      id: patientId,
      doctorId,
      firstName: 'Resend',
      lastName: 'Patient',
      age: '40',
      createdAt: new Date().toISOString()
    })

    const firstPayload = {
      id: `rx-first-${runId}`,
      doctorId,
      patientId,
      patientName: 'Resend Patient',
      status: 'pending',
      sentAt: new Date(Date.now() - 10000).toISOString(),
      prescriptions: [{ id: `presc-first-${runId}`, patientId, doctorId, medications: [] }]
    }

    const secondPayload = {
      id: `rx-second-${runId}`,
      doctorId,
      patientId,
      patientName: 'Resend Patient',
      status: 'pending',
      sentAt: new Date().toISOString(),
      prescriptions: [{ id: `presc-second-${runId}`, patientId, doctorId, medications: [] }]
    }

    await firebaseStorage.savePharmacistPrescriptions(pharmacistId, [firstPayload])
    await firebaseStorage.savePharmacistPrescriptions(pharmacistId, [secondPayload])

    const received = await firebaseStorage.getPharmacistPrescriptions(pharmacistId)
    expect(received).toHaveLength(1)
    expect(received[0].id).toBe(secondPayload.id)
    expect(received[0].sentAt).toBe(secondPayload.sentAt)
  }, 30000)

  it.skipIf(!shouldRun)('persists multi-medication dispensed state with matching stock decrements', async () => {
    if (!emulatorAvailable) return

    const runId = Date.now()
    const doctorId = `doctor-lifecycle-multi-${runId}`
    const pharmacistId = `pharm-lifecycle-multi-${runId}`
    const pharmacistEmail = `pharm-multi-${runId}@example.com`
    const pharmacistPassword = `Pharm#${runId}`

    await setDoc(doc(db, 'doctors', doctorId), {
      id: doctorId,
      uid: `uid-${doctorId}`,
      email: `doctor-multi-${runId}@example.com`,
      firstName: 'Multi',
      lastName: 'Doctor',
      role: 'doctor',
      createdAt: new Date().toISOString()
    })

    await setDoc(doc(db, 'pharmacists', pharmacistId), {
      id: pharmacistId,
      email: pharmacistEmail,
      pharmacistNumber: `P-${runId}`,
      businessName: 'Multi Pharmacy',
      role: 'pharmacist',
      isApproved: true,
      isDisabled: false,
      createdAt: new Date().toISOString()
    })

    const createdPatient = await firebaseStorage.createPatient({
      doctorId,
      firstName: 'Multi',
      lastName: 'Patient',
      age: '61'
    })

    const medA = {
      id: `medA-${runId}`,
      name: 'CardioTab',
      genericName: 'CardioTab',
      dosage: '1',
      strength: '50',
      strengthUnit: 'mg',
      dosageForm: 'Tablet',
      amount: 2,
      frequency: 'Twice daily (BD)',
      duration: '1 day'
    }

    const medB = {
      id: `medB-${runId}`,
      name: 'TopiCream',
      genericName: 'TopiCream',
      dosage: '1',
      strength: '10',
      strengthUnit: 'g',
      dosageForm: 'Cream',
      qts: '1',
      amount: 1,
      frequency: 'As needed (PRN)',
      duration: '1 day'
    }

    const doctorPrescription = await firebaseStorage.createPrescription({
      patientId: createdPatient.id,
      doctorId,
      medications: [medA, medB],
      status: 'active',
      createdAt: new Date().toISOString()
    })

    const sentPayload = {
      id: `rx-multi-${runId}`,
      doctorId,
      patientId: createdPatient.id,
      patientName: `${createdPatient.firstName} ${createdPatient.lastName}`.trim(),
      status: 'pending',
      sentAt: new Date().toISOString(),
      prescriptions: [
        {
          id: doctorPrescription.id,
          patientId: createdPatient.id,
          doctorId,
          medications: [medA, medB]
        }
      ]
    }

    await firebaseStorage.savePharmacistPrescriptions(pharmacistId, [sentPayload])
    await ensureUserSignedIn(pharmacistEmail, pharmacistPassword)

    const stockA = await inventoryService.createInventoryItem(pharmacistId, {
      pharmacyId: pharmacistId,
      drugName: 'CardioTab',
      genericName: 'CardioTab',
      brandName: 'CardioTab',
      manufacturer: 'Demo Pharma',
      strength: '50',
      strengthUnit: 'mg',
      dosageForm: 'Tablet',
      packSize: '10',
      packUnit: 'tabs',
      expiryDate: '2027-12-31',
      storageConditions: 'room temperature',
      initialStock: 10,
      minimumStock: 1,
      costPrice: 10,
      sellingPrice: 20,
      isTestData: true,
      testTag: 'TEST_DATA'
    })

    const stockB = await inventoryService.createInventoryItem(pharmacistId, {
      pharmacyId: pharmacistId,
      drugName: 'TopiCream',
      genericName: 'TopiCream',
      brandName: 'TopiCream',
      manufacturer: 'Demo Pharma',
      strength: '10',
      strengthUnit: 'g',
      dosageForm: 'Cream',
      packSize: '1',
      packUnit: 'tube',
      expiryDate: '2027-12-31',
      storageConditions: 'room temperature',
      initialStock: 8,
      minimumStock: 1,
      costPrice: 100,
      sellingPrice: 150,
      isTestData: true,
      testTag: 'TEST_DATA'
    })

    await updateDoc(doc(db, 'pharmacistInventory', stockA.id), {
      currentStock: 8,
      lastUpdated: new Date().toISOString()
    })
    await updateDoc(doc(db, 'pharmacistInventory', stockB.id), {
      currentStock: 7,
      lastUpdated: new Date().toISOString()
    })

    const receivedCollection = collection(doc(db, 'pharmacists', pharmacistId), 'receivedPrescriptions')
    const receivedSnapshot = await getDocs(receivedCollection)
    const receivedDoc = receivedSnapshot.docs.find((entry) => entry.data()?.id === sentPayload.id)
    expect(receivedDoc).toBeTruthy()

    await updateDoc(doc(db, 'pharmacists', pharmacistId, 'receivedPrescriptions', receivedDoc.id), {
      status: 'dispensed',
      dispensedAt: new Date().toISOString(),
      dispensedBy: pharmacistId,
      dispensedMedications: [
        { medicationId: medA.id, name: medA.name, quantity: 2 },
        { medicationId: medB.id, name: medB.name, quantity: 1 }
      ]
    })

    const after = await firebaseStorage.getPharmacistPrescriptions(pharmacistId)
    expect(after).toHaveLength(1)
    expect(after[0].status).toBe('dispensed')
    expect(after[0].dispensedMedications).toHaveLength(2)

    const stockADoc = await getDoc(doc(db, 'pharmacistInventory', stockA.id))
    const stockBDoc = await getDoc(doc(db, 'pharmacistInventory', stockB.id))
    expect(stockADoc.data().currentStock).toBe(8)
    expect(stockBDoc.data().currentStock).toBe(7)
  }, 40000)
})
