// Firebase Authentication Service
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth'
import { auth } from '../firebase-config.js'

class FirebaseAuthService {
  constructor() {
    this.currentUser = null
    this.authStateListeners = []
    
    // Listen for auth state changes
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user
      this.notifyAuthStateChange(user)
    })
  }

  // Add auth state listener
  onAuthStateChange(callback) {
    this.authStateListeners.push(callback)
    // Call immediately if user is already logged in
    if (this.currentUser) {
      callback(this.currentUser)
    }
  }

  // Notify all listeners of auth state change
  notifyAuthStateChange(user) {
    this.authStateListeners.forEach(callback => callback(user))
  }

  // Sign in with email and password
  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      this.currentUser = userCredential.user
      return {
        success: true,
        user: {
          id: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: userCredential.user.displayName
        }
      }
    } catch (error) {
      console.error('Sign in error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Create new doctor account
  async createDoctor(email, password, doctorData) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      
      // Update profile with doctor information
      await updateProfile(userCredential.user, {
        displayName: `${doctorData.firstName} ${doctorData.lastName}`
      })

      this.currentUser = userCredential.user
      return {
        success: true,
        user: {
          id: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: userCredential.user.displayName
        }
      }
    } catch (error) {
      // Only log non-expected errors to reduce console noise
      if (error.code !== 'auth/email-already-in-use') {
        console.error('Create doctor error:', error)
      }
      return {
        success: false,
        error: error.message,
        code: error.code
      }
    }
  }

  // Sign out
  async signOut() {
    try {
      await signOut(auth)
      this.currentUser = null
      return { success: true }
    } catch (error) {
      console.error('Sign out error:', error)
      return {
        success: false,
        error: error.message
      }
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

  // Get user ID
  getCurrentUserId() {
    return this.currentUser ? this.currentUser.uid : null
  }
}

// Create singleton instance
const firebaseAuthService = new FirebaseAuthService()

export default firebaseAuthService
