// Drug Database Service
// Maintains a drug database for each doctor with autocomplete functionality

class DrugDatabase {
  constructor() {
    this.storageKey = 'prescribe-drug-database'
    this.data = this.loadData()
  }

  // Load data from localStorage
  loadData() {
    try {
      const stored = localStorage.getItem(this.storageKey)
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.error('Error loading drug database:', error)
      return {}
    }
  }

  // Save data to localStorage
  saveData() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data))
    } catch (error) {
      console.error('Error saving drug database:', error)
    }
  }

  // Initialize drug database for a doctor if it doesn't exist
  initializeDoctorDatabase(doctorId) {
    if (!this.data[doctorId]) {
      this.data[doctorId] = {
        drugs: [],
        lastUpdated: new Date().toISOString()
      }
      this.saveData()
    }
  }

  // Add a drug to doctor's database
  addDrug(doctorId, drugData) {
    this.initializeDoctorDatabase(doctorId)
    
    const drug = {
      id: this.generateId(),
      // Support both single name and brand/generic pairs
      name: drugData.name ? drugData.name.toLowerCase().trim() : '',
      displayName: drugData.name ? drugData.name.trim() : '',
      // New brand/generic structure
      brandName: drugData.brandName ? drugData.brandName.trim() : '',
      genericName: drugData.genericName ? drugData.genericName.trim() : '',
      // Combined search name for backward compatibility
      searchName: this.generateSearchName(drugData.brandName, drugData.genericName, drugData.name),
      dosage: drugData.dosage || '',
      instructions: drugData.instructions || '',
      frequency: drugData.frequency || '',
      duration: drugData.duration || '',
      notes: drugData.notes || '',
      createdAt: new Date().toISOString(),
      addedBy: doctorId
    }

    // Check if drug already exists (by search name or legacy name)
    const existingDrug = this.data[doctorId].drugs.find(d => 
      d.searchName === drug.searchName || 
      d.name === drug.name ||
      (drug.brandName && drug.genericName && d.brandName === drug.brandName && d.genericName === drug.genericName)
    )
    
    if (existingDrug) {
      // Update existing drug
      Object.assign(existingDrug, drug)
      existingDrug.updatedAt = new Date().toISOString()
    } else {
      // Add new drug
      this.data[doctorId].drugs.push(drug)
    }

    this.data[doctorId].lastUpdated = new Date().toISOString()
    this.saveData()
    return drug
  }

  // Generate search name from brand/generic names
  generateSearchName(brandName, genericName, legacyName) {
    if (brandName && genericName) {
      return `${brandName.toLowerCase().trim()} ${genericName.toLowerCase().trim()}`
    }
    return legacyName ? legacyName.toLowerCase().trim() : ''
  }

  // Search drugs by name (autocomplete)
  searchDrugs(doctorId, query, limit = 10) {
    this.initializeDoctorDatabase(doctorId)
    
    if (!query || query.trim().length < 2) {
      return []
    }

    const searchTerm = query.toLowerCase().trim()
    const doctorDrugs = this.data[doctorId]?.drugs || []

    return doctorDrugs
      .filter(drug => {
        // Search in brand name, generic name, legacy name, and search name
        return (drug.brandName && drug.brandName.toLowerCase().includes(searchTerm)) ||
               (drug.genericName && drug.genericName.toLowerCase().includes(searchTerm)) ||
               (drug.name && drug.name.includes(searchTerm)) ||
               (drug.displayName && drug.displayName.toLowerCase().includes(searchTerm)) ||
               (drug.searchName && drug.searchName.includes(searchTerm))
      })
      .map(drug => ({
        ...drug,
        // Create display name for results
        displayName: this.createDisplayName(drug)
      }))
      .sort((a, b) => {
        // Prioritize exact matches and matches at the beginning
        const aBrandMatch = a.brandName && a.brandName.toLowerCase().startsWith(searchTerm)
        const bBrandMatch = b.brandName && b.brandName.toLowerCase().startsWith(searchTerm)
        const aGenericMatch = a.genericName && a.genericName.toLowerCase().startsWith(searchTerm)
        const bGenericMatch = b.genericName && b.genericName.toLowerCase().startsWith(searchTerm)
        const aLegacyMatch = a.name && a.name.startsWith(searchTerm)
        const bLegacyMatch = b.name && b.name.startsWith(searchTerm)
        
        // Brand name matches first, then generic, then legacy
        if (aBrandMatch && !bBrandMatch) return -1
        if (!aBrandMatch && bBrandMatch) return 1
        if (aGenericMatch && !bGenericMatch) return -1
        if (!aGenericMatch && bGenericMatch) return 1
        if (aLegacyMatch && !bLegacyMatch) return -1
        if (!aLegacyMatch && bLegacyMatch) return 1
        
        return a.displayName.localeCompare(b.displayName)
      })
      .slice(0, limit)
  }

  // Create display name for drug results
  createDisplayName(drug) {
    if (drug.brandName && drug.genericName) {
      return `${drug.brandName} (${drug.genericName})`
    } else if (drug.brandName) {
      return drug.brandName
    } else if (drug.genericName) {
      return drug.genericName
    } else if (drug.displayName) {
      return drug.displayName
    } else if (drug.name) {
      return drug.name
    }
    return 'Unknown Drug'
  }

  // Get all drugs for a doctor
  getDoctorDrugs(doctorId) {
    this.initializeDoctorDatabase(doctorId)
    return this.data[doctorId]?.drugs || []
  }

  // Get drug by ID
  getDrugById(doctorId, drugId) {
    this.initializeDoctorDatabase(doctorId)
    return this.data[doctorId]?.drugs.find(drug => drug.id === drugId)
  }

  // Update drug
  updateDrug(doctorId, drugId, updates) {
    this.initializeDoctorDatabase(doctorId)
    const drugIndex = this.data[doctorId].drugs.findIndex(drug => drug.id === drugId)
    
    if (drugIndex !== -1) {
      this.data[doctorId].drugs[drugIndex] = {
        ...this.data[doctorId].drugs[drugIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      this.data[doctorId].lastUpdated = new Date().toISOString()
      this.saveData()
      return this.data[doctorId].drugs[drugIndex]
    }
    return null
  }

  // Delete drug
  deleteDrug(doctorId, drugId) {
    this.initializeDoctorDatabase(doctorId)
    const drugIndex = this.data[doctorId].drugs.findIndex(drug => drug.id === drugId)
    
    if (drugIndex !== -1) {
      this.data[doctorId].drugs.splice(drugIndex, 1)
      this.data[doctorId].lastUpdated = new Date().toISOString()
      this.saveData()
      return true
    }
    return false
  }

  // Generate unique ID
  generateId() {
    return 'drug_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  // Get database stats for a doctor
  getDatabaseStats(doctorId) {
    this.initializeDoctorDatabase(doctorId)
    const drugs = this.data[doctorId]?.drugs || []
    return {
      totalDrugs: drugs.length,
      lastUpdated: this.data[doctorId]?.lastUpdated,
      recentlyAdded: drugs.filter(drug => {
        const created = new Date(drug.createdAt)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        return created > weekAgo
      }).length
    }
  }

  // Clear database for a doctor (for testing)
  clearDoctorDatabase(doctorId) {
    if (this.data[doctorId]) {
      delete this.data[doctorId]
      this.saveData()
    }
  }

  // Debug function
  debugDatabase(doctorId) {
    console.log('🔍 Drug Database Debug for Doctor:', doctorId)
    console.log('Database:', this.data[doctorId])
    console.log('Stats:', this.getDatabaseStats(doctorId))
  }
}

// Create singleton instance
const drugDatabase = new DrugDatabase()

export default drugDatabase

