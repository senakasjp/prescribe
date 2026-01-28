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
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

admin.initializeApp();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const SMTP_PASS = defineSecret("SMTP_PASS");

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

const getAdminEmail = () => process.env.ADMIN_EMAIL || "senakahks@gmail.com";

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
  const replacements = {
    name,
    email: (doctor && doctor.email) || "",
    doctorId: rawDoctorId,
    doctorIdShort: formatDoctorId(rawDoctorId),
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
