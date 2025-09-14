# API Documentation

## 📋 Overview

The Patient Management System uses a local JSON storage service (`jsonStorage.js`) that provides a simple API for data persistence. This document outlines all available methods and their usage.

## 🔧 jsonStorage Service

### Core Methods

#### `loadData()`
Loads all data from localStorage and initializes the storage.

```javascript
const data = await jsonStorage.loadData();
```

**Returns**: Object containing all application data
**Side Effects**: Initializes storage if empty, cleans corrupted data

#### `saveData(data)`
Saves data to localStorage.

```javascript
await jsonStorage.saveData(data);
```

**Parameters**:
- `data` (Object): Complete data object to save

**Returns**: Promise<void>

### Doctor Management

#### `createDoctor(doctorData)`
Creates a new doctor record.

```javascript
const doctor = await jsonStorage.createDoctor({
  name: "Dr. John Smith",
  email: "john@example.com",
  password: "hashed_password",
  specialization: "General Practice"
});
```

**Parameters**:
- `doctorData` (Object): Doctor information

**Returns**: Promise<Object> - Created doctor with generated ID

#### `getDoctorById(id)`
Retrieves a doctor by ID.

```javascript
const doctor = jsonStorage.getDoctorById("doctor_123");
```

**Parameters**:
- `id` (String): Doctor ID

**Returns**: Object|null - Doctor data or null if not found

#### `getDoctorByEmail(email)`
Retrieves a doctor by email.

```javascript
const doctor = jsonStorage.getDoctorByEmail("john@example.com");
```

**Parameters**:
- `email` (String): Doctor email

**Returns**: Object|null - Doctor data or null if not found

### Patient Management

#### `createPatient(patientData)`
Creates a new patient record.

```javascript
const patient = await jsonStorage.createPatient({
  doctorId: "doctor_123",
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1990-01-01",
  gender: "Female",
  phone: "123-456-7890",
  email: "jane@example.com",
  address: "123 Main St",
  emergencyContact: "John Doe",
  emergencyPhone: "098-765-4321"
});
```

**Parameters**:
- `patientData` (Object): Patient information

**Returns**: Promise<Object> - Created patient with generated ID

#### `getPatientsByDoctorId(doctorId)`
Retrieves all patients for a specific doctor.

```javascript
const patients = jsonStorage.getPatientsByDoctorId("doctor_123");
```

**Parameters**:
- `doctorId` (String): Doctor ID

**Returns**: Array - List of patients

#### `getPatientById(id)`
Retrieves a patient by ID.

```javascript
const patient = jsonStorage.getPatientById("patient_456");
```

**Parameters**:
- `id` (String): Patient ID

**Returns**: Object|null - Patient data or null if not found

#### `updatePatient(id, updates)`
Updates an existing patient.

```javascript
const updatedPatient = await jsonStorage.updatePatient("patient_456", {
  phone: "111-222-3333"
});
```

**Parameters**:
- `id` (String): Patient ID
- `updates` (Object): Fields to update

**Returns**: Promise<Object> - Updated patient data

#### `deletePatient(id)`
Deletes a patient and all associated medical data.

```javascript
await jsonStorage.deletePatient("patient_456");
```

**Parameters**:
- `id` (String): Patient ID

**Returns**: Promise<void>

### Illness Management

#### `createIllness(illnessData)`
Creates a new illness record.

```javascript
const illness = await jsonStorage.createIllness({
  patientId: "patient_456",
  name: "Hypertension",
  description: "High blood pressure condition",
  status: "active",
  diagnosisDate: "2024-01-15",
  notes: "Regular monitoring required"
});
```

**Parameters**:
- `illnessData` (Object): Illness information

**Returns**: Promise<Object> - Created illness with generated ID

#### `getIllnessesByPatientId(patientId)`
Retrieves all illnesses for a specific patient.

```javascript
const illnesses = jsonStorage.getIllnessesByPatientId("patient_456");
```

**Parameters**:
- `patientId` (String): Patient ID

**Returns**: Array - List of illnesses

#### `updateIllness(id, updates)`
Updates an existing illness.

```javascript
const updatedIllness = await jsonStorage.updateIllness("illness_789", {
  status: "resolved"
});
```

**Parameters**:
- `id` (String): Illness ID
- `updates` (Object): Fields to update

**Returns**: Promise<Object> - Updated illness data

### Medication Management

#### `createMedication(medicationData)`
Creates a new medication record.

