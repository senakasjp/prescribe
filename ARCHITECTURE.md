# System Architecture

## 🏗️ Overview

The Patient Management System is built using a modern frontend architecture with Svelte 4, providing a reactive and efficient user interface for medical professionals.

## 🎯 Architecture Principles

- **Component-Based** - Modular, reusable components
- **Reactive State Management** - Svelte's built-in reactivity
- **Local Data Storage** - No external dependencies
- **Responsive Design** - Mobile-first approach
- **Minimal Dependencies** - Lightweight and fast

## 📊 System Components

### Core Components

#### App.svelte
- **Purpose**: Main application container
- **Responsibilities**:
  - Authentication state management
  - Routing between components
  - Global layout and navigation
  - Super admin auto-login and role management
- **Key Features**:
  - Responsive header with user info
  - Loading states
  - Authentication flow
  - Super admin recognition and auto-login
  - Admin panel access control
  - Location data persistence

#### DoctorAuth.svelte
- **Purpose**: Doctor authentication and registration
- **Responsibilities**:
  - User login/logout
  - Account registration
  - Authentication state management
- **Key Features**:
  - Form validation
  - Error handling
  - Responsive design

#### PatientManagement.svelte
- **Purpose**: Patient list and search functionality
- **Responsibilities**:
  - Display patient list
  - Search and filter patients
  - Patient selection
- **Key Features**:
  - Search with 20-result limit
  - Responsive patient cards
  - Real-time filtering

#### PatientDetails.svelte
- **Purpose**: Detailed patient view with medical history
- **Responsibilities**:
  - Display patient information
  - Manage medical data (symptoms, illnesses, prescriptions)
  - Tab navigation
- **Key Features**:
  - Expandable medical sections
  - Medical summary
  - Clickable overview cards

### Form Components

#### PatientForm.svelte
- **Purpose**: Add/edit patient information
- **Features**:
  - Form validation
  - Responsive layout
  - Font Awesome icons

#### IllnessForm.svelte
- **Purpose**: Add patient illnesses
- **Features**:
  - Illness details entry
  - Status tracking
  - Date management

#### MedicationForm.svelte
- **Purpose**: Add patient prescriptions
- **Features**:
  - Dosage information
  - Instructions entry
  - Duration tracking

#### SymptomsForm.svelte
- **Purpose**: Add patient symptoms
- **Features**:
  - Symptom description
  - Severity levels
  - Duration and onset date

### Utility Components

#### PrescriptionPDF.svelte
- **Purpose**: Generate PDF prescriptions
- **Features**:
  - PDF generation with jsPDF
  - Patient and medication details
  - Professional formatting

### Pharmacist Components

#### PharmacistAuth.svelte
- **Purpose**: Pharmacist authentication and registration
- **Responsibilities**:
  - Pharmacist login/logout
  - Account registration
  - Authentication state management
- **Key Features**:
  - Form validation
  - Error handling
  - Responsive design

#### PharmacistDashboard.svelte
- **Purpose**: Pharmacist interface for managing prescriptions and drug inventory
- **Responsibilities**:
  - Display prescriptions from connected doctors
  - Prescription management
  - Business information display
  - Drug stock management and inventory tracking with composite primary key system
- **Key Features**:
  - Prescription viewing
  - Business stats
  - Connected doctors list
  - Comprehensive drug stock management
  - Stock availability tracking with visual indicators
  - Initial quantity recording for low-stock alerts
  - **Drug Identification**: Brand Name + Strength + Strength Unit + Expiry Date as composite primary key

#### PharmacistManagement.svelte
- **Purpose**: Doctor-pharmacist connection management
- **Responsibilities**:
  - Connect with pharmacists using unique numbers
  - Manage pharmacist connections
  - View connected pharmacists
- **Key Features**:
  - Pharmacist connection interface
  - Connection status tracking
  - Pharmacist number validation

