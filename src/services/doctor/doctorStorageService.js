// Doctor Storage Service - Isolated storage for Doctor Module Only
// This service handles ONLY doctor-related data operations and should never interact with pharmacist data

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
import { db } from '../../firebase-config.js'
import { capitalizePatientNames } from '../../utils/nameUtils.js'

class DoctorStorageService {
  constructor() {
    this.collections = {
      doctors: 'doctors',
      patients: 'patients',
      illnesses: 'illnesses',
      medications: 'medications',
      symptoms: 'symptoms',
      longTermMedications: 'longTermMedications'
    }
  }

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  // Doctor operations
  async createDoctor(doctorData) {
    try {
      console.log('🔥 DoctorStorage: Creating doctor in collection:', this.collections.doctors)
      console.log('🔥 DoctorStorage: Doctor data to save:', doctorData)
      
      const serializableData = {
        email: doctorData.email,
        firstName: doctorData.firstName,
        lastName: doctorData.lastName,
        name: doctorData.name,
        country: doctorData.country,
        city: doctorData.city,
        role: doctorData.role,
        isAdmin: doctorData.isAdmin,
        permissions: doctorData.permissions,
        connectedPharmacists: doctorData.connectedPharmacists || [],
        uid: doctorData.uid,
        displayName: doctorData.displayName,
        photoURL: doctorData.photoURL,
        provider: doctorData.provider,
        createdAt: new Date().toISOString()
      }
      
      // Remove undefined values
      Object.keys(serializableData).forEach(key => {
        if (serializableData[key] === undefined) {
          delete serializableData[key]
        }
      })
      
      const docRef = await addDoc(collection(db, this.collections.doctors), serializableData)
      
      const createdDoctor = { id: docRef.id, ...serializableData }
      console.log('🔥 DoctorStorage: Doctor created successfully with ID:', docRef.id)
      
      return createdDoctor
    } catch (error) {
      console.error('🔥 DoctorStorage: Error creating doctor:', error)
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
      console.error('DoctorStorage: Error getting doctor by email:', error)
      throw error
    }
  }

  async getDoctorById(doctorId) {
    try {
      const docRef = doc(db, this.collections.doctors, doctorId)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() }
      } else {
        return null
      }
    } catch (error) {
      console.error('DoctorStorage: Error getting doctor by ID:', error)
      throw error
    }
  }

  async updateDoctor(doctorId, updateData) {
    try {
      const docRef = doc(db, this.collections.doctors, doctorId)
      await updateDoc(docRef, updateData)
      console.log('DoctorStorage: Doctor updated successfully')
    } catch (error) {
      console.error('DoctorStorage: Error updating doctor:', error)
      throw error
    }
  }

  // Patient operations (doctor-specific)
  async createPatient(patientData) {
    try {
      console.log('🔥 DoctorStorage: Creating patient in collection:', this.collections.patients)
      
      const serializableData = {
        ...patientData,
        createdAt: new Date().toISOString()
      }
      
      const docRef = await addDoc(collection(db, this.collections.patients), serializableData)
      
      const createdPatient = { id: docRef.id, ...serializableData }
      console.log('🔥 DoctorStorage: Patient created successfully with ID:', docRef.id)
      
      return createdPatient
    } catch (error) {
      console.error('🔥 DoctorStorage: Error creating patient:', error)
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
      
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (error) {
      console.error('DoctorStorage: Error getting patients by doctor ID:', error)
      throw error
    }
  }

  async getPatient(patientId) {
    try {
      const docRef = doc(db, this.collections.patients, patientId)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() }
      } else {
        return null
      }
    } catch (error) {
      console.error('DoctorStorage: Error getting patient:', error)
      throw error
    }
  }

  async updatePatient(patientId, updateData) {
    try {
      // Capitalize names before updating
      const capitalizedUpdateData = capitalizePatientNames(updateData)
      console.log('DoctorStorage: Capitalized patient update data:', capitalizedUpdateData)
      
      const docRef = doc(db, this.collections.patients, patientId)
      await updateDoc(docRef, capitalizedUpdateData)
      console.log('DoctorStorage: Patient updated successfully')
    } catch (error) {
      console.error('DoctorStorage: Error updating patient:', error)
      throw error
    }
  }

  async deletePatient(patientId) {
    try {
      const docRef = doc(db, this.collections.patients, patientId)
      await deleteDoc(docRef)
      console.log('DoctorStorage: Patient deleted successfully')
    } catch (error) {
      console.error('DoctorStorage: Error deleting patient:', error)
      throw error
    }
  }

  // Prescription operations (doctor-specific)
  async createPrescription(prescriptionData) {
    try {
      console.log('🔥 DoctorStorage: Creating prescription')
      
      const serializableData = {
        ...prescriptionData,
        createdAt: new Date().toISOString()
      }
      
      const docRef = await addDoc(collection(db, this.collections.medications), serializableData)
      
      const createdPrescription = { id: docRef.id, ...serializableData }
      console.log('🔥 DoctorStorage: Prescription created successfully with ID:', docRef.id)
      
      return createdPrescription
    } catch (error) {
      console.error('🔥 DoctorStorage: Error creating prescription:', error)
      throw error
    }
  }

  async getPrescriptionsByDoctorId(doctorId) {
    try {
      const q = query(
        collection(db, this.collections.medications), 
        where('doctorId', '==', doctorId),
        orderBy('createdAt', 'desc')
      )
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (error) {
      console.error('DoctorStorage: Error getting prescriptions by doctor ID:', error)
      throw error
    }
  }

  async getPrescriptionsByPatientId(patientId) {
    try {
      const q = query(
        collection(db, this.collections.medications), 
        where('patientId', '==', patientId),
        orderBy('createdAt', 'desc')
      )
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (error) {
      console.error('DoctorStorage: Error getting prescriptions by patient ID:', error)
      throw error
    }
  }

  // Symptom operations (doctor-specific)
  async createSymptom(symptomData) {
    try {
      console.log('🔥 DoctorStorage: Creating symptom')
      
      const serializableData = {
        ...symptomData,
        createdAt: new Date().toISOString()
      }
      
      const docRef = await addDoc(collection(db, this.collections.symptoms), serializableData)
      
      const createdSymptom = { id: docRef.id, ...serializableData }
      console.log('🔥 DoctorStorage: Symptom created successfully with ID:', docRef.id)
      
      return createdSymptom
    } catch (error) {
      console.error('🔥 DoctorStorage: Error creating symptom:', error)
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
      
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (error) {
      console.error('DoctorStorage: Error getting symptoms by patient ID:', error)
      throw error
    }
  }

  // Illness operations (doctor-specific)
  async createIllness(illnessData) {
    try {
      console.log('🔥 DoctorStorage: Creating illness')
      
      const serializableData = {
        ...illnessData,
        createdAt: new Date().toISOString()
      }
      
      const docRef = await addDoc(collection(db, this.collections.illnesses), serializableData)
      
      const createdIllness = { id: docRef.id, ...serializableData }
      console.log('🔥 DoctorStorage: Illness created successfully with ID:', docRef.id)
      
      return createdIllness
    } catch (error) {
      console.error('🔥 DoctorStorage: Error creating illness:', error)
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
      
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (error) {
      console.error('DoctorStorage: Error getting illnesses by patient ID:', error)
      throw error
    }
  }
}

// Create singleton instance
const doctorStorageService = new DoctorStorageService()
export default doctorStorageService
