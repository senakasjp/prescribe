#!/usr/bin/env node

/* eslint-disable no-console */
const admin = require("firebase-admin");

const nowIso = new Date().toISOString();
const nowMs = new Date(nowIso).getTime();

const parseArgs = (argv = []) => {
  const args = {
    dryRun: false,
    max: 1000,
  };

  argv.forEach((arg) => {
    if (arg === "--dry-run") {
      args.dryRun = true;
      return;
    }

    if (arg.startsWith("--max=")) {
      const value = Number(arg.split("=")[1]);
      if (Number.isFinite(value) && value > 0) {
        args.max = Math.min(5000, Math.floor(value));
      }
    }
  });

  return args;
};

const addOneMonthToIso = (value) => {
  const base = value ? new Date(value) : new Date(nowIso);
  const fallbackBase = Number.isNaN(base.getTime()) ? new Date(nowIso) : base;
  const effectiveBase = fallbackBase.getTime() > nowMs ? fallbackBase : new Date(nowIso);
  const next = new Date(effectiveBase);
  next.setMonth(next.getMonth() + 1);
  return next.toISOString();
};

const resolveReferrerDoctorId = async (rawReferrerId = "") => {
  const normalized = String(rawReferrerId || "").trim();
  if (!normalized) return "";

  const doctorsRef = admin.firestore().collection("doctors");
  const directSnap = await doctorsRef.doc(normalized).get();
  if (directSnap.exists) {
    return directSnap.id;
  }

  const shortMatch = await doctorsRef
      .where("doctorIdShort", "==", normalized)
      .limit(1)
      .get();
  if (!shortMatch.empty) {
    return shortMatch.docs[0].id;
  }

  return "";
};

const isReferredDoctorEligible = (doctor = {}) => {
  if (!doctor || typeof doctor !== "object") return false;
  if (!doctor.referredByDoctorId) return false;
  if (doctor.referralBonusApplied) return false;
  if (doctor.isApproved === false) return false;
  if (doctor.isDisabled === true) return false;

  const eligibleAtMs = new Date(doctor.referralEligibleAt || "").getTime();
  if (!Number.isFinite(eligibleAtMs)) return false;
  return eligibleAtMs <= nowMs;
};

const buildRewardRecordId = (referredDoctorId) => {
  const safe = String(referredDoctorId || "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 160);
  return `referral_reward_${safe}`;
};

const applyRewardForDoctor = async ({referredDoctorId, dryRun = false}) => {
  const db = admin.firestore();
  const referredRef = db.collection("doctors").doc(referredDoctorId);

  return db.runTransaction(async (tx) => {
    const referredSnap = await tx.get(referredRef);
    if (!referredSnap.exists) {
      return {status: "skipped", reason: "referred-doctor-missing"};
    }

    const referredDoctor = referredSnap.data() || {};
    if (!isReferredDoctorEligible(referredDoctor)) {
      return {status: "skipped", reason: "not-eligible"};
    }

    const resolvedReferrerId = await resolveReferrerDoctorId(
        referredDoctor.referredByDoctorId,
    );
    if (!resolvedReferrerId) {
      return {status: "skipped", reason: "referrer-not-found"};
    }
    if (resolvedReferrerId === referredDoctorId) {
      return {status: "skipped", reason: "self-referral"};
    }

    const referrerRef = db.collection("doctors").doc(resolvedReferrerId);
    const referrerSnap = await tx.get(referrerRef);
    if (!referrerSnap.exists) {
      return {status: "skipped", reason: "referrer-doc-missing"};
    }

    const paymentRef = db
        .collection("doctorPaymentRecords")
        .doc(buildRewardRecordId(referredDoctorId));
    const paymentSnap = await tx.get(paymentRef);
    if (paymentSnap.exists || referredDoctor.referralBonusApplied === true) {
      return {status: "skipped", reason: "already-applied"};
    }

    if (dryRun) {
      return {
        status: "planned",
        referrerId: resolvedReferrerId,
      };
    }

    const referrerDoctor = referrerSnap.data() || {};
    tx.set(referrerRef, {
      accessExpiresAt: addOneMonthToIso(referrerDoctor.accessExpiresAt),
      walletMonths: Number(referrerDoctor.walletMonths || 0) + 1,
      updatedAt: nowIso,
    }, {merge: true});

    tx.set(referredRef, {
      referredByDoctorId: resolvedReferrerId,
      referralBonusApplied: true,
      referralBonusAppliedAt: nowIso,
      updatedAt: nowIso,
    }, {merge: true});

    tx.set(paymentRef, {
      doctorId: resolvedReferrerId,
      type: "referral_reward",
      source: "referral",
      status: "credited",
      monthsDelta: 1,
      referenceId: referredDoctorId,
      note: `Referral reward from ${referredDoctorId}`,
      metadata: {
        referredDoctorId,
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    }, {merge: false});

    return {
      status: "applied",
      referrerId: resolvedReferrerId,
    };
  });
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!admin.apps.length) {
    const projectId = process.env.GCLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.FIREBASE_PROJECT_ID ||
      "prescribe-7e1e8";
    admin.initializeApp({projectId});
  }

  const db = admin.firestore();
  const snapshot = await db
      .collection("doctors")
      .where("referralBonusApplied", "==", false)
      .limit(args.max)
      .get();

  const candidates = snapshot.docs
      .map((doc) => ({id: doc.id, ...doc.data()}))
      .filter(isReferredDoctorEligible);

  const summary = {
    dryRun: args.dryRun,
    scanned: snapshot.size,
    eligible: candidates.length,
    applied: 0,
    planned: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  for (const doctor of candidates) {
    try {
      const result = await applyRewardForDoctor({
        referredDoctorId: doctor.id,
        dryRun: args.dryRun,
      });
      if (result.status === "applied") summary.applied += 1;
      else if (result.status === "planned") summary.planned += 1;
      else summary.skipped += 1;
      summary.details.push({
        referredDoctorId: doctor.id,
        ...result,
      });
    } catch (error) {
      summary.errors += 1;
      summary.details.push({
        referredDoctorId: doctor.id,
        status: "error",
        message: error?.message || String(error),
      });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (summary.errors > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error("reconcileReferralRewards failed:", error);
  process.exit(1);
});

