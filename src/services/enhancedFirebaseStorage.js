/**
 * Enhanced Firebase Storage Service with improved error handling and logging
 * This is a refactored version of the original firebaseStorage.js
 */

import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase-config.js'
import { ERROR_MESSAGES, DEFAULTS } from '../utils/constants.js'

class EnhancedFirebaseStorageService {
  constructor() {
    this.collections = {
      doctors: 'doctors',
      patients: 'patients',
      illnesses: 'illnesses',
      medications: 'medications',
      symptoms: 'symptoms',
      longTermMedications: 'longTermMedications',
      drugDatabase: 'drugDatabase',
      pharmacists: 'pharmacists',
      prescriptions: 'prescriptions',
      reports: 'reports',
      diagnoses: 'diagnoses'
    }
    
    this.retryAttempts = DEFAULTS.MAX_RETRY_ATTEMPTS
    this.retryDelay = DEFAULTS.RETRY_DELAY
  }

  /**
   * Enhanced error handling with retry logic
   * @param {Function} operation - The operation to retry
   * @param {string} operationName - Name of the operation for logging
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise} - Result of the operation
   */
  async executeWithRetry(operation, operationName, maxRetries = this.retryAttempts) {
    let lastError
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 ${operationName}: Attempt ${attempt}/${maxRetries}`)
        const result = await operation()
        console.log(`✅ ${operationName}: Success on attempt ${attempt}`)
        return result
      } catch (error) {
        lastError = error
        console.error(`❌ ${operationName}: Attempt ${attempt} failed:`, error)
        
        if (attempt < maxRetries) {
          const delay = this.retryDelay * attempt
          console.log(`⏳ ${operationName}: Retrying in ${delay}ms...`)
          await this.delay(delay)
        }
      }
    }
    
    console.error(`💥 ${operationName}: All ${maxRetries} attempts failed`)
    throw this.createEnhancedError(lastError, operationName)
  }

  /**
   * Create enhanced error with context
   * @param {Error} originalError - Original error
   * @param {string} operationName - Name of the operation
   * @returns {Error} - Enhanced error
   */
  createEnhancedError(originalError, operationName) {
    const enhancedError = new Error(`${operationName} failed: ${originalError.message}`)
    enhancedError.originalError = originalError
    enhancedError.operationName = operationName
    enhancedError.timestamp = new Date().toISOString()
    
    // Add specific error handling based on error type
    if (originalError.code === 'permission-denied') {
      enhancedError.userMessage = ERROR_MESSAGES.UNAUTHORIZED
    } else if (originalError.code === 'unavailable') {
      enhancedError.userMessage = ERROR_MESSAGES.NETWORK_ERROR
    } else if (originalError.code === 'deadline-exceeded') {
      enhancedError.userMessage = ERROR_MESSAGES.TIMEOUT_ERROR
    } else {
      enhancedError.userMessage = ERROR_MESSAGES.UNKNOWN_ERROR
    }
    
    return enhancedError
  }

  /**
   * Utility function to add delay
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} - Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Enhanced logging with context
   * @param {string} level - Log level (info, warn, error)
   * @param {string} operation - Operation name
   * @param {any} data - Data to log
   */
  log(level, operation, data = null) {
    const timestamp = new Date().toISOString()
    const logData = {
      timestamp,
      operation,
      data: data ? (typeof data === 'object' ? JSON.stringify(data, null, 2) : data) : null
    }
    
    switch (level) {
      case 'info':
        console.log(`📝 [${timestamp}] ${operation}:`, logData)
        break
      case 'warn':
        console.warn(`⚠️ [${timestamp}] ${operation}:`, logData)
        break
      case 'error':
        console.error(`❌ [${timestamp}] ${operation}:`, logData)
        break
    }
  }

  /**
   * Validate data before saving
   * @param {any} data - Data to validate
   * @param {string} type - Type of data (doctor, patient, etc.)
   * @returns {boolean} - Whether data is valid
   */
  validateData(data, type) {
    if (!data || typeof data !== 'object') {
      this.log('error', `validateData-${type}`, 'Data is not an object')
      return false
    }
    
    // Add type-specific validation here
    switch (type) {
      case 'doctor':
        return !!(data.email && data.firstName && data.lastName)
      case 'patient':
        return !!(data.firstName && data.lastName && data.dateOfBirth)
      case 'symptom':
        return !!(data.name && data.patientId)
      case 'prescription':
        return !!(data.patientId && data.doctorId)
      default:
        return true
    }
  }

  /**
   * Sanitize data for Firebase
   * @param {any} data - Data to sanitize
   * @returns {any} - Sanitized data
   */
  sanitizeData(data) {
    if (!data || typeof data !== 'object') return data
    
    const sanitized = { ...data }
    
    // Remove undefined values
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === undefined) {
        delete sanitized[key]
      }
    })
    
    // Add timestamp if not present
    if (!sanitized.createdAt && !sanitized.updatedAt) {
      sanitized.createdAt = serverTimestamp()
    }
    
    return sanitized
  }

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  // Doctor operations with enhanced error handling
  async createDoctor(doctorData) {
    return this.executeWithRetry(async () => {
      this.log('info', 'createDoctor', doctorData)
      
      if (!this.validateData(doctorData, 'doctor')) {
        throw new Error('Invalid doctor data')
      }
      
      const sanitizedData = this.sanitizeData(doctorData)
      const docRef = await addDoc(collection(db, this.collections.doctors), sanitizedData)
      
      this.log('info', 'createDoctor-success', { id: docRef.id })
      return { id: docRef.id, ...sanitizedData }
    }, 'createDoctor')
  }

  async getDoctor(doctorId) {
    return this.executeWithRetry(async () => {
      this.log('info', 'getDoctor', { doctorId })
      
      const docRef = doc(db, this.collections.doctors, doctorId)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        const data = docSnap.data()
        this.log('info', 'getDoctor-success', { doctorId })
        return { id: docSnap.id, ...data }
      } else {
        throw new Error(`Doctor with ID ${doctorId} not found`)
      }
    }, 'getDoctor')
  }

  async updateDoctor(doctorId, updateData) {
    return this.executeWithRetry(async () => {
      this.log('info', 'updateDoctor', { doctorId, updateData })
      
      const sanitizedData = this.sanitizeData({ ...updateData, updatedAt: serverTimestamp() })
      const docRef = doc(db, this.collections.doctors, doctorId)
      await updateDoc(docRef, sanitizedData)
      
      this.log('info', 'updateDoctor-success', { doctorId })
      return { id: doctorId, ...sanitizedData }
    }, 'updateDoctor')
  }

  // Patient operations with enhanced error handling
  async createPatient(patientData) {
    return this.executeWithRetry(async () => {
      this.log('info', 'createPatient', patientData)
      
      if (!this.validateData(patientData, 'patient')) {
        throw new Error('Invalid patient data')
      }
      
      const sanitizedData = this.sanitizeData(patientData)
      const docRef = await addDoc(collection(db, this.collections.patients), sanitizedData)
      
      this.log('info', 'createPatient-success', { id: docRef.id })
      return { id: docRef.id, ...sanitizedData }
    }, 'createPatient')
  }

  async getPatient(patientId) {
    return this.executeWithRetry(async () => {
      this.log('info', 'getPatient', { patientId })
      
      const docRef = doc(db, this.collections.patients, patientId)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        const data = docSnap.data()
        this.log('info', 'getPatient-success', { patientId })
        return { id: docSnap.id, ...data }
      } else {
        throw new Error(`Patient with ID ${patientId} not found`)
      }
    }, 'getPatient')
  }

  async getPatientsByDoctorId(doctorId) {
    return this.executeWithRetry(async () => {
      this.log('info', 'getPatientsByDoctorId', { doctorId })
      
      const q = query(
        collection(db, this.collections.patients),
        where('doctorId', '==', doctorId),
        orderBy('createdAt', 'desc')
      )
      
      const querySnapshot = await getDocs(q)
      const patients = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      this.log('info', 'getPatientsByDoctorId-success', { count: patients.length })
      return patients
    }, 'getPatientsByDoctorId')
  }

  // Symptom operations with enhanced error handling
  async createSymptom(symptomData) {
    return this.executeWithRetry(async () => {
      this.log('info', 'createSymptom', symptomData)
      
      if (!this.validateData(symptomData, 'symptom')) {
        throw new Error('Invalid symptom data')
      }
      
      const sanitizedData = this.sanitizeData(symptomData)
      const docRef = await addDoc(collection(db, this.collections.symptoms), sanitizedData)
      
      this.log('info', 'createSymptom-success', { id: docRef.id })
      return { id: docRef.id, ...sanitizedData }
    }, 'createSymptom')
  }

  async getSymptomsByPatientId(patientId) {
    return this.executeWithRetry(async () => {
      this.log('info', 'getSymptomsByPatientId', { patientId })
      
      const q = query(
        collection(db, this.collections.symptoms),
        where('patientId', '==', patientId),
        orderBy('createdAt', 'desc')
      )
      
      const querySnapshot = await getDocs(q)
      const symptoms = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      this.log('info', 'getSymptomsByPatientId-success', { count: symptoms.length })
      return symptoms
    }, 'getSymptomsByPatientId')
  }

  // Prescription operations with enhanced error handling
  async createPrescription(prescriptionData) {
    return this.executeWithRetry(async () => {
      this.log('info', 'createPrescription', prescriptionData)
      
      if (!this.validateData(prescriptionData, 'prescription')) {
        throw new Error('Invalid prescription data')
      }
      
      const sanitizedData = this.sanitizeData(prescriptionData)
      const docRef = await addDoc(collection(db, this.collections.prescriptions), sanitizedData)
      
      this.log('info', 'createPrescription-success', { id: docRef.id })
      return { id: docRef.id, ...sanitizedData }
    }, 'createPrescription')
  }

  async getPrescriptionsByPatientId(patientId) {
    return this.executeWithRetry(async () => {
      this.log('info', 'getPrescriptionsByPatientId', { patientId })
      
      const q = query(
        collection(db, this.collections.prescriptions),
        where('patientId', '==', patientId),
        orderBy('createdAt', 'desc')
      )
      
      const querySnapshot = await getDocs(q)
      const prescriptions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      this.log('info', 'getPrescriptionsByPatientId-success', { count: prescriptions.length })
      return prescriptions
    }, 'getPrescriptionsByPatientId')
  }

  // Generic delete operation with enhanced error handling
  async deleteDocument(collectionName, documentId) {
    return this.executeWithRetry(async () => {
      this.log('info', 'deleteDocument', { collectionName, documentId })
      
      if (!this.collections[collectionName]) {
        throw new Error(`Invalid collection: ${collectionName}`)
      }
      
      const docRef = doc(db, this.collections[collectionName], documentId)
      await deleteDoc(docRef)
      
      this.log('info', 'deleteDocument-success', { collectionName, documentId })
      return true
    }, 'deleteDocument')
  }

  // Generic update operation with enhanced error handling
  async updateDocument(collectionName, documentId, updateData) {
    return this.executeWithRetry(async () => {
      this.log('info', 'updateDocument', { collectionName, documentId, updateData })
      
      if (!this.collections[collectionName]) {
        throw new Error(`Invalid collection: ${collectionName}`)
      }
      
      const sanitizedData = this.sanitizeData({ ...updateData, updatedAt: serverTimestamp() })
      const docRef = doc(db, this.collections[collectionName], documentId)
      await updateDoc(docRef, sanitizedData)
      
      this.log('info', 'updateDocument-success', { collectionName, documentId })
      return { id: documentId, ...sanitizedData }
    }, 'updateDocument')
  }

  // Batch operations for better performance
  async batchCreate(collectionName, items) {
    return this.executeWithRetry(async () => {
      this.log('info', 'batchCreate', { collectionName, count: items.length })
      
      if (!this.collections[collectionName]) {
        throw new Error(`Invalid collection: ${collectionName}`)
      }
      
      const results = []
      for (const item of items) {
        const sanitizedData = this.sanitizeData(item)
        const docRef = await addDoc(collection(db, this.collections[collectionName]), sanitizedData)
        results.push({ id: docRef.id, ...sanitizedData })
      }
      
      this.log('info', 'batchCreate-success', { collectionName, count: results.length })
      return results
    }, 'batchCreate')
  }
}

// Create and export singleton instance
const enhancedFirebaseStorage = new EnhancedFirebaseStorageService()
export default enhancedFirebaseStorage
