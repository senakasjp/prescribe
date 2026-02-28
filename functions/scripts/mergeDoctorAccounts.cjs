#!/usr/bin/env node
/* eslint-disable no-console */
const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
const args = process.argv.slice(2)

const getArg = (name) => {
  const found = args.find((arg) => arg.startsWith(`${name}=`))
  if (!found) return ''
  return found.slice(name.length + 1).trim()
}

const fromArg = getArg('--from')
const toArg = getArg('--to')
const dryRun = args.includes('--dry-run')
const deleteSource = args.includes('--delete-source')

if (!fromArg || !toArg) {
  console.error('Usage: node functions/scripts/mergeDoctorAccounts.cjs --from=<sourceIdOrShortIdOrEmail> --to=<targetIdOrShortIdOrEmail> [--dry-run] [--delete-source]')
  process.exit(1)
}

if (fromArg === toArg) {
  console.error('--from and --to must be different')
  process.exit(1)
}

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const normalizeShortId = (value) => String(value || '').trim().toUpperCase()

async function resolveDoctor(identifier) {
  const normalized = String(identifier || '').trim()
  if (!normalized) return null

  const direct = await db.collection('doctors').doc(normalized).get()
  if (direct.exists) {
    return { id: direct.id, ...direct.data() }
  }

  const shortId = normalizeShortId(normalized)
  if (shortId) {
    const byShort = await db.collection('doctors')
      .where('doctorIdShort', '==', shortId)
      .limit(1)
      .get()
    if (!byShort.empty) {
      const docSnap = byShort.docs[0]
      return { id: docSnap.id, ...docSnap.data() }
    }
  }

  const email = normalizeEmail(normalized)
  if (email) {
    let byEmail = await db.collection('doctors')
      .where('emailLower', '==', email)
      .limit(1)
      .get()
    if (byEmail.empty) {
      byEmail = await db.collection('doctors')
        .where('email', '==', email)
        .limit(1)
        .get()
    }
    if (!byEmail.empty) {
      const docSnap = byEmail.docs[0]
      return { id: docSnap.id, ...docSnap.data() }
    }
  }

  return null
}

async function queryByField(collectionName, field, value) {
  const normalized = String(value || '').trim()
  if (!normalized) return []
  const snap = await db.collection(collectionName).where(field, '==', normalized).get()
  return snap.docs
}

