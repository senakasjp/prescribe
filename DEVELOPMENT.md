# Development Guide

## 📋 Recent Updates (January 16, 2025)

### **🏥 Dispensed Status Integration System (Latest)**
- **Service Layer Architecture**: Implemented `prescriptionStatusService.js` for secure cross-portal communication
- **Prescription ID Mapping**: Robust system handles different ID formats between doctor and pharmacist systems
- **Last Prescription Card Enhancement**: Added dispensed badges showing individual medication status
- **Decoupled Architecture**: Maintains strict separation between doctor and pharmacist portals
- **Medical Summary Cleanup**: Removed redundant dispensed status indicators for cleaner interface
- **Error Handling & Recovery**: Comprehensive error handling with graceful fallback mechanisms
- **Performance Optimization**: Efficient queries with proper indexing and caching strategies

**Technical Implementation**:
```javascript
// In prescriptionStatusService.js
export async function getPatientPrescriptionsStatus(patientId, doctorId) {
  const prescriptionsRef = collection(db, 'pharmacistPrescriptions')
  const q = query(
    prescriptionsRef,
    where('patientId', '==', patientId),
    where('doctorId', '==', doctorId)
  )
  
  const prescriptionsSnapshot = await getDocs(q)
  const patientStatus = {}
  
  prescriptionsSnapshot.forEach((doc) => {
    const data = doc.data()
    const statusInfo = {
      isDispensed: data.status === 'dispensed' || !!data.dispensedAt,
      dispensedAt: data.dispensedAt || data.updatedAt,
      dispensedBy: data.pharmacistName || 'Pharmacy',
      dispensedMedications: data.dispensedMedications || []
    }
    
    // Multiple mapping strategies
    patientStatus[data.prescriptionId || doc.id] = statusInfo
    
    // Map using prescriptions field
    if (data.prescriptions && data.prescriptions.length > 0) {
      data.prescriptions.forEach(pres => {
        if (pres.id) {
          patientStatus[pres.id] = statusInfo
        }
      })
    }
  })
  
  return patientStatus
}

// In PatientManagement.svelte
const isMedicationDispensed = (prescriptionId, medicationId) => {
  const dispensedInfo = getPrescriptionDispensedInfo(prescriptionId)
  
  if (!dispensedInfo.dispensedMedications || !Array.isArray(dispensedInfo.dispensedMedications)) {
    return false
  }
  
  return dispensedInfo.dispensedMedications.some(dispensedMed => 
    dispensedMed.medicationId === medicationId || 
    dispensedMed.name === medicationId
  )
}
```

**Security & Decoupling Rules**:
- No direct database access between portals
- Service layer only for cross-portal communication
- Authentication required for all requests
- Read-only access for doctor portal
- Comprehensive logging for audit trails

### **📝 Prescription Notes System**
- **Notes Field Implementation**: Added prescription notes textarea in `PrescriptionsTab.svelte` component
- **Data Binding Integration**: Implemented two-way binding between `PatientDetails.svelte` and `PrescriptionsTab.svelte`
- **Strategic UI Placement**: Notes field positioned at bottom of prescription form, after medications list
- **PDF Integration**: Notes automatically included in prescription PDF generation
- **Professional Styling**: Consistent with app design using Flowbite components and teal color scheme
- **Icon Integration**: Added sticky note icon (fas fa-sticky-note) for visual clarity
- **Form Validation**: Proper form labels, focus management, and accessibility compliance
- **Data Persistence**: Notes saved with prescription data and available across sessions

**Technical Implementation**:
```javascript
// In PrescriptionsTab.svelte
export let prescriptionNotes = ''

// Notes field HTML
<div class="mt-4">
  <label for="prescriptionNotes" class="block text-sm font-medium text-gray-700 mb-2">
    <i class="fas fa-sticky-note mr-1"></i>Prescription Notes
  </label>
  <textarea
    id="prescriptionNotes"
    bind:value={prescriptionNotes}
    rows="3"
    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
    placeholder="Additional instructions or notes for the prescription..."
  ></textarea>
</div>

// In PatientDetails.svelte
bind:prescriptionNotes
```