```javascript
const medication = await jsonStorage.createMedication({
  patientId: "patient_456",
  name: "Lisinopril",
  dosage: "10mg",
  instructions: "Take once daily with food",
  duration: "30 days",
  startDate: "2024-01-15",
  notes: "Monitor blood pressure"
});
```

**Parameters**:
- `medicationData` (Object): Medication information

**Returns**: Promise<Object> - Created medication with generated ID

#### `getMedicationsByPatientId(patientId)`
Retrieves all prescriptions for a specific patient.

```javascript
const medications = jsonStorage.getMedicationsByPatientId("patient_456");
```

**Parameters**:
- `patientId` (String): Patient ID

**Returns**: Array - List of prescriptions

#### `updateMedication(id, updates)`
Updates an existing medication.

```javascript
const updatedMedication = await jsonStorage.updateMedication("medication_101", {
  dosage: "20mg"
});
```

**Parameters**:
- `id` (String): Medication ID
- `updates` (Object): Fields to update

**Returns**: Promise<Object> - Updated medication data

### Symptoms Management

#### `createSymptoms(symptomsData)`
Creates a new symptoms record.

```javascript
const symptoms = await jsonStorage.createSymptoms({
  patientId: "patient_456",
  description: "Chest pain and shortness of breath",
  severity: "moderate",
  duration: "2 hours",
  onsetDate: "2024-01-15",
  notes: "Occurs during physical activity"
});
```

**Parameters**:
- `symptomsData` (Object): Symptoms information

**Returns**: Promise<Object> - Created symptoms with generated ID

#### `getSymptomsByPatientId(patientId)`
Retrieves all symptoms for a specific patient.

```javascript
const symptoms = jsonStorage.getSymptomsByPatientId("patient_456");
```

**Parameters**:
- `patientId` (String): Patient ID

**Returns**: Array - List of symptoms

#### `updateSymptoms(id, updates)`
Updates existing symptoms.

```javascript
const updatedSymptoms = await jsonStorage.updateSymptoms("symptoms_202", {
  severity: "severe"
});
```

**Parameters**:
- `id` (String): Symptoms ID
- `updates` (Object): Fields to update

**Returns**: Promise<Object> - Updated symptoms data

### Utility Methods

#### `generateId(prefix)`
Generates a unique ID with optional prefix.

```javascript
const id = jsonStorage.generateId("patient");
// Returns: "patient_1234567890"
```

**Parameters**:
- `prefix` (String, optional): ID prefix

**Returns**: String - Generated unique ID

#### `clearAllData()`
Clears all data from localStorage.

```javascript
await jsonStorage.clearAllData();
```

**Returns**: Promise<void>

#### `clearCorruptedData()`
Removes corrupted data entries.

```javascript
await jsonStorage.clearCorruptedData();
```

**Returns**: Promise<void>

#### `inspectData()`
Returns current data for debugging.

```javascript
const data = jsonStorage.inspectData();
console.log(data);
```

**Returns**: Object - Current data state

## 🔐 authService API

### Authentication Methods

#### `registerDoctor(doctorData)`
Registers a new doctor.

```javascript
const doctor = await authService.registerDoctor({
  name: "Dr. John Smith",
  email: "john@example.com",
  password: "secure_password",
  specialization: "General Practice"
});
```

**Parameters**:
- `doctorData` (Object): Doctor registration data

**Returns**: Promise<Object> - Created doctor

#### `signInDoctor(email, password)`
Authenticates a doctor.

```javascript
const doctor = await authService.signInDoctor("john@example.com", "secure_password");
```

**Parameters**:
- `email` (String): Doctor email
- `password` (String): Doctor password

**Returns**: Promise<Object> - Authenticated doctor

#### `signOut()`
Signs out the current doctor.

```javascript
authService.signOut();
```

**Returns**: void

#### `getCurrentUser()`
Gets the currently authenticated doctor.

```javascript
const doctor = authService.getCurrentUser();
```

**Returns**: Object|null - Current doctor or null

#### `clearCurrentUser()`
Clears the current user session.

```javascript
authService.clearCurrentUser();
```

**Returns**: void

## 📊 Data Models

### Doctor Model
```javascript
{
  id: String,           // Generated unique ID
  name: String,         // Doctor's full name
  email: String,        // Email address (unique)
  password: String,     // Hashed password
  specialization: String, // Medical specialization
  createdAt: Date,      // Creation timestamp
  updatedAt: Date       // Last update timestamp
}
```

