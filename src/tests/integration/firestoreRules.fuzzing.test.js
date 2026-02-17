import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc } from 'firebase/firestore'

const shouldRun = !!process.env.FIRESTORE_EMULATOR_HOST
const projectId = 'prescribe-rules-fuzzing'
const rules = readFileSync('firestore.rules', 'utf8')

describe('Firestore Rules fuzzing: mass-assignment and IDOR-style field injection', () => {
  let testEnv

  beforeAll(async () => {
    if (!shouldRun) return
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: { rules }
    })
  }, 30000)

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup()
  })

  beforeEach(async () => {
    if (!testEnv) return
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'doctors', 'doc-a'), { uid: 'uid-a', email: 'doctor-a@example.com' })
      await setDoc(doc(db, 'pharmacists', 'ph-a'), {
        email: 'pharmacist-a@example.com',
        role: 'pharmacist',
        isApproved: true,
        isDisabled: false
      })
      await setDoc(doc(db, 'patients', 'patient-safe-a'), {
        doctorId: 'doc-a',
        firstName: 'Safe'
      })
      await setDoc(doc(db, 'pharmacistInventory', 'inv-safe-a'), {
        pharmacistId: 'ph-a',
        pharmacyId: 'ph-a',
        brandName: 'Drug A',
        currentStock: 10
      })
    })
  }, 30000)

  it.skipIf(!shouldRun)('blocks injected privilege and cross-tenant fields on doctor-owned creates', async () => {
    const dbDoctorA = testEnv.authenticatedContext('uid-a', { email: 'doctor-a@example.com' }).firestore()
    const targetCollections = ['patients', 'medications', 'illnesses', 'symptoms', 'longTermMedications', 'drugDatabase', 'reports']
    const forbiddenPayloads = [
      { isAdmin: true },
      { role: 'admin' },
      { pharmacistId: 'ph-a' }
    ]

    for (const collection of targetCollections) {
      await assertSucceeds(setDoc(doc(dbDoctorA, collection, `${collection}-baseline`), {
        doctorId: 'doc-a',
        note: 'ok'
      }))

      for (let i = 0; i < forbiddenPayloads.length; i += 1) {
        await assertFails(setDoc(doc(dbDoctorA, collection, `${collection}-forbidden-${i}`), {
          doctorId: 'doc-a',
          note: 'forbidden',
          ...forbiddenPayloads[i]
        }))
      }
    }
  })

  it.skipIf(!shouldRun)('blocks injected privilege and cross-tenant fields on doctor-owned updates', async () => {
    const dbDoctorA = testEnv.authenticatedContext('uid-a', { email: 'doctor-a@example.com' }).firestore()

    await assertFails(updateDoc(doc(dbDoctorA, 'patients', 'patient-safe-a'), { isAdmin: true }))
    await assertFails(updateDoc(doc(dbDoctorA, 'patients', 'patient-safe-a'), { role: 'admin' }))
    await assertFails(updateDoc(doc(dbDoctorA, 'patients', 'patient-safe-a'), { pharmacistId: 'ph-a' }))
    await assertSucceeds(updateDoc(doc(dbDoctorA, 'patients', 'patient-safe-a'), { firstName: 'StillSafe' }))
  })

  it.skipIf(!shouldRun)('blocks injected doctorId/isAdmin/role on pharmacist inventory and stock writes', async () => {
    const dbPharmacistA = testEnv.authenticatedContext('uid-ph-a', { email: 'pharmacist-a@example.com' }).firestore()

    await assertSucceeds(setDoc(doc(dbPharmacistA, 'drugStock', 'stock-safe-a'), {
      pharmacistId: 'ph-a',
      pharmacyId: 'ph-a',
      brandName: 'Safe Stock',
      currentStock: 12
    }))

    const forbiddenPayloads = [
      { doctorId: 'doc-a' },
      { isAdmin: true },
      { role: 'admin' }
    ]

    for (let i = 0; i < forbiddenPayloads.length; i += 1) {
      await assertFails(setDoc(doc(dbPharmacistA, 'pharmacistInventory', `inv-forbidden-${i}`), {
        pharmacistId: 'ph-a',
        pharmacyId: 'ph-a',
        brandName: `Bad-${i}`,
        currentStock: 1,
        ...forbiddenPayloads[i]
      }))
      await assertFails(setDoc(doc(dbPharmacistA, 'drugStock', `stock-forbidden-${i}`), {
        pharmacistId: 'ph-a',
        pharmacyId: 'ph-a',
        brandName: `BadStock-${i}`,
        currentStock: 1,
        ...forbiddenPayloads[i]
      }))
    }

    await assertFails(updateDoc(doc(dbPharmacistA, 'pharmacistInventory', 'inv-safe-a'), { doctorId: 'doc-a' }))
    await assertFails(updateDoc(doc(dbPharmacistA, 'pharmacistInventory', 'inv-safe-a'), { role: 'admin' }))
    await assertSucceeds(updateDoc(doc(dbPharmacistA, 'pharmacistInventory', 'inv-safe-a'), { currentStock: 9 }))
  })
})
