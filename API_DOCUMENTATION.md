# API Documentation

## Firebase Services

### FirebaseStorageService

#### Doctor Operations
```javascript
// Create a new doctor
async createDoctor(doctorData)
// Parameters: { email, firstName, lastName, country, city, ... }
// Returns: { id, ...doctorData }

// Get doctor by ID
async getDoctorById(doctorId)
// Returns: Doctor object or null

// Update doctor profile
async updateDoctor(doctorId, updatedData)
// Returns: boolean (success/failure)

// Get all doctors (admin only)
async getAllDoctors()
// Returns: Array of doctor objects
```

#### Patient Operations
```javascript
// Create a new patient
async createPatient(patientData)
// Parameters: { firstName, lastName, dateOfBirth, phone, email, doctorId, ... }
// Returns: { id, ...patientData }

// Get patients by doctor ID
async getPatientsByDoctorId(doctorId)
// Returns: Array of patient objects

// Update patient information
async updatePatient(patientId, updatedData)
// Returns: boolean (success/failure)

// Delete patient
async deletePatient(patientId)
// Returns: boolean (success/failure)
```

#### Prescription Operations
```javascript
// Create a new prescription
async createPrescription(prescriptionData)
// Parameters: { patientId, doctorId, title, description, ... }
// Returns: { id, ...prescriptionData }

// Get prescriptions by patient ID
async getPrescriptionsByPatientId(patientId)
// Returns: Array of prescription objects

// Add medication to prescription
async addMedicationToPrescription(prescriptionId, medicationData)
// Parameters: { name, dosage, frequency, duration, instructions, ... }
// Returns: New medication object

// Clear prescription medications
async clearPrescriptionMedications(prescriptionId)
// Returns: boolean (success/failure)

// Update prescription
async updatePrescription(prescriptionId, updatedData)
// Returns: boolean (success/failure)

// Delete prescription
async deletePrescription(prescriptionId)
// Returns: boolean (success/failure)
```

#### Long-term Medications
```javascript
// Create long-term medication
async createLongTermMedication(medicationData)
// Parameters: { patientId, name, dosage, startDate, duration, ... }
// Returns: { id, ...medicationData }

// Get long-term medications by patient ID
async getLongTermMedicationsByPatientId(patientId)
// Returns: Array of long-term medication objects

// Update long-term medication
async updateLongTermMedication(medicationId, updatedData)
// Returns: boolean (success/failure)

// Delete long-term medication
async deleteLongTermMedication(medicationId)
// Returns: boolean (success/failure)
```

## OpenAI Service

### AIRecommendationsService

#### Drug Suggestions
```javascript
// Generate AI drug suggestions
async generateAIDrugSuggestions(symptoms, currentMedications, patientAge, doctorId, additionalContext)
// Parameters:
//   - symptoms: Array of symptom strings
//   - currentMedications: Array of current medication objects
//   - patientAge: Number (patient age in years)
//   - doctorId: String (doctor identifier)
//   - additionalContext: Object with patient data
// Returns: Array of drug suggestion objects

// Example additionalContext:
{
  patientCountry: "United States",
  patientAllergies: "Penicillin",
  patientGender: "Male",
  longTermMedications: "Metformin, Lisinopril",
  currentActiveMedications: [
    { name: "Amoxicillin", dosage: "500mg", duration: "7 days" }
  ],
  doctorCountry: "United States"
}
```

#### Combined Analysis
```javascript
// Generate combined medical analysis
async generateCombinedAnalysis(symptoms, currentMedications, patientAge, doctorId, patientAllergies, patientGender, longTermMedications, additionalContext)
// Parameters: Similar to drug suggestions
// Returns: Combined analysis object with conditions, treatment, interactions, and red flags
```

### Response Format

#### Drug Suggestions Response
```json
{
  "suggestions": [
    {
      "name": "Amoxicillin",
      "dosage": "500mg",
      "frequency": "Three times daily",
      "duration": "7 days",
      "instructions": "Take with or without food",
      "reason": "Effective for bacterial infections",
      "type": "prescription"
    }
  ]
}
```