### **💊 Individual Drug Dispatch System**
- **Granular Medication Selection**: Implemented individual checkboxes for each medication in prescriptions
- **Smart State Management**: Used `Set` data structure to track selected medications with unique keys
- **Responsive UI Components**: Desktop table checkboxes and mobile card checkboxes for seamless experience
- **Enhanced Validation**: Button disabled until selection with clear warning messages
- **Dynamic Button Text**: Shows count of selected medications (e.g., "Mark 2 as Dispensed")
- **Professional Notifications**: Integrated with existing notification system for user feedback

### **⚠️ Enhanced Warning & UX System**
- **User-Friendly Error Messages**: Clear warnings with emoji indicators and step-by-step instructions
- **Preventive UX Design**: System prevents user confusion by explaining exactly what needs to be done
- **Accessibility Focus**: Clear, actionable messages that guide users through proper workflow
- **Professional Styling**: Consistent with existing notification system using error styling

### **🎯 Previous Critical Bug Fixes**
- **Send to Pharmacy Button**: Fixed non-functional button due to undefined variable reference (`prescriptionsToSend` → `prescriptions`)
- **Font Contrast Issues**: Resolved poor text readability in dark mode across all components by replacing `text-muted` with `text-gray-600 dark:text-gray-300`
- **Popup Modal Contrast**: Fixed contrast issues in all popup windows and modals for better accessibility
- **AI Token Data Retention**: Fixed AI usage data not persisting due to null doctorId values with validation and migration
- **AI Suggestions Availability**: Enhanced AI suggestions to work without requiring manual drug additions first

### **🟠 Dynamic Stock Availability System**
- **Smart Badge Implementation**: Real-time stock monitoring with color-coded availability indicators
- **Initial Quantity Tracking**: System tracks initial stock quantities for accurate low-stock detection
- **Pharmacy Integration**: Doctors can see medication availability from connected pharmacies
- **Stock Management**: Comprehensive inventory management for pharmacists with quantity, strength, and expiry tracking
- **Visual Stock Alerts**: Orange badges for normal stock, red badges for low stock (≤10% of initial)

### **🔥 Firebase-Only Migration**
- **Complete Migration**: All data operations now use Firebase Firestore exclusively
- **Component Updates**: Migrated all components from `jsonStorage` to `firebaseStorage`
- **Service Integration**: Updated all services to use Firebase operations
- **Data Persistence**: Cloud-based storage with real-time synchronization
- **Scalable Architecture**: Supports multiple doctors and patients with proper isolation

### **🔧 Critical Fixes**
- **Prescription Data Persistence**: Fixed issue where medications disappeared on page refresh
- **Firebase Index Issues**: Resolved Firebase compound query index errors by removing orderBy clauses from queries
- **Prescription Structure**: Implemented proper prescription-medication hierarchy
- **Data Loading**: Enhanced data initialization for existing prescriptions
- **Doctor-Patient Isolation**: Doctors only see patients they created
- **MedicalSummary Data Display**: Fixed "Unknown prescription" and "No dosage" issues by properly extracting medications from prescriptions

### **🎯 Simplified Prescription Logic**
- **New Prescription Button**: Always creates a new prescription when clicked (simple rule)
- **Clear Workflow**: Removed automatic prescription creation from "Add Drug" button
- **User-Friendly Messages**: Added helpful error messages and success notifications
- **Button States**: "Add Drug" button disabled until prescription exists
- **Consistent Behavior**: Predictable prescription management workflow

### **🎨 UI/UX Improvements**
- **Responsive Header**: Fixed mobile responsiveness with proper Bootstrap 5 layout
- **Prescription Card**: Wrapped prescription functionality in professional card design
- **Optional Start Date**: Made medication start date optional with smart defaults
- **Patient Editing**: Enhanced patient data editing with comprehensive validation
- **Gender Selection**: Added gender field to patient forms
- **City Field**: Added compulsory city field to doctor profiles with country-based dropdown
- **Enhanced Card Borders**: Applied consistent light blue borders to all card components for better visual separation
- **Colored Navigation Tabs**: Converted patient tabs to colored buttons with black border container for enhanced visibility
- **Dashboard Card Styling**: Neutralized dashboard statistics card borders for cleaner appearance

