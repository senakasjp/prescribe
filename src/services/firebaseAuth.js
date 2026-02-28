// Firebase Authentication Service
// Handles Google authentication and integrates with existing auth system

import { 
  signInWithPopup, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  getAuth
} from 'firebase/auth'
import { initializeApp, getApps } from 'firebase/app'
import app, { auth, googleProvider } from '../firebase-config.js'
import firebaseStorage from './firebaseStorage.js'
import { getOrCreateDeviceId } from './deviceIdService.js'

const pendingApprovalMessage = [
  'Your account is waiting for approval.',
  'Once approved, you will receive a confirmation email.',
  'For questions, contact support@mprescribe.net.'
].join(' ')

class FirebaseAuthService {
  constructor() {
    this.currentUser = null
    this.authStateListeners = []
    this.secondaryAuth = null
    this.setupAuthStateListener()
  }

  getOrCreateDeviceId() {
    return getOrCreateDeviceId()
  }

  async getOrCreateDeviceIdForDoctor(doctor) {
    const fallbackId = doctor?.deviceId || doctor?.allowedDeviceId || ''
    const deviceId = getOrCreateDeviceId({ fallbackId })

    if (!doctor || doctor.externalDoctor) {
      return deviceId
    }

    if (doctor.id && deviceId && doctor.deviceId !== deviceId) {
      try {
        await firebaseStorage.updateDoctor({ ...doctor, deviceId })
      } catch (error) {
        console.warn('⚠️ Failed to persist device id for doctor:', error)
      }
    }
    return deviceId
  }

  normalizeExternalLoginIdentifier(identifier) {
    if (!identifier) return identifier
    const trimmed = String(identifier).trim().toLowerCase()
    if (!trimmed.includes('@')) {
      return `${trimmed}@external.local`
    }
    return trimmed
  }

  normalizeEmail(email) {
    return String(email || '').trim().toLowerCase()
  }

  getAndClearReferralId() {
    if (typeof localStorage === 'undefined') return ''
    const key = 'pendingReferralId'
    const referralId = localStorage.getItem(key) || ''
    if (referralId) {
      localStorage.removeItem(key)
    }
    return referralId
  }

  async resolveReferralDoctorId(referralValue) {
    if (!referralValue) return ''
    const referralCode = String(referralValue).trim().toUpperCase()
    let resolvedId = ''
    if (referralCode.startsWith('DR')) {
      const doctors = await firebaseStorage.getAllDoctors()
      const matched = doctors.find((doc) => doc.doctorIdShort === referralCode)
      resolvedId = matched?.id || ''
    } else {
      const referredDoctor = await firebaseStorage.getDoctorByReferralCode(referralCode)
      resolvedId = referredDoctor?.id || ''
    }
    if (!resolvedId) {
      const fallbackDoctor = await firebaseStorage.getDoctorById(referralValue)
      resolvedId = fallbackDoctor?.id || ''
    }
    return resolvedId
  }

  getProviderMeta(firebaseUser) {
    const providerId = firebaseUser?.providerData?.[0]?.providerId || 'password'
    const provider = providerId === 'google.com' ? 'google' : providerId === 'password' ? 'password' : providerId
    const authProvider = providerId === 'password' ? 'firebase-email' : 'google'
    return { providerId, provider, authProvider }
  }

  async ensureDoctorAccess(doctor) {
    if (!doctor) return
    if (doctor.isApproved === false) {
      await firebaseSignOut(auth)
      throw new Error(pendingApprovalMessage)
    }
    if (doctor.accessExpiresAt) {
      const expiresAt = new Date(doctor.accessExpiresAt)
      if (!Number.isNaN(expiresAt.getTime()) && Date.now() > expiresAt.getTime()) {
        await firebaseSignOut(auth)
        throw new Error('Your access period has expired. Please contact the administrator.')
      }
    }
    if (doctor.isDisabled) {
      await firebaseSignOut(auth)
      throw new Error('Your account is disabled. Please contact the administrator.')
    }

    if (doctor.externalDoctor && doctor.invitedByDoctorId) {
      const ownerDoctor = await firebaseStorage.getDoctorById(doctor.invitedByDoctorId)
      if (ownerDoctor?.isApproved === false) {
        await firebaseSignOut(auth)
        throw new Error('Owner doctor account is pending approval. External access is not allowed.')
      }
      if (ownerDoctor?.accessExpiresAt) {
        const ownerExpiresAt = new Date(ownerDoctor.accessExpiresAt)
        if (!Number.isNaN(ownerExpiresAt.getTime()) && Date.now() > ownerExpiresAt.getTime()) {
          await firebaseSignOut(auth)
          throw new Error('Owner doctor access period has expired. External access is not allowed.')
        }
      }
      if (ownerDoctor?.isDisabled) {
        await firebaseSignOut(auth)
        throw new Error('Owner doctor account is disabled. External access is not allowed.')
      }
    }
  }

