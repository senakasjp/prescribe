// Data Migration Service - Migrate from JSON Storage to Firebase
import jsonStorage from './jsonStorage.js'
import firebaseStorageService from './firebaseStorage.js'
import firebaseAuthService from './firebaseAuth.js'

class DataMigrationService {
  constructor() {
    this.migrationStatus = {
      doctors: false,
      patients: false,
      illnesses: false,
      medications: false,
      symptoms: false,
      drugDatabase: false
    }
  }

  // Check if migration is needed
  async needsMigration() {
    try {
      // Check if Firebase has any data
      const firebaseData = await firebaseStorageService.debugDataState()
      const hasFirebaseData = Object.values(firebaseData).some(count => count > 0)
      
      // Check if localStorage has data
      const jsonData = jsonStorage.inspectData()
      const hasJsonData = Object.values(jsonData).some(array => array.length > 0)
      
      return hasJsonData && !hasFirebaseData
    } catch (error) {
      console.error('Error checking migration status:', error)
      return false
    }
  }

  // Migrate all data from JSON Storage to Firebase
  async migrateAllData() {
    try {
      console.log('🚀 Starting data migration from localStorage to Firebase...')
      
      const jsonData = jsonStorage.inspectData()
      const currentUserId = firebaseAuthService.getCurrentUserId()
      
      if (!currentUserId) {
        throw new Error('User must be authenticated to migrate data')
      }

      // Migrate doctors
      if (jsonData.doctors.length > 0) {
        await this.migrateDoctors(jsonData.doctors, currentUserId)
      }

      // Migrate patients
      if (jsonData.patients.length > 0) {
        await this.migratePatients(jsonData.patients, currentUserId)
      }

      // Migrate illnesses
      if (jsonData.illnesses.length > 0) {
        await this.migrateIllnesses(jsonData.illnesses, currentUserId)
      }

      // Migrate medications/prescriptions
      if (jsonData.medications.length > 0) {
        await this.migrateMedications(jsonData.medications, currentUserId)
      }

      // Migrate symptoms
      if (jsonData.symptoms.length > 0) {
        await this.migrateSymptoms(jsonData.symptoms, currentUserId)
      }

      console.log('✅ Data migration completed successfully!')
      return { success: true, message: 'Data migrated successfully' }
    } catch (error) {
      console.error('❌ Data migration failed:', error)
      return { success: false, error: error.message }
    }
  }

  // Migrate doctors
  async migrateDoctors(doctors, currentUserId) {
    try {
      console.log(`📋 Migrating ${doctors.length} doctors...`)
      
      for (const doctor of doctors) {
        // Update doctorId to current user's ID
        const doctorData = {
          ...doctor,
          doctorId: currentUserId,
          migratedAt: new Date().toISOString()
        }
        
        await firebaseStorageService.createDoctor(doctorData)
      }
      
      this.migrationStatus.doctors = true
      console.log('✅ Doctors migrated successfully')
    } catch (error) {
      console.error('❌ Error migrating doctors:', error)
      throw error
    }
  }

  // Migrate patients
  async migratePatients(patients, currentUserId) {
    try {
      console.log(`👥 Migrating ${patients.length} patients...`)
      
      for (const patient of patients) {
        // Update doctorId to current user's ID
        const patientData = {
          ...patient,
          doctorId: currentUserId,
          migratedAt: new Date().toISOString()
        }
        
        await firebaseStorageService.createPatient(patientData)
      }
      
      this.migrationStatus.patients = true
      console.log('✅ Patients migrated successfully')
    } catch (error) {
      console.error('❌ Error migrating patients:', error)
      throw error
    }
  }

  // Migrate illnesses
  async migrateIllnesses(illnesses, currentUserId) {
    try {
      console.log(`🏥 Migrating ${illnesses.length} illnesses...`)
      
      for (const illness of illnesses) {
        const illnessData = {
          ...illness,
          migratedAt: new Date().toISOString()
        }
        
        await firebaseStorageService.createIllness(illnessData)
      }
      
      this.migrationStatus.illnesses = true
      console.log('✅ Illnesses migrated successfully')
    } catch (error) {
      console.error('❌ Error migrating illnesses:', error)
      throw error
    }
  }

  // Migrate medications/prescriptions
  async migrateMedications(medications, currentUserId) {
    try {
      console.log(`💊 Migrating ${medications.length} medications...`)
      
      for (const medication of medications) {
        const medicationData = {
          ...medication,
          migratedAt: new Date().toISOString()
        }
        
        await firebaseStorageService.createMedication(medicationData)
      }
      
      this.migrationStatus.medications = true
      console.log('✅ Medications migrated successfully')
    } catch (error) {
      console.error('❌ Error migrating medications:', error)
      throw error
    }
  }

  // Migrate symptoms
  async migrateSymptoms(symptoms, currentUserId) {
    try {
      console.log(`🤒 Migrating ${symptoms.length} symptoms...`)
      
      for (const symptom of symptoms) {
        const symptomData = {
          ...symptom,
          migratedAt: new Date().toISOString()
        }
        
        await firebaseStorageService.createSymptoms(symptomData)
      }
      
      this.migrationStatus.symptoms = true
      console.log('✅ Symptoms migrated successfully')
    } catch (error) {
      console.error('❌ Error migrating symptoms:', error)
      throw error
    }
  }

  // Clear localStorage after successful migration
  async clearLocalStorageAfterMigration() {
    try {
      console.log('🧹 Clearing localStorage after successful migration...')
      jsonStorage.clearAllData()
      console.log('✅ localStorage cleared successfully')
    } catch (error) {
      console.error('❌ Error clearing localStorage:', error)
      throw error
    }
  }

  // Get migration status
  getMigrationStatus() {
    return this.migrationStatus
  }

  // Reset migration status
  resetMigrationStatus() {
    this.migrationStatus = {
      doctors: false,
      patients: false,
      illnesses: false,
      medications: false,
      symptoms: false,
      drugDatabase: false
    }
  }

  // Export data from localStorage for backup
  exportLocalStorageData() {
    try {
      const data = jsonStorage.exportData()
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `prescribe-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      console.log('✅ Data exported successfully')
      return { success: true }
    } catch (error) {
      console.error('❌ Error exporting data:', error)
      return { success: false, error: error.message }
    }
  }

  // Import data from backup file
  async importDataFromFile(file) {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      // Validate data structure
      if (!data.doctors || !data.patients || !data.medications) {
        throw new Error('Invalid data format')
      }
      
      // Import to localStorage first
      jsonStorage.importData(text)
      
      console.log('✅ Data imported successfully')
      return { success: true }
    } catch (error) {
      console.error('❌ Error importing data:', error)
      return { success: false, error: error.message }
    }
  }
}

// Create singleton instance
const dataMigrationService = new DataMigrationService()

export default dataMigrationService