### Patient Model
```javascript
{
  id: String,           // Generated unique ID
  doctorId: String,     // Associated doctor ID
  firstName: String,    // Patient's first name
  lastName: String,     // Patient's last name
  dateOfBirth: String,  // Date of birth (YYYY-MM-DD)
  gender: String,       // Gender
  phone: String,        // Phone number
  email: String,        // Email address
  address: String,      // Physical address
  emergencyContact: String, // Emergency contact name
  emergencyPhone: String,   // Emergency contact phone
  createdAt: Date,      // Creation timestamp
  updatedAt: Date       // Last update timestamp
}
```

### Illness Model
```javascript
{
  id: String,           // Generated unique ID
  patientId: String,    // Associated patient ID
  name: String,         // Illness name
  description: String,  // Detailed description
  status: String,       // active, chronic, resolved
  diagnosisDate: String, // Date of diagnosis
  notes: String,        // Additional notes
  createdAt: Date,      // Creation timestamp
  updatedAt: Date       // Last update timestamp
}
```

### Medication Model
```javascript
{
  id: String,           // Generated unique ID
  patientId: String,    // Associated patient ID
  name: String,         // Medication name
  dosage: String,       // Dosage information
  instructions: String, // Usage instructions
  duration: String,     // Treatment duration
  startDate: String,    // Start date
  notes: String,        // Additional notes
  createdAt: Date,      // Creation timestamp
  updatedAt: Date       // Last update timestamp
}
```

### Symptoms Model
```javascript
{
  id: String,           // Generated unique ID
  patientId: String,    // Associated patient ID
  description: String,  // Symptom description
  severity: String,     // mild, moderate, severe
  duration: String,     // Duration of symptoms
  onsetDate: String,    // Date symptoms started
  notes: String,        // Additional notes
  createdAt: Date,      // Creation timestamp
  updatedAt: Date       // Last update timestamp
}
```

## 🔍 Search API

### Patient Search
The search functionality is implemented in `PatientManagement.svelte` using the following criteria:

```javascript
// Search by multiple criteria
const searchPatients = () => {
  const query = searchQuery.toLowerCase().trim();
  
  filteredPatients = patients.filter(patient => {
    // Full name search
    const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
    if (fullName.includes(query)) return true;
    
    // Individual name search
    if (patient.firstName.toLowerCase().includes(query)) return true;
    if (patient.lastName.toLowerCase().includes(query)) return true;
    
    // ID search
    if (patient.idNumber.toLowerCase().includes(query)) return true;
    
    // Email search
    if (patient.email.toLowerCase().includes(query)) return true;
    
    // Phone search
    if (patient.phone && patient.phone.toLowerCase().includes(query)) return true;
    
    // Date of birth search
    if (patient.dateOfBirth && patient.dateOfBirth.includes(query)) return true;
    
    return false;
  }).slice(0, 20); // Limit to 20 results
};
```

## ⚠️ Error Handling

### Common Error Scenarios
1. **Data Validation Errors** - Invalid input data
2. **Storage Errors** - localStorage unavailable
3. **Authentication Errors** - Invalid credentials
4. **Data Corruption** - Invalid data format

### Error Response Format
```javascript
{
  error: true,
  message: "Error description",
  code: "ERROR_CODE",
  details: {} // Additional error details
}
```

## 🚀 Performance Considerations

### Optimization Strategies
- **Lazy Loading** - Load data only when needed
- **Search Limiting** - Maximum 20 search results
- **Data Cleanup** - Remove corrupted entries
- **Efficient Filtering** - Client-side array operations

### Memory Management
- **Data Validation** - Prevent invalid data storage
- **Cleanup Functions** - Remove unused data
- **Storage Limits** - Monitor localStorage usage
- **Error Recovery** - Handle data corruption gracefully

## 🔄 Migration Guide

### From Local Storage to Database
1. **Export Current Data** - Use `inspectData()` method
2. **Design Database Schema** - Map to database tables
3. **Create API Endpoints** - Replace localStorage calls
4. **Update Service Methods** - Modify jsonStorage.js
5. **Test Data Integrity** - Verify all data transfers correctly

### Backward Compatibility
- **Maintain API Interface** - Keep method signatures
- **Data Format Consistency** - Preserve data structure
- **Gradual Migration** - Support both storage methods
- **Fallback Support** - Local storage as backup
