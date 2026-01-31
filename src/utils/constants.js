/**
 * Application constants
 * Centralized constants used across the application
 */

// User roles
export const USER_ROLES = {
  DOCTOR: 'doctor',
  PHARMACIST: 'pharmacist',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
}

// Authentication providers
export const AUTH_PROVIDERS = {
  EMAIL_PASSWORD: 'email-password',
  GOOGLE: 'google',
  AUTO_LOGIN: 'auto-login'
}

// Application views/tabs
export const VIEWS = {
  HOME: 'home',
  PATIENTS: 'patients',
  PRESCRIPTIONS: 'prescriptions',
  ALL_PRESCRIPTIONS: 'all-prescriptions',
  PHARMACIES: 'pharmacies',
  ALL_PHARMACIES: 'all-pharmacies',
  SETTINGS: 'settings'
}

// Patient tabs
export const PATIENT_TABS = {
  OVERVIEW: 'overview',
  SYMPTOMS: 'symptoms',
  REPORTS: 'reports',
  DIAGNOSES: 'diagnoses',
  PRESCRIPTIONS: 'prescriptions'
}

// Medical data types
export const MEDICAL_DATA_TYPES = {
  SYMPTOMS: 'symptoms',
  ILLNESSES: 'illnesses',
  PRESCRIPTIONS: 'prescriptions',
  MEDICATIONS: 'medications',
  REPORTS: 'reports',
  DIAGNOSES: 'diagnoses'
}

// Prescription statuses
export const PRESCRIPTION_STATUS = {
  DRAFT: 'draft',
  SAVED: 'saved',
  PRINTED: 'printed',
  SENT: 'sent',
  CANCELLED: 'cancelled'
}

// Medication frequencies with standard medical abbreviations
export const MEDICATION_FREQUENCIES = [
  'Once daily (OD)',
  'Twice daily (BD)',
  'Three times daily (TDS)',
  'Four times daily (QDS)',
  'Every 4 hours (Q4H)',
  'Every 6 hours (Q6H)',
  'Every 8 hours (Q8H)',
  'Every 12 hours (Q12H)',
  'Every other day (EOD)',
  'Noon',
  'STAT',
  'Nocte',
  'Mane',
  'Vesper',
  'Weekly',
  'As needed (PRN-SOS)',
  'Before meals (AC)',
  'After meals (PC)',
  'At bedtime (HS)',
  'Monthly'
]

// Medication durations
export const MEDICATION_DURATIONS = [
  '1 day',
  '3 days',
  '5 days',
  '7 days',
  '10 days',
  '14 days',
  '21 days',
  '30 days',
  '60 days',
  '90 days',
  '6 months',
  '1 year',
  'Ongoing',
  'As needed'
]

// Severity levels
export const SEVERITY_LEVELS = {
  MILD: 'mild',
  MODERATE: 'moderate',
  SEVERE: 'severe',
  CRITICAL: 'critical'
}

// Gender options
export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' }
]

// Blood type options
export const BLOOD_TYPES = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
]

// Report types
export const REPORT_TYPES = {
  TEXT: 'text',
  PDF: 'pdf',
  IMAGE: 'image'
}

// Notification types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
}

// Modal types
export const MODAL_TYPES = {
  CONFIRMATION: 'confirmation',
  EDIT_PROFILE: 'edit_profile',
  PRIVACY_POLICY: 'privacy_policy',
  QUOTA_MANAGEMENT: 'quota_management'
}

// Chart types
export const CHART_TYPES = {
  LINE: 'line',
  BAR: 'bar',
  PIE: 'pie',
  DONUT: 'donut',
  AREA: 'area'
}

// File upload limits
export const FILE_LIMITS = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.pdf']
}

// API endpoints (if needed)
export const API_ENDPOINTS = {
  DOCTORS: '/api/doctors',
  PHARMACISTS: '/api/pharmacists',
  PATIENTS: '/api/patients',
  PRESCRIPTIONS: '/api/prescriptions',
  MEDICATIONS: '/api/medications',
  SYMPTOMS: '/api/symptoms',
  ILLNESSES: '/api/illnesses',
  REPORTS: '/api/reports',
  DIAGNOSES: '/api/diagnoses'
}

// Local storage keys
export const STORAGE_KEYS = {
  CURRENT_DOCTOR: 'prescribe-current-doctor',
  CURRENT_PHARMACIST: 'prescribe-current-pharmacist',
  CURRENT_USER: 'prescribe-current-user',
  APP_DATA: 'prescribe-data',
  SETTINGS: 'prescribe-settings',
  THEME: 'prescribe-theme'
}

// Default values
export const DEFAULTS = {
  PAGE_SIZE: 10,
  SEARCH_DEBOUNCE: 300,
  AUTO_SAVE_INTERVAL: 30000, // 30 seconds
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000 // 1 second
}

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied.',
  NOT_FOUND: 'Resource not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred.'
}

// Success messages
export const SUCCESS_MESSAGES = {
  SAVED: 'Data saved successfully.',
  UPDATED: 'Data updated successfully.',
  DELETED: 'Data deleted successfully.',
  CREATED: 'Data created successfully.',
  SENT: 'Data sent successfully.',
  UPLOADED: 'File uploaded successfully.',
  DOWNLOADED: 'File downloaded successfully.'
}

// Validation rules
export const VALIDATION_RULES = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^[\+]?[1-9][\d]{0,15}$/,
  PASSWORD_MIN_LENGTH: 6,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  DESCRIPTION_MAX_LENGTH: 1000,
  NOTES_MAX_LENGTH: 500
}

// Date formats
export const DATE_FORMATS = {
  DISPLAY: 'dd/MM/yyyy',
  INPUT: 'yyyy-MM-dd', // HTML date input format (always YYYY-MM-DD)
  DATETIME: 'dd/MM/yyyy HH:mm',
  TIME: 'HH:mm',
  ISO: 'yyyy-MM-ddTHH:mm:ss.SSSZ'
}

// Color schemes
export const COLOR_SCHEMES = {
  PRIMARY: 'teal',
  SECONDARY: 'gray',
  SUCCESS: 'green',
  WARNING: 'yellow',
  ERROR: 'red',
  INFO: 'blue'
}

// Breakpoints (for responsive design)
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536
}

// Animation durations
export const ANIMATION_DURATIONS = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500
}

// Z-index levels
export const Z_INDEX = {
  DROPDOWN: 1000,
  STICKY: 1020,
  FIXED: 1030,
  MODAL_BACKDROP: 1040,
  MODAL: 1050,
  POPOVER: 1060,
  TOOLTIP: 1070
}
