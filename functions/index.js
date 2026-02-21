/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");
const {
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const bwipjs = require("bwip-js");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");
const twilio = require("twilio");
const Stripe = require("stripe");

admin.initializeApp();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const SMTP_PASS = defineSecret("SMTP_PASS");
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_FROM = defineSecret("TWILIO_WHATSAPP_FROM");
const NOTIFY_USER_ID = defineSecret("NOTIFY_USER_ID");
const NOTIFY_API_KEY = defineSecret("NOTIFY_API_KEY");
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const DEFAULT_APP_URL = "https://prescribe-7e1e8.web.app";
const OPENAI_PROXY_ALLOWED_ENDPOINTS = new Set(["chat/completions"]);
// Needs to handle vision/OCR requests that include data URLs.
const OPENAI_PROXY_MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB hard cap
const OPENAI_PROXY_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const OPENAI_PROXY_RATE_LIMIT_MAX_REQUESTS = 30;
const openaiProxyRateLimits = new Map();
const smsDedupeCache = new Map();
const SMS_DEDUPE_WINDOW_MS = 60 * 1000;
const STRIPE_ALLOWED_RETURN_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "prescribe-7e1e8.web.app",
  "www.mprescribe.net",
  "mprescribe.net",
]);
const STRIPE_PLAN_CATALOG = {
  professional_monthly_usd: {
    name: "Professional Monthly",
    currency: "usd",
    unitAmount: 2000,
    interval: "month",
  },
  professional_annual_usd: {
    name: "Professional Annual",
    currency: "usd",
    unitAmount: 20000,
    interval: "year",
  },
  professional_monthly_lkr: {
    name: "Professional Monthly",
    currency: "lkr",
    unitAmount: 500000,
    interval: "month",
  },
  professional_annual_lkr: {
    name: "Professional Annual",
    currency: "lkr",
    unitAmount: 5000000,
    interval: "year",
  },
};

const convertMajorToMinor = (amount, currency = "") => {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const normalizedCurrency = String(currency || "").trim().toLowerCase();
  if (normalizedCurrency === "usd") {
    return Math.round(parsed * 100);
  }
  return Math.round(parsed * 100);
};

const hasDoctorPriorPaymentHistory = (doctorData = {}) => {
  if (!doctorData || typeof doctorData !== "object") return false;
  const paymentDone = doctorData.paymentDone === true;
  const paymentStatus = String(doctorData.paymentStatus || "")
      .trim()
      .toLowerCase();
  const hasPaidStatus = ["paid", "active", "succeeded", "confirmed"]
      .includes(paymentStatus);
  const walletMonths = Number(doctorData.walletMonths || 0);
  const hasCustomer = Boolean(String(doctorData.stripeCustomerId || "").trim());
  const hasSubscription = Boolean(
      String(doctorData.stripeSubscriptionId || "").trim(),
  );
  const hasLastPayment = Boolean(
      String(doctorData.stripeLastPaymentAt || doctorData.paymentDoneAt || "")
          .trim(),
  );
  return (
    paymentDone ||
    hasPaidStatus ||
    walletMonths > 0 ||
    hasCustomer ||
    hasSubscription ||
    hasLastPayment
  );
};

const resolveStripePricingConfig = async () => {
  try {
    const settingsSnap = await admin
        .firestore()
        .collection("systemSettings")
        .doc("paymentPricing")
        .get();
    if (!settingsSnap.exists) return null;
    return settingsSnap.data() || null;
  } catch (error) {
    logger.error("Failed to load payment pricing settings:", error);
    return null;
  }
};

const resolvePlanCatalogForCheckout = ({
  pricingConfig = null,
  isNewCustomer = true,
}) => {
  const catalog = {...STRIPE_PLAN_CATALOG};
  const enabled = pricingConfig && pricingConfig.enabled !== false;
  if (!enabled) return catalog;

  const appliesTo =
    String(pricingConfig.appliesTo || "new_customers").trim().toLowerCase();
  const appliesForDoctor =
    appliesTo === "all_customers" ||
    (appliesTo === "new_customers" && isNewCustomer);
  if (!appliesForDoctor) return catalog;

  const monthlyUsdMinor = convertMajorToMinor(pricingConfig.monthlyUsd, "usd");
  const annualUsdMinor = convertMajorToMinor(pricingConfig.annualUsd, "usd");
  const monthlyLkrMinor = convertMajorToMinor(pricingConfig.monthlyLkr, "lkr");
  const annualLkrMinor = convertMajorToMinor(pricingConfig.annualLkr, "lkr");

  if (Number.isFinite(monthlyUsdMinor) && monthlyUsdMinor >= 50) {
    catalog.professional_monthly_usd = {
      ...catalog.professional_monthly_usd,
      unitAmount: monthlyUsdMinor,
    };
  }
  if (Number.isFinite(annualUsdMinor) && annualUsdMinor >= 50) {
    catalog.professional_annual_usd = {
      ...catalog.professional_annual_usd,
      unitAmount: annualUsdMinor,
    };
  }
  if (Number.isFinite(monthlyLkrMinor) && monthlyLkrMinor >= 50) {
    catalog.professional_monthly_lkr = {
      ...catalog.professional_monthly_lkr,
      unitAmount: monthlyLkrMinor,
    };
  }
  if (Number.isFinite(annualLkrMinor) && annualLkrMinor >= 50) {
    catalog.professional_annual_lkr = {
      ...catalog.professional_annual_lkr,
      unitAmount: annualLkrMinor,
    };
  }
  return catalog;
};

const normalizePromoCode = (value) =>
  String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");

const resolvePromoForCheckout = async ({
  promoCode = "",
  selectedPlan = null,
  baseUnitAmount = null,
}) => {
  const normalizedCode = normalizePromoCode(promoCode);
  if (!normalizedCode || !selectedPlan) {
    return {
      promo: null,
      discountAmount: 0,
      finalUnitAmount: Number(
          Number.isFinite(Number(baseUnitAmount)) ?
            Number(baseUnitAmount) :
            Number((selectedPlan && selectedPlan.unitAmount) || 0),
      ),
    };
  }

  const promoQuery = await admin
      .firestore()
      .collection("promoCodes")
      .where("code", "==", normalizedCode)
      .limit(1)
      .get();

  if (promoQuery.empty) {
    throw new Error("Invalid promo code.");
  }

  const promoDoc = promoQuery.docs[0];
  const promo = promoDoc.data() || {};
  const now = Date.now();
  const validFromMs = promo.validFrom ? new Date(promo.validFrom).getTime() : 0;
  const validUntilMs = promo.validUntil ?
    new Date(promo.validUntil).getTime() :
    0;
  const isActive = promo.isActive !== false;

  if (!isActive) {
    throw new Error("Promo code is inactive.");
  }
  if (validFromMs && validFromMs > now) {
    throw new Error("Promo code is not active yet.");
  }
  if (validUntilMs && validUntilMs < now) {
    throw new Error("Promo code has expired.");
  }

  const maxRedemptions = Number(promo.maxRedemptions || 0);
  const redemptionCount = Number(promo.redemptionCount || 0);
  if (maxRedemptions > 0 && redemptionCount >= maxRedemptions) {
    throw new Error("Promo code redemption limit reached.");
  }

  const planIds = Array.isArray(promo.planIds) ?
    promo.planIds.map((id) => String(id || "")) :
    [];
  const planId = String(selectedPlan.planId || "");
  if (planIds.length && !planIds.includes(planId)) {
    throw new Error("Promo code is not valid for this plan.");
  }

  const promoCurrency = String(promo.currency || "").trim().toLowerCase();
  const planCurrency = String(selectedPlan.currency || "").trim().toLowerCase();
  if (promoCurrency && promoCurrency !== planCurrency) {
    throw new Error("Promo code is not valid for this currency.");
  }

  const effectiveBaseUnitAmount = Number.isFinite(Number(baseUnitAmount)) ?
    Number(baseUnitAmount) :
    Number(selectedPlan.unitAmount || 0);
  const discountType = String(promo.discountType || "percent").toLowerCase();
  let discountAmount = 0;
  if (discountType === "fixed") {
    discountAmount = Math.max(0, Number(promo.fixedAmountMinor || 0));
  } else {
    const percent = Math.min(100, Math.max(0, Number(promo.percentOff || 0)));
    discountAmount = Math.round(effectiveBaseUnitAmount * (percent / 100));
  }

  const finalUnitAmount = Math.max(
      50,
      effectiveBaseUnitAmount - discountAmount,
  );
  if (finalUnitAmount >= effectiveBaseUnitAmount) {
    throw new Error("Promo code does not reduce this plan price.");
  }

  return {
    promo: {
      id: promoDoc.id,
      code: normalizedCode,
      discountType,
      percentOff: Number(promo.percentOff || 0),
      fixedAmountMinor: Number(promo.fixedAmountMinor || 0),
    },
    discountAmount,
    finalUnitAmount,
  };
};

const recordPromoRedemption = async ({promoId = "", sessionId = ""}) => {
  const normalizedPromoId = String(promoId || "").trim();
  const normalizedSessionId = String(sessionId || "").trim();
  if (!normalizedPromoId || !normalizedSessionId) return;

  const lockRef = admin
      .firestore()
      .collection("promoRedemptionLocks")
      .doc(
          `${normalizedPromoId}_${normalizedSessionId}`
              .replace(/[^a-zA-Z0-9_-]/g, "_"),
      );
  try {
    await lockRef.create({
      promoId: normalizedPromoId,
      sessionId: normalizedSessionId,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error && error.code === 6) return;
    throw error;
  }

  const promoRef = admin
      .firestore()
      .collection("promoCodes")
      .doc(normalizedPromoId);
  await promoRef.set({
    redemptionCount: admin.firestore.FieldValue.increment(1),
    updatedAt: new Date().toISOString(),
  }, {merge: true});
};

const cleanupExpiredInMemoryGuards = (now = Date.now()) => {
  for (const [key, entry] of openaiProxyRateLimits.entries()) {
    if (
      !entry ||
      now - entry.windowStart >= OPENAI_PROXY_RATE_LIMIT_WINDOW_MS
    ) {
      openaiProxyRateLimits.delete(key);
    }
  }
  for (const [key, createdAt] of smsDedupeCache.entries()) {
    if (!createdAt || now - createdAt >= SMS_DEDUPE_WINDOW_MS) {
      smsDedupeCache.delete(key);
    }
  }
};

// Test-only reset hook for in-memory guards.
exports.__resetInMemoryGuardsForTests = () => {
  openaiProxyRateLimits.clear();
  smsDedupeCache.clear();
};
exports.__resolvePlanCatalogForCheckoutForTests = resolvePlanCatalogForCheckout;
exports.__hasDoctorPriorPaymentHistoryForTests = hasDoctorPriorPaymentHistory;
exports.__resolvePromoForCheckoutForTests = resolvePromoForCheckout;

const setCors = (req, res) => {
  const origin = req.headers.origin || "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
};

const logEmailEvent = async (event) => {
  try {
    const logsRef = admin.firestore().collection("emailLogs");
    await logsRef.add({
      ...event,
      createdAt: new Date().toISOString(),
    });

    const snapshot = await logsRef
        .orderBy("createdAt", "desc")
        .offset(500)
        .get();
    const batch = admin.firestore().batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    if (!snapshot.empty) {
      await batch.commit();
    }
  } catch (error) {
    logger.error("Failed to log email event:", error);
  }
};

const logSmsEvent = async (event) => {
  try {
    const logsRef = admin.firestore().collection("smsLogs");
    await logsRef.add({
      ...event,
      createdAt: new Date().toISOString(),
    });

    const snapshot = await logsRef
        .orderBy("createdAt", "desc")
        .offset(500)
        .get();
    const batch = admin.firestore().batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    if (!snapshot.empty) {
      await batch.commit();
    }
  } catch (error) {
    logger.error("Failed to log SMS event:", error);
  }
};

const normalizeNotifyRecipient = (input) => {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11) return digits;
  if (digits.startsWith("0") && digits.length === 10) {
    return `94${digits.slice(1)}`;
  }
  return digits;
};

const sendNotifySms = async ({recipient, senderId, message, type}) => {
  const userId = NOTIFY_USER_ID.value();
  const apiKey = NOTIFY_API_KEY.value();
  if (!userId || !apiKey) {
    logger.warn("Notify.lk configuration missing");
    return {ok: false, error: "Notify.lk configuration missing"};
  }

  const formattedRecipient = normalizeNotifyRecipient(recipient);
  if (!/^\d{11}$/.test(formattedRecipient)) {
    return {ok: false, error: "Recipient format invalid"};
  }

  const now = Date.now();
  cleanupExpiredInMemoryGuards(now);
  const dedupeKey = `${formattedRecipient}|${String(senderId || "")}|` +
    `${String(message || "")}`;
  if (smsDedupeCache.has(dedupeKey)) {
    return {ok: true, skipped: true, reason: "duplicate"};
  }
  smsDedupeCache.set(dedupeKey, now);

  const payload = new URLSearchParams({
    user_id: String(userId),
    api_key: String(apiKey),
    sender_id: String(senderId),
    to: formattedRecipient,
    message: String(message || ""),
  });
  if (String(type || "").toLowerCase() === "unicode") {
    payload.set("type", "unicode");
  }

  try {
    const response = await fetch("https://app.notify.lk/api/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: payload.toString(),
    });
    const raw = await response.text();
    if (!response.ok) {
      return {ok: false, error: raw || "Failed to send SMS"};
    }
    return {ok: true};
  } catch (error) {
    logger.error("SMS API send failed:", error);
    return {ok: false, error: error.message || "Failed to send SMS"};
  }
};

