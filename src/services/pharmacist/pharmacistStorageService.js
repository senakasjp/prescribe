// Pharmacist Storage Service - Isolated storage for Pharmacist Module Only
// This service handles ONLY pharmacist-related data operations and should never interact with doctor data

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

class PharmacistStorageService {
  constructor() {
    this.collections = {
      pharmacists: 'pharmacists',
      prescriptions: 'medications', // Prescriptions are stored in medications collection
      drugStock: 'drugStock',
      connectedDoctors: 'connectedDoctors'
    }
  }

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  // Pharmacist operations
  async createPharmacist(pharmacistData) {
    try {
      console.log('🔥 PharmacistStorage: Creating pharmacist in collection:', this.collections.pharmacists)
      console.log('🔥 PharmacistStorage: Pharmacist data to save:', pharmacistData)
      
      const serializableData = {
        email: pharmacistData.email,
        businessName: pharmacistData.businessName,
        pharmacistNumber: pharmacistData.pharmacistNumber,
        firstName: pharmacistData.firstName,
        lastName: pharmacistData.lastName,
        country: pharmacistData.country,
        city: pharmacistData.city,
        address: pharmacistData.address,
        phone: pharmacistData.phone,
        role: pharmacistData.role,
        connectedDoctors: pharmacistData.connectedDoctors || [],
        uid: pharmacistData.uid,
        displayName: pharmacistData.displayName,
        photoURL: pharmacistData.photoURL,
        provider: pharmacistData.provider,
        createdAt: new Date().toISOString()
      }
      
      // Remove undefined values
      Object.keys(serializableData).forEach(key => {
        if (serializableData[key] === undefined) {
          delete serializableData[key]
        }
      })
      
      const docRef = await addDoc(collection(db, this.collections.pharmacists), serializableData)
      
      const createdPharmacist = { id: docRef.id, ...serializableData }
      console.log('🔥 PharmacistStorage: Pharmacist created successfully with ID:', docRef.id)
      
      return createdPharmacist
    } catch (error) {
      console.error('🔥 PharmacistStorage: Error creating pharmacist:', error)
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
      console.error('PharmacistStorage: Error getting pharmacist by email:', error)
      throw error
    }
  }

  async getPharmacistById(pharmacistId) {
    try {
      const docRef = doc(db, this.collections.pharmacists, pharmacistId)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() }
      } else {
        return null
      }
    } catch (error) {
      console.error('PharmacistStorage: Error getting pharmacist by ID:', error)
      throw error
    }
  }

  async updatePharmacist(pharmacistId, updateData) {
    try {
      const docRef = doc(db, this.collections.pharmacists, pharmacistId)
      await updateDoc(docRef, updateData)
      console.log('PharmacistStorage: Pharmacist updated successfully')
    } catch (error) {
      console.error('PharmacistStorage: Error updating pharmacist:', error)
      throw error
    }
  }

  // Prescription operations (pharmacist-specific)
  async getPrescriptionsByPharmacistId(pharmacistId) {
    try {
      const q = query(
        collection(db, this.collections.prescriptions), 
        where('pharmacistId', '==', pharmacistId),
        orderBy('createdAt', 'desc')
      )
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (error) {
      console.error('PharmacistStorage: Error getting prescriptions by pharmacist ID:', error)
      throw error
    }
  }

  async getPrescriptionsByDoctorId(doctorId) {
    try {
      const q = query(
        collection(db, this.collections.prescriptions), 
        where('doctorId', '==', doctorId),
        orderBy('createdAt', 'desc')
      )
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (error) {
      console.error('PharmacistStorage: Error getting prescriptions by doctor ID:', error)
      throw error
    }
  }

  async updatePrescriptionStatus(prescriptionId, status) {
    try {
      const docRef = doc(db, this.collections.prescriptions, prescriptionId)
      await updateDoc(docRef, { 
        status: status,
        updatedAt: new Date().toISOString()
      })
      console.log('PharmacistStorage: Prescription status updated successfully')
    } catch (error) {
      console.error('PharmacistStorage: Error updating prescription status:', error)
      throw error
    }
  }

  // Drug stock operations (pharmacist-specific)
  async createDrugStock(drugStockData) {
    try {
      console.log('🔥 PharmacistStorage: Creating drug stock')
      
      const serializableData = {
        ...drugStockData,
        createdAt: new Date().toISOString()
      }
      
      const docRef = await addDoc(collection(db, this.collections.drugStock), serializableData)
      
      const createdDrugStock = { id: docRef.id, ...serializableData }
      console.log('🔥 PharmacistStorage: Drug stock created successfully with ID:', docRef.id)
      
      return createdDrugStock
    } catch (error) {
      console.error('🔥 PharmacistStorage: Error creating drug stock:', error)
      throw error
    }
  }

  async getDrugStockByPharmacistId(pharmacistId) {
    try {
      const q = query(
        collection(db, this.collections.drugStock), 
        where('pharmacistId', '==', pharmacistId),
        orderBy('drugName', 'asc')
      )
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (error) {
      console.error('PharmacistStorage: Error getting drug stock by pharmacist ID:', error)
      throw error
    }
  }

  async updateDrugStock(drugStockId, updateData) {
    try {
      const docRef = doc(db, this.collections.drugStock, drugStockId)
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date().toISOString()
      })
      console.log('PharmacistStorage: Drug stock updated successfully')
    } catch (error) {
      console.error('PharmacistStorage: Error updating drug stock:', error)
      throw error
    }
  }

  async deleteDrugStock(drugStockId) {
    try {
      const docRef = doc(db, this.collections.drugStock, drugStockId)
      await deleteDoc(docRef)
      console.log('PharmacistStorage: Drug stock deleted successfully')
    } catch (error) {
      console.error('PharmacistStorage: Error deleting drug stock:', error)
      throw error
    }
  }

  // Connected doctors operations (pharmacist-specific)
  async connectPharmacistToDoctor(pharmacistId, doctorId) {
    try {
      console.log('PharmacistStorage: Connecting pharmacist to doctor')
      
      // Update pharmacist's connected doctors
      const pharmacistRef = doc(db, this.collections.pharmacists, pharmacistId)
      const pharmacistDoc = await getDoc(pharmacistRef)
      
      if (pharmacistDoc.exists()) {
        const pharmacistData = pharmacistDoc.data()
        const connectedDoctors = pharmacistData.connectedDoctors || []
        
        if (!connectedDoctors.includes(doctorId)) {
          connectedDoctors.push(doctorId)
          await updateDoc(pharmacistRef, { connectedDoctors })
        }
      }
      
      console.log('PharmacistStorage: Pharmacist connected to doctor successfully')
    } catch (error) {
      console.error('PharmacistStorage: Error connecting pharmacist to doctor:', error)
      throw error
    }
  }

  async getConnectedDoctors(pharmacistId) {
    try {
      const pharmacist = await this.getPharmacistById(pharmacistId)
      if (!pharmacist || !pharmacist.connectedDoctors) {
        return []
      }
      
      const connectedDoctors = []
      for (const doctorId of pharmacist.connectedDoctors) {
        const doctorRef = doc(db, 'doctors', doctorId)
        const doctorDoc = await getDoc(doctorRef)
        if (doctorDoc.exists()) {
          connectedDoctors.push({ id: doctorDoc.id, ...doctorDoc.data() })
        }
      }
      
      return connectedDoctors
    } catch (error) {
      console.error('PharmacistStorage: Error getting connected doctors:', error)
      throw error
    }
  }
}

// Create singleton instance
const pharmacistStorageService = new PharmacistStorageService()
export default pharmacistStorageService
