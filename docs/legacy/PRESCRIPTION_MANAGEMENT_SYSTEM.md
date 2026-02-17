# Prescription Management System Documentation

## Overview
This document provides comprehensive documentation for the prescription management system implemented in the M-Prescribe application, including all features, components, and technical details.

## System Architecture

### Core Components
1. **PrescriptionList.svelte**: Main prescription display component
2. **PrescriptionsTab.svelte**: Prescription management within patient details
3. **PrescriptionPDF.svelte**: PDF generation and printing
4. **MedicationForm.svelte**: Medication creation and editing
5. **DrugAutocomplete.svelte**: AI-powered drug suggestions

### Data Flow
```
Patient → Prescription → Medications → AI Suggestions → PDF Generation
```

## Prescription Data Structure

### Prescription Object
```javascript
{
  id: "prescription_id",
  patientId: "patient_id",
  doctorId: "doctor_id",
  title: "Prescription Title",
  notes: "Prescription notes",
  medications: [
    {
      id: "medication_id",
      name: "Medication Name",
      dosage: "500mg",
      frequency: "Twice daily",
      duration: "7 days",
      instructions: "Take with food",
      notes: "Additional notes",
      aiSuggested: false,
      createdAt: "2024-12-01T10:00:00Z"
    }
  ],
  status: "active", // active, completed, cancelled
  createdAt: "2024-12-01T10:00:00Z",
  updatedAt: "2024-12-01T10:00:00Z"
}
```

### Medication Object
```javascript
{
  id: "medication_id",
  name: "Medication Name",
  dosage: "500mg",
  frequency: "Twice daily",
  duration: "7 days",
  instructions: "Take with food",
  notes: "Additional notes",
  aiSuggested: false,
  createdAt: "2024-12-01T10:00:00Z"
}
```

## Component Documentation

### PrescriptionList.svelte

#### Purpose
Displays a paginated list of all prescriptions with medications.

#### Features
- **Pagination**: 5 prescriptions per page
- **Sorting**: Newest prescriptions first
- **Medication Display**: Shows all medications for each prescription
- **Date Formatting**: Proper date display
- **Empty State**: Handles no prescriptions gracefully

#### Props
```javascript
export let prescriptions = [] // Array of prescription objects
```

#### Key Functions
```javascript
// Pagination functions
const goToPage = (page) => { /* Navigate to specific page */ }
const goToPreviousPage = () => { /* Go to previous page */ }
const goToNextPage = () => { /* Go to next page */ }

// Data processing
const getPrescriptionsWithMedications = () => { /* Filter and sort prescriptions */ }
const formatPrescriptionDate = (dateString) => { /* Format date for display */ }
```

#### Template Structure
```svelte
{#if prescriptionsWithMedications && prescriptionsWithMedications.length > 0}
  <div class="space-y-4">
    {#each prescriptionsWithMedications as prescription, prescriptionIndex}
      <div class="bg-white rounded-lg shadow-sm border-2 border-teal-200">
        <!-- Prescription Header -->
        <div class="bg-teal-600 text-white px-4 py-3 rounded-t-lg">
          <h6 class="text-lg font-semibold mb-0">
            Prescription #{startIndex + prescriptionIndex + 1} on {formatPrescriptionDate(prescription.createdAt)}
          </h6>
        </div>
        
        <!-- Medications List -->
        <div class="divide-y divide-gray-200">
          {#each prescription.medications as medication, medicationIndex}
            <!-- Medication details -->
          {/each}
        </div>
      </div>
    {/each}
    
    <!-- Pagination Controls -->
    {#if totalPages > 1}
      <!-- Previous/Next buttons and page numbers -->
    {/if}
  </div>
{:else}
  <div class="text-center py-8">
    <i class="fas fa-pills text-4xl text-gray-400 mb-3"></i>
    <p class="text-gray-500">No prescriptions found for this patient.</p>
  </div>
{/if}
```

### PrescriptionsTab.svelte

#### Purpose
Manages prescription creation and medication management within patient details.

#### Features
- **New Prescription**: Create new prescriptions
- **Add Medications**: Add medications to current prescription
- **AI Drug Suggestions**: AI-powered medication recommendations
- **Medication Management**: Edit, delete medications
- **Prescription Finalization**: Complete prescription process
- **Pharmacy Selection**: Send prescriptions to pharmacies

