# 🏥 Prescribe - Beginner's Guide

> Legacy onboarding guide. Canonical product docs: `PRODUCT_MANUAL.md` and `DOCS.md`.

Welcome to Prescribe, your comprehensive patient management and prescription system! This guide will walk you through everything you need to know to get started, from creating your account to managing your first patient.

## 📋 Table of Contents

1. [What is Prescribe?](#what-is-prescribe)
2. [Getting Started](#getting-started)
3. [Your First Login](#your-first-login)
4. [Understanding the Interface](#understanding-the-interface)
5. [Adding Your First Patient](#adding-your-first-patient)
6. [Creating Your First Prescription](#creating-your-first-prescription)
7. [Managing Medical Records](#managing-medical-records)
8. [Working with Pharmacists](#working-with-pharmacists)
9. [Common Tasks](#common-tasks)
10. [Troubleshooting](#troubleshooting)
11. [Tips for Success](#tips-for-success)

---

## 🎯 What is Prescribe?

Prescribe is a modern, web-based patient management system designed specifically for healthcare professionals. It helps you:

- **Manage Patients**: Store and organize patient information securely
- **Create Prescriptions**: Generate professional prescriptions with AI assistance
- **Track Medical History**: Record symptoms, diagnoses, and treatments
- **Connect with Pharmacists**: Share prescriptions with pharmacy partners
- **Ensure Privacy**: HIPAA-compliant data isolation between doctors

### Key Features:
- 🔒 **Secure**: Each doctor can only see their own patients
- 🤖 **AI-Powered**: Smart drug interaction checking and recommendations
- 📱 **Mobile-Friendly**: Works on phones, tablets, and computers
- 💊 **Drug Database**: Personal medication database with autocomplete
- 🖨️ **PDF Generation**: Professional prescription printing
- 🔄 **Real-time Sync**: Data syncs across all your devices

---

## 🚀 Getting Started

### System Requirements
- **Internet Connection**: Required for initial setup and data sync
- **Web Browser**: Chrome, Firefox, Safari, or Edge (latest versions)
- **Device**: Computer, tablet, or smartphone

### Access the System
1. Open your web browser
2. Go to: `https://mprescribe.net` (legacy: `https://prescribe-7e1e8.web.app`)
3. You'll see the login screen with three options:
   - **Doctor** (for healthcare providers)
   - **Pharmacist** (for pharmacy staff)
   - **Admin** (for system administrators)

---

## 🔐 Your First Login

### For Doctors

#### Option 1: Google Login (Recommended)
1. Click **"Login with Google"**
2. Select your Google account
3. Grant permission to the application
4. Your doctor profile is created automatically
5. You're ready to start!

#### Option 2: Email/Password Registration
1. Click **"Register"** under the Doctor section
2. Fill in your details:
   - **First Name**: Your given name
   - **Last Name**: Your family name
   - **Email**: Your professional email
   - **Password**: Create a secure password (6+ characters)
   - **Country**: Your practice location
3. Click **"Register"**
4. You'll be automatically logged in

### For Pharmacists
1. Click the **"Pharmacist"** tab
2. Click **"Register"**
3. Fill in your pharmacy details:
   - **Business Name**: Your pharmacy name
   - **Email**: Your business email
   - **Password**: Create a secure password
4. After registration, you'll receive:
   - A **6-digit pharmacist number**
   - A **PH code** (example: `PH48397`)
5. Share either ID with doctors to connect

---

## 🖥️ Understanding the Interface

### Main Dashboard Layout

When you log in as a doctor, you'll see:

```
┌─────────────────────────────────────────────────────────┐
│ Header: Welcome, Dr. [Name] | Edit Profile | Admin     │
├─────────────────┬───────────────────────────────────────┤
│ Patient List    │ Patient Details Panel                 │
│ (Left Side)     │ (Right Side)                          │
│                 │                                       │
│ • Search Box    │ • Patient Information                 │
│ • Add Patient   │ • Medical Tabs:                       │
│ • Patient List  │   - Overview                          │
│                 │   - Symptoms                          │
│                 │   - Reports                           │
│                 │   - Diagnoses                         │
│                 │   - Prescriptions                     │
└─────────────────┴───────────────────────────────────────┘
```

### Navigation Tabs
- **Overview**: Quick summary and statistics
- **Symptoms**: Patient symptoms and complaints
- **Reports**: Lab results and medical reports
- **Diagnoses**: Medical diagnoses and conditions
- **Prescriptions**: Medication management and prescriptions

---

## 👥 Adding Your First Patient

### Step-by-Step Process

1. **Click "Add Patient"** button (top-left of patient list)

2. **Fill Required Information** (marked with red asterisks *):
   - **First Name***: Patient's given name
   - **Age***: Patient's age (can be calculated from date of birth)

3. **Add Optional Information** (can be added later):
   - **Last Name**: Family name
   - **Email**: Contact email
   - **Phone**: Phone number
   - **Date of Birth**: Birth date (will calculate age automatically)
   - **Weight**: Body weight (important for dosing)
   - **Blood Group**: Blood type (critical for medical procedures)
   - **ID Number**: National ID or passport number
   - **Address**: Home address
   - **Allergies**: Known allergies (displayed prominently)
   - **Emergency Contact**: Emergency contact details

4. **Click "Save Patient"**

### Important Notes:
- Only **First Name** and **Age** are required
- All other information can be added later by editing the patient
- **Blood Group** and **Allergies** are displayed prominently for quick medical reference
- The system will automatically calculate age if you provide date of birth

---

## 💊 Creating Your First Prescription

### Complete Prescription Workflow

#### Step 1: Create New Prescription
1. **Select a patient** from the patient list
2. **Click "Prescriptions" tab**
3. **Click "New Prescription"** button
4. A new prescription is created (you'll see "New Prescription" in the header)

#### Step 2: Add Medications
1. **Click "Add Drug"** button
2. **Fill in medication details**:
   - **Name**: Type medication name (autocomplete will help)
   - **Dosage**: Amount and frequency (e.g., "500mg twice daily")
   - **Instructions**: How to take the medication
   - **Duration**: How long to take it (e.g., "7 days", "2 weeks")
   - **Start Date**: When to start (defaults to today)
   - **Notes**: Additional instructions

3. **Use Drug Database**:
   - Start typing a medication name
   - Select from dropdown suggestions
   - Or click "To database" to add new drugs

4. **Click "Save Medication"**

#### Step 3: Add More Medications (Optional)
- Repeat Step 2 to add additional medications to the same prescription
- Each medication is added to the current prescription

#### Step 4: Complete the Prescription
Choose one of these options:
- **Save**: Save the prescription (moves to history)
- **Print PDF**: Generate a printable prescription
- **Send to Pharmacy**: Share with connected pharmacists

### Smart Prescription Features:
- **Drug Autocomplete**: Type to see suggestions from your personal database
- **AI Drug Interactions**: Automatic checking for potential interactions
- **Professional PDF**: Generate printable prescriptions
- **Pharmacy Integration**: Send directly to connected pharmacists

---

## 📋 Managing Medical Records

### Symptoms Management

#### Adding Symptoms
1. **Click "Symptoms" tab**
2. **Click "Add Symptoms"** button
3. **Fill in details**:
   - **Description**: What the patient is experiencing
   - **Severity**: Mild, Moderate, or Severe
   - **Duration**: How long symptoms have lasted
   - **Onset Date**: When symptoms started (optional)
   - **Notes**: Additional observations
4. **Click "Save Symptoms"**

#### Viewing Symptoms
- Symptoms appear in chronological order (newest first)
- Click on any symptom to see full details
- Severity is color-coded with badges

### Diagnoses Management

#### Adding Diagnoses
1. **Click "Diagnoses" tab**
2. **Click "Add Diagnosis"** button
3. **Enter diagnosis information**:
   - **Title**: Diagnosis name
   - **Description**: Detailed description
   - **Severity**: Mild, Moderate, or Severe
   - **Date**: When diagnosed
   - **Code**: Diagnostic code (optional)
4. **Click "Save Diagnosis"**

### Reports Management

#### Adding Medical Reports
1. **Click "Reports" tab**
2. **Click "Add Report"** button
3. **Choose report type**:
   - **Text Entry**: Type report content
   - **PDF Upload**: Upload PDF files
   - **Image Upload**: Upload image files
4. **Fill in details**:
   - **Title**: Report title
   - **Date**: Report date
   - **Content**: Report content or upload file
5. **Click "Save Report"**

---

## 🏪 Working with Pharmacists

### Connecting with Pharmacists

#### For Doctors:
1. **Get Pharmacy ID**: Ask your pharmacy partner for their 6-digit number or PH code
2. **Go to Pharmacists Tab**: Click "Pharmacists" in the main navigation
3. **Connect Pharmacist**: Click "Connect Pharmacist"
4. **Enter ID**: Input the 6-digit number or PH code
5. **Confirm**: Click "Connect"

**Auto-connect (own pharmacy)**: If a pharmacy account exists with the **same email** as the doctor, it is automatically connected as the doctor’s own pharmacy.

#### For Pharmacists:
1. **Register**: Create your pharmacist account
2. **Get Your IDs**: Note your 6-digit number and PH code
3. **Share with Doctors**: Give either ID to doctors you want to work with

### Prescription Sharing
- **Automatic Sharing**: Prescriptions are automatically shared with connected pharmacists
- **Real-time Updates**: Pharmacists see new prescriptions immediately
- **Complete Information**: Full prescription details including medications and patient information

---

## 🔍 Common Tasks

### Finding Patients
- **Search Box**: Type any part of the patient's name, ID, phone, or email
- **Real-time Results**: Results appear as you type
- **Multiple Criteria**: Search works across all patient fields

### Editing Patient Information
1. **Select Patient**: Click on patient from the list
2. **Click "Edit"**: Button next to patient's name
3. **Update Information**: Change any field
4. **Save Changes**: Click "Save Changes"

### Managing Your Profile
1. **Click "Edit Profile"**: In the header
2. **Update Information**: Change name, country, etc.
3. **Save Changes**: Click "Save Changes"

### Using the Drug Database
- **Personal Database**: Each doctor has their own drug database
- **Autocomplete**: Type medication names to see suggestions
- **Adding New Drugs**: Click "To database" to add new medications
- **Offline Access**: Works without internet connection

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### "Can't Find Patient"
- **Check Spelling**: Verify the search term
- **Try Different Search**: Use name, ID, phone, or email
- **Clear Search**: Click the X to clear search box
- **Refresh Page**: Reload the application

#### "Data Not Saving"
- **Check Required Fields**: Ensure First Name and Age are filled
- **Verify Internet**: Check your internet connection
- **Clear Browser Cache**: Clear cache and try again
- **Check Browser Storage**: Ensure localStorage is available

#### "Prescription Not Working"
- **Create Prescription First**: Click "New Prescription" before adding drugs
- **Check Patient Selection**: Make sure a patient is selected
- **Verify Drug Details**: Ensure all required fields are filled

#### "Can't Connect to Pharmacist"
- **Verify ID**: Double-check the 6-digit number or PH code
- **Check Pharmacist Registration**: Ensure the pharmacy account exists
- **Own Pharmacy**: If using the same email for doctor + pharmacy, it should auto-connect
- **Try Again**: Sometimes connection takes a moment

### Getting Help
- **Check Console**: Press F12 to open browser console for error messages
- **Verify Data**: Check if data is properly saved
- **Test Features**: Try different features to isolate the problem
- **Contact Support**: Reach out for technical assistance

---

## 💡 Tips for Success

### Best Practices

#### Data Entry
- **Complete Information**: Fill in all available fields for better patient care
- **Accurate Details**: Double-check patient information before saving
- **Regular Updates**: Keep medical records current
- **Consistent Formatting**: Use consistent data formats

#### Patient Management
- **Regular Reviews**: Review patient data regularly
- **Update Status**: Keep illness and medication status current
- **Document Changes**: Record all medical changes
- **Maintain Privacy**: Keep patient data secure

#### System Usage
- **Use Search**: Find patients quickly with the search function
- **Keyboard Shortcuts**: Use Tab key to navigate forms
- **Clickable Cards**: Use overview cards for quick navigation
- **Mobile Access**: Use the system on your phone for quick access

### Efficiency Tips
- **Batch Operations**: Add multiple entries at once
- **Template Data**: Use similar entries as templates
- **Regular Backups**: Export data frequently
- **Organize Records**: Keep patient records organized

### Security Tips
- **Log Out**: Sign out when not in use
- **Secure Device**: Keep your device secure and updated
- **Data Disposal**: Properly dispose of old devices
- **Regular Updates**: Keep the system updated

---

## 🎉 Congratulations!

You've completed the beginner's guide! You now know how to:

✅ **Create and manage your account**  
✅ **Add and search for patients**  
✅ **Create prescriptions with medications**  
✅ **Manage medical records (symptoms, diagnoses, reports)**  
✅ **Connect with pharmacists**  
✅ **Troubleshoot common issues**  

### Next Steps:
1. **Practice**: Try adding a test patient and creating a prescription
2. **Explore**: Click around the interface to familiarize yourself
3. **Connect**: Reach out to local pharmacists to establish connections
4. **Customize**: Set up your drug database with commonly used medications

### Additional Resources:
- **USER_GUIDE.md**: Detailed user manual for advanced features
- **TECHNICAL_IMPLEMENTATION.md**: Technical details for developers
- **API_DOCUMENTATION.md**: API reference for integrations

---

## 📞 Support

If you need help or have questions:
- **Check this guide** for common solutions
- **Review the USER_GUIDE.md** for detailed instructions
- **Contact support** for technical assistance

**Welcome to Prescribe! We're here to help you provide better patient care.** 🏥✨