const getMessagingTemplates = async () => {
  const docRef = admin.firestore()
      .collection("systemSettings")
      .doc("messagingTemplates");
  const docSnap = await docRef.get();
  return docSnap.exists ? docSnap.data() : {};
};

const getAppUrl = async () => {
  const templates = await getMessagingTemplates();
  return (templates && templates.appUrl) || DEFAULT_APP_URL;
};

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 10});

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

const parseSecure = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return String(value || "false").toLowerCase() === "true";
};

const getSmtpSettings = async () => {
  try {
    const doc = await admin
        .firestore()
        .collection("systemSettings")
        .doc("smtp")
        .get();
    if (!doc.exists) return null;
    return doc.data() || null;
  } catch (error) {
    logger.error("Failed to load SMTP settings:", error);
    return null;
  }
};

const getSmtpConfig = async () => {
  const settings = await getSmtpSettings();
  const host = (settings && settings.host) || process.env.SMTP_HOST;
  const port = Number(
      (settings && settings.port) || process.env.SMTP_PORT || 587,
  );
  const secure = parseSecure(
      settings && typeof settings.secure !== "undefined" ?
        settings.secure :
        process.env.SMTP_SECURE,
  );
  const user = (settings && settings.user) || process.env.SMTP_USER;
  const pass =
    (settings && settings.pass) ||
    process.env.SMTP_PASS ||
    SMTP_PASS.value();

  return {
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  };
};

const getFromAddress = () =>
  process.env.WELCOME_FROM ||
  process.env.SMTP_FROM ||
  process.env.SMTP_USER ||
  "support@mprescribe.net";

const getAdminEmail = () =>
  process.env.ADMIN_EMAIL || "senakahks@gmail.com";
const getContactEmail = () =>
  process.env.CONTACT_EMAIL || "support@mprescribe.net";

const countryTimeZoneMap = {
  "Sri Lanka": "Asia/Colombo",
  "India": "Asia/Kolkata",
  "United States": "America/New_York",
  "United States of America": "America/New_York",
  "USA": "America/New_York",
  "United Kingdom": "Europe/London",
  "Ireland": "Europe/Dublin",
  "Australia": "Australia/Sydney",
  "Canada": "America/Toronto",
  "New Zealand": "Pacific/Auckland",
  "Singapore": "Asia/Singapore",
  "Malaysia": "Asia/Kuala_Lumpur",
  "United Arab Emirates": "Asia/Dubai",
  "Saudi Arabia": "Asia/Riyadh",
  "Qatar": "Asia/Qatar",
  "Kuwait": "Asia/Kuwait",
  "Bahrain": "Asia/Bahrain",
  "Pakistan": "Asia/Karachi",
  "Bangladesh": "Asia/Dhaka",
  "Nepal": "Asia/Kathmandu",
};

const formatDateInTimeZone = (dateValue, timeZone) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const resolvedTimeZone = timeZone || "UTC";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: resolvedTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const {
  formatDoctorId,
  formatPatientId,
  renderTemplate,
  buildDoctorName,
} = require("./messagingUtils");
const {
  buildPatientRegistrationSmsPayload,
} = require("./patientRegistrationSms");

const applyTemplate = (value, replacements) => {
  if (!value) return value;
  let result = String(value);
  Object.keys(replacements).forEach((key) => {
    const escapedKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (key === "unsubscribeLink") {
      const replacement = String(replacements[key] || "");
      const hrefMatch = replacement.match(/href=["']([^"']+)["']/i);
      if (hrefMatch) {
        const hrefValue = hrefMatch[1];
        const hrefPattern = new RegExp(
            `href=(["']){{\\s*${escapedKey}\\s*}}\\1`,
            "gi",
        );
        const hrefEncodedPattern = new RegExp(
            `href=(["'])&#123;\\s*&#123;\\s*` +
              `${escapedKey}` +
              `\\s*&#125;\\s*&#125;\\1`,
            "gi",
        );
        const hrefNamedEncodedPattern = new RegExp(
            `href=(["'])&lbrace;\\s*&lbrace;\\s*` +
              `${escapedKey}` +
              `\\s*&rbrace;\\s*&rbrace;\\1`,
            "gi",
        );
        result = result.replace(hrefPattern, `href="${hrefValue}"`);
        result = result.replace(hrefEncodedPattern, `href="${hrefValue}"`);
        result = result.replace(hrefNamedEncodedPattern, `href="${hrefValue}"`);
      }
    }
    const pattern = new RegExp(`{{\\s*${escapedKey}\\s*}}`, "gi");
    const encodedPattern = new RegExp(
        `&#123;\\s*&#123;\\s*${escapedKey}\\s*&#125;\\s*&#125;`,
        "gi",
    );
    const namedEncodedPattern = new RegExp(
        `&lbrace;\\s*&lbrace;\\s*${escapedKey}\\s*&rbrace;\\s*&rbrace;`,
        "gi",
    );
    const replacement = replacements[key] || "";
    result = result.replace(pattern, String(replacement));
    result = result.replace(encodedPattern, String(replacement));
    result = result.replace(namedEncodedPattern, String(replacement));
  });
  return result;
};

const getProjectId = () => {
  const direct = process.env.GCLOUD_PROJECT;
  if (direct) return direct;
  try {
    const config = JSON.parse(process.env.FIREBASE_CONFIG || "{}");
    return config.projectId || config.project_id || "";
  } catch (error) {
    return "";
  }
};

const getFunctionRegion = () =>
  process.env.FUNCTION_REGION || "us-central1";

const buildUnsubscribeUrl = (patient) => {
  if (!patient || !patient.id || !patient.email) return "";
  const projectId = getProjectId();
  if (!projectId) return "";
  const region = getFunctionRegion();
  const baseUrl =
    `https://${region}-${projectId}.cloudfunctions.net/unsubscribeEmail`;
  const patientIdValue = encodeURIComponent(patient.id);
  const emailValue = encodeURIComponent(patient.email);
  return `${baseUrl}?patientId=${patientIdValue}&email=${emailValue}`;
};

const isNotificationsDisabled = (patient) => (
  !!(
    patient &&
    (patient.disableNotifications ||
      patient.doNotSendNotifications ||
      patient.dontSendNotifications)
  )
);

exports.sendContactEmail = onRequest(
    {secrets: [SMTP_PASS]},
    async (req, res) => {
      setCors(req, res);
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
      }

      try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const name = String(body.name || "").trim().slice(0, 120);
        const email = String(body.email || "").trim().slice(0, 200);
        const subject = String(body.subject || "").trim().slice(0, 160);
        const message = String(body.message || "").trim().slice(0, 4000);

        if (!message) {
          res.status(400).send("Message is required");
          return;
        }

        const smtpConfig = await getSmtpConfig();
        if (
          !smtpConfig.host ||
          !smtpConfig.auth.user ||
          !smtpConfig.auth.pass
        ) {
          res.status(500).send("SMTP not configured");
          return;
        }

        const transporter = nodemailer.createTransport(smtpConfig);
        const toEmail = getContactEmail();
        const fromEmail = getFromAddress();
        const mailSubject = subject ?
          `[Contact] ${subject}` :
          "New contact request";
        const text = [
          `Name: ${name || "N/A"}`,
          `Email: ${email || "N/A"}`,
          "",
          message,
        ].join("\n");

        await transporter.sendMail({
          to: toEmail,
          from: fromEmail,
          replyTo: email || undefined,
          subject: mailSubject,
          text,
        });

        await logEmailEvent({
          type: "contact",
          to: toEmail,
          from: fromEmail,
          replyTo: email || "",
          subject: mailSubject,
          status: "sent",
        });

        res.status(200).send("Sent");
      } catch (error) {
        logger.error("Contact email failed:", error);
        try {
          await logEmailEvent({
            type: "contact",
            to: getContactEmail(),
            status: "error",
            error: (error && error.message) || "Unknown error",
          });
        } catch (logError) {
          logger.error("Failed to log contact email error:", logError);
        }
        res.status(500).send("Failed to send");
      }
    },
);

const buildWelcomeEmail = async (doctor, template = {}, appUrl = "") => {
  const name =
    (doctor && doctor.name) ||
    [doctor && doctor.firstName, doctor && doctor.lastName]
        .filter(Boolean)
        .join(" ") ||
    "Doctor";
  const rawDoctorId =
    (doctor && (doctor.id || doctor.doctorId || doctor.uid)) || "";
  const referralBaseUrl = "https://mprescribe.net";
  const referralValue = formatDoctorId(rawDoctorId);
  const referralUrl = referralValue ?
    `${referralBaseUrl}/?ref=${encodeURIComponent(referralValue)}` :
    "";
  let referralQr = "";
  if (referralUrl) {
    try {
      referralQr = await QRCode.toDataURL(referralUrl, {
        width: 300,
        margin: 1,
      });
    } catch (error) {
      logger.error("Failed to generate referral QR code:", error);
      referralQr = "";
    }
  }
  let doctorIdBarcode = "";
  const doctorIdShort = formatDoctorId(rawDoctorId);
  const barcodeText = doctorIdShort || rawDoctorId;
  if (barcodeText) {
    try {
      const buffer = await bwipjs.toBuffer({
        bcid: "code128",
        text: barcodeText,
        scale: 2,
        height: 22,
        includetext: false,
        padding: 0,
      });
      const barcodeBase64 = buffer.toString("base64");
      doctorIdBarcode = `data:image/png;base64,${barcodeBase64}`;
    } catch (error) {
      logger.error("Failed to generate doctor ID barcode:", error);
      doctorIdBarcode = "";
    }
  }
  const replacements = {
    name,
    email: (doctor && doctor.email) || "",
    doctorId: rawDoctorId,
    doctorIdShort,
    doctorIdBarcode,
    referralUrl,
    referralQr,
    unsubscribeUrl: "",
    unsubscribeLink: "",
    appUrl: appUrl || DEFAULT_APP_URL,
  };

  const defaultSubject = "Welcome to Prescribe";
  const defaultText = `Hi ${name},

Welcome to Prescribe! Your account is ready and you can sign in any time.

If you need help getting started, reply to this email and our team will assist.

Thanks,
Prescribe Team`;

  const defaultHtml = `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin-bottom: 8px;">Welcome to Prescribe</h2>
      <p>Hi ${name},</p>
      <p>Your account is ready and you can sign in any time.</p>
      <p>
        If you need help getting started, reply to this email
        and our team will assist.
      </p>
      <p style="margin-top: 24px;">Thanks,<br/>Prescribe Team</p>
    </div>
  `;

  const isHtmlDefault =
    template.html &&
    template.html.trim() === defaultHtml.trim();
  const hasCustomText =
    template.text && template.text.trim() !== "";
  const hasCustomHtml =
    template.html && template.html.trim() !== "" && !isHtmlDefault;
  const hasAnyCustomContent =
    template.subject ||
    hasCustomText ||
    hasCustomHtml;
  const forceTextOnly = !!template.textOnly;

  const subjectSource = hasAnyCustomContent ?
    (template.subject || defaultSubject) :
    defaultSubject;
  const textSource = hasAnyCustomContent ?
    (hasCustomText ? template.text : defaultText) :
    defaultText;
  let htmlSource;
  if (forceTextOnly) {
    htmlSource = undefined;
  } else if (hasAnyCustomContent) {
    if (hasCustomHtml) {
      htmlSource = template.html;
    } else if (hasCustomText) {
      htmlSource = undefined;
    } else {
      htmlSource = defaultHtml;
    }
  } else {
    htmlSource = defaultHtml;
  }

  const subject = applyTemplate(subjectSource, replacements);
  const text = applyTemplate(textSource, replacements);
  const html = applyTemplate(htmlSource, replacements);

  return {subject, text, html};
};

