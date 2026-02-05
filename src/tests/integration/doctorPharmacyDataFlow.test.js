import { describe, it, expect, beforeAll } from 'vitest'
import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '../../firebase-config.js'
import firebaseStorage from '../../services/firebaseStorage.js'

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || ''
const shouldRun = emulatorHost.length > 0

describe('doctor → pharmacy data flow (integration)', () => {
  beforeAll(async () => {
    if (!shouldRun) {
      console.warn('Firestore emulator not configured, skipping integration test.')
    }
  })

  it.skipIf(!shouldRun)('persists valid prescription payload for pharmacy portal', async () => {
    const runId = Date.now()
    const pharmacistId = `pharm-${runId}`
    const doctorId = `doctor-${runId}`
    const patientId = `patient-${runId}`

    await setDoc(doc(db, 'pharmacists', pharmacistId), {
      id: pharmacistId,
      email: `pharm-${runId}@example.com`,
      pharmacistNumber: '123456',
      businessName: 'Test Pharmacy',
      createdAt: new Date().toISOString()
    })

    await setDoc(doc(db, 'doctors', doctorId), {
      id: doctorId,
      email: `doctor-${runId}@example.com`,
      firstName: 'Test',
      lastName: 'Doctor',
      createdAt: new Date().toISOString()
    })

    await setDoc(doc(db, 'patients', patientId), {
      id: patientId,
      doctorId,
      firstName: 'Test',
      lastName: 'Patient',
      createdAt: new Date().toISOString()
    })

    const medication = {
      id: `med-${runId}`,
      name: 'Test Drug A',
      genericName: 'Test Generic A',
      dosage: '500',
      strength: '500',
      strengthUnit: 'mg',
      dosageForm: 'tablet',
      frequency: 'Twice daily (BD)',
      duration: '7 days',
      timing: 'After meals (PC)',
      amount: 14,
      medicationKey: 'test-drug-a|test-generic-a|500|mg|tablet'
    }

    const createdAt = new Date().toISOString()
    const sentAt = new Date().toISOString()
    const prescriptionPayload = {
      id: `rx-${runId}`,
      doctorId,
      doctorName: 'Test Doctor',
      patientId,
      patientName: 'Test Patient',
      discount: 0,
      discountScope: 'consultation',
      prescriptions: [
        {
          id: `presc-${runId}`,
          patientId,
          doctorId,
          medications: [medication],
          createdAt: new Date().toISOString()
        }
      ],
      createdAt,
      sentAt,
      status: 'pending'
    }

    await firebaseStorage.savePharmacistPrescriptions(pharmacistId, [prescriptionPayload])

    const received = await firebaseStorage.getPharmacistPrescriptions(pharmacistId)
    expect(received.length).toBe(1)

    const saved = received[0]
    expect(saved.doctorId).toBe(doctorId)
    expect(saved.patientId).toBe(patientId)
    expect(saved.status).toBe('pending')
    expect(saved.createdAt).toBe(createdAt)
    expect(saved.sentAt).toBe(sentAt)
    expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false)
    expect(Number.isNaN(Date.parse(saved.sentAt))).toBe(false)
    expect(Array.isArray(saved.prescriptions)).toBe(true)
    expect(saved.prescriptions.length).toBe(1)

    const savedMedication = saved.prescriptions[0].medications[0]
    expect(savedMedication.name).toBe(medication.name)
    expect(savedMedication.strength).toBe(medication.strength)
    expect(savedMedication.strengthUnit).toBe(medication.strengthUnit)
    expect(savedMedication.dosageForm).toBe(medication.dosageForm)
    expect(savedMedication.frequency).toBe(medication.frequency)
    expect(savedMedication.duration).toBe(medication.duration)
    expect(savedMedication.amount).toBe(medication.amount)

    const subcollection = collection(doc(db, 'pharmacists', pharmacistId), 'receivedPrescriptions')
    const subSnapshot = await getDocs(subcollection)
    expect(subSnapshot.size).toBe(1)
  })
})
