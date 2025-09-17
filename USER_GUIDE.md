# User Guide

## 🆕 Recent Updates (January 16, 2025)

### **👑 Super Admin System Implementation**
- **Super Admin Access**: `senakahks@gmail.com` automatically lands on doctor app with admin privileges
- **Direct Admin Panel**: Super admin can access admin panel without login form
- **Doctor Management**: Super admin can delete any doctor account with complete data cleanup
- **Protected Account**: Super admin account cannot be deleted by anyone
- **Seamless Authentication**: Auto-login for super admin with proper role assignment

### **🔥 Firebase-Only Implementation**
- **Cloud Storage**: All patient data, prescriptions, and medical records are now stored in Firebase
- **Real-time Sync**: Data automatically synchronizes across devices and sessions
- **Enhanced Security**: Cloud-based storage with proper authentication and data isolation
- **Scalable Platform**: Supports multiple doctors and patients with proper data separation

### **🔧 Prescription System Improvements**
- **Persistent Medications**: Previously added medications now stay visible when you refresh the page or navigate away and come back
- **Prescription Cards**: Prescription functionality is now organized in a professional card design
- **Optional Start Date**: When adding medications, the start date is now optional (defaults to today if not specified)
- **AI Drug Interaction Analysis**: Automatic drug interaction checking when completing prescriptions
- **Simplified Workflow**: Clear prescription creation process - click "New Prescription" to create a new prescription
- **MedicalSummary Data Display**: Fixed display issues showing actual medication names, dosages, and durations instead of "Unknown prescription"

### **🎯 New Prescription Logic**
- **Simple Rule**: Click "New Prescription" button = Always creates a new prescription
- **Clear Workflow**: Must create prescription before adding medications
- **User-Friendly**: Helpful error messages guide you through the process
- **Consistent**: Predictable behavior every time

### **🎨 User Interface Enhancements**
- **Responsive Design**: The header now works perfectly on mobile devices and tablets
- **Enhanced Patient Editing**: Patient information can be edited with comprehensive validation
- **Professional Layout**: Improved visual organization with card-based design
- **Gender Selection**: Added gender field to patient forms
- **City Field**: Added compulsory city field to doctor profiles with country-based dropdown
- **Enhanced Card Borders**: All cards now have consistent light blue borders for better visual separation
- **Colored Navigation Tabs**: Patient tabs converted to colored buttons with black border container for enhanced visibility
- **Dashboard Card Styling**: Statistics cards have neutral borders for cleaner appearance
- **Prescription History**: Enhanced display showing "Prescription #X on date" with professional styling

### **📱 Mobile Experience**
- **Mobile Header**: Optimized header layout for mobile devices
- **Touch-Friendly**: Better button sizes and spacing for mobile interaction
- **Responsive Forms**: All forms now work seamlessly on mobile devices

### **👤 Profile Management**
- **Edit Profile**: Update your personal information including name, country, and city
- **Real-time Updates**: Profile changes are reflected immediately in the UI
- **Form Pre-population**: Edit form automatically shows your current values
- **Data Persistence**: Profile changes are saved to Firebase and persist across sessions
- **Sri Lanka Districts**: All 25 districts of Sri Lanka available for city selection

### **🔥 Firebase Integration**
- **Dual Authentication**: Both Google and local authentication methods are supported
- **Automatic Sync**: Doctor records are automatically created in Firebase regardless of login method
- **Pharmacist Connection**: Pharmacists can now connect to doctors seamlessly
- **Cloud Data**: All data stored in Firebase Firestore for reliability and scalability

## 👑 For Super Admin

### Super Admin Access
The super admin account (`senakahks@gmail.com`) has elevated privileges and system-wide access to manage the entire M-Prescribe system.

#### Automatic Authentication
1. **Auto-Login**: Super admin automatically logs in when accessing the system
2. **Doctor App Landing**: Lands directly on the doctor application interface
3. **Admin Privileges**: Has both doctor and admin capabilities
4. **Seamless Access**: No additional login required for admin functions

#### Admin Panel Access
1. **Admin Button**: Click "Admin" button in the navigation bar
2. **Direct Access**: Admin panel opens without login form
3. **Full Admin Rights**: Access to all admin features and system management
4. **System Monitoring**: View system-wide statistics and analytics

