// Firebase Firestore Database Service
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  setDoc,
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  writeBatch,
  onSnapshot
} from 'firebase/firestore'
import { db } from '../firebase-config.js'
import { formatPharmacyId } from '../utils/idFormat.js'
import { capitalizePatientNames } from '../utils/nameUtils.js'
import { resolveCurrencyFromCountry } from '../utils/currencyByCountry.js'

class FirebaseStorageService {
  constructor() {
    this.collections = {
      doctors: 'doctors',
      patients: 'patients',
      illnesses: 'illnesses',
      medications: 'medications',
      symptoms: 'symptoms',
      longTermMedications: 'longTermMedications',
      drugDatabase: 'drugDatabase',
      pharmacists: 'pharmacists',
      pharmacyUsers: 'pharmacyUsers',
      doctorReports: 'doctorReports',
      reports: 'reports',
      systemSettings: 'systemSettings'
    }
  }

  // Generate unique ID (Firebase will generate its own, but keeping for compatibility)
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  generateDeleteCode() {
    return String(Math.floor(100000 + Math.random() * 900000))
  }

  formatDoctorId(rawId) {
    if (!rawId) return ''
    const input = String(rawId)
    let hash = 5381
    for (let i = 0; i < input.length; i += 1) {
      hash = ((hash << 5) + hash) + input.charCodeAt(i)
      hash &= 0xffffffff
    }
    const numeric = Math.abs(hash >>> 0) % 100000
    const padded = String(numeric).padStart(5, '0')
    return `DR${padded}`
  }

  generateReferralCode() {
    const raw = Math.random().toString(36).replace(/[^a-z0-9]/g, '')
    return raw.slice(0, 8).toUpperCase()
  }

  normalizeEmail(email) {
    return String(email || '').trim().toLowerCase()
  }

  // Doctor operations
  async createDoctor(doctorData) {
    try {
      console.log('🔥 Firebase: Creating doctor in collection:', this.collections.doctors)
      console.log('🔥 Firebase: Doctor data to save:', doctorData)
      
      const normalizedEmail = this.normalizeEmail(doctorData.email)
      if (!normalizedEmail) {
        throw new Error('Email is required')
      }

      const existing = await this.getDoctorByEmail(normalizedEmail)
      if (existing) {
        throw new Error('Doctor with this email already exists')
      }

      let referralCode = doctorData.referralCode
      if (!referralCode) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const candidate = this.generateReferralCode()
          const existingCode = await this.getDoctorByReferralCode(candidate)
          if (!existingCode) {
            referralCode = candidate
            break
          }
        }
      }

      // Only include serializable fields to avoid Firebase errors
      const serializableData = {
        email: normalizedEmail,
        emailLower: normalizedEmail,
        username: doctorData.username,
        firstName: doctorData.firstName,
        lastName: doctorData.lastName,
        name: doctorData.name,
        country: doctorData.country,
        city: doctorData.city,
        currency: doctorData.currency || resolveCurrencyFromCountry(doctorData.country) || 'USD',
        roundingPreference: doctorData.roundingPreference,
        role: doctorData.role,
        isAdmin: doctorData.isAdmin,
        permissions: doctorData.permissions,
        phone: doctorData.phone,
        phoneCountryCode: doctorData.phoneCountryCode,
        specialization: doctorData.specialization,
        externalDoctor: doctorData.externalDoctor,
        accessLevel: doctorData.accessLevel,
        invitedByDoctorId: doctorData.invitedByDoctorId,
        referredByDoctorId: doctorData.referredByDoctorId,
        referralEligibleAt: doctorData.referralEligibleAt,
        referralBonusApplied: doctorData.referralBonusApplied,
        referralBonusAppliedAt: doctorData.referralBonusAppliedAt,
        referralCode: referralCode,
        authProvider: doctorData.authProvider,
        connectedPharmacists: doctorData.connectedPharmacists || [],
        allowedDeviceId: doctorData.allowedDeviceId,
        isDisabled: doctorData.isDisabled ?? false,
        isApproved: doctorData.isApproved ?? true,
        accessExpiresAt: doctorData.accessExpiresAt || null,
        uid: doctorData.uid,
        displayName: doctorData.displayName,
        photoURL: doctorData.photoURL,
        provider: doctorData.provider,
        deleteCode: doctorData.deleteCode || this.generateDeleteCode(),
        createdAt: new Date().toISOString()
      }
      
      // Remove undefined values
      Object.keys(serializableData).forEach(key => {
        if (serializableData[key] === undefined) {
          delete serializableData[key]
        }
      })
      
      const docRef = await addDoc(collection(db, this.collections.doctors), serializableData)
      
      const doctorIdShort = this.formatDoctorId(docRef.id)
      await updateDoc(docRef, { doctorIdShort })
      const createdDoctor = { id: docRef.id, ...serializableData, doctorIdShort }
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
      const rawEmail = String(email || '').trim()
      const normalizedEmail = this.normalizeEmail(rawEmail)
      if (!normalizedEmail) {
        return null
      }
      let querySnapshot = await getDocs(
        query(
          collection(db, this.collections.doctors),
          where('emailLower', '==', normalizedEmail)
        )
      )
      if (querySnapshot.empty) {
        querySnapshot = await getDocs(
          query(
            collection(db, this.collections.doctors),
            where('email', '==', normalizedEmail)
          )
        )
      }
      if (querySnapshot.empty && rawEmail && rawEmail !== normalizedEmail) {
        querySnapshot = await getDocs(
          query(
            collection(db, this.collections.doctors),
            where('email', '==', rawEmail)
          )
        )
      }
      
