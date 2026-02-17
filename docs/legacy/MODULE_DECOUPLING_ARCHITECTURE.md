# Module Decoupling Architecture Documentation

## Overview
This document details the complete module decoupling architecture implemented in the M-Prescribe application, ensuring strict separation between Doctor and Pharmacist portals.

## Architecture Principles

### 1. Strict Isolation
- **No Cross-Module Dependencies**: Doctor and pharmacist modules are completely independent
- **Separate Service Layers**: Each module has its own dedicated services
- **Isolated Data Access**: No shared data access between modules
- **Independent Authentication**: Separate authentication systems

### 2. Data Privacy
- **Doctor Isolation**: Each doctor can ONLY see their own patients
- **No Cross-Doctor Access**: Impossible to access other doctors' data
- **HIPAA Compliance**: Patient data is properly isolated
- **Secure Data Flow**: All data access requires proper authentication

## Service Layer Architecture

### Doctor Services
```
src/services/doctor/
├── doctorAuthService.js      # Doctor authentication
└── doctorStorageService.js   # Doctor data operations
```

#### doctorAuthService.js
**Purpose**: Handles all doctor authentication operations
**Key Functions**:
- `createDoctor(email, password, profileData)`
- `signInDoctor(email, password)`
- `signOutDoctor()`
- `getCurrentDoctor()`
- `saveCurrentDoctor(doctor)`
- `updateDoctorProfile(doctorId, updates)`

#### doctorStorageService.js
**Purpose**: Handles all doctor-related data operations
**Key Functions**:
- `createPatient(patientData, doctorId)`
- `getPatientsByDoctorId(doctorId)`
- `updatePatient(patientId, updates, doctorId)`
- `deletePatient(patientId, doctorId)`
- `createPrescription(patientId, doctorId, prescriptionData)`
- `getPrescriptionsByDoctorId(doctorId)`
- `createSymptom(patientId, doctorId, symptomData)`
- `getSymptomsByPatientId(patientId, doctorId)`

### Pharmacist Services
```
src/services/pharmacist/
├── pharmacistAuthService.js      # Pharmacist authentication
└── pharmacistStorageService.js   # Pharmacist data operations
```

#### pharmacistAuthService.js
**Purpose**: Handles all pharmacist authentication operations
**Key Functions**:
- `createPharmacist(email, password, profileData)`
- `signInPharmacist(email, password)`
- `signOutPharmacist()`
- `getCurrentPharmacist()`
- `saveCurrentPharmacist(pharmacist)`
- `updatePharmacistProfile(pharmacistId, updates)`

#### pharmacistStorageService.js
**Purpose**: Handles all pharmacist-related data operations
**Key Functions**:
- `getPrescriptionsByPharmacistId(pharmacistId)`
- `updatePrescriptionStatus(prescriptionId, status)`
- `getDrugStock(pharmacistId)`
- `updateDrugStock(pharmacistId, stockData)`
- `connectToDoctor(pharmacistId, doctorId)`
- `getConnectedDoctors(pharmacistId)`

### Admin Services
```
src/services/
└── adminAuthService.js   # Admin authentication
```

#### adminAuthService.js
**Purpose**: Handles admin authentication and management
**Key Functions**:
- `createAdmin(email, password, profileData)`
- `signInAdmin(email, password)`
- `signOutAdmin()`
- `getCurrentAdmin()`
- `saveCurrentAdmin(admin)`
- `getAllDoctors()`
- `getAllPharmacists()`
- `updateDoctorQuota(doctorId, quota)`

## Component Architecture

### Doctor Module Router
```
src/components/doctor/
└── DoctorModuleRouter.svelte
```

**Purpose**: Routes doctor-specific components and views
**Features**:
- Doctor-specific navigation
- Home dashboard
- Patient management
- Prescription management
- Profile management

### Pharmacist Module Router
```
src/components/pharmacist/
└── PharmacistModuleRouter.svelte
```

**Purpose**: Routes pharmacist-specific components and views
**Features**:
- Pharmacist-specific navigation
- Prescription management
- Inventory management
- Doctor connections
- Dashboard analytics

## Configuration Architecture

### Doctor Configuration
```
src/config/
└── doctorConfig.js
```

**Purpose**: Centralizes doctor-specific settings and constants
**Key Settings**:
- Available views: ['home', 'patients', 'prescriptions', 'pharmacies']
- UI settings (default view, items per page)
- Business rules (max patients per doctor)
- Feature flags

### Pharmacist Configuration
```
src/config/
└── pharmacistConfig.js
```

**Purpose**: Centralizes pharmacist-specific settings and constants
**Key Settings**:
- Available views: ['dashboard', 'prescriptions', 'inventory', 'doctors']
- UI settings (default view, items per page)
- Business rules (max prescriptions per page)
- Feature flags

## Data Flow Architecture

### Doctor Data Flow
```
User Login → doctorAuthService → doctorStorageService → Firebase
     ↓
DoctorModuleRouter → PatientManagement → PatientDetails
     ↓
PrescriptionList → PrescriptionData
```

### Pharmacist Data Flow
```
User Login → pharmacistAuthService → pharmacistStorageService → Firebase
     ↓
PharmacistModuleRouter → PharmacistDashboard → PrescriptionTable
     ↓
InventoryManagement → DrugStockData
```

## Authentication Flow

