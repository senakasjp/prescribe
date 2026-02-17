// Pharmacist Module Configuration
// This file contains all pharmacist-specific constants and settings

export const PHARMACIST_CONFIG = {
  // Module identification
  MODULE_NAME: 'Pharmacist Module',
  MODULE_VERSION: '1.0.0',
  
  // Authentication settings
  AUTH: {
    STORAGE_KEY: 'prescribe-current-pharmacist',
    ROLE: 'pharmacist',
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  },
  
  // Storage settings
  STORAGE: {
    COLLECTIONS: {
      PHARMACISTS: 'pharmacists',
      PRESCRIPTIONS: 'medications', // Prescriptions are stored in medications collection
      DRUG_STOCK: 'drugStock',
      CONNECTED_DOCTORS: 'connectedDoctors'
    }
  },
  
  // UI settings
  UI: {
    DEFAULT_VIEW: 'dashboard',
    AVAILABLE_VIEWS: ['dashboard', 'prescriptions', 'inventory', 'doctors'],
    ITEMS_PER_PAGE: 10,
    MAX_DRUG_STOCK_ITEMS: 5000
  },
  
  // Validation settings
  VALIDATION: {
    REQUIRED_PHARMACIST_FIELDS: ['businessName', 'pharmacistNumber', 'email'],
    REQUIRED_DRUG_STOCK_FIELDS: ['drugName', 'quantity', 'unitPrice'],
    MAX_DRUG_QUANTITY: 10000,
    MIN_DRUG_QUANTITY: 0,
    LOW_STOCK_THRESHOLD: 10
  },
  
  // Permissions
  PERMISSIONS: {
    CAN_CREATE_DRUG_STOCK: true,
    CAN_EDIT_DRUG_STOCK: true,
    CAN_DELETE_DRUG_STOCK: true,
    CAN_VIEW_PRESCRIPTIONS: true,
    CAN_UPDATE_PRESCRIPTION_STATUS: true,
    CAN_CONNECT_TO_DOCTORS: true,
    CAN_VIEW_DOCTOR_DATA: false, // Strict isolation - only connected doctors
    CAN_MODIFY_DOCTOR_DATA: false, // Strict isolation
    CAN_VIEW_PATIENT_DATA: false // Strict isolation - no direct patient access
  },
  
  // Error messages
  ERRORS: {
    PHARMACIST_NOT_FOUND: 'Pharmacist not found',
    DRUG_STOCK_NOT_FOUND: 'Drug stock item not found',
    PRESCRIPTION_NOT_FOUND: 'Prescription not found',
    INVALID_PHARMACIST_DATA: 'Invalid pharmacist data',
    INVALID_DRUG_STOCK_DATA: 'Invalid drug stock data',
    UNAUTHORIZED_ACCESS: 'Unauthorized access to data',
    DOCTOR_DATA_ACCESS_DENIED: 'Access to doctor data is not allowed',
    PATIENT_DATA_ACCESS_DENIED: 'Access to patient data is not allowed'
  },
  
  // Success messages
  SUCCESS: {
    PHARMACIST_CREATED: 'Pharmacist created successfully',
    PHARMACIST_UPDATED: 'Pharmacist updated successfully',
    DRUG_STOCK_CREATED: 'Drug stock item created successfully',
    DRUG_STOCK_UPDATED: 'Drug stock item updated successfully',
    DRUG_STOCK_DELETED: 'Drug stock item deleted successfully',
    PRESCRIPTION_STATUS_UPDATED: 'Prescription status updated successfully',
    DOCTOR_CONNECTED: 'Doctor connected successfully'
  },
  
  // Inventory settings
  INVENTORY: {
    LOW_STOCK_ALERT: true,
    EXPIRY_ALERT_DAYS: 30,
    AUTO_REORDER_THRESHOLD: 5,
    BATCH_SIZE: 100
  }
}

export default PHARMACIST_CONFIG