      if (querySnapshot.empty) {
        return null
      }
      
      const doc = querySnapshot.docs[0]
      const data = doc.data()
      if (!data.doctorIdShort) {
        data.doctorIdShort = this.formatDoctorId(doc.id)
        await updateDoc(doc.ref, { doctorIdShort: data.doctorIdShort })
      }
      if (!data.deleteCode) {
        const deleteCode = this.generateDeleteCode()
        await updateDoc(doc.ref, { deleteCode })
        data.deleteCode = deleteCode
      }
      if (!data.currency) {
        const resolvedCurrency = resolveCurrencyFromCountry(data.country)
        if (resolvedCurrency) {
          data.currency = resolvedCurrency
        }
      }
      return { id: doc.id, ...data }
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
        const data = docSnap.data()
        if (!data.doctorIdShort) {
          data.doctorIdShort = this.formatDoctorId(docSnap.id)
          await updateDoc(docRef, { doctorIdShort: data.doctorIdShort })
        }
        if (!data.deleteCode) {
          const deleteCode = this.generateDeleteCode()
          await updateDoc(docRef, { deleteCode })
          data.deleteCode = deleteCode
        }
        if (!data.currency) {
          const resolvedCurrency = resolveCurrencyFromCountry(data.country)
          if (resolvedCurrency) {
            data.currency = resolvedCurrency
          }
        }
        return { id: docSnap.id, ...data }
      }
      return null
    } catch (error) {
      console.error('Error getting doctor by ID:', error)
      throw error
    }
  }

  async getDoctorByShortId(shortId) {
    try {
      const normalized = String(shortId || '').trim().toUpperCase()
      if (!normalized) return null
      const q = query(
        collection(db, this.collections.doctors),
        where('doctorIdShort', '==', normalized),
        limit(1)
      )
      const snapshot = await getDocs(q)
      if (snapshot.empty) return null
      const docSnap = snapshot.docs[0]
      const data = docSnap.data()
      if (!data.doctorIdShort) {
        data.doctorIdShort = this.formatDoctorId(docSnap.id)
        await updateDoc(docSnap.ref, { doctorIdShort: data.doctorIdShort })
      }
      if (!data.deleteCode) {
        const deleteCode = this.generateDeleteCode()
        await updateDoc(docSnap.ref, { deleteCode })
        data.deleteCode = deleteCode
      }
      if (!data.currency) {
        const resolvedCurrency = resolveCurrencyFromCountry(data.country)
        if (resolvedCurrency) {
          data.currency = resolvedCurrency
        }
      }
      return { id: docSnap.id, ...data }
    } catch (error) {
      console.error('Error getting doctor by short ID:', error)
      throw error
    }
  }

  async getDoctorByReferralCode(code) {
    try {
      const normalized = String(code || '').trim().toUpperCase()
      if (!normalized) return null
      const doctorsRef = collection(db, this.collections.doctors)
      const q = query(doctorsRef, where('referralCode', '==', normalized), limit(1))
      const snapshot = await getDocs(q)
      if (snapshot.empty) return null
      const docSnap = snapshot.docs[0]
      const data = docSnap.data()
      return { id: docSnap.id, ...data }
    } catch (error) {
      console.error('Error getting doctor by referral code:', error)
      throw error
    }
  }

  async updateDoctor(updatedDoctor) {
    try {
      const docRef = doc(db, this.collections.doctors, updatedDoctor.id)
      
      // Only include serializable fields to avoid Firebase errors
      const serializableData = {
        email: updatedDoctor.email,
        emailLower: updatedDoctor.email ?
          String(updatedDoctor.email).trim().toLowerCase() :
          undefined,
        username: updatedDoctor.username,
        firstName: updatedDoctor.firstName,
        lastName: updatedDoctor.lastName,
        name: updatedDoctor.name,
        country: updatedDoctor.country,
        city: updatedDoctor.city,
        consultationCharge: updatedDoctor.consultationCharge,
        hospitalCharge: updatedDoctor.hospitalCharge,
        currency: updatedDoctor.currency,
        roundingPreference: updatedDoctor.roundingPreference,
        role: updatedDoctor.role,
        isAdmin: updatedDoctor.isAdmin,
        permissions: updatedDoctor.permissions,
        phone: updatedDoctor.phone,
        phoneCountryCode: updatedDoctor.phoneCountryCode,
        specialization: updatedDoctor.specialization,
        externalDoctor: updatedDoctor.externalDoctor,
        accessLevel: updatedDoctor.accessLevel,
        invitedByDoctorId: updatedDoctor.invitedByDoctorId,
        authProvider: updatedDoctor.authProvider,
        connectedPharmacists: updatedDoctor.connectedPharmacists,
        deleteCode: updatedDoctor.deleteCode,
        allowedDeviceId: updatedDoctor.allowedDeviceId,
        isDisabled: updatedDoctor.isDisabled,
        isApproved: updatedDoctor.isApproved,
        accessExpiresAt: updatedDoctor.accessExpiresAt,
        referredByDoctorId: updatedDoctor.referredByDoctorId,
        referralEligibleAt: updatedDoctor.referralEligibleAt,
        referralBonusApplied: updatedDoctor.referralBonusApplied,
        referralBonusAppliedAt: updatedDoctor.referralBonusAppliedAt,
        referralCode: updatedDoctor.referralCode,
        doctorIdShort: updatedDoctor.doctorIdShort,
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
      // Get all doctors without orderBy to avoid index requirement
      const q = query(collection(db, this.collections.doctors))
      const querySnapshot = await getDocs(q)
      
      const doctors = querySnapshot.docs.map(doc => {
        const data = doc.data()
        if (!data.currency) {
          const resolvedCurrency = resolveCurrencyFromCountry(data.country)
          if (resolvedCurrency) {
            data.currency = resolvedCurrency
          }
        }
        return {
          id: doc.id,
          ...data
        }
      })
      
      // Sort in JavaScript instead of Firestore to avoid index requirement
      doctors.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0)
        const dateB = new Date(b.createdAt || 0)
        return dateB - dateA // Descending order
      })
      
      return doctors
    } catch (error) {
      console.error('Error getting all doctors:', error)
      throw error
    }
  }

  async addAuthLog(entry = {}) {
    try {
      const logsRef = collection(db, 'authLogs')
      await addDoc(logsRef, {
        ...entry,
        createdAt: new Date().toISOString()
      })

      const allSnapshot = await getDocs(
        query(logsRef, orderBy('createdAt', 'desc'))
      )
      if (allSnapshot.size > 500) {
        const batch = writeBatch(db)
        allSnapshot.docs.slice(500).forEach(docSnap => batch.delete(docSnap.ref))
        await batch.commit()
      }
      return true
    } catch (error) {
      console.error('❌ Error adding auth log:', error)
      return false
    }
  }

  async getAuthLogs(limitCount = 200) {
    try {
      const q = query(
        collection(db, 'authLogs'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      )
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }))
    } catch (error) {
      console.error('❌ Error getting auth logs:', error)
      throw error
    }
  }

  async getExternalDoctorsByOwnerId(ownerDoctorId) {
    try {
      const q = query(
        collection(db, this.collections.doctors),
        where('invitedByDoctorId', '==', ownerDoctorId),
        where('externalDoctor', '==', true)
      )
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('Error getting external doctors by owner ID:', error)
      throw error
    }
  }

  async deleteDoctor(doctorId, options = {}) {
    try {
      console.log('🗑️ Starting doctor deletion process for:', doctorId)

      if (options.skipPatientCleanup) {
        await deleteDoc(doc(db, this.collections.doctors, doctorId))
        console.log('✅ Doctor deleted without patient cleanup:', doctorId)
        return true
      }
      
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
        deleteCode: pharmacistData.deleteCode || this.generateDeleteCode(),
        createdAt: new Date().toISOString()
      }
      
      const docRef = await addDoc(collection(db, this.collections.pharmacists), pharmacist)
      const pharmacyIdShort = formatPharmacyId(docRef.id)
      await updateDoc(docRef, { pharmacyIdShort })
      const createdPharmacist = { id: docRef.id, ...pharmacist, pharmacyIdShort }
      
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
      const data = doc.data()
      if (!data.deleteCode) {
        const deleteCode = this.generateDeleteCode()
        await updateDoc(doc.ref, { deleteCode })
        data.deleteCode = deleteCode
      }
      if (!data.pharmacyIdShort) {
        const pharmacyIdShort = formatPharmacyId(doc.id)
        await updateDoc(doc.ref, { pharmacyIdShort })
        data.pharmacyIdShort = pharmacyIdShort
      }
      return { id: doc.id, ...data }
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
        const data = docSnap.data()
        if (!data.deleteCode) {
          const deleteCode = this.generateDeleteCode()
          await updateDoc(docRef, { deleteCode })
          data.deleteCode = deleteCode
        }
        if (!data.pharmacyIdShort) {
          const pharmacyIdShort = formatPharmacyId(docSnap.id)
          await updateDoc(docRef, { pharmacyIdShort })
          data.pharmacyIdShort = pharmacyIdShort
        }
        return { id: docSnap.id, ...data }
      }
      return null
    } catch (error) {
      console.error('Error getting pharmacist by ID:', error)
      throw error
    }
  }

  async getPharmacistByNumber(pharmacistNumber) {
    try {
      const normalizedNumber = String(pharmacistNumber || '').trim().toUpperCase()
      console.log('🔍 Searching for pharmacist number in Firebase:', normalizedNumber)
      
      const q = query(collection(db, this.collections.pharmacists), where('pharmacistNumber', '==', normalizedNumber))
      const querySnapshot = await getDocs(q)
      
      if (querySnapshot.empty) {
        if (normalizedNumber.startsWith('PH')) {
          const byShortIdQuery = query(
            collection(db, this.collections.pharmacists),
            where('pharmacyIdShort', '==', normalizedNumber)
          )
          const byShortIdSnapshot = await getDocs(byShortIdQuery)
          if (!byShortIdSnapshot.empty) {
            const docSnap = byShortIdSnapshot.docs[0]
            const data = docSnap.data()
            return { id: docSnap.id, ...data }
          }
        }

        const allPharmacists = await this.getAllPharmacists()
        const normalizedDigits = normalizedNumber.replace(/^PH/, '').replace(/^0+/, '')
        const match = allPharmacists.find(pharmacist => {
          if (!pharmacist?.id) return false
          const pharmacistNumberValue = String(pharmacist.pharmacistNumber || '').trim().toUpperCase()
          if (pharmacistNumberValue && pharmacistNumberValue === normalizedNumber) return true
          if (pharmacistNumberValue && pharmacistNumberValue === normalizedDigits) return true
          const formattedId = formatPharmacyId(pharmacist.id).toUpperCase()
          const formattedDigits = formattedId.replace(/^PH/, '').replace(/^0+/, '')
          if (formattedId === normalizedNumber || formattedDigits === normalizedDigits) return true
          return false
        })
        if (match) {
          if (!match.pharmacyIdShort) {
            const pharmacyIdShort = formatPharmacyId(match.id)
            await updateDoc(doc(db, this.collections.pharmacists, match.id), { pharmacyIdShort })
            match.pharmacyIdShort = pharmacyIdShort
          }
          console.log('✅ Found pharmacist by fallback lookup:', match.businessName, 'with id:', match.id)
          return match
        }
        console.log('❌ Pharmacist not found with number:', normalizedNumber)
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

  // Pharmacy user operations (additional users for a pharmacy account)
  async createPharmacyUser(pharmacyUserData) {
    try {
      console.log('🏥 Creating pharmacy user with Firebase:', pharmacyUserData)

      if (!pharmacyUserData?.pharmacyId) {
        throw new Error('Pharmacy ID is required to create a pharmacy user')
      }
      if (!pharmacyUserData?.email || !pharmacyUserData?.password) {
        throw new Error('Email and password are required to create a pharmacy user')
      }

      const existingPharmacist = await this.getPharmacistByEmail(pharmacyUserData.email)
      if (existingPharmacist) {
        throw new Error('User with this email already exists')
      }
      const existingPharmacyUser = await this.getPharmacyUserByEmail(pharmacyUserData.email)
      if (existingPharmacyUser) {
        throw new Error('User with this email already exists')
      }

      const pharmacyUser = {
        email: pharmacyUserData.email,
        password: pharmacyUserData.password,
        firstName: pharmacyUserData.firstName || '',
        lastName: pharmacyUserData.lastName || '',
        role: 'pharmacist',
        pharmacyId: pharmacyUserData.pharmacyId,
        pharmacyName: pharmacyUserData.pharmacyName || '',
        pharmacistNumber: pharmacyUserData.pharmacistNumber || '',
        status: pharmacyUserData.status || 'active',
        createdBy: pharmacyUserData.createdBy || '',
        createdAt: new Date().toISOString(),
        isPharmacyUser: true
      }

      const docRef = await addDoc(collection(db, this.collections.pharmacyUsers), pharmacyUser)
      const createdPharmacyUser = { id: docRef.id, ...pharmacyUser }

      console.log('🏥 Created pharmacy user in Firebase:', createdPharmacyUser)
      return createdPharmacyUser
    } catch (error) {
      console.error('Error creating pharmacy user:', error)
      throw error
    }
  }

  async getPharmacyUserByEmail(email) {
    try {
      const q = query(collection(db, this.collections.pharmacyUsers), where('email', '==', email))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        return null
      }

      const doc = querySnapshot.docs[0]
      return { id: doc.id, ...doc.data() }
    } catch (error) {
      console.error('Error getting pharmacy user by email:', error)
      throw error
    }
  }

  async getPharmacyUsersByPharmacyId(pharmacyId) {
    try {
      const q = query(
        collection(db, this.collections.pharmacyUsers),
        where('pharmacyId', '==', pharmacyId)
      )
      const querySnapshot = await getDocs(q)

      const users = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      users.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      return users
    } catch (error) {
      console.error('Error getting pharmacy users by pharmacy ID:', error)
      throw error
    }
  }

  async updatePharmacyUser(pharmacyUserId, updateData) {
    try {
      const docRef = doc(db, this.collections.pharmacyUsers, pharmacyUserId)
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date().toISOString()
      })
      console.log('Pharmacy user updated successfully')
    } catch (error) {
      console.error('Error updating pharmacy user:', error)
      throw error
    }
  }

  async updatePharmacist(updatedPharmacist) {
    try {
      console.log('Firebase: Starting pharmacist update for ID:', updatedPharmacist.id)
      console.log('Firebase: Received pharmacist data:', updatedPharmacist)
      
      // Validate the pharmacist ID first
      if (!updatedPharmacist.id || typeof updatedPharmacist.id !== 'string') {
        throw new Error('Invalid pharmacist ID: ' + updatedPharmacist.id)
      }
      
      console.log('Firebase: Creating document reference...')
      const docRef = doc(db, this.collections.pharmacists, updatedPharmacist.id)
      console.log('Firebase: Document reference created:', docRef)
      
      // Check if document exists first
      const docSnapshot = await getDoc(docRef)
      if (!docSnapshot.exists()) {
        throw new Error(`Pharmacist document with ID ${updatedPharmacist.id} does not exist`)
      }
      console.log('Firebase: Document exists, proceeding with update')
      
      // Only include serializable fields to avoid Firebase errors
      let serializableData = {
        email: updatedPharmacist.email ? String(updatedPharmacist.email).trim() : '',
        businessName: updatedPharmacist.businessName ? String(updatedPharmacist.businessName).trim() : '',
        pharmacistNumber: updatedPharmacist.pharmacistNumber ? String(updatedPharmacist.pharmacistNumber).trim() : '',
        role: updatedPharmacist.role ? String(updatedPharmacist.role).trim() : 'pharmacist',
        connectedDoctors: Array.isArray(updatedPharmacist.connectedDoctors) ? updatedPharmacist.connectedDoctors : [],
        country: updatedPharmacist.country ? String(updatedPharmacist.country).trim() : '',
        city: updatedPharmacist.city ? String(updatedPharmacist.city).trim() : '',
        currency: updatedPharmacist.currency ? String(updatedPharmacist.currency).trim() : 'USD',
        uid: updatedPharmacist.uid ? String(updatedPharmacist.uid).trim() : '',
        displayName: updatedPharmacist.displayName ? String(updatedPharmacist.displayName).trim() : '',
        photoURL: updatedPharmacist.photoURL ? String(updatedPharmacist.photoURL).trim() : '',
        provider: updatedPharmacist.provider ? String(updatedPharmacist.provider).trim() : '',
        updatedAt: new Date().toISOString()
      }
      
      // Remove undefined and null values, and ensure string fields are not empty
      Object.keys(serializableData).forEach(key => {
        if (serializableData[key] === undefined || serializableData[key] === null) {
          delete serializableData[key]
        } else if (typeof serializableData[key] === 'string' && serializableData[key].trim() === '') {
          delete serializableData[key]
        } else if (typeof serializableData[key] === 'object' && serializableData[key] !== null && !Array.isArray(serializableData[key])) {
          // Remove non-array objects that might cause serialization issues
          delete serializableData[key]
        }
      })
      
      // Additional safety check - ensure all remaining values are Firebase-serializable
      const safeData = {}
      Object.keys(serializableData).forEach(key => {
        const value = serializableData[key]
        if (value !== undefined && value !== null) {
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || Array.isArray(value)) {
            safeData[key] = value
          } else {
            console.warn(`Firebase: Skipping non-serializable field ${key}:`, value)
          }
        }
      })
      
      serializableData = safeData
      
      console.log('Firebase: Cleaned data to send:', serializableData)
      
      // Final validation before sending to Firebase
      if (!serializableData.id && !updatedPharmacist.id) {
        throw new Error('Pharmacist ID is required for update')
      }
      
      // Ensure we have at least some data to update
      if (Object.keys(serializableData).length === 0) {
        throw new Error('No valid data to update')
      }
      
      // Try with absolute minimal data and different approach
      console.log('Firebase: Document reference:', docRef)
      console.log('Firebase: Pharmacist ID:', updatedPharmacist.id)
      
      // Try using setDoc with merge instead of updateDoc
      console.log('Firebase: Attempting to use setDoc with merge...')
      
      const updateData = {
        businessName: updatedPharmacist.businessName ? String(updatedPharmacist.businessName) : undefined,
        country: updatedPharmacist.country ? String(updatedPharmacist.country) : undefined,
        city: updatedPharmacist.city ? String(updatedPharmacist.city) : undefined,
        currency: updatedPharmacist.currency ? String(updatedPharmacist.currency) : undefined,
        pharmacistNumber: updatedPharmacist.pharmacistNumber ? String(updatedPharmacist.pharmacistNumber) : undefined,
        email: updatedPharmacist.email ? String(updatedPharmacist.email) : undefined,
        connectedDoctors: Array.isArray(updatedPharmacist.connectedDoctors) ? updatedPharmacist.connectedDoctors : undefined,
        updatedAt: new Date().toISOString()
      }

      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key]
        }
      })
      
      console.log('Firebase: Update data prepared:', updateData)
      
      // Use setDoc with merge: true instead of updateDoc
      await setDoc(docRef, updateData, { merge: true })
      console.log('Firebase: Successfully updated using setDoc with merge')
      
      return { 
        id: updatedPharmacist.id, 
        ...updateData
      }
    } catch (error) {
      console.error('Error updating pharmacist:', error)
      throw error
    }
  }

  // Update patient
  async updatePatient(patientId, updatedPatientData) {
    try {
      console.log('👤 Updating patient:', patientId)
      
      // Capitalize names before updating
      const capitalizedPatientData = capitalizePatientNames(updatedPatientData)
      console.log('🔍 FirebaseStorage: Capitalized patient update data:', capitalizedPatientData)
      
      const patientRef = doc(db, this.collections.patients, patientId)
      await updateDoc(patientRef, capitalizedPatientData)
      console.log('✅ Patient updated successfully')
      return { id: patientId, ...capitalizedPatientData }
    } catch (error) {
      console.error('Error updating patient:', error)
      throw error
    }
  }

  async deletePatient(patientId) {
    try {
      console.log('🗑️ Firebase: Deleting patient and related data:', patientId)

      const prescriptions = await this.getPrescriptionsByPatientId(patientId)
      for (const prescription of prescriptions) {
        await this.deleteMedication(prescription.id)
      }

      const symptoms = await this.getSymptomsByPatientId(patientId)
      for (const symptom of symptoms) {
        await deleteDoc(doc(db, this.collections.symptoms, symptom.id))
      }

      const illnesses = await this.getIllnessesByPatientId(patientId)
      for (const illness of illnesses) {
        await deleteDoc(doc(db, this.collections.illnesses, illness.id))
      }

      const longTermMedications = await this.getLongTermMedicationsByPatientId(patientId)
      for (const medication of longTermMedications) {
        await deleteDoc(doc(db, this.collections.longTermMedications, medication.id))
      }

      await deleteDoc(doc(db, this.collections.patients, patientId))
      console.log('✅ Firebase: Patient deleted successfully:', patientId)
      return true
    } catch (error) {
      console.error('❌ Firebase: Error deleting patient:', error)
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

  async connectPharmacistToDoctor(pharmacistNumber, doctorIdentifier, options = {}) {
    try {
      console.log('🔍 Looking for pharmacist with number in Firebase:', pharmacistNumber)
      
      let pharmacist = await this.getPharmacistByNumber(pharmacistNumber)
      if (!pharmacist && options?.isOwnPharmacy && doctorIdentifier) {
        console.log('🔍 Pharmacist not found by number, trying email for own pharmacy...')
        pharmacist = await this.getPharmacistByEmail(doctorIdentifier)
      }
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

      // Capitalize names before saving
      const capitalizedPatientData = capitalizePatientNames(cleanPatientData)
      console.log('🔍 FirebaseStorage: Capitalized patient data:', capitalizedPatientData)

      const patient = {
        firstName: capitalizedPatientData.firstName?.trim() || '',
        lastName: capitalizedPatientData.lastName?.trim() || '',
        email: capitalizedPatientData.email?.trim() || '',
        phone: capitalizedPatientData.phone?.trim() || '',
        phoneCountryCode: capitalizedPatientData.phoneCountryCode?.trim() || '',
        gender: capitalizedPatientData.gender?.trim() || '',
        dateOfBirth: capitalizedPatientData.dateOfBirth || '',
        age: capitalizedPatientData.age?.toString().trim() || '',
        ageType: capitalizedPatientData.ageType?.toString().trim() || '',
        weight: capitalizedPatientData.weight?.toString().trim() || '',
        bloodGroup: capitalizedPatientData.bloodGroup?.trim() || '',
        idNumber: capitalizedPatientData.idNumber?.trim() || '',
        address: capitalizedPatientData.address?.trim() || '',
        allergies: capitalizedPatientData.allergies?.trim() || '',
        disableNotifications: Boolean(capitalizedPatientData.disableNotifications),
        emergencyContact: capitalizedPatientData.emergencyContact?.trim() || '',
        emergencyPhone: capitalizedPatientData.emergencyPhone?.trim() || '',
        doctorId: capitalizedPatientData.doctorId,
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

  async getPrescriptionsByDoctorId(doctorId) {
    try {
      console.log('🔥 Firebase: Getting prescriptions for doctor ID:', doctorId)
      console.log('🔥 Firebase: Using collection:', this.collections.medications)
      
      const q = query(
        collection(db, this.collections.medications), 
        where('doctorId', '==', doctorId)
      )
      const querySnapshot = await getDocs(q)
      
      console.log('🔥 Firebase: Query snapshot size:', querySnapshot.size)
      console.log('🔥 Firebase: Query snapshot docs:', querySnapshot.docs.length)
      
      const prescriptions = querySnapshot.docs.map(doc => {
        const data = doc.data()
        console.log('🔥 Firebase: Prescription doc:', doc.id, data)
        return {
          id: doc.id,
          ...data
        }
      })
      
      // Deduplicate prescriptions by ID, keeping the most recent one
      const uniquePrescriptions = new Map()
      prescriptions.forEach(prescription => {
        const existing = uniquePrescriptions.get(prescription.id)
        if (!existing || new Date(prescription.createdAt) > new Date(existing.createdAt)) {
          uniquePrescriptions.set(prescription.id, prescription)
        }
      })
      const deduplicatedPrescriptions = Array.from(uniquePrescriptions.values())
      
      // Sort by createdAt in JavaScript instead of Firestore
      deduplicatedPrescriptions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      console.log('🔥 Firebase: Found prescriptions (before deduplication):', prescriptions.length)
      console.log('🔥 Firebase: Found prescriptions (after deduplication):', deduplicatedPrescriptions.length)
      console.log('🔥 Firebase: Prescriptions data:', deduplicatedPrescriptions)
      return deduplicatedPrescriptions
    } catch (error) {
      console.error('❌ Firebase: Error getting prescriptions by doctor ID:', error)
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

  // Clear all medications from a prescription
  async clearPrescriptionMedications(prescriptionId) {
    try {
      console.log('🗑️ Firebase: Clearing medications from prescription:', prescriptionId)
      
      const prescriptionRef = doc(db, this.collections.medications, prescriptionId)
      const prescriptionDoc = await getDoc(prescriptionRef)
      
      if (!prescriptionDoc.exists()) {
        console.log('⚠️ Firebase: Prescription not found:', prescriptionId)
        return false
      }
      
      // Update the prescription to clear the medications array
      await updateDoc(prescriptionRef, { 
        medications: [],
        updatedAt: new Date().toISOString()
      })
      
      console.log('✅ Firebase: Successfully cleared medications from prescription:', prescriptionId)
      return true
    } catch (error) {
      console.error('❌ Firebase: Error clearing prescription medications:', error)
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

  // Long-term medications operations
  async createLongTermMedication(longTermMedicationData) {
    try {
      console.log('💊 Creating long-term medication:', longTermMedicationData)
      
      const longTermMedication = {
        ...longTermMedicationData,
        createdAt: new Date().toISOString()
      }
      
      const docRef = await addDoc(collection(db, this.collections.longTermMedications), longTermMedication)
      const newMedication = { id: docRef.id, ...longTermMedication }
      
      console.log('✅ Long-term medication created:', newMedication.id)
      return newMedication
    } catch (error) {
      console.error('❌ Error creating long-term medication:', error)
      throw error
    }
  }

  async getLongTermMedicationsByPatientId(patientId) {
    try {
      console.log('🔍 Getting long-term medications for patient:', patientId)
      
      const q = query(
        collection(db, this.collections.longTermMedications),
        where('patientId', '==', patientId)
      )
      
      const querySnapshot = await getDocs(q)
      const medications = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      // Sort by createdAt in JavaScript instead of Firestore
      medications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      console.log('✅ Loaded long-term medications:', medications.length)
      return medications
    } catch (error) {
      console.error('❌ Error getting long-term medications:', error)
      throw error
    }
  }

  async updateLongTermMedication(medicationId, updatedData) {
    try {
      console.log('💊 Updating long-term medication:', medicationId, updatedData)
      
      const medicationRef = doc(db, this.collections.longTermMedications, medicationId)
      await updateDoc(medicationRef, {
        ...updatedData,
        updatedAt: new Date().toISOString()
      })
      
      console.log('✅ Long-term medication updated:', medicationId)
      return true
    } catch (error) {
      console.error('❌ Error updating long-term medication:', error)
      throw error
    }
  }

  async deleteLongTermMedication(medicationId) {
    try {
      console.log('🗑️ Deleting long-term medication:', medicationId)
      
      const medicationRef = doc(db, this.collections.longTermMedications, medicationId)
      await deleteDoc(medicationRef)
      
      console.log('✅ Long-term medication deleted:', medicationId)
      return true
    } catch (error) {
      console.error('❌ Error deleting long-term medication:', error)
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

  onPharmacistPrescriptionsChange(pharmacistId, callback) {
    if (!pharmacistId) {
      return () => {}
    }

    const pharmacistRef = doc(db, this.collections.pharmacists, pharmacistId)
    const prescriptionsRef = collection(pharmacistRef, 'receivedPrescriptions')

    return onSnapshot(prescriptionsRef, (querySnapshot) => {
      const prescriptions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      const sorted = prescriptions.sort((a, b) => {
        const dateA = new Date(a.receivedAt || a.sentAt || 0)
        const dateB = new Date(b.receivedAt || b.sentAt || 0)
        return dateB - dateA
      })

      callback(sorted)
    })
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

  // Doctor reports caching
  async getDoctorReport(doctorId) {
    try {
      if (!doctorId) {
        throw new Error('Doctor ID is required to load reports')
      }
      const docRef = doc(db, this.collections.doctorReports, doctorId)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        return null
      }
      return { id: docSnap.id, ...docSnap.data() }
    } catch (error) {
      console.error('Error getting doctor report:', error)
      throw error
    }
  }

  async saveDoctorReport(doctorId, reportData) {
    try {
      if (!doctorId) {
        throw new Error('Doctor ID is required to save reports')
      }
      const docRef = doc(db, this.collections.doctorReports, doctorId)
      const payload = {
        ...reportData,
        updatedAt: new Date().toISOString()
      }
      await setDoc(docRef, payload, { merge: true })
      return true
    } catch (error) {
      console.error('Error saving doctor report:', error)
      throw error
    }
  }

  async getReportsByPatientId(patientId) {
    try {
      if (!patientId) {
        return []
      }
      const q = query(collection(db, this.collections.reports), where('patientId', '==', patientId))
      const querySnapshot = await getDocs(q)
      const reports = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      return reports.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.date || 0)
        const dateB = new Date(b.createdAt || b.date || 0)
        return dateB - dateA
      })
    } catch (error) {
      console.error('Error getting reports by patient ID:', error)
      throw error
    }
  }

  async createReport(reportData) {
    try {
      if (!reportData?.patientId) {
        throw new Error('Patient ID is required to create a report')
      }
      const payload = {
        ...reportData,
        createdAt: reportData.createdAt || new Date().toISOString()
      }
      const docRef = await addDoc(collection(db, this.collections.reports), payload)
      return { id: docRef.id, ...payload }
    } catch (error) {
      console.error('Error creating report:', error)
      throw error
    }
  }

  async deleteReport(reportId) {
    try {
      if (!reportId) {
        return
      }
      await deleteDoc(doc(db, this.collections.reports, reportId))
    } catch (error) {
      console.error('Error deleting report:', error)
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
          receivedAt: prescription?.receivedAt || prescription?.sentAt || prescription?.createdAt || new Date().toISOString()
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

  // Template settings operations
  async saveDoctorTemplateSettings(doctorId, templateData) {
    try {
      console.log('🔥 Firebase: Saving template settings for doctor:', doctorId)
      
      const doctorRef = doc(db, this.collections.doctors, doctorId)
      
      // Update the doctor document with template settings
      await updateDoc(doctorRef, {
        templateSettings: templateData,
        templateUpdatedAt: new Date().toISOString()
      })
      
      console.log('✅ Template settings saved successfully')
      return true
    } catch (error) {
      console.error('❌ Error saving template settings:', error)
      throw error
    }
  }

  async getDoctorTemplateSettings(doctorId) {
    try {
      console.log('🔥 Firebase: Getting template settings for doctor:', doctorId)
      
      const doctorRef = doc(db, this.collections.doctors, doctorId)
      const doctorSnap = await getDoc(doctorRef)
      
      if (doctorSnap.exists()) {
        const doctorData = doctorSnap.data()
        const templateSettings = doctorData.templateSettings || null
        
        console.log('✅ Template settings retrieved:', templateSettings)
        return templateSettings
      } else {
        console.log('⚠️ Doctor document not found')
        return null
      }
    } catch (error) {
      console.error('❌ Error getting template settings:', error)
      throw error
    }
  }

  // System settings: welcome email template
  async getWelcomeEmailTemplate() {
    try {
      const docRef = doc(db, this.collections.systemSettings, 'welcomeEmail')
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        return null
      }
      return docSnap.data()
    } catch (error) {
      console.error('❌ Error getting welcome email template:', error)
      throw error
    }
  }

  async saveWelcomeEmailTemplate(templateData) {
    try {
      const docRef = doc(db, this.collections.systemSettings, 'welcomeEmail')
      await setDoc(docRef, {
        ...templateData,
        updatedAt: new Date().toISOString()
      }, { merge: true })
      return true
    } catch (error) {
      console.error('❌ Error saving welcome email template:', error)
      throw error
    }
  }

  async getPatientWelcomeEmailTemplate() {
    try {
      const docRef = doc(db, this.collections.systemSettings, 'patientWelcomeEmail')
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        return null
      }
      return docSnap.data()
    } catch (error) {
      console.error('❌ Error getting patient welcome email template:', error)
      throw error
    }
  }

  async savePatientWelcomeEmailTemplate(templateData) {
    try {
      const docRef = doc(db, this.collections.systemSettings, 'patientWelcomeEmail')
      await setDoc(docRef, {
        ...templateData,
        updatedAt: new Date().toISOString()
      }, { merge: true })
      return true
    } catch (error) {
      console.error('❌ Error saving patient welcome email template:', error)
      throw error
    }
  }

  async getAppointmentReminderEmailTemplate() {
    try {
      const docRef = doc(db, this.collections.systemSettings, 'appointmentReminderEmail')
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        return null
      }
      return docSnap.data()
    } catch (error) {
      console.error('❌ Error getting appointment reminder email template:', error)
      throw error
    }
  }

  async saveAppointmentReminderEmailTemplate(templateData) {
    try {
      const docRef = doc(db, this.collections.systemSettings, 'appointmentReminderEmail')
      await setDoc(docRef, {
        ...templateData,
        updatedAt: new Date().toISOString()
      }, { merge: true })
      return true
    } catch (error) {
      console.error('❌ Error saving appointment reminder email template:', error)
      throw error
    }
  }

  async getDoctorBroadcastEmailTemplate() {
    try {
      const docRef = doc(db, this.collections.systemSettings, 'doctorBroadcastEmail')
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        return null
      }
      return docSnap.data()
    } catch (error) {
      console.error('❌ Error getting doctor broadcast email template:', error)
      throw error
    }
  }

  async saveDoctorBroadcastEmailTemplate(templateData) {
    try {
      const docRef = doc(db, this.collections.systemSettings, 'doctorBroadcastEmail')
      await setDoc(docRef, {
        ...templateData,
        updatedAt: new Date().toISOString()
      }, { merge: true })
      return true
    } catch (error) {
      console.error('❌ Error saving doctor broadcast email template:', error)
      throw error
    }
  }

  // System settings: messaging templates (SMS/WhatsApp)
  async getMessagingTemplates() {
    try {
      const docRef = doc(db, this.collections.systemSettings, 'messagingTemplates')
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        return null
      }
      return docSnap.data()
    } catch (error) {
      console.error('❌ Error getting messaging templates:', error)
      throw error
    }
  }

  async saveMessagingTemplates(templateData) {
    try {
      const docRef = doc(db, this.collections.systemSettings, 'messagingTemplates')
      await setDoc(docRef, {
        ...templateData,
        updatedAt: new Date().toISOString()
      }, { merge: true })
      return true
    } catch (error) {
      console.error('❌ Error saving messaging templates:', error)
      throw error
    }
  }

  async getEmailTemplate(templateId) {
    try {
      const docRef = doc(db, this.collections.systemSettings, templateId)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        return null
      }
      return docSnap.data()
    } catch (error) {
      console.error('❌ Error getting email template:', error)
      throw error
    }
  }

  async saveEmailTemplate(templateId, templateData) {
    try {
      const docRef = doc(db, this.collections.systemSettings, templateId)
      await setDoc(docRef, {
        ...templateData,
        updatedAt: new Date().toISOString()
      }, { merge: true })
      return true
    } catch (error) {
      console.error('❌ Error saving email template:', error)
      throw error
    }
  }

  async getSmtpSettings() {
    try {
      const docRef = doc(db, this.collections.systemSettings, 'smtp')
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        return null
      }
      return docSnap.data()
    } catch (error) {
      console.error('❌ Error getting SMTP settings:', error)
      throw error
    }
  }

  async saveSmtpSettings(settings) {
    try {
      const docRef = doc(db, this.collections.systemSettings, 'smtp')
      await setDoc(docRef, {
        ...settings,
        updatedAt: new Date().toISOString()
      }, { merge: true })
      return true
    } catch (error) {
      console.error('❌ Error saving SMTP settings:', error)
      throw error
    }
  }

  async getEmailLogs(limitCount = 200) {
    try {
      const q = query(
        collection(db, 'emailLogs'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      )
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('❌ Error getting email logs:', error)
      throw error
    }
  }
}

// Create singleton instance
const firebaseStorageService = new FirebaseStorageService()

export default firebaseStorageService
