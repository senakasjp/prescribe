# Complete Rebuild Guide

## Overview
This guide provides step-by-step instructions to rebuild the M-Prescribe application from scratch, including all configurations, dependencies, and deployment setup.

## Prerequisites

### System Requirements
- **Node.js**: Version 16 or higher
- **npm**: Version 8 or higher
- **Firebase CLI**: Latest version
- **Git**: For version control
- **Code Editor**: VS Code recommended

### Accounts Required
- **Firebase Account**: For hosting and database
- **OpenAI Account**: For AI features (optional)
- **GitHub Account**: For code repository (optional)

## Step 1: Project Setup

### 1.1 Create Project Directory
```bash
mkdir prescribe-app
cd prescribe-app
```

### 1.2 Initialize Git Repository
```bash
git init
git remote add origin <your-repository-url>
```

### 1.3 Initialize npm Project
```bash
npm init -y
```

## Step 2: Install Dependencies

### 2.1 Core Dependencies
```bash
npm install svelte @sveltejs/vite-plugin-svelte vite
npm install firebase
npm install tailwindcss @tailwindcss/forms
npm install @tailwindcss/typography
npm install postcss autoprefixer
npm install flowbite flowbite-svelte
npm install @fortawesome/fontawesome-free
npm install apexcharts
npm install jspdf html2canvas
npm install dompurify
```

### 2.2 Development Dependencies
```bash
npm install -D @sveltejs/adapter-auto
npm install -D @testing-library/svelte
npm install -D @testing-library/jest-dom
npm install -D vitest
npm install -D happy-dom
npm install -D eslint
npm install -D prettier
npm install -D @typescript-eslint/eslint-plugin
npm install -D @typescript-eslint/parser
```

### 2.3 Complete package.json
```json
{
  "name": "prescribe-patient-management",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "dependencies": {
    "svelte": "^4.2.7",
    "@sveltejs/vite-plugin-svelte": "^3.0.0",
    "vite": "^5.0.0",
    "firebase": "^10.7.0",
    "tailwindcss": "^3.3.0",
    "@tailwindcss/forms": "^0.5.7",
    "@tailwindcss/typography": "^0.5.10",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16",
    "flowbite": "^2.0.0",
    "flowbite-svelte": "^0.40.0",
    "@fortawesome/fontawesome-free": "^6.5.0",
    "apexcharts": "^3.44.0",
    "jspdf": "^2.5.1",
    "html2canvas": "^1.4.1",
    "dompurify": "^3.0.5"
  },
  "devDependencies": {
    "@sveltejs/adapter-auto": "^2.0.0",
    "@testing-library/svelte": "^4.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "vitest": "^1.0.0",
    "happy-dom": "^12.0.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0"
  }
}
```

## Step 3: Configuration Files

### 3.1 Vite Configuration (vite.config.js)
```javascript
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'doctor-module': ['./src/components/doctor/DoctorModuleRouter.svelte'],
          'pharmacist-module': ['./src/components/pharmacist/PharmacistModuleRouter.svelte']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
})
```

### 3.2 Tailwind Configuration (tailwind.config.js)
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,js,svelte,ts}',
    './node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a'
        },
        teal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a'
        }
      }
    }
  },
  plugins: [
    require('flowbite/plugin'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ]
}
```

### 3.3 PostCSS Configuration (postcss.config.js)
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

### 3.4 Environment Variables (.env)
```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# OpenAI Configuration (Optional)
VITE_OPENAI_API_KEY=your_openai_key

# Admin Configuration
VITE_SUPER_ADMIN_EMAIL=admin@example.com
```

## Step 4: Firebase Setup

### 4.1 Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 4.2 Login to Firebase
```bash
firebase login
```

### 4.3 Initialize Firebase Project
```bash
firebase init
```

### 4.4 Firebase Configuration (firebase.json)
```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

### 4.5 Firestore Rules (firestore.rules)
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
    
    // Prescriptions can only be accessed by their doctor
    match /prescriptions/{prescriptionId} {
      allow read, write: if request.auth != null && 
        resource.data.doctorId == request.auth.uid;
    }
    
    // Pharmacists can only access their own data
    match /pharmacists/{pharmacistId} {
      allow read, write: if request.auth != null && request.auth.uid == pharmacistId;
    }
  }
}
```

## Step 5: Project Structure

### 5.1 Create Directory Structure
```bash
mkdir -p src/{components,services,utils,stores,data,tests}
mkdir -p src/components/{doctor,pharmacist,patient}
mkdir -p src/services/{doctor,pharmacist}
mkdir -p src/tests/{unit,integration,components,mocks}
mkdir -p public
mkdir -p dist
```

### 5.2 Create Main Files
```bash
touch src/main.js
touch src/App.svelte
touch src/app.css
touch index.html
touch public/favicon.ico
```

## Step 6: Core Application Files

### 6.1 Main HTML (index.html)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/favicon.ico" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>M-Prescribe</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

### 6.2 Main JavaScript (src/main.js)
```javascript
import './app.css'
import App from './App.svelte'

