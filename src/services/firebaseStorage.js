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

const MAX_REPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024
const IMAGE_FILE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp'])
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'])
const PDF_MIME_TYPES = new Set(['application/pdf'])

const stripUndefinedDeep = (value) => {
  if (Array.isArray(value)) {
    const sanitized = value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined)
    return sanitized
  }

  if (value && typeof value === 'object') {
    const next = {}
    Object.entries(value).forEach(([key, nested]) => {
      const sanitized = stripUndefinedDeep(nested)
      if (sanitized !== undefined) {
        next[key] = sanitized
      }
    })
    return next
  }

  return value === undefined ? undefined : value
}

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
      systemSettings: 'systemSettings',
      mobileCaptureSessions: 'mobileCaptureSessions',
      promoCodes: 'promoCodes'
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

  generatePromoCode(length = 8) {
    const safeLength = Math.max(4, Math.min(16, Number(length) || 8))
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < safeLength; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)]
    }
    return code
  }

  normalizeEmail(email) {
    return String(email || '').trim().toLowerCase()
  }

  normalizePromoCode(code) {
    return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '')
  }

  async getPromoCodeByCode(code) {
    try {
      const normalizedCode = this.normalizePromoCode(code)
      if (!normalizedCode) return null
      const promoQuery = query(
        collection(db, this.collections.promoCodes),
        where('code', '==', normalizedCode),
        limit(1)
      )
      const snapshot = await getDocs(promoQuery)
      if (snapshot.empty) return null
      const promoDoc = snapshot.docs[0]
      return { id: promoDoc.id, ...promoDoc.data() }
    } catch (error) {
      console.error('❌ Error getting promo code:', error)
      throw error
    }
  }

  async createPromoCode(promoData = {}) {
    try {
      const code = this.normalizePromoCode(promoData.code || this.generatePromoCode(8))
      if (!code) {
        throw new Error('Promo code is required')
      }

      const existing = await this.getPromoCodeByCode(code)
      if (existing) {
        throw new Error('Promo code already exists')
      }

      const percentOff = Math.max(1, Math.min(100, Number(promoData.percentOff || 0)))
      const validDays = Math.max(1, Math.min(365, Number(promoData.validDays || 30)))
      const maxRedemptions = Math.max(1, Number(promoData.maxRedemptions || 1))
      const validFrom = promoData.validFrom ? new Date(promoData.validFrom) : new Date()
      const validUntilDate = promoData.validUntil
        ? new Date(promoData.validUntil)
        : new Date(validFrom.getTime() + validDays * 24 * 60 * 60 * 1000)
      const nowIso = new Date().toISOString()

      const payload = {
        code,
        name: String(promoData.name || `${percentOff}% Off`).trim(),
        discountType: 'percent',
        percentOff,
        currency: String(promoData.currency || '').trim().toLowerCase(),
        planIds: Array.isArray(promoData.planIds) ? promoData.planIds.map((id) => String(id || '').trim()).filter(Boolean) : [],
        maxRedemptions,
        redemptionCount: 0,
        isActive: promoData.isActive !== false,
        validFrom: validFrom.toISOString(),
        validUntil: validUntilDate.toISOString(),
        createdBy: String(promoData.createdBy || '').trim(),
        createdAt: nowIso,
        updatedAt: nowIso
      }

      const docRef = await addDoc(collection(db, this.collections.promoCodes), payload)
      return { id: docRef.id, ...payload }
    } catch (error) {
      console.error('❌ Error creating promo code:', error)
      throw error
    }
  }

  async getPromoCodes(maxRows = 100) {
    try {
      const rowLimit = Math.max(1, Math.min(500, Number(maxRows) || 100))
      const promoQuery = query(
        collection(db, this.collections.promoCodes),
        orderBy('createdAt', 'desc'),
        limit(rowLimit)
      )
      const snapshot = await getDocs(promoQuery)
      return snapshot.docs.map((promoDoc) => ({ id: promoDoc.id, ...promoDoc.data() }))
    } catch (error) {
      console.error('❌ Error loading promo codes:', error)
      throw error
    }
  }

  async updatePromoCodeStatus(promoId, isActive) {
    try {
      const id = String(promoId || '').trim()
      if (!id) throw new Error('Promo ID is required')
      const promoRef = doc(db, this.collections.promoCodes, id)
      await updateDoc(promoRef, {
        isActive: Boolean(isActive),
        updatedAt: new Date().toISOString()
      })
    } catch (error) {
      console.error('❌ Error updating promo status:', error)
      throw error
    }
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
        adminStripeDiscountPercent: Number(doctorData.adminStripeDiscountPercent || 0),
        authProvider: doctorData.authProvider,
        connectedPharmacists: doctorData.connectedPharmacists || [],
        allowedDeviceId: doctorData.allowedDeviceId,
        deviceId: doctorData.deviceId,
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
        deviceId: updatedDoctor.deviceId,
        isDisabled: updatedDoctor.isDisabled,
        isApproved: updatedDoctor.isApproved,
        accessExpiresAt: updatedDoctor.accessExpiresAt,
        referredByDoctorId: updatedDoctor.referredByDoctorId,
        referralEligibleAt: updatedDoctor.referralEligibleAt,
        referralBonusApplied: updatedDoctor.referralBonusApplied,
        referralBonusAppliedAt: updatedDoctor.referralBonusAppliedAt,
        referralCode: updatedDoctor.referralCode,
        adminStripeDiscountPercent: Number(updatedDoctor.adminStripeDiscountPercent || 0),
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
      
      const resolvedCurrency = pharmacistData.currency ||
        resolveCurrencyFromCountry(pharmacistData.country) ||
        'USD'
      const pharmacist = {
        email: pharmacistData.email,
        password: pharmacistData.password,
        role: pharmacistData.role,
        businessName: pharmacistData.businessName,
        pharmacistNumber: pharmacistData.pharmacistNumber,
        currency: String(resolvedCurrency).trim(),
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

      const normalizedEmail = String(pharmacyUserData.email || '').trim()
      const normalizedPassword = String(pharmacyUserData.password || '').trim()
      const existingPharmacist = await this.getPharmacistByEmail(normalizedEmail)
      if (existingPharmacist) {
        throw new Error('User with this email already exists')
      }
      const existingPharmacyUser = await this.getPharmacyUserByEmail(normalizedEmail)
      if (existingPharmacyUser) {
        throw new Error('User with this email already exists')
      }

      const pharmacyUser = {
        email: normalizedEmail,
        password: normalizedPassword,
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

  async deletePharmacyUser(pharmacyUserId) {
    try {
      if (!pharmacyUserId) {
        throw new Error('Pharmacy user ID is required')
      }
      await deleteDoc(doc(db, this.collections.pharmacyUsers, pharmacyUserId))
      console.log('Pharmacy user deleted successfully')
    } catch (error) {
      console.error('Error deleting pharmacy user:', error)
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
      const updateData = { ...capitalizedPatientData }
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key]
        }
      })
      console.log('🔍 FirebaseStorage: Capitalized patient update data:', updateData)
      
      const patientRef = doc(db, this.collections.patients, patientId)
      await updateDoc(patientRef, updateData)
      console.log('✅ Patient updated successfully')
      return { id: patientId, ...updateData }
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

  async deleteDrug(drugId) {
    try {
      if (!drugId) return false
      await deleteDoc(doc(db, this.collections.drugDatabase, drugId))
      return true
    } catch (error) {
      console.error('Error deleting drug:', error)
      throw error
    }
  }

  async hasOnboardingDummyDataForDoctor(doctorId) {
    try {
      if (!doctorId) return false
      const [patients, prescriptions, drugs, doctor] = await Promise.all([
        this.getPatientsByDoctorId(doctorId),
        this.getPrescriptionsByDoctorId(doctorId),
        this.getDoctorDrugs(doctorId),
        this.getDoctorById(doctorId)
      ])
      const hasDummyPatients = patients.some((patient) => patient?.isOnboardingDummy === true)
      const hasDummyPrescriptions = prescriptions.some((prescription) => prescription?.isOnboardingDummy === true)
      const hasDummyDrugs = drugs.some((drug) => drug?.isOnboardingDummy === true)
      const hasDummyTemplate = doctor?.templateSettings?.isOnboardingDummy === true
      return hasDummyPatients || hasDummyPrescriptions || hasDummyDrugs || hasDummyTemplate
    } catch (error) {
      console.error('Error checking onboarding dummy data:', error)
      return false
    }
  }

  async seedOnboardingDummyDataForDoctor(doctor) {
    try {
      const doctorId = String(doctor?.id || '').trim()
      if (!doctorId) {
        throw new Error('Doctor ID is required to seed onboarding data')
      }

      const doctorEmail = String(doctor?.email || '').trim()
      const [existingPatients, existingPrescriptions, existingDrugs, latestDoctor] = await Promise.all([
        this.getPatientsByDoctorId(doctorId),
        this.getPrescriptionsByDoctorId(doctorId),
        this.getDoctorDrugs(doctorId),
        this.getDoctorById(doctorId)
      ])

      const dummyPatient = existingPatients.find((patient) => patient?.isOnboardingDummy === true)
      let createdDummyPatient = dummyPatient || null

      if (!createdDummyPatient) {
        createdDummyPatient = await this.createPatient({
          firstName: 'Demo',
          lastName: 'Patient',
          dateOfBirth: '1992-04-18',
          age: '34',
          ageType: 'years',
          gender: 'Female',
          phone: '+15550001001',
          doctorId,
          doctorEmail,
          isOnboardingDummy: true
        })
      }

      const dummyDrugsSeed = [
        { name: 'Paracetamol', genericName: 'Acetaminophen', dosageForm: 'Tablet', strength: '500', strengthUnit: 'mg' },
        { name: 'Amoxicillin', genericName: 'Amoxicillin', dosageForm: 'Capsule', strength: '500', strengthUnit: 'mg' },
        { name: 'Omeprazole', genericName: 'Omeprazole', dosageForm: 'Capsule', strength: '20', strengthUnit: 'mg' },
        { name: 'Cetirizine', genericName: 'Cetirizine', dosageForm: 'Tablet', strength: '10', strengthUnit: 'mg' },
        { name: 'Metformin', genericName: 'Metformin', dosageForm: 'Tablet', strength: '500', strengthUnit: 'mg' }
      ]

      const existingDummyDrugNames = new Set(
        existingDrugs
          .filter((drug) => drug?.isOnboardingDummy === true)
          .map((drug) => String(drug?.name || '').trim().toLowerCase())
      )

      for (const dummyDrug of dummyDrugsSeed) {
        const normalizedName = String(dummyDrug.name || '').trim().toLowerCase()
        if (!normalizedName || existingDummyDrugNames.has(normalizedName)) {
          continue
        }
        await this.addDrug(doctorId, {
          ...dummyDrug,
          isOnboardingDummy: true
        })
      }

      const hasDummyPrescription = existingPrescriptions.some((prescription) => prescription?.isOnboardingDummy === true)
      if (!hasDummyPrescription && createdDummyPatient?.id) {
        await this.createPrescription({
          patientId: createdDummyPatient.id,
          doctorId,
          doctorEmail,
          patient: {
            id: createdDummyPatient.id,
            firstName: createdDummyPatient.firstName || 'Demo',
            lastName: createdDummyPatient.lastName || 'Patient',
            age: createdDummyPatient.age || '34',
            gender: createdDummyPatient.gender || 'Female',
            email: createdDummyPatient.email || '',
            phone: createdDummyPatient.phone || ''
          },
          name: 'Demo Prescription',
          notes: 'This is demo data for onboarding and tour guidance.',
          medications: [
            {
              name: 'Paracetamol',
              genericName: 'Acetaminophen',
              dosage: '500 mg',
              dosageForm: 'Tablet',
              strength: '500',
              strengthUnit: 'mg',
              frequency: 'Every 8 hours',
              duration: '5 days',
              instructions: 'Take after meals'
            }
          ],
          procedures: [],
          status: 'draft',
          isOnboardingDummy: true
        })
      }

      if (!latestDoctor?.templateSettings) {
        await this.saveDoctorTemplateSettings(doctorId, {
          templateType: 'system',
          headerSize: 260,
          headerText: 'Dr. Demo Clinic\nGeneral Practice\nPhone: +1 (555) 000-1001',
          headerFontSize: 24,
          templatePreview: {
            formattedHeader: 'Dr. Demo Clinic<br>General Practice<br>Phone: +1 (555) 000-1001'
          },
          procedurePricing: [
            { name: 'General Consultation', price: '30' },
            { name: 'Follow-up Consultation', price: '20' }
          ],
          isOnboardingDummy: true
        })
      }

      return true
    } catch (error) {
      console.error('Error seeding onboarding dummy data:', error)
      throw error
    }
  }

  async deleteOnboardingDummyDataForDoctor(doctorId) {
    try {
      if (!doctorId) return false

      const [patients, prescriptions, drugs, doctor] = await Promise.all([
        this.getPatientsByDoctorId(doctorId),
        this.getPrescriptionsByDoctorId(doctorId),
        this.getDoctorDrugs(doctorId),
        this.getDoctorById(doctorId)
      ])

      const dummyPrescriptions = prescriptions.filter((prescription) => prescription?.isOnboardingDummy === true)
      for (const prescription of dummyPrescriptions) {
        await this.deletePrescription(prescription.id)
      }

      const dummyPatients = patients.filter((patient) => patient?.isOnboardingDummy === true)
      for (const patient of dummyPatients) {
        await this.deletePatient(patient.id)
      }

      const dummyDrugs = drugs.filter((drug) => drug?.isOnboardingDummy === true)
      for (const drug of dummyDrugs) {
        await this.deleteDrug(drug.id)
      }

      if (doctor?.templateSettings?.isOnboardingDummy === true) {
        await this.saveDoctorTemplateSettings(doctorId, null)
      }

      return true
    } catch (error) {
      console.error('Error deleting onboarding dummy data:', error)
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

  validateReportUploadSecurity(reportData) {
    const reportType = String(reportData?.type || 'text').toLowerCase()
    if (reportType === 'text') {
      return
    }

    const files = Array.isArray(reportData?.files) ? reportData.files : []
    if (files.length === 0) {
      throw new Error('Report file is required')
    }

    for (const file of files) {
      const name = String(file?.name || '').trim()
      const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
      const mimeType = String(file?.type || '').trim().toLowerCase()
      const size = Number(file?.size)

      if (!name || /[<>]/.test(name) || name.includes('/') || name.includes('\\')) {
        throw new Error('Invalid report filename')
      }
      if (!Number.isFinite(size) || size <= 0 || size > MAX_REPORT_FILE_SIZE_BYTES) {
        throw new Error('Report file size is invalid')
      }

      if (reportType === 'pdf') {
        if (extension !== 'pdf') {
          throw new Error('PDF upload requires a .pdf file')
        }
        if (!PDF_MIME_TYPES.has(mimeType)) {
          throw new Error('Invalid PDF MIME type')
        }
      }

      if (reportType === 'image') {
        if (!IMAGE_FILE_EXTENSIONS.has(extension)) {
          throw new Error('Invalid image file extension')
        }
        if (!IMAGE_MIME_TYPES.has(mimeType)) {
          throw new Error('Invalid image MIME type')
        }
      }
    }

    const dataUrl = String(reportData?.dataUrl || '').trim()
    if (dataUrl) {
      if (reportType === 'image' && !/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(dataUrl)) {
        throw new Error('Invalid image data URL')
      }
      if (reportType === 'pdf' && !/^data:application\/pdf;base64,/i.test(dataUrl)) {
        throw new Error('Invalid PDF data URL')
      }
    }

    const selectedAreaDataUrl = String(reportData?.selectedAreaDataUrl || '').trim()
    if (selectedAreaDataUrl) {
      if (reportType !== 'image') {
        throw new Error('Selected area image is only allowed for image reports')
      }
      if (!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(selectedAreaDataUrl)) {
        throw new Error('Invalid selected area image data URL')
      }
    }
  }

  async createReport(reportData) {
    try {
      if (!reportData?.patientId) {
        throw new Error('Patient ID is required to create a report')
      }
      this.validateReportUploadSecurity(reportData)
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

  async updateReport(reportId, reportData) {
    try {
      if (!reportId) {
        throw new Error('Report ID is required to update a report')
      }
      this.validateReportUploadSecurity(reportData)
      const payload = {
        ...reportData,
        updatedAt: new Date().toISOString()
      }
      await updateDoc(doc(db, this.collections.reports, reportId), payload)
      return { id: reportId, ...payload }
    } catch (error) {
      console.error('Error updating report:', error)
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

  async upsertMobileCaptureSession(sessionCode, payload = {}) {
    try {
      const code = String(sessionCode || '').trim().toUpperCase()
      if (!code) throw new Error('Session code is required')
      const sessionRef = doc(db, this.collections.mobileCaptureSessions, code)
      await setDoc(sessionRef, {
        ...payload,
        code,
        updatedAt: new Date().toISOString()
      }, { merge: true })
      return { id: code, ...payload }
    } catch (error) {
      console.error('Error upserting mobile capture session:', error)
      throw error
    }
  }

  subscribeMobileCaptureSession(sessionCode, callback, errorCallback = null) {
    const code = String(sessionCode || '').trim().toUpperCase()
    if (!code) {
      return () => {}
    }
    const sessionRef = doc(db, this.collections.mobileCaptureSessions, code)
    return onSnapshot(
      sessionRef,
      (snapshot) => {
        callback?.(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null)
      },
      (error) => {
        console.error('Error subscribing mobile capture session:', error)
        if (typeof errorCallback === 'function') errorCallback(error)
      }
    )
  }

  async deleteMobileCaptureSession(sessionCode) {
    try {
      const code = String(sessionCode || '').trim().toUpperCase()
      if (!code) return
      const sessionRef = doc(db, this.collections.mobileCaptureSessions, code)
      await deleteDoc(sessionRef)
    } catch (error) {
      console.error('Error deleting mobile capture session:', error)
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
      const sanitizedTemplateData = stripUndefinedDeep(templateData || {})
      
      // Update the doctor document with template settings
      await updateDoc(doctorRef, {
        templateSettings: sanitizedTemplateData,
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

  async getPaymentPricingSettings() {
    try {
      const docRef = doc(db, this.collections.systemSettings, 'paymentPricing')
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        return null
      }
      return docSnap.data()
    } catch (error) {
      console.error('❌ Error getting payment pricing settings:', error)
      throw error
    }
  }

  async savePaymentPricingSettings(settings) {
    try {
      const docRef = doc(db, this.collections.systemSettings, 'paymentPricing')
      await setDoc(docRef, {
        ...settings,
        updatedAt: new Date().toISOString()
      }, { merge: true })
      return true
    } catch (error) {
      console.error('❌ Error saving payment pricing settings:', error)
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

  async getSmsLogs(limitCount = 200) {
    try {
      const q = query(
        collection(db, 'smsLogs'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      )
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('❌ Error getting sms logs:', error)
      throw error
    }
  }

  async getDoctorPaymentRecords(doctorId, limitCount = 200, doctorEmail = '') {
    try {
      const SUCCESS_STATUSES = new Set(['confirmed', 'paid', 'succeeded', 'complete', 'completed', 'recorded', 'success'])
      const FAIL_STATUSES = new Set(['failed', 'fail', 'canceled', 'cancelled'])
      const DUPLICATE_WINDOW_MS = 3 * 60 * 1000
      const normalizedDoctorId = String(doctorId || '').trim()
      const normalizedDoctorEmail = String(doctorEmail || '').trim().toLowerCase()
      if (!normalizedDoctorId) {
        return []
      }

      const walletSnapshot = await getDocs(
        query(
          collection(db, 'doctorPaymentRecords'),
          where('doctorId', '==', normalizedDoctorId),
          limit(limitCount)
        )
      )

      const walletRecords = walletSnapshot.docs.map(doc => ({
        id: doc.id,
        sourceCollection: 'doctorPaymentRecords',
        ...doc.data()
      }))

      const stripeSnapshot = await getDocs(
        query(
          collection(db, 'stripeCheckoutLogs'),
          where('doctorId', '==', normalizedDoctorId),
          limit(limitCount)
        )
      )

      const stripeRecords = stripeSnapshot.docs.map(doc => {
        const data = doc.data()
        const interval = String(data?.interval || '').toLowerCase()
        const monthsDelta = interval === 'year' ? 12 : interval === 'month' ? 1 : 0
        const normalizedAmount = Number(data?.amount || 0) / 100
        return {
          id: `stripe-${doc.id}`,
          doctorId: normalizedDoctorId,
          type: 'stripe_checkout',
          source: 'stripeCheckoutLogs',
          status: data?.status || 'created',
          monthsDelta,
          amount: Number.isFinite(normalizedAmount) ? normalizedAmount : 0,
          currency: String(data?.currency || '').toUpperCase(),
          referenceId: data?.sessionId || doc.id,
          note: data?.planId || '',
          createdAt: data?.createdAt || '',
          sourceCollection: 'stripeCheckoutLogs'
        }
      })

      const stripeByEmailRecords = normalizedDoctorEmail
        ? (await getDocs(
            query(
              collection(db, 'stripeCheckoutLogs'),
              where('userEmail', '==', normalizedDoctorEmail),
              limit(limitCount)
            )
          )).docs.map(doc => {
            const data = doc.data()
            const interval = String(data?.interval || '').toLowerCase()
            const monthsDelta = interval === 'year' ? 12 : interval === 'month' ? 1 : 0
            const normalizedAmount = Number(data?.amount || 0) / 100
            return {
              id: `stripe-email-${doc.id}`,
              doctorId: normalizedDoctorId,
              type: 'stripe_checkout',
              source: 'stripeCheckoutLogs',
              status: data?.status || 'created',
              monthsDelta,
              amount: Number.isFinite(normalizedAmount) ? normalizedAmount : 0,
              currency: String(data?.currency || '').toUpperCase(),
              referenceId: data?.sessionId || doc.id,
              note: data?.planId || '',
              createdAt: data?.createdAt || '',
              sourceCollection: 'stripeCheckoutLogs'
            }
          })
        : []

      const toTimestamp = (record) => {
        const ts = new Date(record?.createdAt || 0).getTime()
        return Number.isFinite(ts) ? ts : 0
      }

      const normalizeOutcome = (record) => {
        const status = String(record?.status || '').toLowerCase()
        if (SUCCESS_STATUSES.has(status)) return 'success'
        if (FAIL_STATUSES.has(status)) return 'fail'
        return 'pending'
      }

      const isStripeRecord = (record) => {
        const source = String(record?.source || '').toLowerCase()
        const sourceCollection = String(record?.sourceCollection || '').toLowerCase()
        return source.includes('stripe') || sourceCollection.includes('stripe')
      }

      const getReferenceCandidates = (record) => {
        const metadata = record?.metadata && typeof record.metadata === 'object' ? record.metadata : {}
        const values = [
          record?.referenceId,
          record?.sessionId,
          record?.checkoutSessionId,
          record?.paymentIntentId,
          record?.invoiceId,
          metadata?.referenceId,
          metadata?.sessionId,
          metadata?.checkoutSessionId,
          metadata?.paymentIntentId,
          metadata?.invoiceId
        ]
        return values
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      }

      const getCanonicalReference = (record) => {
        const refs = getReferenceCandidates(record)
        if (refs.length === 0) return ''
        const byPrefix = (prefix) => refs.find((ref) => ref.startsWith(prefix))
        return byPrefix('cs_') || byPrefix('pi_') || byPrefix('in_') || byPrefix('ch_') || refs[0]
      }

      const getRecordScore = (record) => {
        let score = 0
        const outcome = normalizeOutcome(record)
        if (String(record?.sourceCollection || '').toLowerCase() === 'doctorpaymentrecords') score += 100
        if (outcome !== 'pending') score += 40
        if (Number(record?.amount || 0) > 0) score += 20
        if (String(record?.type || '').toLowerCase() === 'stripe_payment') score += 10
        if (getCanonicalReference(record).startsWith('cs_')) score += 5
        return score
      }

      const mergedByRef = new Map()
      ;[...walletRecords, ...stripeRecords, ...stripeByEmailRecords].forEach((record) => {
        const canonicalReference = getCanonicalReference(record)
        const key = canonicalReference ? `ref:${canonicalReference}` : `id:${record.id}`
        const existing = mergedByRef.get(key)
        if (
          !existing ||
          getRecordScore(record) > getRecordScore(existing) ||
          (
            getRecordScore(record) === getRecordScore(existing) &&
            toTimestamp(record) > toTimestamp(existing)
          )
        ) {
          mergedByRef.set(key, record)
        }
      })

      const sortedRecords = Array.from(mergedByRef.values())
        .sort((a, b) => getRecordScore(b) - getRecordScore(a))

      const collapsedRecords = []
      sortedRecords.forEach((record) => {
        if (!isStripeRecord(record)) {
          collapsedRecords.push(record)
          return
        }

        const amount = Number(record?.amount || 0)
        const ref = String(record?.referenceId || '').trim().toLowerCase()
        const outcome = normalizeOutcome(record)
        const weakStripeReference = ref.startsWith('in_') || ref.startsWith('pi_') || ref.startsWith('ch_')
        const shouldTryCollapse =
          (weakStripeReference && amount <= 0) ||
          (amount <= 0 && outcome === 'success')
        if (!shouldTryCollapse) {
          collapsedRecords.push(record)
          return
        }

        const ts = toTimestamp(record)
        const monthsDelta = Number(record?.monthsDelta || 0)
        const currency = String(record?.currency || '').toUpperCase()
        const hasBetterMatch = collapsedRecords.some((existing) => {
          if (!isStripeRecord(existing)) return false
          if (normalizeOutcome(existing) !== outcome) return false
          const existingMonths = Number(existing?.monthsDelta || 0)
          const existingCurrency = String(existing?.currency || '').toUpperCase()
          const monthMatches = monthsDelta <= 0 || existingMonths <= 0 || existingMonths === monthsDelta
          const currencyMatches = !currency || !existingCurrency || existingCurrency === currency
          if (!monthMatches) return false
          if (!currencyMatches) return false
          if (Number(existing?.amount || 0) <= 0) return false
          return Math.abs(toTimestamp(existing) - ts) <= DUPLICATE_WINDOW_MS
        })

        if (!hasBetterMatch) {
          collapsedRecords.push(record)
        }
      })

      const finalCollapsedRecords = []
      collapsedRecords.forEach((record) => {
        if (!isStripeRecord(record)) {
          finalCollapsedRecords.push(record)
          return
        }

        const ts = toTimestamp(record)
        const outcome = normalizeOutcome(record)
        const monthsDelta = Number(record?.monthsDelta || 0)
        const amount = Number(record?.amount || 0)
        const currency = String(record?.currency || '').toUpperCase()
        const hasNearEquivalent = finalCollapsedRecords.some((existing) => {
          if (!isStripeRecord(existing)) return false
          if (normalizeOutcome(existing) !== outcome) return false
          if (Number(existing?.monthsDelta || 0) !== monthsDelta) return false
          if (String(existing?.currency || '').toUpperCase() !== currency) return false
          if (Number(existing?.amount || 0) !== amount) return false
          return Math.abs(toTimestamp(existing) - ts) <= DUPLICATE_WINDOW_MS
        })

        if (!hasNearEquivalent) {
          finalCollapsedRecords.push(record)
        }
      })

      return finalCollapsedRecords
        .sort((a, b) => toTimestamp(b) - toTimestamp(a))
        .slice(0, limitCount)
    } catch (error) {
      console.error('❌ Error getting doctor payment records:', error)
      throw error
    }
  }

  async addDoctorPaymentRecord(record) {
    try {
      const doctorId = String(record?.doctorId || '').trim()
      if (!doctorId) {
        throw new Error('doctorId is required')
      }
      const payload = {
        doctorId,
        type: String(record?.type || 'manual'),
        source: String(record?.source || 'admin'),
        status: String(record?.status || 'recorded'),
        monthsDelta: Number(record?.monthsDelta || 0),
        amount: Number(record?.amount || 0),
        currency: String(record?.currency || '').toUpperCase(),
        referenceId: String(record?.referenceId || ''),
        note: String(record?.note || ''),
        metadata: record?.metadata || {},
        createdAt: new Date().toISOString()
      }
      const docRef = await addDoc(collection(db, 'doctorPaymentRecords'), payload)
      return { id: docRef.id, ...payload }
    } catch (error) {
      console.error('❌ Error adding doctor payment record:', error)
      throw error
    }
  }

  async addDoctorAIUsageRecord(record) {
    try {
      const doctorId = String(record?.doctorId || '').trim()
      if (!doctorId) {
        throw new Error('doctorId is required')
      }

      const createdAt = String(record?.createdAt || new Date().toISOString())
      const promptTokens = Number(record?.promptTokens || 0)
      const completionTokens = Number(record?.completionTokens || 0)
      const totalTokens = Number(record?.totalTokens || (promptTokens + completionTokens))
      const cost = Number(record?.cost || 0)
      const dayKey = createdAt.slice(0, 10)

      const payload = {
        doctorId,
        requestType: String(record?.requestType || ''),
        model: String(record?.model || ''),
        promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
        completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
        totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
        cost: Number.isFinite(cost) ? cost : 0,
        createdAt
      }

      await addDoc(collection(db, 'doctorAiUsageLogs'), payload)

      const statsRef = doc(db, 'doctorAiUsageStats', doctorId)
      const statsSnap = await getDoc(statsRef)
      const existing = statsSnap.exists() ? statsSnap.data() : {}
      const existingDay = String(existing?.todayDate || '')
      const dayChanged = existingDay !== dayKey

      const nextStats = {
        doctorId,
        totalTokens: Number(existing?.totalTokens || 0) + payload.totalTokens,
        totalCost: Number(existing?.totalCost || 0) + payload.cost,
        totalRequests: Number(existing?.totalRequests || 0) + 1,
        todayDate: dayKey,
        todayTokens: (dayChanged ? 0 : Number(existing?.todayTokens || 0)) + payload.totalTokens,
        todayCost: (dayChanged ? 0 : Number(existing?.todayCost || 0)) + payload.cost,
        todayRequests: (dayChanged ? 0 : Number(existing?.todayRequests || 0)) + 1,
        lastRequestAt: createdAt,
        updatedAt: new Date().toISOString()
      }

      if (!statsSnap.exists()) {
        nextStats.createdAt = new Date().toISOString()
      }

      await setDoc(statsRef, nextStats, { merge: true })
      return true
    } catch (error) {
      console.error('❌ Error adding doctor AI usage record:', error)
      throw error
    }
  }

  async getDoctorAIUsageStats(doctorId) {
    try {
      const normalizedDoctorId = String(doctorId || '').trim()
      if (!normalizedDoctorId) {
        return {
          total: { tokens: 0, cost: 0, requests: 0 },
          today: { tokens: 0, cost: 0, requests: 0 }
        }
      }

      const statsRef = doc(db, 'doctorAiUsageStats', normalizedDoctorId)
      const statsSnap = await getDoc(statsRef)
      if (!statsSnap.exists()) {
        return {
          total: { tokens: 0, cost: 0, requests: 0 },
          today: { tokens: 0, cost: 0, requests: 0 }
        }
      }

      const data = statsSnap.data() || {}
      const todayKey = new Date().toISOString().slice(0, 10)
      const sameDay = String(data?.todayDate || '') === todayKey

      return {
        total: {
          tokens: Number(data?.totalTokens || 0),
          cost: Number(data?.totalCost || 0),
          requests: Number(data?.totalRequests || 0)
        },
        today: {
          tokens: sameDay ? Number(data?.todayTokens || 0) : 0,
          cost: sameDay ? Number(data?.todayCost || 0) : 0,
          requests: sameDay ? Number(data?.todayRequests || 0) : 0
        }
      }
    } catch (error) {
      console.error('❌ Error getting doctor AI usage stats:', error)
      throw error
    }
  }

  async getDoctorAIUsageStatsMap(doctorIds = []) {
    try {
      const map = {}
      const normalizedIds = [...new Set((doctorIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
      if (normalizedIds.length === 0) return map

      const stats = await Promise.all(
        normalizedIds.map(async (doctorId) => [doctorId, await this.getDoctorAIUsageStats(doctorId)])
      )
      stats.forEach(([doctorId, usage]) => {
        map[doctorId] = usage
      })
      return map
    } catch (error) {
      console.error('❌ Error getting doctor AI usage stats map:', error)
      throw error
    }
  }

  async getAllDoctorAIUsageSummary(limitCount = 500) {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, 'doctorAiUsageStats'),
          limit(limitCount)
        )
      )
      const rows = snapshot.docs
        .map((docSnap) => docSnap.data() || {})
        .sort((a, b) => String(b?.updatedAt || '').localeCompare(String(a?.updatedAt || '')))

      const todayKey = new Date().toISOString().slice(0, 10)
      const summary = {
        total: { tokens: 0, cost: 0, requests: 0 },
        today: { tokens: 0, cost: 0, requests: 0 },
        thisMonth: { tokens: 0, cost: 0, requests: 0 },
        lastUpdated: null
      }

      rows.forEach((row) => {
        summary.total.tokens += Number(row?.totalTokens || 0)
        summary.total.cost += Number(row?.totalCost || 0)
        summary.total.requests += Number(row?.totalRequests || 0)
        if (String(row?.todayDate || '') === todayKey) {
          summary.today.tokens += Number(row?.todayTokens || 0)
          summary.today.cost += Number(row?.todayCost || 0)
          summary.today.requests += Number(row?.todayRequests || 0)
        }
        const updatedAt = String(row?.updatedAt || '')
        if (!summary.lastUpdated || updatedAt > summary.lastUpdated) {
          summary.lastUpdated = updatedAt
        }
      })

      // Monthly aggregate is not precomputed server-side yet; keep deterministic zero.
      return summary
    } catch (error) {
      console.error('❌ Error getting all doctor AI usage summary:', error)
      throw error
    }
  }

  async getDoctorReferralWalletStats(doctorId) {
    try {
      const normalizedDoctorId = String(doctorId || '').trim()
      if (!normalizedDoctorId) {
        return {
          totalReferredDoctors: 0,
          referralBonusAppliedCount: 0,
          referralBonusPendingCount: 0,
          referralFreeMonthsAvailable: 0
        }
      }

      const shortDoctorId = this.formatDoctorId(normalizedDoctorId)
      const [directSnapshot, shortSnapshot] = await Promise.all([
        getDocs(
          query(
            collection(db, this.collections.doctors),
            where('referredByDoctorId', '==', normalizedDoctorId),
            limit(500)
          )
        ),
        getDocs(
          query(
            collection(db, this.collections.doctors),
            where('referredByDoctorId', '==', shortDoctorId),
            limit(500)
          )
        )
      ])

      const byId = new Map()
      directSnapshot.docs.forEach((docSnap) => {
        byId.set(docSnap.id, { id: docSnap.id, ...docSnap.data() })
      })
      shortSnapshot.docs.forEach((docSnap) => {
        if (!byId.has(docSnap.id)) {
          byId.set(docSnap.id, { id: docSnap.id, ...docSnap.data() })
        }
      })

      const referredDoctors = Array.from(byId.values())
      const now = Date.now()
      let referralBonusAppliedCount = 0
      let referralBonusPendingCount = 0
      let referralFreeMonthsAvailable = 0

      referredDoctors.forEach((doctor) => {
        if (doctor?.referralBonusApplied) {
          referralBonusAppliedCount += 1
          return
        }
        const eligibleTime = new Date(doctor?.referralEligibleAt || '').getTime()
        if (Number.isFinite(eligibleTime) && eligibleTime <= now) {
          referralFreeMonthsAvailable += 1
        } else {
          referralBonusPendingCount += 1
        }
      })

      return {
        totalReferredDoctors: referredDoctors.length,
        referralBonusAppliedCount,
        referralBonusPendingCount,
        referralFreeMonthsAvailable
      }
    } catch (error) {
      console.error('❌ Error getting doctor referral wallet stats:', error)
      throw error
    }
  }
}

// Create singleton instance
const firebaseStorageService = new FirebaseStorageService()

export default firebaseStorageService
