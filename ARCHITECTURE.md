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
- **Key Features**:
  - Responsive header with user info
  - Loading states
  - Authentication flow

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
- **Local Storage** - Data stored locally
- **No External APIs** - No data transmission
- **Input Validation** - Sanitize all inputs
- **Session Management** - Secure authentication

### Privacy
- **Patient Data** - Stored locally only
- **No Cloud Storage** - Data remains on device
- **Access Control** - Doctor-specific data isolation
- **Data Integrity** - Validation and cleanup

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
