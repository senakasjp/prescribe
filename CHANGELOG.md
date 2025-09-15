# Changelog

All notable changes to M-Prescribe are documented in this file.

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

### Key Functions Added/Modified
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