#### PrescriptionsTab.svelte
- **Purpose**: Enhanced prescription management with stock availability
- **Responsibilities**:
  - Display current medications with stock availability
  - Show pharmacy stock integration
  - Manage prescription workflow
- **Key Features**:
  - Dynamic stock badges (orange for normal, red for low stock)
  - Real-time pharmacy stock monitoring
  - Stock percentage calculations (≤10% of initial = low stock)
  - AI drug suggestions integration

### Admin Components

#### AdminPanel.svelte
- **Purpose**: Main admin panel router and container
- **Responsibilities**:
  - Super admin authentication bypass
  - Admin dashboard routing
  - Admin login form handling
- **Key Features**:
  - Super admin recognition
  - Direct admin access
  - Admin authentication flow

#### AdminDashboard.svelte
- **Purpose**: Comprehensive admin dashboard
- **Responsibilities**:
  - System statistics display
  - Doctor management and deletion
  - Patient overview across all doctors
  - AI usage analytics
- **Key Features**:
  - Doctor deletion with complete data cleanup
  - Protected super admin account
  - Real-time statistics updates
  - Confirmation dialogs for destructive actions

#### AdminLogin.svelte
- **Purpose**: Admin authentication form
- **Features**:
  - Email-based admin verification
  - Secure password authentication
  - Admin session management

## 🔧 Services Layer

### jsonStorage.js
- **Purpose**: Local data persistence
- **Responsibilities**:
  - Data CRUD operations
  - Data validation
  - Local storage management
- **Key Methods**:
  - `loadData()` - Load all data from localStorage
  - `saveData()` - Save data to localStorage
  - `createPatient()` - Add new patient
  - `getPatientsByDoctorId()` - Get patients for doctor
  - Data cleanup and validation

### authService.js
- **Purpose**: Authentication management
- **Responsibilities**:
  - User registration
  - Login/logout
  - Session management
- **Key Methods**:
  - `registerDoctor()` - Register new doctor
  - `signInDoctor()` - Authenticate doctor
  - `getCurrentUser()` - Get current user
  - `signOut()` - Logout user

### firebaseAuth.js
- **Purpose**: Firebase authentication integration
- **Responsibilities**:
  - Google Sign-In integration
  - Super admin recognition
  - Firebase user management
- **Key Methods**:
  - `signInWithGoogle()` - Google authentication
  - Super admin detection and role assignment
  - Firebase user creation and updates

### adminAuthService.js
- **Purpose**: Admin-specific authentication
- **Responsibilities**:
  - Admin session management
  - Admin authentication verification
  - Super admin bypass logic
- **Key Methods**:
  - `getCurrentAdmin()` - Get current admin user
  - `signOut()` - Admin logout
  - Super admin authentication bypass

### firebaseStorage.js
- **Purpose**: Firebase Firestore operations
- **Responsibilities**:
  - Doctor CRUD operations with security isolation
  - Patient data management with doctor-specific filtering
  - Doctor deletion with complete data cleanup
  - Secure data serialization and validation
- **Key Methods**:
  - `getPatients(doctorId)` - Get patients filtered by doctor ID (SECURE)
  - `createPatient(patientData)` - Create patient with required doctor ID
  - `deleteDoctor()` - Delete doctor with complete data cleanup
  - `getAllDoctors()` - Retrieve all doctors
  - `createDoctor()` - Create doctor records with proper serialization
  - `updateDoctor()` - Update doctor information
  - `getDoctorByEmail()` - Find doctor by email for ID resolution

## 📱 Data Flow

### Authentication Flow
1. User visits application
2. Check for existing session
3. If not authenticated, show login form
4. After login, redirect to patient management
5. Store user session in localStorage

### Patient Management Flow
1. Load patients for current doctor
2. Display patient list with search
3. User selects patient
4. Load patient details and medical history
5. Allow adding/editing medical data

### Data Persistence Flow
1. User enters data in forms
2. Data validation occurs
3. Data saved to localStorage via jsonStorage
4. UI updates reactively
5. Data persists between sessions

