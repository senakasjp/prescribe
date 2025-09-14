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
      drugDatabase: 'drugDatabase'
    }
  }

  // Generate unique ID (Firebase will generate its own, but keeping for compatibility)
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  // Doctor operations
  async createDoctor(doctorData) {
    try {
      const docRef = await addDoc(collection(db, this.collections.doctors), {
        ...doctorData,
        createdAt: new Date().toISOString()
      })
      return { id: docRef.id, ...doctorData }
    } catch (error) {
      console.error('Error creating doctor:', error)
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
