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
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const bwipjs = require("bwip-js");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");
const twilio = require("twilio");

admin.initializeApp();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const SMTP_PASS = defineSecret("SMTP_PASS");
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_FROM = defineSecret("TWILIO_WHATSAPP_FROM");
const NOTIFY_USER_ID = defineSecret("NOTIFY_USER_ID");
const NOTIFY_API_KEY = defineSecret("NOTIFY_API_KEY");

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

const hashString = (value) => {
  const input = String(value || "");
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash &= 0xffffffff;
  }
  return Math.abs(hash >>> 0);
};

const formatDoctorId = (rawId) => {
  if (!rawId) return "";
  const modulus = 100000;
  const numeric = hashString(rawId) % modulus;
  const padded = String(numeric).padStart(5, "0");
  return `DR${padded}`;
};

const formatPatientId = (rawId) => {
  if (!rawId) return "";
  const modulus = 10000000;
  const numeric = hashString(rawId) % modulus;
  const padded = String(numeric).padStart(7, "0");
  return `PA${padded}`;
};


const applyTemplate = (value, replacements) => {
  if (!value) return value;
  let result = String(value);
  Object.keys(replacements).forEach((key) => {
    const escapedKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`{{\\s*${escapedKey}\\s*}}`, "gi");
    const replacement = replacements[key] || "";
    result = result.replace(pattern, String(replacement));
  });
  return result;
};

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

const buildWelcomeEmail = async (doctor, template = {}) => {
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
        height: 60,
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

const buildPatientWelcomeEmail = async (patient, doctorName, template = {}) => {
  const patientName =
    (patient && patient.name) ||
    [patient && patient.firstName, patient && patient.lastName]
        .filter(Boolean)
        .join(" ") ||
    "Patient";
  const rawPatientId = (patient && (patient.id || patient.patientId)) || "";
  const patientIdShort = formatPatientId(rawPatientId);
  let patientIdBarcode = "";
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
      const barcodeBase64 = buffer.toString("base64");
      patientIdBarcode = `data:image/png;base64,${barcodeBase64}`;
    } catch (error) {
      logger.error("Failed to generate patient ID barcode:", error);
      patientIdBarcode = "";
    }
  }

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

  const replacements = {
    name: patientName,
    patientName,
    email: (patient && patient.email) || "",
    patientId: rawPatientId,
    patientIdShort,
    patientIdBarcode,
    doctorName: doctorName || "",
  };

  const subject = applyTemplate(subjectSource, replacements);
  const text = applyTemplate(textSource, replacements);
  const html = applyTemplate(htmlSource, replacements);

  return {subject, text, html};
};

const buildAppointmentReminderEmail = async (
    patient,
    doctorName,
    appointmentDate,
    template = {},
) => {
  const patientName =
    (patient && patient.name) ||
    [patient && patient.firstName, patient && patient.lastName]
        .filter(Boolean)
        .join(" ") ||
    "Patient";
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

  const replacements = {
    name: patientName,
    patientName,
    doctorName: doctorName || "",
    date: appointmentDate || "",
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
      const {subject, text, html} = await buildWelcomeEmail(
          doctor,
          template || {},
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
      const {subject, text, html} = await buildPatientWelcomeEmail(
          patient,
          doctorName,
          template || {},
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
      const transporter = nodemailer.createTransport(smtpConfig);

      const sendOne = async (doctor) => {
        const {subject, text, html} = await buildWelcomeEmail(
            doctor,
            template || {},
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
        const {subject, text, html} = await buildWelcomeEmail(
            doctor,
            template || {},
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
        const {subject, text, html} = await buildPatientWelcomeEmail(
            patient,
            resolvedDoctorName,
            template || {},
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
        const reminderDate = appointmentDate || "2026-01-01";
        const reminderDoctorName = doctorName || "Dr. Test";

        const transporter = nodemailer.createTransport(smtpConfig);
        const {subject, text, html} = await buildAppointmentReminderEmail(
            patient,
            reminderDoctorName,
            reminderDate,
            template || {},
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
      if (!endpoint || typeof endpoint !== "string") {
        res.status(400).send("Invalid endpoint");
        return;
      }

      const sanitizedEndpoint = endpoint.replace(/^\/+/, "");
      if (sanitizedEndpoint.includes("://")) {
        res.status(400).send("Invalid endpoint");
        return;
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
