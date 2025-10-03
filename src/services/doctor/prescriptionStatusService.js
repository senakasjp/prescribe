/**
 * Doctor Prescription Status Service
 * This service provides a decoupled way for the doctor portal to check
 * prescription dispensed status without directly accessing pharmacist data
 */

import { db } from '../../firebase-config.js'
import { collection, query, where, getDocs } from 'firebase/firestore'

class DoctorPrescriptionStatusService {
  constructor() {
    this.collections = {
      pharmacistPrescriptions: 'pharmacistPrescriptions',
      stockMovements: 'pharmacistStockMovements'
    }
  }

  /**
   * Check if a prescription has been dispensed by any connected pharmacy
   * @param {string} prescriptionId - The prescription ID to check
   * @param {string} doctorId - The doctor ID (for security)
   * @returns {Promise<Object>} - Status information
   */
  async checkPrescriptionDispensedStatus(prescriptionId, doctorId) {
    try {
      console.log('🔍 DoctorPrescriptionStatusService: Checking dispensed status for prescription:', prescriptionId)
      
      // Check pharmacist prescriptions for dispensed status
      const pharmacistPrescriptionsQuery = query(
        collection(db, this.collections.pharmacistPrescriptions),
        where('prescriptionId', '==', prescriptionId)
      )
      
      const pharmacistPrescriptionsSnapshot = await getDocs(pharmacistPrescriptionsQuery)
      
      let dispensedStatus = {
        isDispensed: false,
        dispensedAt: null,
        dispensedBy: null,
        dispensedMedications: []
      }
      
      // Check if any pharmacist has marked this prescription as dispensed
      pharmacistPrescriptionsSnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.status === 'dispensed' || data.dispensedAt) {
          dispensedStatus.isDispensed = true
          dispensedStatus.dispensedAt = data.dispensedAt || data.updatedAt
          dispensedStatus.dispensedBy = data.pharmacistName || 'Pharmacy'
          dispensedStatus.dispensedMedications = data.dispensedMedications || []
        }
      })
      
      // Also check stock movements for dispatch records
      if (!dispensedStatus.isDispensed) {
        const stockMovementsQuery = query(
          collection(db, this.collections.stockMovements),
          where('referenceId', '==', prescriptionId),
          where('type', '==', 'dispatch')
        )
        
        const stockMovementsSnapshot = await getDocs(stockMovementsQuery)
        
        if (!stockMovementsSnapshot.empty) {
          dispensedStatus.isDispensed = true
          dispensedStatus.dispensedAt = stockMovementsSnapshot.docs[0].data().createdAt
          dispensedStatus.dispensedBy = 'Pharmacy'
          
          // Collect dispensed medications from stock movements
          stockMovementsSnapshot.forEach((doc) => {
            const movement = doc.data()
            if (movement.notes && movement.notes.includes('Dispensed for prescription')) {
              const drugName = movement.notes.split(' - ')[1] || 'Unknown'
              dispensedStatus.dispensedMedications.push({
                name: drugName,
                quantity: Math.abs(movement.quantity),
                dispensedAt: movement.createdAt
              })
            }
          })
        }
      }
      
      console.log('✅ DoctorPrescriptionStatusService: Dispensed status:', dispensedStatus)
      return dispensedStatus
      
    } catch (error) {
      console.error('❌ DoctorPrescriptionStatusService: Error checking dispensed status:', error)
      return {
        isDispensed: false,
        dispensedAt: null,
        dispensedBy: null,
        dispensedMedications: [],
        error: error.message
      }
    }
  }

  /**
   * Check dispensed status for multiple prescriptions
   * @param {Array} prescriptionIds - Array of prescription IDs
   * @param {string} doctorId - The doctor ID
   * @returns {Promise<Object>} - Status information for all prescriptions
   */
  async checkMultiplePrescriptionsStatus(prescriptionIds, doctorId) {
    try {
      const statusPromises = prescriptionIds.map(id => 
        this.checkPrescriptionDispensedStatus(id, doctorId)
      )
      
      const statuses = await Promise.all(statusPromises)
      
      const result = {}
      prescriptionIds.forEach((id, index) => {
        result[id] = statuses[index]
      })
      
      return result
      
    } catch (error) {
      console.error('❌ DoctorPrescriptionStatusService: Error checking multiple prescriptions:', error)
      return {}
    }
  }

  /**
   * Get dispensed status for a patient's prescriptions
   * @param {string} patientId - The patient ID
   * @param {string} doctorId - The doctor ID
   * @returns {Promise<Object>} - Status information for patient's prescriptions
   */
  async getPatientPrescriptionsStatus(patientId, doctorId) {
    try {
      console.log('🔍 DoctorPrescriptionStatusService: Getting patient prescriptions status:', patientId)
      
      // Query for all prescriptions related to this patient
      const prescriptionsQuery = query(
        collection(db, this.collections.pharmacistPrescriptions),
        where('patientId', '==', patientId)
      )
      
      const prescriptionsSnapshot = await getDocs(prescriptionsQuery)
      
      const patientStatus = {}
      
      prescriptionsSnapshot.forEach((doc) => {
        const data = doc.data()
        const pharmacistPrescriptionId = data.prescriptionId || doc.id
        
        console.log('🔍 Pharmacist prescription data:', {
          docId: doc.id,
          prescriptionId: data.prescriptionId,
          data: data,
          allFields: Object.keys(data),
          dispensedMedications: data.dispensedMedications,
          status: data.status,
          dispensedAt: data.dispensedAt
        })
        
        // Create status object
        const statusInfo = {
          isDispensed: data.status === 'dispensed' || !!data.dispensedAt,
          dispensedAt: data.dispensedAt || data.updatedAt,
          dispensedBy: data.pharmacistName || 'Pharmacy',
          dispensedMedications: data.dispensedMedications || []
        }
        
        // Map to both pharmacist and doctor prescription IDs
        patientStatus[pharmacistPrescriptionId] = statusInfo
        
        // Also check if there's a doctor prescription ID in the data
        if (data.doctorPrescriptionId) {
          patientStatus[data.doctorPrescriptionId] = statusInfo
        }
        
        // Try to extract doctor prescription ID from pharmacist prescription ID
        // Format: timestamp_doctorPrescriptionId
        if (pharmacistPrescriptionId.includes('_')) {
          const parts = pharmacistPrescriptionId.split('_')
          if (parts.length >= 2) {
            const doctorPrescriptionId = parts.slice(1).join('_') // Join remaining parts in case ID contains underscores
            patientStatus[doctorPrescriptionId] = statusInfo
            console.log('🔍 Mapped pharmacist ID to doctor ID:', pharmacistPrescriptionId, '->', doctorPrescriptionId)
          }
        }
        
        // Also check if there's a different doctor prescription ID format
        // Sometimes the doctor prescription ID might be different from the extracted one
        // Let's also check if there are any other prescription IDs in the data
        if (data.originalPrescriptionId) {
          patientStatus[data.originalPrescriptionId] = statusInfo
          console.log('🔍 Mapped using originalPrescriptionId:', data.originalPrescriptionId)
        }
        
        // Check if there's a doctorId field that might contain the prescription ID
        if (data.doctorId && data.doctorId !== doctorId) {
          patientStatus[data.doctorId] = statusInfo
          console.log('🔍 Mapped using doctorId field:', data.doctorId)
        }
      })
      
      console.log('✅ DoctorPrescriptionStatusService: Patient prescriptions status:', patientStatus)
      return patientStatus
      
    } catch (error) {
      console.error('❌ DoctorPrescriptionStatusService: Error getting patient prescriptions status:', error)
      return {}
    }
  }
}

// Export singleton instance
export default new DoctorPrescriptionStatusService()