#### Props
```javascript
export let selectedPatient
export let showMedicationForm
export let editingMedication
export let doctorId
export let currentMedications
export let prescriptionsFinalized
export let showAIDrugSuggestions
export let aiDrugSuggestions
export let currentPrescription
export let loadingAIDrugSuggestions
export let symptoms
export let openaiService
```

#### Key Functions
```javascript
// Prescription management
const onNewPrescription = () => { /* Create new prescription */ }
const onAddDrug = () => { /* Add medication to prescription */ }
const onFinalizePrescription = () => { /* Complete prescription */ }

// AI suggestions
const onGenerateAIDrugSuggestions = () => { /* Generate AI suggestions */ }
const onAddAISuggestedDrug = (drug) => { /* Add AI suggested drug */ }
const onRemoveAISuggestedDrug = (drug) => { /* Remove AI suggested drug */ }

// Medication management
const onMedicationAdded = (medication) => { /* Handle medication addition */ }
const onCancelMedication = () => { /* Cancel medication editing */ }
const onEditPrescription = (prescription) => { /* Edit existing prescription */ }
const onDeletePrescription = (prescription) => { /* Delete prescription */ }
const onDeleteMedicationByIndex = (index) => { /* Delete medication by index */ }
```

### MedicationForm.svelte

#### Purpose
Form component for creating and editing medications.

#### Features
- **Medication Details**: Name, dosage, frequency, duration
- **Instructions**: Detailed medication instructions
- **Notes**: Additional medication notes
- **Validation**: Input validation and error handling
- **AI Integration**: AI-powered drug suggestions

#### Props
```javascript
export let selectedPatient
export let editingMedication
export let doctorId
export let onMedicationAdded
export let onCancelMedication
```

#### Form Fields
```javascript
let medicationData = {
  name: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
  notes: '',
  aiSuggested: false
}
```

### DrugAutocomplete.svelte

#### Purpose
AI-powered drug suggestion component with autocomplete functionality.

#### Features
- **Drug Search**: Search for medications
- **AI Suggestions**: AI-powered drug recommendations
- **Autocomplete**: Real-time search suggestions
- **Drug Information**: Display drug details
- **Integration**: Seamless integration with medication forms

#### Props
```javascript
export let selectedPatient
export let symptoms
export let openaiService
export let onDrugSelected
export let loading
```

## AI Integration

### OpenAI Service Integration
```javascript
// Generate AI drug suggestions
const generateAIDrugSuggestions = async () => {
  try {
    loadingAIDrugSuggestions = true
    const suggestions = await openaiService.generateDrugSuggestions(
      selectedPatient,
      symptoms
    )
    aiDrugSuggestions = suggestions
  } catch (error) {
    console.error('Error generating AI suggestions:', error)
  } finally {
    loadingAIDrugSuggestions = false
  }
}
```

### AI Token Tracking
```javascript
// Track AI usage for billing
const trackAIUsage = async (tokensUsed) => {
  await aiTokenTracker.trackUsage(user.id, tokensUsed)
}
```

## Prescription Templates

### Template Types
1. **Printed Letterheads**: Custom printed templates
2. **Uploaded Headers**: User-uploaded header images
3. **System Templates**: Default system templates

### Template Configuration
```javascript
let templateSettings = {
  type: 'system', // 'printed', 'upload', 'system'
  headerSize: 200, // For printed templates
  uploadedHeader: null, // For uploaded templates
  doctorName: '',
  practiceName: '',
  address: '',
  phone: '',
  email: ''
}
```

### Template Preview
```javascript
const generatePrescriptionPreview = () => {
  if (templateType === 'printed') {
    templatePreview = {
      type: 'printed',
      headerSpace: headerSize,
      doctorName: user?.name || 'Dr. [Your Name]',
      practiceName: `${user?.firstName || ''} ${user?.lastName || ''} Medical Practice`,
      address: `${user?.city || 'City'}, ${user?.country || 'Country'}`,
      phone: '+1 (555) 123-4567',
      email: user?.email || 'doctor@example.com'
    }
  }
  // ... other template types
}
```

## PDF Generation

### PrescriptionPDF.svelte (v2.3)

