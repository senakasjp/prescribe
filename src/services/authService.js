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
      // Check if doctor already exists in both local storage and Firebase
      let existingDoctor = null
      
      // Check local storage first
      try {
        const localData = JSON.parse(localStorage.getItem('prescribe-data') || '{}')
        const localDoctors = localData.doctors || []
        existingDoctor = localDoctors.find(d => d.email === email)
      } catch (error) {
        console.log('No local storage data found')
      }
      
      // Check Firebase if not found in local storage
      if (!existingDoctor) {
        existingDoctor = await firebaseStorage.getDoctorByEmail(email)
      }
      
      if (existingDoctor) {
        throw new Error('Doctor with this email already exists')
      }

      // Create new doctor in local storage first (where password will be stored)
      const doctorDataWithPassword = {
        email,
        password, // In real app, this should be hashed
        role: 'doctor',
        firstName: doctorData.firstName || '',
        lastName: doctorData.lastName || '',
        country: doctorData.country || '',
        name: doctorData.firstName && doctorData.lastName ? `${doctorData.firstName} ${doctorData.lastName}` : '',
        createdAt: new Date().toISOString()
      }
      
      // Store in local storage
      let doctor = null
      try {
        const localData = JSON.parse(localStorage.getItem('prescribe-data') || '{}')
        if (!localData.doctors) {
          localData.doctors = []
        }
        const doctorId = 'doctor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        doctor = { id: doctorId, ...doctorDataWithPassword }
        localData.doctors.push(doctor)
        localStorage.setItem('prescribe-data', JSON.stringify(localData))
        console.log('✅ Doctor created in local storage:', doctor.email)
      } catch (error) {
        console.error('❌ Error creating doctor in local storage:', error)
        throw new Error('Failed to create doctor account')
      }
      
      // Also create doctor in Firebase (without password for security)
      try {
        console.log('🔄 Local auth: Creating new doctor in Firebase during registration:', email)
        
        const firebaseDoctorData = {
          email: doctor.email,
          firstName: doctor.firstName,
          lastName: doctor.lastName,
          name: doctor.name, // Include the combined name field
          country: doctor.country,
          role: 'doctor',
          authProvider: 'email-password', // Mark as email/password auth
          createdAt: new Date().toISOString()
        }
        
        console.log('🏥 Local auth: Creating Firebase doctor with data:', firebaseDoctorData)
        const newFirebaseDoctor = await firebaseStorage.createDoctor(firebaseDoctorData)
        console.log('✅ Local auth: Created Firebase doctor during registration:', newFirebaseDoctor.email)
        
        // Update the doctor object with Firebase ID for consistency
        doctor.firebaseId = newFirebaseDoctor.id
        doctor.authProvider = 'email-password'
        
        // Update local storage with the updated doctor object
        const localData = JSON.parse(localStorage.getItem('prescribe-data') || '{}')
        const doctorIndex = localData.doctors.findIndex(d => d.id === doctor.id)
        if (doctorIndex !== -1) {
          localData.doctors[doctorIndex] = doctor
          localStorage.setItem('prescribe-data', JSON.stringify(localData))
        }
      } catch (firebaseError) {
        console.error('❌ Local auth: Error creating Firebase doctor during registration:', firebaseError)
        // Don't fail registration if Firebase creation fails, but mark it
        doctor.authProvider = 'email-password'
        doctor.firebaseError = firebaseError.message
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
      console.log('🔐 Attempting to sign in doctor with email:', email)
      
      // For password-based authentication, we need to check local storage first
      // since Firebase doesn't store passwords for security reasons
      let doctor = null
      
      // Try to get doctor from local storage first (where password is stored)
      try {
        const localData = JSON.parse(localStorage.getItem('prescribe-data') || '{}')
        const localDoctors = localData.doctors || []
        doctor = localDoctors.find(d => d.email === email)
        console.log('🔍 Doctor found in local storage:', doctor ? 'Yes' : 'No')
      } catch (error) {
        console.log('❌ No local storage data found')
      }
      
      // If not found in local storage, check Firebase
      if (!doctor) {
        console.log('🔍 Checking Firebase for doctor...')
        const firebaseDoctor = await firebaseStorage.getDoctorByEmail(email)
        if (firebaseDoctor) {
          console.log('⚠️ Doctor exists in Firebase but not in local storage')
          if (firebaseDoctor.authProvider === 'google') {
            throw new Error('This account was created with Google authentication. Please use "Login with Google" instead.')
          } else {
            throw new Error('Account not found. Please register first or use the correct email address.')
          }
        } else {
          throw new Error('Account not found. Please register first or use the correct email address.')
        }
      }

      // Verify password
      if (doctor.password !== password) {
        throw new Error('Invalid password')
      }

      console.log('✅ Password verified, proceeding with sign in')

      // Ensure doctor exists in Firebase (sync if needed)
      try {
        console.log('🔄 Local auth: Ensuring doctor exists in Firebase:', email)
        
        // Check if doctor exists in Firebase
        let existingFirebaseDoctor = await firebaseStorage.getDoctorByEmail(email)
        
        if (!existingFirebaseDoctor) {
          // Create doctor in Firebase if it doesn't exist
          console.log('🆕 Creating doctor in Firebase during sign in')
          const firebaseDoctorData = {
            email: doctor.email,
            firstName: doctor.firstName,
            lastName: doctor.lastName,
            name: doctor.name, // Include the combined name field
            country: doctor.country,
            role: 'doctor',
            authProvider: 'email-password',
            createdAt: doctor.createdAt || new Date().toISOString()
          }
          
          const newFirebaseDoctor = await firebaseStorage.createDoctor(firebaseDoctorData)
          doctor.firebaseId = newFirebaseDoctor.id
          console.log('✅ Created doctor in Firebase during sign in:', newFirebaseDoctor.email)
        } else {
          // Update existing Firebase doctor with local data
          console.log('🔄 Updating existing Firebase doctor with local data')
          doctor.firebaseId = existingFirebaseDoctor.id
          
          // Update Firebase doctor with any missing data from local storage
          const updateData = {
            firstName: doctor.firstName,
            lastName: doctor.lastName,
            name: doctor.name, // Include the combined name field
            country: doctor.country,
            authProvider: 'email-password'
          }
          
          await firebaseStorage.updateDoctor({ id: existingFirebaseDoctor.id, ...updateData })
          console.log('✅ Updated Firebase doctor with local data')
        }
      } catch (firebaseError) {
        console.error('❌ Local auth: Error syncing with Firebase during sign in:', firebaseError)
        // Don't fail sign in if Firebase sync fails
      }

      // Update last login time
      doctor.lastLogin = new Date().toISOString()
      
      // Save updated doctor to local storage
      try {
        const localData = JSON.parse(localStorage.getItem('prescribe-data') || '{}')
        const doctorIndex = localData.doctors.findIndex(d => d.id === doctor.id)
        if (doctorIndex !== -1) {
          localData.doctors[doctorIndex] = doctor
          localStorage.setItem('prescribe-data', JSON.stringify(localData))
        }
      } catch (error) {
        console.error('❌ Error updating doctor in local storage:', error)
      }

      // Set as current user
      this.saveCurrentUser(doctor)
      console.log('✅ Doctor signed in successfully:', doctor.email)
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