#### Doctor Management
1. **View All Doctors**: See complete list of registered doctors
2. **Delete Doctors**: Remove any doctor account (except super admin)
3. **Complete Cleanup**: When deleting doctors, system removes:
   - All patients belonging to the doctor
   - All prescriptions, symptoms, and illnesses
   - All drug database entries created by the doctor
   - The doctor account itself
4. **Protected Status**: Super admin account cannot be deleted by anyone
5. **Confirmation Process**: Detailed warning dialogs before deletion

#### System Administration
- **System Statistics**: Monitor total doctors, patients, prescriptions, and symptoms
- **AI Usage Tracking**: Monitor OpenAI API usage and costs across all users
- **Patient Overview**: View all patients across the entire system
- **Data Management**: Complete system data oversight and management

## 👨‍⚕️ For Doctors

This guide will help you navigate and use the Patient Management System effectively.

## 💊 For Pharmacists

This guide will help pharmacists connect with doctors and manage prescriptions.

### Pharmacist Registration
1. **Select Pharmacist Mode** - Click the "Pharmacist" tab on the login screen
2. **Create Account** - Click "Register" to create your pharmacist account
3. **Fill in Your Details**:
   - Business Name (Pharmacy Name)
   - Email Address
   - Password (minimum 6 characters)
   - Confirm Password
4. **Get Your Number** - After registration, you'll receive a unique 6-digit pharmacist number
5. **Share Your Number** - Give this number to doctors who want to connect with your pharmacy

### Pharmacist Dashboard
Once logged in, you'll see:
- **Pharmacy Information** - Your business details and pharmacist ID
- **Connected Doctors** - List of doctors who have connected with your pharmacy
- **Prescriptions List** - All prescriptions from connected doctors
- **Prescription Details** - View detailed prescription information including medications

### Managing Prescriptions
1. **View Prescriptions** - All prescriptions from connected doctors appear in your dashboard
2. **Check Details** - Click "View" to see complete prescription information
3. **Patient Information** - See patient details, doctor information, and prescription date
4. **Medication List** - View all prescribed medications with dosages and instructions
5. **Mark as Dispensed** - Update prescription status when medications are dispensed

## 👨‍⚕️ For Doctors

## 🚀 Getting Started

### Authentication Methods
The system supports two authentication methods:

#### **Local Authentication (Email/Password)**
1. **Register Your Account** - Click "Register" to create your doctor account
2. **Fill in Your Details**:
   - First Name
   - Last Name
   - Email Address
   - Password
   - Country
3. **Sign In** - Use your email and password to access the system
4. **Automatic Firebase Sync** - Your doctor record is automatically created in Firebase for pharmacist connections

#### **Google Authentication**
1. **Click "Login with Google"** - Use your Google account to sign in
2. **Authorize Access** - Grant permission to the application
3. **Automatic Account Creation** - Your doctor profile is automatically created
4. **Seamless Integration** - Works with all pharmacist connection features

**Note**: Both authentication methods create Firebase doctor records automatically, ensuring pharmacists can connect to your account regardless of how you log in.

### Dashboard Overview
Once logged in, you'll see:
- **Patient List** - All your patients on the left
- **Search Bar** - Find patients quickly
- **Add Patient Button** - Register new patients
- **Patient Details** - Selected patient information on the right

### 👤 Managing Your Profile

#### Editing Your Profile Information
1. **Access Profile Settings** - Click the "Edit Profile" button in the header
2. **Update Your Information**:
   - **First Name**: Your given name
   - **Last Name**: Your family name
   - **Country**: Your practice location
   - **Email**: Cannot be changed (for security)
3. **Save Changes** - Click "Save Changes" to update your profile
4. **Real-time Updates** - Changes appear immediately in the header and welcome message

#### Profile Features
- **Auto-population**: Edit form shows your current values when opened
- **Validation**: Required fields are validated before saving
- **Data Persistence**: Changes are saved to the database
- **UI Integration**: Profile updates reflect throughout the application

## 👥 Managing Patients

### Adding a New Patient
1. **Click "Add Patient"** button
2. **Fill in Required Information** (marked with red asterisks *):
   - **First Name** - Required field
   - **Age** - Required field (can be entered directly or calculated from date of birth)
