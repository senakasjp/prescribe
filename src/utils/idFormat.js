const hashString = (value) => {
  const input = String(value || '')
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i)
    hash &= 0xffffffff
  }
  return Math.abs(hash >>> 0)
}

const formatId = (prefix, rawId, length) => {
  if (!rawId) {
    return 'N/A'
  }
  const modulus = 10 ** length
  const numeric = hashString(rawId) % modulus
  return `${prefix}${String(numeric).padStart(length, '0')}`
}

export const formatDoctorId = (rawId) => formatId('DR', rawId, 5)
export const formatPrescriptionId = (rawId) => formatId('PR', rawId, 7)
export const formatPatientId = (rawId) => formatId('PA', rawId, 7)
export const formatPharmacyId = (rawId) => formatId('PH', rawId, 5)