## 🎨 UI Architecture

### Design System
- **Bootstrap 5** - Base styling framework
- **Font Awesome** - Icon library
- **Custom CSS** - Component-specific styles
- **Responsive Grid** - Mobile-first layout

### Component Hierarchy
```
App.svelte
├── DoctorAuth.svelte (when not authenticated)
└── PatientManagement.svelte (when authenticated)
    └── PatientDetails.svelte
        ├── PatientForm.svelte
        ├── IllnessForm.svelte
        ├── MedicationForm.svelte
        ├── SymptomsForm.svelte
        └── PrescriptionPDF.svelte
```

### State Management
- **Local State** - Component-level state
- **Reactive Statements** - Svelte's `$:` syntax
- **Event Handling** - Custom events between components
- **Props** - Data passing between components

## 🔍 Search Architecture

### Search Implementation
- **Client-Side Filtering** - No server required
- **Multiple Criteria** - Name, ID, DOB, phone, email
- **Performance Optimization** - 20-result limit
- **Real-Time Updates** - Reactive search results

### Search Algorithm
1. Convert search query to lowercase
2. Filter patients array by multiple criteria
3. Apply result limit (20 items)
4. Update UI reactively
5. Show result count and overflow indicator

## 📊 Data Architecture

### Data Structure
```javascript
{
  doctors: [
    {
      id: "doctor_id",
      name: "Dr. Name",
      email: "email@example.com",
      // ... other doctor fields
    }
  ],
  patients: [
    {
      id: "patient_id",
      doctorId: "doctor_id",
      firstName: "John",
      lastName: "Doe",
      // ... other patient fields
    }
  ],
  illnesses: [...],
  medications: [...],
  symptoms: [...]
}
```

### Data Validation
- **Required Fields** - Enforced at creation
- **Data Types** - Type checking and conversion
- **Data Cleanup** - Remove corrupted entries
- **Unique IDs** - Generated for all entities

## 🚀 Performance Considerations

### Optimization Strategies
- **Lazy Loading** - Components loaded on demand
- **Search Limiting** - 20 results maximum
- **Efficient Filtering** - Client-side array operations
- **Minimal Re-renders** - Svelte's reactivity system
- **Local Storage** - Fast data access

### Memory Management
- **Data Cleanup** - Remove unused data
- **Component Cleanup** - Proper lifecycle management
- **Event Cleanup** - Remove event listeners
- **State Reset** - Clear state on navigation

## 🔒 Security Considerations

### Data Protection
- **Firebase Security** - Secure cloud data storage
- **Input Validation** - Sanitize all inputs
- **Session Management** - Secure authentication
- **Data Serialization** - Prevent Firebase serialization errors

### Privacy & Data Isolation
- **Doctor Isolation** - Each doctor can ONLY see their own patients
- **Data Privacy** - No cross-doctor data access possible
- **HIPAA Compliance** - Patient data is properly isolated
- **Authentication Required** - Doctor ID must be provided to access patients
- **Secure Queries** - All patient queries filtered by doctor ID

### Security Implementation Details

#### Doctor Data Isolation
```javascript
// ✅ SECURE: All patient queries require doctor ID
async getPatients(doctorId) {
  if (!doctorId) {
    throw new Error('Doctor ID is required to access patients')
  }
  
  const q = query(
    collection(db, this.collections.patients), 
    where('doctorId', '==', doctorId)  // 🔒 SECURITY FILTER
  )
}

// ✅ SECURE: Patient creation requires doctor ID
async createPatient(patientData) {
  const patient = {
    ...patientData,
    doctorId: patientData.doctorId  // 🔒 REQUIRED FIELD
  }
}
```

#### Security Validation
- **Required Doctor ID** - All patient operations require valid doctor ID
- **Firebase Rules** - Server-side security rules enforce data isolation
- **Query Filtering** - All queries automatically filter by doctor ID
- **No Cross-Access** - Impossible to access other doctors' patients

