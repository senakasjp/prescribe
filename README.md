# 🤖 AI-Powered Patient Management System

A comprehensive patient management system built with Svelte 4, Bootstrap 5, and Firebase, featuring advanced AI capabilities for medical recommendations and drug interaction analysis. Designed for doctors and pharmacists to manage patient records, track medical history, and coordinate prescription management with intelligent safety features.

## 🆕 Recent Updates (January 16, 2025)

### **👑 Super Admin System Implementation**
- **Super Admin Access**: `senakahks@gmail.com` automatically lands on doctor app with admin privileges
- **Direct Admin Panel**: Super admin can access admin panel without login form
- **Doctor Deletion Capability**: Super admin can delete any doctor account with complete data cleanup
- **Protected Account**: Super admin account cannot be deleted by anyone
- **Seamless Authentication**: Auto-login for super admin with proper role assignment

### **🔥 Firebase-Only Implementation**
- **Complete Migration**: All data operations now use Firebase Firestore exclusively
- **Cloud Data Persistence**: Patient data, prescriptions, and medical records stored in Firebase
- **Real-time Synchronization**: Data automatically syncs across devices and sessions
- **Scalable Architecture**: Cloud-based storage supports multiple doctors and patients

### **🔧 Critical Fixes**
- **Prescription Data Persistence**: Fixed issue where medications disappeared on page refresh
- **Firebase Index Issues**: Resolved Firebase compound query index errors by removing orderBy clauses
- **Prescription Structure**: Implemented proper prescription-medication hierarchy
- **Data Loading**: Enhanced data initialization for existing prescriptions
- **Doctor-Patient Isolation**: Doctors only see patients they created
- **MedicalSummary Data Display**: Fixed "Unknown prescription" and "No dosage" issues by properly extracting medications from prescriptions

### **🎯 Simplified Prescription Logic**
- **New Prescription Button**: Always creates a new prescription when clicked
- **Clear Workflow**: Simple and intuitive prescription creation process
- **User-Friendly**: Helpful error messages and button states
- **Consistent Behavior**: Predictable prescription management workflow

### **🎨 UI/UX Improvements**
- **Responsive Header**: Fixed mobile responsiveness with proper Bootstrap 5 layout
- **Prescription Card**: Professional card design for prescription management
- **Optional Start Date**: Medication start date now optional with smart defaults
- **Enhanced Patient Editing**: Comprehensive patient data editing with validation
- **Profile Management**: Real-time profile editing with immediate UI updates
- **City Field**: Added compulsory city field to doctor profiles with country-based dropdown
- **Enhanced Card Borders**: Applied consistent light blue borders to all card components for better visual separation
- **Colored Navigation Tabs**: Converted patient tabs to colored buttons with black border container for enhanced visibility
- **Dashboard Card Styling**: Neutralized dashboard statistics card borders for cleaner appearance

### **📊 Data Model Enhancements**
- **Hierarchical Structure**: Proper prescription containers with multiple medications
- **Firebase Integration**: All CRUD operations use Firebase Firestore
- **Storage Optimization**: Improved data persistence and loading mechanisms
- **Pharmacist Integration**: Complete Firebase-based pharmacist-doctor connection system
- **Sri Lanka Districts**: Added all 25 districts of Sri Lanka to city selection
- **Prescription History Display**: Enhanced prescription history with grouped display showing "Prescription #X on date" with Bootstrap 5 styling

## 🏥 Features

### 👑 Super Admin System
- **Super Admin Account** - `senakahks@gmail.com` has elevated privileges and system-wide access
- **Automatic Authentication** - Super admin automatically logs in and lands on doctor app
- **Admin Panel Access** - Direct access to admin panel without additional login
- **Doctor Management** - Can view, monitor, and delete any doctor account
- **Complete Data Cleanup** - When deleting doctors, removes all associated patients, prescriptions, and medical data
- **Protected Status** - Super admin account cannot be deleted by anyone
- **System Monitoring** - Access to system-wide statistics and analytics
- **AI Usage Tracking** - Monitor OpenAI API usage and costs across all users

### User Authentication
- **Doctor Authentication** - Secure login and registration for medical professionals
- **Google Authentication** - Sign in with Google for seamless access
- **Super Admin Recognition** - System automatically recognizes and elevates super admin privileges
- **Local Authentication** - Email/password authentication with Firebase sync
- **Pharmacist Authentication** - Separate authentication system for pharmacists
- **Role-Based Access** - Different interfaces and permissions based on user role
- **Secure Sessions** - Persistent login sessions with proper logout functionality
- **Firebase Integration** - All authentication data stored in Firebase