const buildPatientWelcomeEmail = async (
    patient,
    doctorName,
    template = {},
    appUrl = "",
) => {
  const patientName =
    (patient && patient.name) ||
    [patient && patient.firstName, patient && patient.lastName]
        .filter(Boolean)
        .join(" ") ||
    "Patient";
  const rawPatientId = (patient && (patient.id || patient.patientId)) || "";
  const patientIdShort = formatPatientId(rawPatientId);
  let patientIdBarcode = "";
  let barcodeBuffer = null;
  const barcodeText = patientIdShort || rawPatientId;
  if (barcodeText) {
    try {
      const buffer = await bwipjs.toBuffer({
        bcid: "code128",
        text: barcodeText,
        scale: 2,
        height: 60,
        includetext: false,
        padding: 0,
      });
      barcodeBuffer = buffer;
      patientIdBarcode = "cid:patient-id-barcode";
    } catch (error) {
      logger.error("Failed to generate patient ID barcode:", error);
      patientIdBarcode = "";
    }
  }

  const unsubscribeUrl = buildUnsubscribeUrl(patient);
  const unsubscribeLink = unsubscribeUrl ?
    `<a href="${unsubscribeUrl}" style="color:#2563eb;">Unsubscribe</a>` :
    "";

  const defaultSubject = "Welcome to M-Prescribe";
  const defaultText = `
Hi ${patientName},

Welcome to M-Prescribe. Your patient profile has been created.

Patient ID: ${patientIdShort || rawPatientId}
Doctor: ${doctorName || "Your doctor"}

If you have any questions, reply to this email.

Thanks,
M-Prescribe Team
  `.trim();

  const unsubscribeText = unsubscribeUrl ?
    `\n\nUnsubscribe: ${unsubscribeUrl}` :
    "";

  const barcodeHtml = patientIdBarcode ?
    `<p style="margin: 16px 0;">
      <img src="${patientIdBarcode}" alt="Patient ID Barcode" />
    </p>` :
    "";

  const defaultHtml = `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin-bottom: 8px;">Welcome to M-Prescribe</h2>
      <p>Hi ${patientName},</p>
      <p>Your patient profile has been created.</p>
      <p><strong>Patient ID:</strong> ${patientIdShort || rawPatientId}</p>
      <p><strong>Doctor:</strong> ${doctorName || "Your doctor"}</p>
      ${barcodeHtml}
      <p>If you have any questions, reply to this email.</p>
      <p style="margin-top: 24px;">Thanks,<br/>M-Prescribe Team</p>
      ${unsubscribeLink ?
    `<p style="margin-top: 16px; font-size: 12px; color: #6b7280;">
        If you no longer want these emails, ${unsubscribeLink}.
      </p>` :
    ""}
    </div>
  `;

  const hasCustomText = template.text && template.text.trim() !== "";
  const hasCustomHtml = template.html && template.html.trim() !== "";
  const hasAnyCustomContent =
    template.subject ||
    hasCustomText ||
    hasCustomHtml;
  const forceTextOnly = !!template.textOnly;

  const subjectSource = hasAnyCustomContent ?
    (template.subject || defaultSubject) :
    defaultSubject;
  let textSource = hasAnyCustomContent ?
    (hasCustomText ? template.text : defaultText) :
    defaultText;
  textSource = textSource && !/unsubscribe/i.test(textSource) ?
    `${textSource}${unsubscribeText}` :
    textSource;
  let htmlSource;
  if (forceTextOnly) {
    htmlSource = undefined;
  } else if (hasAnyCustomContent) {
    if (hasCustomHtml) {
      htmlSource = template.html;
    } else if (hasCustomText) {
      htmlSource = undefined;
    } else {
      htmlSource = defaultHtml;
    }
  } else {
    htmlSource = defaultHtml;
  }
  if (htmlSource && !/unsubscribe/i.test(htmlSource)) {
    const footer = unsubscribeLink ?
      `<p style="margin-top: 16px; font-size: 12px; color: #6b7280;">
        If you no longer want these emails, ${unsubscribeLink}.
      </p>` :
      "";
    htmlSource = footer ? `${htmlSource}${footer}` : htmlSource;
  }

  const ensureBarcodeImage = (html) => {
    if (!html) return html;
    const barcodeToken =
      "(?:patientIdBarcode|barcodeValue)";
    const encodedToken =
      "&#123;\\s*&#123;\\s*" +
      barcodeToken +
      "\\s*&#125;\\s*&#125;";
    const namedEncodedToken =
      "&lbrace;\\s*&lbrace;\\s*" +
      barcodeToken +
      "\\s*&rbrace;\\s*&rbrace;";
    const tokenPattern =
      "\\{\\{\\s*" + barcodeToken + "\\s*\\}\\}";
    const imgWithToken = new RegExp(
        "<img[^>]+(?:" +
        tokenPattern +
        "|" +
        encodedToken +
        "|" +
        namedEncodedToken +
        ")[^>]*>",
        "i",
    );
    if (imgWithToken.test(html)) {
      return html;
    }
    const placeholderPattern = new RegExp(
        "(" +
        tokenPattern +
        "|" +
        encodedToken +
        "|" +
        namedEncodedToken +
        ")",
        "gi",
    );
    if (placeholderPattern.test(html)) {
      return html.replace(
          placeholderPattern,
          "<img " +
          "src=\"{{patientIdBarcode}}\" " +
          "alt=\"Patient barcode\" " +
          "style=\"display:block; max-width:100%; height:auto;\" " +
          "/>",
      );
    }
    return html;
  };

  htmlSource = ensureBarcodeImage(htmlSource);

  const replacements = {
    name: patientName,
    patientName,
    email: (patient && patient.email) || "",
    patientId: rawPatientId,
    patientIdShort,
    patientIdBarcode,
    barcodeValue: barcodeText || patientIdShort || rawPatientId || "",
    barcodeText: barcodeText || patientIdShort || rawPatientId || "",
    unsubscribeUrl,
    unsubscribeLink,
    doctorName: doctorName || "",
    appUrl: appUrl || DEFAULT_APP_URL,
  };

  const subject = applyTemplate(subjectSource, replacements);
  const text = applyTemplate(textSource, replacements);
  const html = applyTemplate(htmlSource, replacements);
  const attachments = barcodeBuffer ? [
    {
      filename: "patient-barcode.png",
      content: barcodeBuffer,
      cid: "patient-id-barcode",
      contentType: "image/png",
    },
  ] : [];

  return {subject, text, html, attachments};
};

const buildAppointmentReminderEmail = async (
    patient,
    doctorName,
    appointmentDate,
    template = {},
    appUrl = "",
) => {
  const patientName =
    (patient && patient.name) ||
    [patient && patient.firstName, patient && patient.lastName]
        .filter(Boolean)
        .join(" ") ||
    "Patient";
  const unsubscribeUrl = buildUnsubscribeUrl(patient);
  const unsubscribeLink = unsubscribeUrl ?
    `<a href="${unsubscribeUrl}" style="color:#2563eb;">Unsubscribe</a>` :
    "";
  const defaultSubject = "Appointment reminder";
  const defaultText = `
Hi ${patientName},

This is a reminder of your appointment with ${
  doctorName || "your doctor"
} on ${appointmentDate}.

If you need to reschedule, please contact your clinic.

Thanks,
M-Prescribe Team
  `.trim();
  const unsubscribeText = unsubscribeUrl ?
    `\n\nUnsubscribe: ${unsubscribeUrl}` :
    "";

  const defaultHtml = `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin-bottom: 8px;">Appointment reminder</h2>
      <p>Hi ${patientName},</p>
      <p>
        This is a reminder of your appointment with
        <strong>${doctorName || "your doctor"}</strong> on
        <strong>${appointmentDate}</strong>.
      </p>
      <p>If you need to reschedule, please contact your clinic.</p>
      <p style="margin-top: 24px;">Thanks,<br/>M-Prescribe Team</p>
      ${unsubscribeLink ?
    `<p style="margin-top: 16px; font-size: 12px; color: #6b7280;">
        If you no longer want these emails, ${unsubscribeLink}.
      </p>` :
    ""}
    </div>
  `;

  const hasCustomText = template.text && template.text.trim() !== "";
  const hasCustomHtml = template.html && template.html.trim() !== "";
  const hasAnyCustomContent =
    template.subject ||
    hasCustomText ||
    hasCustomHtml;
  const forceTextOnly = !!template.textOnly;

  const subjectSource = hasAnyCustomContent ?
    (template.subject || defaultSubject) :
    defaultSubject;
  let textSource = hasAnyCustomContent ?
    (hasCustomText ? template.text : defaultText) :
    defaultText;
  textSource = textSource && !/unsubscribe/i.test(textSource) ?
    `${textSource}${unsubscribeText}` :
    textSource;
  let htmlSource;
  if (forceTextOnly) {
    htmlSource = undefined;
  } else if (hasAnyCustomContent) {
    if (hasCustomHtml) {
      htmlSource = template.html;
    } else if (hasCustomText) {
      htmlSource = undefined;
    } else {
      htmlSource = defaultHtml;
    }
  } else {
    htmlSource = defaultHtml;
  }
  if (htmlSource && !/unsubscribe/i.test(htmlSource)) {
    const footer = unsubscribeLink ?
      `<p style="margin-top: 16px; font-size: 12px; color: #6b7280;">
        If you no longer want these emails, ${unsubscribeLink}.
      </p>` :
      "";
    htmlSource = footer ? `${htmlSource}${footer}` : htmlSource;
  }

  const replacements = {
    name: patientName,
    patientName,
    doctorName: doctorName || "",
    date: appointmentDate || "",
    unsubscribeUrl,
    unsubscribeLink,
    appUrl: appUrl || DEFAULT_APP_URL,
  };

  const subject = applyTemplate(subjectSource, replacements);
  const text = applyTemplate(textSource, replacements);
  const html = applyTemplate(htmlSource, replacements);

  return {subject, text, html};
};

const getPatientWelcomeTemplate = async () => {
  try {
    const doc = await admin
        .firestore()
        .collection("systemSettings")
        .doc("patientWelcomeEmail")
        .get();
    if (!doc.exists) return null;
    return doc.data() || null;
  } catch (error) {
    logger.error("Failed to load patient welcome template:", error);
    return null;
  }
};

const getWelcomeTemplate = async () => {
  try {
    const doc = await admin
        .firestore()
        .collection("systemSettings")
        .doc("welcomeEmail")
        .get();
    if (!doc.exists) return null;
    return doc.data() || null;
  } catch (error) {
    logger.error("Failed to load welcome email template:", error);
    return null;
  }
};

const getDoctorBroadcastTemplate = async () => {
  try {
    const doc = await admin
        .firestore()
        .collection("systemSettings")
        .doc("doctorBroadcastEmail")
        .get();
    if (!doc.exists) return null;
    return doc.data() || null;
  } catch (error) {
    logger.error("Failed to load doctor broadcast template:", error);
    return null;
  }
};

const getAppointmentReminderTemplate = async () => {
  try {
    const doc = await admin
        .firestore()
        .collection("systemSettings")
        .doc("appointmentReminderEmail")
        .get();
    if (!doc.exists) return null;
    return doc.data() || null;
  } catch (error) {
    logger.error("Failed to load appointment reminder template:", error);
    return null;
  }
};

const getAuthorizedAdmin = async (req) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ?
    authHeader.slice(7) :
    null;
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded || !decoded.email) return null;
    if (decoded.email.toLowerCase() !== getAdminEmail().toLowerCase()) {
      return null;
    }
    return decoded;
  } catch (error) {
    logger.error("Auth token verification failed:", error);
    return null;
  }
};

const getAuthorizedUser = async (req) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ?
    authHeader.slice(7) :
    null;
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded || null;
  } catch (error) {
    logger.error("Auth token verification failed:", error);
    return null;
  }
};

const getSafeStripeReturnUrl = (rawUrl) => {
  try {
    const parsed = new URL(String(rawUrl || ""));
    if (!/^https?:$/.test(parsed.protocol)) {
      return DEFAULT_APP_URL;
    }
    if (!STRIPE_ALLOWED_RETURN_HOSTS.has(parsed.hostname)) {
      return DEFAULT_APP_URL;
    }
    return parsed.toString();
  } catch (error) {
    return DEFAULT_APP_URL;
  }
};

const addIntervalToIsoDate = (isoDate, interval) => {
  const base = new Date(isoDate || Date.now());
  if (Number.isNaN(base.getTime())) {
    return new Date().toISOString();
  }
  if (interval === "year") {
    base.setFullYear(base.getFullYear() + 1);
  } else {
    base.setMonth(base.getMonth() + 1);
  }
  return base.toISOString();
};

const resolveDoctorIdForStripe = async (
    {
      doctorId = "",
      metadataDoctorId = "",
      userEmail = "",
      customerId = "",
      userUid = "",
      metadataUserUid = "",
    },
) => {
  const doctorsRef = admin.firestore().collection("doctors");
  const directDoctorId = String(doctorId || "").trim();
  if (directDoctorId) {
    const directDoc = await doctorsRef.doc(directDoctorId).get();
    if (directDoc.exists) return directDoc.id;
  }

  const metadataId = String(metadataDoctorId || "").trim();
  if (metadataId) {
    const metadataDoc = await doctorsRef.doc(metadataId).get();
    if (metadataDoc.exists) return metadataDoc.id;
  }

  const stripeCustomerId = String(customerId || "").trim();
  if (stripeCustomerId) {
    const byCustomer = await doctorsRef
        .where("stripeCustomerId", "==", stripeCustomerId)
        .limit(1)
        .get();
    if (!byCustomer.empty) return byCustomer.docs[0].id;
  }

  const uidCandidates = [
    String(userUid || "").trim(),
    String(metadataUserUid || "").trim(),
  ].filter(Boolean);
  if (uidCandidates.length) {
    const uidFields = ["uid", "firebaseUid", "userUid", "authUid"];
    for (const candidate of uidCandidates) {
      for (const field of uidFields) {
        const byUid = await doctorsRef
            .where(field, "==", candidate)
            .limit(1)
            .get();
        if (!byUid.empty) return byUid.docs[0].id;
      }
    }
  }

  const normalizedEmail = String(userEmail || "").trim().toLowerCase();
  if (normalizedEmail) {
    const byEmailLower = await doctorsRef
        .where("emailLower", "==", normalizedEmail)
        .limit(1)
        .get();
    if (!byEmailLower.empty) return byEmailLower.docs[0].id;

    const byEmail = await doctorsRef
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();
    if (!byEmail.empty) return byEmail.docs[0].id;
  }

  return "";
};

const resolveReferralReferrerDoctorId = async (rawReferrerId = "") => {
  const normalized = String(rawReferrerId || "").trim();
  if (!normalized) return "";
  const doctorsRef = admin.firestore().collection("doctors");

  const directDoc = await doctorsRef.doc(normalized).get();
  if (directDoc.exists) return directDoc.id;

  const shortIdMatch = await doctorsRef
      .where("doctorIdShort", "==", normalized)
      .limit(1)
      .get();
  if (!shortIdMatch.empty) {
    return shortIdMatch.docs[0].id;
  }

  return "";
};