const app = new App({
  target: document.getElementById('app')
})

export default app
```

### 6.3 Main CSS (src/app.css)
```css
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';
@import '@fortawesome/fontawesome-free/css/all.min.css';

/* Custom styles */
body {
  font-family: 'Inter', sans-serif;
}

/* Flowbite components */
@import 'flowbite/dist/flowbite.css';
```

## Step 7: Firebase Configuration

### 7.1 Firebase Config (src/firebase-config.js)
```javascript
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app
```

## Step 8: Service Layer

### 8.1 Doctor Auth Service (src/services/doctor/doctorAuthService.js)
```javascript
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updateProfile
} from 'firebase/auth'
import { auth } from '../../firebase-config.js'

class DoctorAuthService {
  async createDoctor(email, password, profileData) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      await updateProfile(user, {
        displayName: `${profileData.firstName} ${profileData.lastName}`
      })
      
      const doctor = {
        id: user.uid,
        email: user.email,
        role: 'doctor',
        ...profileData,
        createdAt: new Date().toISOString()
      }
      
      this.saveCurrentDoctor(doctor)
      return doctor
    } catch (error) {
      throw new Error(`Failed to create doctor: ${error.message}`)
    }
  }
  
  async signInDoctor(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      const doctor = {
        id: user.uid,
        email: user.email,
        role: 'doctor',
        name: user.displayName || 'Doctor',
        authProvider: 'email-password'
      }
      
      this.saveCurrentDoctor(doctor)
      return doctor
    } catch (error) {
      throw new Error(`Failed to sign in: ${error.message}`)
    }
  }
  
  async signOutDoctor() {
    try {
      await signOut(auth)
      localStorage.removeItem('currentDoctor')
    } catch (error) {
      throw new Error(`Failed to sign out: ${error.message}`)
    }
  }
  
  getCurrentDoctor() {
    const doctor = localStorage.getItem('currentDoctor')
    return doctor ? JSON.parse(doctor) : null
  }
  
  saveCurrentDoctor(doctor) {
    localStorage.setItem('currentDoctor', JSON.stringify(doctor))
  }
}

export default new DoctorAuthService()
```

### 8.2 Doctor Storage Service (src/services/doctor/doctorStorageService.js)
```javascript
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy 
} from 'firebase/firestore'
import { db } from '../../firebase-config.js'

