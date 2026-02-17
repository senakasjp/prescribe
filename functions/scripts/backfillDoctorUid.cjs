#!/usr/bin/env node
/* eslint-disable no-console */
const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
const auth = admin.auth()

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')
const limitArg = args.find((arg) => arg.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity

if (Number.isNaN(limit) || limit <= 0) {
  console.error('Invalid --limit value. Example: --limit=100')
  process.exit(1)
}

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()

async function main() {
  console.log(`Starting doctor UID backfill${dryRun ? ' (dry-run)' : ''}...`)
  const snapshot = await db.collection('doctors').get()

  let scanned = 0
  let updated = 0
  let skippedHasUid = 0
  let skippedNoEmail = 0
  let skippedNoAuthUser = 0
  let errors = 0

  for (const docSnap of snapshot.docs) {
    if (scanned >= limit) break
    scanned += 1

    const data = docSnap.data() || {}
    const currentUid = String(data.uid || '').trim()
    const email = normalizeEmail(data.email || data.emailLower)

    if (!force && currentUid) {
      skippedHasUid += 1
      continue
    }

    if (!email) {
      skippedNoEmail += 1
      console.warn(`- ${docSnap.id}: skipped (missing email)`)
      continue
    }

    let authUser
    try {
      authUser = await auth.getUserByEmail(email)
    } catch (error) {
      if (error && error.code === 'auth/user-not-found') {
        skippedNoAuthUser += 1
        console.warn(`- ${docSnap.id}: skipped (no Auth user for ${email})`)
        continue
      }
      errors += 1
      console.error(`- ${docSnap.id}: error resolving Auth user for ${email}: ${error.message}`)
      continue
    }

    if (currentUid === authUser.uid) {
      skippedHasUid += 1
      continue
    }

    const patch = {
      uid: authUser.uid,
      updatedAt: new Date().toISOString()
    }

    if (dryRun) {
      console.log(`- ${docSnap.id}: would set uid -> ${authUser.uid} (${email})`)
    } else {
      await docSnap.ref.update(patch)
      console.log(`- ${docSnap.id}: updated uid -> ${authUser.uid} (${email})`)
    }
    updated += 1
  }

  console.log('\nBackfill summary:')
  console.log(`- scanned: ${scanned}`)
  console.log(`- updated: ${updated}`)
  console.log(`- skipped (has uid): ${skippedHasUid}`)
  console.log(`- skipped (missing email): ${skippedNoEmail}`)
  console.log(`- skipped (no auth user): ${skippedNoAuthUser}`)
  console.log(`- errors: ${errors}`)
  console.log(`- mode: ${dryRun ? 'dry-run' : 'write'}`)
}

main().catch((error) => {
  console.error('Backfill failed:', error)
  process.exit(1)
})
