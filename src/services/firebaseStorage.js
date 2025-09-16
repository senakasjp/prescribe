// Firebase Firestore Database Service
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot
} from 'firebase/firestore'
import { db } from '../firebase-config.js'

class FirebaseStorageService {
  constructor() {
    this.collections = {
      doctors: 'doctors',
      patients: 'patients',
      illnesses: 'illnesses',
      medications: 'medications',
      symptoms: 'symptoms',
      drugDatabase: 'drugDatabase',
      pharmacists: 'pharmacists'
    }
  }

  // Generate unique ID (Firebase will generate its own, but keeping for compatibility)
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  // Doctor operations
  async createDoctor(doctorData) {
    try {
      console.log('🔥 Firebase: Creating doctor in collection:', this.collections.doctors)
      console.log('🔥 Firebase: Doctor data to save:', doctorData)
      
      const docRef = await addDoc(collection(db, this.collections.doctors), {
        ...doctorData,
        createdAt: new Date().toISOString()
      })
      
      const createdDoctor = { id: docRef.id, ...doctorData }
      console.log('🔥 Firebase: Doctor created successfully with ID:', docRef.id)
      console.log('🔥 Firebase: Created doctor object:', createdDoctor)
      
      return createdDoctor
    } catch (error) {
      console.error('🔥 Firebase: Error creating doctor:', error)
      console.error('🔥 Firebase: Error message:', error.message)
      console.error('🔥 Firebase: Error code:', error.code)
      throw error
    }
  }

  async getDoctorByEmail(email) {
    try {
      const q = query(collection(db, this.collections.doctors), where('email', '==', email))
      const querySnapshot = await getDocs(q)
      
      if (querySnapshot.empty) {
        return null
      }
      
      const doc = querySnapshot.docs[0]
      return { id: doc.id, ...doc.data() }
    } catch (error) {
      console.error('Error getting doctor by email:', error)
      throw error
    }
  }

