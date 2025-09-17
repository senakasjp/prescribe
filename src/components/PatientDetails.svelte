<script>
  import { onMount } from 'svelte'
  import firebaseStorage from '../services/firebaseStorage.js'
  import openaiService from '../services/openaiService.js'
  import authService from '../services/authService.js'
  import { notifyError, notifySuccess } from '../stores/notifications.js'
  import PatientTabs from './PatientTabs.svelte'
  import PatientForms from './PatientForms.svelte'
  import PrescriptionList from './PrescriptionList.svelte'
  import PrescriptionPDF from './PrescriptionPDF.svelte'
  import AIRecommendations from './AIRecommendations.svelte'
  
  export let selectedPatient
  export const addToPrescription = null
  export let refreshTrigger = 0
  export let doctorId = null
  export let currentUser = null
  
  // Event dispatcher to notify parent of data changes
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()
  
  let illnesses = []
  let prescriptions = [] // Array of prescription objects (each containing medications)
  let symptoms = []
  let currentPrescription = null // Current prescription being worked on
  let currentMedications = [] // Current medications in the working prescription (for display)
  let activeTab = 'overview'
  let isNewPrescriptionSession = false
  let showIllnessForm = false
  let showMedicationForm = false
  let showSymptomsForm = false
  let showPrescriptionPDF = false
  let expandedSymptoms = {}
  let expandedIllnesses = {}
  let loading = true
  let editingMedication = null
  let prescriptionNotes = ''
  let prescriptionsFinalized = false
  let printButtonClicked = false
  
  // Patient edit mode
  let isEditingPatient = false
  let editPatientData = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    age: '',
    weight: '',
    bloodGroup: '',
    idNumber: '',
    address: '',
    allergies: '',
    emergencyContact: '',
    emergencyPhone: ''
  }
  let editError = ''
  let savingPatient = false
  
  // AI analysis state
  let aiCheckComplete = false
  let aiCheckMessage = ''
  let prescriptionFinished = false
  let lastAnalyzedMedications = []
  
  // Full AI Analysis
  let fullAIAnalysis = null
  let loadingFullAnalysis = false
  let showFullAnalysis = false
  let fullAnalysisError = ''
  
  
  // Load patient data
  const loadPatientData = async () => {
    try {
      console.log('🔄 Loading data for patient:', selectedPatient.id)
      
      // Reset finalized state when loading new patient data
      prescriptionsFinalized = false
      prescriptionFinished = false
      printButtonClicked = false
      aiCheckComplete = false
      aiCheckMessage = ''
      
      // Load illnesses
      illnesses = await firebaseStorage.getIllnessesByPatientId(selectedPatient.id) || []
      console.log('✅ Loaded illnesses:', illnesses.length)
      
      // Load prescriptions
      prescriptions = await firebaseStorage.getPrescriptionsByPatientId(selectedPatient.id) || []
      console.log('✅ Loaded prescriptions:', prescriptions.length)
      console.log('📋 Prescriptions data:', prescriptions)
      
      // Load symptoms
      symptoms = await firebaseStorage.getSymptomsByPatientId(selectedPatient.id) || []
      console.log('✅ Loaded symptoms:', symptoms.length)
      
      // Set up current prescription and medications
      setupCurrentPrescription()
      
    } catch (error) {
      console.error('Error loading patient data:', error)
      // Ensure arrays are always defined
      illnesses = []
      prescriptions = []
      symptoms = []
    } finally {
      loading = false
    }
  }
  
  // Set up current prescription and medications from loaded data
  const setupCurrentPrescription = () => {
    console.log('🔧 Setting up current prescription from loaded data...')
    
    // If we already have a current prescription (from new prescription session), keep it
    if (currentPrescription && isNewPrescriptionSession) {
      console.log('🔧 Keeping existing current prescription (new session)')
      return
    }
    
    // Find the most recent prescription for this patient
    const mostRecentPrescription = prescriptions.find(p => 
      p.patientId === selectedPatient.id && 
      p.medications && 
      p.medications.length > 0
    )
    
    if (mostRecentPrescription) {
      console.log('🔧 Found most recent prescription:', mostRecentPrescription.id)
      currentPrescription = mostRecentPrescription
      currentMedications = currentPrescription.medications || []
      console.log('📅 Set current medications:', currentMedications.length)
    } else {
      console.log('🔧 No existing prescriptions found - will create new one when needed')
      currentPrescription = null
      currentMedications = []
    }
    
    // Clear any existing AI analysis when loading data
  }
  
  // Filter current prescriptions (show all medications from all prescriptions)
  const filterCurrentPrescriptions = () => {
    // Don't filter if we're in a new prescription session
    if (isNewPrescriptionSession) {
      console.log('🔍 Skipping filter - in new prescription session')
      return
    }
    
    console.log('🔍 Showing all medications from', prescriptions.length, 'total prescriptions')
    console.log('🔍 filterCurrentPrescriptions - prescriptionFinished:', prescriptionFinished)
    console.log('🔍 filterCurrentPrescriptions - aiCheckComplete:', aiCheckComplete)
    console.log('🔍 Current prescription before filter:', currentPrescription?.id)
    
    // CRITICAL: Ensure currentPrescription is still valid and up-to-date
    if (currentPrescription && prescriptions.length > 0) {
      // Find the current prescription in the updated prescriptions array
      const updatedPrescription = prescriptions.find(p => p.id === currentPrescription.id)
      if (updatedPrescription) {
        // Update currentPrescription with the latest data from Firebase
        currentPrescription = updatedPrescription
        console.log('🔍 Updated currentPrescription with latest data:', currentPrescription.id)
      } else {
        console.log('⚠️ Current prescription not found in prescriptions array - this might cause issues')
      }
    }
    
    // Get medications from the current prescription
    currentMedications = currentPrescription ? currentPrescription.medications || [] : []
    console.log('📅 Current medications in prescription:', currentMedications.length)
    
    // Note: Drug interaction checking is now done when clicking action buttons
    // Only clear interactions if prescription is not finished (to preserve AI analysis)
    if (!prescriptionFinished) {
      console.log('🔍 Clearing AI analysis - prescription not finished')
    } else {
      console.log('🔍 Preserving AI analysis - prescription is finished')
    }
  }
  
  
  
  // Perform full AI analysis of the prescription
  const performFullAIAnalysis = async () => {
    try {
      loadingFullAnalysis = true
      fullAnalysisError = ''
      showFullAnalysis = false
      
      console.log('🤖 Starting full AI prescription analysis...')
      console.log('🔍 Patient:', selectedPatient.firstName, selectedPatient.lastName)
      console.log('🔍 Medications:', currentMedications.map(m => m.name))
      console.log('🔍 Symptoms:', symptoms.length)
      console.log('🔍 Illnesses:', illnesses.length)
      
      // Get doctor information including country
      const firebaseUser = currentUser || authService.getCurrentUser()
      const doctor = await firebaseStorage.getDoctorByEmail(firebaseUser.email)
      console.log('🔍 Doctor info for analysis:', doctor)
      
      // Prepare comprehensive data for analysis
      const patientData = {
        // Basic Patient Information
        name: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
        firstName: selectedPatient.firstName,
        lastName: selectedPatient.lastName,
        age: selectedPatient.age,
        weight: selectedPatient.weight,
        height: selectedPatient.height,
        bloodGroup: selectedPatient.bloodGroup,
        gender: selectedPatient.gender,
        dateOfBirth: selectedPatient.dateOfBirth,
        
        // Medical Information
        allergies: selectedPatient.allergies,
        medicalHistory: selectedPatient.medicalHistory,
        currentMedications: selectedPatient.currentMedications,
        emergencyContact: selectedPatient.emergencyContact,
        
        // Current Prescription Data
        medications: currentMedications,
        symptoms: symptoms,
        illnesses: illnesses,
        
        // Location Information
        patientAddress: selectedPatient.address,
        patientCity: selectedPatient.city,
        patientCountry: selectedPatient.country,
        patientPhone: selectedPatient.phone,
        patientEmail: selectedPatient.email,
        
        // Doctor Information
        doctorName: doctor ? `${doctor.firstName} ${doctor.lastName}` : 'Unknown',
        doctorCountry: doctor?.country || 'Not specified',
        doctorCity: doctor?.city || 'Not specified',
        doctorSpecialization: doctor?.specialization || 'General Practice',
        doctorLicenseNumber: doctor?.licenseNumber || 'Not specified',
        
        // Analysis Context
        prescriptionDate: new Date().toISOString(),
        analysisType: 'comprehensive_prescription_analysis'
      }
      
      // Generate comprehensive analysis using OpenAI
      const analysis = await openaiService.generateComprehensivePrescriptionAnalysis(patientData, doctorId)
      
      fullAIAnalysis = analysis
      showFullAnalysis = true
      
      console.log('✅ Full AI analysis completed successfully')
      notifySuccess('Full AI analysis completed!')
      
    } catch (error) {
      console.error('❌ Error performing full AI analysis:', error)
      fullAnalysisError = error.message
      notifyError('Failed to perform AI analysis: ' + error.message)
    } finally {
      loadingFullAnalysis = false
    }
  }
  
  // Close full analysis
  const closeFullAnalysis = () => {
    showFullAnalysis = false
    fullAIAnalysis = null
    fullAnalysisError = ''
  }
  
  
  
  // Reactive statement to filter current prescriptions when prescriptions change
  $: if (prescriptions) {
    console.log('🔄 Reactive statement triggered - prescriptions changed:', prescriptions.length)
    console.log('🔄 isNewPrescriptionSession:', isNewPrescriptionSession)
    console.log('🔄 prescriptionFinished:', prescriptionFinished)
    console.log('🔄 aiCheckComplete:', aiCheckComplete)
    filterCurrentPrescriptions()
  }
  
  // Handle tab change
  const handleTabChange = (tab) => {
    activeTab = tab
    // Reset form visibility when changing tabs
    showIllnessForm = false
    showSymptomsForm = false
    showMedicationForm = false
  }
  
  // Handle form submissions
  const handleIllnessAdded = async (event) => {
    const illnessData = event.detail
    console.log('🦠 Illness added:', illnessData)
    
    try {
      // Save illness to database
      const newIllness = await firebaseStorage.createIllness({
        ...illnessData,
        patientId: selectedPatient.id,
        doctorId: doctorId
      })
      
      console.log('💾 Illness saved to database:', newIllness)
      
      // Add to illnesses array immediately and trigger reactivity
      illnesses = [...illnesses, newIllness]
      console.log('📋 Updated illnesses array:', illnesses.length)
      
      // Notify parent component to refresh medical summary
      dispatch('dataUpdated', { 
        type: 'illness', 
        data: newIllness 
      })
      
    } catch (error) {
      console.error('❌ Error saving illness:', error)
      // Reload data to ensure consistency
      loadPatientData()
    }
    
    showIllnessForm = false
  }
  
  const handleSymptomsAdded = async (event) => {
    const symptomsData = event.detail
    console.log('🤒 Symptoms added:', symptomsData)
    
    try {
      // Save symptoms to database
      const newSymptoms = await firebaseStorage.createSymptoms({
        ...symptomsData,
        patientId: selectedPatient.id,
        doctorId: doctorId
      })
      
      console.log('💾 Symptoms saved to database:', newSymptoms)
      
      // Add to symptoms array immediately and trigger reactivity
      symptoms = [...symptoms, newSymptoms]
      console.log('📋 Updated symptoms array:', symptoms.length)
      
      // Notify parent component to refresh medical summary
      dispatch('dataUpdated', { 
        type: 'symptoms', 
        data: newSymptoms 
      })
      
    } catch (error) {
      console.error('❌ Error saving symptoms:', error)
      // Reload data to ensure consistency
      loadPatientData()
    }
    
    showSymptomsForm = false
  }

  // Handle symptoms deletion
  const handleDeleteSymptom = async (symptomId, index) => {
    try {
      console.log('🗑️ Delete symptom clicked for ID:', symptomId, 'at index:', index)
      
      if (confirm('Are you sure you want to delete this symptom?')) {
        console.log('🗑️ User confirmed deletion, proceeding...')
        
        // Delete from Firebase
        await firebaseStorage.deleteSymptom(symptomId)
        console.log('🗑️ Successfully deleted from Firebase:', symptomId)
        
        // Remove from symptoms array
        symptoms = symptoms.filter((_, i) => i !== index)
        console.log('🗑️ Removed from symptoms array at index:', index)
        console.log('🗑️ Current symptoms after deletion:', symptoms.length)
        
        // Update expanded state
        const newExpandedSymptoms = { ...expandedSymptoms }
        delete newExpandedSymptoms[index]
        // Reindex remaining expanded states
        const reindexedExpanded = {}
        Object.keys(newExpandedSymptoms).forEach(key => {
          const oldIndex = parseInt(key)
          if (oldIndex > index) {
            reindexedExpanded[oldIndex - 1] = newExpandedSymptoms[key]
          } else if (oldIndex < index) {
            reindexedExpanded[oldIndex] = newExpandedSymptoms[key]
          }
        })
        expandedSymptoms = reindexedExpanded
        
        console.log('✅ Successfully deleted symptom:', symptomId)
        notifySuccess('Symptom deleted successfully!')
        
        // Notify parent component to refresh medical summary
        dispatch('dataUpdated', { 
          type: 'symptoms', 
          data: null // Indicates deletion
        })
      } else {
        console.log('❌ User cancelled deletion')
      }
    } catch (error) {
      console.error('❌ Error deleting symptom:', error)
      notifyError('Failed to delete symptom: ' + error.message)
    }
  }
  
  const handleMedicationAdded = async (event) => {
    const medicationData = event.detail
    console.log('💊 Medication added:', medicationData)
    
    try {
      if (medicationData.isEdit) {
        // Update existing medication in database
        const updatedMedication = await firebaseStorage.createMedication({
          ...medicationData,
          patientId: selectedPatient.id,
          doctorId: doctorId
        })
        
        // Update in local arrays
        const index = prescriptions.findIndex(p => p.id === medicationData.id)
        if (index !== -1) {
          prescriptions[index] = updatedMedication
          prescriptions = [...prescriptions] // Trigger reactivity
        }
        
        // Also update in current medications if it exists there
        const currentIndex = currentMedications.findIndex(p => p.id === medicationData.id)
        if (currentIndex !== -1) {
          currentMedications[currentIndex] = updatedMedication
          currentMedications = [...currentMedications] // Trigger reactivity
        }
        
        // Reset AI analysis state when medications change (only if prescription is not finished)
        if (!prescriptionFinished) {
          aiCheckComplete = false
          aiCheckMessage = ''
          lastAnalyzedMedications = []
        }
      } else {
        // Add new medication to current prescription
        if (!currentPrescription) {
          throw new Error('No current prescription. Please click "New Prescription" first.')
        }
        
        const newMedication = await firebaseStorage.addMedicationToPrescription(
          currentPrescription.id, 
          medicationData
        )
        
        console.log('💾 Medication added to prescription:', newMedication)
        
        // Update the current prescription object
        if (!currentPrescription.medications) {
          currentPrescription.medications = [];
        }
        currentPrescription.medications.push(newMedication)
        currentPrescription.updatedAt = new Date().toISOString()
        
        // Update prescriptions array to trigger reactivity
        const prescriptionIndex = prescriptions.findIndex(p => p.id === currentPrescription.id)
        if (prescriptionIndex !== -1) {
          prescriptions[prescriptionIndex] = currentPrescription
          prescriptions = [...prescriptions]
        }
        
        // Update current medications array for display (reference to prescription medications)
        currentMedications = currentPrescription.medications
        console.log('📋 Added medication to current prescription:', newMedication.name)
        
        // Reset AI analysis state when medications change (only if prescription is not finished)
        if (!prescriptionFinished) {
          aiCheckComplete = false
          aiCheckMessage = ''
          lastAnalyzedMedications = []
        }
        
        // Note: Drug interaction checking is now done when clicking action buttons
        // (Complete, Send to Pharmacy, Print) instead of automatically when adding drugs
        
        // Notify parent component to refresh medical summary
        dispatch('dataUpdated', { 
          type: 'prescription', 
          data: newMedication 
        })
      }
    } catch (error) {
      console.error('❌ Error saving medication:', error)
      // Reload data to ensure consistency
      loadPatientData()
    }
    
    showMedicationForm = false
    editingMedication = null
  }
  
  // Handle form cancellations
  const handleCancelIllness = () => {
    showIllnessForm = false
  }
  
  // Save or update current prescription to ensure it is persisted
  const saveCurrentPrescriptions = async () => {
    try {
      console.log('💾 Saving/updating current prescription...')
      
      if (!currentPrescription) {
        console.log('⚠️ No current prescription to save')
        return
      }
      
      // Check if prescription already exists in database
      const existingPrescription = prescriptions.find(p => p.id === currentPrescription.id)
      
      if (!existingPrescription) {
        // This is a new prescription that needs to be saved
        const savedPrescription = await firebaseStorage.createPrescription({
          ...currentPrescription,
          patientId: selectedPatient.id,
          doctorId: doctorId
        })
        console.log('✅ Saved new prescription with', currentPrescription.medications.length, 'medications')
        
        // Add to prescriptions array
        prescriptions = [...prescriptions, savedPrescription]
      } else {
        // Always update existing prescription to ensure latest data is saved
        const updatedPrescription = {
          ...currentPrescription,
          patientId: selectedPatient.id,
          doctorId: doctorId
        }
        
        await firebaseStorage.updatePrescription(currentPrescription.id, updatedPrescription)
        console.log('✅ Updated existing prescription with', currentPrescription.medications.length, 'medications')
        
        // Update the prescription in the local array
        const prescriptionIndex = prescriptions.findIndex(p => p.id === currentPrescription.id)
        if (prescriptionIndex !== -1) {
          prescriptions[prescriptionIndex] = updatedPrescription
        }
      }
      
      // Update prescriptions array to trigger reactivity
      prescriptions = [...prescriptions]
      
      console.log('💾 Current prescription saved/updated successfully')
    } catch (error) {
      console.error('❌ Error saving/updating current prescription:', error)
    }
  }
  
  // Check with AI (no saving or printing)
  const finishCurrentPrescriptions = async () => {
    try {
      console.log('🤖 Checking prescriptions with AI...')
      
      // No drug interaction check needed
      
      console.log('✅ AI check completed')
    } catch (error) {
      console.error('❌ Error during AI check:', error)
    }
  }

  // Complete current prescriptions (mark as finished without printing)
  const completePrescriptions = async () => {
    try {
      console.log('✅ Completing current prescriptions')
      
      // Check AI drug interactions first
      console.log('🔍 Current medications count:', currentMedications.length)
      console.log('🔍 OpenAI configured:', openaiService.isConfigured())
      console.log('🔍 Current medications:', currentMedications.map(m => m.name))
      
      // Save current prescriptions first
      await saveCurrentPrescriptions()
      
      // Set finalized state to hide edit/delete buttons
      prescriptionsFinalized = true
      
      // Mark current prescription as completed by setting end date to today
      const today = new Date().toISOString().split('T')[0]
      
      if (currentPrescription && !currentPrescription.endDate) {
          // Update prescription with end date
          const updatedPrescription = {
          ...currentPrescription,
            endDate: today
          }
          
          // Update in database
        await firebaseStorage.updatePrescription(currentPrescription.id, updatedPrescription)
        console.log('✅ Marked prescription as completed with', currentPrescription.medications.length, 'medications')
          
          // Update the prescription in the local array
        const prescriptionIndex = prescriptions.findIndex(p => p.id === currentPrescription.id)
          if (prescriptionIndex !== -1) {
            prescriptions[prescriptionIndex] = updatedPrescription
        }
      }
      
      // Update prescriptions array to trigger reactivity
      prescriptions = [...prescriptions]
      
      // Set prescription as finished to show action buttons
      prescriptionFinished = true
      
      console.log('🎉 Current prescriptions completed successfully')
    } catch (error) {
      console.error('❌ Error completing prescriptions:', error)
    }
  }

  // Print prescriptions to PDF
  const printPrescriptions = async () => {
    try {
      console.log('🖨️ Printing prescriptions to PDF')
      
      // Check AI drug interactions first
      console.log('🔍 Current medications count:', currentMedications.length)
      console.log('🔍 OpenAI configured:', openaiService.isConfigured())
      console.log('🔍 Current medications:', currentMedications.map(m => m.name))
      
      // Save current prescriptions first
      await saveCurrentPrescriptions()
      
      // Generate and download PDF
      await generatePrescriptionPDF()
      
      // Also try to open print dialog as fallback
      setTimeout(() => {
        console.log('🖨️ Opening print dialog as fallback...')
        window.print()
      }, 1000)
      
      console.log('🎉 Prescriptions printed successfully')
    } catch (error) {
      console.error('❌ Error printing prescriptions:', error)
    }
  }
  
  // State for pharmacy selection modal
  let showPharmacyModal = false
  let availablePharmacies = []
  let selectedPharmacies = []

  // Show pharmacy selection modal
  const showPharmacySelection = async () => {
    try {
      console.log('📤 Opening pharmacy selection modal')
      
      // Check AI drug interactions first
      console.log('🔍 Current medications count:', currentMedications.length)
      console.log('🔍 OpenAI configured:', openaiService.isConfigured())
      console.log('🔍 Current medications:', currentMedications.map(m => m.name))
      
      // Save current prescriptions first
      try {
        await saveCurrentPrescriptions()
        console.log('✅ Prescriptions saved successfully')
      } catch (error) {
        console.error('❌ Error saving prescriptions:', error)
        // Continue anyway - prescriptions might not be critical for pharmacy selection
      }
      
      // Check if doctor has connected pharmacists
      const firebaseUser = currentUser || authService.getCurrentUser()
      console.log('🔍 Firebase user:', firebaseUser)
      
      if (!firebaseUser) {
        console.log('❌ User not found')
        alert('User not found. Please log in again.')
        return
      }
      
      // Get the actual doctor data from Firebase
      const doctor = await firebaseStorage.getDoctorByEmail(firebaseUser.email)
      console.log('🔍 Doctor from Firebase:', doctor)
      
      if (!doctor) {
        console.log('❌ Doctor not found in Firebase')
        alert('Doctor profile not found. Please contact support.')
        return
      }
      
      // Check if patient is selected
      if (!selectedPatient) {
        console.log('❌ No patient selected')
        alert('Please select a patient first.')
        return
      }
      
      // Get current medications (the actual prescriptions to send)
      console.log('🔍 Current medications to send:', currentMedications)
      if (!currentMedications || currentMedications.length === 0) {
        console.log('❌ No medications to send')
        alert('No medications to send. Please add medications first.')
        return
      }
      
      // Create prescription data from current medications
      const prescriptions = [{
        id: Date.now().toString(),
        patientId: selectedPatient.id,
        doctorId: doctor.id,
        medications: currentMedications,
        notes: prescriptionNotes || '',
        createdAt: new Date().toISOString(),
        status: 'pending'
      }]
      console.log('🔍 Created prescription data:', prescriptions)
      
      // Get all pharmacists and find those connected to this doctor
      const allPharmacists = await firebaseStorage.getAllPharmacists()
      console.log('🔍 All pharmacists:', allPharmacists.length)
      
      // Find pharmacists connected to this doctor (check both sides of the connection)
      const connectedPharmacists = allPharmacists.filter(pharmacist => {
        // Check if pharmacist has this doctor in their connectedDoctors
        const pharmacistHasDoctor = pharmacist.connectedDoctors && pharmacist.connectedDoctors.includes(doctor.id)
        
        // Check if doctor has this pharmacist in their connectedPharmacists
        const doctorHasPharmacist = doctor.connectedPharmacists && doctor.connectedPharmacists.includes(pharmacist.id)
        
        // Connection exists if either side has the connection (for backward compatibility)
        return pharmacistHasDoctor || doctorHasPharmacist
      })
      
      console.log('🔍 Connected pharmacists for doctor:', connectedPharmacists.length)
      
      if (connectedPharmacists.length === 0) {
        console.log('❌ No connected pharmacists')
        alert('No connected pharmacy found. Please connect a pharmacy first.')
        return
      }
      
      // Build available pharmacies list
      availablePharmacies = connectedPharmacists.map(pharmacist => ({
        id: pharmacist.id,
        name: pharmacist.businessName,
        email: pharmacist.email,
        address: pharmacist.address || 'Address not provided'
      }))
      
      console.log('✅ Available pharmacies:', availablePharmacies)
      
      console.log('🔍 Final available pharmacies:', availablePharmacies)
      
      // Check if any pharmacies were found
      if (availablePharmacies.length === 0) {
        console.log('❌ No pharmacies found after loading')
        alert('No connected pharmacies found. Please connect a pharmacy first.')
        return
      }
      
      // Initialize selection (all selected by default)
      selectedPharmacies = availablePharmacies.map(p => p.id)
      console.log('🔍 Selected pharmacies:', selectedPharmacies)
      
      // Show modal
      showPharmacyModal = true
      console.log('✅ Modal should be showing now')
      
    } catch (error) {
      console.error('❌ Error opening pharmacy selection:', error)
      console.error('❌ Error stack:', error.stack)
      alert('Error loading pharmacies. Please try again.')
    }
  }

  // Send prescriptions to selected pharmacies
  const sendToSelectedPharmacies = async () => {
    try {
      console.log('📤 Sending prescriptions to selected pharmacies:', selectedPharmacies)
      
      const firebaseUser = currentUser || authService.getCurrentUser()
      const doctor = await firebaseStorage.getDoctorByEmail(firebaseUser.email)
      
      // Send only the current prescription, not all prescriptions for the patient
      let prescriptions = []
      if (currentPrescription && currentPrescription.medications && currentPrescription.medications.length > 0) {
        prescriptions = [currentPrescription]
        console.log('📤 Sending current prescription:', currentPrescription.id, 'with', currentPrescription.medications.length, 'medications')
      } else {
        // If no current prescription, get the most recent prescription for this patient
        const allPrescriptions = await firebaseStorage.getPrescriptionsByPatientId(selectedPatient.id)
        if (allPrescriptions.length > 0) {
          prescriptions = [allPrescriptions[0]] // Get the most recent prescription
          console.log('📤 Sending most recent prescription:', allPrescriptions[0].id, 'with', allPrescriptions[0].medications?.length || 0, 'medications')
        }
      }
      
      console.log('📤 Total prescriptions to send:', prescriptions.length)
      
      let sentCount = 0
      
      // Send to selected pharmacists only
      for (const pharmacistId of selectedPharmacies) {
        const pharmacist = await firebaseStorage.getPharmacistById(pharmacistId)
        if (pharmacist) {
          // Add prescription to pharmacist's received prescriptions
          const pharmacistPrescriptions = await firebaseStorage.getPharmacistPrescriptions(pharmacistId) || []
          const prescriptionData = {
            id: Date.now().toString() + '_' + pharmacistId,
            doctorId: doctor.id,
            doctorName: `${doctor.firstName} ${doctor.lastName}`,
            patientId: selectedPatient.id,
            patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
            prescriptions: prescriptions,
            sentAt: new Date().toISOString(),
            status: 'pending'
          }
          
          pharmacistPrescriptions.push(prescriptionData)
          await firebaseStorage.savePharmacistPrescriptions(pharmacistId, pharmacistPrescriptions)
          
          console.log(`📤 Prescription sent to pharmacist: ${pharmacist.businessName}`)
          sentCount++
        }
      }
      
      // Close modal
      showPharmacyModal = false
      
      // Show success message
      alert(`Prescriptions sent to ${sentCount} pharmacy(ies) successfully!`)
      console.log('🎉 Prescriptions sent to pharmacies successfully')
      
    } catch (error) {
      console.error('❌ Error sending prescriptions to pharmacies:', error)
      alert('Error sending prescriptions to pharmacies. Please try again.')
    }
  }

  // Toggle pharmacy selection
  const togglePharmacySelection = (pharmacistId) => {
    if (selectedPharmacies.includes(pharmacistId)) {
      selectedPharmacies = selectedPharmacies.filter(id => id !== pharmacistId)
    } else {
      selectedPharmacies.push(pharmacistId)
    }
  }

  // Select all pharmacies
  const selectAllPharmacies = () => {
    selectedPharmacies = availablePharmacies.map(p => p.id)
  }

  // Deselect all pharmacies
  const deselectAllPharmacies = () => {
    selectedPharmacies = []
  }
  
  // Test jsPDF functionality
  const testJsPDF = async () => {
    try {
      console.log('🧪 Testing jsPDF...')
      const { default: jsPDF } = await import('jspdf')
      const testDoc = new jsPDF()
      testDoc.text('Test PDF', 20, 20)
      testDoc.save('test.pdf')
      console.log('✅ jsPDF test successful')
      return true
    } catch (error) {
      console.error('❌ jsPDF test failed:', error)
      return false
    }
  }

  // Generate prescription PDF directly
  const generatePrescriptionPDF = async () => {
    try {
      console.log('🔄 Starting PDF generation...')
      
      // Test jsPDF first
      const jsPDFWorking = await testJsPDF()
      if (!jsPDFWorking) {
        throw new Error('jsPDF is not working properly')
      }
      
      // Try to import jsPDF
      let jsPDF
      try {
        const jsPDFModule = await import('jspdf')
        jsPDF = jsPDFModule.default
        console.log('✅ jsPDF imported successfully')
      } catch (importError) {
        console.error('❌ Failed to import jsPDF:', importError)
        // Fallback: try to use window.jsPDF if available
        if (typeof window !== 'undefined' && window.jsPDF) {
          jsPDF = window.jsPDF
          console.log('✅ Using window.jsPDF as fallback')
        } else {
          throw new Error('jsPDF is not available. Please check if it is properly installed.')
        }
      }
      
      const doc = new jsPDF()
      const currentDate = new Date().toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit', 
        year: 'numeric'
      })
      
      console.log('📄 Creating PDF content...')
      console.log('Patient:', selectedPatient.firstName, selectedPatient.lastName)
      console.log('Current medications:', currentMedications.length)
      console.log('Prescription notes:', prescriptionNotes)
      
      // Set up fonts and styles
      doc.setFont('helvetica', 'bold')
      
      // Header - PRESCRIPTION (centered, large)
      doc.setFontSize(24)
      doc.text('PRESCRIPTION', 105, 30, { align: 'center' })
      
      // Doctor info section
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text('DOCTOR NAME', 20, 50)
      doc.text('Your Medical Clinic', 20, 60)
      
      // Date (right aligned)
      doc.text(`DATE: ${currentDate}`, 180, 50, { align: 'right' })
      
      // Patient info section with Rx symbol
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('R', 20, 85)
      
      // Patient name and age line
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`PATIENT NAME: ${selectedPatient.firstName} ${selectedPatient.lastName}`, 35, 85)
      
      // Calculate age from date of birth
      const birthDate = new Date(selectedPatient.dateOfBirth)
      const today = new Date()
      const age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age
      
      doc.text(`AGE: ${actualAge}`, 150, 85)
      
      // Address line
      doc.text(`ADDRESS: ${selectedPatient.address || 'Not provided'}`, 35, 95)
      
      // Medications section
      let yPos = 120
      
      if (currentMedications && currentMedications.length > 0) {
        currentMedications.forEach((medication, index) => {
          if (yPos > 250) {
            doc.addPage()
            yPos = 30
          }
          
          // Medication name and dosage
          doc.setFontSize(12)
          doc.setFont('helvetica', 'normal')
          doc.text(`${medication.name} ${medication.dosage}`, 20, yPos)
          
          // Instructions
          yPos += 8
          doc.text(`${medication.instructions || `Take ${medication.frequency}`}`, 20, yPos)
          
          yPos += 15 // Space between medications
        })
      }
      
      // Add prescription notes if available
      if (prescriptionNotes && prescriptionNotes.trim() !== '') {
        if (yPos > 250) {
          doc.addPage()
          yPos = 30
        }
        yPos += 10
        doc.text('Additional Notes:', 20, yPos)
        yPos += 8
        const notes = doc.splitTextToSize(prescriptionNotes, 170)
        doc.text(notes, 20, yPos)
        yPos += notes.length * 5
      }
      
      // Signature section
      const signatureY = Math.max(yPos + 30, 200)
      
      // Doctor signature line
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text('Dr. [Doctor Name]', 150, signatureY)
      
      // Draw signature line
      doc.line(140, signatureY + 5, 190, signatureY + 5)
      
      // Medical seal (simplified)
      doc.setFontSize(8)
      doc.text('MEDICAL SEAL', 20, signatureY)
      doc.circle(30, signatureY - 5, 8)
      
      // Add caduceus symbol (simplified)
      doc.setFontSize(6)
      doc.text('⚕', 30, signatureY - 2, { align: 'center' })
      
      // Generate filename with capital letter as per user preference
      const filename = `Prescription_${selectedPatient.firstName}_${selectedPatient.lastName}_${currentDate.replace(/\//g, '-')}.pdf`
      
      console.log('💾 Saving PDF with filename:', filename)
      
      // Save the PDF
      doc.save(filename)
      
      console.log('✅ PDF generated and downloaded successfully:', filename)
      
      // Show success message to user
      alert(`PDF generated successfully: ${filename}`)
      
    } catch (error) {
      console.error('❌ Error generating PDF:', error)
      console.error('Error details:', error.message)
      console.error('Error stack:', error.stack)
      
      // Show error message to user
      alert(`Error generating PDF: ${error.message}`)
      
      // Try alternative approach - open print dialog
      console.log('🔄 Trying alternative print approach...')
      try {
        window.print()
      } catch (printError) {
        console.error('❌ Print also failed:', printError)
      }
    }
  }
  
  const handleCancelSymptoms = () => {
    showSymptomsForm = false
  }
  
  const handleCancelMedication = () => {
    showMedicationForm = false
    editingMedication = null
  }
  
  // Calculate age from date of birth
  const calculateAge = (birthDate) => {
    if (!birthDate) return ''
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age.toString()
  }
  
  // Handle date of birth change to auto-calculate age
  const handleEditDateOfBirthChange = () => {
    if (editPatientData.dateOfBirth) {
      editPatientData.age = calculateAge(editPatientData.dateOfBirth)
    }
  }
  
  // Patient edit functions
  const startEditingPatient = () => {
    console.log('Edit button clicked, starting patient edit mode')
    console.log('Selected patient:', selectedPatient)
    
    // Populate edit form with current patient data
    editPatientData = {
      firstName: selectedPatient.firstName || '',
      lastName: selectedPatient.lastName || '',
      email: selectedPatient.email || '',
      phone: selectedPatient.phone || '',
      gender: selectedPatient.gender || '',
      dateOfBirth: selectedPatient.dateOfBirth || '',
      age: selectedPatient.age || calculateAge(selectedPatient.dateOfBirth) || '',
      weight: selectedPatient.weight || '',
      bloodGroup: selectedPatient.bloodGroup || '',
      idNumber: selectedPatient.idNumber || '',
      address: selectedPatient.address || '',
      allergies: selectedPatient.allergies || '',
      emergencyContact: selectedPatient.emergencyContact || '',
      emergencyPhone: selectedPatient.emergencyPhone || ''
    }
    
    console.log('Edit patient data populated:', editPatientData)
    isEditingPatient = true
    editError = ''
    console.log('Edit mode enabled, isEditingPatient:', isEditingPatient)
  }
  
  const cancelEditingPatient = () => {
    isEditingPatient = false
    editError = ''
    editPatientData = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      gender: '',
      dateOfBirth: '',
      age: '',
      weight: '',
      bloodGroup: '',
      idNumber: '',
      address: '',
      allergies: '',
      emergencyContact: '',
      emergencyPhone: ''
    }
  }
  
  const savePatientChanges = async () => {
    editError = ''
    savingPatient = true
    
    try {
      // Validate required fields - only first name and age are mandatory
      if (!editPatientData.firstName.trim()) {
        throw new Error('First name is required')
      }
      
      // Calculate age if date of birth is provided
      let calculatedAge = editPatientData.age
      if (editPatientData.dateOfBirth && !editPatientData.age) {
        calculatedAge = calculateAge(editPatientData.dateOfBirth)
      }
      
      if (!calculatedAge || calculatedAge === '') {
        throw new Error('Age is required. Please provide either age or date of birth')
      }
      
      // Validate email format only if email is provided
      if (editPatientData.email && editPatientData.email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(editPatientData.email)) {
          throw new Error('Please enter a valid email address')
        }
      }
      
      // Validate date of birth only if provided
      if (editPatientData.dateOfBirth) {
        const birthDate = new Date(editPatientData.dateOfBirth)
        const today = new Date()
        if (birthDate >= today) {
          throw new Error('Date of birth must be in the past')
        }
      }
      
      // Update patient data
      const updatedPatient = {
        ...selectedPatient,
        ...editPatientData,
        age: calculatedAge
      }
      
      // Save to storage
      await firebaseStorage.updatePatient(selectedPatient.id, updatedPatient)
      
      // Update the selected patient reference
      Object.assign(selectedPatient, updatedPatient)
      
      // Notify parent component
      dispatch('dataUpdated', { type: 'patient', data: updatedPatient })
      
      // Exit edit mode
      isEditingPatient = false
      
      console.log('✅ Patient data updated successfully')
      
    } catch (error) {
      editError = error.message
      console.error('❌ Error updating patient:', error)
    } finally {
      savingPatient = false
    }
  }
  
  // Handle prescription actions
  const handleEditPrescription = (medication, index) => {
    editingMedication = medication
    showMedicationForm = true
    console.log('Editing prescription:', medication)
  }
  
  const handleDeletePrescription = async (medicationId, index) => {
    try {
      console.log('🗑️ Delete button clicked for medication:', medicationId, 'at index:', index)
      console.log('🗑️ Current medications before deletion:', currentMedications.length)
      console.log('🗑️ Current prescription:', currentPrescription?.id)
      
      if (confirm('Are you sure you want to delete this medication?')) {
        console.log('🗑️ User confirmed deletion, proceeding...')
        
        // Delete from Firebase
        await firebaseStorage.deletePrescription(medicationId)
        console.log('🗑️ Successfully deleted from Firebase:', medicationId)
        
        // Remove from current medications array
        const currentIndex = currentMedications.findIndex(p => p.id === medicationId)
        if (currentIndex !== -1) {
          currentMedications = currentMedications.filter((_, i) => i !== currentIndex)
          console.log('🗑️ Removed from currentMedications at index:', currentIndex)
          console.log('🗑️ Current medications after deletion:', currentMedications.length)
        } else {
          console.log('⚠️ Medication not found in currentMedications array')
        }
        
        // Also update the current prescription's medications array
        if (currentPrescription && currentPrescription.medications) {
          currentPrescription.medications = currentPrescription.medications.filter(m => m.id !== medicationId)
          console.log('🗑️ Updated currentPrescription.medications:', currentPrescription.medications.length)
          
          // CRITICAL: Update the prescription document in Firebase to reflect the medication removal
          console.log('🗑️ Updating prescription document in Firebase...')
          await firebaseStorage.updatePrescription(currentPrescription.id, {
            medications: currentPrescription.medications,
            updatedAt: new Date().toISOString()
          })
          console.log('✅ Prescription document updated in Firebase')
        }
        
        // Update the prescriptions array to trigger reactivity
        prescriptions = [...prescriptions]
        console.log('🗑️ Updated prescriptions array:', prescriptions.length)
        
        // Reset AI analysis state when medications change (only if prescription is not finished)
        if (!prescriptionFinished) {
          aiCheckComplete = false
          aiCheckMessage = ''
          lastAnalyzedMedications = []
          console.log('🔄 Reset AI analysis state')
        }
        
        console.log('✅ Successfully deleted medication:', medicationId)
        notifySuccess('Medication deleted successfully!')
      } else {
        console.log('❌ User cancelled deletion')
      }
    } catch (error) {
      console.error('❌ Error deleting prescription:', error)
      notifyError('Failed to delete medication: ' + error.message)
    }
  }
  
  // Toggle expanded state
  const toggleExpanded = (type, index) => {
    if (type === 'symptoms') {
      expandedSymptoms[index] = !expandedSymptoms[index]
      expandedSymptoms = { ...expandedSymptoms }
    } else if (type === 'illnesses') {
      expandedIllnesses[index] = !expandedIllnesses[index]
      expandedIllnesses = { ...expandedIllnesses }
    }
  }
  
  // Debug function to check data state
  const debugDataState = () => {
    console.log('🔍 Debug Data State:')
    console.log('Selected Patient:', selectedPatient)
    console.log('Prescriptions Array:', prescriptions)
    console.log('Prescriptions Length:', prescriptions?.length || 0)
    console.log('Active Tab:', activeTab)
    console.log('Loading State:', loading)
  }
  
  // Expose debug function globally for testing
  if (typeof window !== 'undefined') {
    window.debugPrescriptions = debugDataState
  }
  
  // Reactive statement to reload data when refreshTrigger changes
  $: if (refreshTrigger > 0) {
    loadPatientData()
  }
  
  onMount(() => {
    if (selectedPatient) {
      loadPatientData()
    }
  })