const applyReferralRewardForPaidDoctor = async ({
  resolvedDoctorId,
  doctorData = {},
  nowIso,
}) => {
  const rawReferrerId = String(
      (doctorData && doctorData.referredByDoctorId) || "",
  ).trim();
  if (!rawReferrerId) {
    return {
      referredDoctorUpdates: {},
    };
  }

  const referrerDoctorId = await resolveReferralReferrerDoctorId(rawReferrerId);
  const referredDoctorUpdates = {};
  if (referrerDoctorId && referrerDoctorId !== rawReferrerId) {
    referredDoctorUpdates.referredByDoctorId = referrerDoctorId;
  }

  if (doctorData && doctorData.referralBonusApplied) {
    return {referredDoctorUpdates};
  }

  const eligibleAtMs = new Date(
      (doctorData && doctorData.referralEligibleAt) || "",
  ).getTime();
  const nowMs = new Date(nowIso).getTime();
  if (!Number.isFinite(eligibleAtMs) || !Number.isFinite(nowMs)) {
    return {referredDoctorUpdates};
  }
  if (eligibleAtMs > nowMs) {
    return {referredDoctorUpdates};
  }
  if (!referrerDoctorId || referrerDoctorId === resolvedDoctorId) {
    return {referredDoctorUpdates};
  }

  const referrerRef = admin
      .firestore()
      .collection("doctors")
      .doc(referrerDoctorId);
  const referrerSnap = await referrerRef.get();
  if (!referrerSnap.exists) {
    return {referredDoctorUpdates};
  }
  const referrerData = referrerSnap.data() || {};
  const referrerBaseIso = referrerData.accessExpiresAt &&
    new Date(referrerData.accessExpiresAt).getTime() > nowMs ?
    referrerData.accessExpiresAt :
    nowIso;
  const referrerNextAccessExpiresAt = addIntervalToIsoDate(
      referrerBaseIso,
      "month",
  );

  await referrerRef.set({
    accessExpiresAt: referrerNextAccessExpiresAt,
    walletMonths: Number(referrerData.walletMonths || 0) + 1,
  }, {merge: true});

  await logDoctorPaymentRecord({
    doctorId: referrerDoctorId,
    type: "referral_reward",
    source: "referral",
    status: "credited",
    monthsDelta: 1,
    referenceId: resolvedDoctorId,
    note: `Referral reward from ${resolvedDoctorId}`,
    metadata: {
      referredDoctorId: resolvedDoctorId,
    },
  });

  referredDoctorUpdates.referralBonusApplied = true;
  referredDoctorUpdates.referralBonusAppliedAt = nowIso;

  return {referredDoctorUpdates};
};

const isFirestoreAlreadyExistsError = (error) =>
  Boolean(error && (error.code === 6 || error.code === "already-exists"));

exports.reconcileReferralRewards = onSchedule(
    "every 6 hours",
    async () => {
      const nowIso = new Date().toISOString();
      const nowMs = new Date(nowIso).getTime();
      const maxCandidates = 500;
      const summary = {
        scanned: 0,
        eligible: 0,
        applied: 0,
        skipped: 0,
        errors: 0,
      };

      const candidatesSnapshot = await admin
          .firestore()
          .collection("doctors")
          .where("referralBonusApplied", "==", false)
          .limit(maxCandidates)
          .get();

      summary.scanned = candidatesSnapshot.size;
      for (const candidateDoc of candidatesSnapshot.docs) {
        const referredDoctorId = candidateDoc.id;
        const referredDoctor = candidateDoc.data() || {};
        try {
          const rawReferrerId = String(
              referredDoctor.referredByDoctorId || "",
          ).trim();
          const eligibleAtMs = new Date(
              referredDoctor.referralEligibleAt || "",
          ).getTime();
          const isEligible = Boolean(
              rawReferrerId &&
              !referredDoctor.referralBonusApplied &&
              referredDoctor.isApproved !== false &&
              !referredDoctor.isDisabled &&
              Number.isFinite(eligibleAtMs) &&
              eligibleAtMs <= nowMs,
          );
          if (!isEligible) {
            summary.skipped += 1;
            continue;
          }
          summary.eligible += 1;

          const resolvedReferrerId = await resolveReferralReferrerDoctorId(
              rawReferrerId,
          );
          if (!resolvedReferrerId || resolvedReferrerId === referredDoctorId) {
            summary.skipped += 1;
            continue;
          }

          const referrerRef = admin
              .firestore()
              .collection("doctors")
              .doc(resolvedReferrerId);
          const referrerSnap = await referrerRef.get();
          if (!referrerSnap.exists) {
            summary.skipped += 1;
            continue;
          }

          const lockRef = admin
              .firestore()
              .collection("referralRewardLocks")
              .doc(referredDoctorId);
          try {
            await lockRef.create({
              referredDoctorId,
              referrerDoctorId: resolvedReferrerId,
              createdAt: nowIso,
              source: "reconcileReferralRewards",
            });
          } catch (error) {
            if (isFirestoreAlreadyExistsError(error)) {
              summary.skipped += 1;
              continue;
            }
            throw error;
          }

          const referredRef = admin
              .firestore()
              .collection("doctors")
              .doc(referredDoctorId);
          const latestReferredSnap = await referredRef.get();
          if (!latestReferredSnap.exists) {
            summary.skipped += 1;
            continue;
          }
          const latestReferred = latestReferredSnap.data() || {};
          if (latestReferred.referralBonusApplied) {
            summary.skipped += 1;
            continue;
          }

          const referrerData = referrerSnap.data() || {};
          const referrerBaseIso = referrerData.accessExpiresAt &&
            new Date(referrerData.accessExpiresAt).getTime() > nowMs ?
            referrerData.accessExpiresAt :
            nowIso;
          const referrerNextAccessExpiresAt = addIntervalToIsoDate(
              referrerBaseIso,
              "month",
          );

          await referrerRef.set({
            accessExpiresAt: referrerNextAccessExpiresAt,
            walletMonths: Number(referrerData.walletMonths || 0) + 1,
            updatedAt: nowIso,
          }, {merge: true});

          await referredRef.set({
            referredByDoctorId: resolvedReferrerId,
            referralBonusApplied: true,
            referralBonusAppliedAt: nowIso,
            updatedAt: nowIso,
          }, {merge: true});

          await logDoctorPaymentRecord({
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
          });

          summary.applied += 1;
        } catch (error) {
          summary.errors += 1;
          logger.error("Referral reconciliation failed for doctor", {
            referredDoctorId,
            message: (error && error.message) || String(error),
          });
        }
      }

      logger.info("Referral reconciliation summary", summary);
    },
);

const applyDoctorPaymentSuccess = async ({
  resolvedDoctorId,
  planId = "",
  interval = "month",
  sessionId = "",
  customerId = "",
  subscriptionId = "",
  paidAt = "",
  paymentReferenceId = "",
  paidAmountMinor = null,
  paidCurrency = "",
}) => {
  const normalizedReferenceId = String(
      paymentReferenceId || sessionId || "",
  ).trim();
  if (normalizedReferenceId) {
    const lockIdRaw = `${resolvedDoctorId}|${normalizedReferenceId}`;
    const lockId = lockIdRaw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 240);
    const lockRef = admin.firestore()
        .collection("stripePaymentLocks")
        .doc(lockId);
    try {
      await lockRef.create({
        doctorId: resolvedDoctorId,
        paymentReferenceId: normalizedReferenceId,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error && error.code === 6) {
        const currentDoctorSnap = await admin.firestore()
            .collection("doctors")
            .doc(resolvedDoctorId)
            .get();
        if (currentDoctorSnap.exists) {
          return {id: currentDoctorSnap.id, ...currentDoctorSnap.data()};
        }
        return {id: resolvedDoctorId};
      }
      throw error;
    }
  }

  const selectedPlan = STRIPE_PLAN_CATALOG[String(planId || "")] || null;
  const normalizedInterval = interval === "year" ? "year" : "month";
  const monthsDelta = normalizedInterval === "year" ? 12 : 1;
  const doctorRef = admin.firestore()
      .collection("doctors")
      .doc(resolvedDoctorId);
  const doctorSnap = await doctorRef.get();
  const doctorData = doctorSnap.exists ? doctorSnap.data() : {};
  const nowIso = paidAt || new Date().toISOString();
  const referralRewardResult = await applyReferralRewardForPaidDoctor({
    resolvedDoctorId,
    doctorData,
    nowIso,
  });
  const accessBaseIso = doctorData && doctorData.accessExpiresAt &&
    new Date(doctorData.accessExpiresAt).getTime() > Date.now() ?
    doctorData.accessExpiresAt :
    nowIso;
  const nextAccessExpiresAt = addIntervalToIsoDate(accessBaseIso, interval);

  const updatePayload = {
    paymentDone: true,
    paymentStatus: "paid",
    paymentDoneAt: nowIso,
    accessExpiresAt: nextAccessExpiresAt,
    isDisabled: false,
    stripeCheckoutSessionId: String(sessionId || ""),
    stripeCustomerId: String(customerId || ""),
    stripeSubscriptionId: String(subscriptionId || ""),
    stripePlanId: String(planId || ""),
    stripeLastPaymentAt: nowIso,
    walletMonths: Number(doctorData.walletMonths || 0) + monthsDelta,
    ...(
      (referralRewardResult && referralRewardResult.referredDoctorUpdates) ||
      {}
    ),
  };
  await doctorRef.set(updatePayload, {merge: true});
  await logDoctorPaymentRecord({
    doctorId: resolvedDoctorId,
    type: "stripe_payment",
    source: "stripe",
    status: "paid",
    monthsDelta,
    amount: Number.isFinite(Number(paidAmountMinor)) ?
      Number(paidAmountMinor) / 100 :
      (selectedPlan ? Number(selectedPlan.unitAmount || 0) / 100 : 0),
    currency: String(
        paidCurrency || (selectedPlan ? selectedPlan.currency : ""),
    ).toUpperCase(),
    referenceId: String(
        normalizedReferenceId || subscriptionId || sessionId || "",
    ),
    note: String(planId || normalizedInterval),
    metadata: {
      planId: String(planId || ""),
      interval: normalizedInterval,
      sessionId: String(sessionId || ""),
      subscriptionId: String(subscriptionId || ""),
      customerId: String(customerId || ""),
      paidAmountMinor: Number.isFinite(Number(paidAmountMinor)) ?
        Number(paidAmountMinor) :
        null,
      paidCurrency: String(paidCurrency || "").toUpperCase(),
    },
  });
  const updatedDoctorSnap = await doctorRef.get();
  const updatedDoctor = updatedDoctorSnap.exists ?
    {id: updatedDoctorSnap.id, ...updatedDoctorSnap.data()} :
    {id: resolvedDoctorId, ...updatePayload};

  try {
    const templateDoc = await admin
        .firestore()
        .collection("systemSettings")
        .doc("paymentThanksEmail")
        .get();
    const paymentThanksTemplate = templateDoc.exists ? templateDoc.data() : {};
    if (paymentThanksTemplate && paymentThanksTemplate.enabled !== false) {
      const smtpConfig = await getSmtpConfig();
      const from = getFromAddress();
      if (
        smtpConfig &&
        smtpConfig.host &&
        smtpConfig.auth &&
        smtpConfig.auth.user &&
        smtpConfig.auth.pass &&
        from &&
        updatedDoctor.email
      ) {
        const transporter = nodemailer.createTransport(smtpConfig);
        const appUrl = await getAppUrl();
        const {subject, text, html} = await buildWelcomeEmail(
            updatedDoctor,
            paymentThanksTemplate || {},
            appUrl,
        );
        const fromEmail =
          (paymentThanksTemplate && paymentThanksTemplate.fromEmail) || from;
        const fromName =
          (paymentThanksTemplate && paymentThanksTemplate.fromName) || "";
        const replyTo =
          (paymentThanksTemplate && paymentThanksTemplate.replyTo) || undefined;
        const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
        await transporter.sendMail({
          from: fromAddress,
          to: updatedDoctor.email,
          subject,
          text,
          html,
          replyTo,
        });
        await logEmailEvent({
          type: "paymentThanksEmail",
          status: "sent",
          to: updatedDoctor.email,
          doctorId: resolvedDoctorId,
        });
      }
    }
  } catch (error) {
    logger.error("Payment success email send failed:", error);
    await logEmailEvent({
      type: "paymentThanksEmail",
      status: "failed",
      to: (updatedDoctor && updatedDoctor.email) || "",
      doctorId: resolvedDoctorId,
      error: String((error && error.message) || error),
    });
  }

  try {
    const templates = await getMessagingTemplates();
    const paymentSuccessSmsEnabled =
      templates.paymentSuccessTemplateEnabled !== false;
    const senderId = templates.smsSenderId || "";
    const phone = updatedDoctor.phone || updatedDoctor.phoneNumber || "";
    if (paymentSuccessSmsEnabled && senderId && phone) {
      const messageTemplate = String(
          templates.paymentSuccessTemplate ||
          "Hi {{doctorName}}, your payment was successful. " +
          "Thank you for using M-Prescribe.",
      );
      const message = renderTemplate(messageTemplate, {
        name: buildDoctorName(updatedDoctor),
        doctorName: buildDoctorName(updatedDoctor),
        doctorId: resolvedDoctorId,
        email: updatedDoctor.email || "",
        appUrl: templates.appUrl || DEFAULT_APP_URL,
      });
      const smsResult = await sendNotifySms({
        recipient: phone,
        senderId,
        message,
      });
      await logSmsEvent({
        type: "paymentSuccess",
        status: smsResult.ok ?
          (smsResult.skipped ? "skipped" : "sent") :
          "failed",
        to: normalizeNotifyRecipient(phone) || phone,
        doctorId: resolvedDoctorId,
        error: smsResult.ok ? "" : String(smsResult.error || ""),
      });
    }
  } catch (error) {
    logger.error("Payment success SMS send failed:", error);
    await logSmsEvent({
      type: "paymentSuccess",
      status: "failed",
      to: "",
      doctorId: resolvedDoctorId,
      error: String((error && error.message) || error),
    });
  }

  return updatedDoctor;
};

