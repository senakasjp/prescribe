// Doctor Authentication Service - Isolated for Doctor Module Only
// This service handles ONLY doctor authentication and should never interact with pharmacist data

import firebaseStorage from '../firebaseStorage.js'

class DoctorAuthService {
  constructor() {
    this.currentDoctor = null
    this.loadCurrentDoctor()
  }

  // Load current doctor from localStorage
  loadCurrentDoctor() {
    try {
      const stored = localStorage.getItem('prescribe-current-doctor')
      console.log('DoctorAuthService: Raw localStorage data:', stored)
      this.currentDoctor = stored ? JSON.parse(stored) : null
      console.log('DoctorAuthService: Loaded current doctor from localStorage:', this.currentDoctor)
      if (this.currentDoctor) {
        console.log('DoctorAuthService: Doctor email:', this.currentDoctor.email)
        console.log('DoctorAuthService: Doctor role:', this.currentDoctor.role)
        console.log('DoctorAuthService: Doctor country from localStorage:', this.currentDoctor.country)
        // Check if doctor data is valid (has required fields)
        if (!this.currentDoctor.email || this.currentDoctor.role !== 'doctor') {
          console.warn('DoctorAuthService: Invalid doctor data found, clearing')
          this.clearCurrentDoctor()
        } else if (this.currentDoctor.isApproved === false) {
          console.warn('DoctorAuthService: Unapproved doctor session found, clearing')
          this.clearCurrentDoctor()
        } else if (this.currentDoctor.isDisabled) {
          console.warn('DoctorAuthService: Disabled doctor session found, clearing')
          this.clearCurrentDoctor()
        } else if (this.currentDoctor.accessExpiresAt) {
          const expiresAt = new Date(this.currentDoctor.accessExpiresAt)
          if (!Number.isNaN(expiresAt.getTime()) && Date.now() > expiresAt.getTime()) {
            console.warn('DoctorAuthService: Expired doctor session found, clearing')
            this.clearCurrentDoctor()
          }
        } else {
          console.log('DoctorAuthService: Doctor data is valid')
        }
      } else {
        console.log('DoctorAuthService: No doctor found in localStorage')
      }
    } catch (error) {
      console.error('Error loading current doctor:', error)
      this.currentDoctor = null
    }
  }

  // Save current doctor to localStorage
  saveCurrentDoctor(doctor) {
    try {
      console.log('DoctorAuthService: Saving current doctor to localStorage:', doctor)
      localStorage.setItem('prescribe-current-doctor', JSON.stringify(doctor))
      this.currentDoctor = doctor
      console.log('DoctorAuthService: Doctor saved successfully to localStorage')
    } catch (error) {
      console.error('Error saving current doctor:', error)
    }
  }

  // Clear current doctor from localStorage
  clearCurrentDoctor() {
    try {
      localStorage.removeItem('prescribe-current-doctor')
      this.currentDoctor = null
      console.log('DoctorAuthService: Doctor cleared from localStorage')
    } catch (error) {
      console.error('Error clearing current doctor:', error)
    }
  }

  // Get current doctor
  getCurrentDoctor() {
    // Always reload from localStorage to ensure we have the latest data
    this.loadCurrentDoctor()
    return this.currentDoctor
  }

  // Check if doctor is authenticated
  isDoctorAuthenticated() {
    return this.currentDoctor !== null && this.currentDoctor.role === 'doctor'
  }

  // Doctor registration
  async createDoctor(doctorData) {
    try {
      console.log('DoctorAuthService: Creating doctor:', doctorData)
      
      // Validate required fields
      if (!doctorData.email || !doctorData.password || !doctorData.firstName || !doctorData.lastName) {
        throw new Error('Missing required fields for doctor registration')
      }

      // Check if doctor already exists
      const normalizedEmail = String(doctorData.email || '').trim().toLowerCase()
      const existingDoctor = await firebaseStorage.getDoctorByEmail(normalizedEmail)
      if (existingDoctor) {
        throw new Error('Doctor with this email already exists')
      }

      // Create doctor in Firebase
      const doctor = await firebaseStorage.createDoctor({
        ...doctorData,
        email: normalizedEmail
      })
      
      // Set role to doctor
      doctor.role = 'doctor'
      
      // Save to localStorage
      this.saveCurrentDoctor(doctor)
      
      console.log('DoctorAuthService: Doctor created successfully:', doctor)
      return doctor
    } catch (error) {
      console.error('DoctorAuthService: Error creating doctor:', error)
      throw error
    }
  }

