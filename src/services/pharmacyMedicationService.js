import firebaseStorage from './firebaseStorage.js'

/**
 * Pharmacy Medication Service
 * Provides secure access to medication names from connected pharmacy inventories
 * while maintaining decoupling between doctor and pharmacy portals
 */
class PharmacyMedicationService {
  constructor() {
    this.cache = new Map()
    this.cacheExpiry = 5 * 60 * 1000 // 5 minutes cache
  }

  /**
   * Get medication names from connected pharmacy inventories
   * @param {string} doctorId - Doctor's ID
   * @returns {Promise<Array>} Array of medication names with brand/generic info
   */
  async getMedicationNamesFromPharmacies(doctorId) {
    try {
      // Check cache first
      const cacheKey = `medications-${doctorId}`
      const cached = this.cache.get(cacheKey)
      if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
        console.log('Using cached medication names')
        return cached.data
      }

      // Get doctor's connected pharmacies
      const connectedPharmacies = await this.getConnectedPharmacies(doctorId)
      if (!connectedPharmacies || connectedPharmacies.length === 0) {
        console.log('No connected pharmacies found')
        return []
      }

      // Fetch medication names from all connected pharmacy inventories
      const allMedications = []
      const promises = connectedPharmacies.map(pharmacyId => 
        this.fetchMedicationNamesFromPharmacy(pharmacyId)
      )

      const pharmacyMedications = await Promise.all(promises)
      
      // Flatten and deduplicate medications
      pharmacyMedications.forEach(medications => {
        medications.forEach(medication => {
          // Check if medication already exists (by brand/generic combination)
          const exists = allMedications.find(existing => 
            existing.brandName?.toLowerCase() === medication.brandName?.toLowerCase() &&
            existing.genericName?.toLowerCase() === medication.genericName?.toLowerCase()
          )
          
          if (!exists) {
            allMedications.push(medication)
          }
        })
      })

      // Cache the results
      this.cache.set(cacheKey, {
        data: allMedications,
        timestamp: Date.now()
      })

      console.log(`Fetched ${allMedications.length} unique medications from ${connectedPharmacies.length} pharmacies`)
      return allMedications

    } catch (error) {
      console.error('Error fetching medication names from pharmacies:', error)
      return []
    }
  }

  /**
   * Get doctor's connected pharmacies
   * @param {string} doctorId - Doctor's ID
   * @returns {Promise<Array>} Array of connected pharmacy objects
   */
  async getConnectedPharmacies(doctorId) {
    try {
      let doctorData = null

      // Try lookup by document ID first
      if (doctorId) {
        doctorData = await firebaseStorage.getDoctorById(doctorId)
      }

      // Fallback to email lookup when ID lookup fails (common during migrations)
      if (!doctorData && doctorId && typeof doctorId === 'string') {
        console.log('🔍 Doctor not found by ID, attempting email lookup:', doctorId)
        doctorData = await firebaseStorage.getDoctorByEmail(doctorId)
      }

      console.log('🔍 Doctor data for connected pharmacies:', { doctorId, hasDoctor: !!doctorData, connectedPharmacists: doctorData?.connectedPharmacists })

      const connectedPharmacies = new Set(doctorData?.connectedPharmacists || [])

      if (doctorData?.id) {
        try {
          const allPharmacists = await firebaseStorage.getAllPharmacists()
          allPharmacists.forEach(pharmacist => {
            if (Array.isArray(pharmacist.connectedDoctors) && pharmacist.connectedDoctors.includes(doctorData.id)) {
              connectedPharmacies.add(pharmacist.id)
            }
          })
        } catch (pharmacistError) {
          console.error('Error loading pharmacists for doctor connection lookup:', pharmacistError)
        }
      }

      const result = Array.from(connectedPharmacies)
      console.log('🔍 Connected pharmacy IDs resolved:', result)
      return result
    } catch (error) {
      console.error('Error getting connected pharmacies:', error)
      return []
    }
  }

  /**
   * Fetch medication names from a specific pharmacy's inventory
   * @param {string} pharmacyId - Pharmacy's ID
   * @returns {Promise<Array>} Array of medication objects with brand/generic names
   */
  async fetchMedicationNamesFromPharmacy(pharmacyId) {
    try {
      // Import the inventory service dynamically to maintain decoupling
      const inventoryServiceModule = await import('./pharmacist/inventoryService.js')
      const inventoryService = inventoryServiceModule.default
      
      // Get inventory items from the pharmacy
      const inventoryItems = await inventoryService.getInventoryItems(pharmacyId, {
        limit: 1000 // Get all items for medication names
      })

      // Extract medication names and format them
      const medications = inventoryItems
        .filter(item => item.drugName || item.genericName || item.brandName) // Only items with drug names
        .map(item => ({
          id: item.id,
          brandName: item.brandName || item.drugName || '', // Prioritize brandName over drugName
          genericName: item.genericName || '',
          displayName: this.createDisplayName(item.brandName || item.drugName, item.genericName),
          strength: item.strength || '',
          strengthUnit: item.strengthUnit || '',
          dosageForm: item.dosageForm || '',
          manufacturer: item.manufacturer || '',
          pharmacyId: pharmacyId,
          currentStock: item.currentStock || 0,
          packUnit: item.packUnit || '',
          expiryDate: item.expiryDate || ''
        }))
        .filter(med => med.brandName || med.genericName) // Ensure at least one name exists

      return medications
    
    } catch (error) {
      console.error(`Error fetching medications from pharmacy ${pharmacyId}:`, error)
      return []
    }
  }

  /**
   * Get normalized stock data from connected pharmacies
   * @param {string} doctorId - Doctor's ID
   * @returns {Promise<Array>} Array of stock items with availability details
   */
  async getPharmacyStock(doctorId) {
    try {
      const cacheKey = `stock-${doctorId}`
      const cached = this.cache.get(cacheKey)
      if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
        return cached.data
      }

      const connectedPharmacies = await this.getConnectedPharmacies(doctorId)
      if (!connectedPharmacies || connectedPharmacies.length === 0) {
        return []
      }

      const inventoryServiceModule = await import('./pharmacist/inventoryService.js')
      const inventoryService = inventoryServiceModule.default

      const allStock = []

      for (const pharmacyId of connectedPharmacies) {
        try {
          const inventoryItems = await inventoryService.getInventoryItems(pharmacyId, { limit: 1000 })
          console.log(`📦 Loaded ${inventoryItems.length} inventory items for pharmacy ${pharmacyId}`)
          const normalizedItems = inventoryItems.map(item => ({
            pharmacyId,
            inventoryItemId: item.id,
            drugName: item.brandName || item.drugName || '',
            genericName: item.genericName || '',
            strength: item.strength || '',
            strengthUnit: item.strengthUnit || '',
            dosageForm: item.dosageForm || item.packUnit || '',
            quantity: typeof item.currentStock === 'number'
              ? item.currentStock
              : parseInt(item.currentStock || item.quantity || 0, 10),
            currentStock: typeof item.currentStock === 'number'
              ? item.currentStock
              : parseInt(item.currentStock || item.quantity || 0, 10),
            minimumStock: typeof item.minimumStock === 'number'
              ? item.minimumStock
              : parseInt(item.minimumStock || 0, 10),
            sellingPrice: item.sellingPrice ?? item.unitCost ?? item.costPrice ?? null,
            unitCost: item.unitCost ?? item.sellingPrice ?? item.costPrice ?? null,
            costPrice: item.costPrice ?? null,
            packUnit: item.packUnit || '',
            expiryDate: item.expiryDate || '',
            batches: item.batches || [],
            rawItem: item
          }))

          allStock.push(...normalizedItems)
        } catch (pharmacyError) {
          console.error(`Error fetching inventory for pharmacy ${pharmacyId}:`, pharmacyError)
        }
      }

      this.cache.set(cacheKey, {
        data: allStock,
        timestamp: Date.now()
      })

      return allStock
    } catch (error) {
      console.error('Error fetching pharmacy stock:', error)
      return []
    }
  }

  /**
   * Create a display name from brand and generic names
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
    return ''
  }

  /**
   * Search medications from pharmacy inventories
   * @param {string} doctorId - Doctor's ID
   * @param {string} query - Search query
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Array of matching medications
   */
  async searchMedicationsFromPharmacies(doctorId, query, limit = 10) {
    try {
      console.log('🔍 PharmacyMedicationService: Searching for:', query, 'Doctor:', doctorId)
      const allMedications = await this.getMedicationNamesFromPharmacies(doctorId)
      console.log('📦 Total medications available:', allMedications.length)
      
      if (!query || query.trim().length < 2) {
        return allMedications.slice(0, limit)
      }

      const searchTerm = query.toLowerCase().trim()
      
      // Filter medications based on search query
      const matchingMedications = allMedications.filter(medication => {
        const brandMatch = medication.brandName?.toLowerCase().includes(searchTerm)
        const genericMatch = medication.genericName?.toLowerCase().includes(searchTerm)
        const displayMatch = medication.displayName?.toLowerCase().includes(searchTerm)
        
        // Also check if search term matches the beginning of brand/generic names
        const brandStartsWith = medication.brandName?.toLowerCase().startsWith(searchTerm)
        const genericStartsWith = medication.genericName?.toLowerCase().startsWith(searchTerm)
        
        const matches = brandMatch || genericMatch || displayMatch || brandStartsWith || genericStartsWith
        
        if (matches) {
          console.log('✅ Match found:', {
            brandName: medication.brandName,
            genericName: medication.genericName,
            displayName: medication.displayName,
            brandMatch,
            genericMatch,
            displayMatch,
            brandStartsWith,
            genericStartsWith
          })
        }
        
        return matches
      })

      console.log('🎯 Matching medications:', matchingMedications.length)

      // Sort by relevance (exact matches first, then partial matches)
      matchingMedications.sort((a, b) => {
        const aBrandExact = a.brandName?.toLowerCase().startsWith(searchTerm) ? 1 : 0
        const bBrandExact = b.brandName?.toLowerCase().startsWith(searchTerm) ? 1 : 0
        const aGenericExact = a.genericName?.toLowerCase().startsWith(searchTerm) ? 1 : 0
        const bGenericExact = b.genericName?.toLowerCase().startsWith(searchTerm) ? 1 : 0
        
        const aScore = aBrandExact + aGenericExact
        const bScore = bBrandExact + bGenericExact
        
        if (aScore !== bScore) return bScore - aScore
        
        return a.displayName.localeCompare(b.displayName)
      })

      return matchingMedications.slice(0, limit)

    } catch (error) {
      console.error('Error searching medications from pharmacies:', error)
      return []
    }
  }

  /**
   * Clear cache for a specific doctor
   * @param {string} doctorId - Doctor's ID
   */
  clearCache(doctorId) {
    const medicationKey = `medications-${doctorId}`
    const stockKey = `stock-${doctorId}`
    this.cache.delete(medicationKey)
    this.cache.delete(stockKey)
    console.log('Cleared pharmacy data cache for doctor:', doctorId)
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.cache.clear()
    console.log('Cleared all medication cache')
  }
}

// Export singleton instance
export const pharmacyMedicationService = new PharmacyMedicationService()
