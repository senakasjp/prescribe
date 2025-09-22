# Changelog

All notable changes to M-Prescribe are documented in this file.

## [1.5.0] - 2025-01-16

### ✨ Added
- **Updated Prescription History Rules**: New logic for prescription visibility and history management
- **Immediate Prescription Removal**: Clicking "+ New Prescription" immediately removes current prescription from prescriptions tab
- **Enhanced Send to Pharmacy**: Prescriptions sent to pharmacy automatically move to history and medical summary
- **Enhanced Print PDF**: Prescriptions printed to PDF automatically move to history and medical summary

### 🔧 Fixed
- **Prescription Visibility**: Clear separation between active prescriptions and historical records
- **History Management**: Only sent/printed prescriptions appear in history and medical summary
- **Data Cleanup**: Unsent/unprinted prescriptions are automatically deleted from system
- **User Experience**: Intuitive workflow that matches user expectations

### 🎨 Improved
- **Prescription Workflow**: Immediate feedback when starting new prescriptions
- **History Accuracy**: Clean prescription history containing only meaningful, completed prescriptions
- **System Performance**: Reduced data volume in prescription queries
- **Documentation**: Updated PRESCRIPTION_HISTORY_LOGIC.md with new rules and implementation details

### 📋 Technical Changes
- **PatientDetails.svelte**: Updated `onNewPrescription` handler to remove current prescription from prescriptions array
- **PatientDetails.svelte**: Updated `sendToPharmacy` function to mark prescription as sent and add `endDate`
- **PatientDetails.svelte**: Updated `printPrescriptions` function to mark prescription as printed and add `endDate`
- **Firebase Integration**: Enhanced prescription status tracking with `endDate` for historical records

## [1.4.0] - 2025-01-16

### ✨ Added
- **Smart Prescription History Logic**: Prescriptions only move to history and summary when saved or printed
- **Conditional History Management**: Unsaved/unprinted prescriptions are discarded when new prescription starts
- **Enhanced Status Tracking**: Clear distinction between saved (finalized), printed (sent), and draft prescriptions
- **Intelligent Prescription Workflow**: New prescription creation automatically handles previous prescription status

### 🔧 Fixed
- **Prescription History Accuracy**: Only completed work appears in prescription history
- **Data Cleanup**: Unsaved draft prescriptions are properly removed from system
- **Status Consistency**: Prescription status properly tracked throughout lifecycle

### 🎨 Improved
- **Prescription Workflow**: Clear separation between saved and unsaved prescriptions
- **History Management**: Clean prescription history containing only finalized/sent prescriptions
- **Status Definitions**: Clear status definitions for saved vs printed vs draft prescriptions

## [1.3.0] - 2025-01-16

### ✨ Added
- **Dynamic Stock Availability System**: Real-time stock monitoring with color-coded badges
- **Pharmacy Stock Integration**: Doctors can see medication availability from connected pharmacies
- **Initial Quantity Tracking**: System tracks initial stock quantities for accurate low-stock detection
- **Smart Stock Badges**: Orange badges for normal stock, red badges for low stock (≤10% of initial)
- **Drug Stock Management**: Comprehensive inventory management for pharmacists
- **Stock Availability Display**: Visual indicators showing medication availability in prescriptions

### 🎨 Improved
- **Visual Stock Alerts**: Immediate visual feedback for critical stock levels
- **Pharmacy-Doctor Integration**: Seamless connection between pharmacist inventory and doctor prescriptions
- **Stock Monitoring**: Real-time updates of stock levels across the system
- **User Experience**: Enhanced prescription interface with stock availability information

### 🔄 Changed
- **Badge Color Logic**: Dynamic color changes based on stock percentage calculations
- **Pharmacist Dashboard**: Enhanced with comprehensive drug stock management features
- **Prescription Display**: Added stock availability badges to medication lists

## [1.2.0] - 2025-01-15

### 🔧 Fixed
- **Prescription Data Persistence**: Fixed critical issue where medications disappeared when refreshing the page or navigating away and back
- **Data Loading Logic**: Enhanced `setupCurrentPrescription()` function to properly initialize current prescription from loaded data
- **Prescription Structure**: Implemented proper prescription-medication hierarchy where medications are stored within prescription containers

### ✨ Added
- **Prescription Card UI**: Wrapped prescription functionality in a professional Bootstrap card design
- **Optional Start Date**: Made medication start date optional with smart defaults (defaults to today if not provided)
- **Enhanced Patient Editing**: Comprehensive patient data editing with validation and error handling
- **Responsive Header**: Fixed mobile responsiveness with proper Bootstrap 5 layout

