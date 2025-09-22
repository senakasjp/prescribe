// Authentication Service - Temporary replacement for Firebase Auth
// This can be easily converted to Firebase Auth later

import firebaseStorage from './firebaseStorage.js'

class AuthService {
  constructor() {
    this.currentUser = null
    this.loadCurrentUser()
  }

  // Load current user from localStorage
  loadCurrentUser() {
    try {
      const stored = localStorage.getItem('prescribe-current-user')
      console.log('AuthService: Raw localStorage data:', stored)
      this.currentUser = stored ? JSON.parse(stored) : null
      console.log('AuthService: Loaded current user from localStorage:', this.currentUser)
      if (this.currentUser) {
        console.log('AuthService: User email:', this.currentUser.email)
        console.log('AuthService: User role:', this.currentUser.role)
        console.log('AuthService: User country from localStorage:', this.currentUser.country)
        // Check if user data is valid (has required fields)
        if (!this.currentUser.email || !this.currentUser.role) {
          console.warn('AuthService: Invalid user data found, clearing')
          this.clearCurrentUser()
        } else {
          console.log('AuthService: User data is valid')
        }
      } else {
        console.log('AuthService: No user found in localStorage')
      }
    } catch (error) {
      console.error('Error loading current user:', error)
      this.currentUser = null
    }
  }

  // Save current user to localStorage
  saveCurrentUser(user) {
    try {
      console.log('AuthService: Saving current user to localStorage:', user)
      localStorage.setItem('prescribe-current-user', JSON.stringify(user))
      this.currentUser = user
      console.log('AuthService: User saved successfully to localStorage')
    } catch (error) {
      console.error('Error saving current user:', error)
    }
  }

  // Clear current user
  clearCurrentUser() {
    localStorage.removeItem('prescribe-current-user')
    this.currentUser = null
  }

  // Register new doctor
  async registerDoctor(email, password, doctorData = {}) {
    try {
      // Check if doctor already exists
      const existingDoctor = await firebaseStorage.getDoctorByEmail(email)
      if (existingDoctor) {
        throw new Error('Doctor with this email already exists')
      }

      // Create new doctor in local storage
      const doctor = await firebaseStorage.createDoctor({
        email,
        password, // In real app, this should be hashed
        role: 'doctor',
        firstName: doctorData.firstName || '',
        lastName: doctorData.lastName || '',
        country: doctorData.country || '',
        name: doctorData.firstName && doctorData.lastName ? `${doctorData.firstName} ${doctorData.lastName}` : ''
      })

      // Also create doctor in Firebase
      try {
        console.log('🔄 Local auth: Creating new doctor in Firebase during registration:', email)
        
        const firebaseDoctorData = {
          email: doctor.email,
          firstName: doctor.firstName,
          lastName: doctor.lastName,
          country: doctor.country,
          role: 'doctor',
          createdAt: new Date().toISOString()
        }
        
        console.log('🏥 Local auth: Creating Firebase doctor with data:', firebaseDoctorData)
        const newFirebaseDoctor = await firebaseStorage.createDoctor(firebaseDoctorData)
        console.log('✅ Local auth: Created Firebase doctor during registration:', newFirebaseDoctor.email)
      } catch (firebaseError) {
        console.error('❌ Local auth: Error creating Firebase doctor during registration:', firebaseError)
        // Don't fail registration if Firebase creation fails
      }

      // Set as current user
      this.saveCurrentUser(doctor)
      return doctor
    } catch (error) {
      console.error('Error registering doctor:', error)
      throw error
    }
  }