#### PDF Formatting Specifications

**Current Version**: v2.3 (February 2026)

#### Page Layout
- **Page Size**: A5 (148mm x 210mm)
- **Margins**: 20mm (left, right, top, bottom)
- **Content Width**: 108mm (page width - margins)
- **Multi-page Support**: Headers and footers on all pages

#### Font Hierarchy
```
Section Headings:     11pt (bold) - PATIENT INFORMATION, PRESCRIPTION MEDICATIONS, ADDITIONAL NOTES
Patient Details:      10pt (normal) - Name, Age, Sex, Date, Prescription #
Medication Details:    9pt (normal) - Drug names, dosage, frequency, duration, instructions
Footer Text:           8pt (normal) - Version number
Footer Disclaimer:     7pt (normal) - Validity statement
```

#### PDF Structure

**1. Custom Header Section** (Variable height based on template type)
- **System Header**: html2canvas rendered custom header with rich text and images
  - Uses advanced CSS normalization for proper rendering
  - Font scaling (1.8x) for better PDF readability
  - Image centering with flexbox and margin: auto
  - Scale: 4 for high-quality capture
- **Uploaded Header**: Image header with aspect ratio preservation
  - Max width: 108mm (page width - margins)
  - Height: Auto (maintains aspect ratio)
  - Centered horizontally
- **Printed Letterhead**: Reserved space for pre-printed letterhead
  - Height: Configurable (default 50mm)
  - Visual placeholder in preview mode

**Horizontal Line After Header**: 0.5pt line, 2mm below header

**2. Patient Information Section** (starts 5mm below header line)
- **Line 1**: Name (left) | Date (right)
- **Line 2**: Age (left) | Prescription # (right)
- **Line 3**: Sex/Gender (left)
- **Spacing**: 6mm between lines

**3. Prescription Medications Section** (starts 31mm below patient info header)
- **Section Heading**: "PRESCRIPTION MEDICATIONS" (11pt bold)
- **Each Medication**:
  - Drug name and dosage (10pt bold, same line)
  - Frequency and duration (9pt normal)
  - Instructions (9pt normal, italic)
  - Additional notes (if present, 9pt normal, italic)
  - 6mm spacing between medications
- **Page Break Logic**: New page if < 30mm remaining space

**4. Additional Notes Section** (if notes exist)
- **Section Heading**: "ADDITIONAL NOTES" (11pt bold)
- **Content**: 9pt normal, wrapped to content width
- **Page Break Logic**: New page if < 60mm remaining space

**5. Footer** (on every page)
- **Left**: Validity statement (7pt) - "This prescription is valid for 30 days from the date of issue."
- **Right**: Version number (8pt) - "M-Prescribe v2.3"

#### Multi-Page Support (v2.2.19+)
- **Header Replication**: Captured header image appears on every page
- **Horizontal Lines**: Added after header on all pages
- **Footer Consistency**: Footer appears on every page
- **Content Flow**: Automatic pagination for medications and notes

