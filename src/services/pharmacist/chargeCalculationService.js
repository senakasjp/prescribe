// Charge Calculation Service for Pharmacy Portal
// Handles calculation of total prescription charges including doctor fees and drug costs

import firebaseStorage from '../firebaseStorage.js'
import pharmacistStorageService from './pharmacistStorageService.js'
import inventoryService from './inventoryService.js'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase-config.js'

class ChargeCalculationService {
  constructor() {
    this.collections = {
      doctors: 'doctors',
      pharmacistInventory: 'pharmacistInventory'
    }
  }

  /**
   * Calculate total charge for a prescription
   * Formula: Charge = (Consultation charge + Hospital charge) * (1 - discount/100) + Drug charge
   * 
   * @param {Object} prescription - The prescription object
   * @param {Object} pharmacist - The pharmacist object
   * @returns {Promise<Object>} Charge breakdown and total
   */
  async calculatePrescriptionCharge(prescription, pharmacist) {
    try {
      console.log('💰 Calculating prescription charge for:', prescription.id)
      
      // Get doctor information to fetch consultation and hospital charges
      const doctor = await this.getDoctorById(prescription.doctorId)
      if (!doctor) {
        throw new Error(`Doctor with ID ${prescription.doctorId} not found`)
      }

      // Calculate doctor charges (consultation + hospital)
      const consultationCharge = parseFloat(doctor.consultationCharge || 0)
      const hospitalCharge = parseFloat(doctor.hospitalCharge || 0)
      const totalDoctorCharges = consultationCharge + hospitalCharge

      // Get discount percentage from prescription
      const discountPercentage = prescription.discount || 0
      const discountMultiplier = 1 - (discountPercentage / 100)
      const discountedDoctorCharges = totalDoctorCharges * discountMultiplier

      // Calculate drug charges for dispensed medications
      const drugCharges = await this.calculateDrugCharges(prescription, pharmacist)

      // Calculate total charge
      const totalCharge = discountedDoctorCharges + drugCharges.totalCost

      const chargeBreakdown = {
        doctorCharges: {
          consultationCharge: consultationCharge,
          hospitalCharge: hospitalCharge,
          totalBeforeDiscount: totalDoctorCharges,
          discountPercentage: discountPercentage,
          discountAmount: totalDoctorCharges - discountedDoctorCharges,
          totalAfterDiscount: discountedDoctorCharges
        },
        drugCharges: drugCharges,
        totalCharge: totalCharge,
        currency: pharmacist.currency || 'USD'
      }

      console.log('💰 Charge calculation completed:', chargeBreakdown)
      return chargeBreakdown

    } catch (error) {
      console.error('❌ Error calculating prescription charge:', error)
      throw error
    }
  }

  /**
   * Get doctor information by ID
   * @param {string} doctorId - Doctor ID
   * @returns {Promise<Object>} Doctor object
   */
  async getDoctorById(doctorId) {
    try {
      return await firebaseStorage.getDoctorById(doctorId)
    } catch (error) {
      console.error('❌ Error getting doctor by ID:', error)
      throw error
    }
  }

  /**
   * Calculate drug charges for dispensed medications
   * @param {Object} prescription - The prescription object
   * @param {Object} pharmacist - The pharmacist object
   * @returns {Promise<Object>} Drug charges breakdown
   */
  async calculateDrugCharges(prescription, pharmacist) {
    try {
      console.log('💊 Calculating drug charges for prescription:', prescription.id)
      
      let totalCost = 0
      let medicationBreakdown = []
      let totalMedications = 0

      // Get pharmacist's inventory using the new inventory service
      const inventoryItems = await inventoryService.getInventoryItems(pharmacist.id)
      console.log('💊 Retrieved inventory items:', inventoryItems.length, 'items')
      
      // Process each prescription in the prescription object
      if (prescription.prescriptions && prescription.prescriptions.length > 0) {
        for (const presc of prescription.prescriptions) {
          if (presc.medications && presc.medications.length > 0) {
            for (const medication of presc.medications) {
              // Find matching drug in inventory
              const matchingDrug = this.findMatchingDrug(medication.name, inventoryItems)
              
              if (matchingDrug) {
                // For now, assume 1 unit per medication (can be enhanced later with quantity)
                const quantity = 1
                const unitCost = matchingDrug.sellingPrice || 0
                const totalMedicationCost = quantity * unitCost
                
                totalCost += totalMedicationCost
                totalMedications++
                
                medicationBreakdown.push({
                  medicationName: medication.name,
                  dosage: medication.dosage,
                  frequency: medication.frequency,
                  duration: medication.duration,
                  quantity: quantity,
                  unitCost: unitCost,
                  totalCost: totalMedicationCost,
                  found: true,
                  inventoryItem: {
                    brandName: matchingDrug.brandName,
                    genericName: matchingDrug.genericName,
                    drugName: matchingDrug.drugName
                  }
                })
              } else {
                // Medication not found in inventory
                medicationBreakdown.push({
                  medicationName: medication.name,
                  dosage: medication.dosage,
                  frequency: medication.frequency,
                  duration: medication.duration,
                  quantity: 0,
                  unitCost: 0,
                  totalCost: 0,
                  found: false,
                  note: 'Not available in inventory'
                })
              }
            }
          }
        }
      }

      const drugCharges = {
        totalCost: totalCost,
        totalMedications: totalMedications,
        medicationBreakdown: medicationBreakdown
      }

      console.log('💊 Drug charges calculated:', drugCharges)
      return drugCharges

    } catch (error) {
      console.error('❌ Error calculating drug charges:', error)
      throw error
    }
  }

  /**
   * Find matching drug in inventory by name (case-insensitive partial match)
   * @param {string} medicationName - Name of the medication
   * @param {Array} inventoryItems - Array of inventory items
   * @returns {Object|null} Matching drug object or null
   */
  findMatchingDrug(medicationName, inventoryItems) {
    if (!medicationName || !inventoryItems || inventoryItems.length === 0) {
      return null
    }

    const searchName = medicationName.toLowerCase().trim()
    
    // First try exact match with brandName
    let match = inventoryItems.find(item => 
      item.brandName && item.brandName.toLowerCase().trim() === searchName
    )
    
    if (match) return match

    // Then try exact match with drugName
    match = inventoryItems.find(item => 
      item.drugName && item.drugName.toLowerCase().trim() === searchName
    )
    
    if (match) return match

    // Then try generic name match
    match = inventoryItems.find(item => 
      item.genericName && item.genericName.toLowerCase().trim() === searchName
    )
    
    if (match) return match

    // Finally try partial match with all name fields
    match = inventoryItems.find(item => 
      (item.brandName && item.brandName.toLowerCase().includes(searchName)) ||
      (item.drugName && item.drugName.toLowerCase().includes(searchName)) ||
      (item.genericName && item.genericName.toLowerCase().includes(searchName))
    )
    
    return match || null
  }

  /**
   * Format currency amount based on pharmacist's currency setting
   * @param {number} amount - Amount to format
   * @param {string} currency - Currency code
   * @returns {string} Formatted currency string
   */
  formatCurrency(amount, currency = 'USD') {
    try {
      if (currency === 'LKR') {
        // For LKR, return just the number without symbol
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(amount)
      } else {
        // For other currencies, use standard formatting
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency
        }).format(amount)
      }
    } catch (error) {
      console.error('❌ Error formatting currency:', error)
      return amount.toFixed(2)
    }
  }
}

// Create singleton instance
const chargeCalculationService = new ChargeCalculationService()
export default chargeCalculationService
