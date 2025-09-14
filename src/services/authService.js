// Authentication Service - Temporary replacement for Firebase Auth
// This can be easily converted to Firebase Auth later

import jsonStorage from './jsonStorage.js'

class AuthService {
  constructor() {
    this.currentUser = null
    this.loadCurrentUser()
  }

  // Load current user from localStorage
  loadCurrentUser() {
    try {
      const stored = localStorage.getItem('prescribe-current-user')
      this.currentUser = stored ? JSON.parse(stored) : null
    } catch (error) {
      console.error('Error loading current user:', error)
      this.currentUser = null
    }
  }

  // Save current user to localStorage
  saveCurrentUser(user) {
    try {
      localStorage.setItem('prescribe-current-user', JSON.stringify(user))
      this.currentUser = user
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
  async registerDoctor(email, password) {
    try {
      // Check if doctor already exists
      const existingDoctor = await jsonStorage.getDoctorByEmail(email)
      if (existingDoctor) {
        throw new Error('Doctor with this email already exists')
      }

      // Create new doctor
      const doctor = await jsonStorage.createDoctor({
        email,
        password, // In real app, this should be hashed
        role: 'doctor'
      })

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
      const doctor = await jsonStorage.getDoctorByEmail(email)
      if (!doctor) {
        throw new Error('Doctor not found')
      }

      if (doctor.password !== password) {
        throw new Error('Invalid password')
      }

      // Set as current user
      this.saveCurrentUser(doctor)
      return doctor
    } catch (error) {
      console.error('Error signing in doctor:', error)
      throw error
    }
  }

  // Sign out doctor
  async signOut() {
    this.clearCurrentUser()
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser
  }

  // Check if user is authenticated
  isAuthenticated() {
    return this.currentUser !== null
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

