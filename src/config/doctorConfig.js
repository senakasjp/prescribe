// Doctor Module Configuration
// This file contains all doctor-specific constants and settings

export const DOCTOR_CONFIG = {
  // Module identification
  MODULE_NAME: 'Doctor Module',
  MODULE_VERSION: '1.0.0',
  
  // Authentication settings
  AUTH: {
    STORAGE_KEY: 'prescribe-current-doctor',
    ROLE: 'doctor',
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  },
  
  // Storage settings
  STORAGE: {
    COLLECTIONS: {
      DOCTORS: 'doctors',
      PATIENTS: 'patients',
      ILLNESSES: 'illnesses',
      MEDICATIONS: 'medications',
      SYMPTOMS: 'symptoms',
      LONG_TERM_MEDICATIONS: 'longTermMedications'
    }
  },
  
  // UI settings
  UI: {
    DEFAULT_VIEW: 'home',
    AVAILABLE_VIEWS: ['home', 'patients', 'prescriptions', 'drugs', 'pharmacies'],
    ITEMS_PER_PAGE: 10,
    MAX_PATIENTS_PER_DOCTOR: 1000
  },
  
  // Validation settings
  VALIDATION: {
    REQUIRED_PATIENT_FIELDS: ['firstName', 'lastName', 'dateOfBirth', 'gender'],
    REQUIRED_PRESCRIPTION_FIELDS: ['medicationName', 'dosage', 'frequency', 'duration'],
    MAX_PRESCRIPTION_DURATION: 365, // days
    MIN_PATIENT_AGE: 0,
    MAX_PATIENT_AGE: 150
  },
  
  // Permissions
  PERMISSIONS: {
    CAN_CREATE_PATIENTS: true,
    CAN_EDIT_PATIENTS: true,
    CAN_DELETE_PATIENTS: true,
    CAN_CREATE_PRESCRIPTIONS: true,
    CAN_EDIT_PRESCRIPTIONS: true,
    CAN_DELETE_PRESCRIPTIONS: true,
    CAN_VIEW_PHARMACIST_DATA: false, // Strict isolation
    CAN_MODIFY_PHARMACIST_DATA: false // Strict isolation
  },
  
  // Error messages
  ERRORS: {
    PATIENT_NOT_FOUND: 'Patient not found',
    PRESCRIPTION_NOT_FOUND: 'Prescription not found',
    INVALID_PATIENT_DATA: 'Invalid patient data',
    INVALID_PRESCRIPTION_DATA: 'Invalid prescription data',
    UNAUTHORIZED_ACCESS: 'Unauthorized access to patient data',
    PHARMACIST_DATA_ACCESS_DENIED: 'Access to pharmacist data is not allowed'
  },
  
  // Success messages
  SUCCESS: {
    PATIENT_CREATED: 'Patient created successfully',
    PATIENT_UPDATED: 'Patient updated successfully',
    PATIENT_DELETED: 'Patient deleted successfully',
    PRESCRIPTION_CREATED: 'Prescription created successfully',
    PRESCRIPTION_UPDATED: 'Prescription updated successfully',
    PRESCRIPTION_DELETED: 'Prescription deleted successfully'
  }
}

export default DOCTOR_CONFIG