3. **Optional Information** (can be added later):
   - Last Name, Email, Phone, Date of Birth
   - Weight, Blood Group (important for medical procedures)
   - ID Number, Address, Allergies (critical medical information)
   - Emergency contact details
4. **Click "Save Patient"** to register

**Note**: Only First Name and Age are mandatory. All other fields can be added later through the edit function.

### Searching Patients
Use the search box to find patients by:
- **Name** - First name, last name, or full name
- **Patient ID** - Unique patient identifier
- **Date of Birth** - Birth date in any format
- **Phone Number** - Contact number
- **Email Address** - Patient email

**Note**: Search results are limited to 20 patients for performance.

### Viewing Patient Details
1. **Click on a patient** from the list
2. **View comprehensive information**:
   - Personal details (name, age, weight, blood group)
   - Contact information (phone, email, address)
   - Medical information (allergies displayed prominently)
   - Medical history tabs

### Editing Patient Information
1. **Click the "Edit" button** next to the patient's name
2. **Update any information** in the edit form
3. **Required fields** remain the same (First Name and Age with red asterisks)
4. **Add missing information** like blood group, allergies, or weight
5. **Click "Save Changes"** to update the patient record
6. **Click "Cancel"** to discard changes

**Important**: Blood group and allergies are displayed prominently in the patient overview for quick medical reference.

## 🏥 Medical Data Management

### Overview Tab
The overview provides a quick summary with:
- **Clickable Cards** - Navigate to specific sections
- **Statistics** - Count of symptoms, illnesses, prescriptions
- **Recent Activity** - Latest medical entries

### Symptoms Tab
Track patient symptoms with detailed information:

#### Adding Symptoms
1. **Click "Add Symptoms"** button
2. **Enter Symptom Details**:
   - **Description** - Detailed symptom description
   - **Severity** - Mild, Moderate, or Severe
   - **Duration** - How long symptoms have lasted
   - **Onset Date** - When symptoms started
   - **Notes** - Additional observations
3. **Click "Save Symptoms"**

#### Viewing Symptoms
- **Expandable List** - Click to see full details
- **Severity Badges** - Color-coded severity levels
- **Chronological Order** - Most recent first
- **Quick Summary** - Key information at a glance

### Illnesses Tab
Manage diagnosed conditions:

#### Adding Illnesses
1. **Click "Add Illness"** button
2. **Enter Illness Information**:
   - **Name** - Condition name
   - **Description** - Detailed description
   - **Status** - Active, Chronic, or Resolved
   - **Diagnosis Date** - When diagnosed
   - **Notes** - Additional information
3. **Click "Save Illness"**

#### Viewing Illnesses
- **Expandable Entries** - Click for full details
- **Status Indicators** - Current condition status
- **Timeline View** - Chronological illness history
- **Quick Overview** - Status and description summary

### Prescriptions Tab
M-Prescribe and track prescriptions:

#### Creating New Prescriptions
1. **Click "New Prescription"** button (creates a new prescription)
2. **Click "Add Drug"** button (opens medication form)
3. **Enter Medication Details**:
   - **Name** - Medication name (with autocomplete suggestions)
   - **Dosage** - Amount and frequency
   - **Instructions** - How to take the medication
   - **Duration** - Treatment length
   - **Notes** - Additional instructions
4. **Use Drug Database**:
   - Type medication name to see suggestions
   - Click "To database" to add new drugs
   - Select from dropdown to auto-fill form
5. **Click "Save Medication"** (adds medication to current prescription)
6. **Repeat steps 2-5** to add more medications to the same prescription
7. **Complete/Send/Print** the prescription when finished

#### Editing Prescriptions
1. **Click "Edit" button** next to any prescription
2. **Form opens with current values** pre-filled
3. **Modify any field** as needed
4. **Click "Save Medication"** to update

#### Medical Summary
The prescriptions tab includes a comprehensive summary showing:
- **Recent Symptoms** - Up to 2 most recent with severity
- **Recent Illnesses** - Up to 2 most recent with status
- **Recent Prescriptions** - Up to 2 most recent with dosage
- **Quick Statistics** - Counts and dates

#### Viewing Prescriptions
- **Expandable Entries** - Click for detailed information
- **Dosage Information** - Clear dosage and instructions
- **Related Medical History** - Symptoms and illnesses context
- **Treatment Timeline** - Chronological prescription history

## 🔍 Search and Navigation

