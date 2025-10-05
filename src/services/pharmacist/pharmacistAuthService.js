// Pharmacist Authentication Service - Isolated for Pharmacist Module Only
// This service handles ONLY pharmacist authentication and should never interact with doctor components

import firebaseStorage from '../firebaseStorage.js'

class PharmacistAuthService {
  constructor() {
    this.currentPharmacist = null
    this.loadCurrentPharmacist()
  }

  // Load current pharmacist from localStorage
  loadCurrentPharmacist() {
    try {
      const stored = localStorage.getItem('prescribe-current-pharmacist')
      console.log('PharmacistAuthService: Raw localStorage data:', stored)
      this.currentPharmacist = stored ? JSON.parse(stored) : null
      console.log('PharmacistAuthService: Loaded current pharmacist from localStorage:', this.currentPharmacist)
      if (this.currentPharmacist) {
        console.log('PharmacistAuthService: Pharmacist email:', this.currentPharmacist.email)
        console.log('PharmacistAuthService: Pharmacist role:', this.currentPharmacist.role)
        console.log('PharmacistAuthService: Pharmacist business name from localStorage:', this.currentPharmacist.businessName)
        console.log('PharmacistAuthService: Pharmacist ID from localStorage:', this.currentPharmacist.id)
        console.log('PharmacistAuthService: Pharmacist pharmacistNumber from localStorage:', this.currentPharmacist.pharmacistNumber)
        console.log('PharmacistAuthService: All pharmacist fields from localStorage:', Object.keys(this.currentPharmacist))
        
        // Check if pharmacist data is valid (has required fields)
        if (!this.currentPharmacist.email || this.currentPharmacist.role !== 'pharmacist') {
          console.warn('PharmacistAuthService: Invalid pharmacist data found, clearing')
          this.clearCurrentPharmacist()
        } else {
          console.log('PharmacistAuthService: Pharmacist data is valid')
        }
      } else {
        console.log('PharmacistAuthService: No pharmacist found in localStorage')
      }
    } catch (error) {
      console.error('Error loading current pharmacist:', error)
      this.currentPharmacist = null
    }
  }

  // Save current pharmacist to localStorage
  saveCurrentPharmacist(pharmacist) {
    try {
      console.log('PharmacistAuthService: Saving current pharmacist to localStorage:', pharmacist)
      localStorage.setItem('prescribe-current-pharmacist', JSON.stringify(pharmacist))
      this.currentPharmacist = pharmacist
      console.log('PharmacistAuthService: Pharmacist saved successfully to localStorage')
    } catch (error) {
      console.error('Error saving current pharmacist:', error)
    }
  }

  // Clear current pharmacist from localStorage
  clearCurrentPharmacist() {
    try {
      localStorage.removeItem('prescribe-current-pharmacist')
      this.currentPharmacist = null
      console.log('PharmacistAuthService: Pharmacist cleared from localStorage')
    } catch (error) {
      console.error('Error clearing current pharmacist:', error)
    }
  }

  // Get current pharmacist
  getCurrentPharmacist() {
    // Always reload from localStorage to ensure we have the latest data
    this.loadCurrentPharmacist()
    return this.currentPharmacist
  }

  // Check if pharmacist is authenticated
  isPharmacistAuthenticated() {
    return this.currentPharmacist !== null && this.currentPharmacist.role === 'pharmacist'
  }

  // Pharmacist registration
  async createPharmacist(pharmacistData) {
    try {
      console.log('PharmacistAuthService: Creating pharmacist:', pharmacistData)
      
      // Validate required fields
      if (!pharmacistData.email || !pharmacistData.password || !pharmacistData.businessName) {
        throw new Error('Missing required fields for pharmacist registration')
      }

      // Check if pharmacist already exists
      const existingPharmacist = await firebaseStorage.getPharmacistByEmail(pharmacistData.email)
      if (existingPharmacist) {
        throw new Error('Pharmacist with this email already exists')
      }

      // Create pharmacist in Firebase
      const pharmacist = await firebaseStorage.createPharmacist(pharmacistData)
      
      // Set role to pharmacist
      pharmacist.role = 'pharmacist'
      
      // Save to localStorage
      this.saveCurrentPharmacist(pharmacist)
      
      console.log('PharmacistAuthService: Pharmacist created successfully:', pharmacist)
      return pharmacist
    } catch (error) {
      console.error('PharmacistAuthService: Error creating pharmacist:', error)
      throw error
    }
  }

  // Pharmacist login
  async signInPharmacist(email, password) {
    try {
      console.log('PharmacistAuthService: Signing in pharmacist:', email)
      
      // Get pharmacist from Firebase
      const pharmacist = await firebaseStorage.getPharmacistByEmail(email)
      if (!pharmacist) {
        throw new Error('Pharmacist not found')
      }

      // Simple password check (in production, use proper hashing)
      if (pharmacist.password !== password) {
        throw new Error('Invalid password')
      }

      // Set role to pharmacist
      pharmacist.role = 'pharmacist'
      
      // Save to localStorage
      this.saveCurrentPharmacist(pharmacist)
      
      console.log('PharmacistAuthService: Pharmacist signed in successfully:', pharmacist)
      return pharmacist
    } catch (error) {
      console.error('PharmacistAuthService: Error signing in pharmacist:', error)
      throw error
    }
  }

  // Pharmacist logout
  async signOutPharmacist() {
    try {
      console.log('PharmacistAuthService: Signing out pharmacist')
      this.clearCurrentPharmacist()
      console.log('PharmacistAuthService: Pharmacist signed out successfully')
    } catch (error) {
      console.error('PharmacistAuthService: Error signing out pharmacist:', error)
      throw error
    }
  }

  // Update pharmacist profile
  async updatePharmacist(updatedPharmacist) {
    try {
      console.log('PharmacistAuthService: Updating pharmacist:', updatedPharmacist)
      
      // Validate required fields
      if (!updatedPharmacist.id) {
        throw new Error('Pharmacist ID is required for update')
      }

      // Update pharmacist in Firebase
      await firebaseStorage.updatePharmacist(updatedPharmacist)
      
      // Save updated pharmacist to localStorage
      this.saveCurrentPharmacist(updatedPharmacist)
      
      console.log('PharmacistAuthService: Pharmacist updated successfully:', updatedPharmacist)
      return updatedPharmacist
    } catch (error) {
      console.error('PharmacistAuthService: Error updating pharmacist:', error)
      throw error
    }
  }

  // Google sign-in for pharmacists
  async signInWithGoogle() {
    try {
      console.log('PharmacistAuthService: Google sign-in for pharmacist')
      // This would integrate with Firebase Auth in production
      throw new Error('Google sign-in not implemented for pharmacists')
    } catch (error) {
      console.error('PharmacistAuthService: Error with Google sign-in:', error)
      throw error
    }
  }
}

// Create singleton instance
const pharmacistAuthService = new PharmacistAuthService()
export default pharmacistAuthService