#### Combined Analysis Response
```json
{
  "conditions": ["Upper respiratory infection", "Bacterial sinusitis"],
  "treatment": "Amoxicillin 500mg TID x 7 days",
  "interactions": "No significant drug interactions noted",
  "redFlags": "Monitor for allergic reactions"
}
```

## AI Token Tracker

### Token Management
```javascript
// Set doctor token quota
async setDoctorQuota(doctorId, quota)
// Parameters: doctorId (string), quota (number)
// Returns: boolean (success/failure)

// Get doctor quota
async getDoctorQuota(doctorId)
// Returns: number (quota amount)

// Track token usage
async trackTokenUsage(doctorId, tokensUsed)
// Parameters: doctorId (string), tokensUsed (number)
// Returns: boolean (success/failure)

// Get monthly usage
async getMonthlyUsage(doctorId, year, month)
// Returns: number (tokens used this month)

// Get quota status
async getQuotaStatus(doctorId)
// Returns: { used: number, quota: number, percentage: number, status: string }
```

### Configuration
```javascript
// Set default quota for all doctors
async setDefaultQuota(quota)
// Parameters: quota (number)
// Returns: boolean (success/failure)

// Set token price per million
async setTokenPrice(price)
// Parameters: price (number)
// Returns: boolean (success/failure)

// Apply default quota to all doctors
async applyDefaultQuotaToAll()
// Returns: boolean (success/failure)
```

## Authentication Service

### User Management
```javascript
// Get current user
getCurrentUser()
// Returns: User object or null

// Check authentication status
isAuthenticated()
// Returns: boolean

// Load user from storage
loadCurrentUser()
// Returns: User object or null

// Clear user session
clearUser()
// Returns: void
```

## Error Handling

### Common Error Types
```javascript
// Firebase errors
{
  code: "permission-denied",
  message: "User does not have permission to access this resource"
}

// OpenAI API errors
{
  code: "insufficient_quota",
  message: "AI quota exceeded. Please contact administrator."
}

// Validation errors
{
  code: "validation-error",
  message: "Required field is missing or invalid"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "error-code",
    "message": "Human-readable error message",
    "details": "Additional error details"
  }
}
```

## Rate Limiting

### OpenAI API Limits
- **Requests per minute**: 60
- **Tokens per minute**: 150,000
- **Max tokens per request**: 4,096

### Firebase Limits
- **Reads per day**: 50,000 (free tier)
- **Writes per day**: 20,000 (free tier)
- **Deletes per day**: 20,000 (free tier)

## Security Considerations

### Data Validation
- All inputs are sanitized before processing
- Email addresses are validated using regex
- Phone numbers are formatted consistently
- Dates are validated and normalized

### Access Control
- Doctor isolation: Each doctor can only access their own patients
- Role-based permissions for admin functions
- API key protection for OpenAI integration
- Secure token storage in localStorage

### Data Privacy
- Patient data is encrypted in transit
- No sensitive data in client-side logs
- Automatic session timeout
- Secure password requirements

## Usage Examples

### Creating a New Patient
```javascript
const patientData = {
  firstName: "John",
  lastName: "Doe",
  dateOfBirth: "1990-01-01",
  phone: "+1234567890",
  email: "john.doe@example.com",
  doctorId: "doctor123"
}

const newPatient = await firebaseStorage.createPatient(patientData)
console.log("Created patient:", newPatient.id)
```

### Generating AI Drug Suggestions
```javascript
const symptoms = ["fever", "cough", "headache"]
const currentMedications = []
const patientAge = 30
const doctorId = "doctor123"
const additionalContext = {
  patientCountry: "United States",
  patientAllergies: "None",
  patientGender: "Male",
  longTermMedications: "None",
  currentActiveMedications: [],
  doctorCountry: "United States"
}

const suggestions = await openaiService.generateAIDrugSuggestions(
  symptoms,
  currentMedications,
  patientAge,
  doctorId,
  additionalContext
)
console.log("AI suggestions:", suggestions)
```

### Tracking Token Usage
```javascript
const doctorId = "doctor123"
const tokensUsed = 150

await aiTokenTracker.trackTokenUsage(doctorId, tokensUsed)
const status = await aiTokenTracker.getQuotaStatus(doctorId)
console.log("Quota status:", status)
```

