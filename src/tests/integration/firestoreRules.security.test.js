import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

const shouldRun = !!process.env.FIRESTORE_EMULATOR_HOST
const projectId = 'prescribe-rules-security'
const rules = readFileSync('firestore.rules', 'utf8')

describe('Firestore Rules security', () => {
  let testEnv

  beforeAll(async () => {
    if (!shouldRun) {
      console.warn('Firestore emulator not configured, skipping security rules tests.')
      return
    }
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: { rules }
    })
  }, 30000)

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup()
    }
  })

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore()
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore()
        await setDoc(doc(db, 'doctors', 'doc-a'), {
          uid: 'uid-a',
          email: 'doctor-a@example.com'
        })
        await setDoc(doc(db, 'doctors', 'doc-b'), {
          uid: 'uid-b',
          email: 'doctor-b@example.com'
        })
        await setDoc(doc(db, 'patients', 'patient-a-1'), {
          doctorId: 'doc-a',
          firstName: 'Alice'
        })
        await setDoc(doc(db, 'patients', 'patient-b-1'), {
          doctorId: 'doc-b',
          firstName: 'Bob'
        })
        await setDoc(doc(db, 'pharmacists', 'ph-a'), {
          email: 'pharmacist-a@example.com',
          businessName: 'Pharmacy A',
          role: 'pharmacist',
          isApproved: true,
          isDisabled: false,
          accessExpiresAt: null
        })
        await setDoc(doc(db, 'pharmacists', 'ph-b'), {
          email: 'pharmacist-b@example.com',
          businessName: 'Pharmacy B',
          role: 'pharmacist',
          isApproved: true,
          isDisabled: false,
          accessExpiresAt: null
        })
        await setDoc(doc(db, 'pharmacists', 'ph-a', 'receivedPrescriptions', 'rx-a1'), {
          id: 'rx-a1',
          status: 'pending'
        })
        await setDoc(doc(db, 'pharmacyUsers', 'team-a'), {
          email: 'team-a@example.com',
          pharmacyId: 'ph-a',
          role: 'pharmacist'
        })
        await setDoc(doc(db, 'pharmacyUsers', 'team-b'), {
          email: 'team-b@example.com',
          pharmacyId: 'ph-b',
          role: 'pharmacist'
        })
        await setDoc(doc(db, 'pharmacistInventory', 'inv-a-1'), {
          pharmacistId: 'ph-a',
          pharmacyId: 'ph-a',
          brandName: 'Drug A',
          currentStock: 100
        })
        await setDoc(doc(db, 'drugStock', 'stock-a-1'), {
          pharmacistId: 'ph-a',
          pharmacyId: 'ph-a',
          brandName: 'Drug A',
          currentStock: 100
        })
        await setDoc(doc(db, 'reports', 'report-a-1'), {
          id: 'report-a-1',
          doctorId: 'doc-a',
          patientId: 'patient-a-1',
          title: 'CBC'
        })
      })
    }
  }, 30000)

  it.skipIf(!shouldRun)('blocks unauthenticated reads to clinical data', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'patients', 'patient-a-1')))
  })

  it.skipIf(!shouldRun)('allows doctor to read own patient but not another doctor patient', async () => {
    const dbDoctorA = testEnv.authenticatedContext('uid-a', { email: 'doctor-a@example.com' }).firestore()
    await assertSucceeds(getDoc(doc(dbDoctorA, 'patients', 'patient-a-1')))
    await assertFails(getDoc(doc(dbDoctorA, 'patients', 'patient-b-1')))
  })

  it.skipIf(!shouldRun)('allows create only when doctorId belongs to authenticated doctor', async () => {
    const dbDoctorA = testEnv.authenticatedContext('uid-a', { email: 'doctor-a@example.com' }).firestore()

    await assertSucceeds(setDoc(doc(dbDoctorA, 'patients', 'patient-a-2'), {
      doctorId: 'doc-a',
      firstName: 'A2'
    }))

    await assertFails(setDoc(doc(dbDoctorA, 'patients', 'patient-b-2'), {
      doctorId: 'doc-b',
      firstName: 'B2'
    }))
  })

  it.skipIf(!shouldRun)('rejects patient create when doctorId is missing or invalid type', async () => {
    const dbDoctorA = testEnv.authenticatedContext('uid-a', { email: 'doctor-a@example.com' }).firestore()

    await assertFails(setDoc(doc(dbDoctorA, 'patients', 'patient-invalid-1'), {
      firstName: 'No Doctor Id'
    }))

    await assertFails(setDoc(doc(dbDoctorA, 'patients', 'patient-invalid-2'), {
      doctorId: 12345,
      firstName: 'Wrong Type'
    }))
  })

  it.skipIf(!shouldRun)('blocks doctor from reassigning an existing patient to a different doctor', async () => {
    const dbDoctorA = testEnv.authenticatedContext('uid-a', { email: 'doctor-a@example.com' }).firestore()

    await assertFails(setDoc(doc(dbDoctorA, 'patients', 'patient-a-1'), {
      doctorId: 'doc-b',
      firstName: 'Hijack'
    }))
  })

  it.skipIf(!shouldRun)('blocks doctor from creating another doctor profile with mismatched uid', async () => {
    const dbDoctorA = testEnv.authenticatedContext('uid-a', { email: 'doctor-a@example.com' }).firestore()

    await assertFails(setDoc(doc(dbDoctorA, 'doctors', 'doc-x'), {
      uid: 'uid-other',
      email: 'doctor-x@example.com'
    }))
  })

  it.skipIf(!shouldRun)('blocks non-admin doctor from changing sensitive doctor fields', async () => {
    const dbDoctorA = testEnv.authenticatedContext('uid-a', { email: 'doctor-a@example.com' }).firestore()

    await assertFails(updateDoc(doc(dbDoctorA, 'doctors', 'doc-a'), { isAdmin: true }))
    await assertFails(updateDoc(doc(dbDoctorA, 'doctors', 'doc-a'), { uid: 'uid-hijack' }))
  })

  it.skipIf(!shouldRun)('allows admin to create doctor profile without uid', async () => {
    const dbAdmin = testEnv.authenticatedContext('uid-admin', { email: 'senakahks@gmail.com' }).firestore()

    await assertSucceeds(setDoc(doc(dbAdmin, 'doctors', 'doc-admin-created'), {
      email: 'created-by-admin@example.com',
      firstName: 'Admin',
      lastName: 'Created'
    }))
  })

  it.skipIf(!shouldRun)('allows admin email to read and write across doctor tenants', async () => {
    const dbAdmin = testEnv.authenticatedContext('uid-admin', { email: 'senakahks@gmail.com' }).firestore()

    await assertSucceeds(getDoc(doc(dbAdmin, 'patients', 'patient-a-1')))
    await assertSucceeds(getDoc(doc(dbAdmin, 'patients', 'patient-b-1')))
    await assertSucceeds(setDoc(doc(dbAdmin, 'patients', 'patient-admin-created'), {
      doctorId: 'doc-a',
      firstName: 'AdminWrite'
    }))
  })

  it.skipIf(!shouldRun)('allows doctor to read/update own doctor profile and blocks others', async () => {
    const dbDoctorA = testEnv.authenticatedContext('uid-a', { email: 'doctor-a@example.com' }).firestore()

    await assertSucceeds(getDoc(doc(dbDoctorA, 'doctors', 'doc-a')))
    await assertFails(getDoc(doc(dbDoctorA, 'doctors', 'doc-b')))

    await assertSucceeds(setDoc(doc(dbDoctorA, 'doctors', 'doc-a'), {
      uid: 'uid-a',
      email: 'doctor-a@example.com',
      city: 'Colombo'
    }))

    await assertFails(setDoc(doc(dbDoctorA, 'doctors', 'doc-b'), {
      uid: 'uid-b',
      email: 'doctor-b@example.com',
      city: 'Kandy'
    }))
  })

  it.skipIf(!shouldRun)('allows pharmacist to access own tenant and blocks other pharmacist tenant', async () => {
    const dbPharmacistA = testEnv.authenticatedContext('uid-ph-a', { email: 'pharmacist-a@example.com' }).firestore()

    await assertSucceeds(getDoc(doc(dbPharmacistA, 'pharmacists', 'ph-a')))
    await assertFails(getDoc(doc(dbPharmacistA, 'pharmacists', 'ph-b')))

    await assertSucceeds(setDoc(doc(dbPharmacistA, 'pharmacists', 'ph-a', 'receivedPrescriptions', 'rx-a2'), {
      id: 'rx-a2',
      status: 'pending'
    }))
    await assertFails(setDoc(doc(dbPharmacistA, 'pharmacists', 'ph-b', 'receivedPrescriptions', 'rx-b2'), {
      id: 'rx-b2',
      status: 'pending'
    }))
  })

  it.skipIf(!shouldRun)('blocks non-admin pharmacist from changing sensitive pharmacist fields', async () => {
    const dbPharmacistA = testEnv.authenticatedContext('uid-ph-a', { email: 'pharmacist-a@example.com' }).firestore()

    await assertFails(updateDoc(doc(dbPharmacistA, 'pharmacists', 'ph-a'), { role: 'admin' }))
    await assertFails(updateDoc(doc(dbPharmacistA, 'pharmacists', 'ph-a'), { email: 'changed@example.com' }))
  })

  it.skipIf(!shouldRun)('allows pharmacist inventory writes only in own tenant', async () => {
    const dbPharmacistA = testEnv.authenticatedContext('uid-ph-a', { email: 'pharmacist-a@example.com' }).firestore()

    await assertSucceeds(setDoc(doc(dbPharmacistA, 'pharmacistInventory', 'inv-a-2'), {
      pharmacistId: 'ph-a',
      pharmacyId: 'ph-a',
      brandName: 'Drug AX',
      currentStock: 25
    }))

    await assertFails(setDoc(doc(dbPharmacistA, 'pharmacistInventory', 'inv-b-2'), {
      pharmacistId: 'ph-b',
      pharmacyId: 'ph-b',
      brandName: 'Drug BX',
      currentStock: 25
    }))
  })

  it.skipIf(!shouldRun)('rejects pharmacist inventory create when pharmacistId is missing', async () => {
    const dbPharmacistA = testEnv.authenticatedContext('uid-ph-a', { email: 'pharmacist-a@example.com' }).firestore()

    await assertFails(setDoc(doc(dbPharmacistA, 'pharmacistInventory', 'inv-invalid-1'), {
      pharmacyId: 'ph-a',
      brandName: 'Drug Missing Owner',
      currentStock: 5
    }))
  })

  it.skipIf(!shouldRun)('blocks pharmacist from reassigning existing inventory item tenant', async () => {
    const dbPharmacistA = testEnv.authenticatedContext('uid-ph-a', { email: 'pharmacist-a@example.com' }).firestore()

    await assertFails(setDoc(doc(dbPharmacistA, 'pharmacistInventory', 'inv-a-1'), {
      pharmacistId: 'ph-b',
      pharmacyId: 'ph-b',
      brandName: 'Drug A',
      currentStock: 100
    }))
  })

  it.skipIf(!shouldRun)('allows pharmacist to read own stock docs and blocks cross-tenant stock reads', async () => {
    const dbPharmacistA = testEnv.authenticatedContext('uid-ph-a', { email: 'pharmacist-a@example.com' }).firestore()
    const dbPharmacistB = testEnv.authenticatedContext('uid-ph-b', { email: 'pharmacist-b@example.com' }).firestore()

    await assertSucceeds(getDoc(doc(dbPharmacistA, 'drugStock', 'stock-a-1')))
    await assertFails(getDoc(doc(dbPharmacistB, 'drugStock', 'stock-a-1')))
  })

  it.skipIf(!shouldRun)('blocks unauthenticated inventory writes and reads', async () => {
    const dbAnon = testEnv.unauthenticatedContext().firestore()

    await assertFails(setDoc(doc(dbAnon, 'pharmacistInventory', 'inv-anon-1'), {
      pharmacistId: 'ph-a',
      pharmacyId: 'ph-a',
      brandName: 'Anon Drug',
      currentStock: 1
    }))
    await assertFails(getDoc(doc(dbAnon, 'pharmacistInventory', 'inv-a-1')))
  })

  it.skipIf(!shouldRun)('blocks cross-tenant delete attempts and allows own-tenant deletes', async () => {
    const dbDoctorA = testEnv.authenticatedContext('uid-a', { email: 'doctor-a@example.com' }).firestore()
    const dbDoctorB = testEnv.authenticatedContext('uid-b', { email: 'doctor-b@example.com' }).firestore()
    const dbPharmacistA = testEnv.authenticatedContext('uid-ph-a', { email: 'pharmacist-a@example.com' }).firestore()
    const dbPharmacistB = testEnv.authenticatedContext('uid-ph-b', { email: 'pharmacist-b@example.com' }).firestore()

    await assertSucceeds(deleteDoc(doc(dbDoctorA, 'reports', 'report-a-1')))
    await assertFails(deleteDoc(doc(dbDoctorB, 'patients', 'patient-a-1')))

    await assertSucceeds(deleteDoc(doc(dbPharmacistA, 'drugStock', 'stock-a-1')))
    await assertFails(deleteDoc(doc(dbPharmacistB, 'pharmacistInventory', 'inv-a-1')))
  })

  it.skipIf(!shouldRun)('allows pharmacy user to access own profile by email and blocks others', async () => {
    const dbTeamA = testEnv.authenticatedContext('uid-team-a', { email: 'team-a@example.com' }).firestore()
    const dbTeamX = testEnv.authenticatedContext('uid-team-x', { email: 'team-x@example.com' }).firestore()

    await assertSucceeds(getDoc(doc(dbTeamA, 'pharmacyUsers', 'team-a')))
    await assertFails(getDoc(doc(dbTeamX, 'pharmacyUsers', 'team-a')))

    await assertSucceeds(setDoc(doc(dbTeamA, 'pharmacyUsers', 'team-a'), {
      email: 'team-a@example.com',
      pharmacyId: 'ph-a',
      role: 'pharmacist',
      firstName: 'Team'
    }))
    await assertFails(setDoc(doc(dbTeamA, 'pharmacyUsers', 'team-a'), {
      email: 'changed@example.com',
      pharmacyId: 'ph-a',
      role: 'pharmacist'
    }))
  })

  it.skipIf(!shouldRun)('blocks pharmacy user create/update attempts for another user email', async () => {
    const dbTeamA = testEnv.authenticatedContext('uid-team-a', { email: 'team-a@example.com' }).firestore()

    await assertFails(setDoc(doc(dbTeamA, 'pharmacyUsers', 'team-c'), {
      email: 'team-c@example.com',
      pharmacyId: 'ph-a',
      role: 'pharmacist'
    }))

    await assertFails(setDoc(doc(dbTeamA, 'pharmacyUsers', 'team-b'), {
      email: 'team-b@example.com',
      pharmacyId: 'ph-b',
      role: 'pharmacist'
    }))
  })

  it.skipIf(!shouldRun)('enforces mobile capture session lifecycle boundaries for doctor and unauthenticated mobile client', async () => {
    const dbDoctorA = testEnv.authenticatedContext('uid-a', { email: 'doctor-a@example.com' }).firestore()
    const dbAnon = testEnv.unauthenticatedContext().firestore()

    await assertSucceeds(setDoc(doc(dbDoctorA, 'mobileCaptureSessions', 'SESSIONA1'), {
      code: 'SESSIONA1',
      doctorId: 'doc-a',
      status: 'qr_ready',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    }))

    await assertSucceeds(updateDoc(doc(dbAnon, 'mobileCaptureSessions', 'SESSIONA1'), {
      status: 'opened',
      openedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))

    await assertSucceeds(updateDoc(doc(dbAnon, 'mobileCaptureSessions', 'SESSIONA1'), {
      status: 'photo_ready',
      photoUploadedAt: new Date().toISOString(),
      imageDataUrl: 'data:image/jpeg;base64,TEST_PAYLOAD',
      updatedAt: new Date().toISOString()
    }))

    await assertFails(updateDoc(doc(dbAnon, 'mobileCaptureSessions', 'SESSIONA1'), {
      status: 'consumed',
      updatedAt: new Date().toISOString()
    }))

    await assertSucceeds(updateDoc(doc(dbDoctorA, 'mobileCaptureSessions', 'SESSIONA1'), {
      status: 'consumed',
      updatedAt: new Date().toISOString()
    }))
  })

  it.skipIf(!shouldRun)('blocks unauthenticated mobile capture updates that tamper immutable ownership fields', async () => {
    const dbDoctorA = testEnv.authenticatedContext('uid-a', { email: 'doctor-a@example.com' }).firestore()
    const dbAnon = testEnv.unauthenticatedContext().firestore()
    const createdAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    await assertSucceeds(setDoc(doc(dbDoctorA, 'mobileCaptureSessions', 'SESSIONB1'), {
      code: 'SESSIONB1',
      doctorId: 'doc-a',
      status: 'qr_ready',
      createdAt,
      expiresAt,
      updatedAt: createdAt
    }))

    await assertFails(setDoc(doc(dbAnon, 'mobileCaptureSessions', 'SESSIONB1'), {
      code: 'SESSIONB1',
      doctorId: 'doc-b',
      status: 'opened',
      createdAt,
      expiresAt,
      updatedAt: new Date().toISOString()
    }))

    await assertFails(updateDoc(doc(dbAnon, 'mobileCaptureSessions', 'SESSIONB1'), {
      code: 'SESSIONB1',
      doctorId: 'doc-a',
      status: 'opened',
      createdAt: new Date().toISOString(),
      expiresAt,
      updatedAt: new Date().toISOString()
    }))
  })

  it.skipIf(!shouldRun)('blocks non-admin users from writing to authLogs audit collection', async () => {
    const dbDoctorA = testEnv.authenticatedContext('uid-a', { email: 'doctor-a@example.com' }).firestore()
    const dbPharmacistA = testEnv.authenticatedContext('uid-ph-a', { email: 'pharmacist-a@example.com' }).firestore()

    await assertFails(setDoc(doc(dbDoctorA, 'authLogs', 'log-doc-1'), {
      action: 'login',
      role: 'doctor'
    }))
    await assertFails(setDoc(doc(dbPharmacistA, 'authLogs', 'log-ph-1'), {
      action: 'login',
      role: 'pharmacist'
    }))
  })

  it.skipIf(!shouldRun)('blocks non-admin reads/deletes of authLogs audit records', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'authLogs', 'log-seeded-1'), {
        action: 'login',
        role: 'doctor',
        createdAt: new Date().toISOString()
      })
    })

    const dbDoctorA = testEnv.authenticatedContext('uid-a', { email: 'doctor-a@example.com' }).firestore()
    await assertFails(getDoc(doc(dbDoctorA, 'authLogs', 'log-seeded-1')))
    await assertFails(deleteDoc(doc(dbDoctorA, 'authLogs', 'log-seeded-1')))
  })
})
