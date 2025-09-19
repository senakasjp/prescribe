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
      
      // Only include serializable fields to avoid Firebase errors
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
      
      // Only include serializable fields to avoid Firebase errors
      const serializableData = {
        email: updatedDoctor.email,
        firstName: updatedDoctor.firstName,
        lastName: updatedDoctor.lastName,
        name: updatedDoctor.name,
        country: updatedDoctor.country,
        city: updatedDoctor.city,
        role: updatedDoctor.role,
        isAdmin: updatedDoctor.isAdmin,
        permissions: updatedDoctor.permissions,
        connectedPharmacists: updatedDoctor.connectedPharmacists,
        uid: updatedDoctor.uid,
        displayName: updatedDoctor.displayName,
        photoURL: updatedDoctor.photoURL,
        provider: updatedDoctor.provider,
        updatedAt: new Date().toISOString()
      }
      
      // Remove undefined values
      Object.keys(serializableData).forEach(key => {
        if (serializableData[key] === undefined) {
          delete serializableData[key]
        }
      })
      
      await updateDoc(docRef, serializableData)
      return { id: updatedDoctor.id, ...serializableData }
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

  async deleteDoctor(doctorId) {
    try {
      console.log('🗑️ Starting doctor deletion process for:', doctorId)
      
      // First, get all patients belonging to this doctor
      console.log('🗑️ Step 1: Getting patients for doctor...')
      const patients = await this.getPatientsByDoctorId(doctorId)
      console.log('🗑️ Found patients to delete:', patients.length)
      
      // Delete all patients and their related data
      for (let i = 0; i < patients.length; i++) {
        const patient = patients[i]
        console.log(`🗑️ Step 2.${i + 1}: Deleting patient ${patient.id} (${patient.firstName} ${patient.lastName})`)
        
        try {
          // Delete prescriptions/medications
          console.log(`🗑️ Step 2.${i + 1}.1: Getting prescriptions for patient ${patient.id}`)
          const prescriptions = await this.getPrescriptionsByPatientId(patient.id)
          console.log(`🗑️ Found ${prescriptions.length} prescriptions to delete`)
          
          for (let j = 0; j < prescriptions.length; j++) {
            const prescription = prescriptions[j]
            console.log(`🗑️ Step 2.${i + 1}.1.${j + 1}: Deleting prescription ${prescription.id}`)
            await this.deleteMedication(prescription.id)
          }
          
          // Delete symptoms
          console.log(`🗑️ Step 2.${i + 1}.2: Getting symptoms for patient ${patient.id}`)
          const symptoms = await this.getSymptomsByPatientId(patient.id)
          console.log(`🗑️ Found ${symptoms.length} symptoms to delete`)
          
          for (let k = 0; k < symptoms.length; k++) {
            const symptom = symptoms[k]
            console.log(`🗑️ Step 2.${i + 1}.2.${k + 1}: Deleting symptom ${symptom.id}`)
            await deleteDoc(doc(db, this.collections.symptoms, symptom.id))
          }
          
          // Delete illnesses
          console.log(`🗑️ Step 2.${i + 1}.3: Getting illnesses for patient ${patient.id}`)
          const illnesses = await this.getIllnessesByPatientId(patient.id)
          console.log(`🗑️ Found ${illnesses.length} illnesses to delete`)
          
          for (let l = 0; l < illnesses.length; l++) {
            const illness = illnesses[l]
            console.log(`🗑️ Step 2.${i + 1}.3.${l + 1}: Deleting illness ${illness.id}`)
            await deleteDoc(doc(db, this.collections.illnesses, illness.id))
          }
          
          // Delete the patient
          console.log(`🗑️ Step 2.${i + 1}.4: Deleting patient ${patient.id}`)
          await deleteDoc(doc(db, this.collections.patients, patient.id))
          console.log(`✅ Patient ${patient.id} deleted successfully`)
          
        } catch (patientError) {
          console.error(`❌ Error deleting patient ${patient.id}:`, patientError)
          throw new Error(`Failed to delete patient ${patient.firstName} ${patient.lastName}: ${patientError.message}`)
        }
      }
      
      // Delete doctor's drug database entries
      console.log('🗑️ Step 3: Getting doctor drug database entries...')
      const doctorDrugs = await this.getDoctorDrugs(doctorId)
      console.log(`🗑️ Found ${doctorDrugs.length} drug entries to delete`)
      
      for (let m = 0; m < doctorDrugs.length; m++) {
        const drug = doctorDrugs[m]
        console.log(`🗑️ Step 3.${m + 1}: Deleting drug ${drug.id}`)
        await deleteDoc(doc(db, this.collections.drugDatabase, drug.id))
      }
      
      // Finally, delete the doctor
      console.log('🗑️ Step 4: Deleting doctor record...')
      await deleteDoc(doc(db, this.collections.doctors, doctorId))
      
      console.log('✅ Successfully deleted doctor and all related data:', doctorId)
      return true
    } catch (error) {
      console.error('❌ Error deleting doctor:', error)
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      })
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
      
      // Only include serializable fields to avoid Firebase errors
      const serializableData = {
        email: updatedPharmacist.email,
        businessName: updatedPharmacist.businessName,
        pharmacistNumber: updatedPharmacist.pharmacistNumber,
        role: updatedPharmacist.role,
        connectedDoctors: updatedPharmacist.connectedDoctors,
        uid: updatedPharmacist.uid,
        displayName: updatedPharmacist.displayName,
        photoURL: updatedPharmacist.photoURL,
        provider: updatedPharmacist.provider,
        updatedAt: new Date().toISOString()
      }
      
      // Remove undefined values
      Object.keys(serializableData).forEach(key => {
        if (serializableData[key] === undefined) {
          delete serializableData[key]
        }
      })
      
      await updateDoc(docRef, serializableData)
      return { id: updatedPharmacist.id, ...serializableData }
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
      // Get the current prescription
      const prescriptionRef = doc(db, this.collections.medications, prescriptionId)
      const prescriptionDoc = await getDoc(prescriptionRef)
      
      if (!prescriptionDoc.exists()) {
        throw new Error('Prescription not found')
      }
      
      const prescriptionData = prescriptionDoc.data()
      
      // Initialize medications array if it doesn't exist
      const medications = prescriptionData.medications || []
      
      // Add the new medication
      const newMedication = {
        ...medicationData,
        id: this.generateId(),
        createdAt: new Date().toISOString()
      }
      medications.push(newMedication)
      
      // Update the prescription with the new medications array
      await updateDoc(prescriptionRef, { 
        medications: medications,
        updatedAt: new Date().toISOString()
      })
      
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
      
      // Add pharmacist to doctor's connected pharmacists
      const updatedConnectedPharmacists = [...(doctor.connectedPharmacists || []), pharmacist.id]
      
      // Update both pharmacist and doctor
      await Promise.all([
        this.updatePharmacist({
          id: pharmacist.id,
          connectedDoctors: updatedConnectedDoctors
        }),
        this.updateDoctor({
          id: doctor.id,
          connectedPharmacists: updatedConnectedPharmacists
        })
      ])
      
      console.log('✅ Successfully connected pharmacist to doctor (both sides updated)')
      return pharmacist
      
    } catch (error) {
      console.error('Error connecting pharmacist to doctor:', error)
      throw error
    }
  }

  // Patient operations
  async createPatient(patientData) {
    try {
      console.log('🔍 FirebaseStorage: createPatient called with data:', patientData)
      
      // Validate required fields - only first name and age are mandatory
      if (!patientData.firstName || !patientData.firstName.trim()) {
        throw new Error('First name is required')
      }
      
      if (!patientData.age || !patientData.age.toString().trim()) {
        throw new Error('Age is required')
      }
      
      console.log('✅ FirebaseStorage: Required fields validation passed')

      // Filter out undefined values to prevent Firebase errors
      const cleanPatientData = Object.fromEntries(
        Object.entries(patientData).filter(([key, value]) => value !== undefined)
      )
      console.log('🔍 FirebaseStorage: Cleaned patient data:', cleanPatientData)

      const patient = {
        firstName: cleanPatientData.firstName?.trim() || '',
        lastName: cleanPatientData.lastName?.trim() || '',
        email: cleanPatientData.email?.trim() || '',
        phone: cleanPatientData.phone?.trim() || '',
        dateOfBirth: cleanPatientData.dateOfBirth || '',
        age: cleanPatientData.age?.toString().trim() || '',
        weight: cleanPatientData.weight?.trim() || '',
        bloodGroup: cleanPatientData.bloodGroup?.trim() || '',
        idNumber: cleanPatientData.idNumber?.trim() || '',
        address: cleanPatientData.address?.trim() || '',
        allergies: cleanPatientData.allergies?.trim() || '',
        emergencyContact: cleanPatientData.emergencyContact?.trim() || '',
        emergencyPhone: cleanPatientData.emergencyPhone?.trim() || '',
        doctorId: cleanPatientData.doctorId,
        createdAt: new Date().toISOString()
      }
      
      console.log('🔍 FirebaseStorage: Patient object to save:', patient)
      console.log('🔍 FirebaseStorage: Saving to collection:', this.collections.patients)

      const docRef = await addDoc(collection(db, this.collections.patients), patient)
      const result = { id: docRef.id, ...patient }
      console.log('✅ FirebaseStorage: Patient created successfully:', result)
      return result
    } catch (error) {
      console.error('❌ FirebaseStorage: Error creating patient:', error)
      console.error('❌ FirebaseStorage: Error stack:', error.stack)
      throw error
    }
  }

  async getPatients(doctorId) {
    try {
      console.log('🔍 FirebaseStorage: getPatients called with doctorId:', doctorId)
      
      if (!doctorId) {
        throw new Error('Doctor ID is required to access patients')
      }
      
      console.log('🔍 FirebaseStorage: Querying patients collection:', this.collections.patients)
      const q = query(
        collection(db, this.collections.patients), 
        where('doctorId', '==', doctorId)
      )
      
      console.log('🔍 FirebaseStorage: Executing query...')
      const querySnapshot = await getDocs(q)
      console.log('🔍 FirebaseStorage: Query returned', querySnapshot.docs.length, 'documents')
      
      const patients = querySnapshot.docs.map(doc => {
        const data = doc.data()
        console.log('🔍 FirebaseStorage: Patient document:', doc.id, data)
        return {
          id: doc.id,
          ...data
        }
      })
      
      // Sort by createdAt in JavaScript instead of Firestore
      patients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      console.log('✅ FirebaseStorage: Returning patients:', patients.length)
      return patients
    } catch (error) {
      console.error('❌ FirebaseStorage: Error getting patients:', error)
      console.error('❌ FirebaseStorage: Error stack:', error.stack)
      throw error
    }
  }

  async getPatientsByDoctorId(doctorId) {
    try {
      const q = query(
        collection(db, this.collections.patients), 
        where('doctorId', '==', doctorId)
      )
      const querySnapshot = await getDocs(q)
      
      const patients = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      // Sort by createdAt in JavaScript instead of Firestore
      patients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      return patients
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
        where('patientId', '==', patientId)
      )
      const querySnapshot = await getDocs(q)
      
      const illnesses = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      // Sort by createdAt in JavaScript instead of Firestore
      illnesses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      return illnesses
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
        medications: medicationData.medications || [], // Ensure medications array exists
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
        where('patientId', '==', patientId)
      )
      const querySnapshot = await getDocs(q)
      
      const prescriptions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      // Sort by createdAt in JavaScript instead of Firestore
      prescriptions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      return prescriptions
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
      console.log('🗑️ Firebase: Attempting to delete medication with ID:', medicationId)
      console.log('🗑️ Firebase: Collection path:', this.collections.medications)
      
      await deleteDoc(doc(db, this.collections.medications, medicationId))
      console.log('✅ Firebase: Successfully deleted medication:', medicationId)
      return true
    } catch (error) {
      console.error('❌ Firebase: Error deleting medication:', error)
      console.error('❌ Firebase: Medication ID was:', medicationId)
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
        where('patientId', '==', patientId)
      )
      const querySnapshot = await getDocs(q)
      
      const symptoms = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      // Sort by createdAt in JavaScript instead of Firestore
      symptoms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      return symptoms
    } catch (error) {
      console.error('Error getting symptoms by patient ID:', error)
      throw error
    }
  }

  async deleteSymptom(symptomId) {
    try {
      console.log('🗑️ Firebase: Attempting to delete symptom with ID:', symptomId)
      console.log('🗑️ Firebase: Collection path:', this.collections.symptoms)
      
      await deleteDoc(doc(db, this.collections.symptoms, symptomId))
      console.log('✅ Firebase: Successfully deleted symptom:', symptomId)
      return true
    } catch (error) {
      console.error('❌ Firebase: Error deleting symptom:', error)
      console.error('❌ Firebase: Symptom ID was:', symptomId)
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
      // Simple query without orderBy to avoid requiring composite index
      const q = query(
        collection(db, this.collections.drugDatabase), 
        where('doctorId', '==', doctorId)
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

  // Drug Stock Management Functions
  
  // Get drug stock for a pharmacist
  async getPharmacistDrugStock(pharmacistId) {
    try {
      console.log('📦 Firebase: Getting drug stock for pharmacist:', pharmacistId)
      
      const stockRef = collection(db, 'pharmacistStock')
      const q = query(stockRef, where('pharmacistId', '==', pharmacistId))
      const querySnapshot = await getDocs(q)
      
      const stockItems = []
      querySnapshot.forEach((doc) => {
        stockItems.push({
          id: doc.id,
          ...doc.data()
        })
      })
      
      console.log('📦 Firebase: Found', stockItems.length, 'stock items')
      return stockItems
      
    } catch (error) {
      console.error('❌ Error getting pharmacist drug stock:', error)
      throw error
    }
  }
  
  // Add a new stock item for a pharmacist
  async addPharmacistStockItem(pharmacistId, stockItemData) {
    try {
      console.log('📦 Firebase: Adding stock item for pharmacist:', pharmacistId)
      console.log('📦 Firebase: Stock item data:', stockItemData)
      
      const stockRef = collection(db, 'pharmacistStock')
      const docRef = await addDoc(stockRef, {
        ...stockItemData,
        pharmacistId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      
      console.log('📦 Firebase: Stock item added with ID:', docRef.id)
      return docRef.id
      
    } catch (error) {
      console.error('❌ Error adding stock item:', error)
      throw error
    }
  }
  
  // Update a stock item
  async updatePharmacistStockItem(pharmacistId, stockItemId, stockItemData) {
    try {
      console.log('📦 Firebase: Updating stock item:', stockItemId)
      
      const stockRef = doc(db, 'pharmacistStock', stockItemId)
      await updateDoc(stockRef, {
        ...stockItemData,
        pharmacistId,
        updatedAt: new Date().toISOString()
      })
      
      console.log('📦 Firebase: Stock item updated successfully')
      
    } catch (error) {
      console.error('❌ Error updating stock item:', error)
      throw error
    }
  }
  
  // Delete a stock item
  async deletePharmacistStockItem(pharmacistId, stockItemId) {
    try {
      console.log('📦 Firebase: Deleting stock item:', stockItemId)
      
      const stockRef = doc(db, 'pharmacistStock', stockItemId)
      await deleteDoc(stockRef)
      
      console.log('📦 Firebase: Stock item deleted successfully')
      
    } catch (error) {
      console.error('❌ Error deleting stock item:', error)
      throw error
    }
  }
}

// Create singleton instance
const firebaseStorageService = new FirebaseStorageService()

export default firebaseStorageService
