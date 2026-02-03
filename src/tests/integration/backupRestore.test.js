import { describe, it, expect, beforeAll } from 'vitest'
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { db } from '../../firebase-config.js'
import backupService from '../../services/backupService.js'

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || ''
const shouldRun = emulatorHost.length > 0

let emulatorConnected = false

const connectEmulatorIfNeeded = () => {
  if (!shouldRun || emulatorConnected) return
  const [host, portString] = emulatorHost.split(':')
  const port = Number(portString || 8080)
  connectFirestoreEmulator(db, host || 'localhost', port)
  emulatorConnected = true
}

describe('backupService (integration)', () => {
  beforeAll(() => {
    connectEmulatorIfNeeded()
  })

  it.skipIf(!shouldRun)('exports and restores pharmacist backup using Firestore emulator', async () => {
    const runId = Date.now()
    const pharmacistA = `test-pharm-a-${runId}`
    const pharmacistB = `test-pharm-b-${runId}`
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

    await backupService.restorePharmacistBackup(pharmacistB, backup)

    const inventoryQuery = query(
      collection(db, 'pharmacistInventory'),
      where('pharmacistId', '==', pharmacistB)
    )
    const inventorySnap = await getDocs(inventoryQuery)
    expect(inventorySnap.size).toBe(2)

    const restoredUserSnap = await getDoc(doc(db, 'pharmacyUsers', pharmacyUserId))
    expect(restoredUserSnap.exists()).toBe(true)
    expect(restoredUserSnap.data().pharmacyId).toBe(pharmacistB)

    const rxSnap = await getDocs(collection(doc(db, 'pharmacists', pharmacistB), 'receivedPrescriptions'))
    expect(rxSnap.size).toBe(1)
  })
})
