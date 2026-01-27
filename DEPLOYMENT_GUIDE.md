# Deployment Guide

## Overview
This guide covers the complete deployment process for the Prescribe medical system, including environment setup, build configuration, and deployment to Firebase.

## Prerequisites

### Required Software
- **Node.js**: Version 18.x or higher
- **npm**: Version 8.x or higher
- **Firebase CLI**: Latest version
- **Git**: For version control

### Required Accounts
- **Firebase Account**: For hosting and database
- **OpenAI Account**: For AI API access
- **GitHub Account**: For code repository (optional)

## Environment Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd Prescribe
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create `.env.local` file in the root directory:
```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Application Configuration
VITE_APP_NAME=Prescribe
VITE_APP_VERSION=2.0.0
```

Set the OpenAI key in Functions secrets:
```bash
firebase functions:secrets:set OPENAI_API_KEY
```

### 4. Firebase Configuration
Create `src/firebase-config.js`:
```javascript
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
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
export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)
export default app
```

## Build Configuration

### 1. Vite Configuration
Create `vite.config.js`:
```javascript
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['svelte'],
          firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          openai: ['openai']
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

### 2. Package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && firebase deploy",
    "deploy:hosting": "firebase deploy --only hosting",
    "deploy:firestore": "firebase deploy --only firestore"
  }
}
```

## Firebase Setup

### 1. Initialize Firebase Project
```bash
firebase login
firebase init
```

### 2. Firebase Configuration Files

#### firebase.json
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

#### firestore.rules
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
        request.auth.uid == resource.data.doctorId;
    }
    
    // Prescriptions can only be accessed by the prescribing doctor
    match /medications/{prescriptionId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.doctorId;
    }
    
    // Pharmacists can read prescriptions sent to them
    match /pharmacists/{pharmacistId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == pharmacistId;
    }
    
    // Admin access (requires custom claim)
    match /admin/{document} {
      allow read, write: if request.auth != null && 
        request.auth.token.admin == true;
    }
  }
}
```

#### firestore.indexes.json
```json
{
  "indexes": [
    {
      "collectionGroup": "patients",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "doctorId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "medications",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "patientId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

## Build Process

### 1. Development Build
```bash
npm run dev
```
- Starts development server on port 3000
- Hot reload enabled
- Source maps included

### 2. Production Build
```bash
npm run build
```
- Creates optimized production bundle
- Minifies CSS and JavaScript
- Generates source maps (optional)
- Outputs to `dist/` directory

### 3. Build Verification
```bash
npm run preview
```
- Serves production build locally
- Verifies build before deployment

## Deployment

### 1. Firebase Deployment
```bash
# Deploy everything
firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# Deploy only Firestore rules
firebase deploy --only firestore
```

### 2. Deployment Verification
After deployment, verify:
- [ ] Application loads correctly
- [ ] Authentication works
- [ ] Database operations function
- [ ] AI integration works
- [ ] All features are accessible

### 3. Environment Variables
Ensure all environment variables are set in Firebase:
```bash
firebase functions:config:set openai.api_key="your_api_key"
firebase functions:config:set app.name="Prescribe"
```

## Monitoring and Maintenance

### 1. Firebase Console
- Monitor usage and performance
- Check error logs
- Review security rules
- Monitor database usage

### 2. Application Monitoring
```javascript
// Add to main.js
import { onMount } from 'svelte'

onMount(() => {
  // Error tracking
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error)
    // Send to monitoring service
  })
  
  // Performance monitoring
  if ('performance' in window) {
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0]
      console.log('Page load time:', perfData.loadEventEnd - perfData.loadEventStart)
    })
  }
})
```

### 3. Database Maintenance
```javascript
// Cleanup old data
async function cleanupOldData() {
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 6) // 6 months ago
  
  // Delete old prescriptions
  const oldPrescriptions = await firebaseStorage.getPrescriptionsOlderThan(cutoffDate)
  for (const prescription of oldPrescriptions) {
    await firebaseStorage.deletePrescription(prescription.id)
  }
}
```

## Security Considerations

### 1. API Key Protection
- Never commit API keys to version control
- Use environment variables
- Rotate keys regularly
- Monitor key usage

### 2. Database Security
- Implement proper Firestore rules
- Use authentication for all operations
- Validate all inputs
- Monitor for suspicious activity

### 3. HTTPS Enforcement
```javascript
// Force HTTPS in production
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  location.replace('https:' + window.location.href.substring(window.location.protocol.length))
}
```

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### Firebase Connection Issues
```bash
# Re-authenticate
firebase logout
firebase login
firebase use --add
```

#### Environment Variable Issues
- Check `.env.local` file exists
- Verify variable names start with `VITE_`
- Restart development server after changes

### Debug Mode
```javascript
// Enable debug logging
localStorage.setItem('debug', 'true')

// Disable debug logging
localStorage.removeItem('debug')
```

## Performance Optimization

### 1. Bundle Analysis
```bash
npm install --save-dev rollup-plugin-visualizer
```

### 2. Image Optimization
```javascript
// Lazy load images
<img src={imageUrl} loading="lazy" alt="Description" />
```

### 3. Code Splitting
```javascript
// Dynamic imports
const HeavyComponent = lazy(() => import('./HeavyComponent.svelte'))
```

## Backup and Recovery

### 1. Database Backup
```bash
# Export Firestore data
gcloud firestore export gs://your-bucket/backup-$(date +%Y%m%d)
```

### 2. Code Backup
```bash
# Create backup branch
git checkout -b backup-$(date +%Y%m%d)
git push origin backup-$(date +%Y%m%d)
```

### 3. Recovery Process
1. Restore from backup
2. Verify data integrity
3. Test all functionality
4. Deploy to production

## Scaling Considerations

### 1. Database Scaling
- Use Firestore composite indexes
- Implement pagination for large datasets
- Consider data archiving strategies

### 2. Application Scaling
- Implement CDN for static assets
- Use Firebase Hosting caching
- Consider serverless functions for heavy operations

### 3. Monitoring
- Set up alerts for errors
- Monitor performance metrics
- Track user engagement
- Monitor API usage and costs