### **📊 Data Model Enhancements**
- **Prescription Containers**: Medications now properly stored within prescription objects
- **Firebase Integration**: All CRUD operations use Firebase Firestore
- **Storage Optimization**: Improved data persistence and loading mechanisms
- **Pharmacist Integration**: Complete Firebase-based pharmacist-doctor connection system
- **Sri Lanka Districts**: Added all 25 districts of Sri Lanka to city selection
- **Prescription History Display**: Enhanced prescription history with grouped display showing "Prescription #X on date" with Bootstrap 5 styling

### **👤 Profile Management Fixes**
- **User Object Integration**: Fixed issue where EditProfile component received incomplete user data
- **Database Lookup**: Enhanced `handleEditProfile` to fetch complete doctor data from database
- **Form Initialization**: Improved form field population with proper reactive statements
- **UI Reactivity**: Fixed real-time UI updates after profile changes
- **Data Merging**: Properly merge Firebase user data with database profile data

### **🔥 Firebase Integration Fixes**
- **Authentication Flow**: Fixed Firebase auth listener to properly call doctor creation logic
- **Dual Authentication Support**: Both Google and local authentication now create Firebase doctor records
- **Pharmacist Connection**: Resolved "Doctor not found" errors by ensuring doctors exist in Firebase
- **Error Handling**: Added comprehensive error logging and fallback mechanisms
- **Data Synchronization**: Local authentication now syncs doctor data to Firebase automatically

## 🛠️ Development Setup

### Prerequisites
- **Node.js** (v16 or higher)
- **npm** or **yarn** package manager
- **Modern Browser** (Chrome, Firefox, Safari, Edge)
- **Code Editor** (VS Code recommended)

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd M-Prescribe

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development Server
- **URL**: `http://localhost:5173`
- **Hot Reload**: Automatic page refresh on changes
- **Build Tool**: Vite for fast development

## 📁 Project Structure

```
M-Prescribe/
├── src/
│   ├── components/           # Svelte components
│   │   ├── App.svelte       # Main application
│   │   ├── DoctorAuth.svelte # Authentication
│   │   ├── PatientManagement.svelte # Patient list and management
│   │   ├── PatientDetails.svelte # Patient details and forms
│   │   ├── PatientForm.svelte # Add/edit patient
│   │   ├── IllnessForm.svelte # Add illness
│   │   ├── MedicationForm.svelte # Add/edit medication with autocomplete
│   │   ├── SymptomsForm.svelte # Add symptoms
│   │   ├── PrescriptionPDF.svelte # PDF generation
│   │   ├── DrugAutocomplete.svelte # Drug name autocomplete
│   │   ├── Notification.svelte # Individual notification component
│   │   ├── NotificationContainer.svelte # Notification display
│   │   ├── PatientList.svelte # Patient list component
│   │   ├── PatientTabs.svelte # Patient tab navigation
│   │   ├── PatientForms.svelte # Patient form management
│   │   ├── PrescriptionList.svelte # Prescription list component
│   │   ├── MedicalSummary.svelte # Medical summary sidebar
│   │   ├── PharmacistDashboard.svelte # Pharmacist portal with individual dispatch
│   │   ├── PharmacistManagement.svelte # Pharmacist connection management
│   │   └── pharmacist/ # Pharmacist-specific components
│   │       └── InventoryDashboard.svelte # Advanced inventory management
│   ├── services/            # Business logic
│   │   ├── jsonStorage.js   # Data persistence
│   │   ├── authService.js   # Authentication
│   │   └── drugDatabase.js  # Doctor-specific drug database
│   ├── stores/              # State management
│   │   └── notifications.js # Global notification store
│   └── main.js             # Entry point
├── public/                  # Static assets
├── index.html              # HTML template
├── package.json            # Dependencies
├── vite.config.js          # Vite configuration
└── README.md               # Documentation
```

## 🎯 Development Principles

### Code Style
- **Minimal Changes** - Make only necessary changes
- **Modular Design** - Keep components focused and reusable
- **Bootstrap 5** - Use Bootstrap classes for styling
- **Font Awesome** - Use Font Awesome icons consistently
- **Responsive Design** - Mobile-first approach

