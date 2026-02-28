#!/usr/bin/env node
/* eslint-disable no-console */
const admin = require('firebase-admin')

const args = process.argv.slice(2)

const getArg = (name) => {
  const found = args.find((arg) => arg.startsWith(`${name}=`))
  if (!found) return ''
  return found.slice(name.length + 1).trim()
}

const hasFlag = (name) => args.includes(name)
const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const normalizeId = (value) => String(value || '').trim()
const projectId = getArg('--project') || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'prescribe-7e1e8'
const email = normalizeEmail(getArg('--email'))
const apply = hasFlag('--apply')
const keepIdOverride = normalizeId(getArg('--keep-id'))

if (!admin.apps.length) {
  admin.initializeApp({ projectId })
}

const db = admin.firestore()

if (!email) {
  console.error('Usage: node functions/scripts/dedupePharmacistByEmail.cjs --email=<email> [--keep-id=<pharmacistId>] [--apply]')
  process.exit(1)
}

const toTimestamp = (value) => {
  const parsed = new Date(value || 0).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

const sortByCreatedAtAsc = (items) => {
  return [...items].sort((a, b) => {
    const delta = toTimestamp(a.createdAt) - toTimestamp(b.createdAt)
    if (delta !== 0) return delta
    return String(a.id || '').localeCompare(String(b.id || ''))
  })
}

async function getInventoryCount(pharmacistId) {
  const [byPharmacistId, byPharmacyId] = await Promise.all([
    db.collection('pharmacistInventory').where('pharmacistId', '==', pharmacistId).get(),
    db.collection('pharmacistInventory').where('pharmacyId', '==', pharmacistId).get()
  ])
  const uniqueIds = new Set()
  byPharmacistId.docs.forEach((docSnap) => uniqueIds.add(docSnap.id))
  byPharmacyId.docs.forEach((docSnap) => uniqueIds.add(docSnap.id))
  return uniqueIds.size
}

async function getReceivedPrescriptionsCount(pharmacistId) {
  const snap = await db.collection('pharmacists').doc(pharmacistId).collection('receivedPrescriptions').get()
  return snap.size
}

function scoreMatch(match) {
  const connectedDoctorsCount = Array.isArray(match.connectedDoctors) ? match.connectedDoctors.filter(Boolean).length : 0
  const inventoryCount = Number(match._inventoryCount || 0)
  const receivedCount = Number(match._receivedCount || 0)
  const hasBusinessName = String(match.businessName || '').trim().length > 0 ? 1 : 0
  const hasPharmacistNumber = String(match.pharmacistNumber || '').trim().length > 0 ? 1 : 0

  // Prioritize records with active data and relationships.
  return (
    (inventoryCount * 1000) +
    (receivedCount * 300) +
    (connectedDoctorsCount * 100) +
    (hasBusinessName * 5) +
    (hasPharmacistNumber * 2)
  )
}

function chooseCanonicalPharmacist(matches) {
  const ranked = [...matches].sort((a, b) => {
    const scoreDelta = scoreMatch(b) - scoreMatch(a)
    if (scoreDelta !== 0) return scoreDelta
    const createdDelta = toTimestamp(a.createdAt) - toTimestamp(b.createdAt)
    if (createdDelta !== 0) return createdDelta
    return String(a.id || '').localeCompare(String(b.id || ''))
  })
  return ranked[0]
}

async function getPharmacistMatchesByEmail(normalizedEmail) {
  const byNormalized = await db.collection('pharmacists')
    .where('emailNormalized', '==', normalizedEmail)
    .get()

  const byExact = await db.collection('pharmacists')
    .where('email', '==', normalizedEmail)
    .get()

  const merged = new Map()
  byNormalized.docs.forEach((docSnap) => {
    merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() })
  })
  byExact.docs.forEach((docSnap) => {
    merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() })
  })

  if (merged.size === 0) {
    const all = await db.collection('pharmacists').get()
    all.docs.forEach((docSnap) => {
      const data = docSnap.data() || {}
      if (normalizeEmail(data.email) === normalizedEmail) {
        merged.set(docSnap.id, { id: docSnap.id, ...data })
      }
    })
  }

  return sortByCreatedAtAsc(Array.from(merged.values()))
}

async function updateDoctorsConnectedPharmacists(keepId, duplicateIds) {
  const duplicateSet = new Set(duplicateIds)
  const doctorsSnap = await db.collection('doctors').get()
  let updated = 0

  for (const doctorDoc of doctorsSnap.docs) {
    const data = doctorDoc.data() || {}
    const connected = Array.isArray(data.connectedPharmacists) ? data.connectedPharmacists : []
    if (connected.length === 0) continue

    let changed = false
    const next = []
    let hasKeep = connected.includes(keepId)
    for (const pharmacistId of connected) {
      if (duplicateSet.has(pharmacistId)) {
        changed = true
        if (!hasKeep) {
          next.push(keepId)
          hasKeep = true
        }
        continue
      }
      if (!next.includes(pharmacistId)) {
        next.push(pharmacistId)
      }
    }

    if (changed) {
      if (apply) {
        await doctorDoc.ref.update({
          connectedPharmacists: next,
          updatedAt: new Date().toISOString()
        })
      }
      updated += 1
    }
  }

  return updated
}