### Pharmacist System
- **Pharmacist Registration** - Create pharmacist accounts with business name and email
- **Unique Pharmacist Numbers** - Auto-generated 6-digit identification numbers
- **Doctor-Pharmacist Connection** - Doctors can connect with pharmacists using their unique numbers
- **Prescription Sharing** - Connected pharmacists can view prescriptions from doctors
- **Pharmacist Dashboard** - Dedicated interface for viewing and managing prescriptions
- **Business Information** - Track pharmacy business names and contact information
- **Firebase Storage** - All pharmacist data stored in Firebase Firestore
- **Real-time Updates** - Prescriptions appear instantly in pharmacist dashboard

### Patient Management
- **Patient Registration** - Add new patients with simplified mandatory fields (First Name and Age only)
- **Patient Search** - Search by name, ID, DOB, phone number (limited to 20 results)
- **Patient Details** - Comprehensive view with medical history including blood group and allergies
- **Patient Editing** - Update patient information with inline editing capabilities
- **Clickable Overview Cards** - Quick navigation between sections
- **Blood Group Tracking** - Essential medical information for procedures and emergencies
- **Doctor Isolation** - Each doctor only sees patients they created
- **Firebase Storage** - All patient data stored in Firebase Firestore
- **Gender Selection** - Patient gender field with multiple options

### Medical Data Management
- **Symptoms Tracking** - Record patient symptoms with severity and duration
- **Illness History** - Track diagnosed illnesses and their status
- **Prescription Management** - M-Prescribe and track prescriptions with edit/delete functionality
- **Medical Summary** - Always-visible overview in prescriptions tab
- **Drug Database** - Personal drug database with autocomplete for each doctor
- **Smart Notifications** - Real-time feedback for all actions
- **Firebase Storage** - All medical data stored in Firebase Firestore
- **AI Drug Interaction Analysis** - Automatic drug interaction checking on prescription completion

### 🤖 AI-Powered Features
- **🤖 AI-Powered Medical Intelligence** - Generate medical recommendations based on symptoms
- **AI Medication Suggestions** - Get AI-powered medication recommendations
- **🤖 AI-Powered Safety Analysis** - Advanced drug interaction detection and analysis
- **Critical Interaction Alerts** - Real-time warnings for dangerous drug combinations
- **Local Safety Database** - Pre-configured database of critical interactions (MAOI+SSRI, Warfarin+NSAID, etc.)
- **Automatic Interaction Checking** - AI analysis triggered on prescription completion
- **Severity Classification** - Interactions classified as Low, Moderate, High, or Critical
- **Yes/No Response Format** - Clear AI responses for interaction detection

### User Interface
- **Responsive Design** - Works on all screen sizes
- **Bootstrap 5 Styling** - Clean, professional appearance
- **Font Awesome Icons** - Visual clarity throughout
- **Expandable Sections** - Detailed views when needed
- **Color-Coded Themes** - Easy to distinguish different data types

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Firebase project setup
- OpenAI API key (for AI features)

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up Firebase configuration (see Firebase Setup section)
4. Configure OpenAI API key (see AI Features Setup section)

### Running the Application
```bash
 npm run dev
 ```

The application will be available at `http://localhost:5173`

### Firebase Setup
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database
3. Enable Authentication with Google provider
4. Copy your Firebase configuration to `src/firebase-config.js`
5. Set up Firestore security rules for your collections

## 🤖 AI Features Setup

### OpenAI Integration
To enable AI features, you'll need an OpenAI API key:

1. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a `.env` file in the project root:
   ```env
   VITE_OPENAI_API_KEY=your_openai_api_key_here
   ```
3. Restart the development server

### AI Capabilities
- **🤖 AI-Powered Medical Intelligence**: Get AI recommendations based on patient symptoms
- **AI Medication Suggestions**: Receive medication recommendations with interaction warnings
- **🤖 AI-Powered Safety Analysis**: Advanced drug interaction detection with severity classification
- **Critical Interaction Alerts**: Real-time warnings for dangerous combinations like MAOI+SSRI

## 📁 Project Structure