  // Sign in doctor
  async signInDoctor(email, password) {
    try {
      const doctor = await firebaseStorage.getDoctorByEmail(email)
      if (!doctor) {
        throw new Error('Doctor not found')
      }

      if (doctor.password !== password) {
        throw new Error('Invalid password')
      }

      // Create/update doctor in Firebase as well
      try {
        console.log('🔄 Local auth: Creating/updating doctor in Firebase:', email)
        
        // Check if doctor exists in Firebase
        let existingFirebaseDoctor = await firebaseStorage.getDoctorByEmail(email)
        
        if (existingFirebaseDoctor) {
          // Update existing Firebase doctor with latest data
          const updatedFirebaseDoctor = await firebaseStorage.updateDoctor({
            ...existingFirebaseDoctor,
            ...doctor,
            // Don't overwrite Firebase-specific fields
            id: existingFirebaseDoctor.id,
            createdAt: existingFirebaseDoctor.createdAt
          })
          console.log('✅ Local auth: Updated existing Firebase doctor:', updatedFirebaseDoctor.email)
        } else {
          // Create new doctor in Firebase
          const firebaseDoctorData = {
            email: doctor.email,
            firstName: doctor.firstName,
            lastName: doctor.lastName,
            country: doctor.country,
            role: 'doctor',
            createdAt: new Date().toISOString()
          }
          
          console.log('🏥 Local auth: Creating new doctor in Firebase with data:', firebaseDoctorData)
          const newFirebaseDoctor = await firebaseStorage.createDoctor(firebaseDoctorData)
          console.log('✅ Local auth: Created new Firebase doctor:', newFirebaseDoctor.email)
        }
      } catch (firebaseError) {
        console.error('❌ Local auth: Error syncing doctor to Firebase:', firebaseError)
        // Don't fail the login if Firebase sync fails
      }

      // Set as current user
      this.saveCurrentUser(doctor)
      return doctor
    } catch (error) {
      console.error('Error signing in doctor:', error)
      throw error
    }
  }

  // Update doctor profile
  async updateDoctor(updatedDoctorData) {
    try {
      console.log('AuthService: Updating doctor with data:', updatedDoctorData)
      console.log('AuthService: Current user:', this.currentUser)
      
      // Update in Firebase
      const updatedDoctor = await firebaseStorage.updateDoctor(updatedDoctorData)
      
      // Update current user
      this.saveCurrentUser(updatedDoctor)
      console.log('AuthService: Successfully updated doctor:', updatedDoctor)
      return updatedDoctor
    } catch (error) {
      console.error('AuthService: Error updating doctor:', error)
      throw error
    }
  }

  // Register new pharmacist
  async registerPharmacist(pharmacistData) {
    try {
      // Check if pharmacist already exists in Firebase
      const existingPharmacist = await firebaseStorage.getPharmacistByEmail(pharmacistData.email)
      if (existingPharmacist) {
        throw new Error('Pharmacist with this email already exists')
      }

      // Create new pharmacist in Firebase
      const pharmacist = await firebaseStorage.createPharmacist({
        email: pharmacistData.email,
        password: pharmacistData.password, // In real app, this should be hashed
        role: 'pharmacist',
        businessName: pharmacistData.businessName,
        pharmacistNumber: pharmacistData.pharmacistNumber,
        createdAt: new Date().toISOString()
      })

      return { success: true, pharmacist }
    } catch (error) {
      console.error('Error registering pharmacist:', error)
      return { success: false, message: error.message }
    }
  }

  // Login pharmacist
  async loginPharmacist(email, password) {
    try {
      const pharmacist = await firebaseStorage.getPharmacistByEmail(email)
      console.log('🔍 AuthService: Retrieved pharmacist data:', pharmacist)
      console.log('🔍 AuthService: businessName:', pharmacist?.businessName)
      console.log('🔍 AuthService: pharmacistNumber:', pharmacist?.pharmacistNumber)
      console.log('🔍 AuthService: All pharmacist fields:', Object.keys(pharmacist || {}))
      
      if (!pharmacist) {
        return { success: false, message: 'Pharmacist not found' }
      }

      if (pharmacist.password !== password) {
        return { success: false, message: 'Invalid password' }
      }

      // Set as current user
      this.saveCurrentUser(pharmacist)
      return { success: true, pharmacist }
    } catch (error) {
      console.error('Error logging in pharmacist:', error)
      return { success: false, message: error.message }
    }
  }

  // Sign out doctor/pharmacist
  async signOut() {
    this.clearCurrentUser()
  }

  // Get current user
  getCurrentUser() {
    // Always reload from localStorage to ensure we have the latest data
    this.loadCurrentUser()
    return this.currentUser
  }

  // Check if user is authenticated
  isAuthenticated() {
    return this.currentUser !== null
  }

  // Check if current user is a doctor
  isDoctor() {
    return this.currentUser && this.currentUser.role === 'doctor'
  }

  // Check if current user is a pharmacist
  isPharmacist() {
    return this.currentUser && this.currentUser.role === 'pharmacist'
  }

  // Listen for auth state changes (simplified version)
  onAuthStateChanged(callback) {
    // In a real implementation, this would set up listeners
    // For now, we'll just call the callback with current state
    callback(this.currentUser)
    
    // Return unsubscribe function
    return () => {}
  }
}

// Create singleton instance
const authService = new AuthService()

export default authService

