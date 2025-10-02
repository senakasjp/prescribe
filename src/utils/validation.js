/**
 * Validation utility functions
 * Provides common validation logic used across components
 */

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email format
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {object} - Validation result with isValid and message
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Password is required' }
  }
  
  if (password.length < 6) {
    return { isValid: false, message: 'Password must be at least 6 characters long' }
  }
  
  return { isValid: true, message: 'Password is valid' }
}

/**
 * Validates required fields
 * @param {object} data - Data object to validate
 * @param {array} requiredFields - Array of required field names
 * @returns {object} - Validation result with isValid and missingFields
 */
export function validateRequiredFields(data, requiredFields) {
  if (!data || typeof data !== 'object') {
    return { isValid: false, missingFields: requiredFields }
  }
  
  const missingFields = requiredFields.filter(field => {
    const value = data[field]
    return value === undefined || value === null || value === '' || 
           (Array.isArray(value) && value.length === 0)
  })
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  }
}

/**
 * Validates phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid phone format
 */
export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))
}

/**
 * Validates date format
 * @param {string} date - Date string to validate
 * @returns {boolean} - True if valid date format
 */
export function isValidDate(date) {
  if (!date || typeof date !== 'string') return false
  const dateObj = new Date(date)
  return dateObj instanceof Date && !isNaN(dateObj)
}

/**
 * Validates numeric input
 * @param {string|number} value - Value to validate
 * @param {object} options - Validation options
 * @returns {object} - Validation result
 */
export function validateNumeric(value, options = {}) {
  const { min, max, allowDecimals = true, allowNegative = true } = options
  
  if (value === '' || value === null || value === undefined) {
    return { isValid: false, message: 'Value is required' }
  }
  
  const numValue = parseFloat(value)
  
  if (isNaN(numValue)) {
    return { isValid: false, message: 'Must be a valid number' }
  }
  
  if (!allowDecimals && !Number.isInteger(numValue)) {
    return { isValid: false, message: 'Must be a whole number' }
  }
  
  if (!allowNegative && numValue < 0) {
    return { isValid: false, message: 'Must be a positive number' }
  }
  
  if (min !== undefined && numValue < min) {
    return { isValid: false, message: `Must be at least ${min}` }
  }
  
  if (max !== undefined && numValue > max) {
    return { isValid: false, message: `Must be at most ${max}` }
  }
  
  return { isValid: true, message: 'Valid number' }
}

/**
 * Sanitizes input string to prevent XSS
 * @param {string} input - Input string to sanitize
 * @returns {string} - Sanitized string
 */
export function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return ''
  
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
}

/**
 * Validates medication data
 * @param {object} medication - Medication object to validate
 * @returns {object} - Validation result
 */
export function validateMedication(medication) {
  if (!medication || typeof medication !== 'object') {
    return { isValid: false, message: 'Medication data is required' }
  }
  
  const requiredFields = ['name', 'dosage', 'frequency']
  const fieldValidation = validateRequiredFields(medication, requiredFields)
  
  if (!fieldValidation.isValid) {
    return {
      isValid: false,
      message: `Missing required fields: ${fieldValidation.missingFields.join(', ')}`
    }
  }
  
  // Validate dosage is numeric
  const dosageValidation = validateNumeric(medication.dosage, { min: 0.1 })
  if (!dosageValidation.isValid) {
    return { isValid: false, message: `Invalid dosage: ${dosageValidation.message}` }
  }
  
  return { isValid: true, message: 'Valid medication' }
}

/**
 * Validates patient data
 * @param {object} patient - Patient object to validate
 * @returns {object} - Validation result
 */
export function validatePatient(patient) {
  if (!patient || typeof patient !== 'object') {
    return { isValid: false, message: 'Patient data is required' }
  }
  
  const requiredFields = ['firstName', 'lastName', 'dateOfBirth']
  const fieldValidation = validateRequiredFields(patient, requiredFields)
  
  if (!fieldValidation.isValid) {
    return {
      isValid: false,
      message: `Missing required fields: ${fieldValidation.missingFields.join(', ')}`
    }
  }
  
  // Validate email if provided
  if (patient.email && !isValidEmail(patient.email)) {
    return { isValid: false, message: 'Invalid email format' }
  }
  
  // Validate phone if provided
  if (patient.phone && !isValidPhone(patient.phone)) {
    return { isValid: false, message: 'Invalid phone format' }
  }
  
  // Validate date of birth
  if (!isValidDate(patient.dateOfBirth)) {
    return { isValid: false, message: 'Invalid date of birth' }
  }
  
  return { isValid: true, message: 'Valid patient data' }
}