### Component Guidelines
- **Single Responsibility** - Each component has one purpose
- **Props Interface** - Clear prop definitions
- **Event Handling** - Use Svelte's event system
- **State Management** - Local state with reactive statements
- **Error Handling** - Graceful error handling

### CSS Guidelines
- **Bootstrap Classes** - Prefer Bootstrap over custom CSS
- **Scoped Styles** - Use Svelte's scoped CSS
- **Responsive Utilities** - Use Bootstrap responsive classes
- **Consistent Naming** - Follow Bootstrap naming conventions

## 👤 Profile Management Implementation

### Profile Editing Architecture
The profile editing system consists of several interconnected components:

#### App.svelte - Main Controller
```javascript
// Enhanced handleEditProfile function
const handleEditProfile = async () => {
  // Check if user has complete profile data
  if (!user?.firstName || !user?.lastName || !user?.country) {
    // Fetch complete doctor data from database
    const doctorData = jsonStorage.getDoctorByEmail(user.email)
    if (doctorData) {
      // Merge database data with current user
      user = { ...user, ...doctorData }
    }
  }
  showEditProfileModal = true
}
```

#### EditProfile.svelte - Form Component
```javascript
// Form initialization with onMount
onMount(() => {
  initializeForm()
})

// Reactive initialization when user changes
$: if (user) {
  initializeForm()
}

const initializeForm = () => {
  if (user) {
    firstName = user.firstName || ''
    lastName = user.lastName || ''
    email = user.email || ''
    country = user.country || ''
  }
}
```

#### PatientManagement.svelte - UI Updates
```javascript
// Reactive statements for UI updates
$: doctorName = user ? (user.firstName && user.lastName ? 
  `${user.firstName} ${user.lastName}` : user.firstName || user.displayName || user.email || 'Doctor') : 'Doctor'
$: doctorCountry = user?.country || 'Not specified'
```

## 💊 Individual Drug Dispatch Implementation

### Core State Management
The individual drug dispatch system uses a `Set` data structure to track selected medications:

```javascript
// State variable for tracking selected medications
let dispensedMedications = new Set()

// Function to toggle medication selection
function toggleMedicationDispatch(prescriptionId, medicationId) {
  const key = `${prescriptionId}-${medicationId}`
  if (dispensedMedications.has(key)) {
    dispensedMedications.delete(key)
  } else {
    dispensedMedications.add(key)
  }
  // Trigger reactivity by creating new Set
  dispensedMedications = new Set(dispensedMedications)
}

// Check if medication is selected
function isMedicationDispensed(prescriptionId, medicationId) {
  const key = `${prescriptionId}-${medicationId}`
  return dispensedMedications.has(key)
}
```

### UI Implementation

#### Desktop Table View
```html
<thead class="bg-gray-50">
  <tr>
    <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dispensed</th>
    <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medication</th>
    <!-- other columns -->
  </tr>
</thead>
<tbody class="bg-white divide-y divide-gray-200">
  {#each prescription.medications as medication}
    <tr class="hover:bg-gray-50">
      <td class="px-3 py-4 whitespace-nowrap text-center">
        <input 
          type="checkbox" 
          class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500"
          checked={isMedicationDispensed(prescription.id, medication.id || medication.name)}
          on:change={() => toggleMedicationDispatch(prescription.id, medication.id || medication.name)}
        />
      </td>
      <!-- other columns -->
    </tr>
  {/each}
</tbody>
```

#### Mobile Card View
```html
<div class="sm:hidden space-y-3">
  {#each prescription.medications as medication}
    <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <div class="flex items-center justify-between mb-2">
        <h4 class="font-semibold text-gray-900 text-sm">{medication.name}</h4>
        <label class="flex items-center space-x-2 cursor-pointer">
          <input 
            type="checkbox" 
            class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded"
            checked={isMedicationDispensed(prescription.id, medication.id || medication.name)}
            on:change={() => toggleMedicationDispatch(prescription.id, medication.id || medication.name)}
          />
          <span class="text-xs text-gray-600">Dispensed</span>
        </label>
      </div>
      <!-- medication details -->
    </div>
  {/each}
</div>
```