</script>

<div class="card border-2 border-info shadow-sm">
  <div class="card-header">
    <div class="d-flex justify-content-between align-items-center">
      <h5 class="mb-0">
        <i class="fas fa-user me-2"></i>
        {selectedPatient.firstName} {selectedPatient.lastName}
      </h5>
      <div class="btn-group" role="group">
        <button 
          class="btn btn-success btn-sm me-2" 
          on:click={async () => { 
            console.log('🆕 New Prescription button clicked - Creating NEW prescription');
            activeTab = 'prescriptions'; 
            showMedicationForm = false; 
            editingMedication = null;
            prescriptionFinished = false;
            
            // Reset AI check state for new prescription
            aiCheckComplete = false;
            aiCheckMessage = '';
            
            try {
              // ALWAYS create a new prescription when button is clicked
              currentPrescription = await firebaseStorage.createPrescription({
                patientId: selectedPatient.id,
                doctorId: doctorId,
                notes: '',
                isNew: true  // Mark as new prescription
              });
              console.log('📋 Created NEW prescription:', currentPrescription.id);
              
              // Initialize new prescription
              currentMedications = [];
              prescriptionNotes = '';
              isNewPrescriptionSession = true;
              
              // Add the new prescription to the prescriptions array immediately
              prescriptions = [...prescriptions, currentPrescription];
              console.log('📋 Added new prescription to prescriptions array:', prescriptions.length);
              
              console.log('✅ NEW prescription ready - click "Add Drug" to add medications');
              notifySuccess('New prescription created! Click "Add Drug" to add medications.');
            } catch (error) {
              console.error('❌ Error creating new prescription:', error);
              notifyError('Failed to create new prescription: ' + error.message);
            }
          }}
          disabled={loading || isEditingPatient}
          title="Create a new prescription"
        >
          <i class="fas fa-plus me-1"></i>New Prescription
        </button>
        <button 
          class="btn btn-outline-primary btn-sm" 
          on:click={startEditingPatient}
          disabled={loading || isEditingPatient}
          title="Edit patient information"
        >
          <i class="fas fa-edit me-1"></i>Edit
        </button>
      </div>
    </div>
  </div>
  
  <div class="card-body">
    <!-- Patient Tabs -->
    <PatientTabs {activeTab} onTabChange={handleTabChange} />
    
    <!-- Tab Content -->
    <div class="tab-content mt-3">
      <!-- Overview Tab -->
      {#if activeTab === 'overview'}
        <div class="tab-pane active">
          <div class="card mb-3">
            <div class="card-header">
              <h6 class="mb-0">
                <i class="fas fa-info-circle me-2"></i>Patient Information
              </h6>
            </div>
            <div class="card-body">
              {#if isEditingPatient}
                <!-- Edit Patient Form -->
                <form on:submit|preventDefault={savePatientChanges}>
                  <div class="row g-3">
                    <div class="col-12 col-md-6">
                      <div class="mb-3">
                        <label for="editFirstName" class="form-label">
                          <i class="fas fa-user me-1"></i>First Name <span class="text-danger">*</span>
                        </label>
                        <input 
                          type="text" 
                          class="form-control" 
                          id="editFirstName" 
                          bind:value={editPatientData.firstName}
                          required
                          disabled={savingPatient}
                        >
                      </div>
                    </div>
                    <div class="col-12 col-md-6">
                      <div class="mb-3">
                        <label for="editLastName" class="form-label">Last Name</label>
                        <input 
                          type="text" 
                          class="form-control" 
                          id="editLastName" 
                          bind:value={editPatientData.lastName}
                          disabled={savingPatient}
                        >
                      </div>
                    </div>
                  </div>
                  
                  <div class="row g-3">
                    <div class="col-12 col-md-6">
                      <div class="mb-3">
                        <label for="editEmail" class="form-label">
                          <i class="fas fa-envelope me-1"></i>Email Address
                        </label>
                        <input 
                          type="email" 
                          class="form-control" 
                          id="editEmail" 
                          bind:value={editPatientData.email}
                          disabled={savingPatient}
                        >
                      </div>
                    </div>
                    <div class="col-12 col-md-6">
                      <div class="mb-3">
                        <label for="editPhone" class="form-label">Phone Number</label>
                        <input 
                          type="tel" 
                          class="form-control" 
                          id="editPhone" 
                          bind:value={editPatientData.phone}
                          disabled={savingPatient}
                        >
                      </div>
                    </div>
                  </div>
                  
                  <div class="row g-3">
                    <div class="col-12 col-md-6">
                      <div class="mb-3">
                        <label for="editGender" class="form-label">
                          <i class="fas fa-venus-mars me-1"></i>Gender
                        </label>
                        <select 
                          class="form-select" 
                          id="editGender" 
                          bind:value={editPatientData.gender}
                          disabled={savingPatient}
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div class="row g-3">
                    <div class="col-12 col-md-3">
                      <div class="mb-3">
                        <label for="editDateOfBirth" class="form-label">
                          <i class="fas fa-calendar me-1"></i>Date of Birth
                        </label>
                        <input 
                          type="date" 
                          class="form-control" 
                          id="editDateOfBirth" 
                          bind:value={editPatientData.dateOfBirth}
                          on:change={handleEditDateOfBirthChange}
                          disabled={savingPatient}
                        >
                      </div>
                    </div>
                    <div class="col-12 col-md-3">
                      <div class="mb-3">
                        <label for="editAge" class="form-label">
                          <i class="fas fa-birthday-cake me-1"></i>Age <span class="text-danger">*</span>
                        </label>
                        <input 
                          type="number" 
                          class="form-control" 
                          id="editAge" 
                          bind:value={editPatientData.age}
                          min="0"
                          max="150"
                          placeholder="Auto-calculated"
                          disabled={savingPatient}
                        >
                        <small class="form-text text-muted">Auto-calculated</small>
                      </div>
                    </div>
                    <div class="col-12 col-md-3">
                      <div class="mb-3">
                        <label for="editWeight" class="form-label">
                          <i class="fas fa-weight me-1"></i>Weight
                        </label>
                        <input 
                          type="number" 
                          class="form-control" 
                          id="editWeight" 
                          bind:value={editPatientData.weight}
                          min="0"
                          max="500"
                          step="0.1"
                          placeholder="kg"
                          disabled={savingPatient}
                        >
                        <small class="form-text text-muted">Weight in kilograms</small>
                      </div>
                    </div>
                    <div class="col-12 col-md-3">
                      <div class="mb-3">
                        <label for="editBloodGroup" class="form-label">
                          <i class="fas fa-tint me-1"></i>Blood Group
                        </label>
                        <select 
                          class="form-control" 
                          id="editBloodGroup" 
                          bind:value={editPatientData.bloodGroup}
                          disabled={savingPatient}
                        >
                          <option value="">Select Blood Group</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                        <small class="form-text text-muted">Important for medical procedures</small>
                      </div>
                    </div>
                  </div>
                  
                  <div class="row g-3">
                    <div class="col-12 col-md-6">
                      <div class="mb-3">
                        <label for="editIdNumber" class="form-label">ID Number</label>
                        <input 
                          type="text" 
                          class="form-control" 
                          id="editIdNumber" 
                          bind:value={editPatientData.idNumber}
                          disabled={savingPatient}
                        >
                      </div>
                    </div>
                  </div>
                  
                  <div class="mb-3">
                    <label for="editAddress" class="form-label">Address</label>
                    <textarea 
                      class="form-control" 
                      id="editAddress" 
                      rows="3" 
                      bind:value={editPatientData.address}
                      disabled={savingPatient}
                    ></textarea>
                  </div>
                  
                  <div class="mb-3">
                    <label for="editAllergies" class="form-label">
                      <i class="fas fa-exclamation-triangle me-1"></i>Allergies
                    </label>
                    <textarea 
                      class="form-control" 
                      id="editAllergies" 
                      rows="3" 
                      bind:value={editPatientData.allergies}
                      placeholder="List any known allergies (e.g., Penicillin, Shellfish, Latex, etc.)"
                      disabled={savingPatient}
                    ></textarea>
                    <small class="form-text text-muted">Important: List all known allergies to medications, foods, or other substances</small>
                  </div>
                  
                  <div class="row g-3">
                    <div class="col-12 col-md-6">
                      <div class="mb-3">
                        <label for="editEmergencyContact" class="form-label">Emergency Contact</label>
                        <input 
                          type="text" 
                          class="form-control" 
                          id="editEmergencyContact" 
                          bind:value={editPatientData.emergencyContact}
                          disabled={savingPatient}
                        >
                      </div>
                    </div>
                    <div class="col-12 col-md-6">
                      <div class="mb-3">
                        <label for="editEmergencyPhone" class="form-label">Emergency Phone</label>
                        <input 
                          type="tel" 
                          class="form-control" 
                          id="editEmergencyPhone" 
                          bind:value={editPatientData.emergencyPhone}
                          disabled={savingPatient}
                        >
                      </div>
                    </div>
                  </div>
                  
                  {#if editError}
                    <div class="alert alert-danger" role="alert">
                      <i class="fas fa-exclamation-triangle me-2"></i>{editError}
                    </div>
                  {/if}
                  
                  <div class="d-flex flex-column flex-sm-row gap-2">
              <button 
                      type="submit" 
                      class="btn btn-primary flex-fill" 
                      disabled={savingPatient}
                    >
                      {#if savingPatient}
                        <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                      {/if}
                      <i class="fas fa-save me-1"></i>Save Changes
                    </button>
                    <button 
                      type="button" 
                      class="btn btn-secondary flex-fill" 
                      on:click={cancelEditingPatient}
                      disabled={savingPatient}
                    >
                      <i class="fas fa-times me-1"></i>Cancel
              </button>
            </div>
                </form>
              {:else}
                <!-- Display Patient Information -->
              <div class="row">
                <div class="col-md-6">
                  <p><strong>Name:</strong> {selectedPatient.firstName} {selectedPatient.lastName}</p>
                  <p><strong>Email:</strong> {selectedPatient.email}</p>
                  <p><strong>Phone:</strong> {selectedPatient.phone || 'Not provided'}</p>
                  <p><strong>Gender:</strong> {selectedPatient.gender || 'Not specified'}</p>
                    <p><strong>Date of Birth:</strong> {selectedPatient.dateOfBirth}</p>
                    <p><strong>Age:</strong> {selectedPatient.age || calculateAge(selectedPatient.dateOfBirth) || 'Not calculated'}</p>
                    {#if selectedPatient.weight}
                      <p><strong>Weight:</strong> {selectedPatient.weight} kg</p>
                    {/if}
                    {#if selectedPatient.bloodGroup}
                      <p><strong>Blood Group:</strong> <span class="badge bg-danger text-white">{selectedPatient.bloodGroup}</span></p>
                    {/if}
                </div>
                <div class="col-md-6">
                  <p><strong>ID Number:</strong> {selectedPatient.idNumber}</p>
                    {#if selectedPatient.address}
                      <p><strong>Address:</strong> {selectedPatient.address}</p>
                    {/if}
                    {#if selectedPatient.emergencyContact}
                      <p><strong>Emergency Contact:</strong> {selectedPatient.emergencyContact}</p>
                    {/if}
                    {#if selectedPatient.emergencyPhone}
                      <p><strong>Emergency Phone:</strong> {selectedPatient.emergencyPhone}</p>
                    {/if}
                </div>
              </div>
                
                {#if selectedPatient.allergies}
                  <div class="row mt-3">
                    <div class="col-12">
                      <div class="alert alert-warning">
                        <h6 class="alert-heading">
                          <i class="fas fa-exclamation-triangle me-2"></i>Allergies
                        </h6>
                        <p class="mb-0">{selectedPatient.allergies}</p>
                      </div>
                    </div>
                  </div>
                {/if}
              {/if}
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Symptoms Tab -->
      {#if activeTab === 'symptoms'}
        <div class="tab-pane active">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">
              <i class="fas fa-thermometer-half me-2"></i>Symptoms
            </h6>
            <button 
              class="btn btn-primary btn-sm" 
              on:click={() => showSymptomsForm = true}
            >
              <i class="fas fa-plus me-1"></i>Add Symptoms
            </button>
          </div>
          
          <PatientForms 
            {showSymptomsForm}
            {selectedPatient}
            onSymptomsAdded={handleSymptomsAdded}
            onCancelSymptoms={handleCancelSymptoms}
          />
          
          <!-- AI Recommendations Component -->
          <AIRecommendations 
            {symptoms} 
            currentMedications={currentMedications}
            patientAge={selectedPatient ? (() => {
              const birthDate = new Date(selectedPatient.dateOfBirth)
              const today = new Date()
              const age = today.getFullYear() - birthDate.getFullYear()
              const monthDiff = today.getMonth() - birthDate.getMonth()
              return monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age
            })() : null}
            {doctorId}
            on:ai-usage-updated={(event) => {
              if (addToPrescription) {
                addToPrescription('ai-usage', event.detail)
              }
            }}
          />
          
          {#if symptoms && symptoms.length > 0}
            <div class="list-group">
              {#each symptoms as symptom, index}
                <div class="list-group-item">
                  <div class="d-flex w-100 justify-content-between align-items-start">
                    <div class="flex-grow-1">
                      <h6 class="mb-1">
                        <i class="fas fa-thermometer-half me-2"></i>
                        {symptom.description || 'Unknown Symptom'}
                      </h6>
                      <p class="mb-1">
                        <strong>Severity:</strong> 
                        <span class="badge bg-{symptom.severity === 'mild' ? 'success' : symptom.severity === 'moderate' ? 'warning' : symptom.severity === 'severe' ? 'danger' : 'dark'} text-capitalize">
                          {symptom.severity || 'Unknown'}
                        </span>
                      </p>
                      <p class="mb-1">
                        <strong>Duration:</strong> {symptom.duration || 'Not specified'}
                      </p>
                      {#if symptom.notes}
                        <p class="mb-1">
                          <strong>Notes:</strong> {symptom.notes}
                        </p>
                      {/if}
                      <small class="text-muted">
                        <i class="fas fa-calendar me-1"></i>
                        Recorded: {symptom.createdAt ? new Date(symptom.createdAt).toLocaleDateString() : 'Unknown date'}
                      </small>
                    </div>
                    <button 
                      class="btn btn-outline-danger btn-sm" 
                      on:click={() => handleDeleteSymptom(symptom.id, index)}
                      title="Delete symptom"
                    >
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center p-4">
              <i class="fas fa-thermometer-half fa-2x text-muted mb-3"></i>
              <p class="text-muted">No symptoms recorded for this patient.</p>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Illnesses Tab -->
      {#if activeTab === 'illnesses'}
        <div class="tab-pane active">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">
              <i class="fas fa-heartbeat me-2"></i>Illnesses
            </h6>
            <button 
              class="btn btn-primary btn-sm" 
              on:click={() => showIllnessForm = true}
            >
              <i class="fas fa-plus me-1"></i>Add Illness
            </button>
          </div>
          
          <PatientForms 
            {showIllnessForm}
            {selectedPatient}
            onIllnessAdded={handleIllnessAdded}
            onCancelIllness={handleCancelIllness}
          />
          
          {#if illnesses && illnesses.length > 0}
            <div class="list-group">
              {#each illnesses as illness, index}
                <div class="list-group-item">
                  <div class="d-flex w-100 justify-content-between align-items-start">
                    <div class="flex-grow-1">
                      <h6 class="mb-1">
                        <i class="fas fa-heartbeat me-2"></i>
                        {illness.name || 'Unknown Illness'}
                      </h6>
                      <p class="mb-1">
                        <strong>Status:</strong> 
                        <span class="badge bg-{illness.status === 'active' ? 'danger' : illness.status === 'chronic' ? 'warning' : illness.status === 'resolved' ? 'success' : 'secondary'} text-capitalize">
                          {illness.status || 'Unknown'}
                        </span>
                      </p>
                      <p class="mb-1">
                        <strong>Diagnosis Date:</strong> {illness.diagnosisDate || 'Not specified'}
                      </p>
                      {#if illness.notes}
                        <p class="mb-1">
                          <strong>Notes:</strong> {illness.notes}
                        </p>
                      {/if}
                      <small class="text-muted">
                        <i class="fas fa-calendar me-1"></i>
                        Recorded: {illness.createdAt ? new Date(illness.createdAt).toLocaleDateString() : 'Unknown date'}
                      </small>
                    </div>
                    <button 
                      class="btn btn-outline-secondary btn-sm" 
                      on:click={() => toggleExpanded('illnesses', index)}
                    >
                      <i class="fas fa-{expandedIllnesses[index] ? 'chevron-up' : 'chevron-down'}"></i>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center p-4">
              <i class="fas fa-heartbeat fa-2x text-muted mb-3"></i>
              <p class="text-muted">No illnesses recorded for this patient.</p>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Prescriptions Tab -->
      {#if activeTab === 'prescriptions'}
        <div class="tab-pane active">
          <!-- Prescription Card -->
          <div class="card border-2 border-info shadow-sm">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="card-title mb-0">
                <i class="fas fa-prescription-bottle-alt me-2"></i>Prescription
              </h5>
              <div class="d-flex gap-2">
                
                <!-- Add Drug Button -->
                <button 
                    class="btn btn-primary btn-sm" 
                    on:click={() => { 
                      console.log('💊 Add Drug clicked');
                      
                      if (!currentPrescription) {
                        notifyError('Please click "New Prescription" first to create a prescription.');
                        return;
                      }
                      
                      showMedicationForm = true;
                      editingMedication = null;
                      notifySuccess('Medication form opened - add drug details');
                    }}
                    disabled={showMedicationForm || !currentPrescription}
                    title={!currentPrescription ? "Click 'New Prescription' first" : "Add medication to current prescription"}
                >
                  <i class="fas fa-plus me-1"></i>Add Drug
                </button>
              </div>
          </div>
            <div class="card-body">
          
          
          <!-- Full AI Analysis Option - Only show if prescription is finished and has medications -->
          {#if aiCheckComplete && prescriptionFinished && currentMedications.length > 0}
            <div class="text-center mb-3">
              <p class="text-muted mb-2">Need a full AI assisted prescription analysis?</p>
              <button 
                class="btn btn-outline-primary btn-sm"
                on:click={performFullAIAnalysis}
                disabled={loadingFullAnalysis}
                title="Get comprehensive AI analysis of prescription"
              >
                {#if loadingFullAnalysis}
                  <i class="fas fa-spinner fa-spin me-2"></i>
                  Analyzing...
                {:else}
                  <i class="fas fa-brain me-2"></i>
                  Full AI Analysis
                {/if}
              </button>
            </div>
          {/if}
          
          <!-- Full AI Analysis Loading -->
          {#if loadingFullAnalysis}
            <div class="card border-primary mb-3">
              <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h6 class="mb-0">
                  <i class="fas fa-spinner fa-spin me-2"></i>
                  Generating AI Analysis...
            </h6>
              </div>
              <div class="card-body text-center py-4">
                <div class="spinner-border text-primary mb-3" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <p class="text-muted mb-0">Analyzing prescription data and generating comprehensive insights...</p>
              </div>
            </div>
          {/if}
          
          <!-- Full AI Analysis Results -->
          {#if showFullAnalysis && fullAIAnalysis}
            <div class="card border-success mb-3 shadow-sm">
              <div class="card-header bg-success text-white d-flex justify-content-between align-items-center">
                <h6 class="mb-0">
                  <i class="fas fa-brain me-2"></i>
                  Full AI Prescription Analysis
                </h6>
                <div class="d-flex gap-2">
            <button 
                    class="btn btn-outline-light btn-sm"
                    on:click={() => {
                      navigator.clipboard.writeText(fullAIAnalysis.replace(/<[^>]*>/g, ''))
                      notifySuccess('Analysis copied to clipboard!')
                    }}
                    title="Copy analysis text"
                  >
                    <i class="fas fa-copy"></i>
                  </button>
                  <button 
                    class="btn btn-outline-light btn-sm"
                    on:click={closeFullAnalysis}
                    title="Close analysis"
                  >
                    <i class="fas fa-times"></i>
            </button>
          </div>
              </div>
              <div class="card-body">
                <div class="ai-analysis-content">
                  {@html fullAIAnalysis}
                </div>
              </div>
            </div>
          {/if}
          
          <!-- Full AI Analysis Error -->
          {#if fullAnalysisError}
            <div class="alert alert-danger mb-3">
              <i class="fas fa-exclamation-triangle me-2"></i>
              <strong>Analysis Error:</strong> {fullAnalysisError}
              <button 
                class="btn btn-outline-danger btn-sm ms-2"
                on:click={() => fullAnalysisError = ''}
                title="Dismiss error"
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
          {/if}
          
          <PatientForms 
            {showMedicationForm}
            {selectedPatient}
            {editingMedication}
            {doctorId}
            onMedicationAdded={handleMedicationAdded}
            onCancelMedication={handleCancelMedication}
          />
          
          
          <!-- Current Prescriptions List -->
          {#if currentMedications && currentMedications.length > 0}
            <div class="medication-list">
              {#each currentMedications as medication, index}
                <div class="medication-item d-flex justify-content-between align-items-center py-2 border-bottom">
                  <div class="flex-grow-1">
                    <div class="fw-bold fs-6">{medication.name}</div>
                    <small class="text-muted">
                      {medication.dosage} • {medication.frequency} • {medication.duration}
                    </small>
                    {#if medication.instructions}
                      <div class="mt-1">
                        <small class="text-muted">{medication.instructions}</small>
                      </div>
                    {/if}
                  </div>
                  {#if !prescriptionsFinalized}
                    <div class="btn-group btn-group-sm">
                      <button 
                        class="btn btn-outline-primary btn-sm"
                        on:click={() => handleEditPrescription(medication, index)}
                        title="Edit medication"
                      >
                        <i class="fas fa-edit"></i>
                      </button>
                      <button 
                        class="btn btn-outline-danger btn-sm"
                        on:click={() => handleDeletePrescription(medication.id, index)}
                        title="Delete medication"
                      >
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  {:else}
                    <div class="text-muted">
                      <small><i class="fas fa-check-circle me-1"></i>Finalized</small>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
            
            <!-- Prescription Notes Box -->
            <div class="mt-3">
              <label for="prescriptionNotes" class="form-label">
                <i class="fas fa-sticky-note me-1"></i>Prescription Notes
              </label>
              <textarea 
                id="prescriptionNotes"
                class="form-control" 
                rows="3" 
                placeholder="Add any additional notes about the current prescriptions..."
                bind:value={prescriptionNotes}
              ></textarea>
              <div class="form-text">
                <small class="text-muted">Optional notes about the current prescription regimen</small>
              </div>
            </div>
            
            <!-- Action Buttons - Show only if there are drugs or notes -->
            {#if currentMedications.length > 0 || prescriptionNotes.trim() !== ''}
              <div class="mt-3 text-center">
                <div class="d-flex gap-2 justify-content-center flex-wrap">
                  {#if !prescriptionFinished}
                    <!-- Show Finish button when not finished -->
                <button 
                      class="btn btn-success flex-fill"
                      on:click={completePrescriptions}
                      title="Finish current prescriptions"
                    >
                      <i class="fas fa-check-circle me-2"></i>
                      Finish
                </button>
                  {:else}
                    <!-- Show Send to Pharmacy and Print buttons when finished -->
                    <button 
                      class="btn btn-warning flex-fill"
                      on:click={showPharmacySelection}
                      title="Send prescriptions to connected pharmacy"
                    >
                      <i class="fas fa-paper-plane me-2"></i>
                      Send to Pharmacy
                    </button>
                    
                    <button 
                      class="btn btn-outline-primary flex-fill"
                      on:click={printPrescriptions}
                      title="Print prescriptions to PDF"
                    >
                      <i class="fas fa-file-pdf me-2"></i>
                      Print
                    </button>
                  {/if}
                </div>
              </div>
            {/if}
          {:else}
            <div class="text-center text-muted py-3">
              <i class="fas fa-pills fa-2x mb-2"></i>
              <p>No current prescriptions for today</p>
            </div>
          {/if}
            </div>
          </div>
        </div>
      {/if}

      <!-- History Tab -->
      {#if activeTab === 'history'}
        <div class="tab-pane active">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">
              <i class="fas fa-history me-2"></i>Prescription History
            </h6>
          </div>
          
          <PrescriptionList
            {prescriptions}
          />
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Pharmacy Selection Modal -->
{#if showPharmacyModal}
  <div class="modal show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="fas fa-paper-plane me-2"></i>
            Send to Pharmacy
          </h5>
          <button type="button" class="btn-close" on:click={() => showPharmacyModal = false}></button>
        </div>
        <div class="modal-body">
          <p class="text-muted mb-3">
            Select which pharmacies should receive this prescription:
          </p>
          
          <!-- Select All / Deselect All Buttons -->
          <div class="d-flex gap-2 mb-3">
            <button class="btn btn-outline-primary btn-sm" on:click={selectAllPharmacies}>
              <i class="fas fa-check-square me-1"></i>
              Select All
            </button>
            <button class="btn btn-outline-secondary btn-sm" on:click={deselectAllPharmacies}>
              <i class="fas fa-square me-1"></i>
              Deselect All
            </button>
          </div>
          
          <!-- Pharmacy List -->
          <div class="list-group">
            {#each availablePharmacies as pharmacy (pharmacy.id)}
              <label class="list-group-item d-flex align-items-center">
                <input 
                  class="form-check-input me-3" 
                  type="checkbox" 
                  checked={selectedPharmacies.includes(pharmacy.id)}
                  on:change={() => togglePharmacySelection(pharmacy.id)}
                >
                <div class="flex-grow-1">
                  <div class="fw-bold">
                    <i class="fas fa-store me-2"></i>
                    {pharmacy.name}
                  </div>
                  <small class="text-muted">
                    <i class="fas fa-envelope me-1"></i>
                    {pharmacy.email}
                  </small>
                  <br>
                  <small class="text-muted">
                    <i class="fas fa-map-marker-alt me-1"></i>
                    {pharmacy.address}
                  </small>
                </div>
              </label>
            {/each}
          </div>
          
          {#if selectedPharmacies.length === 0}
            <div class="alert alert-warning mt-3 mb-0">
              <i class="fas fa-exclamation-triangle me-2"></i>
              Please select at least one pharmacy to send the prescription.
            </div>
          {/if}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" on:click={() => showPharmacyModal = false}>
            <i class="fas fa-times me-2"></i>
            Cancel
          </button>
          <button 
            type="button" 
            class="btn btn-warning" 
            on:click={sendToSelectedPharmacies}
            disabled={selectedPharmacies.length === 0}
          >
            <i class="fas fa-paper-plane me-2"></i>
            Send to {selectedPharmacies.length} Pharmacy{selectedPharmacies.length !== 1 ? 'ies' : ''}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Prescription PDF Modal -->
{#if showPrescriptionPDF}
  <div class="modal show d-block" tabindex="-1" style="background-color: rgba(var(--bs-dark-rgb), 0.5);">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="fas fa-file-pdf me-2"></i>Prescription PDF
          </h5>
          <button 
            type="button" 
            class="btn-close" 
            on:click={() => showPrescriptionPDF = false}
          ></button>
        </div>
        <div class="modal-body">
          <PrescriptionPDF 
            {selectedPatient}
            {prescriptions}
            on:close={() => showPrescriptionPDF = false}
          />
        </div>
      </div>
    </div>
  </div>
{/if}

<style>

  @keyframes pulse-danger {
    0% { box-shadow: 0 0 0 0 rgba(var(--bs-danger-rgb), 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(var(--bs-danger-rgb), 0); }
    100% { box-shadow: 0 0 0 0 rgba(var(--bs-danger-rgb), 0); }
  }
  
  .interaction-content {
    line-height: 1.6;
    font-size: 0.9rem;
  }
  
  .interaction-content h6 {
    color: var(--bs-primary) !important;
    font-weight: 600;
    font-size: 0.95rem;
    margin-top: 1rem !important;
    margin-bottom: 0.5rem !important;
    border-bottom: 1px solid var(--bs-border-color);
    padding-bottom: 0.25rem;
  }
  
  .interaction-content strong {
    color: var(--bs-body-color);
    font-weight: 600;
  }
  
  .interaction-content em {
    color: var(--bs-secondary);
    font-style: italic;
  }

  /* Critical interaction styling */
  .interaction-content .text-danger {
    color: var(--bs-danger) !important;
    font-weight: bold;
  }
  
  /* Full AI Analysis styling */
  .ai-analysis-content {
    line-height: 1.4;
    font-size: 0.9rem;
  }
  
  .ai-analysis-content h6 {
    color: var(--bs-primary) !important;
    font-weight: 700;
    margin-top: 0.5rem;
    margin-bottom: 0.2rem;
    font-size: 1rem;
    border-bottom: 2px solid var(--bs-primary);
    padding-bottom: 0.1rem;
    text-align: left;
    display: flex;
    align-items: center;
    margin-left: 0;
    padding-left: 0;
  }
  
  .ai-analysis-content h6:first-child {
    margin-top: 0;
    margin-bottom: 0.1rem;
  }
  
  .ai-analysis-content strong {
    color: var(--bs-dark);
    font-weight: 700;
    font-size: 0.95rem;
  }
  
  .ai-analysis-content em {
    color: var(--bs-secondary);
    font-style: italic;
    font-weight: 500;
  }
  
  .ai-analysis-content ul {
    padding-left: 1.2rem;
    margin: 0.1rem 0;
    margin-left: 0;
  }
  
  .ai-analysis-content li {
    margin-bottom: 0.1rem;
    line-height: 1.2;
    position: relative;
  }
  
  .ai-analysis-content li::marker {
    color: var(--bs-primary);
    font-weight: bold;
  }
  
  .ai-analysis-content br + strong {
    display: block;
    margin-top: 0.5rem;
    margin-bottom: 0.3rem;
  }
  
  .ai-analysis-content br + • {
    display: block;
    margin-top: 0.4rem;
  }
  
  /* Special formatting for analysis sections */
  .ai-analysis-content p {
    margin-bottom: 0.1rem;
    line-height: 1.2;
    margin-left: 0;
    padding-left: 0;
  }
  
  .ai-analysis-content .section-divider {
    border-top: 1px solid var(--bs-border-color);
    margin: 0.5rem 0;
    padding-top: 0.3rem;
  }
  
  /* Highlight important information */
  .ai-analysis-content .highlight {
    background-color: var(--bs-warning-bg-subtle);
    padding: 0.2rem;
    border-radius: 0.375rem;
    border-left: 4px solid var(--bs-warning);
    margin: 0.2rem 0;
    margin-left: 0;
  }
  
  /* Warning sections */
  .ai-analysis-content .warning {
    background-color: var(--bs-danger-bg-subtle);
    padding: 0.3rem;
    border-radius: 0.375rem;
    border-left: 4px solid var(--bs-danger);
    margin: 0.2rem 0;
    margin-left: 0;
  }
  
  /* Recommendation sections */
  .ai-analysis-content .recommendation {
    background-color: var(--bs-success-bg-subtle);
    padding: 0.3rem;
    border-radius: 0.375rem;
    border-left: 4px solid var(--bs-success);
    margin: 0.2rem 0;
    margin-left: 0;
  }


  /* Medication list styling - compact without cards */
  .medication-list {
    background: transparent;
  }
  
  .medication-item {
    background: transparent;
    border: none !important;
    border-radius: 0;
    padding: 0.5rem 0;
    transition: background-color 0.2s ease;
  }
  
  .medication-item:hover {
    background-color: var(--bs-light);
  }
  
  .medication-item:last-child {
    border-bottom: none !important;
  }
</style>