async function main() {
  const source = await resolveDoctor(fromArg)
  const target = await resolveDoctor(toArg)

  if (!source) {
    throw new Error(`Source doctor not found: ${fromArg}`)
  }
  if (!target) {
    throw new Error(`Target doctor not found: ${toArg}`)
  }
  if (source.id === target.id) {
    throw new Error('Resolved source and target are the same doctor doc')
  }

  const sourceShort = normalizeShortId(source.doctorIdShort)
  const targetShort = normalizeShortId(target.doctorIdShort)

  console.log(`Source: ${source.id} (${sourceShort || 'no-short-id'})`)
  console.log(`Target: ${target.id} (${targetShort || 'no-short-id'})`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'write'}`)

  const operations = []
  const pushUpdate = (ref, data) => {
    operations.push({ type: 'update', ref, data })
  }
  const pushSetMerge = (ref, data) => {
    operations.push({ type: 'set-merge', ref, data })
  }
  const pushDelete = (ref) => {
    operations.push({ type: 'delete', ref })
  }

  const collectionsWithDoctorId = [
    'patients',
    'medications',
    'symptoms',
    'illnesses',
    'longTermMedications',
    'drugDatabase',
    'stripeCheckoutLogs',
    'doctorPaymentRecords',
    'doctorAiUsageLogs',
  ]

  for (const collectionName of collectionsWithDoctorId) {
    const docs = await queryByField(collectionName, 'doctorId', source.id)
    docs.forEach((docSnap) => {
      pushUpdate(docSnap.ref, {
        doctorId: target.id,
        updatedAt: new Date().toISOString(),
      })
    })
    if (docs.length > 0) {
      console.log(`- ${collectionName}: will reassign ${docs.length} docs`)
    }
  }

  const invitedDocs = await queryByField('doctors', 'invitedByDoctorId', source.id)
  invitedDocs.forEach((docSnap) => {
    pushUpdate(docSnap.ref, {
      invitedByDoctorId: target.id,
      updatedAt: new Date().toISOString(),
    })
  })
  if (invitedDocs.length > 0) {
    console.log(`- doctors.invitedByDoctorId: will reassign ${invitedDocs.length} docs`)
  }

  const referredBySourceId = await queryByField('doctors', 'referredByDoctorId', source.id)
  referredBySourceId.forEach((docSnap) => {
    pushUpdate(docSnap.ref, {
      referredByDoctorId: target.id,
      updatedAt: new Date().toISOString(),
    })
  })
  if (referredBySourceId.length > 0) {
    console.log(`- doctors.referredByDoctorId(source.id): will reassign ${referredBySourceId.length} docs`)
  }

  if (sourceShort) {
    const referredByShort = await queryByField('doctors', 'referredByDoctorId', sourceShort)
    referredByShort.forEach((docSnap) => {
      pushUpdate(docSnap.ref, {
        referredByDoctorId: target.id,
        updatedAt: new Date().toISOString(),
      })
    })
    if (referredByShort.length > 0) {
      console.log(`- doctors.referredByDoctorId(source.short): will reassign ${referredByShort.length} docs`)
    }
  }

  const sourceReportRef = db.collection('doctorReports').doc(source.id)
  const targetReportRef = db.collection('doctorReports').doc(target.id)
  const [sourceReportSnap, targetReportSnap] = await Promise.all([
    sourceReportRef.get(),
    targetReportRef.get(),
  ])
  if (sourceReportSnap.exists) {
    const sourceReport = sourceReportSnap.data() || {}
    const targetReport = targetReportSnap.exists ? (targetReportSnap.data() || {}) : {}
    const mergedReport = { ...sourceReport, ...targetReport, mergedFromDoctorId: source.id }
    pushSetMerge(targetReportRef, mergedReport)
    console.log('- doctorReports: will merge source report into target')
    if (deleteSource) {
      pushDelete(sourceReportRef)
      console.log('- doctorReports: will delete source report doc')
    }
  }

  const targetDiscount = Number(target.adminStripeDiscountPercent || 0)
  const sourceDiscount = Number(source.adminStripeDiscountPercent || 0)
  const mergedDiscount = Math.max(targetDiscount, sourceDiscount)

  pushUpdate(db.collection('doctors').doc(target.id), {
    adminStripeDiscountPercent: mergedDiscount,
    mergedDoctorIds: admin.firestore.FieldValue.arrayUnion(source.id),
    updatedAt: new Date().toISOString(),
  })
  console.log(`- doctors/${target.id}: will set adminStripeDiscountPercent=${mergedDiscount}`)

  if (deleteSource) {
    pushDelete(db.collection('doctors').doc(source.id))
    console.log(`- doctors/${source.id}: will delete source doctor doc`)
  } else {
    pushUpdate(db.collection('doctors').doc(source.id), {
      mergedIntoDoctorId: target.id,
      mergedIntoDoctorIdShort: targetShort || null,
      isDisabled: true,
      updatedAt: new Date().toISOString(),
    })
    console.log(`- doctors/${source.id}: will mark mergedIntoDoctorId=${target.id} and disable source`)
  }

  console.log(`\nPlanned operations: ${operations.length}`)

  if (dryRun) {
    console.log('Dry run complete. No writes executed.')
    return
  }

  let batch = db.batch()
  let countInBatch = 0
  let committed = 0
  for (const op of operations) {
    if (op.type === 'update') {
      batch.update(op.ref, op.data)
    } else if (op.type === 'set-merge') {
      batch.set(op.ref, op.data, { merge: true })
    } else if (op.type === 'delete') {
      batch.delete(op.ref)
    }
    countInBatch += 1
    if (countInBatch >= 400) {
      await batch.commit()
      committed += countInBatch
      batch = db.batch()
      countInBatch = 0
    }
  }
  if (countInBatch > 0) {
    await batch.commit()
    committed += countInBatch
  }
  console.log(`Merge complete. Committed operations: ${committed}`)
}

main().catch((error) => {
  console.error('Merge failed:', error.message || error)
  process.exit(1)
})

