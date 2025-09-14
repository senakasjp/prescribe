// Storage Service - Unified interface for JSON Storage and Firebase
// This allows easy switching between localStorage and Firebase

import jsonStorage from './jsonStorage.js'
import firebaseStorageService from './firebaseStorage.js'
import firebaseAuthService from './firebaseAuth.js'

class StorageService {
  constructor() {
    this.useFirebase = import.meta.env.VITE_USE_FIREBASE === 'true'
    this.isAuthenticated = false
    
    // Listen for authentication changes
    firebaseAuthService.onAuthStateChange((user) => {
      this.isAuthenticated = !!user
    })
  }

  // Get the appropriate storage service
  getStorageService() {
    if (this.useFirebase && this.isAuthenticated) {
      return firebaseStorageService
    }
    return jsonStorage
  }

  // Doctor operations
  async createDoctor(doctorData) {
    return this.getStorageService().createDoctor(doctorData)
  }

  async getDoctorByEmail(email) {
    return this.getStorageService().getDoctorByEmail(email)
  }

  async getDoctorById(id) {
    return this.getStorageService().getDoctorById(id)
  }

  // Patient operations
  async createPatient(patientData) {
    return this.getStorageService().createPatient(patientData)
  }

  getPatients() {
    const service = this.getStorageService()
    if (this.useFirebase && this.isAuthenticated) {
      // For Firebase, we need to get patients by doctor ID
      const doctorId = firebaseAuthService.getCurrentUserId()
      return service.getPatientsByDoctorId(doctorId)
    }
    return service.getPatients()
  }

  async getPatientsByDoctorId(doctorId) {
    return this.getStorageService().getPatientsByDoctorId(doctorId)
  }

  async getPatientById(id) {
    return this.getStorageService().getPatientById(id)
  }

  // Illness operations
  async createIllness(illnessData) {
    return this.getStorageService().createIllness(illnessData)
  }

  async getIllnessesByPatientId(patientId) {
    return this.getStorageService().getIllnessesByPatientId(patientId)
  }

  // Prescription/Medication operations
  async createMedication(medicationData) {
    return this.getStorageService().createMedication(medicationData)
  }

  async createPrescription(prescriptionData) {
    return this.getStorageService().createPrescription(prescriptionData)
  }

  async getPrescriptionsByPatientId(patientId) {
    return this.getStorageService().getPrescriptionsByPatientId(patientId)
  }

  async getMedicationsByPatientId(patientId) {
    return this.getStorageService().getMedicationsByPatientId(patientId)
  }

  async deletePrescription(prescriptionId) {
    return this.getStorageService().deletePrescription(prescriptionId)
  }

  async deleteMedication(medicationId) {
    return this.getStorageService().deleteMedication(medicationId)
  }

  // Symptoms operations
  async createSymptoms(symptomsData) {
    return this.getStorageService().createSymptoms(symptomsData)
  }

  async getSymptomsByPatientId(patientId) {
    return this.getStorageService().getSymptomsByPatientId(patientId)
  }

  // Drug Database operations (Firebase only)
  async addDrug(doctorId, drugData) {
    if (this.useFirebase && this.isAuthenticated) {
      return firebaseStorageService.addDrug(doctorId, drugData)
    }
    // Fallback to localStorage-based drug database
    const { drugDatabase } = await import('./drugDatabase.js')
    return drugDatabase.addDrug(doctorId, drugData)
  }

  async searchDrugs(doctorId, searchTerm) {
    if (this.useFirebase && this.isAuthenticated) {
      return firebaseStorageService.searchDrugs(doctorId, searchTerm)
    }
    // Fallback to localStorage-based drug database
    const { drugDatabase } = await import('./drugDatabase.js')
    return drugDatabase.searchDrugs(doctorId, searchTerm)
  }

  async getDoctorDrugs(doctorId) {
    if (this.useFirebase && this.isAuthenticated) {
      return firebaseStorageService.getDoctorDrugs(doctorId)
    }
    // Fallback to localStorage-based drug database
    const { drugDatabase } = await import('./drugDatabase.js')
    return drugDatabase.getDoctorDrugs(doctorId)
  }

  // Real-time listeners (Firebase only)
  onPatientsChange(doctorId, callback) {
    if (this.useFirebase && this.isAuthenticated) {
      return firebaseStorageService.onPatientsChange(doctorId, callback)
    }
    // For localStorage, we can't have real-time updates
    // Return a no-op function
    return () => {}
  }

  onPrescriptionsChange(patientId, callback) {
    if (this.useFirebase && this.isAuthenticated) {
      return firebaseStorageService.onPrescriptionsChange(patientId, callback)
    }
    // For localStorage, we can't have real-time updates
    // Return a no-op function
    return () => {}
  }

  // Debug and utility methods
  async debugDataState() {
    return this.getStorageService().debugDataState()
  }

  // Migration helpers
  async needsMigration() {
    if (!this.useFirebase || !this.isAuthenticated) {
      return false
    }
    
    const { dataMigrationService } = await import('./dataMigration.js')
    return dataMigrationService.needsMigration()
  }

  async migrateData() {
    if (!this.useFirebase || !this.isAuthenticated) {
      throw new Error('Firebase must be enabled and user must be authenticated to migrate data')
    }
    
    const { dataMigrationService } = await import('./dataMigration.js')
    return dataMigrationService.migrateAllData()
  }

  // Export/Import for localStorage
  exportData() {
    if (this.useFirebase) {
      throw new Error('Export is only available for localStorage mode')
    }
    return jsonStorage.exportData()
  }

  importData(jsonData) {
    if (this.useFirebase) {
      throw new Error('Import is only available for localStorage mode')
    }
    return jsonStorage.importData(jsonData)
  }

  // Clear data (for testing)
  clearAllData() {
    return this.getStorageService().clearAllData()
  }

  resetData() {
    return this.getStorageService().resetData()
  }
}

// Create singleton instance
const storageService = new StorageService()

export default storageService
