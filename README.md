# 🤖 AI-Powered Patient Management System

A comprehensive patient management system built with Svelte 4 and Bootstrap 5, featuring advanced AI capabilities for medical recommendations and drug interaction analysis. Designed for doctors and pharmacists to manage patient records, track medical history, and coordinate prescription management with intelligent safety features.

## 🏥 Features

### User Authentication
- **Doctor Authentication** - Secure login and registration for medical professionals
- **Pharmacist Authentication** - Separate authentication system for pharmacists
- **Role-Based Access** - Different interfaces and permissions based on user role
- **Secure Sessions** - Persistent login sessions with proper logout functionality

### Pharmacist System
- **Pharmacist Registration** - Create pharmacist accounts with business name and email
- **Unique Pharmacist Numbers** - Auto-generated 6-digit identification numbers
- **Doctor-Pharmacist Connection** - Doctors can connect with pharmacists using their unique numbers
- **Prescription Sharing** - Connected pharmacists can view prescriptions from doctors
- **Pharmacist Dashboard** - Dedicated interface for viewing and managing prescriptions
- **Business Information** - Track pharmacy business names and contact information

### Patient Management
- **Patient Registration** - Add new patients with simplified mandatory fields (First Name and Age only)
- **Patient Search** - Search by name, ID, DOB, phone number (limited to 20 results)
- **Patient Details** - Comprehensive view with medical history including blood group and allergies
- **Patient Editing** - Update patient information with inline editing capabilities
- **Clickable Overview Cards** - Quick navigation between sections
- **Blood Group Tracking** - Essential medical information for procedures and emergencies

### Medical Data Management
- **Symptoms Tracking** - Record patient symptoms with severity and duration
- **Illness History** - Track diagnosed illnesses and their status
- **Prescription Management** - M-Prescribe and track prescriptions with edit/delete functionality
- **Medical Summary** - Always-visible overview in prescriptions tab
- **Drug Database** - Personal drug database with autocomplete for each doctor
- **Smart Notifications** - Real-time feedback for all actions

### 🤖 AI-Powered Features
- **🤖 AI-Powered Medical Intelligence** - Generate medical recommendations based on symptoms
- **AI Medication Suggestions** - Get AI-powered medication recommendations
- **🤖 AI-Powered Safety Analysis** - Advanced drug interaction detection and analysis
- **Critical Interaction Alerts** - Real-time warnings for dangerous drug combinations
- **Local Safety Database** - Pre-configured database of critical interactions (MAOI+SSRI, Warfarin+NSAID, etc.)

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

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application
```bash
 npm run dev
 ```

The application will be available at `http://localhost:5173`

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
│   ├── PatientManagement.svelte # Patient list and management
│   ├── PatientDetails.svelte   # Detailed patient view
│   ├── PatientForm.svelte      # Add/edit patient form
│   ├── IllnessForm.svelte      # Add illness form
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
│   └── MedicalSummary.svelte   # Medical summary sidebar
├── services/
│   ├── jsonStorage.js          # Local data storage
│   ├── authService.js          # Authentication service
│   └── drugDatabase.js         # Doctor-specific drug database
├── stores/                     # State management
│   └── notifications.js        # Global notification store
└── main.js                     # Application entry point
```

## 🔧 Technology Stack

- **Frontend**: Svelte 4
- **Styling**: Bootstrap 5
- **Icons**: Font Awesome
- **PDF Generation**: jsPDF
- **Build Tool**: Vite
- **Data Storage**: Local JSON (localStorage)
- **State Management**: Svelte stores
- **Notifications**: Toast-style notifications

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