// Test-only hook for payment idempotency and notification coverage.
exports.__applyDoctorPaymentSuccessForTests = applyDoctorPaymentSuccess;

const logDoctorPaymentRecord = async ({
  doctorId = "",
  type = "",
  source = "",
  status = "",
  monthsDelta = 0,
  amount = 0,
  currency = "",
  referenceId = "",
  note = "",
  metadata = {},
}) => {
  const normalizedDoctorId = String(doctorId || "").trim();
  if (!normalizedDoctorId) return;
  try {
    await admin.firestore().collection("doctorPaymentRecords").add({
      doctorId: normalizedDoctorId,
      type: String(type || "unknown"),
      source: String(source || "system"),
      status: String(status || "recorded"),
      monthsDelta: Number(monthsDelta || 0),
      amount: Number(amount || 0),
      currency: String(currency || "").toUpperCase(),
      referenceId: String(referenceId || ""),
      note: String(note || ""),
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to store doctor payment record:", error);
  }
};

exports.sendDoctorWelcomeEmail = onDocumentCreated(
    {document: "doctors/{doctorId}", secrets: [SMTP_PASS]},
    async (event) => {
      const doctor = event.data && event.data.data ? event.data.data() : null;
      if (!doctor || !doctor.email) {
        logger.warn("Welcome email skipped: missing doctor email");
        return;
      }
      doctor.id = doctor.id || event.params.doctorId;
      if (doctor.welcomeEmailSentAt) {
        logger.info("Welcome email already sent for:", doctor.email);
        return;
      }

      const smtpConfig = await getSmtpConfig();
      const from = getFromAddress();

      if (
        !smtpConfig.host ||
        !smtpConfig.auth.user ||
        !smtpConfig.auth.pass ||
        !from
      ) {
        logger.error("SMTP config missing, cannot send welcome email.");
        return;
      }

      const transporter = nodemailer.createTransport(smtpConfig);
      const template = await getWelcomeTemplate();
      if (template && template.enabled === false) {
        logger.info("Welcome email disabled. Skipping:", doctor.email);
        return;
      }
      const appUrl = await getAppUrl();
      const {subject, text, html} = await buildWelcomeEmail(
          doctor,
          template || {},
          appUrl,
      );
      const fromEmail = (template && template.fromEmail) || from;
      const fromName = (template && template.fromName) || "";
      const replyTo = (template && template.replyTo) || undefined;
      const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

      try {
        await transporter.sendMail({
          from: fromAddress,
          to: doctor.email,
          subject,
          text,
          html,
          replyTo,
        });

        await admin.firestore()
            .collection("doctors")
            .doc(event.params.doctorId)
            .set({welcomeEmailSentAt: new Date().toISOString()}, {merge: true});

        logger.info("Welcome email sent to:", doctor.email);
        await logEmailEvent({
          type: "welcome",
          status: "sent",
          to: doctor.email,
          doctorId: doctor.id || event.params.doctorId,
        });
      } catch (error) {
        logger.error("Failed to send welcome email:", error);
        await logEmailEvent({
          type: "welcome",
          status: "failed",
          to: doctor.email,
          doctorId: doctor.id || event.params.doctorId,
          error: String((error && error.message) || error),
        });
      }
    },
);

exports.sendPatientWelcomeEmail = onDocumentCreated(
    {document: "patients/{patientId}", secrets: [SMTP_PASS]},
    async (event) => {
      const patient = event.data && event.data.data ? event.data.data() : null;
      if (!patient || !patient.email) {
        logger.warn("Patient welcome skipped: missing patient email");
        return;
      }
      patient.id = patient.id || event.params.patientId;
      if (patient.patientWelcomeEmailSentAt) {
        logger.info("Patient welcome already sent for:", patient.email);
        return;
      }

      const smtpConfig = await getSmtpConfig();
      const from = getFromAddress();
      if (
        !smtpConfig.host ||
        !smtpConfig.auth.user ||
        !smtpConfig.auth.pass ||
        !from
      ) {
        logger.error("SMTP config missing, cannot send patient welcome email.");
        return;
      }

      let doctorName = "";
      if (patient.doctorId) {
        try {
          const doctorDoc = await admin
              .firestore()
              .collection("doctors")
              .doc(patient.doctorId)
              .get();
          if (doctorDoc.exists) {
            const doctor = doctorDoc.data();
            doctorName =
              doctor.name ||
              [doctor.firstName, doctor.lastName].filter(Boolean).join(" ") ||
              doctor.email ||
              "";
          }
        } catch (error) {
          logger.error("Failed to load doctor for patient welcome:", error);
        }
      }

      const transporter = nodemailer.createTransport(smtpConfig);
      const template = await getPatientWelcomeTemplate();
      if (template && template.enabled === false) {
        logger.info("Patient welcome disabled. Skipping:", patient.email);
        return;
      }
      if (isNotificationsDisabled(patient)) {
        logger.info("Patient notifications disabled. Skipping:", patient.email);
        await logEmailEvent({
          type: "patient-welcome",
          status: "skipped",
          to: patient.email,
          doctorId: patient.doctorId || "",
          patientId: patient.id || event.params.patientId,
          error: "notifications-disabled",
        });
        return;
      }
      const appUrl = await getAppUrl();
      const {subject, text, html, attachments} =
        await buildPatientWelcomeEmail(
            patient,
            doctorName,
            template || {},
            appUrl,
        );
      const fromEmail = (template && template.fromEmail) || from;
      const fromName = (template && template.fromName) || "";
      const replyTo = (template && template.replyTo) || undefined;
      const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

      try {
        await transporter.sendMail({
          from: fromAddress,
          to: patient.email,
          subject,
          text,
          html,
          replyTo,
          attachments,
        });

        await admin.firestore()
            .collection("patients")
            .doc(event.params.patientId)
            .set(
                {patientWelcomeEmailSentAt: new Date().toISOString()},
                {merge: true},
            );

        logger.info("Patient welcome email sent to:", patient.email);
        await logEmailEvent({
          type: "patient-welcome",
          status: "sent",
          to: patient.email,
          doctorId: patient.doctorId || "",
          patientId: patient.id || event.params.patientId,
        });
      } catch (error) {
        logger.error("Failed to send patient welcome email:", error);
        await logEmailEvent({
          type: "patient-welcome",
          status: "failed",
          to: patient.email,
          doctorId: patient.doctorId || "",
          patientId: patient.id || event.params.patientId,
          error: String((error && error.message) || error),
        });
      }
    },
);

exports.sendPatientRegistrationSms = onDocumentCreated(
    {
      document: "patients/{patientId}",
      secrets: [NOTIFY_USER_ID, NOTIFY_API_KEY],
    },
    async (event) => {
      const patient = event.data && event.data.data ? event.data.data() : null;
      if (!patient) return;
      patient.id = patient.id || event.params.patientId;

      const templates = await getMessagingTemplates();
      let doctor = null;
      if (patient.doctorId) {
        try {
          const doctorDoc = await admin
              .firestore()
              .collection("doctors")
              .doc(patient.doctorId)
              .get();
          if (doctorDoc.exists) {
            doctor = doctorDoc.data();
          }
        } catch (error) {
          logger.error("Failed to load doctor for patient SMS:", error);
        }
      }

      const payload = buildPatientRegistrationSmsPayload({
        patient,
        doctor,
        templates,
        appUrl: templates.appUrl || DEFAULT_APP_URL,
      });

      if (!payload.ok) {
        logger.info("Patient registration SMS skipped:", payload.reason);
        return;
      }

      const result = await sendNotifySms({
        recipient: payload.recipient,
        senderId: payload.senderId,
        message: payload.message,
      });
      if (!result.ok) {
        logger.warn("Patient registration SMS failed:", result.error);
        return;
      }

      await admin.firestore()
          .collection("patients")
          .doc(event.params.patientId)
          .set(
              {patientRegistrationSmsSentAt: new Date().toISOString()},
              {merge: true},
          );
    },
);

exports.sendDoctorBroadcastEmail = onRequest(
    {secrets: [SMTP_PASS]},
    async (req, res) => {
      setCors(req, res);
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const adminUser = await getAuthorizedAdmin(req);
      if (!adminUser) {
        res.status(401).send("Unauthorized");
        return;
      }

      const {mode} = req.body || {};
      if (!mode || !["test", "all"].includes(mode)) {
        res.status(400).send("Invalid mode");
        return;
      }

      const smtpConfig = await getSmtpConfig();
      const from = getFromAddress();
      if (
        !smtpConfig.host ||
    !smtpConfig.auth.user ||
    !smtpConfig.auth.pass ||
    !from
      ) {
        res.status(500).send("SMTP config missing");
        return;
      }

      const template = await getDoctorBroadcastTemplate();
      const appUrl = await getAppUrl();
      const transporter = nodemailer.createTransport(smtpConfig);

      const sendOne = async (doctor) => {
        const {subject, text, html} = await buildWelcomeEmail(
            doctor,
            template || {},
            appUrl,
        );
        const fromEmail = (template && template.fromEmail) || from;
        const fromName = (template && template.fromName) || "";
        const replyTo = (template && template.replyTo) || undefined;
        const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

        try {
          await transporter.sendMail({
            from: fromAddress,
            to: doctor.email,
            subject,
            text,
            html,
            replyTo,
          });
          await logEmailEvent({
            type: "broadcast",
            status: "sent",
            to: doctor.email,
            doctorId: doctor.id || doctor.doctorId || doctor.uid || "",
          });
        } catch (error) {
          await logEmailEvent({
            type: "broadcast",
            status: "failed",
            to: doctor.email,
            doctorId: doctor.id || doctor.doctorId || doctor.uid || "",
            error: String((error && error.message) || error),
          });
          throw error;
        }
      };

      try {
        if (mode === "test") {
          await sendOne({
            email: getAdminEmail(),
            name: "Doctor",
            firstName: "Doctor",
            lastName: "",
            id: "admin-test",
          });
          res.json({success: true, sent: 1, mode});
          return;
        }

        const snapshot = await admin.firestore().collection("doctors").get();
        let sent = 0;
        for (const doc of snapshot.docs) {
          const doctor = doc.data() || {};
          doctor.id = doctor.id || doc.id;
          if (!doctor.email) continue;
          await sendOne(doctor);
          sent += 1;
        }
        res.json({success: true, sent, mode});
      } catch (error) {
        logger.error("Failed to send broadcast email:", error);
        const message = String((error && error.message) || "");
        const isAuthError =
      (error && error.code) === "EAUTH" ||
      /auth|login|credentials|password/i.test(message);
        if (isAuthError) {
          res.status(500).send(
              "SMTP authentication failed. Check SMTP_USER/SMTP_PASS.",
          );
        } else {
          res.status(500).send("Failed to send email");
        }
      }
    });

exports.sendDoctorTemplateEmail = onRequest(
    {secrets: [SMTP_PASS]},
    async (req, res) => {
      setCors(req, res);
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const adminUser = await getAuthorizedAdmin(req);
      if (!adminUser) {
        res.status(401).send("Unauthorized");
        return;
      }

      const {templateId, doctorId, doctorEmail, templateData} = req.body || {};
      if (!templateId || (!doctorId && !doctorEmail)) {
        res.status(400).send("Missing templateId or doctor target");
        return;
      }

      const smtpConfig = await getSmtpConfig();
      const from = getFromAddress();
      if (
        !smtpConfig.host ||
          !smtpConfig.auth.user ||
          !smtpConfig.auth.pass ||
          !from
      ) {
        res.status(500).send("SMTP config missing");
        return;
      }

      let targetDoctor = null;
      try {
        let template = null;
        if (
          templateData &&
          (templateData.subject ||
            templateData.text ||
            templateData.html ||
            templateData.fromName ||
            templateData.fromEmail ||
            templateData.replyTo)
        ) {
          template = templateData;
        } else {
          const templateDoc = await admin
              .firestore()
              .collection("systemSettings")
              .doc(templateId)
              .get();
          template = templateDoc.exists ? templateDoc.data() : null;
        }
        if (template && template.enabled === false) {
          res.status(403).send("Template disabled");
          return;
        }
        if (template && template.enabled === false) {
          res.status(403).send("Template disabled");
          return;
        }

        let doctor = null;
        if (doctorId) {
          const doctorDoc = await admin
              .firestore()
              .collection("doctors")
              .doc(doctorId)
              .get();
          if (doctorDoc.exists) {
            doctor = doctorDoc.data();
            doctor.id = doctorId;
          }
        }
        if (!doctor && doctorEmail) {
          const snapshot = await admin
              .firestore()
              .collection("doctors")
              .where("email", "==", doctorEmail)
              .limit(1)
              .get();
          if (!snapshot.empty) {
            doctor = snapshot.docs[0].data();
            doctor.id = snapshot.docs[0].id;
          }
        }

        if (!doctor || !doctor.email) {
          res.status(404).send("Doctor not found");
          return;
        }
        targetDoctor = doctor;

        const transporter = nodemailer.createTransport(smtpConfig);
        const appUrl = await getAppUrl();
        const {subject, text, html} = await buildWelcomeEmail(
            doctor,
            template || {},
            appUrl,
        );
        const fromEmail = (template && template.fromEmail) || from;
        const fromName = (template && template.fromName) || "";
        const replyTo = (template && template.replyTo) || undefined;
        const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

        await transporter.sendMail({
          from: fromAddress,
          to: doctor.email,
          subject,
          text,
          html,
          replyTo,
        });

        await logEmailEvent({
          type: templateId,
          status: "sent",
          to: targetDoctor.email,
          doctorId: targetDoctor.id || doctorId || "",
        });

        res.json({success: true});
      } catch (error) {
        logger.error("Failed to send template email:", error);
        await logEmailEvent({
          type: templateId || "template",
          status: "failed",
          to: (targetDoctor && targetDoctor.email) || doctorEmail || "",
          doctorId:
              targetDoctor && targetDoctor.id ?
                targetDoctor.id :
                doctorId || "",
          error: String((error && error.message) || error),
        });
        const message = String((error && error.message) || "");
        const isAuthError =
      (error && error.code) === "EAUTH" ||
      /auth|login|credentials|password/i.test(message);
        if (isAuthError) {
          res.status(500).send(
              "SMTP authentication failed. Check SMTP_USER/SMTP_PASS.",
          );
        } else {
          res.status(500).send("Failed to send email");
        }
      }
    });

exports.sendPatientTemplateEmail = onRequest(
    {secrets: [SMTP_PASS]},
    async (req, res) => {
      setCors(req, res);
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const adminUser = await getAuthorizedAdmin(req);
      if (!adminUser) {
        res.status(401).send("Unauthorized");
        return;
      }

      const {
        templateId,
        patientId,
        patientEmail,
        templateData,
        patientData,
        doctorName,
      } = req.body || {};
      if (!templateId || (!patientId && !patientEmail && !patientData)) {
        res.status(400).send("Missing templateId or patient target");
        return;
      }

      const smtpConfig = await getSmtpConfig();
      const from = getFromAddress();
      if (
        !smtpConfig.host ||
        !smtpConfig.auth.user ||
        !smtpConfig.auth.pass ||
        !from
      ) {
        res.status(500).send("SMTP config missing");
        return;
      }

      try {
        let template = null;
        if (
          templateData &&
          (templateData.subject ||
            templateData.text ||
            templateData.html ||
            templateData.fromName ||
            templateData.fromEmail ||
            templateData.replyTo)
        ) {
          template = templateData;
        } else {
          const templateDoc = await admin
              .firestore()
              .collection("systemSettings")
              .doc(templateId)
              .get();
          template = templateDoc.exists ? templateDoc.data() : null;
        }
        if (template && template.enabled === false) {
          res.status(403).send("Template disabled");
          return;
        }

        let patient = patientData || null;
        if (!patient && patientId) {
          const patientDoc = await admin
              .firestore()
              .collection("patients")
              .doc(patientId)
              .get();
          if (patientDoc.exists) {
            patient = patientDoc.data();
            patient.id = patientId;
          }
        }
        if (!patient && patientEmail) {
          const snapshot = await admin
              .firestore()
              .collection("patients")
              .where("email", "==", patientEmail)
              .limit(1)
              .get();
          if (!snapshot.empty) {
            patient = snapshot.docs[0].data();
            patient.id = snapshot.docs[0].id;
          }
        }
        if (!patient) {
          patient = {
            id: patientId || "test-patient",
            email: patientEmail || getAdminEmail(),
            firstName: "Test",
            lastName: "Patient",
          };
        }
        if (isNotificationsDisabled(patient)) {
          await logEmailEvent({
            type: templateId,
            status: "skipped",
            to: patient.email || "",
            doctorId: patient.doctorId || "",
            patientId: patient.id || "",
            error: "notifications-disabled",
          });
          res.status(200).send("Notifications disabled");
          return;
        }
        if (!patient.email) {
          res.status(400).send("Patient email missing");
          return;
        }

        let resolvedDoctorName = doctorName || "";
        if (!resolvedDoctorName && patient.doctorId) {
          try {
            const doctorDoc = await admin
                .firestore()
                .collection("doctors")
                .doc(patient.doctorId)
                .get();
            if (doctorDoc.exists) {
              const doctor = doctorDoc.data();
              resolvedDoctorName =
                doctor.name ||
                [doctor.firstName, doctor.lastName]
                    .filter(Boolean)
                    .join(" ") ||
                doctor.email ||
                "";
            }
          } catch (error) {
            logger.error("Failed to load doctor for patient email:", error);
          }
        }

        const transporter = nodemailer.createTransport(smtpConfig);
        const appUrl = await getAppUrl();
        const {subject, text, html, attachments} =
          await buildPatientWelcomeEmail(
              patient,
              resolvedDoctorName,
              template || {},
              appUrl,
          );
        const fromEmail = (template && template.fromEmail) || from;
        const fromName = (template && template.fromName) || "";
        const replyTo = (template && template.replyTo) || undefined;
        const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

        await transporter.sendMail({
          from: fromAddress,
          to: patient.email,
          subject,
          text,
          html,
          replyTo,
          attachments,
        });

        await logEmailEvent({
          type: templateId,
          status: "sent",
          to: patient.email,
          doctorId: patient.doctorId || "",
          patientId: patient.id || "",
        });

        res.status(200).send("Sent");
      } catch (error) {
        logger.error("Failed to send patient template email:", error);
        await logEmailEvent({
          type: templateId || "patient-template",
          status: "failed",
          to: patientEmail || "",
          error: String((error && error.message) || error),
        });
        res.status(500).send("Failed to send email");
      }
    },
);

exports.sendAppointmentReminderTemplateEmail = onRequest(
    {secrets: [SMTP_PASS]},
    async (req, res) => {
      setCors(req, res);
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const adminUser = await getAuthorizedAdmin(req);
      if (!adminUser) {
        res.status(401).send("Unauthorized");
        return;
      }

      const {
        templateId,
        patientEmail,
        templateData,
        patientData,
        doctorName,
        appointmentDate,
      } = req.body || {};
      if (!templateId || !patientEmail) {
        res.status(400).send("Missing templateId or patient email");
        return;
      }

      const smtpConfig = await getSmtpConfig();
      const from = getFromAddress();
      if (
        !smtpConfig.host ||
        !smtpConfig.auth.user ||
        !smtpConfig.auth.pass ||
        !from
      ) {
        res.status(500).send("SMTP config missing");
        return;
      }

      try {
        let template = null;
        if (
          templateData &&
          (templateData.subject ||
            templateData.text ||
            templateData.html ||
            templateData.fromName ||
            templateData.fromEmail ||
            templateData.replyTo)
        ) {
          template = templateData;
        } else {
          const templateDoc = await admin
              .firestore()
              .collection("systemSettings")
              .doc(templateId)
              .get();
          template = templateDoc.exists ? templateDoc.data() : null;
        }

        const patient =
          patientData ||
          {firstName: "Test", lastName: "Patient", email: patientEmail};
        if (isNotificationsDisabled(patient)) {
          await logEmailEvent({
            type: templateId,
            status: "skipped",
            to: patientEmail,
            error: "notifications-disabled",
          });
          res.status(200).send("Notifications disabled");
          return;
        }
        const reminderDate = appointmentDate || "2026-01-01";
        const reminderDoctorName = doctorName || "Dr. Test";

        const transporter = nodemailer.createTransport(smtpConfig);
        const appUrl = await getAppUrl();
        const {subject, text, html} = await buildAppointmentReminderEmail(
            patient,
            reminderDoctorName,
            reminderDate,
            template || {},
            appUrl,
        );
        const fromEmail = (template && template.fromEmail) || from;
        const fromName = (template && template.fromName) || "";
        const replyTo = (template && template.replyTo) || undefined;
        const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

        await transporter.sendMail({
          from: fromAddress,
          to: patientEmail,
          subject,
          text,
          html,
          replyTo,
        });

        await logEmailEvent({
          type: templateId,
          status: "sent",
          to: patientEmail,
        });

        res.status(200).send("Sent");
      } catch (error) {
        logger.error("Failed to send appointment reminder template:", error);
        res.status(500).send("Failed to send email");
      }
    },
);

exports.sendAppointmentReminders = onSchedule(
    "every 1 hours",
    async () => {
      const smtpConfig = await getSmtpConfig();
      const from = getFromAddress();
      if (
        !smtpConfig.host ||
        !smtpConfig.auth.user ||
        !smtpConfig.auth.pass ||
        !from
      ) {
        logger.error("SMTP config missing, appointment reminders skipped.");
        return;
      }

      const template = await getAppointmentReminderTemplate();
      if (template && template.enabled === false) {
        logger.info("Appointment reminders disabled. Skipping run.");
        return;
      }
      const appUrl = await getAppUrl();
      const transporter = nodemailer.createTransport(smtpConfig);
      const doctorsSnapshot = await admin
          .firestore()
          .collection("doctors")
          .get();
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const sentKeys = new Set();

      for (const doc of doctorsSnapshot.docs) {
        const doctor = doc.data() || {};
        const doctorId = doc.id;
        const countryName = doctor.country || doctor.countryName || "";
        const timeZone =
          doctor.timeZone ||
          doctor.timezone ||
          countryTimeZoneMap[countryName] ||
          "UTC";
        const reminderDate = formatDateInTimeZone(tomorrow, timeZone);

        const prescriptionsSnapshot = await admin
            .firestore()
            .collection("medications")
            .where("doctorId", "==", doctorId)
            .get();

        for (const prescriptionDoc of prescriptionsSnapshot.docs) {
          const prescription = prescriptionDoc.data() || {};
          if (!prescription.nextAppointmentDate) continue;
          if (prescription.nextAppointmentDate !== reminderDate) continue;
          if (prescription.nextAppointmentReminderDate === reminderDate) {
            continue;
          }
          if (!prescription.patientId) continue;

          const dedupeKey = `${prescription.patientId}:${reminderDate}`;
          if (sentKeys.has(dedupeKey)) continue;

          let patient = null;
          try {
            const patientDoc = await admin
                .firestore()
                .collection("patients")
                .doc(prescription.patientId)
                .get();
            if (patientDoc.exists) {
              patient = patientDoc.data();
              patient.id = patientDoc.id;
            }
          } catch (error) {
            logger.error("Failed to load patient for reminder:", error);
          }
          if (!patient || !patient.email) continue;
          if (isNotificationsDisabled(patient)) {
            await logEmailEvent({
              type: "appointment-reminder",
              status: "skipped",
              to: patient.email || "",
              doctorId: doctorId,
              patientId: patient.id || prescription.patientId,
              error: "notifications-disabled",
            });
            continue;
          }

          const doctorName =
            doctor.name ||
            [doctor.firstName, doctor.lastName].filter(Boolean).join(" ") ||
            doctor.email ||
            "";

          const {subject, text, html} = await buildAppointmentReminderEmail(
              patient,
              doctorName,
              reminderDate,
              template || {},
              appUrl,
          );
          const fromEmail = (template && template.fromEmail) || from;
          const fromName = (template && template.fromName) || "";
          const replyTo = (template && template.replyTo) || undefined;
          const fromAddress =
            fromName ? `${fromName} <${fromEmail}>` : fromEmail;

          try {
            await transporter.sendMail({
              from: fromAddress,
              to: patient.email,
              subject,
              text,
              html,
              replyTo,
            });
            await prescriptionDoc.ref.set(
                {
                  nextAppointmentReminderSentAt: new Date().toISOString(),
                  nextAppointmentReminderDate: reminderDate,
                },
                {merge: true},
            );
            sentKeys.add(dedupeKey);
            await logEmailEvent({
              type: "appointment-reminder",
              status: "sent",
              to: patient.email,
              doctorId: doctorId,
              patientId: patient.id || prescription.patientId,
            });
          } catch (error) {
            logger.error("Failed to send appointment reminder:", error);
            await logEmailEvent({
              type: "appointment-reminder",
              status: "failed",
              to: patient.email,
              doctorId: doctorId,
              patientId: patient.id || prescription.patientId,
              error: String((error && error.message) || error),
            });
          }
        }
      }
    },
);

exports.unsubscribeEmail = onRequest(async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const params = req.method === "POST" ? req.body || {} : req.query || {};
  const patientId = String(params.patientId || "").trim();
  const email = String(params.email || "").trim().toLowerCase();

  if (!patientId || !email) {
    res.status(400).send("Missing patientId or email");
    return;
  }

  try {
    const patientRef = admin.firestore().collection("patients").doc(patientId);
    const patientDoc = await patientRef.get();
    if (!patientDoc.exists) {
      res.status(404).send("Patient not found");
      return;
    }
    const patient = patientDoc.data() || {};
    const patientEmail = String(patient.email || "").trim().toLowerCase();
    if (!patientEmail || patientEmail !== email) {
      res.status(403).send("Email mismatch");
      return;
    }

    await patientRef.set(
        {
          disableNotifications: true,
          updatedAt: new Date().toISOString(),
        },
        {merge: true},
    );

    res
        .status(200)
        .set("Content-Type", "text/html")
        .send(`
          <html>
            <body style="font-family: Arial, sans-serif; padding: 24px;">
              <h2>You are unsubscribed</h2>
              <p>Email notifications for this patient have been disabled.</p>
            </body>
          </html>
        `);
  } catch (error) {
    logger.error("Failed to unsubscribe:", error);
    res.status(500).send("Failed to unsubscribe");
  }
});

exports.openaiProxy = onRequest(
    {secrets: [OPENAI_API_KEY]},
    async (req, res) => {
      setCors(req, res);
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const user = await getAuthorizedUser(req);
      if (!user) {
        res.status(401).send("Unauthorized");
        return;
      }

      const {endpoint, requestBody} = req.body || {};
      const bodySize = Buffer.byteLength(
          JSON.stringify(req.body || {}),
          "utf8",
      );
      if (bodySize > OPENAI_PROXY_MAX_BODY_BYTES) {
        res.status(413).send("Payload too large");
        return;
      }
      if (!endpoint || typeof endpoint !== "string") {
        res.status(400).send("Invalid endpoint");
        return;
      }

      const sanitizedEndpoint = endpoint.replace(/^\/+/, "");
      if (sanitizedEndpoint.includes("://")) {
        res.status(400).send("Invalid endpoint");
        return;
      }
      if (!OPENAI_PROXY_ALLOWED_ENDPOINTS.has(sanitizedEndpoint)) {
        res.status(403).send("Endpoint not allowed");
        return;
      }
      if (
        requestBody &&
        typeof requestBody.max_tokens === "number" &&
        requestBody.max_tokens > 4000
      ) {
        res.status(400).send("max_tokens too large");
        return;
      }

      const now = Date.now();
      cleanupExpiredInMemoryGuards(now);
      const rateKey = user.uid || user.email || "unknown";
      const existing = openaiProxyRateLimits.get(rateKey);
      if (
        !existing ||
        now - existing.windowStart >= OPENAI_PROXY_RATE_LIMIT_WINDOW_MS
      ) {
        openaiProxyRateLimits.set(rateKey, {windowStart: now, count: 1});
      } else {
        existing.count += 1;
        openaiProxyRateLimits.set(rateKey, existing);
        if (existing.count > OPENAI_PROXY_RATE_LIMIT_MAX_REQUESTS) {
          res.status(429).send("Rate limit exceeded");
          return;
        }
      }

      const apiKey = OPENAI_API_KEY.value();
      if (!apiKey) {
        res.status(500).send("OpenAI API key not configured");
        return;
      }

      try {
        const response = await fetch(
            `https://api.openai.com/v1/${sanitizedEndpoint}`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(requestBody || {}),
            },
        );

        const text = await response.text();
        res
            .status(response.status)
            .set(
                "Content-Type",
                response.headers.get("content-type") || "application/json",
            )
            .send(text);
      } catch (error) {
        logger.error("OpenAI proxy failed:", error);
        res.status(500).send("OpenAI proxy failed");
      }
    });