  async getDoctorById(id) {
    try {
      const docRef = doc(db, this.collections.doctors, id)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() }
      }
      return null
    } catch (error) {
      console.error('Error getting doctor by ID:', error)
      throw error
    }
  }

  async updateDoctor(updatedDoctor) {
    try {
      const docRef = doc(db, this.collections.doctors, updatedDoctor.id)
      await updateDoc(docRef, {
        ...updatedDoctor,
        updatedAt: new Date().toISOString()
      })
      return { id: updatedDoctor.id, ...updatedDoctor }
    } catch (error) {
      console.error('Error updating doctor:', error)
      throw error
    }
  }

  async getAllDoctors() {
    try {
      const q = query(collection(db, this.collections.doctors), orderBy('createdAt', 'desc'))
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('Error getting all doctors:', error)
      throw error
    }
  }

  // Clear all prescriptions for a pharmacist (for testing/cleanup)
  async clearPharmacistPrescriptions(pharmacistId) {
    try {
      console.log('🧹 Clearing all prescriptions for pharmacist:', pharmacistId)
      const pharmacistRef = doc(db, this.collections.pharmacists, pharmacistId)
      const prescriptionsRef = collection(pharmacistRef, 'receivedPrescriptions')
      
      const existingPrescriptions = await getDocs(prescriptionsRef)
      console.log('🧹 Found prescriptions to clear:', existingPrescriptions.size)
      
      for (const docSnapshot of existingPrescriptions.docs) {
        await deleteDoc(docSnapshot.ref)
        console.log('🧹 Deleted prescription:', docSnapshot.id)
      }
      
      console.log('✅ Successfully cleared all prescriptions for pharmacist:', pharmacistId)
      return true
    } catch (error) {
      console.error('Error clearing pharmacist prescriptions:', error)
      throw error
    }
  }

  // Pharmacist operations
  async createPharmacist(pharmacistData) {
    try {
      console.log('🏥 Creating pharmacist with Firebase:', pharmacistData)
      
      const pharmacist = {
        email: pharmacistData.email,
        password: pharmacistData.password,
        role: pharmacistData.role,
        businessName: pharmacistData.businessName,
        pharmacistNumber: pharmacistData.pharmacistNumber,
        connectedDoctors: [], // Array of doctor IDs who have connected with this pharmacist
        createdAt: new Date().toISOString()
      }
      
      const docRef = await addDoc(collection(db, this.collections.pharmacists), pharmacist)
      const createdPharmacist = { id: docRef.id, ...pharmacist }
      
      console.log('🏥 Created pharmacist in Firebase:', createdPharmacist)
      return createdPharmacist
    } catch (error) {
      console.error('Error creating pharmacist:', error)
      throw error
    }
  }

  async getPharmacistByEmail(email) {
    try {
      const q = query(collection(db, this.collections.pharmacists), where('email', '==', email))
      const querySnapshot = await getDocs(q)
      
      if (querySnapshot.empty) {
        return null
      }
      
      const doc = querySnapshot.docs[0]
      return { id: doc.id, ...doc.data() }
    } catch (error) {
      console.error('Error getting pharmacist by email:', error)
      throw error
    }
  }

  async getPharmacistById(id) {
    try {
      const docRef = doc(db, this.collections.pharmacists, id)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() }
      }
      return null
    } catch (error) {
      console.error('Error getting pharmacist by ID:', error)
      throw error
    }
  }

  async getPharmacistByNumber(pharmacistNumber) {
    try {
      console.log('🔍 Searching for pharmacist number in Firebase:', pharmacistNumber)
      
      const q = query(collection(db, this.collections.pharmacists), where('pharmacistNumber', '==', pharmacistNumber))
      const querySnapshot = await getDocs(q)
      
      if (querySnapshot.empty) {
        console.log('❌ Pharmacist not found with number:', pharmacistNumber)
        return null
      }
      
      const doc = querySnapshot.docs[0]
      const pharmacist = { id: doc.id, ...doc.data() }
      console.log('✅ Found pharmacist in Firebase:', pharmacist.businessName, 'with number:', pharmacist.pharmacistNumber)
      
      return pharmacist
    } catch (error) {
      console.error('Error getting pharmacist by number:', error)
      throw error
    }
  }

  async getAllPharmacists() {
    try {
      const q = query(collection(db, this.collections.pharmacists), orderBy('createdAt', 'desc'))
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('Error getting all pharmacists:', error)
      throw error
    }
  }

  async updatePharmacist(updatedPharmacist) {
    try {
      const docRef = doc(db, this.collections.pharmacists, updatedPharmacist.id)
      await updateDoc(docRef, {
        ...updatedPharmacist,
        updatedAt: new Date().toISOString()
      })
      return { id: updatedPharmacist.id, ...updatedPharmacist }
    } catch (error) {
      console.error('Error updating pharmacist:', error)
      throw error
    }
  }

  // Update patient
  async updatePatient(patientId, updatedPatientData) {
    try {
      console.log('👤 Updating patient:', patientId)
      const patientRef = doc(db, this.collections.patients, patientId)
      await updateDoc(patientRef, updatedPatientData)
      console.log('✅ Patient updated successfully')
      return { id: patientId, ...updatedPatientData }
    } catch (error) {
      console.error('Error updating patient:', error)
      throw error
    }
  }

  // Update prescription
  async updatePrescription(prescriptionId, updatedPrescriptionData) {
    try {
      console.log('📋 Updating prescription:', prescriptionId)
      const prescriptionRef = doc(db, this.collections.medications, prescriptionId)
      await updateDoc(prescriptionRef, updatedPrescriptionData)
      console.log('✅ Prescription updated successfully')
      return { id: prescriptionId, ...updatedPrescriptionData }
    } catch (error) {
      console.error('Error updating prescription:', error)
      throw error
    }
  }

  // Add medication to prescription
  async addMedicationToPrescription(prescriptionId, medicationData) {
    try {
      console.log('💊 Adding medication to prescription:', prescriptionId)
      
      // Get the current prescription
      const prescriptionRef = doc(db, this.collections.medications, prescriptionId)
      const prescriptionDoc = await getDoc(prescriptionRef)
      
      if (!prescriptionDoc.exists()) {
        throw new Error('Prescription not found')
      }
      
      const prescriptionData = prescriptionDoc.data()
      const medications = prescriptionData.medications || []
      
      // Add the new medication
      const newMedication = {
        ...medicationData,
        id: this.generateId(),
        createdAt: new Date().toISOString()
      }
      medications.push(newMedication)
      
      // Update the prescription
      await updateDoc(prescriptionRef, { medications })
      
      console.log('✅ Medication added to prescription successfully')
      return newMedication
    } catch (error) {
      console.error('Error adding medication to prescription:', error)
      throw error
    }
  }

  async connectPharmacistToDoctor(pharmacistNumber, doctorIdentifier) {
    try {
      console.log('🔍 Looking for pharmacist with number in Firebase:', pharmacistNumber)
      
      const pharmacist = await this.getPharmacistByNumber(pharmacistNumber)
      if (!pharmacist) {
        console.log('❌ Pharmacist not found with number:', pharmacistNumber)
        throw new Error('Pharmacist not found')
      }
      
      console.log('✅ Found pharmacist:', pharmacist.businessName, 'with number:', pharmacist.pharmacistNumber)
      
      // Find doctor by ID first, then by email if not found
      console.log('🔍 Looking for doctor with identifier:', doctorIdentifier)
      let doctor = await this.getDoctorById(doctorIdentifier)
      if (!doctor) {
        console.log('🔍 Doctor not found by ID, trying email lookup...')
        // Try to find by email (for Firebase users)
        doctor = await this.getDoctorByEmail(doctorIdentifier)
      }
      
      if (!doctor) {
        console.log('❌ Doctor not found with identifier:', doctorIdentifier)
        console.log('🔍 Available doctors in Firebase:')
        const allDoctors = await this.getAllDoctors()
        console.log('All doctors:', allDoctors.map(d => ({ id: d.id, email: d.email, name: d.firstName })))
        throw new Error('Doctor not found')
      }
      
      console.log('✅ Found doctor:', doctor.firstName || doctor.email)
      
      // Check if already connected
      if (pharmacist.connectedDoctors && pharmacist.connectedDoctors.includes(doctor.id)) {
        console.log('ℹ️ Doctor already connected to pharmacist')
        return pharmacist
      }
      
      // Add doctor to pharmacist's connected doctors
      const updatedConnectedDoctors = [...(pharmacist.connectedDoctors || []), doctor.id]
      
      // Update pharmacist
      await this.updatePharmacist({
        id: pharmacist.id,
        connectedDoctors: updatedConnectedDoctors
      })
      
      console.log('✅ Successfully connected pharmacist to doctor')
      return pharmacist
      
    } catch (error) {
      console.error('Error connecting pharmacist to doctor:', error)
      throw error
    }
  }

  // Patient operations
  async createPatient(patientData) {
    try {
      // Validate required fields
      if (!patientData.firstName || !patientData.lastName || !patientData.email || !patientData.idNumber) {
        throw new Error('Missing required patient data')
      }

      // Filter out undefined values to prevent Firebase errors
      const cleanPatientData = Object.fromEntries(
        Object.entries(patientData).filter(([key, value]) => value !== undefined)
      )

      const patient = {
        firstName: cleanPatientData.firstName?.trim() || '',
        lastName: cleanPatientData.lastName?.trim() || '',
        email: cleanPatientData.email?.trim() || '',
        phone: cleanPatientData.phone?.trim() || '',
        dateOfBirth: cleanPatientData.dateOfBirth || '',
        idNumber: cleanPatientData.idNumber?.trim() || '',
        address: cleanPatientData.address?.trim() || '',
        emergencyContact: cleanPatientData.emergencyContact?.trim() || '',
        emergencyPhone: cleanPatientData.emergencyPhone?.trim() || '',
        doctorId: cleanPatientData.doctorId,
        createdAt: new Date().toISOString()
      }

      const docRef = await addDoc(collection(db, this.collections.patients), patient)
      return { id: docRef.id, ...patient }
    } catch (error) {
      console.error('Error creating patient:', error)
      throw error
    }
  }

  async getPatients() {
    try {
      const q = query(collection(db, this.collections.patients), orderBy('createdAt', 'desc'))
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('Error getting patients:', error)
      throw error
    }
  }

  async getPatientsByDoctorId(doctorId) {
    try {
      const q = query(
        collection(db, this.collections.patients), 
        where('doctorId', '==', doctorId),
        orderBy('createdAt', 'desc')
      )
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('Error getting patients by doctor ID:', error)
      throw error
    }
  }

  async getPatientById(id) {
    try {
      const docRef = doc(db, this.collections.patients, id)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() }
      }
      return null
    } catch (error) {
      console.error('Error getting patient by ID:', error)
      throw error
    }
  }

  // Illness operations
  async createIllness(illnessData) {
    try {
      const illness = {
        ...illnessData,
        createdAt: new Date().toISOString()
      }
      
      const docRef = await addDoc(collection(db, this.collections.illnesses), illness)
      return { id: docRef.id, ...illness }
    } catch (error) {
      console.error('Error creating illness:', error)
      throw error
    }
  }

  async getIllnessesByPatientId(patientId) {
    try {
      const q = query(
        collection(db, this.collections.illnesses), 
        where('patientId', '==', patientId),
        orderBy('createdAt', 'desc')
      )
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('Error getting illnesses by patient ID:', error)
      throw error
    }
  }

  // Prescription/Medication operations
  async createMedication(medicationData) {
    try {
      const medication = {
        ...medicationData,
        createdAt: new Date().toISOString()
      }
      
      const docRef = await addDoc(collection(db, this.collections.medications), medication)
      return { id: docRef.id, ...medication }
    } catch (error) {
      console.error('Error creating medication:', error)
      throw error
    }
  }

  // Prescription methods (unified with medications)
  async createPrescription(prescriptionData) {
    return this.createMedication(prescriptionData)
  }

  async getPrescriptionsByPatientId(patientId) {
    try {
      const q = query(
        collection(db, this.collections.medications), 
        where('patientId', '==', patientId),
        orderBy('createdAt', 'desc')
      )
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('Error getting prescriptions by patient ID:', error)
      throw error
    }
  }

  async getMedicationsByPatientId(patientId) {
    return this.getPrescriptionsByPatientId(patientId)
  }

  async deletePrescription(prescriptionId) {
    return this.deleteMedication(prescriptionId)
  }

  async deleteMedication(medicationId) {
    try {
      await deleteDoc(doc(db, this.collections.medications, medicationId))
      return true
    } catch (error) {
      console.error('Error deleting medication:', error)
      throw error
    }
  }

  // Symptoms operations
  async createSymptoms(symptomsData) {
    try {
      const symptoms = {
        ...symptomsData,
        createdAt: new Date().toISOString()
      }
      
      const docRef = await addDoc(collection(db, this.collections.symptoms), symptoms)
      return { id: docRef.id, ...symptoms }
    } catch (error) {
      console.error('Error creating symptoms:', error)
      throw error
    }
  }

  async getSymptomsByPatientId(patientId) {
    try {
      const q = query(
        collection(db, this.collections.symptoms), 
        where('patientId', '==', patientId),
        orderBy('createdAt', 'desc')
      )
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('Error getting symptoms by patient ID:', error)
      throw error
    }
  }

  // Drug Database operations
  async addDrug(doctorId, drugData) {
    try {
      const drug = {
        ...drugData,
        doctorId,
        createdAt: new Date().toISOString()
      }
      
      const docRef = await addDoc(collection(db, this.collections.drugDatabase), drug)
      return { id: docRef.id, ...drug }
    } catch (error) {
      console.error('Error adding drug to database:', error)
      throw error
    }
  }

  async searchDrugs(doctorId, searchTerm) {
    try {
      const q = query(
        collection(db, this.collections.drugDatabase), 
        where('doctorId', '==', doctorId),
        where('name', '>=', searchTerm),
        where('name', '<=', searchTerm + '\uf8ff'),
        limit(10)
      )
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('Error searching drugs:', error)
      throw error
    }
  }

  async getDoctorDrugs(doctorId) {
    try {
      const q = query(
        collection(db, this.collections.drugDatabase), 
        where('doctorId', '==', doctorId),
        orderBy('name')
      )
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('Error getting doctor drugs:', error)
      throw error
    }
  }

  // Real-time listeners
  onPatientsChange(doctorId, callback) {
    const q = query(
      collection(db, this.collections.patients), 
      where('doctorId', '==', doctorId),
      orderBy('createdAt', 'desc')
    )
    
    return onSnapshot(q, (querySnapshot) => {
      const patients = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      callback(patients)
    })
  }

  onPrescriptionsChange(patientId, callback) {
    const q = query(
      collection(db, this.collections.medications), 
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc')
    )
    
    return onSnapshot(q, (querySnapshot) => {
      const prescriptions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      callback(prescriptions)
    })
  }

  // Pharmacist prescription operations
  async getPharmacistPrescriptions(pharmacistId) {
    try {
      console.log('🔍 Getting prescriptions for pharmacist:', pharmacistId)
      
      // Get prescriptions from the pharmacist's receivedPrescriptions subcollection
      const pharmacistRef = doc(db, this.collections.pharmacists, pharmacistId)
      const prescriptionsRef = collection(pharmacistRef, 'receivedPrescriptions')
      
      console.log('🔍 Pharmacist ref path:', pharmacistRef.path)
      console.log('🔍 Prescriptions ref path:', prescriptionsRef.path)
      
      const querySnapshot = await getDocs(prescriptionsRef)
      
      console.log('🔍 Query snapshot size:', querySnapshot.size)
      console.log('🔍 Query snapshot docs:', querySnapshot.docs.length)
      
      if (querySnapshot.size === 0) {
        console.log('🔍 No documents found in subcollection')
        console.log('🔍 Checking if subcollection exists...')
        
        // Try to get the parent document to see if it exists
        const pharmacistDoc = await getDoc(pharmacistRef)
        console.log('🔍 Pharmacist document exists:', pharmacistDoc.exists())
        if (pharmacistDoc.exists()) {
          console.log('🔍 Pharmacist document data:', pharmacistDoc.data())
        }
      }
      
      const prescriptions = querySnapshot.docs.map(doc => {
        const data = doc.data()
        console.log('🔍 Prescription doc data:', data)
        return {
          id: doc.id,
          ...data
        }
      })
      
      console.log('📋 Found prescriptions for pharmacist:', prescriptions.length)
      console.log('📋 Prescriptions data:', prescriptions)
      
      // Sort by received date (newest first)
      return prescriptions.sort((a, b) => {
        const dateA = new Date(a.receivedAt || a.sentAt || 0)
        const dateB = new Date(b.receivedAt || b.sentAt || 0)
        return dateB - dateA // Descending order
      })
    } catch (error) {
      console.error('Error getting pharmacist prescriptions:', error)
      throw error
    }
  }

  async getAllPrescriptions() {
    try {
      // Get all prescriptions without orderBy to avoid index requirement
      const q = query(collection(db, this.collections.medications))
      const querySnapshot = await getDocs(q)
      
      const prescriptions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      // Sort in JavaScript instead of Firestore to avoid index requirement
      return prescriptions.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0)
        const dateB = new Date(b.createdAt || 0)
        return dateB - dateA // Descending order
      })
    } catch (error) {
      console.error('Error getting all prescriptions:', error)
      throw error
    }
  }

  async savePharmacistPrescriptions(pharmacistId, prescriptions) {
    try {
      console.log('💾 Saving prescriptions for pharmacist:', pharmacistId)
      console.log('💾 Prescriptions to save:', prescriptions.length)
      console.log('💾 Prescriptions data:', prescriptions)
      
      // This would typically save to a separate collection for pharmacist-specific data
      // For now, we'll store it in a pharmacist-specific subcollection
      const pharmacistRef = doc(db, this.collections.pharmacists, pharmacistId)
      const prescriptionsRef = collection(pharmacistRef, 'receivedPrescriptions')
      
      console.log('💾 Pharmacist ref path:', pharmacistRef.path)
      console.log('💾 Prescriptions ref path:', prescriptionsRef.path)
      
      // Clear existing prescriptions first
      const existingPrescriptions = await getDocs(prescriptionsRef)
      console.log('💾 Existing prescriptions to clear:', existingPrescriptions.size)
      
      for (const docSnapshot of existingPrescriptions.docs) {
        await deleteDoc(docSnapshot.ref)
      }
      
      // Add new prescriptions
      for (const prescription of prescriptions) {
        const prescriptionData = {
          ...prescription,
          receivedAt: new Date().toISOString()
        }
        console.log('💾 Adding prescription:', prescriptionData)
        const docRef = await addDoc(prescriptionsRef, prescriptionData)
        console.log('💾 Prescription added with ID:', docRef.id)
      }
      
      console.log('✅ Successfully saved prescriptions for pharmacist:', pharmacistId)
      return true
    } catch (error) {
      console.error('Error saving pharmacist prescriptions:', error)
      throw error
    }
  }

  // Debug and utility methods
  async debugDataState() {
    try {
      console.log('🔍 Firebase Debug:')
      
      const [patients, medications, illnesses, symptoms] = await Promise.all([
        getDocs(collection(db, this.collections.patients)),
        getDocs(collection(db, this.collections.medications)),
        getDocs(collection(db, this.collections.illnesses)),
        getDocs(collection(db, this.collections.symptoms))
      ])
      
      console.log('Total Patients:', patients.size)
      console.log('Total Medications/Prescriptions:', medications.size)
      console.log('Total Illnesses:', illnesses.size)
      console.log('Total Symptoms:', symptoms.size)
      
      return {
        patients: patients.size,
        medications: medications.size,
        illnesses: illnesses.size,
        symptoms: symptoms.size
      }
    } catch (error) {
      console.error('Error in debug data state:', error)
      throw error
    }
  }
}

// Create singleton instance
const firebaseStorageService = new FirebaseStorageService()

export default firebaseStorageService