### Enhanced Validation System
```javascript
function markSelectedAsDispensed() {
  const totalMedications = selectedPrescription.prescriptions.reduce((count, prescription) => {
    return count + (prescription.medications ? prescription.medications.length : 0)
  }, 0)
  
  // Enhanced warning with clear instructions
  if (dispensedMedications.size === 0) {
    notifyError('⚠️ No medications selected! Please check the boxes next to the medications you want to mark as dispensed.')
    return
  }
  
  // Smart confirmation dialog
  if (dispensedMedications.size === totalMedications) {
    showConfirmation(
      'Mark All as Dispensed',
      `Are you sure you want to mark all ${totalMedications} medications as dispensed?`,
      'Mark as Dispensed',
      'Cancel',
      'success'
    )
  } else {
    showConfirmation(
      'Mark Selected as Dispensed',
      `Are you sure you want to mark ${dispensedMedications.size} of ${totalMedications} medications as dispensed?`,
      'Mark as Dispensed',
      'Cancel',
      'warning'
    )
  }
}
```

### Dynamic Button Implementation
```html
<button 
  type="button" 
  class="w-full sm:w-auto text-white bg-teal-700 hover:bg-teal-800 focus:ring-4 focus:outline-none focus:ring-teal-300 font-medium rounded-lg text-sm px-4 py-2.5 text-center dark:bg-teal-600 dark:hover:bg-teal-700 dark:focus:ring-teal-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
  on:click={markSelectedAsDispensed}
  disabled={dispensedMedications.size === 0}
>
  <i class="fas fa-check mr-1"></i>
  {dispensedMedications.size > 0 ? `Mark ${dispensedMedications.size} as Dispensed` : 'Mark as Dispensed'}
</button>
```

## 🔥 Firebase Integration Implementation

### Authentication Flow Architecture
The Firebase integration ensures that doctors are created in Firebase regardless of authentication method:

#### Dual Authentication Support
Both Google and local authentication now create Firebase doctor records:

**Local Authentication (authService.js)**
```javascript
// Enhanced signInDoctor method
async signInDoctor(email, password) {
  // Authenticate against localStorage
  const doctor = await jsonStorage.getDoctorByEmail(email)
  
  // Create/update doctor in Firebase
  try {
    let existingFirebaseDoctor = await firebaseStorage.getDoctorByEmail(email)
    
    if (existingFirebaseDoctor) {
      // Update existing Firebase doctor
      await firebaseStorage.updateDoctor({
        ...existingFirebaseDoctor,
        ...doctor
      })
    } else {
      // Create new doctor in Firebase
      const firebaseDoctorData = {
        email: doctor.email,
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        country: doctor.country,
        role: 'doctor',
        createdAt: new Date().toISOString()
      }
      await firebaseStorage.createDoctor(firebaseDoctorData)
    }
  } catch (firebaseError) {
    // Don't fail login if Firebase sync fails
    console.error('Firebase sync error:', firebaseError)
  }
  
  return doctor
}
```

**Google Authentication (firebaseAuth.js)**
```javascript
// Enhanced Firebase auth listener
setupAuthStateListener() {
  firebaseOnAuthStateChanged(auth, async (user) => {
    this.currentUser = user
    await this.notifyAuthStateListeners(user)
  })
}

// Process user through handleUserLogin
async notifyAuthStateListeners(user) {
  if (user) {
    try {
      const processedUser = await this.handleUserLogin(user)
      this.authStateListeners.forEach(callback => callback(processedUser))
    } catch (error) {
      console.error('Error processing user:', error)
    }
  }
}
```

#### Firebase Storage Service (firebaseStorage.js)
```javascript
// Enhanced doctor creation with debugging
async createDoctor(doctorData) {
  try {
    console.log('🔥 Firebase: Creating doctor in collection:', this.collections.doctors)
    console.log('🔥 Firebase: Doctor data to save:', doctorData)
    
    const docRef = await addDoc(collection(db, this.collections.doctors), {
      ...doctorData,
      createdAt: new Date().toISOString()
    })
    
    const createdDoctor = { id: docRef.id, ...doctorData }
    console.log('🔥 Firebase: Doctor created successfully with ID:', docRef.id)
    
    return createdDoctor
  } catch (error) {
    console.error('🔥 Firebase: Error creating doctor:', error)
    throw error
  }
}
```