async function mergePharmacistConnectedDoctors(keepRef, keepData, duplicates) {
  const mergedDoctors = new Set(Array.isArray(keepData.connectedDoctors) ? keepData.connectedDoctors : [])
  duplicates.forEach((dup) => {
    const doctors = Array.isArray(dup.connectedDoctors) ? dup.connectedDoctors : []
    doctors.forEach((doctorId) => mergedDoctors.add(doctorId))
  })

  const nextConnectedDoctors = Array.from(mergedDoctors)
  if (apply) {
    await keepRef.set({
      connectedDoctors: nextConnectedDoctors,
      email: email,
      emailNormalized: email,
      updatedAt: new Date().toISOString()
    }, { merge: true })
  }
  return nextConnectedDoctors.length
}

async function migrateReceivedPrescriptions(keepId, duplicateId) {
  const sourceSnap = await db.collection('pharmacists').doc(duplicateId).collection('receivedPrescriptions').get()
  let moved = 0
  if (!apply) return sourceSnap.size

  for (const docSnap of sourceSnap.docs) {
    await db.collection('pharmacists').doc(keepId).collection('receivedPrescriptions').doc(docSnap.id).set(docSnap.data(), { merge: true })
    await docSnap.ref.delete()
    moved += 1
  }
  return moved
}

async function main() {
  const matches = await getPharmacistMatchesByEmail(email)
  if (matches.length < 2) {
    console.log(`No duplicates found for ${email}. Matches: ${matches.length}`)
    matches.forEach((item) => {
      console.log(`- ${item.id} | number=${item.pharmacistNumber || 'N/A'} | createdAt=${item.createdAt || 'N/A'}`)
    })
    return
  }

  await Promise.all(matches.map(async (match) => {
    const [inventoryCount, receivedCount] = await Promise.all([
      getInventoryCount(match.id),
      getReceivedPrescriptionsCount(match.id)
    ])
    match._inventoryCount = inventoryCount
    match._receivedCount = receivedCount
  }))

  let keep = null
  if (keepIdOverride) {
    keep = matches.find((item) => item.id === keepIdOverride) || null
    if (!keep) {
      throw new Error(`--keep-id not found among duplicates for ${email}: ${keepIdOverride}`)
    }
  } else {
    keep = chooseCanonicalPharmacist(matches)
  }
  const duplicates = matches.filter((item) => item.id !== keep.id)

  console.log(`Mode: ${apply ? 'apply' : 'dry-run'}`)
  console.log(`Email: ${email}`)
  console.log(`Selection strategy: ${keepIdOverride ? `manual keep-id (${keepIdOverride})` : 'auto data-first'}`)
  console.log(`Keeping: ${keep.id} | short=${keep.pharmacyIdShort || 'N/A'} | number=${keep.pharmacistNumber || 'N/A'} | createdAt=${keep.createdAt || 'N/A'} | connectedDoctors=${Array.isArray(keep.connectedDoctors) ? keep.connectedDoctors.length : 0} | inventory=${keep._inventoryCount} | receivedRx=${keep._receivedCount}`)
  duplicates.forEach((dup) => {
    console.log(`Deleting duplicate: ${dup.id} | short=${dup.pharmacyIdShort || 'N/A'} | number=${dup.pharmacistNumber || 'N/A'} | createdAt=${dup.createdAt || 'N/A'} | connectedDoctors=${Array.isArray(dup.connectedDoctors) ? dup.connectedDoctors.length : 0} | inventory=${dup._inventoryCount} | receivedRx=${dup._receivedCount}`)
  })

  const keepRef = db.collection('pharmacists').doc(keep.id)
  const duplicateIds = duplicates.map((item) => item.id)

  const updatedDoctorsCount = await updateDoctorsConnectedPharmacists(keep.id, duplicateIds)
  console.log(`Doctors to update: ${updatedDoctorsCount}`)

  const keepConnectedDoctors = await mergePharmacistConnectedDoctors(keepRef, keep, duplicates)
  console.log(`Merged connectedDoctors count on kept pharmacist: ${keepConnectedDoctors}`)

  for (const duplicate of duplicates) {
    const movedPrescriptions = await migrateReceivedPrescriptions(keep.id, duplicate.id)
    console.log(`receivedPrescriptions moved from ${duplicate.id}: ${movedPrescriptions}`)
    if (apply) {
      await db.collection('pharmacists').doc(duplicate.id).delete()
    }
  }

  console.log(apply ? 'Done: duplicates deleted and references migrated.' : 'Dry-run complete. Re-run with --apply to execute.')
}

main().catch((error) => {
  console.error('Failed to dedupe pharmacist records:', error)
  process.exit(1)
})