  async logAuthEvent(action, userProfile) {
    try {
      await firebaseStorage.addAuthLog({
        action,
        role: userProfile?.role || 'doctor',
        email: userProfile?.email || '',
        doctorId: userProfile?.id || userProfile?.uid || '',
        status: 'success'
      })
    } catch (error) {
      console.error('❌ Failed to log auth event:', error)
    }
  }

  getSecondaryAuth() {
    if (this.secondaryAuth) {
      return this.secondaryAuth
    }

    const existingApp = getApps().find(existing => existing.name === 'secondary-auth')
    const secondaryApp = existingApp || initializeApp(app.options, 'secondary-auth')
    this.secondaryAuth = getAuth(secondaryApp)
    return this.secondaryAuth
  }
    
  // Setup Firebase auth state listener
  setupAuthStateListener() {
    firebaseOnAuthStateChanged(auth, async (user) => {
      this.currentUser = user
      await this.notifyAuthStateListeners(user)
    })
  }

  // Handle user login - process Firebase user and sync with our system
  async handleUserLogin(firebaseUser) {
    console.log('🔄 handleUserLogin called with user:', firebaseUser?.email)
    
    // Check if this is the super admin email
    const isSuperAdmin = firebaseUser.email.toLowerCase() === 'senakahks@gmail.com'
    
    // Check if user exists in our system
    let existingUser = null
    try {
      existingUser = await firebaseStorage.getDoctorByEmail(firebaseUser.email)
      console.log('🔍 Existing doctor found:', existingUser ? 'Yes' : 'No')
    } catch (error) {
      console.error('❌ Error checking for existing doctor:', error)
    }

    const { provider, authProvider } = this.getProviderMeta(firebaseUser)

    if (existingUser) {
      const localDeviceId = await this.getOrCreateDeviceIdForDoctor(existingUser)
      if (existingUser.externalDoctor && existingUser.allowedDeviceId) {
        if (localDeviceId !== existingUser.allowedDeviceId) {
          await firebaseSignOut(auth)
          throw new Error('External doctor login is allowed only from the owner doctor device.')
        }
      }

      await this.ensureDoctorAccess(existingUser)

      console.log('✅ Updating existing user with Firebase data')
      // Update existing user with Firebase data
      const updatedUser = {
        ...existingUser,
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || existingUser.displayName,
        photoURL: firebaseUser.photoURL || existingUser.photoURL,
        provider: provider,
        authProvider: authProvider,
        isAdmin: isSuperAdmin // Set admin flag for super admin
      }
      
      try {
        await firebaseStorage.updateDoctor(updatedUser)
        console.log('✅ Doctor updated in Firebase:', updatedUser.email)
        await this.logAuthEvent('login', updatedUser)
        return updatedUser
      } catch (error) {
        console.error('❌ Error updating doctor:', error)
        await this.logAuthEvent('login', existingUser)
        return existingUser // Return existing user if update fails
      }
    } else {
      console.log('🆕 Creating new user in Firebase')
      // Create new user
      const resolvedReferralId = isSuperAdmin ? '' : await this.resolveReferralDoctorId(this.getAndClearReferralId())
      const doctorData = {
        email: firebaseUser.email,
        firstName: firebaseUser.displayName?.split(' ')[0] || '',
        lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
        name: firebaseUser.displayName || '',
        role: 'doctor',
        isApproved: isSuperAdmin ? true : false,
        referredByDoctorId: resolvedReferralId,
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        provider: provider,
        authProvider: authProvider,
        isAdmin: isSuperAdmin, // Set admin flag for super admin
        createdAt: new Date().toISOString()
      }
      
      try {
        console.log('🏥 Creating doctor with data:', doctorData)
        const newDoctor = await firebaseStorage.createDoctor(doctorData)
        console.log('✅ Doctor created in Firebase:', newDoctor)
        await this.seedOnboardingDummyDataForNewDoctor(newDoctor)
        if (!isSuperAdmin && newDoctor.isApproved === false) {
          await firebaseSignOut(auth)
          throw new Error(pendingApprovalMessage)
        }
        await this.logAuthEvent('login', newDoctor)
        return newDoctor
      } catch (error) {
        console.error('❌ Error creating doctor:', error)
        throw error
      }
    }
  }

  async seedOnboardingDummyDataForNewDoctor(doctor) {
    if (!doctor?.id) return
    try {
      await firebaseStorage.seedOnboardingDummyDataForDoctor(doctor)
      console.log('✅ Onboarding dummy data created for new doctor:', doctor.email)
    } catch (error) {
      console.error('❌ Error creating onboarding dummy data for new doctor:', error)
    }
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
        processedUser = null
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
        if (userType === 'doctor') {
          await this.ensureDoctorAccess(existingUser)
        }
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
          isApproved: false,
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          provider: 'google',
          authProvider: 'google', // Mark as Google auth
          createdAt: new Date().toISOString()
        }
          