### Pharmacist Connection Flow
The pharmacist connection now works because doctors exist in Firebase:

```javascript
// connectPharmacistToDoctor in firebaseStorage.js
async connectPharmacistToDoctor(pharmacistNumber, doctorIdentifier) {
  try {
    // Find pharmacist
    const pharmacist = await this.getPharmacistByNumber(pharmacistNumber)
    if (!pharmacist) {
      throw new Error('Pharmacist not found')
    }
    
    // Find doctor (now guaranteed to exist)
    const doctor = await this.getDoctorByEmail(doctorIdentifier)
    if (!doctor) {
      throw new Error('Doctor not found')
    }
    
    // Connect pharmacist to doctor
    const updatedPharmacist = {
      ...pharmacist,
      connectedDoctors: [...(pharmacist.connectedDoctors || []), doctor.id]
    }
    
    await this.updatePharmacist(updatedPharmacist)
    return { success: true, pharmacist: updatedPharmacist }
  } catch (error) {
    console.error('Error connecting pharmacist to doctor:', error)
    throw error
  }
}
```

### Key Technical Solutions

#### 1. User Object Data Integration
- **Problem**: Firebase user objects don't contain profile fields
- **Solution**: Fetch complete doctor data from database and merge with user object

#### 2. Form Field Initialization
- **Problem**: Form fields not showing current values
- **Solution**: Use `onMount` and reactive statements to initialize form fields

#### 3. Real-time UI Updates
- **Problem**: UI not updating after profile changes
- **Solution**: Enhanced reactive statements and proper object reference handling

#### 4. Data Persistence
- **Problem**: Profile changes not saving properly
- **Solution**: Proper integration with `authService.updateDoctor()` and database storage

## 🔧 Development Workflow

### Making Changes
1. **Identify Component** - Find the relevant component file
2. **Make Changes** - Implement the required changes
3. **Test Functionality** - Verify changes work correctly
4. **Check Responsiveness** - Test on different screen sizes
5. **Update Documentation** - Update relevant documentation

### Code Review Checklist
- [ ] Changes are minimal and focused
- [ ] Bootstrap 5 classes are used correctly
- [ ] Font Awesome icons are properly implemented
- [ ] Responsive design is maintained
- [ ] No breaking changes to existing functionality
- [ ] Code is properly commented
- [ ] Error handling is included

## 🧪 Testing

### Manual Testing
- **Functionality Testing** - Test all features manually
- **Responsive Testing** - Test on different screen sizes
- **Browser Testing** - Test in different browsers
- **Data Persistence** - Verify data saves correctly
- **Error Scenarios** - Test error handling

### Testing Checklist
- [ ] Patient registration and login
- [ ] Patient CRUD operations
- [ ] Medical data entry (symptoms, illnesses, prescriptions)
- [ ] Search functionality
- [ ] PDF generation
- [ ] Responsive design
- [ ] Data persistence
- [ ] Error handling

## 🐛 Debugging

### Browser Console
- **F12** - Open developer tools
- **Console Tab** - View JavaScript errors and logs
- **Network Tab** - Check for failed requests
- **Application Tab** - Inspect localStorage data

### Common Debugging Techniques
- **Console Logging** - Add `console.log()` statements
- **Breakpoints** - Use browser debugger
- **Data Inspection** - Use `jsonStorage.inspectData()`
- **State Tracking** - Monitor component state changes

### Debugging Tools
```javascript
// Inspect current data
console.log(jsonStorage.inspectData());

// Check authentication state
console.log(authService.getCurrentUser());

// Monitor reactive statements
$: console.log('State changed:', someVariable);
```

## 🔄 Data Management

### Local Storage
- **Data Structure** - JSON object with nested arrays
- **Validation** - Data validation on save
- **Cleanup** - Remove corrupted entries
- **Backup** - Export data for backup

### Data Flow
1. **User Input** - Form data entry
2. **Validation** - Client-side validation
3. **Storage** - Save to localStorage
4. **UI Update** - Reactive UI updates
5. **Persistence** - Data persists between sessions

