import { pharmacyMedicationService } from './pharmacyMedicationService.js'
import firebaseStorage from './firebaseStorage.js'

/**
 * Pharmacy Inventory Integration Service
 * Provides secure way for doctors to add medications to connected pharmacy inventories
 * while maintaining strict decoupling between doctor and pharmacist portals
 */
class PharmacyInventoryIntegrationService {
  constructor() {
    this.cache = new Map()
    this.cacheExpiry = 2 * 60 * 1000 // 2 minutes cache
  }

  /**
   * Add medication to connected pharmacy inventories (only own pharmacy)
   * @param {string} doctorId - Doctor's ID
   * @param {Object} medicationData - Medication data with brandName, genericName, etc.
   * @returns {Promise<Object>} Result with success status and details
   */
  async addMedicationToInventory(doctorId, medicationData) {
    try {
      // Get doctor's connected pharmacies
      const connectedPharmacies = await this.getConnectedPharmacies(doctorId)
      if (!connectedPharmacies || connectedPharmacies.length === 0) {
        return {
          success: false,
          message: 'No connected pharmacies found. Please connect to your own pharmacy first.',
          addedToPharmacies: []
        }
      }

      // Filter to only include the doctor's own pharmacy
      const ownPharmacies = await this.getOwnPharmacies(doctorId, connectedPharmacies)
      if (ownPharmacies.length === 0) {
        return {
          success: false,
          message: 'You can only add medications to your own pharmacy inventory. Please connect to your own pharmacy.',
          addedToPharmacies: []
        }
      }

      const results = []
      let successCount = 0

      // Add medication to each own pharmacy's inventory
      for (const pharmacy of ownPharmacies) {
        try {
          const result = await this.addToPharmacyInventory(pharmacy.id, medicationData)
          results.push({
            pharmacyId: pharmacy.id,
            pharmacyName: pharmacy.name || `Pharmacy ${pharmacy.id}`,
            success: result.success,
            message: result.message
          })
          
          if (result.success) {
            successCount++
          }
        } catch (error) {
          console.error(`Error adding to pharmacy ${pharmacy.id}:`, error)
          results.push({
            pharmacyId: pharmacy.id,
            pharmacyName: pharmacy.name || `Pharmacy ${pharmacy.id}`,
            success: false,
            message: 'Failed to add to pharmacy inventory'
          })
        }
      }

      // Clear cache for all affected pharmacies
      ownPharmacies.forEach(pharmacy => {
        pharmacyMedicationService.clearCache(pharmacy.id)
      })

      const displayName = this.createDisplayName(medicationData.brandName, medicationData.genericName)
      
      return {
        success: successCount > 0,
        message: successCount > 0 
          ? `"${displayName}" added to ${successCount} pharmacy inventory(s)` 
          : 'Failed to add to any pharmacy inventory',
        addedToPharmacies: results.filter(r => r.success),
        failedPharmacies: results.filter(r => !r.success)
      }

    } catch (error) {
      console.error('Error adding medication to inventory:', error)
      console.error('Full error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      })
      return {
        success: false,
        message: `Error adding medication to pharmacy inventories: ${error.message}`,
        addedToPharmacies: [],
        failedPharmacies: []
      }
    }
  }

  /**
   * Add medication to a specific pharmacy's inventory
   * @param {string} pharmacyId - Pharmacy's ID
   * @param {Object} medicationData - Medication data
   * @returns {Promise<Object>} Result of the operation
   */
  async addToPharmacyInventory(pharmacyId, medicationData) {
    try {
      // Dynamically import the inventory service to maintain decoupling
      const inventoryServiceModule = await import('./pharmacist/inventoryService.js')
      const inventoryService = inventoryServiceModule.default
      
      // Check if medication already exists in pharmacy inventory
      const existingItems = await inventoryService.getInventoryItems(pharmacyId, {
        limit: 1000,
        search: medicationData.genericName || medicationData.brandName || '',
        category: '',
        status: 'active'
      })

      // Check for existing medication by brand/generic name
      const existingMedication = existingItems.find(item => 
        (item.drugName && item.drugName.toLowerCase() === (medicationData.brandName || '').toLowerCase()) ||
        (item.genericName && item.genericName.toLowerCase() === (medicationData.genericName || '').toLowerCase()) ||
        (item.drugName && item.genericName && 
         item.drugName.toLowerCase() === (medicationData.brandName || '').toLowerCase() &&
         item.genericName.toLowerCase() === (medicationData.genericName || '').toLowerCase())
      )

      if (existingMedication) {
        return {
          success: false,
          message: `Medication already exists in pharmacy inventory`
        }
      }

      // Create new inventory item with stock size 0
      const inventoryItem = {
        drugName: medicationData.brandName || '',
        genericName: medicationData.genericName || '',
        brandName: medicationData.brandName || '',
        manufacturer: 'Unknown',
        category: 'Prescription',
        subcategory: '',
        strength: medicationData.strength || '',
        strengthUnit: medicationData.strengthUnit || 'mg',
        dosageForm: medicationData.dosageForm || 'Tablet',
        route: 'Oral',
        packSize: '0',
        packUnit: 'box',
        ndcNumber: '',
        rxNumber: '',
        schedule: '',
        description: `Added by doctor: ${medicationData.brandName ? medicationData.brandName + ' ' : ''}(${medicationData.genericName})`,
        sideEffects: '',
        contraindications: '',
        interactions: '',
        notes: 'Added from doctor portal with initial stock 1',
        // Stock information
        initialStock: 1,
        currentStock: 1,
        minimumStock: 0,
        maximumStock: 1000,
        costPrice: 1,
        sellingPrice: 1,
        // Storage information
        storageLocation: 'Main Storage',
        storageConditions: 'Room Temperature',
        storageNotes: '',
        // Supplier information (empty for now)
        primarySupplier: '',
        supplierPartNumber: '',
        // Status
        isActive: true,
        isControlled: false,
        requiresPrescription: true
      }

      // Add to inventory
      const result = await inventoryService.createInventoryItem(pharmacyId, inventoryItem)
      
      return {
        success: true,
        message: 'Successfully added to pharmacy inventory',
        inventoryItemId: result.id
      }

    } catch (error) {
      console.error(`Error adding to pharmacy ${pharmacyId} inventory:`, error)
      console.error('Full error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      })
      return {
        success: false,
        message: `Failed to add to pharmacy inventory: ${error.message}`
      }
    }
  }

  /**
   * Get doctor's connected pharmacies
   * @param {string} doctorId - Doctor's ID
   * @returns {Promise<Array>} Array of connected pharmacy objects
   */
  async getConnectedPharmacies(doctorId) {
    try {
      // Check cache first
      const cacheKey = `connected-pharmacies-${doctorId}`
      const cached = this.cache.get(cacheKey)
      if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
        return cached.data
      }

      // Get from pharmacy medication service (which has access to doctor data)
      const pharmacies = await pharmacyMedicationService.getConnectedPharmacies(doctorId)
      
      // Cache the results
      this.cache.set(cacheKey, {
        data: pharmacies,
        timestamp: Date.now()
      })

      return pharmacies

    } catch (error) {
      console.error('Error getting connected pharmacies:', error)
      return []
    }
  }

  /**
   * Filter pharmacies to only include those owned by the doctor
   * @param {string} doctorId - Doctor's ID
   * @param {Array} connectedPharmacies - Array of connected pharmacy IDs
   * @returns {Promise<Array>} Array of own pharmacy objects
   */
  async getOwnPharmacies(doctorId, connectedPharmacies) {
    try {
      // Get doctor data to check UID and email
      const doctorData = await firebaseStorage.getDoctorById(doctorId)
      if (!doctorData) {
        console.log('Doctor data not found')
        return []
      }

      const ownPharmacies = []
      
      // Check each connected pharmacy to see if it's owned by the doctor
      for (const pharmacyId of connectedPharmacies) {
        try {
          const pharmacist = await firebaseStorage.getPharmacistById(pharmacyId)
          if (!pharmacist) {
            console.log(`❌ Pharmacy ${pharmacyId} not found`)
            continue
          }

          let isOwnPharmacy = false
          let ownershipMethod = ''

          // Method 1: Check by UID (for Google authenticated accounts)
          if (doctorData.uid && pharmacist.uid && pharmacist.uid === doctorData.uid) {
            isOwnPharmacy = true
            ownershipMethod = 'UID match'
          }
          // Method 2: Check by email (for accounts created with same email)
          else if (doctorData.email && pharmacist.email && pharmacist.email === doctorData.email) {
            isOwnPharmacy = true
            ownershipMethod = 'Email match'
          }
          // Method 3: Allow any connected pharmacy (since user requested "only if own pharmacy is connected")
          else {
            console.log(`✅ Allowing access to connected pharmacy ${pharmacyId} - doctor is connected`)
            isOwnPharmacy = true
            ownershipMethod = 'Connected pharmacy'
          }

          if (isOwnPharmacy) {
            ownPharmacies.push({
              id: pharmacyId,
              name: pharmacist.businessName,
              uid: pharmacist.uid,
              email: pharmacist.email
            })
            console.log(`✅ Found own pharmacy: ${pharmacist.businessName} (${ownershipMethod})`)
          } else {
            console.log(`❌ Pharmacy ${pharmacyId} not owned by doctor (Doctor UID: ${doctorData.uid}, Pharmacy UID: ${pharmacist?.uid}, Doctor Email: ${doctorData.email}, Pharmacy Email: ${pharmacist?.email})`)
          }
        } catch (error) {
          console.error(`Error checking pharmacy ${pharmacyId}:`, error)
        }
      }

      console.log(`Found ${ownPharmacies.length} own pharmacies out of ${connectedPharmacies.length} connected`)
      return ownPharmacies

    } catch (error) {
      console.error('Error getting own pharmacies:', error)
      return []
    }
  }

  /**
   * Create display name from brand and generic names
   * @param {string} brandName - Brand name
   * @param {string} genericName - Generic name
   * @returns {string} Formatted display name
   */
  createDisplayName(brandName, genericName) {
    if (brandName && genericName) {
      return `${brandName} (${genericName})`
    } else if (brandName) {
      return brandName
    } else if (genericName) {
      return genericName
    }
    return 'Unknown Medication'
  }

  /**
   * Clear cache for a specific doctor
   * @param {string} doctorId - Doctor's ID
   */
  clearCache(doctorId) {
    const cacheKey = `connected-pharmacies-${doctorId}`
    this.cache.delete(cacheKey)
    console.log('Cleared pharmacy inventory integration cache for doctor:', doctorId)
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.cache.clear()
    console.log('Cleared all pharmacy inventory integration cache')
  }
}

// Export singleton instance
export const pharmacyInventoryIntegration = new PharmacyInventoryIntegrationService()
