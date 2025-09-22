# Prescribe - Medical Prescription Management System

## Overview
A comprehensive medical prescription management system built with Svelte, Firebase, and Flowbite UI components. The system provides separate portals for doctors, pharmacists, and administrators to manage patient data, prescriptions, and medication tracking.

## Architecture

### Frontend
- **Framework**: Svelte 5.x
- **UI Library**: Flowbite (Tailwind CSS components)
- **Styling**: Tailwind CSS
- **Icons**: Font Awesome (free icons)
- **Charts**: ApexCharts
- **PDF Generation**: jsPDF

### Backend
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Hosting**: Firebase Hosting
- **Storage**: Firebase Storage

### Key Features
1. **Doctor Portal**: Patient management, prescription creation, AI-powered drug suggestions
2. **Pharmacist Portal**: Prescription management, inventory tracking
3. **Admin Portal**: User management, analytics, token quota management
4. **AI Integration**: OpenAI API for drug recommendations and medical analysis

## Recent Major Changes

### 1. UI/UX Enhancements
- **Flowbite Migration**: Converted all Bootstrap components to Flowbite for consistency
- **Responsive Design**: Enhanced mobile responsiveness across all components
- **Theme Consistency**: Applied teal color scheme throughout the application
- **Button Styling**: Fixed outline button styles for History/Edit buttons

### 2. AI Token Management System
- **Quota Management**: Added monthly token quotas for doctors
- **Usage Tracking**: Real-time token usage monitoring
- **Cost Estimation**: Token pricing configuration
- **Progress Indicators**: Visual progress bars showing quota usage

### 3. Patient Data Management
- **Conditional Rendering**: Hide empty patient information fields
- **Current Medications**: Display active medications with remaining duration
- **Data Privacy**: Doctor isolation - each doctor only sees their own patients
- **HIPAA Compliance**: Proper data access controls

### 4. Prescription Workflow
- **Clean Slate**: New prescriptions clear previous medications
- **AI Integration**: Enhanced AI prompts with patient context
- **Medication Tracking**: Current and long-term medication management
- **PDF Generation**: Professional prescription PDFs

### 5. Notification System
- **Removed Alerts**: Eliminated all notification popups for cleaner UX
- **Console Logging**: Replaced with console logging for debugging
- **Error Handling**: Silent error handling without user interruption

## File Structure
```
src/
├── components/
│   ├── AdminDashboard.svelte      # Admin portal
│   ├── PatientDetails.svelte      # Patient management
│   ├── PatientManagement.svelte   # Patient list and overview
│   ├── PharmacistDashboard.svelte # Pharmacist portal
│   ├── PharmacistManagement.svelte # Pharmacist management
│   ├── AIRecommendations.svelte   # AI drug suggestions
│   └── PrescriptionsTab.svelte    # Prescription management
├── services/
│   ├── firebaseStorage.js         # Firebase operations
│   ├── openaiService.js          # AI integration
│   └── aiTokenTracker.js         # Token management
└── stores/
    └── notifications.js          # Notification system
```

## Key Implementation Details

### Doctor Isolation
- Each doctor can only access their own patients
- Patient data is filtered by doctor ID
- No cross-doctor data access possible
- Proper authentication required for all operations

### AI Integration
- OpenAI API integration for drug suggestions
- Context-aware prompts including patient country, allergies, current medications
- Token usage tracking and quota management
- Enhanced prompts with long-term and current medication context

### Data Flow
1. **Authentication**: Doctor logs in, system loads their profile
2. **Patient Selection**: Doctor selects patient from their list
3. **Data Loading**: Patient data, history, and medications loaded
4. **Prescription Creation**: New prescription clears previous medications
5. **AI Suggestions**: AI provides drug recommendations based on context
6. **Prescription Finalization**: Prescription saved and can be sent to pharmacy

## Security Features
- Firebase Authentication
- Role-based access control
- Data isolation between doctors
- Secure API key management
- Input validation and sanitization

## Performance Optimizations
- Lazy loading of components
- Efficient Firebase queries
- Minimal re-renders with Svelte reactivity
- Optimized bundle size
- Responsive image handling

## Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile responsive design
- Progressive Web App features
- Offline capability for basic functions


