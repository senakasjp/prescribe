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


