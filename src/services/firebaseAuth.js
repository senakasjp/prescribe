// Firebase Authentication Service
// Handles Google authentication and integrates with existing auth system

import { 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase-config.js'
import jsonStorage from './jsonStorage.js'

class FirebaseAuthService {
  constructor() {
    this.currentUser = null
    this.authStateListeners = []
    this.setupAuthStateListener()
  }

  // Setup Firebase auth state listener
  setupAuthStateListener() {
    firebaseOnAuthStateChanged(auth, (user) => {
      this.currentUser = user
      this.notifyAuthStateListeners(user)
    })
  }

  // Notify all auth state listeners
  notifyAuthStateListeners(user) {
    this.authStateListeners.forEach(callback => {
      try {
        callback(user)
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
      
      // Check if this is the admin email
      const isAdmin = user.email.toLowerCase() === 'senakahks@gmail.com'
      
      // Extract user data
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: isAdmin ? 'admin' : userType,
        provider: 'google',
        isAdmin: isAdmin
      }

      // Handle admin user specially
      if (isAdmin) {
        // For admin users, create/update admin profile
        const adminData = {
          id: 'admin-001',
          email: user.email.toLowerCase(),
          name: user.displayName || 'System Administrator',
          role: 'admin',
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          provider: 'google',
          permissions: ['read_all', 'write_all', 'delete_all', 'manage_users', 'view_analytics'],
          lastLogin: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
        
        // Save admin to localStorage (similar to adminAuthService)
        localStorage.setItem('prescribe-current-admin', JSON.stringify(adminData))
        return adminData
      }

      // Check if user exists in our system
      let existingUser = null
      if (userType === 'doctor') {
        existingUser = await jsonStorage.getDoctorByEmail(user.email)
      } else if (userType === 'pharmacist') {
        existingUser = await jsonStorage.getPharmacistByEmail(user.email)
      }

      if (existingUser) {
        // Update existing user with Google data
        const updatedUser = {
          ...existingUser,
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          provider: 'google'
        }
        
        if (userType === 'doctor') {
          await jsonStorage.updateDoctor(updatedUser)
        } else if (userType === 'pharmacist') {
          await jsonStorage.updatePharmacist(updatedUser)
        }
        
        return updatedUser
      } else {
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
          
          const newDoctor = await jsonStorage.createDoctor(doctorData)
          return newDoctor
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
          
          const newPharmacist = await jsonStorage.createPharmacist(pharmacistData)
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
    let existingUser = null
    if (userType === 'doctor') {
      existingUser = await jsonStorage.getDoctorByEmail(mockEmail)
    } else if (userType === 'pharmacist') {
      existingUser = await jsonStorage.getPharmacistByEmail(mockEmail)
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
        await jsonStorage.updateDoctor(updatedUser)
      } else if (userType === 'pharmacist') {
        await jsonStorage.updatePharmacist(updatedUser)
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
        
        const newDoctor = await jsonStorage.createDoctor(doctorData)
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
        
        const newPharmacist = await jsonStorage.createPharmacist(pharmacistData)
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