#### Technical Implementation
```javascript
// PDF generation using jsPDF and html2canvas
const generatePDF = async () => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5'
  })
  const pageWidth = 148
  const pageHeight = 210
  const margin = 20
  
  // 1. Capture custom header (if system template)
  if (templateSettings.templateType === 'system') {
    // Use html2canvas to capture header HTML
    const canvas = await html2canvas(headerElement, {
      backgroundColor: 'white',
      scale: 4, // High-quality capture
      useCORS: true,
      allowTaint: true
    })
    const imgData = canvas.toDataURL('image/png')
    // Add to PDF with proper sizing and centering
    doc.addImage(imgData, 'PNG', headerX, headerYStart, headerWidth, headerHeight)
  }
  
  // 2. Add horizontal line after header
  const lineY = headerYStart + headerHeight + 2
  doc.setLineWidth(0.5)
  doc.line(margin, lineY, pageWidth - margin, lineY)
  
  // 3. Patient Information Section (11pt bold heading)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('PATIENT INFORMATION', margin, contentYStart)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Name: ${patient.firstName} ${patient.lastName}`, margin, contentYStart + 7)
  doc.text(`Date: ${currentDate}`, pageWidth - margin, contentYStart + 7, { align: 'right' })
  doc.text(`Age: ${patientAge}`, margin, contentYStart + 13)
  doc.text(`Prescription #: ${prescriptionId}`, pageWidth - margin, contentYStart + 13, { align: 'right' })
  doc.text(`Sex: ${patientSex}`, margin, contentYStart + 19)
  
  // 4. Medications Section (11pt bold heading)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('PRESCRIPTION MEDICATIONS', margin, yPos)
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  medications.forEach((medication) => {
    // Check page break
    if (yPos > pageHeight - 30) {
      doc.addPage()
      // Add header to new page
      if (capturedHeaderImage) {
        doc.addImage(capturedHeaderImage, 'PNG', capturedHeaderX, headerYStart, capturedHeaderWidth, capturedHeaderHeight)
        const lineY = headerYStart + capturedHeaderHeight + 2
        doc.setLineWidth(0.5)
        doc.line(margin, lineY, pageWidth - margin, lineY)
        yPos = lineY + 5
      }
    }
    // Render medication details
  })
  
  // 5. Additional Notes (11pt bold heading)
  if (prescriptionNotes) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('ADDITIONAL NOTES', margin, yPos)
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const notes = doc.splitTextToSize(prescriptionNotes, contentWidth)
    doc.text(notes, margin, yPos + 5)
  }
  
  // 6. Footer on every page
  doc.setFontSize(7)
  doc.text('This prescription is valid for 30 days from the date of issue.', margin, pageHeight - 5)
  doc.setFontSize(8)
  doc.text('M-Prescribe v2.3', pageWidth - margin, pageHeight - 5, { align: 'right' })
  
  // Open in new window instead of download
  const pdfBlob = doc.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}
