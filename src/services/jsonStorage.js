// JSON Storage Service - Temporary replacement for Firebase
// This can be easily converted to Firebase later

class JSONStorage {
  constructor() {
    this.storageKey = 'prescribe-data'
    this.data = this.loadData()
  }

  // Load data from localStorage
  loadData() {
    try {
      const stored = localStorage.getItem(this.storageKey)
      const data = stored ? JSON.parse(stored) : {
        doctors: [],
        patients: [],
        illnesses: [],
        medications: [],
        symptoms: []
      }
      
      // Clean up any corrupted data
      data.patients = data.patients.filter(patient => 
        patient && 
        patient.firstName && 
        patient.lastName && 
        patient.email && 
        patient.idNumber
      )
      
      return data
    } catch (error) {
      console.error('Error loading data from localStorage:', error)
      return {
        doctors: [],
        patients: [],
        illnesses: [],
        medications: [],
        symptoms: []
      }
    }
  }

  // Save data to localStorage
  saveData() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data))
    } catch (error) {
      console.error('Error saving data to localStorage:', error)
    }
  }

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  // Doctor operations
  async createDoctor(doctorData) {
    const doctor = {
      id: this.generateId(),
      ...doctorData,
      createdAt: new Date().toISOString()
    }
    this.data.doctors.push(doctor)
    this.saveData()
    return doctor
  }

  async getDoctorByEmail(email) {
    return this.data.doctors.find(doctor => doctor.email === email)
  }

  async getDoctorById(id) {
    return this.data.doctors.find(doctor => doctor.id === id)
  }

  // Patient operations
  async createPatient(patientData) {
    // Validate required fields - only first name and age are mandatory
    if (!patientData.firstName || !patientData.firstName.trim()) {
      throw new Error('First name is required')
    }
    
    if (!patientData.age || !patientData.age.toString().trim()) {
      throw new Error('Age is required')
    }
    
    const patient = {
      id: this.generateId(),
      firstName: patientData.firstName.trim(),
      lastName: patientData.lastName.trim(),
      email: patientData.email.trim(),
      phone: patientData.phone?.trim() || '',
      dateOfBirth: patientData.dateOfBirth,
      age: patientData.age?.trim() || '',
      weight: patientData.weight?.trim() || '',
      bloodGroup: patientData.bloodGroup?.trim() || '',
      idNumber: patientData.idNumber.trim(),
      address: patientData.address?.trim() || '',
      allergies: patientData.allergies?.trim() || '',
      emergencyContact: patientData.emergencyContact?.trim() || '',
      emergencyPhone: patientData.emergencyPhone?.trim() || '',
      doctorId: patientData.doctorId,
      createdAt: new Date().toISOString()
    }
    
    this.data.patients.push(patient)
    this.saveData()
    
    return patient
  }

  getPatients() {
    return this.data.patients
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }

  getPatientsByDoctorId(doctorId) {
    return this.data.patients
      .filter(patient => patient.doctorId === doctorId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }

  getPatientById(id) {
    return this.data.patients.find(patient => patient.id === id)
  }

  async updatePatient(id, updatedData) {
    const patientIndex = this.data.patients.findIndex(patient => patient.id === id)
    if (patientIndex === -1) {
      throw new Error('Patient not found')
    }

    // Validate required fields - only first name and age are mandatory
    if (!updatedData.firstName || !updatedData.firstName.trim()) {
      throw new Error('First name is required')
    }
    
    if (!updatedData.age || !updatedData.age.toString().trim()) {
      throw new Error('Age is required')
    }

    // Update patient data
    const updatedPatient = {
      ...this.data.patients[patientIndex],
      firstName: updatedData.firstName.trim(),
      lastName: updatedData.lastName.trim(),
      email: updatedData.email.trim(),
      phone: updatedData.phone?.trim() || '',
      dateOfBirth: updatedData.dateOfBirth,
      age: updatedData.age?.trim() || '',
      weight: updatedData.weight?.trim() || '',
      bloodGroup: updatedData.bloodGroup?.trim() || '',
      idNumber: updatedData.idNumber.trim(),
      address: updatedData.address?.trim() || '',
      allergies: updatedData.allergies?.trim() || '',
      emergencyContact: updatedData.emergencyContact?.trim() || '',
      emergencyPhone: updatedData.emergencyPhone?.trim() || '',
      updatedAt: new Date().toISOString()
    }

    this.data.patients[patientIndex] = updatedPatient
    this.saveData()
    
    return updatedPatient
  }

  // Illness operations
  async createIllness(illnessData) {
    const illness = {
      id: this.generateId(),
      ...illnessData,
      createdAt: new Date().toISOString()
    }
    this.data.illnesses.push(illness)
    this.saveData()
    return illness
  }

  getIllnessesByPatientId(patientId) {
    return this.data.illnesses
      .filter(illness => illness.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }

  // Prescription/Medication operations (unified)
  async createMedication(medicationData) {
    const medication = {
      id: this.generateId(),
      ...medicationData,
      createdAt: new Date().toISOString()
    }
    this.data.medications.push(medication)
    this.saveData()
    return medication
  }

  // Prescription methods (unified with medications)
  async createPrescription(prescriptionData) {
    return this.createMedication(prescriptionData)
  }

  getPrescriptionsByPatientId(patientId) {
    return this.data.medications
      .filter(medication => medication.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }

  getMedicationsByPatientId(patientId) {
    return this.getPrescriptionsByPatientId(patientId)
  }

  async deletePrescription(prescriptionId) {
    return this.deleteMedication(prescriptionId)
  }

  async deleteMedication(medicationId) {
    const index = this.data.medications.findIndex(medication => medication.id === medicationId)
    if (index !== -1) {
      this.data.medications.splice(index, 1)
      this.saveData()
      return true
    }
    return false
  }

  // Update medication/prescription
  async updateMedication(medicationId, updatedData) {
    const index = this.data.medications.findIndex(medication => medication.id === medicationId)
    if (index !== -1) {
      this.data.medications[index] = {
        ...this.data.medications[index],
        ...updatedData,
        updatedAt: new Date().toISOString()
      }
      this.saveData()
      return this.data.medications[index]
    }
    return null
  }

  // Update prescription (alias for updateMedication)
  async updatePrescription(prescriptionId, updatedData) {
    return this.updateMedication(prescriptionId, updatedData)
  }

  // Symptoms operations
  async createSymptoms(symptomsData) {
    const symptoms = {
      id: this.generateId(),
      ...symptomsData,
      createdAt: new Date().toISOString()
    }
    this.data.symptoms.push(symptoms)
    this.saveData()
    return symptoms
  }

  getSymptomsByPatientId(patientId) {
    return this.data.symptoms
      .filter(symptom => symptom.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }

  // Export data for backup or migration to Firebase
  exportData() {
    return JSON.stringify(this.data, null, 2)
  }

  // Import data from backup or migration from Firebase
  importData(jsonData) {
    try {
      this.data = JSON.parse(jsonData)
      this.saveData()
      return true
    } catch (error) {
      console.error('Error importing data:', error)
      return false
    }
  }

  // Clear all data (for testing)
  clearAllData() {
    this.data = {
      doctors: [],
      patients: [],
      illnesses: [],
      medications: [],
      symptoms: []
    }
    this.saveData()
  }

  // Debug function to check data state
  debugDataState() {
    console.log('🔍 JSONStorage Debug:')
    console.log('Total Patients:', this.data.patients.length)
    console.log('Total Medications/Prescriptions:', this.data.medications.length)
    console.log('Total Illnesses:', this.data.illnesses.length)
    console.log('Total Symptoms:', this.data.symptoms.length)
    console.log('All Data:', this.data)
  }

  // Reset data for testing
  resetData() {
    localStorage.removeItem('prescribe-data')
    this.loadData()
    console.log('🔄 Data reset complete')
  }
  
  // Clear corrupted data and reset
  clearCorruptedData() {
    console.log('Clearing corrupted data...')
    this.clearAllData()
    console.log('Data cleared successfully')
  }
  
  // Debug method to inspect current data
  inspectData() {
    console.log('=== DATABASE INSPECTION ===')
    console.log('All doctors:', this.data.doctors)
    console.log('All patients:', this.data.patients)
    console.log('All illnesses:', this.data.illnesses)
    console.log('All medications:', this.data.medications)
    console.log('All symptoms:', this.data.symptoms)
    console.log('Raw localStorage data:', localStorage.getItem(this.storageKey))
    console.log('=== END INSPECTION ===')
    return this.data
  }
}

// Create singleton instance
const jsonStorage = new JSONStorage()

export default jsonStorage