### Patient Search
The search functionality helps you quickly find patients:

#### Search Methods
- **Partial Name Search** - Type part of first or last name
- **Full Name Search** - Type complete patient name
- **ID Search** - Enter patient ID number
- **Phone Search** - Use phone number
- **Email Search** - Search by email address
- **Date Search** - Use birth date in any format

#### Search Tips
- **Case Insensitive** - Search works regardless of case
- **Partial Matches** - Find patients with partial information
- **Multiple Criteria** - Search works across all fields
- **Real-time Results** - Results update as you type

### Navigation Tips
- **Clickable Overview Cards** - Quick navigation between sections
- **Tab Navigation** - Switch between medical data types
- **Expandable Sections** - Click to see detailed information
- **Responsive Design** - Works on all screen sizes

## 📱 Mobile Usage

### Mobile Interface
The system is optimized for mobile devices:
- **Responsive Layout** - Adapts to screen size
- **Touch-Friendly** - Large buttons and touch targets
- **Simplified Navigation** - Easy mobile navigation
- **Optimized Forms** - Mobile-friendly input fields

### Mobile Tips
- **Portrait Mode** - Best viewed in portrait orientation
- **Touch Navigation** - Tap to select and navigate
- **Swipe Gestures** - Scroll through patient lists
- **Zoom Support** - Pinch to zoom for better readability

## 💊 Drug Database System

### Personal Drug Database
Each doctor has their own personal drug database that stores frequently used medications for quick access and autocomplete suggestions.

#### Using Drug Autocomplete
1. **Start Typing** - Begin typing a medication name
2. **See Suggestions** - Dropdown appears with matching drugs
3. **Select Drug** - Click on a suggestion to auto-fill the form
4. **Complete Form** - Fill in remaining details (dosage, instructions, etc.)

#### Adding Drugs to Database
1. **Type New Drug Name** - Enter a medication not in your database
2. **Click "To database"** - Add the drug to your personal database
3. **See Confirmation** - Green notification confirms addition
4. **Future Use** - Drug will appear in autocomplete suggestions

#### Managing Your Database
- **Automatic Storage** - Drugs are saved when you add prescriptions
- **Persistent Data** - Database survives browser restarts
- **Doctor-Specific** - Each doctor has their own database
- **No Internet Required** - Works completely offline

## 💊 Pharmacist Management

### Connecting with Pharmacists
Doctors can connect with pharmacists to share prescriptions and improve patient care coordination.

#### Adding Pharmacists
1. **Go to Pharmacists Tab** - Click the "Pharmacists" tab in the main navigation
2. **Connect Pharmacist** - Click "Connect Pharmacist" button
3. **Enter Pharmacist Number** - Input the 6-digit number provided by the pharmacist
4. **Confirm Connection** - Click "Connect" to establish the relationship
5. **View Connected Pharmacists** - See all connected pharmacists in the "Connected Pharmacists" section

#### Managing Connections
- **View Connected Pharmacists** - See all pharmacists you're connected with
- **Pharmacist Information** - View business name, email, and connection date
- **Disconnect** - Remove pharmacist connections if needed
- **Search Pharmacists** - Find available pharmacists by name, email, or ID

#### Prescription Sharing
- **Automatic Sharing** - Prescriptions are automatically shared with connected pharmacists
- **Real-time Updates** - Pharmacists see new prescriptions immediately
- **Complete Information** - Pharmacists receive full prescription details including medications and patient information

### Benefits of Pharmacist Integration
- **Improved Coordination** - Better communication between doctors and pharmacists
- **Reduced Errors** - Clear prescription details reduce medication errors
- **Patient Safety** - Pharmacists can verify prescriptions and provide additional safety checks
- **Efficient Workflow** - Streamlined prescription management process

## 🖨️ Generating Prescriptions

### PDF Prescription
1. **Select a Patient** - Choose from patient list
2. **Add Prescriptions** - Ensure prescriptions are recorded
3. **Click "Generate Prescription"** button
4. **Review PDF** - Check prescription details
5. **Print or Save** - Use browser print function

### Prescription Details
The PDF includes:
- **Doctor Information** - Your name and details
- **Patient Information** - Patient name and details
- **Prescription List** - All prescribed prescriptions
- **Instructions** - Dosage and usage instructions
- **Date** - Prescription date