## Inventory Service

### Drug Inventory Management
```javascript
// Create new inventory item
async createInventoryItem(pharmacistId, inventoryData)
// Parameters: pharmacistId (string), inventoryData (object)
// inventoryData: { brandName, strength, strengthUnit, expiryDate, quantity, costPerUnit, supplier, ... }
// Returns: { id, ...inventoryData }

// Update inventory item
async updateInventoryItem(pharmacistId, itemId, updatedData)
// Parameters: pharmacistId (string), itemId (string), updatedData (object)
// Returns: boolean (success/failure)

// Get all inventory items for pharmacist
async getInventoryItems(pharmacistId)
// Parameters: pharmacistId (string)
// Returns: Array of inventory item objects

// Delete inventory item
async deleteInventoryItem(pharmacistId, itemId)
// Parameters: pharmacistId (string), itemId (string)
// Returns: boolean (success/failure)

// Check for duplicate primary key
async checkDuplicatePrimaryKey(pharmacistId, brandName, strength, strengthUnit, expiryDate, excludeId)
// Parameters: pharmacistId, brandName, strength, strengthUnit, expiryDate, excludeId (optional)
// Returns: boolean (true if duplicate found, throws error)
```

### Primary Key System
**CRITICAL BUSINESS RULE**: The primary key for inventory items is the combination of:
- **Brand Name + Strength + Strength Unit + Expiry Date**

This ensures:
- ✅ **Unique Identification**: Items are uniquely identified by brand + strength + unit + expiry
- ✅ **Duplicate Prevention**: No two items can exist with the same combination
- ✅ **FIFO Management**: Same drug with different expiry dates are separate inventory items
- ✅ **Batch Tracking**: Proper tracking of different batches by expiry date

### Example Usage
```javascript
import { inventoryService } from './services/pharmacist/inventoryService.js'

// Create inventory item
const inventoryData = {
  brandName: "Amoxicillin",
  strength: "500",
  strengthUnit: "mg",
  expiryDate: "2025-12-31",
  quantity: 100,
  costPerUnit: 2.50,
  supplier: "ABC Pharmaceuticals"
}

const newItem = await inventoryService.createInventoryItem(pharmacistId, inventoryData)

// Check for duplicates before creating
await inventoryService.checkDuplicatePrimaryKey(
  pharmacistId, 
  "Amoxicillin", 
  "500", 
  "mg", 
  "2025-12-31"
)
```

## PharmacyMedicationService

### Medication Search and Autofill
```javascript
// Search medications from connected pharmacy inventories
async searchMedicationsFromPharmacies(doctorId, query, limit)
// Parameters: doctorId (string), query (string), limit (number, default 10)
// Returns: Array of matching medications with brand/generic names

// Get all medication names from connected pharmacies
async getMedicationNamesFromPharmacies(doctorId)
// Parameters: doctorId (string)
// Returns: Array of all available medications from connected pharmacies

// Fetch medications from specific pharmacy
async fetchMedicationNamesFromPharmacy(pharmacyId)
// Parameters: pharmacyId (string)
// Returns: Array of medications from specific pharmacy inventory
```

### Data Structure
```javascript
// Medication object structure
{
  id: "medication_id",
  brandName: "Brand Name",           // Prioritized over drugName
  genericName: "Generic Name",
  displayName: "Brand Name (Generic Name)",
  strength: "500",
  dosageForm: "Tablet",
  manufacturer: "Manufacturer Name",
  pharmacyId: "pharmacy_id",
  currentStock: 100,
  packUnit: "tablets",
  expiryDate: "2025-12-31"
}
```

### Usage Examples
```javascript
// Search for medications with autofill
const medications = await pharmacyMedicationService.searchMedicationsFromPharmacies(
  doctorId, 
  "Amoxicillin", 
  20
)

// Get all available medications
const allMedications = await pharmacyMedicationService.getMedicationNamesFromPharmacies(doctorId)

// Enhanced search with debugging
console.log('🔍 Searching for:', query, 'Doctor:', doctorId)
const results = await pharmacyMedicationService.searchMedicationsFromPharmacies(doctorId, query, 10)
console.log('🎯 Matching medications:', results.length)
```