### 🎨 Improved
- **Data Model**: Proper prescription-medication relationships following the requirement "A prescription has one or more drugs (medicines)"
- **User Experience**: Better visual organization with card-based design
- **Form Validation**: Enhanced validation for patient data editing
- **Mobile Experience**: Improved responsive design for all screen sizes

### 🔄 Changed
- **Prescription Structure**: Changed from flat medication list to hierarchical prescription-medication structure
- **Data Loading**: Updated data loading logic to properly handle prescription containers
- **UI Components**: Enhanced prescription management interface with card design

## [1.1.0] - 2025-01-14

### ✨ Added
- **Pharmacist System**: Complete pharmacist authentication and management system
- **Doctor-Pharmacist Connection**: Ability for doctors to connect with pharmacists using unique 6-digit numbers
- **Prescription Sharing**: Connected pharmacists can view prescriptions from doctors
- **Pharmacist Dashboard**: Dedicated interface for pharmacists to manage prescriptions
- **Google Authentication**: Integration with Firebase Google authentication
- **Admin Panel**: System administration dashboard with user management
- **AI Token Tracking**: Cost monitoring for AI services with usage statistics

### 🎨 Improved
- **Responsive Design**: Enhanced mobile responsiveness across all components
- **Bootstrap 5 Compliance**: Updated all components to use Bootstrap 5 classes and utilities
- **User Interface**: Professional styling with consistent design patterns
- **Data Migration**: Automatic migration for existing data structures

## [1.0.0] - 2025-01-13

### ✨ Initial Release
- **Patient Management System**: Complete patient registration, editing, and management
- **Doctor Authentication**: Secure login and registration for medical professionals
- **Prescription Management**: Create, edit, and manage prescriptions with multiple medications
- **Medical Data Tracking**: Symptoms, illnesses, and prescription history
- **AI-Powered Features**: Drug interaction analysis and medical recommendations
- **PDF Generation**: Professional prescription printing
- **Drug Database**: Personal drug database with autocomplete
- **Responsive Design**: Mobile-friendly interface

---

## Technical Details

### Prescription Status Definitions (v1.4.0)
```javascript
// Prescription Status Types
const PRESCRIPTION_STATUS = {
  DRAFT: 'draft',           // New/unsaved prescription
  PENDING: 'pending',       // Unsaved pending prescription
  FINALIZED: 'finalized',   // Saved prescription (moves to history)
  COMPLETED: 'completed',   // Saved prescription (moves to history)
  SENT: 'sent',            // Printed prescription (moves to history)
  SENT_TO_PHARMACY: true   // Printed prescription flag (moves to history)
}

// History Logic
const shouldMoveToHistory = (prescription) => {
  const isSaved = prescription.status === 'finalized' || prescription.status === 'completed';
  const isPrinted = prescription.status === 'sent' || 
                    prescription.sentToPharmacy || 
                    prescription.printedAt;
  return isSaved || isPrinted;
}
```

### Data Structure Changes
```javascript
// Before (v1.1.0)
medications: [
  { id: "med-1", name: "Lisinopril", ... },
  { id: "med-2", name: "Paracetamol", ... }
]

// After (v1.2.0)
prescriptions: [
  {
    id: "prescription-1",
    patientId: "patient-123",
    medications: [
      { id: "med-1", name: "Lisinopril", ... },
      { id: "med-2", name: "Paracetamol", ... }
    ]
  }
]
```

### Key Functions Added/Modified (v1.4.0)
- `onNewPrescription()` - Enhanced with status checking logic for history management
- `finalizePrescription()` - Sets status to 'finalized' (saved)
- `sendToPharmacy()` - Sets status to 'sent' and sentToPharmacy flag (printed)
- `shouldMoveToHistory()` - Determines if prescription should move to history
- `setupCurrentPrescription()` - Properly initializes current prescription from loaded data
- `loadPatientData()` - Enhanced to call setup function
- `filterCurrentPrescriptions()` - Updated to work with new structure
- `saveCurrentPrescriptions()` - Modified to handle prescription containers

### UI Components Updated
- `PatientDetails.svelte` - Enhanced prescription management
- `MedicationForm.svelte` - Made start date optional
- `App.svelte` - Fixed responsive header
- All components - Bootstrap 5 compliance

---

*For more detailed information about specific changes, see the individual commit messages and pull requests.*