## 🔔 Notification System

### Real-Time Feedback
The system provides instant feedback for all your actions through a notification system in the top-right corner of the screen.

#### Notification Types
- **Success Notifications** (Green) - Confirm successful actions
- **Info Notifications** (Blue) - Provide helpful information
- **Warning Notifications** (Yellow) - Alert you to potential issues
- **Error Notifications** (Red) - Show error messages

#### Common Notifications
- **Drug Added** - "Drug name added to your drug database"
- **Drug Loaded** - "Drug name loaded from your drug database"
- **Form Saved** - "Prescription saved successfully"
- **Data Updated** - "Patient information updated"

#### Managing Notifications
- **Auto-Dismiss** - Notifications disappear automatically after 3-5 seconds
- **Manual Close** - Click the X button to close immediately
- **Multiple Notifications** - Several notifications can appear at once
- **Non-Intrusive** - Notifications don't block your work

## 💾 Data Management

### Data Storage
- **Local Storage** - All data stored on your device
- **No Internet Required** - Works offline
- **Automatic Saving** - Data saved immediately
- **Data Security** - Information stays on your device

### Data Backup
- **Export Data** - Use browser tools to export data
- **Regular Backups** - Export data regularly
- **Data Recovery** - Restore from exported files
- **Data Migration** - Move data between devices

## 🔧 Troubleshooting

### Common Issues

#### Search Not Working
- **Check Spelling** - Verify search terms
- **Try Different Criteria** - Use name, ID, or phone
- **Clear Search** - Click the X to clear search
- **Refresh Page** - Reload the application

#### Data Not Saving
- **Check Required Fields** - Ensure First Name and Age are filled (marked with red asterisks)
- **Age Requirements** - Age can be entered directly OR calculated from date of birth
- **Verify Internet Connection** - Although not required, check connectivity
- **Clear Browser Cache** - Clear cache and try again
- **Check Browser Storage** - Ensure localStorage is available

#### Performance Issues
- **Limit Search Results** - Search is limited to 20 results
- **Close Unused Tabs** - Close unnecessary browser tabs
- **Clear Browser Data** - Clear cache and cookies
- **Restart Browser** - Close and reopen browser

### Getting Help
- **Check Console** - Open browser console (F12) for errors
- **Verify Data** - Check if data is properly saved
- **Test Functionality** - Try different features
- **Contact Support** - Reach out for technical assistance

## 📊 Best Practices

### Data Entry
- **Complete Information** - Fill in all available fields
- **Accurate Details** - Double-check patient information
- **Regular Updates** - Keep medical records current
- **Consistent Formatting** - Use consistent data formats

### Patient Management
- **Regular Reviews** - Review patient data regularly
- **Update Status** - Keep illness and medication status current
- **Document Changes** - Record all medical changes
- **Maintain Privacy** - Keep patient data secure

### System Usage
- **Regular Backups** - Export data frequently
- **Clean Data** - Remove outdated information
- **Organize Records** - Keep patient records organized
- **Test Features** - Regularly test system functionality

## 🔒 Security and Privacy

### Data Protection
- **Local Storage Only** - Data never leaves your device
- **No Cloud Storage** - Information not stored online
- **Secure Access** - Password-protected access
- **Data Isolation** - Each doctor sees only their patients

### Privacy Considerations
- **Patient Confidentiality** - Maintain patient privacy
- **Secure Device** - Keep your device secure
- **Regular Logout** - Sign out when not in use
- **Data Disposal** - Properly dispose of old devices

## 📈 Tips for Efficiency

### Quick Actions
- **Use Search** - Find patients quickly with search
- **Keyboard Shortcuts** - Use Tab key to navigate forms
- **Clickable Cards** - Use overview cards for quick navigation
- **Expandable Sections** - Click to see detailed information

### Workflow Optimization
- **Batch Operations** - Add multiple entries at once
- **Template Data** - Use similar entries as templates
- **Regular Updates** - Keep records current
- **Organized Layout** - Use the responsive layout effectively

### Time-Saving Features
- **Auto-Save** - Data saves automatically
- **Quick Search** - Find patients instantly
- **Expandable Views** - See details without navigation
- **Medical Summary** - Quick overview of patient status

This user guide should help you make the most of the Patient Management System. For additional support or questions, please refer to the technical documentation or contact the development team.