## 💊 Drug Database System

### Drug Database Service (`drugDatabase.js`)
- **Doctor-Specific Storage** - Each doctor has isolated drug data
- **CRUD Operations** - Create, read, update, delete drugs
- **Search Functionality** - Fuzzy search with debouncing
- **Data Validation** - Ensure data integrity
- **Local Storage** - Persistent storage using localStorage

### Drug Autocomplete Component (`DrugAutocomplete.svelte`)
- **Real-Time Search** - Search as you type with debouncing
- **Keyboard Navigation** - Arrow keys, Enter, Escape support
- **Click Selection** - Mouse click to select drugs
- **Auto-Fill Integration** - Pre-fill form fields when drug selected
- **Add to Database** - Quick add functionality for new drugs

## 🔔 Notification System

### Notification Store (`notifications.js`)
- **Global State** - Svelte writable store for notifications
- **Helper Functions** - `notifySuccess`, `notifyInfo`, `notifyWarning`, `notifyError`
- **Auto-Dismiss** - Notifications automatically disappear
- **Manual Dismiss** - Click to close notifications
- **Multiple Notifications** - Support for multiple simultaneous notifications

### Notification Components
- **Notification.svelte** - Individual notification component with animations
- **NotificationContainer.svelte** - Container for displaying all notifications
- **Toast-Style UI** - Non-intrusive notification display
- **Responsive Design** - Works on all screen sizes

## 🏗️ Component Architecture

### Refactored Components
The application has been refactored into smaller, more manageable components:

#### Patient Management
- **PatientManagement.svelte** - Main patient list and search
- **PatientList.svelte** - Patient list display component
- **MedicalSummary.svelte** - Medical summary sidebar

#### Patient Details
- **PatientDetails.svelte** - Main patient details container
- **PatientTabs.svelte** - Tab navigation component
- **PatientForms.svelte** - Form management component
- **PrescriptionList.svelte** - Prescription list display

#### Form Components
- **MedicationForm.svelte** - Enhanced with drug autocomplete and edit functionality
- **IllnessForm.svelte** - Illness entry form
- **SymptomsForm.svelte** - Symptoms entry form

### Component Communication
- **Event Dispatching** - Use `createEventDispatcher` for parent-child communication
- **Props Interface** - Clear prop definitions for component reuse
- **Reactive Statements** - Use `$:` for reactive data updates
- **State Management** - Local state with Svelte stores for global state

## 🎨 UI Development

### Bootstrap 5 Integration
- **Grid System** - Use Bootstrap grid classes
- **Components** - Use Bootstrap components
- **Utilities** - Use Bootstrap utility classes
- **Responsive** - Use responsive classes

### Component Styling
```svelte
<!-- Use Bootstrap classes -->
<div class="card mb-3">
  <div class="card-header">
    <h5 class="card-title">Title</h5>
  </div>
  <div class="card-body">
    <!-- Content -->
  </div>
</div>

<!-- Custom styles when needed -->
<style>
  .custom-class {
    /* Custom CSS */
  }
</style>
```

### Responsive Design
```svelte
<!-- Responsive grid -->
<div class="row g-3">
  <div class="col-12 col-md-6 col-lg-4">
    <!-- Content -->
  </div>
</div>

<!-- Responsive utilities -->
<div class="d-none d-md-block">
  <!-- Hidden on mobile, visible on desktop -->
</div>
```

## 📦 Build and Deployment

