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
      name: drugData.name.toLowerCase().trim(),
      displayName: drugData.name.trim(),
      dosage: drugData.dosage || '',
      instructions: drugData.instructions || '',
      frequency: drugData.frequency || '',
      duration: drugData.duration || '',
      notes: drugData.notes || '',
      createdAt: new Date().toISOString(),
      addedBy: doctorId
    }

    // Check if drug already exists
    const existingDrug = this.data[doctorId].drugs.find(d => d.name === drug.name)
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

  // Search drugs by name (autocomplete)
  searchDrugs(doctorId, query, limit = 10) {
    this.initializeDoctorDatabase(doctorId)
    
    if (!query || query.trim().length < 2) {
      return []
    }

    const searchTerm = query.toLowerCase().trim()
    const doctorDrugs = this.data[doctorId]?.drugs || []

    return doctorDrugs
      .filter(drug => drug.name.includes(searchTerm) || drug.displayName.toLowerCase().includes(searchTerm))
      .sort((a, b) => {
        // Prioritize exact matches and matches at the beginning
        const aStartsWith = a.name.startsWith(searchTerm)
        const bStartsWith = b.name.startsWith(searchTerm)
        
        if (aStartsWith && !bStartsWith) return -1
        if (!aStartsWith && bStartsWith) return 1
        
        return a.name.localeCompare(b.name)
      })
      .slice(0, limit)
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