exports.testSmtp = onRequest(
    {secrets: [SMTP_PASS]},
    async (req, res) => {
      setCors(req, res);
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const adminUser = await getAuthorizedAdmin(req);
      if (!adminUser) {
        res.status(401).send("Unauthorized");
        return;
      }

      const smtpConfig = await getSmtpConfig();
      const from = getFromAddress();
      if (
        !smtpConfig.host ||
    !smtpConfig.auth.user ||
    !smtpConfig.auth.pass ||
    !from
      ) {
        res.status(500).send("SMTP config missing");
        return;
      }

      try {
        const transporter = nodemailer.createTransport(smtpConfig);
        await transporter.sendMail({
          from: from,
          to: getAdminEmail(),
          subject: "SMTP Test - Prescribe",
          text: "This is a test email to confirm SMTP configuration.",
        });
        await logEmailEvent({
          type: "smtp-test",
          status: "sent",
          to: getAdminEmail(),
          doctorId: "",
        });
        res.json({success: true});
      } catch (error) {
        logger.error("SMTP test failed:", error);
        await logEmailEvent({
          type: "smtp-test",
          status: "failed",
          to: getAdminEmail(),
          doctorId: "",
          error: String((error && error.message) || error),
        });
        const message = String((error && error.message) || "");
        const isAuthError =
      (error && error.code) === "EAUTH" ||
      /auth|login|credentials|password/i.test(message);
        if (isAuthError) {
          res.status(500).send(
              "SMTP authentication failed. Check SMTP_USER/SMTP_PASS.",
          );
        } else {
          res.status(500).send("SMTP test failed");
        }
      }
    });