### Development Build
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Build Output
- **dist/** - Production build files
- **Static Assets** - CSS, JS, and other assets
- **Index.html** - Main HTML file

## 🔧 Configuration

### Vite Configuration
```javascript
// vite.config.js
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    open: true
  }
})
```

### Package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## 🚀 Performance Optimization

### Code Splitting
- **Component Lazy Loading** - Load components on demand
- **Route-based Splitting** - Split by application routes
- **Dynamic Imports** - Use dynamic imports for large components

### Bundle Optimization
- **Tree Shaking** - Remove unused code
- **Minification** - Minify CSS and JavaScript
- **Asset Optimization** - Optimize images and fonts

### Runtime Performance
- **Reactive Statements** - Use Svelte's reactivity efficiently
- **Event Handling** - Optimize event listeners
- **Data Processing** - Optimize data operations

## 🔒 Security Considerations

### Data Security
- **Input Validation** - Validate all user inputs
- **XSS Prevention** - Sanitize user inputs
- **Data Sanitization** - Clean data before storage
- **Error Handling** - Don't expose sensitive information

### Authentication
- **Password Hashing** - Hash passwords before storage
- **Session Management** - Secure session handling
- **Access Control** - Restrict access to authorized users

## 📊 Monitoring and Analytics

### Error Tracking
- **Console Logging** - Log errors to console
- **Error Boundaries** - Catch and handle errors
- **User Feedback** - Collect user feedback

### Performance Monitoring
- **Load Times** - Monitor page load times
- **User Interactions** - Track user interactions
- **Data Usage** - Monitor localStorage usage

## 🔄 Version Control

### Git Workflow
- **Feature Branches** - Create branches for features
- **Commit Messages** - Use descriptive commit messages
- **Code Reviews** - Review code before merging
- **Documentation** - Update documentation with changes

### Commit Guidelines
```
feat: add new feature
fix: fix bug
docs: update documentation
style: formatting changes
refactor: code refactoring
test: add tests
chore: maintenance tasks
```

## 🚀 Deployment

### Static Hosting
- **GitHub Pages** - Deploy to GitHub Pages
- **Netlify** - Deploy to Netlify
- **Vercel** - Deploy to Vercel
- **AWS S3** - Deploy to AWS S3

### Deployment Steps
1. **Build Project** - Run `npm run build`
2. **Upload Files** - Upload dist/ folder to hosting
3. **Configure Server** - Set up web server
4. **Test Deployment** - Verify deployment works

## 🔧 Troubleshooting

### Common Issues

#### Build Errors
- **Dependency Issues** - Check package.json
- **Syntax Errors** - Check JavaScript syntax
- **Import Errors** - Verify import paths
- **Configuration Issues** - Check vite.config.js

#### Svelte CSS Conflicts
**Issue**: Svelte adds random scoped CSS classes (e.g., `s-2QWXzUdsvRnh`) that can conflict with Bootstrap classes, causing layout issues like extremely tall headers.

**Solution**: Use custom CSS classes instead of Bootstrap classes for critical layout elements:
```svelte
<!-- Instead of Bootstrap classes that get scoped -->
<div class="container-fluid d-flex justify-content-between align-items-center">

<!-- Use custom classes -->
<div class="header-content">
```

**CSS Implementation**:
```css
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1rem;
  max-width: 100%;
}
```

**Best Practices**:
- Use custom classes for layout-critical elements
- Avoid mixing Bootstrap classes with Svelte scoped CSS
- Test components after Svelte compilation to ensure no conflicts

#### Runtime Errors
- **JavaScript Errors** - Check browser console
- **Data Errors** - Check localStorage data
- **Component Errors** - Check component logic
- **Event Errors** - Check event handlers

#### Performance Issues
- **Slow Loading** - Check bundle size
- **Memory Leaks** - Check for memory leaks
- **Inefficient Code** - Optimize code
- **Large Data** - Optimize data handling

### Debugging Steps
1. **Check Console** - Look for error messages
2. **Verify Data** - Check localStorage data
3. **Test Components** - Test individual components
4. **Check Network** - Verify no failed requests
5. **Review Code** - Check for syntax errors

## 📚 Resources

### Documentation
- **Svelte Docs** - https://svelte.dev/docs
- **Bootstrap Docs** - https://getbootstrap.com/docs
- **Vite Docs** - https://vitejs.dev/guide
- **Font Awesome** - https://fontawesome.com

### Tools
- **VS Code** - Code editor with Svelte support
- **Browser DevTools** - Built-in debugging tools
- **Svelte DevTools** - Browser extension for Svelte
- **Git** - Version control system

### Community
- **Svelte Discord** - Community support
- **Stack Overflow** - Technical questions
- **GitHub Issues** - Bug reports and feature requests
- **Reddit** - General discussions

This development guide should help you contribute to the project effectively. For additional support or questions, please refer to the project documentation or contact the development team.
