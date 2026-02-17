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

const renderTemplate = (template, data) => {
  const safe = String(template || "");
  return safe.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = data[key];
    return value !== undefined && value !== null ? String(value) : "";
  });
};

const buildDoctorName = (doctor) => {
  if (!doctor) return "Doctor";
  return doctor.name ||
    `${doctor.firstName || ""} ${doctor.lastName || ""}`.trim() ||
    doctor.email ||
    "Doctor";
};

const buildPatientName = (patient) => {
  if (!patient) return "Patient";
  return patient.name ||
    `${patient.firstName || ""} ${patient.lastName || ""}`.trim() ||
    patient.email ||
    "Patient";
};

module.exports = {
  formatDoctorId,
  formatPatientId,
  renderTemplate,
  buildDoctorName,
  buildPatientName,
};