exports.sendWelcomeWhatsapp = onRequest(
    {
      secrets: [
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN,
        TWILIO_WHATSAPP_FROM,
      ],
    },
    async (req, res) => {
      setCors(req, res);
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const adminUser = await getAuthorizedAdmin(req);
      if (!adminUser) {
        res.status(401).send("Unauthorized");
        return;
      }

      const {to, body} = req.body || {};
      let from = TWILIO_WHATSAPP_FROM.value();
      const accountSid = TWILIO_ACCOUNT_SID.value();
      const authToken = TWILIO_AUTH_TOKEN.value();

      if (!accountSid || !authToken || !from) {
        res.status(500).send("Twilio configuration missing");
        return;
      }

      if (!to || typeof to !== "string") {
        res.status(400).send("Recipient is required");
        return;
      }

      const messageBody = body || "Welcome to M-Prescribe!";
      if (from && !String(from).startsWith("whatsapp:")) {
        from = `whatsapp:${from}`;
      }
      let formattedTo = String(to);
      if (!formattedTo.startsWith("whatsapp:")) {
        formattedTo = `whatsapp:${formattedTo}`;
      }

      try {
        const client = twilio(accountSid, authToken);
        const message = await client.messages.create({
          body: messageBody,
          from: from,
          to: formattedTo,
        });
        res.json({success: true, sid: message.sid});
      } catch (error) {
        logger.error("Twilio WhatsApp send failed:", error);
        const message = String(
            (error && error.message) || "Failed to send WhatsApp message",
        );
        res.status(500).send(message);
      }
    },
);

exports.sendSmsApi = onRequest(
    {
      secrets: [NOTIFY_USER_ID, NOTIFY_API_KEY],
    },
    async (req, res) => {
      setCors(req, res);
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const adminUser = await getAuthorizedAdmin(req);
      if (!adminUser) {
        res.status(401).send("Unauthorized");
        return;
      }

      const userId = NOTIFY_USER_ID.value();
      const apiKey = NOTIFY_API_KEY.value();
      if (!userId || !apiKey) {
        res.status(500).send("Notify.lk configuration missing");
        return;
      }

      const {recipient, senderId, type, message} = req.body || {};
      if (!recipient || typeof recipient !== "string") {
        res.status(400).send("Recipient is required");
        return;
      }
      if (!senderId || typeof senderId !== "string") {
        res.status(400).send("Sender ID is required");
        return;
      }
      if (!message || typeof message !== "string") {
        res.status(400).send("Message is required");
        return;
      }

      const normalizeNotifyRecipient = (input) => {
        const digits = String(input || "").replace(/\D/g, "");
        if (!digits) return "";
        if (digits.length === 11) return digits;
        if (digits.startsWith("0") && digits.length === 10) {
          return `94${digits.slice(1)}`;
        }
        return digits;
      };

      const formattedRecipient = normalizeNotifyRecipient(recipient);
      if (!/^\d{11}$/.test(formattedRecipient)) {
        res.status(400).send(
            "Recipient format invalid. Use an 11-digit number or 07XXXXXXXX.",
        );
        return;
      }

      const payload = new URLSearchParams({
        user_id: String(userId),
        api_key: String(apiKey),
        sender_id: String(senderId),
        to: formattedRecipient,
        message: String(message),
      });
      if (String(type || "").toLowerCase() === "unicode") {
        payload.set("type", "unicode");
      }

      try {
        const response = await fetch(
            "https://app.notify.lk/api/v1/send",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
              },
              body: payload.toString(),
            },
        );

        const raw = await response.text();
        let data = null;
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch (error) {
            data = {raw};
          }
        }

        if (!response.ok) {
          const errorMessage =
            (data && data.message) ||
            raw ||
            "Failed to send SMS";
          res.status(500).send(String(errorMessage));
          return;
        }

        res.json({success: true, response: data});
      } catch (error) {
        logger.error("SMS API send failed:", error);
        const message = String(
            (error && error.message) || "Failed to send SMS",
        );
        res.status(500).send(message);
      }
    },
);

exports.createStripeCheckoutSession = onRequest(
    {
      secrets: [STRIPE_SECRET_KEY],
    },
    async (req, res) => {
      setCors(req, res);
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const currentUser = await getAuthorizedUser(req);
      if (!currentUser) {
        res.status(401).send("Unauthorized");
        return;
      }

      const secretKey = STRIPE_SECRET_KEY.value();
      if (!secretKey) {
        res.status(500).json({
          success: false,
          error: "Stripe secret key is not configured.",
        });
        return;
      }

      const {
        planId,
        doctorId,
        email,
        successUrl,
        cancelUrl,
        promoCode,
        previewOnly,
      } = req.body || {};
      const normalizedPlanId = String(planId || "");
      const baseSelectedPlan = STRIPE_PLAN_CATALOG[normalizedPlanId];

      if (!baseSelectedPlan) {
        res.status(400).json({
          success: false,
          error: "Invalid plan selected.",
        });
        return;
      }

      const safeSuccessUrl = getSafeStripeReturnUrl(successUrl);
      const safeCancelUrl = getSafeStripeReturnUrl(cancelUrl);
      const checkoutSuccessUrl =
        `${safeSuccessUrl}${safeSuccessUrl.includes("?") ? "&" : "?"}` +
        "checkout=success&session_id={CHECKOUT_SESSION_ID}";
      const checkoutCancelUrl =
        `${safeCancelUrl}${safeCancelUrl.includes("?") ? "&" : "?"}` +
        "checkout=cancel";

      try {
        const resolvedDoctorId = await resolveDoctorIdForStripe({
          doctorId: String(doctorId || ""),
          metadataDoctorId: String(doctorId || ""),
          userEmail: String(currentUser.email || email || ""),
          customerId: "",
          userUid: String(currentUser.uid || ""),
          metadataUserUid: String(currentUser.uid || ""),
        });
        let adminDiscountPercent = 0;
        let doctorData = {};
        if (resolvedDoctorId) {
          const doctorSnap = await admin.firestore()
              .collection("doctors")
              .doc(resolvedDoctorId)
              .get();
          doctorData = doctorSnap.exists ? doctorSnap.data() : {};
          const adminDiscountRaw = doctorData ?
            Math.max(
                Number(doctorData.adminStripeDiscountPercent || 0),
                Number(doctorData.adminDiscountPercent || 0),
                Number(doctorData.individualStripeDiscountPercent || 0),
                Number(doctorData.individualDiscountPercent || 0),
            ) :
            0;
          adminDiscountPercent = Math.max(
              0,
              Math.min(
                  100,
                  Number(adminDiscountRaw || 0),
              ),
          );
        }

        const pricingConfig = await resolveStripePricingConfig();
        const selectedPlanCatalog = resolvePlanCatalogForCheckout({
          pricingConfig,
          isNewCustomer: !hasDoctorPriorPaymentHistory(doctorData),
        });
        const selectedPlan = selectedPlanCatalog[normalizedPlanId] ||
          baseSelectedPlan;

        const originalUnitAmount = Number(selectedPlan.unitAmount || 0);
        const adminDiscountAmount = Math.round(
            originalUnitAmount * (adminDiscountPercent / 100),
        );
        const amountAfterAdminDiscount = Math.max(
            50,
            originalUnitAmount - adminDiscountAmount,
        );
        const promoResolution = await resolvePromoForCheckout({
          promoCode,
          selectedPlan: {
            ...selectedPlan,
            planId: String(planId || ""),
          },
          baseUnitAmount: originalUnitAmount,
        });
        const promoFinalUnitAmount = Number(
            promoResolution.finalUnitAmount || originalUnitAmount,
        );
        const promoDiscountAmount = Math.max(
            0,
            originalUnitAmount - promoFinalUnitAmount,
        );
        const hasPromoDiscount = Boolean(promoResolution.promo) &&
          promoFinalUnitAmount < amountAfterAdminDiscount;
        const appliedDiscountSource = hasPromoDiscount ?
          "promo" :
          (adminDiscountPercent > 0 ? "individual" : "none");
        const finalUnitAmount = hasPromoDiscount ?
          promoFinalUnitAmount :
          amountAfterAdminDiscount;
        const appliedPromo = hasPromoDiscount ? promoResolution.promo : null;
        const totalDiscountAmount = Math.max(
            0,
            originalUnitAmount - finalUnitAmount,
        );
        const isPreviewOnly = previewOnly === true;
        if (isPreviewOnly) {
          res.json({
            success: true,
            previewOnly: true,
            promoApplied: hasPromoDiscount,
            promoValidated: Boolean(promoResolution.promo),
            appliedDiscountSource,
            promoCode: String(
                (appliedPromo && appliedPromo.code) || "",
            ),
            originalAmount: originalUnitAmount,
            discountedAmount: finalUnitAmount,
            discountAmount: totalDiscountAmount,
            adminDiscountPercent: Number(adminDiscountPercent || 0),
            adminDiscountAmount: Number(
                appliedDiscountSource === "individual" ?
                  adminDiscountAmount :
                  0,
            ),
          });
          return;
        }
        const stripe = new Stripe(secretKey, {
          apiVersion: "2025-01-27.acacia",
        });

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          success_url: checkoutSuccessUrl,
          cancel_url: checkoutCancelUrl,
          client_reference_id: currentUser.uid || undefined,
          customer_email: currentUser.email || email || undefined,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: selectedPlan.currency,
                unit_amount: finalUnitAmount,
                recurring: {
                  interval: selectedPlan.interval,
                },
                product_data: {
                  name: selectedPlan.name,
                  description:
                    "M-Prescribe subscription for clinic operations",
                },
              },
            },
          ],
          metadata: {
            planId: String(planId || ""),
            doctorId: String(resolvedDoctorId || doctorId || ""),
            userUid: String(currentUser.uid || ""),
            userEmail: String(currentUser.email || email || ""),
            promoCode: String(
                (appliedPromo && appliedPromo.code) || "",
            ),
            promoCodeId: String(
                (appliedPromo && appliedPromo.id) || "",
            ),
            adminDiscountPercent: String(adminDiscountPercent),
            adminDiscountAmountMinor: String(
                appliedDiscountSource === "individual" ?
                  adminDiscountAmount :
                  0,
            ),
            appliedDiscountSource,
          },
          allow_promotion_codes: true,
        });

        await admin.firestore().collection("stripeCheckoutLogs").add({
          sessionId: session.id,
          checkoutUrl: session.url || "",
          userUid: currentUser.uid || null,
          userEmail: currentUser.email || email || null,
          doctorId: resolvedDoctorId || doctorId || null,
          planId: String(planId || ""),
          amount: finalUnitAmount,
          originalAmount: originalUnitAmount,
          discountAmount: totalDiscountAmount,
          appliedDiscountSource,
          adminDiscountPercent: Number(adminDiscountPercent || 0),
          adminDiscountAmount: Number(
              appliedDiscountSource === "individual" ?
                adminDiscountAmount :
                0,
          ),
          promoDiscountAmount: Number(
              appliedDiscountSource === "promo" ?
                promoDiscountAmount :
                0,
          ),
          currency: selectedPlan.currency,
          interval: selectedPlan.interval,
          promoCode: String(
              (appliedPromo && appliedPromo.code) || "",
          ),
          promoCodeId: String(
              (appliedPromo && appliedPromo.id) || "",
          ),
          status: "created",
          createdAt: new Date().toISOString(),
        });

        res.json({
          success: true,
          sessionId: session.id,
          url: session.url,
          promoApplied: hasPromoDiscount,
          promoValidated: Boolean(promoResolution.promo),
          appliedDiscountSource,
          promoCode: String(
              (appliedPromo && appliedPromo.code) || "",
          ),
          originalAmount: originalUnitAmount,
          discountedAmount: finalUnitAmount,
          discountAmount: totalDiscountAmount,
          adminDiscountPercent: Number(adminDiscountPercent || 0),
          adminDiscountAmount: Number(
              appliedDiscountSource === "individual" ?
                adminDiscountAmount :
                0,
          ),
        });
      } catch (error) {
        logger.error("Failed to create Stripe checkout session:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Failed to start Stripe checkout.",
        });
      }
    },
);

