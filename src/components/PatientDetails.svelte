<script>
  import { onMount, tick } from 'svelte'
  import firebaseStorage from '../services/firebaseStorage.js'
  import openaiService from '../services/openaiService.js'
  import authService from '../services/authService.js'
  import { notifyError, notifySuccess } from '../stores/notifications.js'
  import PatientTabs from './PatientTabs.svelte'
  import PatientForms from './PatientForms.svelte'
  import PrescriptionList from './PrescriptionList.svelte'
  import PrescriptionPDF from './PrescriptionPDF.svelte'
  import AIRecommendations from './AIRecommendations.svelte'
  import PrescriptionsTab from './PrescriptionsTab.svelte'
  
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
  let enabledTabs = ['overview'] // Progressive workflow: start with only overview enabled
  let isNewPrescriptionSession = false
  
  // Reactive statement to ensure PatientTabs gets updated enabledTabs
  $: console.log('🔄 enabledTabs changed:', enabledTabs)
  $: enabledTabsKey = enabledTabs.join(',') // Force reactivity by creating a key
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
  
  // AI-assisted drug suggestions
  let aiDrugSuggestions = []
  let loadingAIDrugSuggestions = false
  let showAIDrugSuggestions = false
  
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
      
      // Ensure all medications have proper IDs
      const medicationsWithIds = ensureMedicationIds(currentPrescription.medications || [])
      currentPrescription.medications = medicationsWithIds
      currentMedications = medicationsWithIds
      
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
    const prescriptionMedications = currentPrescription ? currentPrescription.medications || [] : []
    console.log('📅 Current medications in prescription:', prescriptionMedications.length)
    console.log('📅 Current medications before filter:', currentMedications.length)
    
    // Only update if the prescription has different medications
    if (prescriptionMedications.length !== currentMedications.length || 
        JSON.stringify(prescriptionMedications) !== JSON.stringify(currentMedications)) {
      currentMedications = prescriptionMedications
      console.log('📅 Updated currentMedications from prescription:', currentMedications.length)
    } else {
      console.log('📅 No change needed - currentMedications already matches prescription')
    }
    
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
  
  // Progressive workflow: enable next tab when user visits current tab
  const enableNextTab = () => {
    const tabOrder = ['overview', 'symptoms', 'reports', 'diagnoses', 'prescriptions']
    const currentIndex = tabOrder.indexOf(activeTab)
    
    if (currentIndex < tabOrder.length - 1) {
      const nextTab = tabOrder[currentIndex + 1]
      if (!enabledTabs.includes(nextTab)) {
        enabledTabs = [...enabledTabs, nextTab]
        console.log(`🔓 Unlocked tab: ${nextTab}`)
        notifySuccess(`Great! ${nextTab.charAt(0).toUpperCase() + nextTab.slice(1)} tab is now available.`)
      }
    }
  }
  
  // Manual progression: go to next tab when Next button is clicked
  const goToNextTab = async () => {
    const tabOrder = ['overview', 'symptoms', 'reports', 'diagnoses', 'prescriptions']
    const currentIndex = tabOrder.indexOf(activeTab)
    
    if (currentIndex < tabOrder.length - 1) {
      const nextTab = tabOrder[currentIndex + 1]
      
      // Enable the next tab if not already enabled
      if (!enabledTabs.includes(nextTab)) {
        // Create a new array to ensure Svelte detects the change
        const newEnabledTabs = [...enabledTabs, nextTab]
        enabledTabs = newEnabledTabs
        console.log(`🔓 Unlocked tab: ${nextTab}`)
        console.log(`🔓 Updated enabledTabs:`, enabledTabs)
        notifySuccess(`Great! ${nextTab.charAt(0).toUpperCase() + nextTab.slice(1)} tab is now available.`)
        
        // Wait for DOM to update
        await tick()
      }
      
      // Switch to the next tab using handleTabChange to ensure proper state management
      // Don't enable next tab again since we already did it above
      handleTabChange(nextTab, false)
      console.log(`➡️ Manual progression to: ${nextTab}`)
    }
  }

  // Manual progression: go to previous tab when Back button is clicked
  const goToPreviousTab = () => {
    const tabOrder = ['overview', 'symptoms', 'reports', 'diagnoses', 'prescriptions']
    const currentIndex = tabOrder.indexOf(activeTab)
    
    if (currentIndex > 0) {
      const previousTab = tabOrder[currentIndex - 1]
      
      // Switch to the previous tab
      handleTabChange(previousTab, false)
      console.log(`⬅️ Manual progression to: ${previousTab}`)
    }
  }
  
  // Handle tab change
  const handleTabChange = (tab, shouldEnableNext = true) => {
    activeTab = tab
    // Reset form visibility when changing tabs
    showIllnessForm = false
    showSymptomsForm = false
    showMedicationForm = false
    
    // Enable next tab when user manually visits current tab (progressive workflow)
    if (shouldEnableNext) {
      enableNextTab()
    }
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

  // Generate AI-assisted drug suggestions
  const generateAIDrugSuggestions = async () => {
    if (!symptoms || symptoms.length === 0) {
      notifyError('Please add symptoms first to generate AI drug suggestions.')
      return
    }

    if (!openaiService.isConfigured()) {
      notifyError('AI service is not configured. Please check your OpenAI API key.')
      return
    }

    try {
      loadingAIDrugSuggestions = true
      console.log('🤖 Generating AI drug suggestions...')
      console.log('🔍 Input symptoms:', symptoms)
      console.log('🔍 Input currentMedications:', currentMedications)
      console.log('🔍 Input doctorId:', doctorId)

      // Calculate patient age - prioritize stored age field
      let patientAge = null
      if (selectedPatient?.age && selectedPatient.age !== '' && !isNaN(selectedPatient.age)) {
        patientAge = parseInt(selectedPatient.age)
      } else if (selectedPatient?.dateOfBirth) {
        patientAge = Math.floor((new Date() - new Date(selectedPatient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))
      }

      console.log('🔍 Calculated patient age:', patientAge)
      console.log('🔍 Patient country:', selectedPatient?.country)

      const suggestions = await openaiService.generateAIDrugSuggestions(
        symptoms,
        currentMedications,
        patientAge,
        doctorId,
        {
          patientCountry: selectedPatient?.country || 'Not specified'
        }
      )

      console.log('🔍 Received suggestions from AI service:', suggestions)
      console.log('🔍 Suggestions type:', typeof suggestions)
      console.log('🔍 Is suggestions array?', Array.isArray(suggestions))

      aiDrugSuggestions = suggestions
      showAIDrugSuggestions = true
      console.log('✅ AI drug suggestions generated:', suggestions.length)
      notifySuccess(`Generated ${suggestions.length} AI drug suggestions!`)

    } catch (error) {
      console.error('❌ Error generating AI drug suggestions:', error)
      notifyError('Failed to generate AI drug suggestions: ' + error.message)
    } finally {
      loadingAIDrugSuggestions = false
    }
  }

  // Add AI suggested drug to prescription
  const addAISuggestedDrug = (suggestion, suggestionIndex) => {
    if (!currentPrescription) {
      notifyError('Please create a prescription first.')
      return
    }

    const medication = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID for AI-suggested medication
      name: suggestion.name,
      dosage: suggestion.dosage,
      frequency: suggestion.frequency,
      duration: suggestion.duration,
      instructions: suggestion.instructions || '',
      aiSuggested: true,
      aiReason: suggestion.reason || '',
      patientId: selectedPatient.id,
      doctorId: doctorId,
      createdAt: new Date().toISOString()
    }

    // Update both currentMedications and currentPrescription.medications
    currentMedications = [...currentMedications, medication]
    currentPrescription.medications = [...currentMedications]
    
    // Remove the suggestion from the AI suggestions list
    aiDrugSuggestions = aiDrugSuggestions.filter((_, index) => index !== suggestionIndex)
    
    console.log('💊 Added AI suggested drug:', medication)
    console.log('💊 Updated currentPrescription.medications:', currentPrescription.medications.length)
    console.log('🗑️ Removed suggestion from AI list, remaining:', aiDrugSuggestions.length)
    notifySuccess(`Added ${medication.name} to prescription`)
    
    // Hide suggestions section if no suggestions remain
    if (aiDrugSuggestions.length === 0) {
      showAIDrugSuggestions = false
      console.log('🔍 Hiding AI suggestions section - all suggestions added')
    }

    // Save to Firebase
    saveCurrentPrescriptions()
  }

  // Remove AI suggested drug from list
  const removeAISuggestedDrug = (index) => {
    aiDrugSuggestions = aiDrugSuggestions.filter((_, i) => i !== index)
    console.log('🗑️ Removed AI suggested drug at index:', index)
    
    // Hide suggestions section if no suggestions remain
    if (aiDrugSuggestions.length === 0) {
      showAIDrugSuggestions = false
      console.log('🔍 Hiding AI suggestions section - no suggestions remaining')
    }
  }

  // Ensure all medications have proper IDs
  const ensureMedicationIds = (medications) => {
    return medications.map((medication, index) => {
      if (!medication.id) {
        console.warn('⚠️ Medication missing ID, generating one:', medication.name)
        return {
          ...medication,
          id: `med-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 6)}`,
          patientId: selectedPatient?.id || 'unknown',
          doctorId: doctorId || 'unknown',
          createdAt: medication.createdAt || new Date().toISOString()
        }
      }
      return medication
    })
  }

  // Handle deletion of medications without IDs by index
  const handleDeleteMedicationByIndex = async (index) => {
    try {
      console.log('🗑️ Delete medication by index:', index)
      
      if (confirm('Are you sure you want to delete this medication?')) {
        console.log('🗑️ User confirmed deletion by index')
        
        // Remove from current medications array
        const medicationToDelete = currentMedications[index]
        if (medicationToDelete) {
          console.log('🗑️ Deleting medication:', medicationToDelete.name)
          
          // Remove from array
          currentMedications = currentMedications.filter((_, i) => i !== index)
          
          // Update current prescription medications
          if (currentPrescription && currentPrescription.medications) {
            currentPrescription.medications = currentPrescription.medications.filter((_, i) => i !== index)
            
            // Update in Firebase
            await firebaseStorage.updatePrescription(currentPrescription.id, {
              medications: currentPrescription.medications,
              updatedAt: new Date().toISOString()
            })
            console.log('✅ Updated prescription in Firebase')
          }
          
          // Update prescriptions array
          prescriptions = [...prescriptions]
          
          console.log('✅ Successfully deleted medication by index')
          notifySuccess('Medication deleted successfully!')
        } else {
          console.error('❌ Medication not found at index:', index)
          notifyError('Medication not found')
        }
      }
    } catch (error) {
      console.error('❌ Error deleting medication by index:', error)
      notifyError('Failed to delete medication: ' + error.message)
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
  
  // Reports functionality
  let showReportForm = false
  let reportText = ''
  let reportFiles = []
  let reportType = 'text' // 'text', 'pdf', 'image'
  let reportTitle = ''
  let reportDate = new Date().toISOString().split('T')[0]
  let reports = []
  
  // Diagnostic data functionality
  let showDiagnosticForm = false
  let diagnosticTitle = ''
  let diagnosticDescription = ''
  let diagnosticCode = ''
  let diagnosticSeverity = 'moderate' // mild, moderate, severe
  let diagnosticDate = new Date().toISOString().split('T')[0]
  let diagnoses = []

  // Report functions
  const addReport = () => {
    if (!reportTitle.trim()) {
      notifyError('Please enter a report title')
      return
    }
    
    if (reportType === 'text' && !reportText.trim()) {
      notifyError('Please enter report content')
      return
    }
    
    if (reportType !== 'text' && reportFiles.length === 0) {
      notifyError('Please select a file to upload')
      return
    }
    
    const newReport = {
      id: Date.now().toString(),
      title: reportTitle,
      type: reportType,
      date: reportDate,
      content: reportType === 'text' ? reportText : null,
      files: reportType !== 'text' ? reportFiles : [],
      createdAt: new Date().toISOString()
    }
    
    reports = [...reports, newReport]
    
    // Reset form
    reportTitle = ''
    reportText = ''
    reportFiles = []
    reportType = 'text'
    reportDate = new Date().toISOString().split('T')[0]
    showReportForm = false
    
    notifySuccess('Report added successfully!')
  }
  
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files)
    reportFiles = files
  }
  
  const removeReport = (reportId) => {
    reports = reports.filter(r => r.id !== reportId)
    notifySuccess('Report removed successfully!')
  }

  // Diagnostic functions
  const addDiagnosis = () => {
    if (!diagnosticTitle.trim()) {
      notifyError('Please enter a diagnosis title')
      return
    }
    
    if (!diagnosticDescription.trim()) {
      notifyError('Please enter a diagnosis description')
      return
    }
    
    const newDiagnosis = {
      id: Date.now().toString(),
      title: diagnosticTitle,
      description: diagnosticDescription,
      code: diagnosticCode,
      severity: diagnosticSeverity,
      date: diagnosticDate,
      createdAt: new Date().toISOString()
    }
    
    diagnoses = [...diagnoses, newDiagnosis]
    
    // Reset form
    diagnosticTitle = ''
    diagnosticDescription = ''
    diagnosticCode = ''
    diagnosticSeverity = 'moderate'
    diagnosticDate = new Date().toISOString().split('T')[0]
    showDiagnosticForm = false
    
    notifySuccess('Diagnosis added successfully!')
  }
  
  const removeDiagnosis = (diagnosisId) => {
    diagnoses = diagnoses.filter(d => d.id !== diagnosisId)
    notifySuccess('Diagnosis removed successfully!')
  }

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
      
      // Create A5 document (148 x 210 mm)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5'
      })
      
      const currentDate = new Date().toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit', 
        year: 'numeric'
      })
      
      console.log('📄 Creating A5 PDF content...')
      console.log('Patient:', selectedPatient.firstName, selectedPatient.lastName)
      console.log('Current medications:', currentMedications.length)
      
      // A5 dimensions: 148mm width, 210mm height
      const pageWidth = 148
      const pageHeight = 210
      const margin = 10
      const contentWidth = pageWidth - (margin * 2)
      
      // Header with clinic name
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('MEDICAL PRESCRIPTION', margin, 15)
      
      // Clinic details
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Your Medical Clinic', margin, 22)
      doc.text('123 Medical Street, City', margin, 27)
      doc.text('Phone: (555) 123-4567', margin, 32)
      
      // Date (right aligned)
      doc.setFontSize(10)
      doc.text(`Date: ${currentDate}`, pageWidth - margin, 22, { align: 'right' })
      
      // Prescription number
      const prescriptionId = `RX-${Date.now().toString().slice(-6)}`
      doc.text(`Prescription #: ${prescriptionId}`, pageWidth - margin, 32, { align: 'right' })
      
      // Patient information section
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('PATIENT INFORMATION', margin, 45)
      
      // Patient details
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      
      // Get patient age (prioritize age field)
      let patientAge = 'Not specified'
      if (selectedPatient.age && selectedPatient.age !== '' && !isNaN(selectedPatient.age)) {
        patientAge = selectedPatient.age + ' years'
      } else if (selectedPatient.dateOfBirth) {
      const birthDate = new Date(selectedPatient.dateOfBirth)
        if (!isNaN(birthDate.getTime())) {
      const today = new Date()
      const age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
          const calculatedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age
          patientAge = calculatedAge + ' years'
        }
      }
      
      doc.text(`Name: ${selectedPatient.firstName} ${selectedPatient.lastName}`, margin, 52)
      doc.text(`Age: ${patientAge}`, margin + 70, 52)
      doc.text(`Gender: ${selectedPatient.gender || 'Not specified'}`, margin, 58)
      doc.text(`Phone: ${selectedPatient.phone || 'Not provided'}`, margin + 70, 58)
      doc.text(`Address: ${selectedPatient.address || 'Not provided'}`, margin, 64)
      
      // Prescription medications section
      let yPos = 75
      
      if (currentMedications && currentMedications.length > 0) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('PRESCRIPTION MEDICATIONS', margin, yPos)
        yPos += 10
        
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        
        currentMedications.forEach((medication, index) => {
          if (yPos > pageHeight - 40) {
            doc.addPage()
            yPos = margin + 10
          }
          
          // Medication header with number
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.text(`${index + 1}. ${medication.name}`, margin, yPos)
          
          // Dosage and frequency
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          yPos += 6
          doc.text(`   Dosage: ${medication.dosage}`, margin, yPos)
          yPos += 5
          doc.text(`   Frequency: ${medication.frequency}`, margin, yPos)
          
          // Duration if available
          if (medication.duration) {
            yPos += 5
            doc.text(`   Duration: ${medication.duration}`, margin, yPos)
          }
          
          // Instructions
          if (medication.instructions) {
            yPos += 5
            const instructions = doc.splitTextToSize(`   Instructions: ${medication.instructions}`, contentWidth - 10)
            doc.text(instructions, margin, yPos)
            yPos += instructions.length * 4
          }
          
          // AI suggested indicator
          if (medication.aiSuggested) {
            yPos += 5
            doc.setFontSize(8)
            doc.setTextColor(100, 100, 100)
            doc.text('   [AI Suggested]', margin, yPos)
            doc.setTextColor(0, 0, 0) // Reset color
          }
          
          yPos += 8 // Space between medications
        })
      } else {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text('No medications prescribed.', margin, yPos)
        yPos += 10
      }
      
      // Additional notes
      if (prescriptionNotes && prescriptionNotes.trim() !== '') {
        if (yPos > pageHeight - 60) {
          doc.addPage()
          yPos = margin + 10
        }
        
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('ADDITIONAL NOTES', margin, yPos)
        yPos += 8
        
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        const notes = doc.splitTextToSize(prescriptionNotes, contentWidth)
        doc.text(notes, margin, yPos)
        yPos += notes.length * 4
      }
      
      // Doctor signature section
      if (yPos > pageHeight - 40) {
        doc.addPage()
        yPos = pageHeight - 35
      } else {
        yPos = Math.max(yPos + 10, pageHeight - 35)
      }
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Doctor Signature:', margin, yPos)
      doc.line(margin + 30, yPos + 1, margin + 80, yPos + 1)
      
      // Date and stamp area
      doc.text('Date:', margin + 90, yPos)
      doc.line(margin + 105, yPos + 1, margin + 130, yPos + 1)
      
      // Footer
      doc.setFontSize(7)
      doc.text('This prescription is valid for 30 days from the date of issue.', margin, pageHeight - 5)
      doc.text('Keep this prescription in a safe place.', margin + 75, pageHeight - 5)
      
      // Generate filename
      const filename = `Prescription_${selectedPatient.firstName}_${selectedPatient.lastName}_${currentDate.replace(/\//g, '-')}.pdf`
      
      console.log('💾 Saving PDF with filename:', filename)
      
      // Save the PDF
      doc.save(filename)
      
      console.log('✅ A5 PDF generated and downloaded successfully:', filename)
      
      // Show success message to user
      alert(`A5 Prescription PDF generated successfully: ${filename}`)
      
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
    console.log('🖊️ Edit button clicked, starting patient edit mode')
    console.log('🖊️ Selected patient:', selectedPatient)
    console.log('🖊️ Current isEditingPatient state:', isEditingPatient)
    
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
      
      // Validate medicationId
      if (!medicationId) {
        console.error('❌ Cannot delete medication: medicationId is undefined or null')
        notifyError('Cannot delete medication: Invalid medication ID')
        return
      }
      
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
  
  // Finalize prescription function
  const finalizePrescription = async () => {
    try {
      console.log('✅ Finalizing prescription...')
      
      if (!currentPrescription) {
        notifyError('No prescription to finalize')
        return
      }
      
      if (currentMedications.length === 0) {
        notifyError('Cannot finalize empty prescription')
        return
      }
      
      // Update prescription status
      currentPrescription.status = 'finalized'
      currentPrescription.medications = currentMedications
      currentPrescription.finalizedAt = new Date().toISOString()
      
      // Save to Firebase
      await firebaseStorage.updatePrescription(currentPrescription.id, {
        status: 'finalized',
        medications: currentMedications,
        finalizedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      
      prescriptionsFinalized = true
      prescriptionFinished = true
      
      console.log('✅ Prescription finalized successfully')
      notifySuccess('Prescription finalized successfully!')
      
    } catch (error) {
      console.error('❌ Error finalizing prescription:', error)
      notifyError('Failed to finalize prescription: ' + error.message)
    }
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
      <div>
      <h5 class="mb-0">
        <i class="fas fa-user me-2"></i>
        {selectedPatient.firstName} {selectedPatient.lastName}
      </h5>
        <small class="text-muted">
          Age: {(() => {
            // Use stored age field if available
            if (selectedPatient.age && selectedPatient.age !== '' && !isNaN(selectedPatient.age)) {
              return selectedPatient.age + ' years'
            }
            
            // Fallback to dateOfBirth calculation only if no age field
            if (selectedPatient.dateOfBirth) {
              const birthDate = new Date(selectedPatient.dateOfBirth)
              if (!isNaN(birthDate.getTime())) {
                const today = new Date()
                const age = today.getFullYear() - birthDate.getFullYear()
                const monthDiff = today.getMonth() - birthDate.getMonth()
                const calculatedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age
                return calculatedAge + ' years'
              }
            }
            
            // If neither age field nor valid dateOfBirth
            return 'Not specified'
          })()}
        </small>
      </div>
      <div class="btn-group" role="group">
        <button 
          class="btn {activeTab === 'history' ? 'btn-danger border-0' : 'btn-outline-danger'} btn-sm me-2"
          on:click={() => handleTabChange('history')}
          role="tab"
          title="View patient history"
        >
          <i class="fas fa-history me-1"></i>History
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
    <!-- Progress Bar -->
    <div class="progress-bar-container mb-4">
      <div class="progress-steps d-flex justify-content-between align-items-center">
        <div class="step {activeTab === 'overview' ? 'active' : ''} {enabledTabs.includes('overview') ? 'enabled' : 'disabled'}" 
             on:click={() => enabledTabs.includes('overview') && handleTabChange('overview')}>
          <div class="step-circle">
            <i class="fas fa-user"></i>
          </div>
          <div class="step-label">Overview</div>
        </div>
        
        <div class="step-connector"></div>
        
        <div class="step {activeTab === 'symptoms' ? 'active' : ''} {enabledTabs.includes('symptoms') ? 'enabled' : 'disabled'}" 
             on:click={() => enabledTabs.includes('symptoms') && handleTabChange('symptoms')}>
          <div class="step-circle">
            <i class="fas fa-thermometer-half"></i>
          </div>
          <div class="step-label">Symptoms</div>
        </div>
        
        <div class="step-connector"></div>
        
        <div class="step {activeTab === 'reports' ? 'active' : ''} {enabledTabs.includes('reports') ? 'enabled' : 'disabled'}" 
             on:click={() => enabledTabs.includes('reports') && handleTabChange('reports')}>
          <div class="step-circle">
            <i class="fas fa-file-medical"></i>
          </div>
          <div class="step-label">Reports</div>
        </div>
        
        <div class="step-connector"></div>
        
        <div class="step {activeTab === 'diagnoses' ? 'active' : ''} {enabledTabs.includes('diagnoses') ? 'enabled' : 'disabled'}" 
             on:click={() => enabledTabs.includes('diagnoses') && handleTabChange('diagnoses')}>
          <div class="step-circle">
            <i class="fas fa-stethoscope"></i>
          </div>
          <div class="step-label">Diagnoses</div>
        </div>
        
        <div class="step-connector"></div>
        
        <div class="step {activeTab === 'prescriptions' ? 'active' : ''} {enabledTabs.includes('prescriptions') ? 'enabled' : 'disabled'}" 
             on:click={() => enabledTabs.includes('prescriptions') && handleTabChange('prescriptions')}>
          <div class="step-circle">
            <i class="fas fa-prescription-bottle-alt"></i>
          </div>
          <div class="step-label">Prescriptions</div>
        </div>
      </div>
    </div>
    
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
                      class="btn btn-primary btn-sm flex-fill" 
                      disabled={savingPatient}
                    >
                      {#if savingPatient}
                        <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                      {/if}
                      <i class="fas fa-save me-1"></i>Save Changes
                    </button>
                    <button 
                      type="button" 
                      class="btn btn-secondary btn-sm flex-fill" 
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
                    <p><strong>Age:</strong> {selectedPatient.age || calculateAge(selectedPatient.dateOfBirth) || 'Not specified'}</p>
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
                
                <!-- Next Button -->
                <div class="row mt-3">
                  <div class="col-12 text-center">
                    <button 
                      class="btn btn-danger btn-sm"
                      on:click={goToNextTab}
                      title="Continue to Symptoms tab"
                    >
                      <i class="fas fa-arrow-right me-2"></i>Next
                    </button>
                  </div>
                </div>
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
          
          <!-- Navigation Buttons -->
          <div class="row mt-3">
            <div class="col-12 text-center">
              <button 
                class="btn btn-outline-secondary btn-sm me-3"
                on:click={goToPreviousTab}
                title="Go back to Overview tab"
              >
                <i class="fas fa-arrow-left me-2"></i>Back
              </button>
              <button 
                class="btn btn-danger btn-sm"
                on:click={goToNextTab}
                title="Continue to Reports tab"
              >
                <i class="fas fa-arrow-right me-2"></i>Next
              </button>
            </div>
          </div>
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
      
          <!-- Next Button -->
          <div class="row mt-3">
            <div class="col-12 text-center">
                <button 
                class="btn btn-danger btn-sm"
                on:click={goToNextTab}
                title="Continue to Prescriptions tab"
              >
                <i class="fas fa-arrow-right me-2"></i>Next
                </button>
              </div>
          </div>
        </div>
      {/if}
      
      <!-- Reports Tab -->
      {#if activeTab === 'reports'}
        <div class="tab-pane active">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">
              <i class="fas fa-file-medical me-2"></i>Medical Reports
            </h6>
              <button 
              class="btn btn-primary btn-sm" 
              on:click={() => showReportForm = true}
            >
              <i class="fas fa-plus me-1"></i>Add Report
              </button>
            </div>
          
          <!-- Add Report Form -->
          {#if showReportForm}
            <div class="card mb-4">
              <div class="card-header">
            <h6 class="mb-0">
                  <i class="fas fa-plus me-2"></i>Add New Report
            </h6>
              </div>
              <div class="card-body">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Report Title</label>
                    <input 
                      type="text" 
                      class="form-control" 
                      bind:value={reportTitle}
                      placeholder="e.g., Blood Test Results, X-Ray Report"
                    />
                </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Report Date</label>
                    <input 
                      type="date" 
                      class="form-control" 
                      bind:value={reportDate}
                    />
              </div>
                </div>
                
                <div class="mb-3">
                  <label class="form-label">Report Type</label>
                  <div class="nav nav-tabs nav-fill" role="tablist">
                    <input 
                      type="radio" 
                      class="btn-check" 
                      id="report-text" 
                      bind:group={reportType} 
                      value="text"
                    />
                    <label class="nav-link {reportType === 'text' ? 'active' : ''}" for="report-text" role="tab">
                      <i class="fas fa-keyboard me-2"></i>Text Entry
                    </label>
                    
                    <input 
                      type="radio" 
                      class="btn-check" 
                      id="report-pdf" 
                      bind:group={reportType} 
                      value="pdf"
                    />
                    <label class="nav-link {reportType === 'pdf' ? 'active' : ''}" for="report-pdf" role="tab">
                      <i class="fas fa-file-pdf me-2"></i>PDF Upload
                    </label>
                    
                    <input 
                      type="radio" 
                      class="btn-check" 
                      id="report-image" 
                      bind:group={reportType} 
                      value="image"
                    />
                    <label class="nav-link {reportType === 'image' ? 'active' : ''}" for="report-image" role="tab">
                      <i class="fas fa-image me-2"></i>Image Upload
                    </label>
                  </div>
                </div>
                
                {#if reportType === 'text'}
                  <div class="mb-3">
                    <label class="form-label">Report Content</label>
                    <textarea 
                      class="form-control" 
                      rows="6" 
                      bind:value={reportText}
                      placeholder="Enter the report details, findings, and observations..."
                    ></textarea>
                  </div>
                {:else}
                  <div class="mb-3">
                    <label class="form-label">
                      Upload {reportType === 'pdf' ? 'PDF' : 'Image'} File
                    </label>
                    <input 
                      type="file" 
                      class="form-control" 
                      accept={reportType === 'pdf' ? '.pdf' : 'image/*'}
                      on:change={handleFileUpload}
                      multiple={false}
                    />
                    {#if reportFiles.length > 0}
                      <div class="mt-2">
                        <small class="text-muted">
                          Selected: {reportFiles[0].name} ({(reportFiles[0].size / 1024 / 1024).toFixed(2)} MB)
                        </small>
                      </div>
                    {/if}
            </div>
          {/if}
          
                <div class="d-flex gap-2">
            <button 
                    class="btn btn-success btn-sm" 
                    on:click={addReport}
                  >
                    <i class="fas fa-save me-1"></i>Save Report
                  </button>
                  <button 
                    class="btn btn-outline-secondary btn-sm" 
                    on:click={() => {
                      showReportForm = false
                      reportTitle = ''
                      reportText = ''
                      reportFiles = []
                      reportType = 'text'
                      reportDate = new Date().toISOString().split('T')[0]
                    }}
                  >
                    <i class="fas fa-times me-1"></i>Cancel
            </button>
                </div>
              </div>
            </div>
          {/if}
          
          <!-- Reports List -->
          {#if reports.length > 0}
            <div class="row">
              {#each reports as report (report.id)}
                <div class="col-md-6 mb-3">
                  <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                      <h6 class="mb-0">
                        {#if report.type === 'text'}
                          <i class="fas fa-keyboard text-primary me-2"></i>
                        {:else if report.type === 'pdf'}
                          <i class="fas fa-file-pdf text-danger me-2"></i>
                        {:else}
                          <i class="fas fa-image text-success me-2"></i>
                        {/if}
                        {report.title}
                      </h6>
              <button 
                        class="btn btn-outline-danger btn-sm"
                        on:click={() => removeReport(report.id)}
                        title="Remove report"
                      >
                        <i class="fas fa-trash"></i>
              </button>
            </div>
                    <div class="card-body">
                      <p class="text-muted small mb-2">
                        <i class="fas fa-calendar me-1"></i>
                        {new Date(report.date).toLocaleDateString()}
                      </p>
                      {#if report.type === 'text'}
                        <div class="report-content">
                          <p class="mb-0">{report.content}</p>
                        </div>
                      {:else}
                        <div class="wave-file-view">
                          <div class="wave-container">
                            <div class="wave-bar"></div>
                            <div class="wave-bar"></div>
                            <div class="wave-bar"></div>
                            <div class="wave-bar"></div>
                            <div class="wave-bar"></div>
                            <div class="wave-bar"></div>
                            <div class="wave-bar"></div>
                            <div class="wave-bar"></div>
                          </div>
                          <div class="file-info">
                            <i class="fas fa-file-upload text-primary mb-1"></i>
                            <p class="text-muted small mb-0">
                              {report.files.length} file(s) uploaded
                            </p>
                    <small class="text-muted">
                              {report.files[0]?.name || 'File uploaded'}
                    </small>
                          </div>
                      </div>
                    {/if}
                  </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center p-4">
              <i class="fas fa-file-medical fa-2x text-muted mb-3"></i>
              <p class="text-muted">No medical reports available for this patient.</p>
              <p class="text-muted small">Add lab results, imaging reports, and other medical documents here.</p>
            </div>
          {/if}
          
          <!-- Navigation Buttons -->
          <div class="row mt-3">
            <div class="col-12 text-center">
                      <button 
                class="btn btn-outline-secondary btn-sm me-3"
                on:click={goToPreviousTab}
                title="Go back to Symptoms tab"
              >
                <i class="fas fa-arrow-left me-2"></i>Back
                      </button>
                      <button 
                class="btn btn-danger btn-sm"
                on:click={goToNextTab}
                title="Continue to Diagnoses tab"
              >
                <i class="fas fa-arrow-right me-2"></i>Next
                      </button>
                    </div>
          </div>
                    </div>
                  {/if}
      
      <!-- Diagnoses Tab -->
      {#if activeTab === 'diagnoses'}
        <div class="tab-pane active">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">
              <i class="fas fa-stethoscope me-2"></i>Medical Diagnoses
            </h6>
            <button 
              class="btn btn-primary btn-sm" 
              on:click={() => showDiagnosticForm = true}
            >
              <i class="fas fa-plus me-1"></i>Add Diagnosis
            </button>
                </div>
          
          <!-- Add Diagnosis Form -->
          {#if showDiagnosticForm}
            <div class="card mb-4">
              <div class="card-header">
                <h6 class="mb-0">
                  <i class="fas fa-plus me-2"></i>Add New Diagnosis
                </h6>
              </div>
              <div class="card-body">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Diagnosis Title</label>
                    <input 
                      type="text" 
                      class="form-control" 
                      bind:value={diagnosticTitle}
                      placeholder="e.g., Hypertension, Diabetes Type 2"
                    />
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Diagnosis Date</label>
                    <input 
                      type="date" 
                      class="form-control" 
                      bind:value={diagnosticDate}
                    />
                  </div>
            </div>
            
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Diagnostic Code (Optional)</label>
                    <input 
                      type="text" 
                      class="form-control" 
                      bind:value={diagnosticCode}
                      placeholder="e.g., ICD-10: I10, E11.9"
                    />
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Severity</label>
                    <select class="form-select" bind:value={diagnosticSeverity}>
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </select>
                  </div>
                </div>
                
                <div class="mb-3">
                  <label class="form-label">Diagnosis Description</label>
              <textarea 
                class="form-control" 
                    rows="4" 
                    bind:value={diagnosticDescription}
                    placeholder="Describe the diagnosis, symptoms, findings, and clinical assessment..."
              ></textarea>
            </div>
            
                <div class="d-flex gap-2">
                <button 
                    class="btn btn-success btn-sm" 
                    on:click={addDiagnosis}
                    >
                    <i class="fas fa-save me-1"></i>Save Diagnosis
                </button>
                    <button 
                    class="btn btn-outline-secondary btn-sm" 
                    on:click={() => {
                      showDiagnosticForm = false
                      diagnosticTitle = ''
                      diagnosticDescription = ''
                      diagnosticCode = ''
                      diagnosticSeverity = 'moderate'
                      diagnosticDate = new Date().toISOString().split('T')[0]
                    }}
                  >
                    <i class="fas fa-times me-1"></i>Cancel
                    </button>
                </div>
              </div>
            </div>
          {/if}
          
          <!-- Diagnoses List -->
          {#if diagnoses.length > 0}
            <div class="row">
              {#each diagnoses as diagnosis (diagnosis.id)}
                <div class="col-md-6 mb-3">
                  <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                      <h6 class="mb-0">
                        <i class="fas fa-stethoscope text-primary me-2"></i>
                        {diagnosis.title}
                      </h6>
                    <button 
                        class="btn btn-outline-danger btn-sm"
                        on:click={() => removeDiagnosis(diagnosis.id)}
                        title="Remove diagnosis"
                      >
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                    <div class="card-body">
                      <div class="row mb-2">
                        <div class="col-6">
                          <small class="text-muted">
                            <i class="fas fa-calendar me-1"></i>
                            {new Date(diagnosis.date).toLocaleDateString()}
                          </small>
              </div>
                        <div class="col-6">
                          <span class="badge bg-{diagnosis.severity === 'mild' ? 'success' : diagnosis.severity === 'moderate' ? 'warning' : 'danger'}">
                            {diagnosis.severity.charAt(0).toUpperCase() + diagnosis.severity.slice(1)}
                          </span>
                        </div>
                      </div>
                      {#if diagnosis.code}
                        <p class="text-muted small mb-2">
                          <i class="fas fa-code me-1"></i>
                          <strong>Code:</strong> {diagnosis.code}
                        </p>
            {/if}
                      <div class="diagnosis-description">
                        <p class="mb-0">{diagnosis.description}</p>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center p-4">
              <i class="fas fa-stethoscope fa-2x text-muted mb-3"></i>
              <p class="text-muted">No diagnoses recorded for this patient.</p>
              <p class="text-muted small">Record medical diagnoses, conditions, and assessments here.</p>
            </div>
          {/if}
          
          <!-- AI Recommendations Component -->
          <AIRecommendations 
            {symptoms} 
            currentMedications={currentMedications}
            patientAge={selectedPatient ? (() => {
              // Use stored age field if available
              if (selectedPatient.age && selectedPatient.age !== '' && !isNaN(selectedPatient.age)) {
                return parseInt(selectedPatient.age)
              }
              
              // Fallback to dateOfBirth calculation only if no age field
              if (selectedPatient.dateOfBirth) {
                const birthDate = new Date(selectedPatient.dateOfBirth)
                if (!isNaN(birthDate.getTime())) {
                  const today = new Date()
                  const age = today.getFullYear() - birthDate.getFullYear()
                  const monthDiff = today.getMonth() - birthDate.getMonth()
                  return monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age
                }
              }
              
              return null
            })() : null}
            {doctorId}
            on:ai-usage-updated={(event) => {
              if (addToPrescription) {
                addToPrescription('ai-usage', event.detail)
              }
            }}
          />
          
          <!-- Navigation Buttons -->
          <div class="row mt-3">
            <div class="col-12 text-center">
              <button 
                class="btn btn-outline-secondary btn-sm me-3"
                on:click={goToPreviousTab}
                title="Go back to Reports tab"
              >
                <i class="fas fa-arrow-left me-2"></i>Back
              </button>
              <button 
                class="btn btn-danger btn-sm"
                on:click={goToNextTab}
                title="Continue to Prescriptions tab"
              >
                <i class="fas fa-arrow-right me-2"></i>Next
              </button>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Prescriptions Tab -->
      {#if activeTab === 'prescriptions'}
        <div class="tab-pane active">
          <PrescriptionsTab 
          {selectedPatient}
          {showMedicationForm}
          {editingMedication}
          {doctorId}
          {currentMedications}
          {prescriptionsFinalized}
          {showAIDrugSuggestions}
          {aiDrugSuggestions}
          {currentPrescription}
          {loadingAIDrugSuggestions}
          {symptoms}
          {openaiService}
          onMedicationAdded={handleMedicationAdded}
          onCancelMedication={handleCancelMedication}
          onEditPrescription={handleEditPrescription}
          onDeletePrescription={handleDeletePrescription}
          onDeleteMedicationByIndex={handleDeleteMedicationByIndex}
          onFinalizePrescription={finalizePrescription}
          onShowPharmacyModal={showPharmacySelection}
          onGoToPreviousTab={goToPreviousTab}
          onGenerateAIDrugSuggestions={generateAIDrugSuggestions}
          onAddAISuggestedDrug={addAISuggestedDrug}
          onRemoveAISuggestedDrug={removeAISuggestedDrug}
          onNewPrescription={async () => { 
            console.log('🆕 New Prescription button clicked - Creating NEW prescription');
            showMedicationForm = false; 
            editingMedication = null;
            prescriptionFinished = false;
            
            // Reset AI check state for new prescription
            aiCheckComplete = false;
            aiCheckMessage = '';
            lastAnalyzedMedications = [];
            
            try {
              // Create new prescription
              const newPrescription = await firebaseStorage.createPrescription(
                selectedPatient.id,
                doctorId,
                'New Prescription',
                'Prescription created from Prescriptions tab'
              );
              
              currentPrescription = newPrescription;
              currentMedications = [];
              
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
          onAddDrug={() => { 
            console.log('💊 Add Drug clicked');
            
            if (!currentPrescription) {
              notifyError('Please click "New Prescription" first to create a prescription.');
              return;
            }
            
            showMedicationForm = true;
            editingMedication = null;
            notifySuccess('Medication form opened - add drug details');
          }}
          onPrintPrescriptions={printPrescriptions}
          />
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
            {#each availablePharmacies as pharmacy}
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
          
          {#if availablePharmacies.length === 0}
            <div class="text-center text-muted py-4">
              <i class="fas fa-store fa-2x mb-2"></i>
              <p>No pharmacies available</p>
            </div>
          {/if}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-sm" on:click={() => showPharmacyModal = false}>
            <i class="fas fa-times me-2"></i>
            Cancel
          </button>
          <button 
            type="button" 
            class="btn btn-warning btn-sm" 
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
  /* Progress Bar Styling */
  .progress-bar-container {
    padding: 1rem 0;
  }

  .progress-steps {
    position: relative;
    max-width: 100%;
  }

  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: all 0.3s ease;
    flex: 1;
    position: relative;
  }

  .step.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .step.enabled {
    cursor: pointer;
  }

  .step.enabled:hover .step-circle {
    transform: scale(1.1);
  }

  .step-circle {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    transition: all 0.3s ease;
    border: 3px solid #e9ecef;
    background-color: #f8f9fa;
    color: #6c757d;
    margin-bottom: 0.5rem;
  }

  .step.active .step-circle {
    background-color: #007bff;
    border-color: #007bff;
    color: white;
    box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.25);
  }

  .step.enabled:not(.active) .step-circle {
    background-color: #e9ecef;
    border-color: #dee2e6;
    color: #495057;
  }

  .step.disabled .step-circle {
    background-color: #f8f9fa;
    border-color: #e9ecef;
    color: #adb5bd;
  }

  .step-label {
    font-size: 0.875rem;
    font-weight: 500;
    text-align: center;
    color: #6c757d;
    transition: color 0.3s ease;
  }

  .step.active .step-label {
    color: #007bff;
    font-weight: 600;
  }
  
  .step.enabled:not(.active) .step-label {
    color: #495057;
  }

  .step.disabled .step-label {
    color: #adb5bd;
  }

  .step-connector {
    position: absolute;
    top: 25px;
    left: 50%;
    width: 100%;
    height: 2px;
    background-color: #e9ecef;
    z-index: -1;
    transform: translateX(-50%);
  }

  .step.active + .step-connector,
  .step.enabled + .step-connector {
    background-color: #007bff;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .step-circle {
      width: 40px;
      height: 40px;
    font-size: 1rem;
    }
    
    .step-label {
      font-size: 0.75rem;
    }
    
    .step-connector {
      top: 20px;
    }
  }

  @media (max-width: 576px) {
    .step-circle {
      width: 35px;
      height: 35px;
      font-size: 0.9rem;
    }
    
    .step-label {
      font-size: 0.7rem;
    }
    
    .step-connector {
      top: 17.5px;
    }
  }

  /* Wave file view animation */
  .wave-file-view {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 0.5rem;
    border: 1px solid #dee2e6;
  }

  .wave-container {
    display: flex;
    align-items: end;
    gap: 2px;
    height: 40px;
  }

  .wave-bar {
    width: 4px;
    background: linear-gradient(to top, #007bff, #0056b3);
    border-radius: 2px;
    animation: wave 1.5s ease-in-out infinite;
  }

  .wave-bar:nth-child(1) { height: 20px; animation-delay: 0s; }
  .wave-bar:nth-child(2) { height: 30px; animation-delay: 0.1s; }
  .wave-bar:nth-child(3) { height: 25px; animation-delay: 0.2s; }
  .wave-bar:nth-child(4) { height: 35px; animation-delay: 0.3s; }
  .wave-bar:nth-child(5) { height: 28px; animation-delay: 0.4s; }
  .wave-bar:nth-child(6) { height: 32px; animation-delay: 0.5s; }
  .wave-bar:nth-child(7) { height: 26px; animation-delay: 0.6s; }
  .wave-bar:nth-child(8) { height: 22px; animation-delay: 0.7s; }

  @keyframes wave {
    0%, 100% {
      transform: scaleY(1);
      opacity: 0.7;
    }
    50% {
      transform: scaleY(1.5);
      opacity: 1;
    }
  }

  .file-info {
    flex: 1;
    text-align: center;
  }

  .file-info i {
    font-size: 1.5rem;
  }

  /* Responsive wave view */
  @media (max-width: 576px) {
    .wave-file-view {
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
    }
    
    .wave-container {
      height: 30px;
    }
    
    .wave-bar {
      width: 3px;
    }
    
    .wave-bar:nth-child(1) { height: 15px; }
    .wave-bar:nth-child(2) { height: 22px; }
    .wave-bar:nth-child(3) { height: 18px; }
    .wave-bar:nth-child(4) { height: 25px; }
    .wave-bar:nth-child(5) { height: 20px; }
    .wave-bar:nth-child(6) { height: 24px; }
    .wave-bar:nth-child(7) { height: 19px; }
    .wave-bar:nth-child(8) { height: 16px; }
  }

  /* Medication list styling */
  .medication-list {
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
    background-color: #f8f9fa;
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

  /* Responsive prescriptions tab styling */
  .prescriptions-responsive-container {
    margin-bottom: 1rem;
  }
  
  .prescriptions-responsive-container .card-header {
    padding: 0.75rem 1rem;
  }
  
  .prescriptions-responsive-container .card-header h5 {
    font-size: 1.1rem;
    margin-bottom: 0;
  }
  
  .prescriptions-responsive-container .btn-group {
    flex-wrap: wrap;
  }
  
  /* Mobile adjustments for prescriptions tab */
  @media (max-width: 991.98px) {
    .prescriptions-responsive-container .col-lg-8,
    .prescriptions-responsive-container .col-lg-4 {
      margin-bottom: 1rem;
    }
    
    .prescriptions-responsive-container .card-header {
      padding: 0.5rem 0.75rem;
    }
    
    .prescriptions-responsive-container .card-header h5 {
      font-size: 1rem;
    }
    
    .prescriptions-responsive-container .d-flex.flex-wrap.gap-2 {
      margin-top: 0.5rem;
    }
    
    .prescriptions-responsive-container .btn {
      font-size: 0.8rem;
      padding: 0.4rem 0.8rem;
    }
  }
  
  /* Small mobile adjustments */
  @media (max-width: 576px) {
    .prescriptions-responsive-container .card-header {
      padding: 0.4rem 0.5rem;
    }
    
    .prescriptions-responsive-container .card-header h5 {
      font-size: 0.95rem;
    }
    
    .prescriptions-responsive-container .btn {
      font-size: 0.75rem;
      padding: 0.35rem 0.6rem;
    }
    
    .prescriptions-responsive-container .d-flex.flex-wrap.gap-2 {
      gap: 0.25rem !important;
    }
  }
</style>
