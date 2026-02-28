const {
  formatPatientId,
  renderTemplate,
  buildDoctorName,
  buildPatientName,
} = require("./messagingUtils");

const isNotificationsDisabled = (patient) => (
  patient &&
  (patient.disableNotifications ||
    patient.doNotSendNotifications ||
    patient.dontSendNotifications)
);

const buildPatientRecipient = (patient) => {
  if (!patient) return "";
  const phone = String(patient.phone || patient.phoneNumber || "").trim();
  if (!phone) return "";
  const countryCode = String(patient.phoneCountryCode || "").trim();
  if (!countryCode) return phone;

  if (phone.startsWith("+")) return phone;

  const countryDigits = countryCode.replace(/\D/g, "");
  const phoneDigits = phone.replace(/\D/g, "");
  if (!countryDigits) return phone;
  if (phoneDigits.startsWith(countryDigits)) return phoneDigits;

  const localDigits = phoneDigits.replace(/^0+/, "");
  return `${countryDigits}${localDigits}`;
};

const buildPatientRegistrationSmsPayload = ({
  patient,
  doctor,
  templates,
  appUrl,
}) => {
  if (!patient) {
    return {ok: false, reason: "missing-patient"};
  }
  if (isNotificationsDisabled(patient)) {
    return {ok: false, reason: "notifications-disabled"};
  }

  const templateEnabled = !templates ||
    (
      templates.patientRegistrationTemplateEnabled !== undefined ?
        templates.patientRegistrationTemplateEnabled !== false :
        templates.registrationTemplateEnabled !== false
    );
  if (!templateEnabled) {
    return {ok: false, reason: "template-disabled"};
  }

  const channel = String(
      (templates &&
        (templates.patientRegistrationChannel || templates.registrationChannel)) ||
      "sms",
  ).toLowerCase();
  if (!(channel === "sms" || channel === "both")) {
    return {ok: false, reason: "channel-not-sms"};
  }

  const senderId = (templates && templates.smsSenderId) || "";
  if (!senderId) {
    return {ok: false, reason: "missing-sender-id"};
  }

  const phone = buildPatientRecipient(patient);
  if (!phone) {
    return {ok: false, reason: "missing-phone"};
  }

  const rawPatientId = patient.id || patient.patientId || "";
  const patientIdShort = formatPatientId(rawPatientId);
  const patientTitle = String(
      patient.title ||
      patient.patientTitle ||
      patient.salutation ||
      patient.prefix ||
      "",
  ).trim();
  const patientName = buildPatientName(patient);
  const patientDisplayName =
    [patientTitle, patientName].filter(Boolean).join(" ");
  const doctorName = buildDoctorName(doctor);
  const template = (templates &&
      (templates.patientRegistrationTemplate || templates.registrationTemplate)) || "";
  const message = renderTemplate(template, {
    title: patientTitle,
    patientTitle,
    name: patientName,
    patientDisplayName,
    patientName,
    doctorName,
    patientId: rawPatientId,
    patientShortId: patientIdShort,
    appUrl: appUrl || "",
  });

  return {
    ok: true,
    recipient: phone,
    senderId,
    message,
  };
};

module.exports = {
  buildPatientRegistrationSmsPayload,
};