          console.log('🏥 Creating doctor with data:', doctorData)
          try {
            const newDoctor = await firebaseStorage.createDoctor(doctorData)
            await this.seedOnboardingDummyDataForNewDoctor(newDoctor)
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

  async registerDoctorWithEmailPassword(email, password, doctorData = {}) {
    try {
      const normalizedEmail = this.normalizeEmail(email)
      if (!normalizedEmail) {
        throw new Error('Email is required')
      }

      const existingDoctor = await firebaseStorage.getDoctorByEmail(normalizedEmail)
      if (existingDoctor?.id) {
        throw new Error('A doctor account with this email already exists. Please log in instead.')
      }

      const result = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
      const firebaseUser = result.user

      let referredByDoctorId = doctorData.referredByDoctorId || ''
      if (referredByDoctorId) {
        referredByDoctorId = await this.resolveReferralDoctorId(referredByDoctorId)
      }

      const doctorPayload = {
        email: normalizedEmail,
        firstName: doctorData.firstName || '',
        lastName: doctorData.lastName || '',
        name: doctorData.firstName && doctorData.lastName ? `${doctorData.firstName} ${doctorData.lastName}` : '',
        country: doctorData.country || '',
        role: 'doctor',
        isApproved: false,
        referredByDoctorId: referredByDoctorId,
        uid: firebaseUser.uid,
        provider: 'password',
        authProvider: 'firebase-email',
        createdAt: new Date().toISOString()
      }

      const newDoctor = await firebaseStorage.createDoctor(doctorPayload)
      await this.seedOnboardingDummyDataForNewDoctor(newDoctor)
      await firebaseSignOut(auth)
      throw new Error(pendingApprovalMessage)
    } catch (error) {
      console.error('Error registering doctor with email/password:', error)
      throw error
    }
  }

  async signInWithEmailPassword(email, password) {
    try {
      const resolvedIdentifier = this.normalizeExternalLoginIdentifier(email)
      const result = await signInWithEmailAndPassword(auth, resolvedIdentifier, password)
      const firebaseUser = result.user
      return await this.handleUserLogin(firebaseUser)
    } catch (error) {
      console.error('Error signing in with email/password:', error)
      const code = error?.code || ''
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        throw new Error('Invalid email or password.')
      }
      if (code === 'auth/user-not-found') {
        throw new Error('No account found with this email.')
      }
      if (code === 'auth/too-many-requests') {
        throw new Error('Too many attempts. Please try again later.')
      }
      if (code === 'auth/user-disabled') {
        throw new Error('Your account is disabled. Please contact support.')
      }
      throw error
    }
  }

  async createExternalDoctorAccount(email, password, profile = {}) {
    const secondaryAuth = this.getSecondaryAuth()
    try {
      const normalizedEmail = this.normalizeEmail(email)
      if (!normalizedEmail) {
        throw new Error('Email is required')
      }

      const existingDoctor = await firebaseStorage.getDoctorByEmail(normalizedEmail)
      if (existingDoctor?.id) {
        throw new Error('A doctor account with this email already exists.')
      }

      const result = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, password)
      const firebaseUser = result.user

      const doctorPayload = {
        email: normalizedEmail,
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        name: profile.firstName && profile.lastName ? `${profile.firstName} ${profile.lastName}` : '',
        phone: profile.phone || '',
        specialization: profile.specialization || '',
        country: profile.country || '',
        city: profile.city || '',
        role: 'doctor',
        isApproved: profile.isApproved ?? true,
        permissions: profile.permissions || [],
        accessLevel: profile.accessLevel || 'external_minimal',
        externalDoctor: true,
        invitedByDoctorId: profile.invitedByDoctorId || null,
        allowedDeviceId: profile.allowedDeviceId,
        uid: firebaseUser.uid,
        provider: 'password',
        authProvider: 'firebase-email',
        connectedPharmacists: [],
        createdAt: new Date().toISOString()
      }

      await firebaseStorage.createDoctor(doctorPayload)
      await firebaseSignOut(secondaryAuth)
      return doctorPayload
    } catch (error) {
      console.error('Error creating external doctor account:', error)
      throw error
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
          isApproved: false,
          uid: `mock-google-${Date.now()}`,
          displayName: mockDisplayName,
          photoURL: 'https://via.placeholder.com/150/4285f4/ffffff?text=G',
          provider: 'google-mock',
          createdAt: new Date().toISOString()
        }
        
        console.log('🏥 Creating mock doctor with data:', doctorData)
        const newDoctor = await firebaseStorage.createDoctor(doctorData)
        await this.seedOnboardingDummyDataForNewDoctor(newDoctor)
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
      if (this.currentUser?.email) {
        const profile = await firebaseStorage.getDoctorByEmail(this.currentUser.email)
        await this.logAuthEvent('logout', profile || this.currentUser)
      }
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