### Doctor Authentication
1. User selects "Doctor" mode
2. `doctorAuthService.createDoctor()` or `doctorAuthService.signInDoctor()`
3. Firebase authentication
4. Local storage persistence
5. Doctor-specific data loading
6. DoctorModuleRouter activation

### Pharmacist Authentication
1. User selects "Pharmacist" mode
2. `pharmacistAuthService.createPharmacist()` or `pharmacistAuthService.signInPharmacist()`
3. Firebase authentication
4. Local storage persistence
5. Pharmacist-specific data loading
6. PharmacistModuleRouter activation

## Security Implementation

### Data Isolation
```javascript
// Doctor can only access their own patients
const getPatientsByDoctorId = async (doctorId) => {
  const patients = await firebaseStorage.getPatientsByDoctorId(doctorId)
  return patients // Only doctor's patients
}

// Pharmacist can only access their prescriptions
const getPrescriptionsByPharmacistId = async (pharmacistId) => {
  const prescriptions = await firebaseStorage.getPrescriptionsByPharmacistId(pharmacistId)
  return prescriptions // Only pharmacist's prescriptions
}
```

### Authentication Guards
```javascript
// Doctor authentication check
const isDoctorAuthenticated = () => {
  const doctor = doctorAuthService.getCurrentDoctor()
  return doctor && doctor.role === 'doctor'
}

// Pharmacist authentication check
const isPharmacistAuthenticated = () => {
  const pharmacist = pharmacistAuthService.getCurrentPharmacist()
  return pharmacist && pharmacist.role === 'pharmacist'
}
```

## Error Handling

### Service-Level Error Handling
```javascript
// Doctor service error handling
const createPatient = async (patientData, doctorId) => {
  try {
    if (!doctorId) throw new Error('Doctor ID required')
    const patient = await firebaseStorage.createPatient(patientData, doctorId)
    return patient
  } catch (error) {
    console.error('Error creating patient:', error)
    throw new Error('Failed to create patient')
  }
}
```

### Component-Level Error Handling
```javascript
// Component error handling
const handlePatientCreation = async (patientData) => {
  try {
    const patient = await doctorStorageService.createPatient(patientData, user.id)
    patients = [...patients, patient]
  } catch (error) {
    notifyError('Failed to create patient')
  }
}
```

## Performance Optimizations

### Lazy Loading
```javascript
// Dynamic imports for module-specific components
const DoctorModuleRouter = () => import('./components/doctor/DoctorModuleRouter.svelte')
const PharmacistModuleRouter = () => import('./components/pharmacist/PharmacistModuleRouter.svelte')
```

### Data Caching
```javascript
// Local storage caching for authentication
const saveCurrentDoctor = (doctor) => {
  localStorage.setItem('currentDoctor', JSON.stringify(doctor))
}

const getCurrentDoctor = () => {
  const doctor = localStorage.getItem('currentDoctor')
  return doctor ? JSON.parse(doctor) : null
}
```

## Testing Strategy

### Unit Tests
- Service layer tests for each module
- Authentication service tests
- Data processing utility tests
- Component isolation tests

### Integration Tests
- Module decoupling tests
- Cross-module isolation tests
- Authentication flow tests
- Data access security tests

### Performance Tests
- Module loading performance
- Data access performance
- Authentication performance
- Component rendering performance

## Deployment Considerations

### Build Configuration
```javascript
// Vite configuration for module separation
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'doctor-module': ['./src/components/doctor/DoctorModuleRouter.svelte'],
          'pharmacist-module': ['./src/components/pharmacist/PharmacistModuleRouter.svelte']
        }
      }
    }
  }
}
```

### Environment Variables
```bash
# Doctor module configuration
VITE_DOCTOR_API_URL=https://api.doctor.prescribe.com
VITE_DOCTOR_FEATURES=enabled

# Pharmacist module configuration
VITE_PHARMACIST_API_URL=https://api.pharmacist.prescribe.com
VITE_PHARMACIST_FEATURES=enabled
```

## Maintenance Guidelines

### Adding New Features
1. Determine which module the feature belongs to
2. Create module-specific service functions
3. Add module-specific components
4. Update module configuration
5. Add appropriate tests
6. Ensure no cross-module dependencies

### Modifying Existing Features
1. Identify the affected module
2. Update only module-specific services
3. Test module isolation
4. Verify no cross-module impact
5. Update documentation

### Debugging Issues
1. Check module-specific logs
2. Verify service isolation
3. Test authentication flows
4. Check data access patterns
5. Verify component isolation

## Benefits of Decoupling

### Development Benefits
- **Independent Development**: Teams can work on modules independently
- **Faster Iteration**: Changes to one module don't affect others
- **Easier Testing**: Module-specific testing is simpler
- **Better Code Organization**: Clear separation of concerns

### Security Benefits
- **Data Isolation**: Impossible to access other modules' data
- **Reduced Attack Surface**: Smaller, focused modules
- **Better Access Control**: Module-specific permissions
- **Audit Trail**: Clear data access patterns

### Performance Benefits
- **Smaller Bundles**: Only load necessary modules
- **Faster Loading**: Module-specific optimization
- **Better Caching**: Module-specific caching strategies
- **Reduced Memory Usage**: Load only active modules

---

**Last Updated**: December 2024
**Architecture Version**: 2.0
**Status**: Fully Implemented and Tested