class DoctorStorageService {
  async createPatient(patientData, doctorId) {
    try {
      const patient = {
        ...patientData,
        doctorId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      const docRef = await addDoc(collection(db, 'patients'), patient)
      return { id: docRef.id, ...patient }
    } catch (error) {
      throw new Error(`Failed to create patient: ${error.message}`)
    }
  }
  
  async getPatientsByDoctorId(doctorId) {
    try {
      const q = query(
        collection(db, 'patients'),
        where('doctorId', '==', doctorId),
        orderBy('createdAt', 'desc')
      )
      
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (error) {
      throw new Error(`Failed to get patients: ${error.message}`)
    }
  }
  
  async createPrescription(patientId, doctorId, title, notes) {
    try {
      const prescription = {
        patientId,
        doctorId,
        title,
        notes,
        medications: [],
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      const docRef = await addDoc(collection(db, 'prescriptions'), prescription)
      return { id: docRef.id, ...prescription }
    } catch (error) {
      throw new Error(`Failed to create prescription: ${error.message}`)
    }
  }
  
  async getPrescriptionsByDoctorId(doctorId) {
    try {
      const q = query(
        collection(db, 'prescriptions'),
        where('doctorId', '==', doctorId),
        orderBy('createdAt', 'desc')
      )
      
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (error) {
      throw new Error(`Failed to get prescriptions: ${error.message}`)
    }
  }
}

export default new DoctorStorageService()
```

## Step 9: Utility Functions

### 9.1 Validation Utils (src/utils/validation.js)
```javascript
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePassword = (password) => {
  return password.length >= 6
}

export const validatePhone = (phone) => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
  return phoneRegex.test(phone)
}

export const validateRequired = (value) => {
  return value && value.trim().length > 0
}

export const sanitizeInput = (input) => {
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
}
```

### 9.2 Data Processing Utils (src/utils/dataProcessing.js)
```javascript
export const formatDate = (dateString) => {
  if (!dateString) return 'Unknown date'
  try {
    return new Date(dateString).toLocaleDateString()
  } catch (error) {
    return 'Invalid date'
  }
}

export const sortByDate = (array, dateField) => {
  return array.sort((a, b) => {
    const dateA = new Date(a[dateField] || 0)
    const dateB = new Date(b[dateField] || 0)
    return dateB - dateA
  })
}

export const filterBySearch = (array, searchQuery, fields) => {
  if (!searchQuery) return array
  
  return array.filter(item => {
    return fields.some(field => {
      const value = item[field]
      return value && value.toString().toLowerCase().includes(searchQuery.toLowerCase())
    })
  })
}

export const calculateStatistics = (data) => {
  return {
    total: data.length,
    active: data.filter(item => item.status === 'active').length,
    completed: data.filter(item => item.status === 'completed').length,
    cancelled: data.filter(item => item.status === 'cancelled').length
  }
}
```

### 9.3 UI Helper Utils (src/utils/uiHelpers.js)
```javascript
export const getIconClass = (type) => {
  const iconMap = {
    patient: 'fas fa-user',
    prescription: 'fas fa-prescription-bottle-alt',
    medication: 'fas fa-pills',
    doctor: 'fas fa-user-md',
    pharmacist: 'fas fa-user-nurse'
  }
  return iconMap[type] || 'fas fa-question'
}

export const getButtonClasses = (variant = 'primary') => {
  const variants = {
    primary: 'bg-teal-600 hover:bg-teal-700 text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white'
  }
  return variants[variant] || variants.primary
}

export const getBadgeClasses = (status) => {
  const statusMap = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800'
  }
  return statusMap[status] || 'bg-gray-100 text-gray-800'
}
```

### 9.4 Constants (src/utils/constants.js)
```javascript
export const VIEWS = {
  HOME: 'home',
  PATIENTS: 'patients',
  PRESCRIPTIONS: 'prescriptions',
  PHARMACIES: 'pharmacies',
  SETTINGS: 'settings'
}

export const PRESCRIPTION_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
}

export const MEDICATION_FREQUENCIES = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'As needed',
  'Every 4 hours',
  'Every 6 hours',
  'Every 8 hours',
  'Every 12 hours'
]

export const COUNTRIES = [
  'United States',
  'Canada',
  'United Kingdom',
  'Australia',
  'Germany',
  'France',
  'Japan',
  'India',
  'Brazil',
  'Mexico'
]
```

## Step 10: Build and Deploy

### 10.1 Build Application
```bash
npm run build
```

### 10.2 Deploy to Firebase
```bash
firebase deploy
```

## Step 11: Testing

### 11.1 Run Tests
```bash
npm test
```

### 11.2 Run Tests with UI
```bash
npm run test:ui
```

## Step 12: Development

### 12.1 Start Development Server
```bash
npm run dev
```

### 12.2 Lint Code
```bash
npm run lint
```

### 12.3 Format Code
```bash
npm run format
```

## Troubleshooting

### Common Issues

#### 1. Build Errors
- Check Node.js version (16+)
- Clear node_modules and reinstall
- Check for missing dependencies

#### 2. Firebase Errors
- Verify Firebase configuration
- Check Firestore rules
- Ensure proper authentication setup

#### 3. Import Errors
- Check file paths
- Verify component exports
- Check for circular dependencies

#### 4. Styling Issues
- Verify Tailwind configuration
- Check Flowbite integration
- Ensure proper CSS imports

### Debug Commands
```bash
# Check Node version
node --version

# Check npm version
npm --version

# Check Firebase CLI
firebase --version

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Maintenance

### Regular Tasks
1. **Update Dependencies**: Keep packages up to date
2. **Security Patches**: Apply security updates
3. **Performance Monitoring**: Monitor application performance
4. **Error Logging**: Review and address errors
5. **Backup Data**: Regular database backups

### Monitoring
1. **Firebase Console**: Monitor usage and errors
2. **Application Logs**: Check console logs
3. **Performance Metrics**: Monitor load times
4. **User Feedback**: Collect and address user issues

---

**Last Updated**: December 2024
**Guide Version**: 1.0
**Status**: Complete and Tested
