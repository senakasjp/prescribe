// Firebase Authentication Service
// Handles Google authentication and integrates with existing auth system

import { 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase-config.js'
import firebaseStorage from './firebaseStorage.js'

class FirebaseAuthService {
  constructor() {
    this.currentUser = null
    this.authStateListeners = []
    this.setupAuthStateListener()
  }
    
  // Setup Firebase auth state listener
  setupAuthStateListener() {
    firebaseOnAuthStateChanged(auth, async (user) => {
      this.currentUser = user
      await this.notifyAuthStateListeners(user)
    })
  }

  // Notify all auth state listeners
  async notifyAuthStateListeners(user) {
    console.log('🔥 Firebase auth state changed, processing user:', user?.email)
    
    // Process the user through handleUserLogin if they exist
    let processedUser = user
    if (user) {
      try {
        console.log('🔄 Processing user through handleUserLogin')
        processedUser = await this.handleUserLogin(user)
        console.log('✅ User processed successfully:', processedUser?.email)
      } catch (error) {
        console.error('❌ Error processing user in auth listener:', error)
        processedUser = user // Fallback to original user
      }
    }
    
    // Notify all listeners with the processed user
    this.authStateListeners.forEach(callback => {
      try {
        callback(processedUser)
      } catch (error) {
        console.error('Error in auth state listener:', error)
      }
    })
  }

  // Sign in with Google
  async signInWithGoogle(userType = 'doctor') {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user
      
      // Check if this is the super admin email
      const isSuperAdmin = user.email.toLowerCase() === 'senakahks@gmail.com'
      
      // Extract user data
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: isSuperAdmin ? 'doctor' : userType, // Super admin is treated as doctor
        provider: 'google',
        isAdmin: isSuperAdmin // But has admin privileges
      }

      // Handle super admin user specially
      if (isSuperAdmin) {
        // For super admin, create/update as doctor in Firebase with admin privileges
        try {
          const doctorData = {
            email: user.email,
            firstName: user.displayName?.split(' ')[0] || 'Super',
            lastName: user.displayName?.split(' ').slice(1).join(' ') || 'Admin',
            name: user.displayName || 'Super Admin',
            role: 'doctor',
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            provider: 'google',
            isAdmin: true, // Mark as admin doctor
            permissions: ['read_all', 'write_all', 'delete_all', 'manage_users', 'view_analytics'],
            createdAt: new Date().toISOString()
          }
          
          // Check if doctor already exists in Firebase
          let existingDoctor = await firebaseStorage.getDoctorByEmail(user.email)
          if (existingDoctor) {
            // Update existing doctor with admin flag
            await firebaseStorage.updateDoctor({ ...existingDoctor, isAdmin: true })
            console.log('✅ Updated existing doctor with admin flag in Firebase')
            return { ...existingDoctor, isAdmin: true }
          } else {
            // Create new doctor in Firebase
            console.log('🏥 Creating super admin doctor with data:', doctorData)
            const newDoctor = await firebaseStorage.createDoctor(doctorData)
            console.log('✅ Created super admin doctor in Firebase:', newDoctor)
            return newDoctor
          }
        } catch (error) {
          console.error('❌ Error creating super admin doctor in Firebase:', error)
          console.error('❌ Error details:', error.message)
          console.error('❌ Error stack:', error.stack)
          throw error
        }
      }

      // Check if user exists in our system
      console.log('🔍 Checking if user exists in Firebase for email:', user.email)
      let existingUser = null
      if (userType === 'doctor') {
        existingUser = await firebaseStorage.getDoctorByEmail(user.email)
        console.log('🔍 Existing doctor found:', existingUser ? 'Yes' : 'No')
      } else if (userType === 'pharmacist') {
        existingUser = await firebaseStorage.getPharmacistByEmail(user.email)
        console.log('🔍 Existing pharmacist found:', existingUser ? 'Yes' : 'No')
      }

      if (existingUser) {
        console.log('✅ Updating existing user with Google data')
        // Update existing user with Google data
        const updatedUser = {
          ...existingUser,
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          provider: 'google'
        }
        
        if (userType === 'doctor') {
          await firebaseStorage.updateDoctor(updatedUser)
          console.log('✅ Doctor updated in Firebase:', updatedUser.email)
        } else if (userType === 'pharmacist') {
          await firebaseStorage.updatePharmacist(updatedUser)
          console.log('✅ Pharmacist updated in Firebase:', updatedUser.email)
        }
        
        return updatedUser
      } else {
        console.log('🆕 Creating new user in Firebase')
        // Create new user
        if (userType === 'doctor') {
          const doctorData = {
            email: user.email,
            firstName: user.displayName?.split(' ')[0] || '',
            lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
            name: user.displayName || '',
            role: 'doctor',
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            provider: 'google',
            createdAt: new Date().toISOString()
          }
          
          console.log('🏥 Creating doctor with data:', doctorData)
          try {
            const newDoctor = await firebaseStorage.createDoctor(doctorData)
            console.log('✅ Doctor created in Firebase:', newDoctor)
            return newDoctor
          } catch (error) {
            console.error('❌ Error creating doctor in Firebase:', error)
            console.error('❌ Error details:', error.message)
            console.error('❌ Error stack:', error.stack)
            throw error
          }
        } else if (userType === 'pharmacist') {
          // For pharmacists, we need additional data
          const pharmacistData = {
            email: user.email,
            businessName: user.displayName || 'Google Pharmacy',
            role: 'pharmacist',
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            provider: 'google',
            pharmacistNumber: this.generatePharmacistNumber(),
            createdAt: new Date().toISOString()
          }
          
          const newPharmacist = await firebaseStorage.createPharmacist(pharmacistData)
          return newPharmacist
        }
      }
    } catch (error) {
      console.error('Error signing in with Google:', error)
      
      // Handle specific Firebase errors
      if (error.code === 'auth/operation-not-allowed') {
        // For development: create a mock Google user
        console.warn('Google authentication not enabled in Firebase. Creating mock user for development.')
        return this.createMockGoogleUser(userType)
      } else if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Google sign-in was cancelled by user.')
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error('Google sign-in popup was blocked by browser. Please allow popups and try again.')
      } else {
        throw new Error(`Google authentication failed: ${error.message}`)
      }
    }
  }

  // Generate a unique 6-digit pharmacist number
  generatePharmacistNumber() {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  // Create a mock Google user for development when Firebase Google auth is not enabled
  async createMockGoogleUser(userType = 'doctor') {
    const mockEmail = `google.user.${userType}@example.com`
    const mockDisplayName = `Google ${userType === 'doctor' ? 'Doctor' : 'Pharmacist'}`
    
    // Check if user exists in our system
    console.log('🔍 Checking if mock user exists in Firebase for email:', mockEmail)
    let existingUser = null
    if (userType === 'doctor') {
      existingUser = await firebaseStorage.getDoctorByEmail(mockEmail)
      console.log('🔍 Existing mock doctor found:', existingUser ? 'Yes' : 'No')
    } else if (userType === 'pharmacist') {
      existingUser = await firebaseStorage.getPharmacistByEmail(mockEmail)
      console.log('🔍 Existing mock pharmacist found:', existingUser ? 'Yes' : 'No')
    }

    if (existingUser) {
      // Update existing user with mock Google data
      const updatedUser = {
        ...existingUser,
        uid: `mock-google-${existingUser.id}`,
        displayName: mockDisplayName,
        photoURL: 'https://via.placeholder.com/150/4285f4/ffffff?text=G',
        provider: 'google-mock'
      }
      
      if (userType === 'doctor') {
        await firebaseStorage.updateDoctor(updatedUser)
      } else if (userType === 'pharmacist') {
        await firebaseStorage.updatePharmacist(updatedUser)
      }
      
      return updatedUser
    } else {
      // Create new mock user
      if (userType === 'doctor') {
        const doctorData = {
          email: mockEmail,
          firstName: 'Google',
          lastName: 'Doctor',
          name: mockDisplayName,
          role: 'doctor',
          uid: `mock-google-${Date.now()}`,
          displayName: mockDisplayName,
          photoURL: 'https://via.placeholder.com/150/4285f4/ffffff?text=G',
          provider: 'google-mock',
          createdAt: new Date().toISOString()
        }
        
        console.log('🏥 Creating mock doctor with data:', doctorData)
        const newDoctor = await firebaseStorage.createDoctor(doctorData)
        console.log('✅ Mock doctor created in Firebase:', newDoctor)
        return newDoctor
      } else if (userType === 'pharmacist') {
        const pharmacistData = {
          email: mockEmail,
          businessName: 'Google Pharmacy',
          role: 'pharmacist',
          uid: `mock-google-${Date.now()}`,
          displayName: mockDisplayName,
          photoURL: 'https://via.placeholder.com/150/4285f4/ffffff?text=G',
          provider: 'google-mock',
          pharmacistNumber: this.generatePharmacistNumber(),
          createdAt: new Date().toISOString()
        }
        
        const newPharmacist = await firebaseStorage.createPharmacist(pharmacistData)
        return newPharmacist
      }
    }
  }

  // Sign out
  async signOut() {
    try {
      await firebaseSignOut(auth)
      this.currentUser = null
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser
  }

  // Check if user is authenticated
  isAuthenticated() {
    return this.currentUser !== null
  }

  // Listen for auth state changes
  onAuthStateChanged(callback) {
    this.authStateListeners.push(callback)
    
    // Call immediately with current state
    callback(this.currentUser)
    
    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback)
      if (index > -1) {
        this.authStateListeners.splice(index, 1)
      }
    }
  }

  // Check if current user is a doctor
  isDoctor() {
    return this.currentUser && this.currentUser.role === 'doctor'
  }

  // Check if current user is a pharmacist
  isPharmacist() {
    return this.currentUser && this.currentUser.role === 'pharmacist'
  }
}

// Create singleton instance
const firebaseAuthService = new FirebaseAuthService()

export default firebaseAuthService