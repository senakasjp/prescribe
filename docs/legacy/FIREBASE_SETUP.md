# Firebase Setup Guide

> Legacy setup guide. Canonical technical source is `ENGINEERING_MANUAL.md`.

This guide will help you set up Firebase for the M-Prescribe application.

## 🆕 Recent Updates (February 17, 2026)

### **🟠 Stock Management Collections**
- **Pharmacist Stock Collection**: New `pharmacistStock` collection for drug inventory management
- **Initial Quantity Tracking**: Stock items now include `initialQuantity` field for low-stock calculations
- **Real-time Stock Monitoring**: Automatic stock level monitoring with visual indicators
- **Pharmacy Integration**: Connected pharmacists' stock data accessible to doctors

### **🔧 Critical Fixes**
- **Firebase Index Issues**: Resolved Firebase compound query index errors by removing orderBy clauses
- **Prescription Data Persistence**: Fixed issue where medications disappeared on page refresh
- **Simplified Prescription Logic**: New Prescription button always creates a new prescription

### **🎯 New Prescription Workflow**
- **Simple Rule**: Click "New Prescription" button = Always creates a new prescription
- **Clear Workflow**: Must create prescription before adding medications
- **User-Friendly**: Helpful error messages guide users through the process

## 🔥 Firebase Project Setup

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `m-prescribe` (or your preferred name)
4. Enable Google Analytics (optional)
5. Click "Create project"

### Step 2: Enable Firestore Database
1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location (choose closest to your users)
5. Click "Done"

### Step 3: Enable Authentication
1. In Firebase Console, go to "Authentication"
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password" provider
5. Enable "Google" provider
6. Configure Google provider with your domain (for production)

### Step 4: Configure Firebase Config
1. In Firebase Console, go to "Project settings" (gear icon)
2. Scroll down to "Your apps" section
3. Click "Web" icon (`</>`) to add a web app
4. Enter app nickname: `M-Prescribe Web`
5. Check "Also set up Firebase Hosting" (optional)
6. Click "Register app"
7. Copy the Firebase configuration object

### Step 5: Update Firebase Config File
Replace the content in `src/firebase-config.js` with your Firebase configuration:

```javascript
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

// Configure Google provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
})
```

## 🔒 Firestore Security Rules

### Development Rules (Test Mode)
For development, you can use these permissive rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to all documents for authenticated users
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Production Rules (Recommended)
For production, use these more restrictive rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Doctors can only access their own data
    match /doctors/{doctorId} {
      allow read, write: if request.auth != null && request.auth.uid == doctorId;
    }
    
    // Patients can only be accessed by their assigned doctor
    match /patients/{patientId} {
      allow read, write: if request.auth != null && 
        resource.data.doctorId == request.auth.uid;
    }
    
    // Medical data can only be accessed by the patient's doctor
    match /illnesses/{illnessId} {
      allow read, write: if request.auth != null && 
        resource.data.doctorId == request.auth.uid;
    }
    
    match /medications/{medicationId} {
      allow read, write: if request.auth != null && 
        resource.data.doctorId == request.auth.uid;
    }
    
    match /symptoms/{symptomId} {
      allow read, write: if request.auth != null && 
        resource.data.doctorId == request.auth.uid;
    }
    
    // Pharmacists can access their own data and prescriptions
    match /pharmacists/{pharmacistId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == pharmacistId;
      
      // Allow access to received prescriptions subcollection
      match /receivedPrescriptions/{prescriptionId} {
        allow read, write: if request.auth != null && 
          request.auth.uid == pharmacistId;
      }
    }
    
    // Drug database is doctor-specific
    match /drugDatabase/{drugId} {
      allow read, write: if request.auth != null && 
        resource.data.doctorId == request.auth.uid;
    }
  }
}
```

## 🚀 Firebase Hosting (Optional)

### Deploy to Firebase Hosting
1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in your project:
   ```bash
   firebase init hosting
   ```

4. Build your project:
   ```bash
   npm run build
   ```

5. Deploy to Firebase:
   ```bash
   firebase deploy
   ```

## 🔧 Environment Variables

Create a `.env` file in your project root:

```env
# Firebase Configuration (if needed)
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

```

Set the OpenAI key in Functions secrets:
```bash
firebase functions:secrets:set OPENAI_API_KEY
```

## 📊 Firebase Collections Structure

The application uses the following Firestore collections:

### Collections
- `doctors` - Doctor profiles and authentication data
- `patients` - Patient information (linked to doctors via `doctorId`)
- `illnesses` - Patient illness records (linked to patients and doctors)
- `medications` - Prescription and medication data (linked to patients and doctors)
- `symptoms` - Patient symptom records (linked to patients and doctors)
- `pharmacists` - Pharmacist profiles and business information
- `drugDatabase` - Doctor-specific drug databases
- `pharmacistStock` - Pharmacist drug inventory with stock levels and availability

### Subcollections
- `pharmacists/{pharmacistId}/receivedPrescriptions` - Prescriptions sent to pharmacists

## 🧪 Testing Firebase Integration

### Test Authentication
1. Try Google authentication
2. Try email/password authentication
3. Verify user data is created in Firestore

### Test Data Operations
1. Create a patient
2. Add medical data (symptoms, illnesses, prescriptions)
3. Verify data appears in Firebase Console
4. Test data persistence across browser sessions

### Test Doctor Isolation
1. Create two different doctor accounts
2. Add patients to each doctor
3. Verify each doctor only sees their own patients

### Test Pharmacist Integration
1. Create a pharmacist account
2. Connect pharmacist to doctor
3. Send prescription from doctor to pharmacist
4. Verify prescription appears in pharmacist dashboard

## 🚨 Troubleshooting

### Common Issues

1. **Firebase Config Error**
   - Verify your Firebase configuration is correct
   - Check that all required fields are present

2. **Authentication Issues**
   - Ensure Authentication is enabled in Firebase Console
   - Check that sign-in methods are properly configured

3. **Firestore Permission Denied**
   - Verify Firestore security rules
   - Check that user is properly authenticated

4. **Data Not Persisting**
   - Check browser console for errors
   - Verify Firestore is enabled and accessible

### Debug Mode
Enable debug mode by adding this to your Firebase config:

```javascript
// Enable debug mode (development only)
if (import.meta.env.DEV) {
  import('firebase/firestore').then(({ enableNetwork, disableNetwork }) => {
    // Enable offline persistence
    enableNetwork(db)
  })
}
```

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