exports.confirmStripeCheckoutSuccess = onRequest(
    {
      secrets: [STRIPE_SECRET_KEY],
    },
    async (req, res) => {
      setCors(req, res);
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const currentUser = await getAuthorizedUser(req);
      if (!currentUser) {
        res.status(401).send("Unauthorized");
        return;
      }

      const secretKey = STRIPE_SECRET_KEY.value();
      if (!secretKey) {
        res.status(500).json({
          success: false,
          error: "Stripe secret key is not configured.",
        });
        return;
      }

      const {sessionId, doctorId} = req.body || {};
      const parsedSessionId = String(sessionId || "").trim();
      if (!parsedSessionId) {
        res.status(400).json({
          success: false,
          error: "sessionId is required.",
        });
        return;
      }

      try {
        const stripe = new Stripe(secretKey, {
          apiVersion: "2025-01-27.acacia",
        });

        const session = await stripe.checkout.sessions
            .retrieve(parsedSessionId);
        const sessionEmail = String(session.customer_email || "").toLowerCase();
        const userEmail = String(currentUser.email || "").toLowerCase();
        if (sessionEmail && userEmail && sessionEmail !== userEmail) {
          res.status(403).json({
            success: false,
            error: "Session does not belong to current user.",
          });
          return;
        }

        if (session.status !== "complete") {
          res.status(409).json({
            success: false,
            error: "Checkout is not completed yet.",
          });
          return;
        }

        const planId = String(
            (session.metadata && session.metadata.planId) || "",
        );
        const selectedPlan = STRIPE_PLAN_CATALOG[planId];
        const interval = selectedPlan ? selectedPlan.interval : "month";

        const resolvedDoctorId = await resolveDoctorIdForStripe({
          doctorId: String(doctorId || ""),
          metadataDoctorId: String(
              (session.metadata && session.metadata.doctorId) || "",
          ),
          userEmail,
          customerId: String(session.customer || ""),
          userUid: String(currentUser.uid || ""),
          metadataUserUid: String(
              (session.metadata && session.metadata.userUid) || "",
          ),
        });

        if (!resolvedDoctorId) {
          res.status(404).json({
            success: false,
            error: "Doctor profile not found for this payment.",
          });
          return;
        }

        const nowIso = new Date().toISOString();
        const subscriptionId = typeof session.subscription === "string" ?
          session.subscription :
          "";

        const updatedDoctor = await applyDoctorPaymentSuccess({
          resolvedDoctorId,
          planId,
          interval,
          sessionId: session.id || parsedSessionId,
          paymentReferenceId: session.id || parsedSessionId,
          customerId: String(session.customer || ""),
          subscriptionId,
          paidAt: nowIso,
          paidAmountMinor: Number(session.amount_total || 0),
          paidCurrency: String(session.currency || ""),
        });
        await recordPromoRedemption({
          promoId: String(
              (session.metadata && session.metadata.promoCodeId) || "",
          ),
          sessionId: String(session.id || parsedSessionId),
        });

        const logSnapshot = await admin.firestore()
            .collection("stripeCheckoutLogs")
            .where("sessionId", "==", parsedSessionId)
            .limit(10)
            .get();
        if (!logSnapshot.empty) {
          const batch = admin.firestore().batch();
          logSnapshot.docs.forEach((doc) => {
            batch.set(doc.ref, {
              status: "confirmed",
              confirmedAt: nowIso,
              doctorId: resolvedDoctorId,
            }, {merge: true});
          });
          await batch.commit();
        }

        res.json({
          success: true,
          doctor: updatedDoctor,
        });
      } catch (error) {
        logger.error("Failed to confirm Stripe checkout session:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Failed to confirm Stripe payment.",
        });
      }
    },
);

exports.stripeWebhook = onRequest(
    {
      secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
    },
    async (req, res) => {
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const secretKey = STRIPE_SECRET_KEY.value();
      const webhookSecret = STRIPE_WEBHOOK_SECRET.value();
      if (!secretKey || !webhookSecret) {
        res.status(500).send("Stripe webhook is not configured");
        return;
      }

      const stripeSignature = req.headers["stripe-signature"];
      if (!stripeSignature) {
        res.status(400).send("Missing stripe signature");
        return;
      }

      const stripe = new Stripe(secretKey, {
        apiVersion: "2025-01-27.acacia",
      });

      let event;
      try {
        const payload = req.rawBody || Buffer.from(JSON.stringify(req.body));
        event = stripe.webhooks.constructEvent(
            payload,
            stripeSignature,
            webhookSecret,
        );
      } catch (error) {
        logger.error("Stripe webhook signature verification failed:", error);
        res.status(400).send("Invalid webhook signature");
        return;
      }

      try {
        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          const planId = String(
              (session.metadata && session.metadata.planId) || "",
          );
          const selectedPlan = STRIPE_PLAN_CATALOG[planId];
          const interval = selectedPlan ? selectedPlan.interval : "month";
          const resolvedDoctorId = await resolveDoctorIdForStripe({
            doctorId: String(
                (session.metadata && session.metadata.doctorId) || "",
            ),
            metadataDoctorId: String(
                (session.metadata && session.metadata.doctorId) || "",
            ),
            userEmail: String(session.customer_email || ""),
            customerId: String(session.customer || ""),
            metadataUserUid: String(
                (session.metadata && session.metadata.userUid) || "",
            ),
          });
          if (resolvedDoctorId) {
            await applyDoctorPaymentSuccess({
              resolvedDoctorId,
              planId,
              interval,
              sessionId: String(session.id || ""),
              paymentReferenceId: String(session.id || ""),
              customerId: String(session.customer || ""),
              subscriptionId: String(session.subscription || ""),
              paidAt: new Date().toISOString(),
              paidAmountMinor: Number(session.amount_total || 0),
              paidCurrency: String(session.currency || ""),
            });
            await recordPromoRedemption({
              promoId: String(
                  (session.metadata && session.metadata.promoCodeId) || "",
              ),
              sessionId: String(session.id || ""),
            });
          }
        } else if (event.type === "invoice.paid") {
          const invoice = event.data.object;
          const recurringInterval = (
            invoice &&
            invoice.lines &&
            invoice.lines.data &&
            invoice.lines.data[0] &&
            invoice.lines.data[0].price &&
            invoice.lines.data[0].price.recurring &&
            invoice.lines.data[0].price.recurring.interval
          ) || "month";
          const resolvedDoctorId = await resolveDoctorIdForStripe({
            doctorId: "",
            metadataDoctorId: "",
            userEmail: String(invoice.customer_email || ""),
            customerId: String(invoice.customer || ""),
            metadataUserUid: String(
                (invoice.metadata && invoice.metadata.userUid) || "",
            ),
          });
          if (resolvedDoctorId) {
            await applyDoctorPaymentSuccess({
              resolvedDoctorId,
              planId: "",
              interval: recurringInterval === "year" ? "year" : "month",
              sessionId: "",
              paymentReferenceId: String(invoice.id || ""),
              customerId: String(invoice.customer || ""),
              subscriptionId: String(invoice.subscription || ""),
              paidAt: new Date().toISOString(),
              paidAmountMinor: Number(invoice.amount_paid || 0),
              paidCurrency: String(invoice.currency || ""),
            });
          }
        } else if (
          event.type === "invoice.payment_failed" ||
          event.type === "customer.subscription.deleted"
        ) {
          const obj = event.data.object;
          const resolvedDoctorId = await resolveDoctorIdForStripe({
            doctorId: "",
            metadataDoctorId: "",
            userEmail: String(obj.customer_email || ""),
            customerId: String(obj.customer || ""),
            metadataUserUid: String(
                (obj.metadata && obj.metadata.userUid) || "",
            ),
          });
          if (resolvedDoctorId) {
            await admin.firestore()
                .collection("doctors")
                .doc(resolvedDoctorId)
                .set({
                  paymentStatus: event.type === "invoice.payment_failed" ?
                    "failed" :
                    "canceled",
                  stripeLastEvent: event.type,
                  stripeLastEventAt: new Date().toISOString(),
                }, {merge: true});
          }
        }

        res.json({received: true});
      } catch (error) {
        logger.error("Stripe webhook processing failed:", error);
        res.status(500).send("Webhook processing failed");
      }
    },
);

exports.sendDoctorRegistrationSms = onDocumentCreated(
    {
      document: "doctors/{doctorId}",
      secrets: [NOTIFY_USER_ID, NOTIFY_API_KEY],
    },
    async (event) => {
      const doctor = event.data && event.data.data ? event.data.data() : null;
      if (!doctor) return;
      if (doctor.isApproved === true) return;

      const templates = await getMessagingTemplates();
      if (!templates.doctorRegistrationTemplateEnabled) return;
      const senderId = templates.smsSenderId || "";
      if (!senderId) {
        logger.warn("SMS sender ID missing; skip doctor registration SMS");
        return;
      }

      const phone = doctor.phone || doctor.phoneNumber || "";
      if (!phone) return;

      const message = renderTemplate(templates.doctorRegistrationTemplate, {
        doctorName: buildDoctorName(doctor),
        appUrl: templates.appUrl || DEFAULT_APP_URL,
      });

      const result = await sendNotifySms({
        recipient: phone,
        senderId,
        message,
      });
      if (!result.ok) {
        logger.warn("Doctor registration SMS failed:", result.error);
      }

      if (templates.doctorRegistrationCopyToTestEnabled === true) {
        const testRecipient = templates.smsTestRecipient || "";
        const normalizedMain = normalizeNotifyRecipient(phone);
        const normalizedTest = normalizeNotifyRecipient(testRecipient);
        if (normalizedTest && normalizedTest !== normalizedMain) {
          const testResult = await sendNotifySms({
            recipient: testRecipient,
            senderId,
            message,
          });
          if (!testResult.ok) {
            logger.warn(
                "Doctor registration test SMS failed:",
                testResult.error,
            );
          }
        }
      }
    },
);

exports.sendDoctorApprovedSms = onDocumentUpdated(
    {
      document: "doctors/{doctorId}",
      secrets: [NOTIFY_USER_ID, NOTIFY_API_KEY],
    },
    async (event) => {
      const before =
        event.data && event.data.before ? event.data.before.data() : null;
      const after =
        event.data && event.data.after ? event.data.after.data() : null;
      if (!before || !after) return;
      if (before.isApproved === true || after.isApproved !== true) return;

      const templates = await getMessagingTemplates();
      if (!templates.doctorApprovedTemplateEnabled) return;
      const senderId = templates.smsSenderId || "";
      if (!senderId) {
        logger.warn("SMS sender ID missing; skip doctor approved SMS");
        return;
      }

      const phone = after.phone || after.phoneNumber || "";
      if (!phone) return;

      const message = renderTemplate(templates.doctorApprovedTemplate, {
        doctorName: buildDoctorName(after),
        appUrl: templates.appUrl || DEFAULT_APP_URL,
      });

      const result = await sendNotifySms({
        recipient: phone,
        senderId,
        message,
      });
      if (!result.ok) {
        logger.warn("Doctor approved SMS failed:", result.error);
      }
    },
);

exports.clearEmailLogs = onRequest(async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const adminUser = await getAuthorizedAdmin(req);
  if (!adminUser) {
    res.status(401).send("Unauthorized");
    return;
  }

  try {
    const logsRef = admin.firestore().collection("emailLogs");
    const snapshot = await logsRef.get();
    const batch = admin.firestore().batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    res.json({success: true, deleted: snapshot.size});
  } catch (error) {
    logger.error("Failed to clear email logs:", error);
    res.status(500).send("Failed to clear email logs");
  }
});
