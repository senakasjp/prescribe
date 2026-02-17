/**
 * Utility functions for name formatting
 */

/**
 * Capitalizes the first letter of each word in a name
 * @param {string} name - The name to capitalize
 * @returns {string} - The capitalized name
 */
export function capitalizeName(name) {
  if (!name || typeof name !== 'string') {
    return ''
  }
  
  return name
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Capitalizes the first letter of a single word
 * @param {string} word - The word to capitalize
 * @returns {string} - The capitalized word
 */
export function capitalizeFirstLetter(word) {
  if (!word || typeof word !== 'string') {
    return ''
  }
  
  return word.trim().charAt(0).toUpperCase() + word.trim().slice(1).toLowerCase()
}

/**
 * Capitalizes patient names (first name and last name)
 * @param {Object} patientData - The patient data object
 * @returns {Object} - The patient data with capitalized names
 */
export function capitalizePatientNames(patientData) {
  if (!patientData) {
    return patientData
  }

  const result = { ...patientData }

  if (Object.prototype.hasOwnProperty.call(patientData, 'firstName')) {
    result.firstName = capitalizeName(patientData.firstName)
  }
  if (Object.prototype.hasOwnProperty.call(patientData, 'lastName')) {
    result.lastName = capitalizeName(patientData.lastName)
  }
  if (Object.prototype.hasOwnProperty.call(patientData, 'emergencyContact')) {
    result.emergencyContact = capitalizeName(patientData.emergencyContact)
  }

  return result
}