  // Doctor login
  async signInDoctor(email, password) {
    try {
      console.log('DoctorAuthService: Signing in doctor:', email)
      
      // Get doctor from Firebase
      const doctor = await firebaseStorage.getDoctorByEmail(email)
      if (!doctor) {
        throw new Error('Doctor not found')
      }

      if (doctor.isApproved === false) {
        throw new Error('Your account is waiting for approval. Once approved, you will receive a confirmation email. For questions, contact support@mprescribe.net.')
      }

      if (doctor.accessExpiresAt) {
        const expiresAt = new Date(doctor.accessExpiresAt)
        if (!Number.isNaN(expiresAt.getTime()) && Date.now() > expiresAt.getTime()) {
          throw new Error('Your access period has expired. Please contact the administrator.')
        }
      }

      if (doctor.isDisabled) {
        throw new Error('Your account is disabled. Please contact the administrator.')
      }

      if (doctor.externalDoctor && doctor.invitedByDoctorId) {
        const ownerDoctor = await firebaseStorage.getDoctorById(doctor.invitedByDoctorId)
        if (ownerDoctor?.isApproved === false) {
          throw new Error('Owner doctor account is pending approval. External access is not allowed.')
        }
        if (ownerDoctor?.accessExpiresAt) {
          const ownerExpiresAt = new Date(ownerDoctor.accessExpiresAt)
          if (!Number.isNaN(ownerExpiresAt.getTime()) && Date.now() > ownerExpiresAt.getTime()) {
            throw new Error('Owner doctor access period has expired. External access is not allowed.')
          }
        }
        if (ownerDoctor?.isDisabled) {
          throw new Error('Owner doctor account is disabled. External access is not allowed.')
        }
      }

      // Simple password check (in production, use proper hashing)
      if (doctor.password !== password) {
        throw new Error('Invalid password')
      }

      // Set role to doctor
      doctor.role = 'doctor'
      
      // Save to localStorage
      this.saveCurrentDoctor(doctor)
      
      console.log('DoctorAuthService: Doctor signed in successfully:', doctor)
      firebaseStorage.addAuthLog({
        action: 'login',
        role: doctor.role || 'doctor',
        email: doctor.email || '',
        doctorId: doctor.id || doctor.uid || '',
        status: 'success'
      })
      return doctor
    } catch (error) {
      console.error('DoctorAuthService: Error signing in doctor:', error)
      throw error
    }
  }

  // Doctor logout
  async signOutDoctor() {
    try {
      console.log('DoctorAuthService: Signing out doctor')
      const current = this.currentDoctor
      this.clearCurrentDoctor()
      if (current?.email) {
        firebaseStorage.addAuthLog({
          action: 'logout',
          role: current.role || 'doctor',
          email: current.email || '',
          doctorId: current.id || current.uid || '',
          status: 'success'
        })
      }
      console.log('DoctorAuthService: Doctor signed out successfully')
    } catch (error) {
      console.error('DoctorAuthService: Error signing out doctor:', error)
      throw error
    }
  }

  // Google sign-in for doctors
  async signInWithGoogle() {
    try {
      console.log('DoctorAuthService: Google sign-in for doctor')
      // This would integrate with Firebase Auth in production
      throw new Error('Google sign-in not implemented for doctors')
    } catch (error) {
      console.error('DoctorAuthService: Error with Google sign-in:', error)
      throw error
    }
  }
}

// Create singleton instance
const doctorAuthService = new DoctorAuthService()
export default doctorAuthService
