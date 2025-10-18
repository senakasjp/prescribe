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
              const parsedQuantity = this.parseMedicationQuantity(medication.amount)
              const quantity = parsedQuantity !== null ? parsedQuantity : 0

              let unitCost = null
              let inventoryContext = medication.inventoryMatch && medication.inventoryMatch.found
                ? medication.inventoryMatch
                : null
              let inventoryItemDetails = null
              let matchedInventoryItem = null

              if (inventoryContext && inventoryContext.inventoryItemId) {
                matchedInventoryItem = inventoryItems.find(item => item.id === inventoryContext.inventoryItemId) || null
              }

              if (inventoryContext) {
                const priceSource = inventoryContext.sellingPrice !== undefined && inventoryContext.sellingPrice !== null
                  ? inventoryContext.sellingPrice
                  : matchedInventoryItem?.sellingPrice
                const parsed = this.parseCurrencyValue(priceSource)
                if (parsed !== null) {
                  unitCost = parsed
                  inventoryItemDetails = {
                    brandName: inventoryContext.brandName || matchedInventoryItem?.brandName,
                    genericName: inventoryContext.genericName || matchedInventoryItem?.genericName,
                    drugName: matchedInventoryItem?.drugName || inventoryContext.brandName || inventoryContext.genericName || medication.name
                  }
                }
              }

              if (unitCost === null) {
                const fallbackInventoryItem = matchedInventoryItem || this.findMatchingDrug(medication, inventoryItems)
                if (fallbackInventoryItem) {
                  const parsed = this.parseCurrencyValue(fallbackInventoryItem.sellingPrice)
                  if (parsed !== null) {
                    unitCost = parsed
                    inventoryItemDetails = {
                      brandName: fallbackInventoryItem.brandName,
                      genericName: fallbackInventoryItem.genericName,
                      drugName: fallbackInventoryItem.drugName
                    }
                  }
                }
              }

              if (unitCost !== null && quantity > 0) {
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
                  inventoryItem: inventoryItemDetails
                })
              } else {
                medicationBreakdown.push({
                  medicationName: medication.name,
                  dosage: medication.dosage,
                  frequency: medication.frequency,
                  duration: medication.duration,
                  quantity: quantity,
                  unitCost: unitCost !== null ? unitCost : 0,
                  totalCost: 0,
                  found: false,
                  note: unitCost === null ? 'Not available in inventory' : 'No quantity specified'
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
  findMatchingDrug(medication, inventoryItems) {
    if (!medication || !inventoryItems || inventoryItems.length === 0) {
      return null
    }

    const medicationNames = this.buildMedicationNameSet(medication)

    for (const item of inventoryItems) {
      const itemNames = this.buildInventoryNameSet(item)

      const hasMatch = Array.from(medicationNames).some(medName =>
        Array.from(itemNames).some(invName =>
          invName &&
          (
            invName === medName ||
            invName.includes(medName) ||
            medName.includes(invName)
          )
        )
      )

      if (hasMatch) {
        return item
      }
    }

    return null
  }

  normalizeName(value) {
    return (value || '')
      .toLowerCase()
      .replace(/[\u3000\s]+/g, ' ')
      .replace(/[\(\)（）]/g, '')
      .trim()
  }

  buildMedicationNameSet(medication) {
    const names = new Set()
    const medicationName = medication.name || ''
    const genericName = medication.genericName || ''

    names.add(this.normalizeName(medicationName))
    names.add(this.normalizeName(genericName))

    const brandFromName = medicationName.split(/[\(（]/)[0]?.trim()
    const genericFromName = medicationName.includes('(') || medicationName.includes('（')
      ? medicationName.split(/[\(（]/)[1]?.replace(/[\)）]/, '').trim()
      : ''

    names.add(this.normalizeName(brandFromName))
    names.add(this.normalizeName(genericFromName))

    names.delete('')
    return names
  }

  buildInventoryNameSet(item) {
    const names = new Set()

    const brandName = item.brandName || ''
    const genericName = item.genericName || ''
    const drugName = item.drugName || ''

    names.add(this.normalizeName(brandName))
    names.add(this.normalizeName(genericName))
    names.add(this.normalizeName(drugName))

    if (brandName) {
      names.add(this.normalizeName(brandName.split(/[\(（]/)[0]))
    }

    names.delete('')
    return names
  }

  /**
   * Parse medication quantity from various prescription amount formats
   * @param {string|number} amount - Prescription amount value
   * @returns {number|null} Parsed quantity or null if unavailable
   */
  parseMedicationQuantity(amount) {
    return this.extractNumericValue(amount)
  }

  /**
   * Parse currency or numeric string values into numbers
   * @param {string|number} value
   * @returns {number|null}
   */
  parseCurrencyValue(value) {
    return this.extractNumericValue(value)
  }

  extractNumericValue(rawValue) {
    if (typeof rawValue === 'number') {
      return Number.isFinite(rawValue) ? rawValue : null
    }

    if (typeof rawValue === 'string') {
      const normalized = rawValue.replace(/,/g, '').trim()
      if (!normalized) {
        return null
      }

      const match = normalized.match(/-?\d+(\.\d+)?/)
      if (match) {
        const parsed = parseFloat(match[0])
        return Number.isFinite(parsed) ? parsed : null
      }
    }

    return null
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