#### Data Integrity
- **Validation** - All data validated before storage
- **Cleanup** - Corrupted data automatically removed
- **Serialization** - Proper data serialization for Firebase
- **Error Handling** - Comprehensive error handling and logging

## 🛠️ Development Architecture

### Build System
- **Vite** - Fast build tool
- **Svelte Compiler** - Component compilation
- **CSS Processing** - Scoped styles
- **Asset Optimization** - Minification and bundling

### CSS Architecture & Svelte Conflicts
**Issue**: Svelte's scoped CSS system adds random class names (e.g., `s-2QWXzUdsvRnh`) to elements, which can conflict with Bootstrap classes and cause layout issues.

**Solution Strategy**:
- **Custom Classes**: Use custom CSS classes for critical layout elements
- **Avoid Bootstrap Conflicts**: Don't mix Bootstrap classes with Svelte scoped elements
- **Component Isolation**: Keep layout-critical styles in custom classes

**Implementation Pattern**:
```svelte
<!-- Problematic: Bootstrap classes get scoped -->
<div class="container-fluid d-flex justify-content-between">

<!-- Solution: Custom classes -->
<div class="header-content">
```

**CSS Structure**:
```css
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  /* Custom styles that won't conflict */
}
```

### Code Organization
- **Modular Components** - Single responsibility
- **Service Layer** - Business logic separation
- **Utility Functions** - Reusable code
- **Type Safety** - JSDoc annotations

## 📈 Scalability Considerations

### Current Limitations
- **Local Storage** - Limited storage capacity
- **Single Device** - No multi-device sync
- **No Backup** - Data loss risk
- **No Collaboration** - Single user system

### Future Enhancements
- **Database Integration** - Replace localStorage
- **Cloud Sync** - Multi-device support
- **User Management** - Multiple doctors
- **Data Export** - Backup and migration
- **API Integration** - External services

## 🔄 Migration Strategy

### From Local Storage to Database
1. **Data Export** - Extract current data
2. **Schema Design** - Design database schema
3. **API Development** - Create backend services
4. **Data Migration** - Transfer data to database
5. **Service Updates** - Update jsonStorage to use API
6. **Testing** - Verify data integrity

### Backward Compatibility
- **Data Format** - Maintain existing structure
- **API Compatibility** - Keep same interface
- **Gradual Migration** - Phased approach
- **Fallback Support** - Local storage backup

## Drug Identification System

### Primary Key Architecture
The pharmacy portal uses a **composite primary key** system to uniquely identify drugs in the inventory:

**Primary Key Components:**
- **Brand Name** - The pharmaceutical brand name
- **Strength** - The drug strength (e.g., "500", "10")
- **Strength Unit** - The unit of measurement (e.g., "mg", "ml", "units")
- **Expiry Date** - The expiration date (YYYY-MM-DD format)

### Business Logic
```javascript
// Primary Key Format: Brand Name + Strength + Strength Unit + Expiry Date
const primaryKey = `${brandName}_${strength}_${strengthUnit}_${expiryDate}`

// Examples:
// "Amoxicillin_500_mg_2025-12-31"
// "Paracetamol_500_mg_2025-06-15"
// "Insulin_100_units_2025-03-20"
```

### Key Benefits
- ✅ **Unique Identification**: Each drug batch is uniquely identified
- ✅ **FIFO Management**: Different expiry dates allow proper first-in-first-out tracking
- ✅ **Batch Tracking**: Same drug with different expiry dates are separate inventory items
- ✅ **Duplicate Prevention**: Prevents accidental duplicate entries
- ✅ **Expiry Management**: Easy tracking of expiring medications

### Implementation
- **Database Level**: Composite key validation in `inventoryService.js`
- **UI Level**: Primary key fields are disabled during editing to prevent corruption
- **Validation**: Real-time duplicate checking before creating/updating items
- **Search**: All inventory operations consider the full composite key
