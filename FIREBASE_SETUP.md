# Firebase Setup Guide

This guide will help you connect your patient management system to Firebase for cloud storage and authentication.

## Prerequisites

- Node.js installed
- Firebase account
- Basic understanding of Firebase services

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `prescribe-patient-management`
4. Enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Authentication

1. In Firebase Console, go to "Authentication"
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password" provider
5. Click "Save"

## Step 3: Create Firestore Database

1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location close to your users
5. Click "Done"

## Step 4: Configure Security Rules

Replace the default Firestore rules with these:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Doctors can only access their own data
    match /doctors/{doctorId} {
      allow read, write: if request.auth != null && request.auth.uid == doctorId;
    }
    
    // Patients belong to doctors
    match /patients/{patientId} {
      allow read, write: if request.auth != null && 
        resource.data.doctorId == request.auth.uid;
    }
    
    // Illnesses belong to patients
    match /illnesses/{illnessId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/patients/$(resource.data.patientId)) &&
        get(/databases/$(database)/documents/patients/$(resource.data.patientId)).data.doctorId == request.auth.uid;
    }
    
    // Medications belong to patients
    match /medications/{medicationId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/patients/$(resource.data.patientId)) &&
        get(/databases/$(database)/documents/patients/$(resource.data.patientId)).data.doctorId == request.auth.uid;
    }
    
    // Symptoms belong to patients
    match /symptoms/{symptomId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/patients/$(resource.data.patientId)) &&
        get(/databases/$(database)/documents/patients/$(resource.data.patientId)).data.doctorId == request.auth.uid;
    }
    
    // Drug database belongs to doctors
    match /drugDatabase/{drugId} {
      allow read, write: if request.auth != null && 
        resource.data.doctorId == request.auth.uid;
    }
  }
}
```

## Step 5: Get Firebase Configuration

1. In Firebase Console, go to "Project Settings" (gear icon)
2. Scroll down to "Your apps" section
3. Click "Add app" and select "Web" (</> icon)
4. Register your app with a nickname
5. Copy the configuration object

## Step 6: Configure Environment Variables

1. Copy `env.example` to `.env`:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` and replace the placeholder values:
   ```env
   VITE_FIREBASE_API_KEY=your-actual-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_USE_FIREBASE=true
   VITE_ENABLE_MIGRATION=true
   ```

## Step 7: Install Dependencies

```bash
npm install firebase
```

## Step 8: Test the Setup

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open the application in your browser
3. Try to create a new doctor account
4. Check Firebase Console to see if data appears

## Step 9: Migrate Existing Data

If you have existing data in localStorage:

1. Log in with your doctor account
2. The app will automatically detect if migration is needed
3. Follow the migration prompts to move data to Firebase

## Firebase Services Used

### Authentication
- **Email/Password**: Doctor login system
- **User Management**: Secure doctor accounts

### Firestore Database
- **Collections**:
  - `doctors`: Doctor profiles
  - `patients`: Patient information
  - `illnesses`: Patient illness records
  - `medications`: Prescription data
  - `symptoms`: Patient symptoms
  - `drugDatabase`: Doctor-specific drug database

### Security Features
- **Row-level Security**: Doctors can only access their own data
- **Authentication Required**: All operations require valid login
- **Data Validation**: Server-side validation of data access

## Development vs Production

### Development Mode
- Uses test mode Firestore rules
- Allows easy testing and development
- Data is not production-ready

### Production Mode
- Update Firestore rules for production
- Enable additional security features
- Set up proper backup and monitoring

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Check if email/password authentication is enabled
   - Verify Firebase configuration values

2. **Permission Denied**
   - Check Firestore security rules
   - Ensure user is properly authenticated

3. **Data Not Appearing**
   - Check browser console for errors
   - Verify Firebase project configuration
   - Check if user is logged in

4. **Migration Issues**
   - Ensure user is authenticated before migration
   - Check if localStorage has data to migrate
   - Verify Firebase permissions

### Debug Commands

Open browser console and run:
```javascript
// Check Firebase connection
window.firebaseDebug = true

// Check data state
storageService.debugDataState()

// Check migration status
dataMigrationService.needsMigration()
```

## Next Steps

1. **Deploy to Firebase Hosting** (optional)
2. **Set up monitoring and analytics**
3. **Configure backup strategies**
4. **Add additional security features**

## Support

For issues with Firebase setup:
- Check [Firebase Documentation](https://firebase.google.com/docs)
- Review browser console for error messages
- Verify all configuration values are correct