```
src/
├── components/
│   ├── App.svelte              # Main application component
│   ├── DoctorAuth.svelte       # Doctor authentication
│   ├── PharmacistAuth.svelte   # Pharmacist authentication
│   ├── PharmacistDashboard.svelte # Pharmacist interface
│   ├── PharmacistManagement.svelte # Doctor-pharmacist connection
│   ├── PatientManagement.svelte # Patient list and management
│   ├── PatientDetails.svelte   # Detailed patient view
│   ├── PatientForm.svelte      # Add/edit patient form
│   ├── IllnessForm.svelte       # Add illness form
│   ├── MedicationForm.svelte   # Add/edit medication form with drug autocomplete
│   ├── SymptomsForm.svelte     # Add symptoms form
│   ├── PrescriptionPDF.svelte  # PDF generation
│   ├── DrugAutocomplete.svelte # Drug name autocomplete component
│   ├── Notification.svelte     # Individual notification component
│   ├── NotificationContainer.svelte # Notification display container
│   ├── PatientList.svelte      # Patient list component
│   ├── PatientTabs.svelte      # Patient tab navigation
│   ├── PatientForms.svelte     # Patient form management
│   ├── PrescriptionList.svelte # Prescription list component
│   ├── MedicalSummary.svelte   # Medical summary sidebar
│   ├── EditProfile.svelte      # Profile editing component
│   └── AdminDashboard.svelte   # Admin panel dashboard
├── services/
│   ├── firebaseStorage.js      # Firebase Firestore operations
│   ├── firebaseAuth.js         # Firebase authentication
│   ├── authService.js          # Authentication service
│   ├── openaiService.js        # AI/OpenAI integration
│   ├── drugDatabase.js         # Doctor-specific drug database
│   └── notifications.js        # Notification management
├── stores/                     # State management
│   └── notifications.js        # Global notification store
├── firebase-config.js          # Firebase configuration
└── main.js                     # Application entry point
```

## 🔧 Technology Stack

- **Frontend**: Svelte 4
- **Styling**: Bootstrap 5
- **Icons**: Font Awesome
- **PDF Generation**: jsPDF
- **Build Tool**: Vite
- **Data Storage**: Firebase Firestore
- **Authentication**: Firebase Auth + Google OAuth
- **AI Integration**: OpenAI API
- **State Management**: Svelte stores
- **Notifications**: Toast-style notifications
- **Charts**: Chart.js

## 📋 Usage

### Doctor Authentication
1. Register a new doctor account
2. Sign in with credentials
3. Access patient management dashboard

### Managing Patients
1. **Add Patient**: Click "Add Patient" button
2. **Search Patients**: Use search box to find specific patients
3. **View Details**: Click on patient to see detailed information
4. **Add Medical Data**: Use tabs to add symptoms, illnesses, or prescriptions

### Medical Data Entry
- **Symptoms**: Record description, severity, duration, onset date
- **Illnesses**: Track name, description, status, diagnosis date
- **Prescriptions**: M-Prescribe name, dosage, instructions, duration with drug autocomplete
- **Drug Database**: Personal drug database with autocomplete suggestions
- **Edit Functionality**: Edit existing prescriptions with pre-filled forms

## 🎨 UI Components

### Overview Cards
- **Symptoms Card** (Yellow) - Navigate to symptoms tab
- **Illnesses Card** (Blue) - Navigate to illnesses tab
- **Prescriptions Card** (Green) - Navigate to prescriptions tab

### Expandable Sections
- **Symptoms History** - Expandable with severity badges
- **Illness History** - Expandable with status information
- **Prescription History** - Expandable with dosage details

### Medical Summary
- **Always Visible** - Shows in prescriptions tab
- **Three-Panel Layout** - Symptoms, illnesses, prescriptions
- **Recent Items** - Displays up to 2 most recent items per category
- **Quick Stats** - Counts and status information

## 🔍 Search Functionality

Search patients by:
- Full name or partial name
- Patient ID number
- Date of birth (various formats)
- Phone number
- Email address

Results are limited to 20 for performance.

## 💊 Drug Database System

### Personal Drug Database
- **Doctor-Specific**: Each doctor has their own drug database
- **Autocomplete**: Smart suggestions as you type medication names
- **Quick Add**: Add new drugs to your database instantly
- **Auto-Fill**: Select from database to auto-fill form fields
- **Persistent Storage**: Drugs saved locally for future use

### Drug Management Features
- **Search Drugs**: Type to find existing drugs in your database
- **Add New Drugs**: Click "To database" to add new medications
- **Edit Prescriptions**: Modify existing prescriptions with pre-filled forms
- **Smart Notifications**: Real-time feedback for all drug operations

## 📱 Responsive Design

- **Mobile First** - Optimized for mobile devices
- **Bootstrap Grid** - Responsive layout system
- **Flexible Components** - Adapt to different screen sizes
- **Touch Friendly** - Large buttons and touch targets

## 🛠️ Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Code Style
- Follows Svelte best practices
- Bootstrap 5 for styling
- Font Awesome for icons
- Minimal code changes approach
- Modular and well-commented code

## 📄 License

This project is for medical practice management and patient care.

## 🤝 Contributing

This is a medical application. Please ensure all changes maintain data integrity and follow medical software best practices.

## 📞 Support

For technical support or questions about the patient management system, please refer to the documentation or contact the development team.