```

#### Key Features
- **HTML to PDF Conversion**: Uses html2canvas for pixel-perfect header rendering
- **Font Scaling**: Intelligent font size management (1.8x multiplier for text, 48px for H1, 36px for other headings)
- **Image Handling**: Proper image centering with CSS flexbox and margin: auto
- **Content Cleaning**: Automatic removal of editing artifacts before capture
- **Multi-page Headers**: Captured header image stored and reused on all pages
- **Responsive Layout**: Automatic pagination based on content length
- **Professional Typography**: Consistent font hierarchy throughout document

## Database Operations

### Firebase Storage Service
```javascript
// Create prescription
const createPrescription = async (patientId, doctorId, title, notes) => {
  const prescription = {
    patientId,
    doctorId,
    title,
    notes,
    medications: [],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  const docRef = await addDoc(collection(db, 'prescriptions'), prescription)
  return { id: docRef.id, ...prescription }
}

// Get prescriptions by doctor
const getPrescriptionsByDoctorId = async (doctorId) => {
  const q = query(
    collection(db, 'prescriptions'),
    where('doctorId', '==', doctorId),
    orderBy('createdAt', 'desc')
  )
  
  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// Update prescription
const updatePrescription = async (prescriptionId, updates) => {
  await updateDoc(doc(db, 'prescriptions', prescriptionId), {
    ...updates,
    updatedAt: new Date().toISOString()
  })
}
```

## Pagination System

### PrescriptionList Pagination
```javascript
// Pagination state
let currentPage = 1
let itemsPerPage = 5

// Pagination calculations
$: totalPages = Math.ceil(allPrescriptions.length / itemsPerPage)
$: startIndex = (currentPage - 1) * itemsPerPage
$: endIndex = startIndex + itemsPerPage
$: prescriptionsWithMedications = allPrescriptions.slice(startIndex, endIndex)

// Pagination functions
const goToPage = (page) => {
  if (page >= 1 && page <= totalPages) {
    currentPage = page
  }
}

const goToPreviousPage = () => {
  if (currentPage > 1) {
    currentPage--
  }
}

const goToNextPage = () => {
  if (currentPage < totalPages) {
    currentPage++
  }
}
```

### PharmacistDashboard Pagination
```javascript
// Pagination state
let currentPrescriptionPage = 1
let prescriptionsPerPage = 10

// Pagination calculations
$: totalPrescriptionPages = Math.ceil(prescriptions.length / prescriptionsPerPage)
$: prescriptionStartIndex = (currentPrescriptionPage - 1) * prescriptionsPerPage
$: prescriptionEndIndex = prescriptionStartIndex + prescriptionsPerPage
$: paginatedPrescriptions = prescriptions.slice(prescriptionStartIndex, prescriptionEndIndex)
```

## Error Handling

### Service-Level Error Handling
```javascript
const createPrescription = async (patientId, doctorId, title, notes) => {
  try {
    if (!patientId || !doctorId) {
      throw new Error('Patient ID and Doctor ID are required')
    }
    
    const prescription = await firebaseStorage.createPrescription(
      patientId, doctorId, title, notes
    )
    
    return prescription
  } catch (error) {
    console.error('Error creating prescription:', error)
    throw new Error('Failed to create prescription')
  }
}
```

### Component-Level Error Handling
```javascript
const handlePrescriptionCreation = async () => {
  try {
    const prescription = await createPrescription(
      selectedPatient.id,
      doctorId,
      'New Prescription',
      'Prescription created from Prescriptions tab'
    )
    
    currentPrescription = prescription
    prescriptions = [...prescriptions, prescription]
    
    notifySuccess('Prescription created successfully')
  } catch (error) {
    notifyError('Failed to create prescription')
  }
}
```

## Performance Optimizations

### Data Loading
```javascript
// Lazy loading of prescriptions
const loadPrescriptions = async () => {
  if (user && user.role === 'doctor') {
    try {
      prescriptions = await firebaseStorage.getPrescriptionsByDoctorId(user.id)
    } catch (error) {
      console.error('Error loading prescriptions:', error)
      prescriptions = []
    }
  }
}
```

### Component Optimization
```javascript
// Memoized prescription processing
$: processedPrescriptions = useMemo(() => {
  return prescriptions
    .filter(p => p.medications && p.medications.length > 0)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}, [prescriptions])
```

## Testing

### Unit Tests
```javascript
// PrescriptionList component test
describe('PrescriptionList', () => {
  test('should display prescriptions with pagination', () => {
    const prescriptions = [
      { id: '1', medications: [{ name: 'Aspirin' }], createdAt: '2024-12-01' },
      { id: '2', medications: [{ name: 'Ibuprofen' }], createdAt: '2024-12-02' }
    ]
    
    render(PrescriptionList, { props: { prescriptions } })
    
    expect(screen.getByText('Prescription #1')).toBeInTheDocument()
    expect(screen.getByText('Prescription #2')).toBeInTheDocument()
  })
})
```

### Integration Tests
```javascript
// Prescription creation flow test
describe('Prescription Creation Flow', () => {
  test('should create prescription and add medications', async () => {
    const patient = { id: 'patient1', name: 'John Doe' }
    const doctor = { id: 'doctor1', name: 'Dr. Smith' }
    
    const prescription = await createPrescription(
      patient.id,
      doctor.id,
      'Test Prescription',
      'Test notes'
    )
    
    expect(prescription.patientId).toBe(patient.id)
    expect(prescription.doctorId).toBe(doctor.id)
    expect(prescription.title).toBe('Test Prescription')
  })
})
```

## Security Considerations

### Data Validation
```javascript
const validatePrescription = (prescription) => {
  if (!prescription.patientId) {
    throw new Error('Patient ID is required')
  }
  if (!prescription.doctorId) {
    throw new Error('Doctor ID is required')
  }
  if (!prescription.title) {
    throw new Error('Prescription title is required')
  }
  return true
}
```

### Access Control
```javascript
const canAccessPrescription = (prescription, user) => {
  if (user.role === 'doctor') {
    return prescription.doctorId === user.id
  }
  if (user.role === 'pharmacist') {
    return prescription.pharmacistId === user.id
  }
  return false
}
```

## Future Enhancements

### Planned Features
1. **Prescription Templates**: More template options
2. **Drug Interactions**: Check for drug interactions
3. **Dosage Calculator**: Automatic dosage calculations
4. **Prescription History**: Enhanced history tracking
5. **Mobile App**: Mobile prescription management

### Performance Improvements
1. **Caching**: Implement prescription caching
2. **Offline Support**: Offline prescription management
3. **Real-time Updates**: WebSocket integration
4. **Bulk Operations**: Bulk prescription operations

---

**Last Updated**: December 2024
**System Version**: 2.0
**Status**: Fully Functional and Deployed
