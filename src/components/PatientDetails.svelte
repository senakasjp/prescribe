<script>
  import { onMount, tick } from 'svelte'
  import firebaseStorage from '../services/firebaseStorage.js'
  import openaiService from '../services/openaiService.js'
  import authService from '../services/authService.js'
  import PatientTabs from './PatientTabs.svelte'
  import PatientForms from './PatientForms.svelte'
  import PrescriptionList from './PrescriptionList.svelte'
  import PrescriptionPDF from './PrescriptionPDF.svelte'
  import LoadingSpinner from './LoadingSpinner.svelte'
  import AIRecommendations from './AIRecommendations.svelte'
  import PrescriptionsTab from './PrescriptionsTab.svelte'
  import ConfirmationModal from './ConfirmationModal.svelte'
  import { formatPrescriptionId } from '../utils/idFormat.js'
  import { phoneCountryCodes } from '../data/phoneCountryCodes.js'
  import { getDialCodeForCountry } from '../utils/phoneCountryCode.js'
  import JsBarcode from 'jsbarcode'
  
  export let selectedPatient
  export const addToPrescription = null
  export let refreshTrigger = 0
  export let doctorId = null
  export let currentUser = null
  export let authUser = null
  export let settingsDoctor = null
  export let initialTab = 'overview' // Allow parent to set initial tab

  const formatPhoneDisplay = (patient) => {
    const code = (patient?.phoneCountryCode || '').trim()
    const number = (patient?.phone || '').trim()
    if (!code) return number
    if (!number) return code
    return `${code} ${number}`
  }
  
  // Event dispatcher to notify parent of data changes
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  const getDoctorSettingsFallback = () => settingsDoctor || currentUser || {}
  $: effectiveDoctorSettings = getDoctorSettingsFallback()

  const getDisplayDoctorName = (doctorProfile) => {
    if (currentUser?.firstName || currentUser?.lastName) {
      return `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim()
    }
    return currentUser?.name || currentUser?.displayName || doctorProfile?.name || doctorProfile?.email || 'Unknown'
  }

  const getEffectiveDoctorProfile = async () => {
    if (settingsDoctor?.id) {
      return settingsDoctor
    }

    const firebaseUser = currentUser || authService.getCurrentUser()
    if (firebaseUser?.externalDoctor && firebaseUser?.invitedByDoctorId) {
      return await firebaseStorage.getDoctorById(firebaseUser.invitedByDoctorId)
    }

    if (firebaseUser?.email) {
      return await firebaseStorage.getDoctorByEmail(firebaseUser.email)
    }

    return null
  }

  const getSendingDoctorName = () => {
    const activeUser = authUser || authService.getCurrentUser()
    const firstLast = `${activeUser?.firstName || ''} ${activeUser?.lastName || ''}`.trim()
    if (firstLast) {
      return firstLast
    }
    return activeUser?.name || activeUser?.displayName || ''
  }

  const normalizeKeyPart = (value) => {
    return (value || '')
      .toString()
      .toLowerCase()
      .replace(/[\u3000\s]+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim()
  }

  const parseStrengthParts = (medication) => {
    const rawStrength = medication?.strength ?? medication?.dosage ?? ''
    const rawUnit = medication?.strengthUnit ?? medication?.dosageUnit ?? ''

    if (!rawStrength) {
      return { strength: '', strengthUnit: rawUnit || '' }
    }

    if (typeof rawStrength === 'number') {
      return { strength: String(rawStrength), strengthUnit: rawUnit || '' }
    }

    const normalized = String(rawStrength).trim()
    const match = normalized.match(/^(\d+(?:\.\d+)?)([a-zA-Z%]+)?$/)
    if (match) {
      return { strength: match[1], strengthUnit: match[2] || rawUnit || '' }
    }

    return { strength: normalized, strengthUnit: rawUnit || '' }
  }

  const buildMedicationKeyForPharmacy = (medication) => {
    if (!medication) return ''
    const { strength, strengthUnit } = parseStrengthParts(medication)
    const dosageForm = medication?.dosageForm || medication?.form || ''
    const parts = [
      normalizeKeyPart(medication?.name),
      normalizeKeyPart(medication?.genericName),
      normalizeKeyPart(strength),
      normalizeKeyPart(strengthUnit),
      normalizeKeyPart(dosageForm)
    ].filter(Boolean)
    return parts.join('|')
  }

  const enrichMedicationForPharmacy = (medication) => {
    const { strength, strengthUnit } = parseStrengthParts(medication)
    const dosageForm = medication?.dosageForm || medication?.form || ''
    const medicationKey = buildMedicationKeyForPharmacy({
      ...medication,
      strength,
      strengthUnit,
      dosageForm
    })

    return {
      ...medication,
      strength,
      strengthUnit,
      dosageForm,
      medicationKey
    }
  }
  
  let illnesses = []
  let prescriptions = [] // Array of prescription objects (each containing medications)
  let symptoms = []
  let currentPrescription = null // Current prescription being worked on
  
  const getRecentPrescriptionsSummary = (limit = 3) => {
    if (!prescriptions || prescriptions.length === 0) {
      return []
    }

    const sortedPrescriptions = [...prescriptions]
      .filter(prescription => prescription?.medications && prescription.medications.length > 0)
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt || a.date || 0).getTime()
        const dateB = new Date(b.createdAt || b.updatedAt || b.date || 0).getTime()
        return dateB - dateA
      })

    return sortedPrescriptions.slice(0, limit).map(prescription => ({
      id: prescription.id,
      date: prescription.createdAt || prescription.updatedAt || prescription.date || null,
      medications: Array.isArray(prescription.medications)
        ? prescription.medications.map(medication => ({
            name: medication.name,
            dosage: medication.dosage,
            frequency: medication.frequency,
            duration: medication.duration
          }))
        : []
    }))
  }

  const getRecentReportsSummary = (limit = 3) => {
    if (!reports || reports.length === 0) {
      return []
    }

    const sortedReports = [...reports]
      .filter(report => report && report.title)
      .sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0).getTime()
        const dateB = new Date(b.date || b.createdAt || 0).getTime()
        return dateB - dateA
      })

    return sortedReports.slice(0, limit).map(report => ({
      id: report.id,
      title: report.title,
      type: report.type,
      date: report.date || report.createdAt || null,
      content: report.type === 'text' ? report.content : null,
      filename: report.files?.[0]?.name || null,
      previewUrl: report.type === 'image' ? report.previewUrl || report.dataUrl : null,
      dataUrl: report.type === 'image' ? report.dataUrl : null
    }))
  }
  
  // Pagination for symptoms
  let currentSymptomsPage = 1
  let symptomsPerPage = 25
  
  // Pagination calculations for symptoms
  $: totalSymptomsPages = Math.ceil(symptoms.length / symptomsPerPage)
  $: symptomsStartIndex = (currentSymptomsPage - 1) * symptomsPerPage
  $: symptomsEndIndex = symptomsStartIndex + symptomsPerPage
  $: paginatedSymptoms = symptoms.slice(symptomsStartIndex, symptomsEndIndex)
  
  // Reset to first page when symptoms change
  $: if (symptoms.length > 0) {
    currentSymptomsPage = 1
  }
  
  // Pagination functions for symptoms
  const goToSymptomsPage = (page) => {
    if (page >= 1 && page <= totalSymptomsPages) {
      currentSymptomsPage = page
    }
  }
  
  const goToPreviousSymptomsPage = () => {
    if (currentSymptomsPage > 1) {
      currentSymptomsPage--
    }
  }
  
  const goToNextSymptomsPage = () => {
    if (currentSymptomsPage < totalSymptomsPages) {
      currentSymptomsPage++
    }
  }
  
  // Pagination for illnesses
  let currentIllnessesPage = 1
  let illnessesPerPage = 25
  
  // Pagination calculations for illnesses
  $: totalIllnessesPages = Math.ceil(illnesses.length / illnessesPerPage)
  $: illnessesStartIndex = (currentIllnessesPage - 1) * illnessesPerPage
  $: illnessesEndIndex = illnessesStartIndex + illnessesPerPage
  $: paginatedIllnesses = illnesses.slice(illnessesStartIndex, illnessesEndIndex)
  
  // Reset to first page when illnesses change
  $: if (illnesses.length > 0) {
    currentIllnessesPage = 1
  }
  
  // Pagination functions for illnesses
  const goToIllnessesPage = (page) => {
    if (page >= 1 && page <= totalIllnessesPages) {
      currentIllnessesPage = page
    }
  }
  
  const goToPreviousIllnessesPage = () => {
    if (currentIllnessesPage > 1) {
      currentIllnessesPage--
    }
  }
  
  const goToNextIllnessesPage = () => {
    if (currentIllnessesPage < totalIllnessesPages) {
      currentIllnessesPage++
    }
  }
  
  // Pagination for reports
  let currentReportsPage = 1
  let reportsPerPage = 25
  
  // Pagination calculations for reports
  $: totalReportsPages = Math.ceil(reports.length / reportsPerPage)
  $: reportsStartIndex = (currentReportsPage - 1) * reportsPerPage
  $: reportsEndIndex = reportsStartIndex + reportsPerPage
  $: paginatedReports = reports.slice(reportsStartIndex, reportsEndIndex)
  
  // Reset to first page when reports change
  $: if (reports.length > 0) {
    currentReportsPage = 1
  }
  
  // Pagination functions for reports
  const goToReportsPage = (page) => {
    if (page >= 1 && page <= totalReportsPages) {
      currentReportsPage = page
    }
  }
  
  const goToPreviousReportsPage = () => {
    if (currentReportsPage > 1) {
      currentReportsPage--
    }
  }
  
  const goToNextReportsPage = () => {
    if (currentReportsPage < totalReportsPages) {
      currentReportsPage++
    }
  }
  
  // Pagination for diagnoses
  let currentDiagnosesPage = 1
  let diagnosesPerPage = 25
  
  // Pagination calculations for diagnoses
  $: totalDiagnosesPages = Math.ceil(diagnoses.length / diagnosesPerPage)
  $: diagnosesStartIndex = (currentDiagnosesPage - 1) * diagnosesPerPage
  $: diagnosesEndIndex = diagnosesStartIndex + diagnosesPerPage
  $: paginatedDiagnoses = diagnoses.slice(diagnosesStartIndex, diagnosesEndIndex)
  
  // Reset to first page when diagnoses change
  $: if (diagnoses.length > 0) {
    currentDiagnosesPage = 1
  }
  
  // Pagination functions for diagnoses
  const goToDiagnosesPage = (page) => {
    if (page >= 1 && page <= totalDiagnosesPages) {
      currentDiagnosesPage = page
    }
  }
  
  const goToPreviousDiagnosesPage = () => {
    if (currentDiagnosesPage > 1) {
      currentDiagnosesPage--
    }
  }
  
  const goToNextDiagnosesPage = () => {
    if (currentDiagnosesPage < totalDiagnosesPages) {
      currentDiagnosesPage++
    }
  }
  let currentMedications = [] // Current medications in the working prescription (for display)
  let activeTab = initialTab
  const allTabs = ['overview', 'symptoms', 'reports', 'diagnoses', 'prescriptions']
  let enabledTabs = [...allTabs]
  let isNewPrescriptionSession = false
  
  // Reactive statement to ensure PatientTabs gets updated enabledTabs
  $: console.log('🔄 enabledTabs changed:', enabledTabs)
  $: enabledTabsKey = enabledTabs.join(',') // Force reactivity by creating a key
  
  // Auto-navigate to initial tab when a new patient is selected
  $: if (selectedPatient) {
    console.log('🔄 New patient selected, navigating to initial tab:', initialTab)
    activeTab = initialTab
    enabledTabs = [...allTabs]
  }
  
  // Track AI diagnostics state
  let isShowingAIDiagnostics = false
  let showIllnessForm = false
  let showMedicationForm = false
  let showSymptomsForm = false
  let showPrescriptionPDF = false
  let expandedSymptoms = {}
  
  // Confirmation modal state
  let showConfirmationModal = false
  let confirmationConfig = {
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'warning',
    requireCode: false
  }
  let pendingAction = null
  let deleteCode = ''
  
  // Confirmation modal helper functions
  function showConfirmation(title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning') {
    const normalizedConfirm = String(confirmText || '').toLowerCase()
    const isDestructive = type === 'danger' && /delete|clear|remove/.test(normalizedConfirm)
    confirmationConfig = { title, message, confirmText, cancelText, type, requireCode: isDestructive }
    showConfirmationModal = true
  }
  
  function handleConfirmationConfirm() {
    if (pendingAction) {
      pendingAction()
      pendingAction = null
    }
    showConfirmationModal = false
  }
  
  function handleConfirmationCancel() {
    pendingAction = null
    showConfirmationModal = false
  }

  const openHelpInventory = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = 'help-inventory'
    }
    dispatch('view-change', 'help')
  }
  
  let expandedIllnesses = {}
  let loading = true
  let editingMedication = null
  let prescriptionNotes = ''
  let prescriptionDiscount = 0 // New discount field
  let prescriptionDiscountScope = 'consultation'
  let nextAppointmentDate = ''
  let prescriptionProcedures = []
  let otherProcedurePrice = ''
  let excludeConsultationCharge = false
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
    phoneCountryCode: '',
    gender: '',
    dateOfBirth: '',
    age: '',
    weight: '',
    bloodGroup: '',
    idNumber: '',
    address: '',
    allergies: '',
    longTermMedications: '',
    emergencyContact: '',
    emergencyPhone: ''
  }
  let editError = ''
  let savingPatient = false
  let deletingPatient = false
  let editLongTermMedications = null // For editing long-term medications in overview
  
  // AI analysis state
  let aiCheckComplete = false
  let aiCheckMessage = ''
  let prescriptionFinished = false
  let lastAnalyzedMedications = []
  
  // Full AI Analysis
  let fullAIAnalysis = null
  let loadingFullAnalysis = false

  // Patient Management Summary
  let patientSummary = null
  let loadingPatientSummary = false
  let showPatientSummary = false
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

      // Load reports
      reports = await firebaseStorage.getReportsByPatientId(selectedPatient.id) || []
      console.log('✅ Loaded reports:', reports.length)
      
      // Set up current prescription and medications
      setupCurrentPrescription()
      
    } catch (error) {
      console.error('Error loading patient data:', error)
      // Ensure arrays are always defined
      illnesses = []
      prescriptions = []
      symptoms = []
      reports = []
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
    // Only consider prescriptions that have medications as existing prescriptions
    // If no drugs in prescription, always consider as a new prescription
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
      prescriptionProcedures = Array.isArray(currentPrescription.procedures) ? currentPrescription.procedures : []
      otherProcedurePrice = currentPrescription.otherProcedurePrice || ''
      excludeConsultationCharge = !!currentPrescription.excludeConsultationCharge
      prescriptionDiscount = Number.isFinite(Number(currentPrescription.discount)) ? Number(currentPrescription.discount) : 0
      prescriptionDiscountScope = currentPrescription.discountScope || 'consultation'
      nextAppointmentDate = currentPrescription.nextAppointmentDate || ''
      
      console.log('📅 Set current medications:', currentMedications.length)
    } else {
      console.log('🔧 No existing prescriptions found - will create new one when needed')
      currentPrescription = null
      currentMedications = []
      prescriptionProcedures = []
      otherProcedurePrice = ''
      excludeConsultationCharge = false
      prescriptionDiscount = 0
      prescriptionDiscountScope = 'consultation'
      nextAppointmentDate = ''
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
        prescriptionProcedures = Array.isArray(updatedPrescription.procedures) ? updatedPrescription.procedures : []
        otherProcedurePrice = updatedPrescription.otherProcedurePrice || ''
        excludeConsultationCharge = !!updatedPrescription.excludeConsultationCharge
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
      const doctor = await getEffectiveDoctorProfile()
      console.log('🔍 Doctor info for analysis:', doctor)
      
      const reportAnalyses = await openaiService.analyzeReportImages(getRecentReportsSummary(), {
        patientCountry: selectedPatient?.country || 'Not specified',
        doctorCountry: effectiveDoctorSettings?.country || doctor?.country || 'Not specified'
      })

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
        longTermMedications: selectedPatient.longTermMedications,
        medicalHistory: selectedPatient.medicalHistory,
        currentMedications: selectedPatient.currentMedications,
        emergencyContact: selectedPatient.emergencyContact,
        
        // Current Prescription Data
        medications: currentMedications,
        symptoms: symptoms,
        illnesses: illnesses,
        recentPrescriptions: getRecentPrescriptionsSummary(),
        recentReports: getRecentReportsSummary(),
        reportAnalyses: reportAnalyses,
        
        // Location Information
        patientAddress: selectedPatient.address,
        patientCity: selectedPatient.city,
        patientCountry: selectedPatient.country,
        patientPhone: selectedPatient.phone,
        patientEmail: selectedPatient.email,
        
        // Doctor Information
        doctorName: getDisplayDoctorName(doctor),
        doctorCountry: effectiveDoctorSettings?.country || doctor?.country || 'Not specified',
        doctorCity: effectiveDoctorSettings?.city || doctor?.city || 'Not specified',
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
      
    } catch (error) {
      console.error('❌ Error performing full AI analysis:', error)
      fullAnalysisError = error.message
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

  // Generate AI Patient Summary
  const generatePatientSummary = async () => {
    try {
      loadingPatientSummary = true
      showPatientSummary = false

      console.log('🤖 Starting AI patient summary generation...')
      console.log('🔍 Patient:', selectedPatient.firstName, selectedPatient.lastName)

      // Get doctor information
      const firebaseUser = currentUser || authService.getCurrentUser()
      const doctor = await getEffectiveDoctorProfile()
      const resolvedDoctorId = doctor?.id || firebaseUser?.id || firebaseUser?.uid || 'default-user'

      const reportAnalyses = await openaiService.analyzeReportImages(getRecentReportsSummary(), {
        patientCountry: selectedPatient?.country || 'Not specified',
        doctorCountry: effectiveDoctorSettings?.country || 'Not specified'
      })

      // Prepare comprehensive patient data
      const patientData = {
        name: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
        firstName: selectedPatient.firstName,
        lastName: selectedPatient.lastName,
        age: selectedPatient.age,
        weight: selectedPatient.weight,
        bloodGroup: selectedPatient.bloodGroup,
        gender: selectedPatient.gender,
        dateOfBirth: selectedPatient.dateOfBirth,
        allergies: selectedPatient.allergies,
        longTermMedications: selectedPatient.longTermMedications,
        medicalHistory: selectedPatient.medicalHistory,
        symptoms: symptoms || [],
        illnesses: illnesses || [],
        prescriptions: prescriptions || [],
        recentReports: getRecentReportsSummary(),
        reportAnalyses: reportAnalyses
      }

      // Generate patient summary using OpenAI
      const result = await openaiService.generatePatientSummary(patientData, resolvedDoctorId)

      patientSummary = result.summary
      showPatientSummary = true

      console.log('✅ Patient summary generated successfully')

      // Dispatch event for token tracking
      dispatch('ai-usage-updated', {
        tokensUsed: result.tokensUsed,
        type: 'patientSummary'
      })

    } catch (error) {
      console.error('❌ Error generating patient summary:', error)
      patientSummary = `<div class="text-red-600">
        <p><strong>Error generating patient summary:</strong></p>
        <p>${error.message}</p>
        <p class="text-sm text-gray-500 mt-2">Please check your OpenAI API configuration and try again.</p>
      </div>`
      showPatientSummary = true
    } finally {
      loadingPatientSummary = false
    }
  }

  // Close patient summary
  const closePatientSummary = () => {
    showPatientSummary = false
    patientSummary = null
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
      
      pendingAction = async () => {
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
        
        // Notify parent component to refresh medical summary
        dispatch('dataUpdated', { 
          type: 'symptoms', 
          data: null // Indicates deletion
        })
      }
    } catch (error) {
      console.error('❌ Error deleting symptom:', error)
    }
    
    showConfirmation(
      'Delete Symptom',
      'Are you sure you want to delete this symptom?',
      'Delete',
      'Cancel',
      'danger'
    )
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

  const buildPatientSnapshot = () => {
    if (!selectedPatient) return null
    return {
      id: selectedPatient.id || '',
      firstName: selectedPatient.firstName || '',
      lastName: selectedPatient.lastName || '',
      age: selectedPatient.age || '',
      gender: selectedPatient.gender || '',
      bloodGroup: selectedPatient.bloodGroup || '',
      phone: selectedPatient.phone || '',
      email: selectedPatient.email || '',
      address: selectedPatient.address || '',
      idNumber: selectedPatient.idNumber || ''
    }
  }
  
  // Save or update current prescription to ensure it is persisted
  const saveCurrentPrescriptions = async () => {
    try {
      console.log('💾 Saving/updating current prescription...')
      
      if (!currentPrescription) {
        console.log('⚠️ No current prescription to save')
        return
      }

      currentPrescription.procedures = Array.isArray(prescriptionProcedures) ? prescriptionProcedures : []
      currentPrescription.otherProcedurePrice = otherProcedurePrice
      currentPrescription.excludeConsultationCharge = !!excludeConsultationCharge
      currentPrescription.discountScope = prescriptionDiscountScope || 'consultation'
      currentPrescription.nextAppointmentDate = nextAppointmentDate || ''
      currentPrescription.patient = buildPatientSnapshot()
      
      // Check if prescription already exists in database
      const existingPrescription = prescriptions.find(p => p.id === currentPrescription.id)
      
      if (!existingPrescription) {
        // This is a new prescription that needs to be saved
        const savedPrescription = await firebaseStorage.createPrescription({
          ...currentPrescription,
          patientId: selectedPatient.id,
          doctorId: doctorId,
          otherProcedurePrice: otherProcedurePrice,
          discountScope: prescriptionDiscountScope || 'consultation',
          nextAppointmentDate: nextAppointmentDate || '',
          patient: buildPatientSnapshot()
        })
        console.log('✅ Saved new prescription with', currentPrescription.medications.length, 'medications')
        
        // Add to prescriptions array
        prescriptions = [...prescriptions, savedPrescription]
        
        // Dispatch event to invalidate chart cache
        window.dispatchEvent(new CustomEvent('prescriptionSaved', { 
          detail: { prescriptionId: savedPrescription.id } 
        }))
      } else {
        // Always update existing prescription to ensure latest data is saved
        const updatedPrescription = {
          ...currentPrescription,
          patientId: selectedPatient.id,
          doctorId: doctorId,
          otherProcedurePrice: otherProcedurePrice,
          discountScope: prescriptionDiscountScope || 'consultation',
          nextAppointmentDate: nextAppointmentDate || '',
          patient: buildPatientSnapshot()
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
      return
    }

    if (!openaiService.isConfigured()) {
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

      const reportAnalyses = await openaiService.analyzeReportImages(getRecentReportsSummary(), {
        patientCountry: selectedPatient?.country || 'Not specified',
        doctorCountry: effectiveDoctorSettings?.country || 'Not specified'
      })

      const suggestions = await openaiService.generateAIDrugSuggestions(
        symptoms,
        currentMedications,
        patientAge,
        doctorId,
        {
          patientCountry: selectedPatient?.country || 'Not specified',
          patientAllergies: selectedPatient?.allergies || 'None',
          patientGender: selectedPatient?.gender || 'Not specified',
          longTermMedications: selectedPatient?.longTermMedications || 'None',
          currentActiveMedications: getCurrentMedications(),
          recentPrescriptions: getRecentPrescriptionsSummary(),
          recentReports: getRecentReportsSummary(),
          reportAnalyses: reportAnalyses,
          doctorCountry: effectiveDoctorSettings?.country || 'Not specified'
        }
      )

      console.log('🔍 Received suggestions from AI service:', suggestions)
      console.log('🔍 Suggestions type:', typeof suggestions)
      console.log('🔍 Is suggestions array?', Array.isArray(suggestions))

      aiDrugSuggestions = suggestions
      showAIDrugSuggestions = true
      console.log('✅ AI drug suggestions generated:', suggestions.length)

    } catch (error) {
      console.error('❌ Error generating AI drug suggestions:', error)
    } finally {
      loadingAIDrugSuggestions = false
    }
  }

  // Add AI suggested drug to prescription
  const addAISuggestedDrug = async (suggestion, suggestionIndex) => {
    if (!currentPrescription) {
      return
    }

    try {
      const medicationData = {
        name: suggestion.name,
        dosage: suggestion.dosage,
        frequency: suggestion.frequency,
        duration: suggestion.duration,
        instructions: suggestion.instructions || '',
        aiSuggested: true,
        aiReason: suggestion.reason || '',
        patientId: selectedPatient.id,
        doctorId: doctorId
      }

      // Save medication to database first to get proper ID
      const savedMedication = await firebaseStorage.addMedicationToPrescription(
        currentPrescription.id, 
        medicationData
      )
      
      console.log('💾 AI suggested medication saved to database:', savedMedication)

      // Update the current prescription object
      if (!currentPrescription.medications) {
        currentPrescription.medications = []
      }
      currentPrescription.medications.push(savedMedication)
      currentPrescription.updatedAt = new Date().toISOString()
      
      // Update prescriptions array to trigger reactivity
      const prescriptionIndex = prescriptions.findIndex(p => p.id === currentPrescription.id)
      if (prescriptionIndex !== -1) {
        prescriptions[prescriptionIndex] = currentPrescription
        prescriptions = [...prescriptions]
      }
      
      // Update current medications array for display
      currentMedications = currentPrescription.medications
      
      // Remove the suggestion from the AI suggestions list
      aiDrugSuggestions = aiDrugSuggestions.filter((_, index) => index !== suggestionIndex)
      
      console.log('💊 Added AI suggested drug:', savedMedication.name)
      console.log('💊 Updated currentPrescription.medications:', currentPrescription.medications.length)
      console.log('🗑️ Removed suggestion from AI list, remaining:', aiDrugSuggestions.length)
      
      // Hide suggestions section if no suggestions remain
      if (aiDrugSuggestions.length === 0) {
        showAIDrugSuggestions = false
        console.log('🔍 Hiding AI suggestions section - all suggestions added')
      }
      
      // Reset AI analysis state when medications change (only if prescription is not finished)
      if (!prescriptionFinished) {
        aiCheckComplete = false
        aiCheckMessage = ''
        lastAnalyzedMedications = []
      }
      
      
    } catch (error) {
      console.error('❌ Error adding AI suggested drug:', error)
    }
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
      
      pendingAction = async () => {
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
        } else {
          console.error('❌ Medication not found at index:', index)
        }
      }
    } catch (error) {
      console.error('❌ Error deleting medication by index:', error)
    }
    
    showConfirmation(
      'Delete Medication',
      'Are you sure you want to delete this medication?',
      'Delete',
      'Cancel',
      'danger'
    )
  }

  // Print prescriptions to PDF
  const printPrescriptions = async () => {
    try {
      console.log('🖨️ Printing prescriptions to PDF')
      
      // Check AI drug interactions first
      console.log('🔍 Current medications count:', currentMedications.length)
      console.log('🔍 OpenAI configured:', openaiService.isConfigured())
      console.log('🔍 Current medications:', currentMedications.map(m => m.name))
      
      // NEW RULE: When "Print PDF", mark prescription as printed and move to history/summary
      if (currentPrescription) {
        currentPrescription.status = 'sent'
        currentPrescription.printedAt = new Date().toISOString()
        currentPrescription.endDate = new Date().toISOString().split('T')[0] // Mark as historical
        
        // Update in Firebase
        await firebaseStorage.updatePrescription(currentPrescription.id, {
          status: 'sent',
          printedAt: new Date().toISOString(),
          endDate: new Date().toISOString().split('T')[0], // Add endDate for history
          updatedAt: new Date().toISOString()
        })
        
        // Update the prescription in the local array
        const prescriptionIndex = prescriptions.findIndex(p => p.id === currentPrescription.id);
        if (prescriptionIndex !== -1) {
          prescriptions[prescriptionIndex] = currentPrescription;
        }
        
        console.log('✅ Marked current prescription as printed and moved to history/summary');
      }
      
      // Save current prescriptions first
      await saveCurrentPrescriptions()
      
      // Generate and download PDF
      await generatePrescriptionPDF()
      
      console.log('🎉 Prescriptions printed successfully')
    } catch (error) {
      console.error('❌ Error printing prescriptions:', error)
    }
  }

  const printExternalPrescriptions = async (externalMedications = []) => {
    try {
      if (!Array.isArray(externalMedications) || externalMedications.length === 0) {
        console.warn('⚠️ No external medications to print')
        return
      }

      console.log('🖨️ Printing external prescription PDF')

      await saveCurrentPrescriptions()
      await generatePrescriptionPDF(externalMedications)

      console.log('🎉 External prescription printed successfully')
    } catch (error) {
      console.error('❌ Error printing external prescription:', error)
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
  let reportFilePreview = null
  let reportFileDataUrl = null
  let reportError = ''
  
  // Diagnostic data functionality
  let showDiagnosticForm = false
  let diagnosticTitle = ''
  let diagnosticDescription = ''
  let diagnosticCode = ''
  let diagnosticSeverity = 'moderate' // mild, moderate, severe
  let diagnosticDate = new Date().toISOString().split('T')[0]
  let diagnoses = []

  const updateReport = (reportId, updates) => {
    const index = reports.findIndex(report => report.id === reportId)
    if (index === -1) {
      return
    }
    reports = reports.map(report => (report.id === reportId ? { ...report, ...updates } : report))
  }

  const isAnalysisUnclear = (analysisText) => {
    if (!analysisText) {
      return false
    }
    const normalized = analysisText.toLowerCase()
    const indicators = [
      'unreadable',
      'not clear',
      'unclear',
      'insufficient',
      'cannot interpret',
      'non-diagnostic',
      'poor quality',
      'blurry'
    ]
    return indicators.some(indicator => normalized.includes(indicator))
  }

  const analyzeReport = async (report) => {
    if (!report || report.type !== 'image') {
      return
    }
    if (!openaiService.isConfigured()) {
      updateReport(report.id, { analysisError: 'AI analysis is not configured.', analysisPending: false })
      return
    }

    updateReport(report.id, { analysisPending: true, analysisError: '', analysis: null, analysisUnclear: false })

    try {
      const analyses = await openaiService.analyzeReportImages([report], {
        patientCountry: selectedPatient?.country || 'Not specified',
        doctorCountry: effectiveDoctorSettings?.country || 'Not specified'
      })
      const analysis = analyses[0]?.analysis || 'No analysis available.'
      updateReport(report.id, {
        analysis,
        analysisPending: false,
        analysisUnclear: isAnalysisUnclear(analysis)
      })
    } catch (error) {
      updateReport(report.id, {
        analysisError: error.message || 'Failed to analyze report.',
        analysisPending: false
      })
    }
  }

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  // Report functions
  const addReport = async () => {
    if (!reportTitle.trim()) {
      reportError = 'Report title is required.'
      return
    }

    if (reportType === 'text' && !reportText.trim()) {
      return
    }
    
    if (reportType !== 'text' && reportFiles.length === 0) {
      return
    }
    
    let imageDataUrl = reportFileDataUrl
    if (reportType === 'image' && !imageDataUrl && reportFiles[0]) {
      try {
        imageDataUrl = await readFileAsDataUrl(reportFiles[0])
      } catch (error) {
        reportError = 'Failed to read image file.'
        return
      }
    }

    const reportFilesMeta = reportType !== 'text'
      ? reportFiles.map(file => ({ name: file.name, size: file.size, type: file.type }))
      : []

    const reportPayload = {
      title: reportTitle.trim(),
      type: reportType,
      date: reportDate,
      content: reportType === 'text' ? reportText : null,
      files: reportFilesMeta,
      dataUrl: reportType === 'image' ? imageDataUrl : null,
      patientId: selectedPatient?.id || null,
      doctorId: doctorId || currentUser?.id || currentUser?.uid || null,
      analysis: null,
      analysisPending: false,
      analysisError: '',
      analysisUnclear: false,
      createdAt: new Date().toISOString()
    }

    let savedReport = null
    try {
      savedReport = await firebaseStorage.createReport(reportPayload)
    } catch (error) {
      reportError = error.message || 'Failed to save report.'
      return
    }
    const newReport = {
      ...savedReport,
      previewUrl: reportType === 'image' ? reportFilePreview : null
    }

    reports = [...reports, newReport]

    if (newReport.type === 'image') {
      await analyzeReport(newReport)
    }
    
    // Reset form
    reportTitle = ''
    reportText = ''
    reportFiles = []
    reportType = 'text'
    reportDate = new Date().toISOString().split('T')[0]
    reportFilePreview = null
    reportFileDataUrl = null
    reportError = ''
    showReportForm = false
    
  }

  const setReportFilePreview = (nextUrl) => {
    if (reportFilePreview && reportFilePreview.startsWith('blob:')) {
      URL.revokeObjectURL(reportFilePreview)
    }
    reportFilePreview = nextUrl
  }
  
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files)
    reportFiles = files
    if (reportType === 'image' && files.length > 0) {
      setReportFilePreview(URL.createObjectURL(files[0]))
      const reader = new FileReader()
      reader.onload = () => {
        reportFileDataUrl = reader.result
      }
      reader.readAsDataURL(files[0])
    } else {
      setReportFilePreview(null)
      reportFileDataUrl = null
    }
  }
  
  const removeReport = async (reportId) => {
    const reportToRemove = reports.find(r => r.id === reportId)
    if (reportToRemove?.previewUrl && reportToRemove.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(reportToRemove.previewUrl)
    }
    try {
      await firebaseStorage.deleteReport(reportId)
    } catch (error) {
      console.error('Failed to delete report:', error)
    }
    reports = reports.filter(r => r.id !== reportId)
  }

  $: if (reportType !== 'image' && reportFilePreview) {
    setReportFilePreview(null)
  }
  $: if (reportType !== 'image' && reportFileDataUrl) {
    reportFileDataUrl = null
  }

  $: if (reportError && reportTitle.trim()) {
    reportError = ''
  }

  // Diagnostic functions
  const addDiagnosis = () => {
    if (!diagnosticTitle.trim()) {
      return
    }
    
    if (!diagnosticDescription.trim()) {
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
    
  }
  
  const removeDiagnosis = (diagnosisId) => {
    diagnoses = diagnoses.filter(d => d.id !== diagnosisId)
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
        return
      }
      
      // Get the actual doctor data from Firebase
      const doctor = await getEffectiveDoctorProfile()
      console.log('🔍 Doctor from Firebase:', doctor)
      
      if (!doctor) {
        console.log('❌ Doctor not found in Firebase')
        return
      }
      
      // Check if patient is selected
      if (!selectedPatient) {
        console.log('❌ No patient selected')
        return
      }
      
      // Get current medications (the actual prescriptions to send)
      console.log('🔍 Current medications to send:', currentMedications)
      if (!currentMedications || currentMedications.length === 0) {
        console.log('❌ No medications to send')
        return
      }
      
      // NEW RULE: When "Send to Pharmacy", mark prescription as sent and move to history/summary
      if (currentPrescription) {
        currentPrescription.status = 'sent'
        currentPrescription.sentToPharmacy = true
        currentPrescription.sentAt = new Date().toISOString()
        currentPrescription.endDate = new Date().toISOString().split('T')[0] // Mark as historical
        
        // Update in Firebase
        await firebaseStorage.updatePrescription(currentPrescription.id, {
          status: 'sent',
          sentToPharmacy: true,
          sentAt: new Date().toISOString(),
          endDate: new Date().toISOString().split('T')[0], // Add endDate for history
          updatedAt: new Date().toISOString()
        })
        
        // Update the prescription in the local array
        const prescriptionIndex = prescriptions.findIndex(p => p.id === currentPrescription.id);
        if (prescriptionIndex !== -1) {
          prescriptions[prescriptionIndex] = currentPrescription;
        }
        
        console.log('✅ Marked current prescription as sent to pharmacy and moved to history/summary');
      }
      
      // Create prescription data from current medications for sending to pharmacy
      const sendingDoctorName = getSendingDoctorName() || getDisplayDoctorName(doctor)
      const prescriptionsToSend = [{
        id: Date.now().toString(),
        patientId: selectedPatient.id,
        doctorId: doctor.id,
        doctorName: sendingDoctorName,
        patient: buildPatientSnapshot(),
        medications: currentMedications.map(enrichMedicationForPharmacy),
        notes: prescriptionNotes || '',
        procedures: Array.isArray(prescriptionProcedures) ? prescriptionProcedures : [],
        otherProcedurePrice: otherProcedurePrice,
        excludeConsultationCharge: !!excludeConsultationCharge,
        discount: prescriptionDiscount || 0, // Include discount for pharmacy
        discountScope: prescriptionDiscountScope || 'consultation',
        nextAppointmentDate: nextAppointmentDate || '',
        createdAt: new Date().toISOString(),
        status: 'pending'
      }]
      console.log('🔍 Created prescription data:', prescriptionsToSend)
      
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
        pendingAction = openHelpInventory
        showConfirmation(
          'Connect a Pharmacy',
          'No pharmacy is connected to your account. Please connect a pharmacy to send prescriptions.',
          'Open Help',
          'Close',
          'info'
        )
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
    }
  }

  // Send prescriptions to selected pharmacies
  const sendToSelectedPharmacies = async () => {
    try {
      console.log('📤 Sending prescriptions to selected pharmacies:', selectedPharmacies)
      
      const doctor = await getEffectiveDoctorProfile()
      
      const resolvePharmacyDiscount = (prescriptionList = []) => {
        if (prescriptionDiscount && !isNaN(prescriptionDiscount)) {
          return Number(prescriptionDiscount)
        }
        const directDiscount = currentPrescription?.discount
        if (directDiscount && !isNaN(directDiscount)) {
          return Number(directDiscount)
        }
        const listDiscount = prescriptionList.find(p => p?.discount && !isNaN(p.discount))?.discount
        return listDiscount ? Number(listDiscount) : 0
      }

      const resolveDiscountScope = (prescriptionList = []) => {
        if (prescriptionDiscountScope) {
          return prescriptionDiscountScope
        }
        const directScope = currentPrescription?.discountScope
        if (directScope) {
          return directScope
        }
        const listScope = prescriptionList.find(p => p?.discountScope)?.discountScope
        return listScope || 'consultation'
      }

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

      const pharmacyDiscount = resolvePharmacyDiscount(prescriptions)
      const pharmacyDiscountScope = resolveDiscountScope(prescriptions)
      const prescriptionsWithDiscount = prescriptions.map(prescription => ({
        ...prescription,
        discount: prescription?.discount ?? pharmacyDiscount,
        discountScope: prescription?.discountScope || pharmacyDiscountScope,
        procedures: Array.isArray(prescription?.procedures) ? prescription.procedures : prescriptionProcedures,
        otherProcedurePrice: prescription?.otherProcedurePrice ?? otherProcedurePrice,
        excludeConsultationCharge: typeof prescription?.excludeConsultationCharge === 'boolean'
          ? prescription.excludeConsultationCharge
          : !!excludeConsultationCharge,
        medications: Array.isArray(prescription?.medications)
          ? prescription.medications.map(enrichMedicationForPharmacy)
          : []
      }))
      
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
            doctorName: sendingDoctorName,
            patientId: selectedPatient.id,
            patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
            discount: pharmacyDiscount,
            discountScope: pharmacyDiscountScope,
            prescriptions: prescriptionsWithDiscount,
            createdAt: prescriptionsWithDiscount[0]?.createdAt || currentPrescription?.createdAt || new Date().toISOString(),
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
      
      // Clear selections
      selectedPharmacies = []
      
      // Show success message
      if (sentCount > 0) {
        notifySuccess(`Prescription sent to ${sentCount} pharmac${sentCount === 1 ? 'y' : 'ies'} successfully!`)
      } else {
        notifyError('No prescriptions were sent. Please check your selections.')
      }
      
      console.log('🎉 Prescriptions sent to pharmacies successfully')
      
    } catch (error) {
      console.error('❌ Error sending prescriptions to pharmacies:', error)
      notifyError('Failed to send prescription to pharmacies. Please try again.')
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
  const generatePrescriptionPDF = async (medicationsOverride = null) => {
    try {
      console.log('🔄 Starting PDF generation... [UPDATE v2.1.6]')
      const medicationsToPrint = Array.isArray(medicationsOverride)
        ? medicationsOverride
        : currentMedications
      
      // Load template settings
      let templateSettings = null
      try {
        console.log('🔍 PDF Generation - doctorId:', doctorId)
        console.log('🔍 PDF Generation - currentUser:', currentUser)
        
        const templateDoctor = await getEffectiveDoctorProfile()
        console.log('🔍 PDF Generation - doctor from Firebase:', templateDoctor)
        
        if (templateDoctor?.id) {
          templateSettings = await firebaseStorage.getDoctorTemplateSettings(templateDoctor.id)
          console.log('📋 Template settings loaded:', templateSettings)
          console.log('🔍 Template type:', templateSettings?.templateType)
          console.log('🔍 Template preview:', templateSettings?.templatePreview)
          console.log('🔍 Header text:', templateSettings?.headerText)
        } else {
          console.warn('⚠️ Doctor not found in Firebase for template settings')
        }
      } catch (error) {
        console.warn('⚠️ Could not load template settings:', error)
      }
      
      // Skip jsPDF test to avoid multiple downloads
      
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
      
      const currentDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit', 
        month: '2-digit',
        year: 'numeric'
      })
      
      console.log('📄 Creating A5 PDF content...')
      console.log('Patient:', selectedPatient.firstName, selectedPatient.lastName)
      console.log('Current medications:', medicationsToPrint.length)
      
      // A5 dimensions: 148mm width, 210mm height
      const pageWidth = 148
      const pageHeight = 210
      const margin = 20
      const contentWidth = pageWidth - (margin * 2)
      
      // Apply template settings to header
      let headerYStart = 5
      let contentYStart = 35
      
      // Variables to store captured header image for multi-page use (moved to proper scope)
      let capturedHeaderImage = null
      let capturedHeaderWidth = 0
      let capturedHeaderHeight = 0
      let capturedHeaderX = 0 // Store X position for consistent placement
      
      if (templateSettings) {
        console.log('🎨 Applying template settings:', templateSettings.templateType)
        
        if (templateSettings.templateType === 'upload' && templateSettings.uploadedHeader) {
          // Fall back to original upload logic if capture failed
          // For uploaded header image, embed the actual image
          console.log('🖼️ Embedding uploaded header image')
          
          try {
            // Convert pixels to mm (approximate: 1px ≈ 0.264583mm)
            const maxHeaderHeightMm = (templateSettings.headerSize || 300) * 0.264583
            const maxHeaderWidthMm = pageWidth - (margin * 2) // Full width minus margins
            
            headerYStart = 5
            
            console.log('🖼️ Max header dimensions:', maxHeaderWidthMm + 'mm x ' + maxHeaderHeightMm + 'mm')
            
            // Determine image format from base64 data
            let imageFormat = 'JPEG' // default
            if (templateSettings.uploadedHeader.includes('data:image/png')) {
              imageFormat = 'PNG'
            } else if (templateSettings.uploadedHeader.includes('data:image/jpeg') || templateSettings.uploadedHeader.includes('data:image/jpg')) {
              imageFormat = 'JPEG'
            } else if (templateSettings.uploadedHeader.includes('data:image/gif')) {
              imageFormat = 'GIF'
            }
            
            console.log('🖼️ Detected image format:', imageFormat)
            
            // Function to embed image with aspect ratio preservation
            const embedImageWithAspectRatio = () => {
              return new Promise((resolve, reject) => {
                // Create a temporary image to get dimensions and preserve aspect ratio
                const img = new Image()
                
                img.onload = () => {
                  try {
                    // Calculate aspect ratio
                    const aspectRatio = img.width / img.height
                    
                    // Calculate actual dimensions preserving aspect ratio
                    let actualWidthMm = maxHeaderWidthMm
                    let actualHeightMm = maxHeaderWidthMm / aspectRatio
                    
                    // If height exceeds max, scale down by height
                    if (actualHeightMm > maxHeaderHeightMm) {
                      actualHeightMm = maxHeaderHeightMm
                      actualWidthMm = maxHeaderHeightMm * aspectRatio
                    }
                    
                    console.log('🖼️ Original image dimensions:', img.width + 'px x ' + img.height + 'px')
                    console.log('🖼️ Aspect ratio:', aspectRatio.toFixed(2))
                    console.log('🖼️ Final PDF dimensions:', actualWidthMm.toFixed(1) + 'mm x ' + actualHeightMm.toFixed(1) + 'mm')
                    
                    // Add horizontal line after header
                    const lineY = headerYStart + actualHeightMm + 2
                    doc.setLineWidth(0.5)
                    doc.line(margin, lineY, pageWidth - margin, lineY)
                    
                    // Update content start position based on actual height
                    contentYStart = lineY + 5
                    
                    // Add the actual image to the PDF with preserved aspect ratio
            doc.addImage(
              templateSettings.uploadedHeader, // Base64 image data
              imageFormat, // detected format
              margin, // x position
              headerYStart, // y position
                      actualWidthMm, // width (preserved aspect ratio)
                      actualHeightMm, // height (preserved aspect ratio)
              undefined, // alias
              'FAST' // compression
            )
            
                    // Store uploaded header image for multi-page use
                    capturedHeaderImage = templateSettings.uploadedHeader
                    capturedHeaderWidth = actualWidthMm
                    capturedHeaderHeight = actualHeightMm
                    capturedHeaderX = margin // Store X position (left-aligned with margin)
                    
                    console.log('✅ Header image embedded successfully with preserved aspect ratio and stored for multi-page use')
                    resolve()
                  } catch (error) {
                    reject(error)
                  }
                }
                
                img.onerror = () => {
                  console.error('❌ Failed to load image for dimension calculation')
                  // Fallback to fixed dimensions
                  try {
                    const headerHeightMm = maxHeaderHeightMm
                    const headerWidthMm = maxHeaderWidthMm
                    
                    headerYStart = 5
                    
                    // Add horizontal line after header
                    const lineY = headerYStart + headerHeightMm + 2
                    doc.setLineWidth(0.5)
                    doc.line(margin, lineY, pageWidth - margin, lineY)
                    
                    contentYStart = lineY + 5
                    
                    doc.addImage(
                      templateSettings.uploadedHeader,
                      imageFormat,
                      margin,
                      headerYStart,
                      headerWidthMm,
                      headerHeightMm,
                      undefined,
                      'FAST'
                    )
                    
                    // Store uploaded header image for multi-page use
                    capturedHeaderImage = templateSettings.uploadedHeader
                    capturedHeaderWidth = headerWidthMm
                    capturedHeaderHeight = headerHeightMm
                    capturedHeaderX = margin // Store X position (left-aligned with margin)
                    
                    console.log('✅ Header image embedded with fallback dimensions and stored for multi-page use')
                    resolve()
                  } catch (error) {
                    reject(error)
                  }
                }
                
                // Load the image to trigger onload
                img.src = templateSettings.uploadedHeader
              })
            }
            
            // Wait for image to be processed
            await embedImageWithAspectRatio()
            
          } catch (imageError) {
            console.error('❌ Error embedding header image:', imageError)
            // Fallback to placeholder if image embedding fails
            const headerHeightMm = (templateSettings.headerSize || 300) * 0.264583
            headerYStart = 5
            contentYStart = headerYStart + headerHeightMm + 10
            
            doc.setFontSize(8)
            doc.setFont('helvetica', 'italic')
            doc.text('[Header Image Error - ' + Math.round(headerHeightMm) + 'mm height]', margin, headerYStart + 5)
          }
          
        } else if (templateSettings.templateType === 'printed') {
          // For printed letterheads, reserve space (no text, just space)
          const headerHeightMm = (templateSettings.headerSize || 300) * 0.264583
          headerYStart = 5
          
          console.log('🖨️ Printed letterhead space reserved:', headerHeightMm + 'mm')
          
          // Store printed header dimensions for multi-page use
          capturedHeaderImage = 'PRINTED_LETTERHEAD' // Special marker
          capturedHeaderWidth = 0 // No image width
          capturedHeaderHeight = headerHeightMm
          capturedHeaderX = 0 // Not used for printed
          
          // Add horizontal line after header space
          const lineY = headerYStart + headerHeightMm + 2
          doc.setLineWidth(0.5)
          doc.line(margin, lineY, pageWidth - margin, lineY)
          
          contentYStart = lineY + 5
          
        } else if (templateSettings.templateType === 'system') {
          // System header - use custom header content
          console.log('🏥 Using system header with custom content')
          console.log('🔍 Template settings debug:', JSON.stringify(templateSettings, null, 2))
          
          // Parse the header content from template settings
          const headerContent = templateSettings.templatePreview?.formattedHeader || templateSettings.headerText
          console.log('🔍 Header content sources:', {
            formattedHeader: templateSettings.templatePreview?.formattedHeader,
            headerText: templateSettings.headerText,
            selectedContent: headerContent
          })
          
          if (headerContent) {
            console.log('📝 Custom header content found:', headerContent)
            
            // Create a temporary container to render the header for image capture
            const headerContainer = document.createElement('div')
            headerContainer.style.position = 'absolute'
            headerContainer.style.left = '-9999px'
            headerContainer.style.top = '0'
            headerContainer.style.width = `${pageWidth - (margin * 2)}mm`
            headerContainer.style.minWidth = `${pageWidth - (margin * 2)}mm`
            headerContainer.style.backgroundColor = 'white'
            headerContainer.style.padding = '8px'
            headerContainer.style.fontFamily = 'Arial, sans-serif'
            headerContainer.style.lineHeight = '1.4'
            headerContainer.style.color = '#000000'
            headerContainer.style.textAlign = 'center'
            headerContainer.style.direction = 'ltr'
            
            // Add CSS to normalize styling and ensure proper alignment
            const style = document.createElement('style')
            style.textContent = `
              .header-capture-container {
                text-align: center !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                width: 100% !important;
                position: relative !important;
                margin: 0 auto !important;
              }
              .header-capture-container .ql-editor {
                width: 100% !important;
                padding: 0 !important;
                font-size: 24px !important;
                line-height: 1.4 !important;
                font-family: inherit !important;
              }
              .header-capture-container .ql-editor h1 {
                font-size: 3em !important;
                margin: 0.2em 0 !important;
              }
              .header-capture-container .ql-editor h2 {
                font-size: 2.4em !important;
                margin: 0.2em 0 !important;
              }
              .header-capture-container .ql-editor h3 {
                font-size: 1.9em !important;
                margin: 0.2em 0 !important;
              }
              .header-capture-container .ql-editor h4 {
                font-size: 1.5em !important;
                margin: 0.2em 0 !important;
              }
              .header-capture-container .ql-editor h5 {
                font-size: 1.25em !important;
                margin: 0.2em 0 !important;
              }
              .header-capture-container .ql-editor h6 {
                font-size: 1.1em !important;
                margin: 0.2em 0 !important;
              }
              .header-capture-container .ql-editor p {
                margin: 0.2em 0 !important;
              }
              .header-capture-container .ql-size-small {
                font-size: 0.75em !important;
              }
              .header-capture-container .ql-size-large {
                font-size: 1.9em !important;
              }
              .header-capture-container .ql-size-huge {
                font-size: 3em !important;
              }
              .header-capture-container * {
                box-sizing: border-box !important;
                outline: none !important;
                border: none !important;
                box-shadow: none !important;
                text-decoration: none !important;
              }
              .header-capture-container > * {
                width: 100% !important;
              }
              .header-capture-container p,
              .header-capture-container div,
              .header-capture-container span {
                display: block !important;
                width: 100% !important;
              }
              .header-capture-container .ql-editor,
              .header-capture-container [contenteditable] {
                outline: none !important;
                border: none !important;
                box-shadow: none !important;
                width: 100% !important;
              }
              .header-capture-container img {
                display: block !important;
                margin: 0 auto !important;
                max-width: 100% !important;
                height: auto !important;
                object-fit: contain !important;
              }
              .header-capture-container .resize-handle,
              .header-capture-container .quill-resize-handle {
                display: none !important;
              }
              .header-capture-container [style*="text-align: left"],
              .header-capture-container [style*="text-align:left"],
              .header-capture-container .text-left,
              .header-capture-container [align="left"] {
                text-align: left !important;
              }
              .header-capture-container .ql-align-center {
                text-align: center !important;
              }
              .header-capture-container .ql-align-right {
                text-align: right !important;
              }
              .header-capture-container .ql-align-left {
                text-align: left !important;
              }
            `
            document.head.appendChild(style)
            headerContainer.className = 'header-capture-container'
            
            // Clean the header content to remove editing artifacts while preserving alignment
            const pxPerMm = 3.7795275591
            const baseWidthPx = Math.round((pageWidth - (margin * 2)) * pxPerMm)
            const captureScale = 2
            let cleanHeaderContent = headerContent
              .replace(/style="[^"]*outline[^"]*"/gi, '') // Remove outline styles
              .replace(/style="[^"]*border[^"]*dotted[^"]*"/gi, '') // Remove dotted borders
              .replace(/style="[^"]*box-shadow[^"]*"/gi, '') // Remove box shadows
              .replace(/class="[^"]*resize-handle[^"]*"/gi, '') // Remove resize handles
              .replace(/class="[^"]*quill-resize-handle[^"]*"/gi, '') // Remove quill resize handles
              .replace(/<div[^>]*class="[^"]*resize-handle[^"]*"[^>]*>.*?<\/div>/gi, '') // Remove resize handle divs
              .replace(/<div[^>]*class="[^"]*quill-resize-handle[^"]*"[^>]*>.*?<\/div>/gi, '') // Remove quill resize handle divs
              // Preserve and normalize alignment styles and image sizing
              .replace(/style="([^"]*)"/gi, (match, styles) => {
                // Keep alignment styles and image sizing but clean others
                const cleanStyles = styles
                  .split(';')
                  .filter(style => {
                    const trimmed = style.trim()
                    return trimmed.includes('text-align') || 
                           trimmed.includes('font-') || 
                           trimmed.includes('color') ||
                           trimmed.includes('background') ||
                           trimmed.includes('margin') ||
                           trimmed.includes('padding') ||
                           trimmed.includes('width') ||
                           trimmed.includes('height') ||
                           trimmed.includes('max-width') ||
                           trimmed.includes('max-height')
                  })
                  .join(';')
                return cleanStyles ? `style="${cleanStyles}"` : ''
              })
            
            headerContainer.style.width = `${baseWidthPx}px`
            headerContainer.style.minWidth = `${baseWidthPx}px`
            headerContainer.innerHTML = `<div class="ql-editor">${cleanHeaderContent}</div>`
            
            // Add to DOM temporarily
            document.body.appendChild(headerContainer)
            
            // Small delay to ensure CSS is applied
            await new Promise(resolve => setTimeout(resolve, 100))
            
            try {
              // Import html2canvas dynamically
              const html2canvasModule = await import('html2canvas')
              const html2canvas = html2canvasModule.default
              
              console.log('📸 Capturing header as image... [UPDATE v2.1.6]')
              
              // Capture the header as an image
              const canvas = await html2canvas(headerContainer, {
                backgroundColor: 'white',
                scale: captureScale,
                useCORS: true,
                allowTaint: true,
                width: headerContainer.offsetWidth,
                height: headerContainer.offsetHeight,
                removeContainer: true,
                foreignObjectRendering: false,
                logging: false,
                ignoreElements: (element) => {
                  // Ignore resize handles and editing elements
                  return element.classList.contains('resize-handle') ||
                         element.classList.contains('quill-resize-handle') ||
                         element.style.outline ||
                         element.style.border?.includes('dotted')
                }
              })
              
              // Convert canvas to base64 image
              const headerImageData = canvas.toDataURL('image/png')
              console.log('📸 Header captured successfully [UPDATE v2.1.6]:', headerImageData.substring(0, 50) + '...')
              
              // Calculate proper dimensions maintaining aspect ratio
              const maxHeaderWidthMm = pageWidth
              const maxHeaderHeightMm = null
              const rawHeaderWidthMm = (canvas.width / captureScale) / pxPerMm
              const rawHeaderHeightMm = (canvas.height / captureScale) / pxPerMm
              const headerScale = 5
              
              // Calculate aspect ratio from canvas dimensions
              const aspectRatio = canvas.width / canvas.height
              
              // Calculate dimensions maintaining aspect ratio within limits
              let headerImageWidthMm = rawHeaderWidthMm * headerScale
              let headerImageHeightMm = rawHeaderHeightMm * headerScale

              if (headerImageWidthMm < maxHeaderWidthMm) {
                headerImageWidthMm = maxHeaderWidthMm
                headerImageHeightMm = headerImageWidthMm / aspectRatio
              }
              
              // If height exceeds limit, scale down based on height
              if (headerImageWidthMm > maxHeaderWidthMm) {
                headerImageWidthMm = maxHeaderWidthMm
                headerImageHeightMm = headerImageWidthMm / aspectRatio
              }

              if (maxHeaderHeightMm && headerImageHeightMm > maxHeaderHeightMm) {
                headerImageHeightMm = maxHeaderHeightMm
                headerImageWidthMm = headerImageHeightMm * aspectRatio
              }

              const minHeaderHeightMm = 0
              if (minHeaderHeightMm && headerImageHeightMm < minHeaderHeightMm) {
                headerImageHeightMm = minHeaderHeightMm
                headerImageWidthMm = headerImageHeightMm * aspectRatio
                if (headerImageWidthMm > maxHeaderWidthMm) {
                  headerImageWidthMm = maxHeaderWidthMm
                  headerImageHeightMm = headerImageWidthMm / aspectRatio
                }
              }
              
              console.log('📸 Header image dimensions for PDF [UPDATE v2.1.6]:', `${headerImageWidthMm.toFixed(1)}mm x ${headerImageHeightMm.toFixed(1)}mm (aspect ratio: ${aspectRatio.toFixed(2)})`)
              
              // Center the header image horizontally
              const headerImageX = (pageWidth - headerImageWidthMm) / 2
              
              // Add the header image to PDF with proper aspect ratio
              doc.addImage(headerImageData, 'PNG', headerImageX, headerYStart, headerImageWidthMm, headerImageHeightMm)
              
              // Store system header image for multi-page use
              capturedHeaderImage = headerImageData
              capturedHeaderWidth = headerImageWidthMm
              capturedHeaderHeight = headerImageHeightMm
              capturedHeaderX = headerImageX
              
              // Add horizontal line after header
              const lineY = headerYStart + headerImageHeightMm + 6
              doc.setLineWidth(0.5)
              doc.line(margin, lineY, pageWidth - margin, lineY)
              
              // Update content start position
              contentYStart = lineY + 5
              
              console.log('✅ Header image added to PDF successfully and stored for multi-page use')
              
            } catch (error) {
              console.error('❌ Error capturing header as image:', error)
              
              // Fallback to simple text parsing if image capture fails
              console.log('🔄 Falling back to text parsing...')
              const tempDiv = document.createElement('div')
              tempDiv.innerHTML = headerContent
              const headerText = tempDiv.textContent || tempDiv.innerText || ''
              const lines = headerText.split('\n').filter(line => line.trim())
              
              let currentY = headerYStart
              doc.setFontSize(12)
              doc.setFont('helvetica', 'normal')
              
              lines.forEach(line => {
                if (line.trim()) {
                  doc.text(line.trim(), margin, currentY)
                  currentY += 6
                }
              })
              
              // Add horizontal line after header
              const lineY = currentY + 2
              doc.setLineWidth(0.5)
              doc.line(margin, lineY, pageWidth - margin, lineY)
              
              contentYStart = lineY + 5
            } finally {
              // Clean up temporary container and style
              if (document.body.contains(headerContainer)) {
                document.body.removeChild(headerContainer)
              }
              if (style && document.head.contains(style)) {
                document.head.removeChild(style)
              }
            }
            
          } else {
            console.log('⚠️ No custom header content found, using default')
            // Fallback to default header if no custom content
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
        doc.text('MEDICAL PRESCRIPTION', margin, headerYStart)
            
            // Add version number to PDF for tracking
            doc.setFontSize(8)
            doc.setFont('helvetica', 'normal')
            doc.text('M-Prescribe v2.2.24', pageWidth - margin, pageHeight - 5, { align: 'right' })
            
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            doc.text('Your Medical Clinic', margin, headerYStart + 7)
            doc.text('123 Medical Street, City', margin, headerYStart + 12)
            doc.text('Phone: (555) 123-4567', margin, headerYStart + 17)
            
            // Add horizontal line after header
            const lineY = headerYStart + 22
            doc.setLineWidth(0.5)
            doc.line(margin, lineY, pageWidth - margin, lineY)
            
            contentYStart = lineY + 5
          }
        }
      }
      
      // Header with clinic name (only if no template settings are available)
      if (!templateSettings) {
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
        doc.text('MEDICAL PRESCRIPTION', margin, headerYStart)
        
        // Add version number to PDF for tracking
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text('M-Prescribe v2.2.22', pageWidth - margin, pageHeight - 5, { align: 'right' })
        
        // Clinic details
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text('Your Medical Clinic', margin, headerYStart + 7)
        doc.text('123 Medical Street, City', margin, headerYStart + 12)
        doc.text('Phone: (555) 123-4567', margin, headerYStart + 17)
        
        // Add horizontal line after header
        const lineY = headerYStart + 22
        doc.setLineWidth(0.5)
        doc.line(margin, lineY, pageWidth - margin, lineY)
        
        contentYStart = lineY + 5
      }
      
      // Patient information section
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('PATIENT INFORMATION', margin, contentYStart)
      
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
      
      // Name and Date on same line
      doc.text(`Name: ${selectedPatient.firstName} ${selectedPatient.lastName}`, margin, contentYStart + 7)
      doc.text(`Date: ${currentDate}`, pageWidth - margin, contentYStart + 7, { align: 'right' })
      
      // Age and Prescription number on same line
      doc.text(`Age: ${patientAge}`, margin, contentYStart + 13)
      const prescriptionId = formatPrescriptionId(currentPrescription?.id || Date.now().toString())
      doc.text(`Prescription #: ${prescriptionId}`, pageWidth - margin, contentYStart + 13, { align: 'right' })

      let barcodeDataUrl = null
      try {
        const barcodeCanvas = document.createElement('canvas')
        JsBarcode(barcodeCanvas, prescriptionId, {
          format: 'CODE128',
          displayValue: false,
          margin: 0,
          width: 0.9,
          height: 18
        })
        barcodeDataUrl = barcodeCanvas.toDataURL('image/png')
      } catch (error) {
        console.error('❌ Failed to generate barcode:', error)
      }

      if (barcodeDataUrl) {
        const barcodeWidth = 42
        const barcodeHeight = 8
        const barcodeX = pageWidth - margin - barcodeWidth
        const barcodeY = contentYStart + 15
        doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight)
      }
      
      // Sex/Gender on third line
      const patientSex = selectedPatient.gender || selectedPatient.sex || 'Not specified'
      doc.text(`Sex: ${patientSex}`, margin, contentYStart + 19)
      
      // Prescription medications section
      let yPos = contentYStart + 31
      
      if (medicationsToPrint && medicationsToPrint.length > 0) {
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text('PRESCRIPTION MEDICATIONS', margin, yPos)
        yPos += 6
        
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        
        medicationsToPrint.forEach((medication, index) => {
          if (yPos > pageHeight - 30) {
            doc.addPage()
            
            // Add header to new page if captured
            if (capturedHeaderImage) {
              if (capturedHeaderImage === 'PRINTED_LETTERHEAD') {
                // For printed letterhead, just reserve space and add line
                const lineY = headerYStart + capturedHeaderHeight + 2
                doc.setLineWidth(0.5)
                doc.line(margin, lineY, pageWidth - margin, lineY)
                yPos = lineY + 5
              } else {
                // For image headers, add the image
                doc.addImage(capturedHeaderImage, 'PNG', capturedHeaderX, headerYStart, capturedHeaderWidth, capturedHeaderHeight)
                
                // Add horizontal line after header
                const lineY = headerYStart + capturedHeaderHeight + 2
                doc.setLineWidth(0.5)
                doc.line(margin, lineY, pageWidth - margin, lineY)
                
                yPos = lineY + 5
              }
            } else {
              yPos = margin + 10 // Fallback if no captured image
            }
          }
          
          // Medication header with drug name and dosage on same line
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          
          // Drug name on the left
          doc.text(`${index + 1}. ${medication.name}`, margin, yPos)
          
          // Dosage on the right (bold and right-aligned)
          doc.text(`${medication.dosage}`, pageWidth - margin, yPos, { align: 'right' })
          
          // Other medication details on next line
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          
          // Build horizontal medication details string (excluding dosage since it's now on header line)
          let medicationDetails = `Frequency: ${medication.frequency}`
          
          // Add duration if available
          if (medication.duration) {
            medicationDetails += ` | Duration: ${medication.duration}`
          }
          
          // AI suggested indicator removed from PDF
          
          yPos += 4
          // Split text if too long for page width
          const detailsLines = doc.splitTextToSize(medicationDetails, contentWidth)
          doc.text(detailsLines, margin, yPos)
          yPos += detailsLines.length * 3
          
          // Add instructions on next line if available
          if (medication.instructions) {
            yPos += 2
            const instructionText = `Instructions: ${medication.instructions}`
            const instructionLines = doc.splitTextToSize(instructionText, contentWidth)
            doc.text(instructionLines, margin, yPos)
            yPos += instructionLines.length * 3
          }
          
          yPos += 4 // Space between medications
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
          
          // Add header to new page if captured
          if (capturedHeaderImage) {
            if (capturedHeaderImage === 'PRINTED_LETTERHEAD') {
              // For printed letterhead, just reserve space and add line
              const lineY = headerYStart + capturedHeaderHeight + 2
              doc.setLineWidth(0.5)
              doc.line(margin, lineY, pageWidth - margin, lineY)
              yPos = lineY + 5
            } else {
              // For image headers, add the image
              doc.addImage(capturedHeaderImage, 'PNG', capturedHeaderX, headerYStart, capturedHeaderWidth, capturedHeaderHeight)
              
              // Add horizontal line after header
              const lineY = headerYStart + capturedHeaderHeight + 2
              doc.setLineWidth(0.5)
              doc.line(margin, lineY, pageWidth - margin, lineY)
              
              yPos = lineY + 5
            }
          } else {
            yPos = margin + 10 // Fallback if no captured image
          }
        }
        
      doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text('ADDITIONAL NOTES', margin, yPos)
        yPos += 5
        
        doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
        const notes = doc.splitTextToSize(prescriptionNotes, contentWidth)
        doc.text(notes, margin, yPos)
        yPos += notes.length * 3
      }
      
      // Doctor signature section removed
      
      // Footer
      doc.setFontSize(7)
      doc.text('This prescription is valid for 30 days from the date of issue.', margin, pageHeight - 5)
      doc.text('Keep this prescription in a safe place.', margin + 75, pageHeight - 5)
      
      // Generate filename
      const filename = `Prescription_${selectedPatient.firstName}_${selectedPatient.lastName}_${currentDate.replace(/\//g, '-')}.pdf`
      
      console.log('💾 Opening PDF in new window:', filename)
      
      // Open PDF in new browser window instead of downloading
      const pdfBlob = doc.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)
      window.open(pdfUrl, '_blank')
      
      console.log('✅ A5 PDF generated and opened in new window:', filename)
      
    } catch (error) {
      console.error('❌ Error generating PDF:', error)
      console.error('Error details:', error.message)
      console.error('Error stack:', error.stack)
      
      // Show error message to user
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
      phoneCountryCode: selectedPatient.phoneCountryCode || getDialCodeForCountry(currentUser?.country || ''),
      gender: selectedPatient.gender || '',
      dateOfBirth: selectedPatient.dateOfBirth || '',
      age: selectedPatient.age || calculateAge(selectedPatient.dateOfBirth) || '',
      weight: selectedPatient.weight || '',
      bloodGroup: selectedPatient.bloodGroup || '',
      idNumber: selectedPatient.idNumber || '',
      address: selectedPatient.address || '',
      allergies: selectedPatient.allergies || '',
      longTermMedications: selectedPatient.longTermMedications || '',
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
      phoneCountryCode: '',
      gender: '',
      dateOfBirth: '',
      age: '',
      weight: '',
      bloodGroup: '',
      idNumber: '',
      address: '',
      allergies: '',
      longTermMedications: '',
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

  const handleDeletePatient = async () => {
    if (!selectedPatient?.id || deletingPatient) return

    const patientName = `${selectedPatient.firstName || ''} ${selectedPatient.lastName || ''}`.trim() || 'this patient'
    const confirmed = window.confirm(
      `Delete ${patientName}? This will remove the patient and all related records. This action cannot be undone.`
    )
    if (!confirmed) return

    deletingPatient = true
    editError = ''

    try {
      await firebaseStorage.deletePatient(selectedPatient.id)
      isEditingPatient = false
      dispatch('dataUpdated', { type: 'patient-deleted', data: { patientId: selectedPatient.id } })
    } catch (error) {
      console.error('❌ Error deleting patient:', error)
      editError = 'Failed to delete patient. Please try again.'
    } finally {
      deletingPatient = false
    }
  }

  // Handle long-term medications editing in overview
  const handleSaveLongTermMedications = async () => {
    try {
      console.log('💾 Saving long-term medications:', editLongTermMedications)
      
      // Update patient data
      const updatedPatient = {
        ...selectedPatient,
        longTermMedications: editLongTermMedications || '',
        updatedAt: new Date().toISOString()
      }
      
      // Save to Firebase
      await firebaseStorage.updatePatient(selectedPatient.id, updatedPatient)
      
      // Update local patient data
      selectedPatient.longTermMedications = editLongTermMedications || ''
      
      // Reset edit state
      editLongTermMedications = null
      
      console.log('✅ Long-term medications saved successfully')
      
    } catch (error) {
      console.error('❌ Error saving long-term medications:', error)
    }
  }

  const handleCancelLongTermMedications = () => {
    editLongTermMedications = null
    console.log('❌ Cancelled editing long-term medications')
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
        return
      }
      
      pendingAction = async () => {
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
      }
    } catch (error) {
      console.error('❌ Error deleting prescription:', error)
    }
    
    showConfirmation(
      'Delete Medication',
      'Are you sure you want to delete this medication?',
      'Delete',
      'Cancel',
      'danger'
    )
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
        return
      }
      
      if (currentMedications.length === 0) {
        return
      }
      
      // Update prescription status to 'saved' (finalized)
      currentPrescription.patient = buildPatientSnapshot()
      currentPrescription.status = 'finalized'
      currentPrescription.medications = currentMedications
      currentPrescription.procedures = Array.isArray(prescriptionProcedures) ? prescriptionProcedures : []
      currentPrescription.otherProcedurePrice = otherProcedurePrice
      currentPrescription.excludeConsultationCharge = !!excludeConsultationCharge
      currentPrescription.discountScope = prescriptionDiscountScope || 'consultation'
      currentPrescription.nextAppointmentDate = nextAppointmentDate || ''
      currentPrescription.finalizedAt = new Date().toISOString()
      
      // Save to Firebase
      await firebaseStorage.updatePrescription(currentPrescription.id, {
        status: 'finalized',
        medications: currentMedications,
        procedures: Array.isArray(prescriptionProcedures) ? prescriptionProcedures : [],
        otherProcedurePrice: otherProcedurePrice,
        excludeConsultationCharge: !!excludeConsultationCharge,
        patient: buildPatientSnapshot(),
        discountScope: prescriptionDiscountScope || 'consultation',
        nextAppointmentDate: nextAppointmentDate || '',
        finalizedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      
      // Update the prescription in the local array
      const prescriptionIndex = prescriptions.findIndex(p => p.id === currentPrescription.id);
      if (prescriptionIndex !== -1) {
        prescriptions[prescriptionIndex] = currentPrescription;
      }
      
      prescriptionsFinalized = true
      prescriptionFinished = true
      
      console.log('✅ Prescription finalized successfully (will move to history when new prescription starts)')
      
    } catch (error) {
      console.error('❌ Error finalizing prescription:', error)
      notifyError('Failed to finalize prescription: ' + error.message)
    }
  }
  
  // Reactive statement to reload data when refreshTrigger changes
  $: if (refreshTrigger > 0) {
    loadPatientData()
  }
  
  // Get current medications based on duration
  const getCurrentMedications = () => {
    if (!prescriptions || prescriptions.length === 0) {
      return []
    }

    const currentMedications = []
    const today = new Date()

    // Go through all prescriptions and their medications
    prescriptions.forEach(prescription => {
      if (prescription.medications && prescription.medications.length > 0) {
        prescription.medications.forEach(medication => {
          // Check if medication is still active based on duration
          if (isMedicationStillActive(medication, today)) {
            currentMedications.push({
              ...medication,
              prescriptionId: prescription.id,
              prescriptionDate: prescription.createdAt
            })
          }
        })
      }
    })

    // Sort by start date (most recent first)
    return currentMedications.sort((a, b) => {
      const dateA = new Date(a.startDate || a.createdAt || a.prescriptionDate)
      const dateB = new Date(b.startDate || b.createdAt || b.prescriptionDate)
      return dateB - dateA
    })
  }

  // Check if a medication is still active based on its duration
  const isMedicationStillActive = (medication, today) => {
    // If no start date, assume it's not active
    if (!medication.startDate && !medication.createdAt && !medication.prescriptionDate) {
      return false
    }

    const startDate = new Date(medication.startDate || medication.createdAt || medication.prescriptionDate)
    
    // If no duration specified, assume it's still active
    if (!medication.duration) {
      return true
    }

    // Parse duration (e.g., "7 days", "2 weeks", "1 month", "3 months")
    const duration = medication.duration.toLowerCase().trim()
    let endDate = new Date(startDate)

    if (duration.includes('day')) {
      const days = parseInt(duration.match(/\d+/)?.[0] || '0')
      endDate.setDate(startDate.getDate() + days)
    } else if (duration.includes('week')) {
      const weeks = parseInt(duration.match(/\d+/)?.[0] || '0')
      endDate.setDate(startDate.getDate() + (weeks * 7))
    } else if (duration.includes('month')) {
      const months = parseInt(duration.match(/\d+/)?.[0] || '0')
      endDate.setMonth(startDate.getMonth() + months)
    } else if (duration.includes('year')) {
      const years = parseInt(duration.match(/\d+/)?.[0] || '0')
      endDate.setFullYear(startDate.getFullYear() + years)
    } else {
      // If we can't parse the duration, assume it's still active
      return true
    }

    // Check if today is before or on the end date
    return today <= endDate
  }

  // Get remaining duration for a medication
  const getRemainingDuration = (medication) => {
    if (!medication.duration) {
      return 'Ongoing'
    }

    const today = new Date()
    const startDate = new Date(medication.startDate || medication.createdAt || medication.prescriptionDate)
    
    // Parse duration (e.g., "7 days", "2 weeks", "1 month", "3 months")
    const duration = medication.duration.toLowerCase().trim()
    let endDate = new Date(startDate)

    if (duration.includes('day')) {
      const days = parseInt(duration.match(/\d+/)?.[0] || '0')
      endDate.setDate(startDate.getDate() + days)
    } else if (duration.includes('week')) {
      const weeks = parseInt(duration.match(/\d+/)?.[0] || '0')
      endDate.setDate(startDate.getDate() + (weeks * 7))
    } else if (duration.includes('month')) {
      const months = parseInt(duration.match(/\d+/)?.[0] || '0')
      endDate.setMonth(startDate.getMonth() + months)
    } else if (duration.includes('year')) {
      const years = parseInt(duration.match(/\d+/)?.[0] || '0')
      endDate.setFullYear(startDate.getFullYear() + years)
    } else {
      return 'Ongoing'
    }

    // Calculate remaining time
    const timeDiff = endDate.getTime() - today.getTime()
    
    if (timeDiff <= 0) {
      return 'Expired'
    }

    const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
    
    if (daysRemaining === 1) {
      return '1 day left'
    } else if (daysRemaining < 7) {
      return `${daysRemaining} days left`
    } else if (daysRemaining < 30) {
      const weeksRemaining = Math.ceil(daysRemaining / 7)
      return weeksRemaining === 1 ? '1 week left' : `${weeksRemaining} weeks left`
    } else if (daysRemaining < 365) {
      const monthsRemaining = Math.ceil(daysRemaining / 30)
      return monthsRemaining === 1 ? '1 month left' : `${monthsRemaining} months left`
    } else {
      const yearsRemaining = Math.ceil(daysRemaining / 365)
      return yearsRemaining === 1 ? '1 year left' : `${yearsRemaining} years left`
    }
  }

  // Check if instruction is generic and should be hidden
  const isGenericInstruction = (instruction) => {
    if (!instruction) return false
    
    const genericInstructions = [
      'take with or without food',
      'take as directed',
      'take as prescribed',
      'take as needed',
      'take with water',
      'take orally',
      'take by mouth',
      'follow doctor\'s instructions',
      'follow physician\'s instructions',
      'as directed by doctor',
      'as prescribed by doctor'
    ]
    
    const lowerInstruction = instruction.toLowerCase().trim()
    return genericInstructions.some(generic => lowerInstruction.includes(generic))
  }
  
  onMount(() => {
    if (selectedPatient) {
      loadPatientData()
    }
    loadDeleteCode()
  })

  const loadDeleteCode = async () => {
    try {
      const doctor = await getEffectiveDoctorProfile()
      if (!doctor) return
      deleteCode = doctor?.deleteCode || ''
    } catch (error) {
      console.error('❌ Error loading delete code:', error)
      deleteCode = ''
    }
  }

  $: if (settingsDoctor?.id || currentUser?.email) {
    loadDeleteCode()
  }
</script>

{#if loading}
  <LoadingSpinner 
    size="large" 
    color="teal" 
    text="Loading patient details..." 
    fullScreen={false}
  />
{:else}
<div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm mx-2 sm:mx-0">
  <div class="bg-teal-600 text-white px-3 sm:px-6 py-3 sm:py-4 rounded-t-lg">
    <!-- Mobile: Stacked layout -->
    <div class="block sm:hidden">
      <div class="flex items-center space-x-2 sm:space-x-3 mb-3">
        <div class="flex-shrink-0">
          <div class="w-8 h-8 sm:w-10 sm:h-10 bg-teal-500 rounded-full flex items-center justify-center">
            <i class="fas fa-user text-white text-xs sm:text-sm"></i>
          </div>
        </div>
        <div class="flex-1 min-w-0">
          {#if selectedPatient.firstName || selectedPatient.lastName}
            <h5 class="text-sm sm:text-base md:text-lg font-bold text-white mb-1 truncate">
              {selectedPatient.firstName} {selectedPatient.lastName}
            </h5>
          {/if}
          <div class="flex items-center text-teal-100 text-xs">
            <i class="fas fa-calendar-alt mr-1"></i>
            <span class="truncate">Age: {(() => {
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
            })()}</span>
          </div>
        </div>
      </div>
      <div class="flex space-x-2" role="group">
        <button 
          class="flex-1 inline-flex items-center justify-center px-2 sm:px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-teal-300 focus:ring-offset-2 {activeTab === 'history' ? 'bg-teal-600 text-white shadow-lg hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-700 dark:focus:ring-teal-800' : 'bg-white text-teal-700 hover:bg-teal-50 border border-teal-200 dark:bg-white dark:text-teal-700 dark:border-teal-300 dark:hover:bg-teal-50'}"
          on:click={() => handleTabChange('history')}
          role="tab"
          title="View patient history"
        >
          <i class="fas fa-history mr-1 text-xs"></i>
          <span class="hidden xs:inline">History</span>
          <span class="xs:hidden">Hist</span>
        </button>
        <button 
          class="flex-1 inline-flex items-center justify-center px-2 sm:px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-teal-300 focus:ring-offset-2 bg-white text-teal-700 hover:bg-teal-50 border border-teal-200 dark:bg-white dark:text-teal-700 dark:border-teal-300 dark:hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed" 
          on:click={startEditingPatient}
          disabled={loading || isEditingPatient}
          title="Edit patient information"
        >
          <i class="fas fa-edit mr-1 text-xs"></i>
          <span class="hidden xs:inline">Edit</span>
          <span class="xs:hidden">Edit</span>
        </button>
      </div>
    </div>
    
    <!-- Desktop: Horizontal layout -->
    <div class="hidden sm:block">
      <div class="flex justify-between items-center">
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0">
            <div class="w-10 h-10 sm:w-12 sm:h-12 bg-teal-500 rounded-full flex items-center justify-center">
              <i class="fas fa-user text-white text-sm sm:text-base md:text-lg"></i>
            </div>
          </div>
      <div>
            {#if selectedPatient.firstName || selectedPatient.lastName}
              <h5 class="text-base sm:text-lg md:text-xl font-bold text-white mb-1">
        {selectedPatient.firstName} {selectedPatient.lastName}
      </h5>
            {/if}
            <div class="flex items-center text-teal-100 text-xs sm:text-sm md:text-base">
              <i class="fas fa-calendar-alt mr-2"></i>
              <span>Age: {(() => {
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
              })()}</span>
      </div>
          </div>
        </div>
        <div class="flex space-x-2 sm:space-x-3" role="group">
        <button 
            class="inline-flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-teal-300 focus:ring-offset-2 {activeTab === 'history' ? 'bg-teal-600 text-white shadow-lg hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-700 dark:focus:ring-teal-800' : 'bg-white text-teal-700 hover:bg-teal-50 border border-teal-200 dark:bg-white dark:text-teal-700 dark:border-teal-300 dark:hover:bg-teal-50'}"
          on:click={() => handleTabChange('history')}
          role="tab"
          title="View patient history"
        >
            <i class="fas fa-history mr-1 sm:mr-2 text-xs sm:text-sm"></i><span class="hidden md:inline">History</span><span class="md:hidden">Hist</span>
        </button>
        <button 
            class="inline-flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-teal-300 focus:ring-offset-2 bg-white text-teal-700 hover:bg-teal-50 border border-teal-200 dark:bg-white dark:text-teal-700 dark:border-teal-300 dark:hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed" 
          on:click={startEditingPatient}
          disabled={loading || isEditingPatient}
          title="Edit patient information"
        >
            <i class="fas fa-edit mr-1 text-xs sm:text-sm"></i><span class="hidden md:inline">Edit</span><span class="md:hidden">Edit</span>
        </button>
        </div>
      </div>
    </div>
  </div>
  
  <div class="p-3 sm:p-4">
    <!-- Responsive Progress Bar -->
    <div class="mb-3 sm:mb-4 md:mb-6">
      <!-- Mobile: Horizontal scrollable tabs -->
      <div class="block sm:hidden">
        <div class="flex overflow-x-auto pb-2 space-x-2">
          <button 
            class="flex-shrink-0 flex flex-col items-center px-1 sm:px-2 py-2 rounded-lg transition-all duration-200 w-16 sm:w-20 {activeTab === 'overview' ? 'bg-teal-600 text-white' : enabledTabs.includes('overview') ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-gray-300 text-gray-500'}"
            on:click={() => enabledTabs.includes('overview') && handleTabChange('overview')}
            disabled={!enabledTabs.includes('overview')}
            title={enabledTabs.includes('overview') ? 'View patient overview' : 'Complete previous steps to unlock'}
          >
            <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold mb-1 {activeTab === 'overview' ? 'bg-teal-600' : enabledTabs.includes('overview') ? 'bg-indigo-500' : 'bg-gray-300'}">
              <i class="fas fa-user text-xs sm:text-sm"></i>
            </div>
            <div class="text-xs sm:text-sm font-medium text-center leading-tight">Overview</div>
          </button>
          
          <button 
            class="flex-shrink-0 flex flex-col items-center px-1 sm:px-2 py-2 rounded-lg transition-all duration-200 w-16 sm:w-20 {activeTab === 'symptoms' ? 'bg-teal-600 text-white' : enabledTabs.includes('symptoms') ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-300 text-gray-500'}"
            on:click={() => enabledTabs.includes('symptoms') && handleTabChange('symptoms')}
            disabled={!enabledTabs.includes('symptoms')}
            title={enabledTabs.includes('symptoms') ? 'Document patient symptoms' : 'Complete previous steps to unlock'}
          >
            <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold mb-1 {activeTab === 'symptoms' ? 'bg-teal-600' : enabledTabs.includes('symptoms') ? 'bg-orange-500' : 'bg-gray-300'}">
              <i class="fas fa-thermometer-half text-xs sm:text-sm"></i>
            </div>
            <div class="text-xs sm:text-sm font-medium text-center leading-tight">Symptoms</div>
          </button>
          
          <button 
            class="flex-shrink-0 flex flex-col items-center px-1 sm:px-2 py-2 rounded-lg transition-all duration-200 w-16 sm:w-20 {activeTab === 'reports' ? 'bg-teal-600 text-white' : enabledTabs.includes('reports') ? 'bg-purple-500 text-white hover:bg-purple-600' : 'bg-gray-300 text-gray-500'}"
            on:click={() => enabledTabs.includes('reports') && handleTabChange('reports')}
            disabled={!enabledTabs.includes('reports')}
            title={enabledTabs.includes('reports') ? 'View medical reports' : 'Complete previous steps to unlock'}
          >
            <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold mb-1 {activeTab === 'reports' ? 'bg-teal-600' : enabledTabs.includes('reports') ? 'bg-purple-500' : 'bg-gray-300'}">
              <i class="fas fa-file-medical text-xs sm:text-sm"></i>
            </div>
            <div class="text-xs sm:text-sm font-medium text-center leading-tight">Reports</div>
          </button>
          
          <button 
            class="flex-shrink-0 flex flex-col items-center px-1 sm:px-2 py-2 rounded-lg transition-all duration-200 w-16 sm:w-20 {activeTab === 'diagnoses' ? 'bg-teal-600 text-white' : enabledTabs.includes('diagnoses') ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-gray-300 text-gray-500'}"
            on:click={() => enabledTabs.includes('diagnoses') && handleTabChange('diagnoses')}
            disabled={!enabledTabs.includes('diagnoses')}
            title={enabledTabs.includes('diagnoses') ? 'View diagnoses' : 'Complete previous steps to unlock'}
          >
            <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold mb-1 {activeTab === 'diagnoses' ? 'bg-teal-600' : enabledTabs.includes('diagnoses') ? 'bg-emerald-500' : 'bg-gray-300'}">
              <i class="fas fa-stethoscope text-xs sm:text-sm"></i>
            </div>
            <div class="text-xs sm:text-sm font-medium text-center leading-tight">Diagnoses</div>
          </button>
          
          <button 
            class="flex-shrink-0 flex flex-col items-center px-1 sm:px-2 py-2 rounded-lg transition-all duration-200 w-16 sm:w-20 {activeTab === 'prescriptions' ? 'bg-teal-600 text-white' : enabledTabs.includes('prescriptions') ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-gray-300 text-gray-500'}"
            on:click={() => enabledTabs.includes('prescriptions') && handleTabChange('prescriptions')}
            disabled={!enabledTabs.includes('prescriptions')}
            title={enabledTabs.includes('prescriptions') ? 'View prescriptions' : 'Complete previous steps to unlock'}
          >
            <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold mb-1 {activeTab === 'prescriptions' ? 'bg-teal-600' : enabledTabs.includes('prescriptions') ? 'bg-rose-500' : 'bg-gray-300'}">
              <i class="fas fa-pills text-xs sm:text-sm"></i>
            </div>
            <div class="text-xs sm:text-sm font-medium text-center leading-tight break-words">Prescriptions</div>
          </button>
        </div>
      </div>
      
      <!-- Desktop: Full progress bar with connectors -->
      <div class="hidden sm:block">
        <div class="flex justify-between items-center">
          <div class="flex items-center cursor-pointer {enabledTabs.includes('overview') ? 'cursor-pointer' : 'cursor-not-allowed'}" 
             on:click={() => enabledTabs.includes('overview') && handleTabChange('overview')}>
            <div class="flex flex-col items-center">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-semibold transition-all duration-200 {activeTab === 'overview' ? 'bg-teal-600 shadow-lg' : enabledTabs.includes('overview') ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-gray-300'}">
                <i class="fas fa-user text-sm sm:text-base md:text-lg"></i>
          </div>
              <div class="text-xs sm:text-sm md:text-base font-medium mt-2 {activeTab === 'overview' ? 'text-teal-600' : enabledTabs.includes('overview') ? 'text-gray-700' : 'text-gray-400'}">Overview</div>
            </div>
        </div>
        
          <div class="flex-1 h-0.5 mx-2 sm:mx-4 {enabledTabs.includes('symptoms') ? 'bg-orange-500' : 'bg-gray-300'}"></div>
        
          <div class="flex items-center cursor-pointer {enabledTabs.includes('symptoms') ? 'cursor-pointer' : 'cursor-not-allowed'}" 
             on:click={() => enabledTabs.includes('symptoms') && handleTabChange('symptoms')}>
            <div class="flex flex-col items-center">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-semibold transition-all duration-200 {activeTab === 'symptoms' ? 'bg-teal-600 shadow-lg' : enabledTabs.includes('symptoms') ? 'bg-orange-500 hover:bg-orange-600' : 'bg-gray-300'}">
                <i class="fas fa-thermometer-half text-sm sm:text-base md:text-lg"></i>
          </div>
              <div class="text-xs sm:text-sm md:text-base font-medium mt-2 {activeTab === 'symptoms' ? 'text-teal-600' : enabledTabs.includes('symptoms') ? 'text-gray-700' : 'text-gray-400'}">Symptoms</div>
            </div>
        </div>
        
          <div class="flex-1 h-0.5 mx-2 sm:mx-4 {enabledTabs.includes('reports') ? 'bg-purple-500' : 'bg-gray-300'}"></div>
        
          <div class="flex items-center cursor-pointer {enabledTabs.includes('reports') ? 'cursor-pointer' : 'cursor-not-allowed'}" 
             on:click={() => enabledTabs.includes('reports') && handleTabChange('reports')}>
            <div class="flex flex-col items-center">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-semibold transition-all duration-200 {activeTab === 'reports' ? 'bg-teal-600 shadow-lg' : enabledTabs.includes('reports') ? 'bg-purple-500 hover:bg-purple-600' : 'bg-gray-300'}">
                <i class="fas fa-file-medical text-sm sm:text-base md:text-lg"></i>
          </div>
              <div class="text-xs sm:text-sm md:text-base font-medium mt-2 {activeTab === 'reports' ? 'text-teal-600' : enabledTabs.includes('reports') ? 'text-gray-700' : 'text-gray-400'}">Reports</div>
            </div>
        </div>
        
          <div class="flex-1 h-0.5 mx-2 sm:mx-4 {enabledTabs.includes('diagnoses') ? 'bg-emerald-500' : 'bg-gray-300'}"></div>
        
          <div class="flex items-center cursor-pointer {enabledTabs.includes('diagnoses') ? 'cursor-pointer' : 'cursor-not-allowed'}" 
             on:click={() => enabledTabs.includes('diagnoses') && handleTabChange('diagnoses')}>
            <div class="flex flex-col items-center">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-semibold transition-all duration-200 {activeTab === 'diagnoses' ? 'bg-teal-600 shadow-lg' : enabledTabs.includes('diagnoses') ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-gray-300'}">
                <i class="fas fa-stethoscope text-sm sm:text-base md:text-lg"></i>
          </div>
              <div class="text-xs sm:text-sm md:text-base font-medium mt-2 {activeTab === 'diagnoses' ? 'text-teal-600' : enabledTabs.includes('diagnoses') ? 'text-gray-700' : 'text-gray-400'}">Diagnoses</div>
            </div>
        </div>
        
          <div class="flex-1 h-0.5 mx-2 sm:mx-4 {enabledTabs.includes('prescriptions') ? 'bg-rose-500' : 'bg-gray-300'}"></div>
        
          <div class="flex items-center cursor-pointer {enabledTabs.includes('prescriptions') ? 'cursor-pointer' : 'cursor-not-allowed'}" 
             on:click={() => enabledTabs.includes('prescriptions') && handleTabChange('prescriptions')}>
            <div class="flex flex-col items-center">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-semibold transition-all duration-200 {activeTab === 'prescriptions' ? 'bg-teal-600 shadow-lg' : enabledTabs.includes('prescriptions') ? 'bg-rose-500 hover:bg-rose-600' : 'bg-gray-300'}">
                <i class="fas fa-pills text-sm sm:text-base md:text-lg"></i>
          </div>
              <div class="text-xs sm:text-sm md:text-base font-medium mt-2 {activeTab === 'prescriptions' ? 'text-teal-600' : enabledTabs.includes('prescriptions') ? 'text-gray-700' : 'text-gray-400'}">Prescriptions</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Tab Content -->
    <div class="mt-3 sm:mt-4">
      <!-- Overview Tab -->
      {#if activeTab === 'overview'}
        <div>
          <div class="bg-white border border-gray-200 rounded-lg shadow-sm mb-3 sm:mb-4">
            <div class="bg-gray-50 px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-200">
              <h6 class="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-0">
                <i class="fas fa-info-circle mr-1 sm:mr-2 text-teal-600"></i>Patient Information
              </h6>
            </div>
            <div class="p-3 sm:p-4">
              {#if isEditingPatient}
                <!-- Edit Patient Form -->
                <form on:submit|preventDefault={savePatientChanges}>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <div class="mb-3 sm:mb-4">
                        <label for="editFirstName" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          <i class="fas fa-user mr-1"></i>First Name <span class="text-red-500">*</span>
                        </label>
                        <input 
                          type="text" 
                          class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
                          id="editFirstName" 
                          bind:value={editPatientData.firstName}
                          required
                          disabled={savingPatient}
                        >
                      </div>
                    </div>
                    <div>
                      <div class="mb-3 sm:mb-4">
                        <label for="editLastName" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Last Name</label>
                        <input 
                          type="text" 
                          class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
                          id="editLastName" 
                          bind:value={editPatientData.lastName}
                          disabled={savingPatient}
                        >
                      </div>
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <div class="mb-3 sm:mb-4">
                        <label for="editEmail" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          <i class="fas fa-envelope mr-1"></i>Email Address
                        </label>
                        <input 
                          type="email" 
                          class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
                          id="editEmail" 
                          bind:value={editPatientData.email}
                          disabled={savingPatient}
                        >
                      </div>
                    </div>
                    <div>
                      <div class="mb-3 sm:mb-4">
                        <label for="editPhone" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <div class="grid grid-cols-3 gap-2">
                          <select
                            class="col-span-1 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            bind:value={editPatientData.phoneCountryCode}
                            disabled={savingPatient}
                          >
                            <option value="">Code</option>
                            {#each phoneCountryCodes as entry}
                              <option value={entry.dialCode}>{entry.name} ({entry.dialCode})</option>
                            {/each}
                          </select>
                          <input 
                            type="tel" 
                            class="col-span-2 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
                            id="editPhone" 
                            bind:value={editPatientData.phone}
                            disabled={savingPatient}
                          >
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div class="mb-4">
                        <label for="editGender" class="block text-sm font-medium text-gray-700 mb-1">
                          <i class="fas fa-venus-mars mr-1"></i>Gender
                        </label>
                        <select 
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
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
                  
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div class="mb-4">
                        <label for="editDateOfBirth" class="block text-sm font-medium text-gray-700 mb-1">
                          <i class="fas fa-calendar mr-1"></i>Date of Birth
                        </label>
                        <input 
                          type="date" 
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
                          id="editDateOfBirth" 
                          bind:value={editPatientData.dateOfBirth}
                          on:change={handleEditDateOfBirthChange}
                          disabled={savingPatient}
                        >
                      </div>
                    </div>
                    <div>
                      <div class="mb-4">
                        <label for="editAge" class="block text-sm font-medium text-gray-700 mb-1">
                          <i class="fas fa-birthday-cake mr-1"></i>Age <span class="text-red-500">*</span>
                        </label>
                        <input 
                          type="number" 
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
                          id="editAge" 
                          bind:value={editPatientData.age}
                          min="0"
                          max="150"
                          placeholder="Auto-calculated"
                          disabled={savingPatient}
                        >
                        <small class="text-gray-500 text-xs mt-1">Auto-calculated</small>
                      </div>
                    </div>
                    <div>
                      <div class="mb-4">
                        <label for="editWeight" class="block text-sm font-medium text-gray-700 mb-1">
                          <i class="fas fa-weight mr-1"></i>Weight
                        </label>
                        <input 
                          type="number" 
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
                          id="editWeight" 
                          bind:value={editPatientData.weight}
                          min="0"
                          max="500"
                          step="0.1"
                          placeholder="kg"
                          disabled={savingPatient}
                        >
                        <small class="text-sm text-gray-500">Weight in kilograms</small>
                      </div>
                    </div>
                    <div class="col-span-full md:col-span-3">
                      <div class="mb-3">
                        <label for="editBloodGroup" class="block text-sm font-medium text-gray-700 mb-1">
                          <i class="fas fa-tint me-1"></i>Blood Group
                        </label>
                        <select 
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
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
                        <small class="text-sm text-gray-500">Important for medical procedures</small>
                      </div>
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="col-span-full md:col-span-6">
                      <div class="mb-3">
                        <label for="editIdNumber" class="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                        <input 
                          type="text" 
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                          id="editIdNumber" 
                          bind:value={editPatientData.idNumber}
                          disabled={savingPatient}
                        >
                      </div>
                    </div>
                  </div>
                  
                  <div class="mb-3">
                    <label for="editAddress" class="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea 
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                      id="editAddress" 
                      rows="3" 
                      bind:value={editPatientData.address}
                      disabled={savingPatient}
                    ></textarea>
                  </div>
                  
                  <div class="mb-3">
                    <label for="editAllergies" class="block text-sm font-medium text-gray-700 mb-1">
                      <i class="fas fa-exclamation-triangle me-1"></i>Allergies
                    </label>
                    <textarea 
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                      id="editAllergies" 
                      rows="3" 
                      bind:value={editPatientData.allergies}
                      placeholder="List any known allergies (e.g., Penicillin, Shellfish, Latex, etc.)"
                      disabled={savingPatient}
                    ></textarea>
                    <small class="text-sm text-gray-500">Important: List all known allergies to medications, foods, or other substances</small>
                  </div>
                  
                  <div class="mb-3">
                    <label for="editLongTermMedications" class="block text-sm font-medium text-gray-700 mb-1">
                      <i class="fas fa-pills me-1"></i>Long Term Medications
                    </label>
                    <textarea 
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                      id="editLongTermMedications" 
                      rows="3" 
                      bind:value={editPatientData.longTermMedications}
                      placeholder="List current long-term medications (e.g., Lisinopril 10mg daily, Metformin 500mg twice daily, etc.)"
                      disabled={savingPatient}
                    ></textarea>
                    <small class="text-sm text-gray-500">List medications the patient is currently taking on a regular basis</small>
                  </div>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="col-span-full md:col-span-6">
                      <div class="mb-3">
                        <label for="editEmergencyContact" class="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                        <input 
                          type="text" 
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                          id="editEmergencyContact" 
                          bind:value={editPatientData.emergencyContact}
                          disabled={savingPatient}
                        >
                      </div>
                    </div>
                    <div class="col-span-full md:col-span-6">
                      <div class="mb-3">
                        <label for="editEmergencyPhone" class="block text-sm font-medium text-gray-700 mb-1">Emergency Phone</label>
                        <input 
                          type="tel" 
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                          id="editEmergencyPhone" 
                          bind:value={editPatientData.emergencyPhone}
                          disabled={savingPatient}
                        >
                      </div>
                    </div>
                  </div>
                  
                  {#if editError}
                    <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4" role="alert">
                      <i class="fas fa-exclamation-triangle mr-2 text-red-600"></i><span class="text-red-800">{editError}</span>
                    </div>
                  {/if}
                  
                  <div class="flex flex-col sm:flex-row gap-3">
                    <button 
                      type="submit" 
                      class="flex-1 inline-flex items-center justify-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200" 
                      disabled={savingPatient || deletingPatient}
                    >
                      {#if savingPatient}
                        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      {/if}
                      <i class="fas fa-save mr-1"></i>Save Changes
                    </button>
                    <button 
                      type="button" 
                      class="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors duration-200" 
                      on:click={cancelEditingPatient}
                      disabled={savingPatient || deletingPatient}
                    >
                      <i class="fas fa-times mr-1"></i>Cancel
              </button>
            </div>
                  <div class="mt-4 border-t border-gray-200 pt-4">
                    <p class="text-xs text-gray-500 mb-2">Danger zone</p>
                    <button
                      type="button"
                      class="w-full inline-flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors duration-200"
                      on:click={handleDeletePatient}
                      disabled={savingPatient || deletingPatient}
                    >
                      {#if deletingPatient}
                        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Deleting...
                      {:else}
                        <i class="fas fa-trash mr-1"></i>Delete Patient
                      {/if}
                    </button>
                  </div>
                </form>
              {:else}
                <!-- Display Patient Information -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  {#if selectedPatient.firstName || selectedPatient.lastName}
                    <p class="mb-2"><span class="font-semibold text-gray-900">Name:</span> <span class="text-gray-700">{selectedPatient.firstName} {selectedPatient.lastName}</span></p>
                  {/if}
                  {#if selectedPatient.email}
                    <p class="mb-2"><span class="font-semibold text-gray-900">Email:</span> <span class="text-gray-700">{selectedPatient.email}</span></p>
                  {/if}
                  {#if selectedPatient.phone || selectedPatient.phoneCountryCode}
                    <p class="mb-2"><span class="font-semibold text-gray-900">Phone:</span> <span class="text-gray-700">{formatPhoneDisplay(selectedPatient)}</span></p>
                  {/if}
                  {#if selectedPatient.gender}
                    <p class="mb-2"><span class="font-semibold text-gray-900">Gender:</span> <span class="text-gray-700">{selectedPatient.gender}</span></p>
                  {/if}
                  {#if selectedPatient.dateOfBirth}
                    <p class="mb-2"><span class="font-semibold text-gray-900">Date of Birth:</span> <span class="text-gray-700">{selectedPatient.dateOfBirth}</span></p>
                  {/if}
                  {#if selectedPatient.age || calculateAge(selectedPatient.dateOfBirth)}
                    <p class="mb-2"><span class="font-semibold text-gray-900">Age:</span> <span class="text-gray-700">{selectedPatient.age || calculateAge(selectedPatient.dateOfBirth)}</span></p>
                  {/if}
                  {#if selectedPatient.weight}
                    <p class="mb-2"><span class="font-semibold text-gray-900">Weight:</span> <span class="text-gray-700">{selectedPatient.weight} kg</span></p>
                  {/if}
                  {#if selectedPatient.bloodGroup}
                    <p class="mb-2"><span class="font-semibold text-gray-900">Blood Group:</span> <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">{selectedPatient.bloodGroup}</span></p>
                  {/if}
                </div>
                <div>
                  {#if selectedPatient.idNumber}
                    <p class="mb-2"><span class="font-semibold text-gray-900">ID Number:</span> <span class="text-gray-700">{selectedPatient.idNumber}</span></p>
                  {/if}
                  {#if selectedPatient.address}
                    <p class="mb-2"><span class="font-semibold text-gray-900">Address:</span> <span class="text-gray-700">{selectedPatient.address}</span></p>
                  {/if}
                  {#if selectedPatient.emergencyContact}
                    <p class="mb-2"><span class="font-semibold text-gray-900">Emergency Contact:</span> <span class="text-gray-700">{selectedPatient.emergencyContact}</span></p>
                  {/if}
                  {#if selectedPatient.emergencyPhone}
                    <p class="mb-2"><span class="font-semibold text-gray-900">Emergency Phone:</span> <span class="text-gray-700">{selectedPatient.emergencyPhone}</span></p>
                  {/if}
                </div>
              </div>
                
                {#if selectedPatient.allergies}
                  <div class="mt-4">
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <h6 class="text-sm font-semibold text-yellow-800 mb-2">
                        <i class="fas fa-exclamation-triangle mr-2"></i>Allergies
                        </h6>
                      <p class="text-sm text-yellow-700 mb-0">{selectedPatient.allergies}</p>
                    </div>
                  </div>
                {/if}

                <!-- Current Medications Card -->
                {#if getCurrentMedications().length > 0}
                  <div class="mt-4">
                    <div class="bg-green-50 border border-green-200 rounded-lg p-3">
                      <h6 class="text-sm font-semibold text-green-800 mb-2">
                        <i class="fas fa-pills mr-2"></i>Current Medications
                      </h6>
                      <div class="space-y-2">
                        {#each getCurrentMedications() as medication}
                          <div class="flex justify-between items-center bg-white rounded p-2 border border-green-100">
                            <div class="flex-1">
                              <div class="font-medium text-green-900 text-sm">{medication.name}</div>
                              <div class="text-xs text-green-700">
                                {medication.dosage}
                              </div>
                            </div>
                            <div class="text-xs text-green-600 ml-2 text-right">
                              {#if medication.duration}
                                <div class="font-medium text-green-800">
                                  {getRemainingDuration(medication)}
                                </div>
                              {/if}
                            </div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  </div>
                {/if}
                
                {#if selectedPatient.longTermMedications}
                  <div class="mt-4">
                    <div class="bg-blue-50 border border-teal-200 rounded-lg p-3">
                      <div class="flex justify-between items-start mb-2">
                        <h6 class="text-sm font-semibold text-teal-800 mb-0">
                          <i class="fas fa-pills mr-2"></i>Long Term Medications
                          </h6>
                          <button 
                          class="inline-flex items-center px-2 py-1 border border-blue-300 text-xs font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500 rounded transition-colors duration-200" 
                            on:click={() => editLongTermMedications = selectedPatient.longTermMedications}
                            title="Edit long-term medications"
                          >
                          <i class="fas fa-edit mr-1"></i>Edit
                          </button>
                        </div>
                      <p class="text-sm text-blue-700 mb-0">{selectedPatient.longTermMedications}</p>
                    </div>
                  </div>
                {:else}
                  <div class="mt-4">
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div class="flex justify-between items-start mb-2">
                        <h6 class="text-sm font-semibold text-gray-700 mb-0">
                          <i class="fas fa-pills mr-2"></i>Long Term Medications
                          </h6>
                          <button 
                          class="inline-flex items-center px-2 py-1 border border-blue-300 text-xs font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500 rounded transition-colors duration-200" 
                            on:click={() => editLongTermMedications = ''}
                            title="Add long-term medications"
                          >
                          <i class="fas fa-plus mr-1"></i>Add
                          </button>
                        </div>
                      <p class="text-sm text-gray-500 mb-0">No long-term medications recorded</p>
                    </div>
                  </div>
                {/if}
                
                <!-- Long-term medications edit form -->
                {#if editLongTermMedications !== null}
                  <div class="mt-4">
                    <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm">
                      <div class="bg-teal-600 text-white px-3 py-2 rounded-t-lg">
                        <h6 class="text-sm font-semibold text-white mb-0">
                          <i class="fas fa-pills mr-2"></i>
                            {selectedPatient.longTermMedications ? 'Edit Long Term Medications' : 'Add Long Term Medications'}
                          </h6>
                        </div>
                      <div class="p-3">
                          <div class="mb-3">
                          <label for="editLongTermMedicationsField" class="block text-sm font-medium text-gray-700 mb-1">
                              Long Term Medications
                            </label>
                            <textarea 
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500" 
                              id="editLongTermMedicationsField" 
                              rows="3" 
                              bind:value={editLongTermMedications}
                              placeholder="List current long-term medications (e.g., Lisinopril 10mg daily, Metformin 500mg twice daily, etc.)"
                            ></textarea>
                          <small class="text-gray-500 text-xs mt-1">List medications the patient is currently taking on a regular basis</small>
                          </div>
                          
                        <div class="flex flex-col sm:flex-row gap-2">
                            <button 
                              type="button" 
                            class="flex-1 inline-flex items-center justify-center px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200" 
                              on:click={handleSaveLongTermMedications}
                            >
                            <i class="fas fa-save mr-1"></i>Save
                            </button>
                            <button 
                              type="button" 
                            class="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200" 
                              on:click={handleCancelLongTermMedications}
                            >
                            <i class="fas fa-times mr-1"></i>Cancel
                            </button>
                        </div>
                      </div>
                    </div>
                  </div>
                {/if}

                <!-- AI Patient Management Summary -->
                <div class="mt-4">
                  <div class="bg-gradient-to-r from-teal-50 to-emerald-50 border-2 border-teal-200 rounded-lg shadow-sm">
                    <div class="bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-3 rounded-t-lg flex justify-between items-center">
                      <h6 class="text-base font-semibold text-white mb-0 flex items-center">
                        <i class="fas fa-robot mr-2"></i>
                        AI Patient Management Summary
                      </h6>
                      {#if !showPatientSummary}
                        <button
                          class="inline-flex items-center px-3 py-1.5 bg-white text-teal-600 hover:bg-teal-50 text-xs font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 transition-colors duration-200 shadow-sm"
                          on:click={generatePatientSummary}
                          disabled={loadingPatientSummary}
                          title="Generate AI-powered patient management summary"
                        >
                          {#if loadingPatientSummary}
                            <svg class="animate-spin h-4 w-4 mr-1.5 text-teal-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          {:else}
                            <i class="fas fa-sparkles mr-1.5"></i>
                            Generate Summary
                          {/if}
                        </button>
                      {:else}
                        <button
                          class="inline-flex items-center px-2 py-1 text-white hover:bg-teal-700 text-xs rounded transition-colors duration-200"
                          on:click={closePatientSummary}
                          title="Close summary"
                        >
                          <i class="fas fa-times"></i>
                        </button>
                      {/if}
                    </div>

                    <div class="p-4">
                      {#if loadingPatientSummary}
                        <div class="flex flex-col items-center justify-center py-8">
                          <svg class="animate-spin h-10 w-10 text-teal-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <p class="text-teal-700 font-medium">Analyzing patient data with AI...</p>
                          <p class="text-sm text-gray-600 mt-1">This may take a few moments</p>
                        </div>
                      {:else if showPatientSummary && patientSummary}
                        <div class="bg-white rounded-lg p-4 shadow-inner">
                          <div class="prose prose-sm max-w-none">
                            {@html patientSummary}
                          </div>
                          <div class="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500 flex items-center">
                            <i class="fas fa-info-circle mr-1.5"></i>
                            This summary is AI-generated and should be reviewed by the healthcare provider.
                          </div>
                        </div>
                      {:else}
                        <div class="text-center py-6">
                          <div class="inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-full mb-3">
                            <i class="fas fa-robot text-2xl text-teal-600"></i>
                          </div>
                          <p class="text-gray-700 mb-2 font-medium">Get AI-Powered Patient Insights</p>
                          <p class="text-sm text-gray-500 mb-4">Generate a comprehensive management summary including health concerns, treatment plans, and monitoring recommendations.</p>
                          <button
                            class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all duration-200 shadow-md hover:shadow-lg"
                            on:click={generatePatientSummary}
                            disabled={loadingPatientSummary}
                          >
                            <i class="fas fa-sparkles mr-2"></i>
                            Generate Patient Summary
                          </button>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>

                <!-- Next Button -->
                <div class="mt-4 text-center">
                    <button
                    class="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
                      on:click={goToNextTab}
                      title="Continue to Symptoms tab"
                    >
                    <i class="fas fa-arrow-right mr-2"></i>Next
                    </button>
                </div>
              {/if}
            </div>
          </div>
          
        </div>
      {/if}
      
      <!-- Symptoms Tab -->
      {#if activeTab === 'symptoms'}
        <div class="tab-pane active">
          <!-- Symptoms Section -->
          <div class="flex justify-between items-center mb-4">
            <h6 class="text-lg font-semibold text-gray-900 mb-0">
              <i class="fas fa-thermometer-half mr-2"></i>Symptoms
            </h6>
            <button 
              class="inline-flex items-center px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200" 
              on:click={() => showSymptomsForm = true}
            >
              <i class="fas fa-plus mr-1"></i>Add Symptoms
            </button>
          </div>
          
          <PatientForms 
            {showSymptomsForm}
            {selectedPatient}
            onSymptomsAdded={handleSymptomsAdded}
            onCancelSymptoms={handleCancelSymptoms}
          />
          
          {#if symptoms && symptoms.length > 0}
            <div class="space-y-3 mb-4">
              {#each paginatedSymptoms as symptom, index}
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <h6 class="text-sm font-semibold text-gray-900 mb-2">
                        <i class="fas fa-thermometer-half mr-2"></i>
                        {symptom.description || 'Unknown Symptom'}
                      </h6>
                      <div class="space-y-1 mb-3">
                        <p class="text-sm text-gray-700">
                          <span class="font-medium text-gray-900">Severity:</span> 
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {symptom.severity === 'mild' ? 'bg-green-100 text-teal-800' : symptom.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' : symptom.severity === 'severe' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'} capitalize">
                          {symptom.severity || 'Unknown'}
                        </span>
                      </p>
                        <p class="text-sm text-gray-700">
                          <span class="font-medium text-gray-900">Duration:</span> {symptom.duration || 'Not specified'}
                      </p>
                      {#if symptom.notes}
                          <p class="text-sm text-gray-700">
                            <span class="font-medium text-gray-900">Notes:</span> {symptom.notes}
                        </p>
                      {/if}
                      </div>
                      <div class="text-xs text-gray-500">
                        <i class="fas fa-calendar mr-1"></i>
                        Recorded: {symptom.createdAt ? new Date(symptom.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        }) : 'Unknown date'}
                      </div>
                    </div>
                    <button 
                      class="inline-flex items-center px-2 py-1 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200 ml-3" 
                      on:click={() => handleDeleteSymptom(symptom.id, index)}
                      title="Delete symptom"
                    >
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
            
            <!-- Pagination Controls for Symptoms -->
            {#if totalSymptomsPages > 1}
              <div class="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 rounded-lg">
                <div class="flex items-center text-sm text-gray-700">
                  <span>Showing {symptomsStartIndex + 1} to {Math.min(symptomsEndIndex, symptoms.length)} of {symptoms.length} symptoms</span>
                </div>
                
                <div class="flex items-center space-x-2">
                  <!-- Previous Button -->
                  <button 
                    class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    on:click={goToPreviousSymptomsPage}
                    disabled={currentSymptomsPage === 1}
                  >
                    <i class="fas fa-chevron-left mr-1"></i>
                    Previous
                  </button>
                  
                  <!-- Page Numbers -->
                  <div class="flex items-center space-x-1">
                    {#each Array.from({length: Math.min(5, totalSymptomsPages)}, (_, i) => {
                      const startPage = Math.max(1, currentSymptomsPage - 2)
                      const endPage = Math.min(totalSymptomsPages, startPage + 4)
                      const page = startPage + i
                      return page <= endPage ? page : null
                    }).filter(Boolean) as page}
                      <button 
                        class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg {currentSymptomsPage === page ? 'text-white bg-teal-600 border-teal-600' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
                        on:click={() => goToSymptomsPage(page)}
                      >
                        {page}
                      </button>
                    {/each}
                  </div>
                  
                  <!-- Next Button -->
                  <button 
                    class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    on:click={goToNextSymptomsPage}
                    disabled={currentSymptomsPage === totalSymptomsPages}
                  >
                    Next
                    <i class="fas fa-chevron-right ml-1"></i>
                  </button>
                </div>
              </div>
            {/if}
          {:else}
            <div class="text-center py-8 mb-4">
              <i class="fas fa-thermometer-half text-4xl text-gray-400 mb-3"></i>
              <p class="text-gray-500 mb-2">No symptoms recorded for this patient.</p>
              <p class="text-sm text-gray-400">Click the <span class="font-medium text-teal-600">"+ Add Symptoms"</span> button at the right side to add a symptom.</p>
            </div>
          {/if}

          
          <!-- Navigation Buttons -->
          <div class="mt-4 text-center">
              <button 
              class="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 mr-3"
                on:click={goToPreviousTab}
                title="Go back to Overview tab"
              >
              <i class="fas fa-arrow-left mr-2"></i>Back
              </button>
              <button 
              class="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
                on:click={goToNextTab}
                title="Continue to Reports tab"
              >
              <i class="fas fa-arrow-right mr-2"></i>Next
              </button>
          </div>
        </div>
      {/if}
      
      <!-- Illnesses Tab -->
      {#if activeTab === 'illnesses'}
        <div class="tab-pane active">
          <div class="flex justify-between items-center mb-3">
            <h6 class="mb-0">
              <i class="fas fa-heartbeat mr-2"></i>Illnesses
            </h6>
            <button 
              class="inline-flex items-center px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200" 
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
              {#each paginatedIllnesses as illness, index}
                <div class="list-group-item">
                  <div class="flex w-full justify-between items-start">
                    <div class="flex-1">
                      <h6 class="mb-1">
                        <i class="fas fa-heartbeat mr-2"></i>
                        {illness.name || 'Unknown Illness'}
                      </h6>
                      <p class="mb-1">
                        <strong>Status:</strong> 
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {illness.status === 'active' ? 'bg-red-100 text-red-800' : illness.status === 'chronic' ? 'bg-yellow-100 text-yellow-800' : illness.status === 'resolved' ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-800'} capitalize">
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
                      <small class="text-gray-600 dark:text-gray-300">
                        <i class="fas fa-calendar me-1"></i>
                        Recorded: {illness.createdAt ? new Date(illness.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        }) : 'Unknown date'}
                      </small>
                    </div>
                    <button 
                      class="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200" 
                      on:click={() => toggleExpanded('illnesses', index)}
                    >
                      <i class="fas fa-{expandedIllnesses[index] ? 'chevron-up' : 'chevron-down'}"></i>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
            
            <!-- Pagination Controls for Illnesses -->
            {#if totalIllnessesPages > 1}
              <div class="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 rounded-lg">
                <div class="flex items-center text-sm text-gray-700">
                  <span>Showing {illnessesStartIndex + 1} to {Math.min(illnessesEndIndex, illnesses.length)} of {illnesses.length} illnesses</span>
                </div>
                
                <div class="flex items-center space-x-2">
                  <!-- Previous Button -->
                  <button 
                    class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    on:click={goToPreviousIllnessesPage}
                    disabled={currentIllnessesPage === 1}
                  >
                    <i class="fas fa-chevron-left mr-1"></i>
                    Previous
                  </button>
                  
                  <!-- Page Numbers -->
                  <div class="flex items-center space-x-1">
                    {#each Array.from({length: Math.min(5, totalIllnessesPages)}, (_, i) => {
                      const startPage = Math.max(1, currentIllnessesPage - 2)
                      const endPage = Math.min(totalIllnessesPages, startPage + 4)
                      const page = startPage + i
                      return page <= endPage ? page : null
                    }).filter(Boolean) as page}
                      <button 
                        class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg {currentIllnessesPage === page ? 'text-white bg-teal-600 border-teal-600' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
                        on:click={() => goToIllnessesPage(page)}
                      >
                        {page}
                      </button>
                    {/each}
                  </div>
                  
                  <!-- Next Button -->
                  <button 
                    class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    on:click={goToNextIllnessesPage}
                    disabled={currentIllnessesPage === totalIllnessesPages}
                  >
                    Next
                    <i class="fas fa-chevron-right ml-1"></i>
                  </button>
                </div>
              </div>
            {/if}
          {:else}
            <div class="text-center p-4">
              <i class="fas fa-heartbeat fa-2x text-gray-400 mb-3"></i>
              <p class="text-gray-600 dark:text-gray-300">No illnesses recorded for this patient.</p>
        </div>
      {/if}
      
          <!-- Next Button -->
          <div class="flex justify-center mt-3">
            <div class="w-full text-center">
                <button 
                class="inline-flex items-center px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
                on:click={goToNextTab}
                title="Continue to Prescriptions tab"
              >
                <i class="fas fa-arrow-right mr-2"></i>Next
                </button>
              </div>
          </div>
        </div>
      {/if}
      
      <!-- Reports Tab -->
      {#if activeTab === 'reports'}
        <div class="tab-pane active">
          <div class="flex justify-between items-center mb-4">
            <h6 class="text-lg font-semibold text-gray-900 mb-0">
              <i class="fas fa-file-medical mr-2"></i>Medical Reports
            </h6>
              <button 
              class="inline-flex items-center px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200" 
              on:click={() => showReportForm = true}
            >
              <i class="fas fa-plus mr-1"></i>Add Report
              </button>
            </div>
          
          <!-- Add Report Form -->
          {#if showReportForm}
            <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm mb-4">
              <div class="bg-gray-100 px-4 py-3 border-b border-gray-200 rounded-t-lg">
                <h6 class="text-sm font-semibold text-gray-800 mb-0">
                  <i class="fas fa-plus mr-2 text-teal-600"></i>Add New Report
            </h6>
              </div>
              <div class="p-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Report Title</label>
                    <input 
                      type="text" 
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500" 
                      bind:value={reportTitle}
                      placeholder="e.g., Blood Test Results, X-Ray Report"
                    />
                    {#if reportError}
                      <div class="mt-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
                        {reportError}
                      </div>
                    {/if}
                </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Report Date</label>
                    <input 
                      type="date" 
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500" 
                      bind:value={reportDate}
                    />
              </div>
                </div>
                
                <div class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
                  <div class="flex rounded-lg border border-gray-200 bg-gray-100 p-1">
                    <input 
                      type="radio" 
                      class="sr-only" 
                      id="report-text" 
                      bind:group={reportType} 
                      value="text"
                    />
                    <label class="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 {reportType === 'text' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}" for="report-text" role="tab">
                      <i class="fas fa-keyboard mr-2"></i>Text Entry
                    </label>
                    
                    <input 
                      type="radio" 
                      class="sr-only" 
                      id="report-pdf" 
                      bind:group={reportType} 
                      value="pdf"
                    />
                    <label class="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 {reportType === 'pdf' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}" for="report-pdf" role="tab">
                      <i class="fas fa-file-pdf mr-2"></i>PDF Upload
                    </label>
                    
                    <input 
                      type="radio" 
                      class="sr-only" 
                      id="report-image" 
                      bind:group={reportType} 
                      value="image"
                    />
                    <label class="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 {reportType === 'image' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}" for="report-image" role="tab">
                      <i class="fas fa-image mr-2"></i>Image Upload
                    </label>
                  </div>
                </div>
                
                {#if reportType === 'text'}
                  <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Report Content</label>
                    <textarea 
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500" 
                      rows="6" 
                      bind:value={reportText}
                      placeholder="Enter the report details, findings, and observations..."
                    ></textarea>
                  </div>
                {:else}
                  <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      Upload {reportType === 'pdf' ? 'PDF' : 'Image'} File
                    </label>
                    <input 
                      type="file" 
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-blue-500" 
                      accept={reportType === 'pdf' ? '.pdf' : 'image/*'}
                      on:change={handleFileUpload}
                      multiple={false}
                    />
                    {#if reportFiles.length > 0}
                      <div class="mt-2">
                        <small class="text-gray-500 text-xs">
                          Selected: {reportFiles[0].name} ({(reportFiles[0].size / 1024 / 1024).toFixed(2)} MB)
                        </small>
                      </div>
                    {/if}
            </div>
          {/if}
          
                <div class="flex gap-3">
            <button 
                    class="flex-1 inline-flex items-center justify-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200" 
                    on:click={addReport}
                  >
                    <i class="fas fa-save mr-1"></i>Save Report
                  </button>
                  <button 
                    class="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200" 
                    on:click={() => {
                      showReportForm = false
                      reportTitle = ''
                      reportText = ''
                      reportFiles = []
                      reportType = 'text'
                      reportDate = new Date().toISOString().split('T')[0]
                      reportFilePreview = null
                      reportError = ''
                    }}
                  >
                    <i class="fas fa-times mr-1"></i>Cancel
            </button>
                </div>
              </div>
            </div>
          {/if}
          
          <!-- Reports List -->
          {#if reports.length > 0}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              {#each paginatedReports as report (report.id)}
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div class="flex justify-between items-center px-4 py-3 border-b border-gray-200">
                    <h6 class="text-sm font-semibold text-gray-900 mb-0">
                        {#if report.type === 'text'}
                        <i class="fas fa-keyboard text-teal-600 mr-2"></i>
                        {:else if report.type === 'pdf'}
                        <i class="fas fa-file-pdf text-red-600 mr-2"></i>
                        {:else}
                        <i class="fas fa-image text-teal-600 mr-2"></i>
                        {/if}
                        {report.title}
                      </h6>
              <button 
                      class="inline-flex items-center px-2 py-1 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
                        on:click={() => removeReport(report.id)}
                        title="Remove report"
                      >
                        <i class="fas fa-trash"></i>
              </button>
            </div>
                  <div class="p-4">
                    <p class="text-gray-500 text-xs mb-3">
                      <i class="fas fa-calendar mr-1"></i>
                        {new Date(report.date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </p>
                    {#if report.type === 'text'}
                      <div class="report-content">
                      <p class="text-sm text-gray-700 mb-0">{report.content}</p>
                      </div>
                    {:else if report.type === 'image' && (report.previewUrl || report.dataUrl)}
                      <div class="rounded-lg border border-gray-200 overflow-hidden">
                        <img src={report.previewUrl || report.dataUrl} alt="Report image" class="w-full h-auto" />
                      </div>
                      {#if report.analysisPending}
                        <p class="text-xs text-gray-500 mt-2">Analyzing image...</p>
                      {:else if report.analysisError}
                        <p class="text-xs text-red-600 mt-2">Analysis failed: {report.analysisError}</p>
                      {:else if report.analysis}
                        <div class="mt-2 text-xs text-gray-700">
                          <p class="font-medium text-gray-800 mb-1">AI prediction</p>
                          <p>{report.analysis}</p>
                          {#if report.analysisUnclear}
                            <p class="text-xs text-amber-600 mt-1">Image is not clear enough to diagnose.</p>
                          {/if}
                        </div>
                      {/if}
                    {:else}
                      <div class="wave-file-view">
                      <div class="wave-container flex items-end space-x-1 mb-3">
                        <div class="w-1 bg-blue-500 h-4 rounded"></div>
                          <div class="w-1 bg-blue-500 h-6 rounded"></div>
                          <div class="w-1 bg-blue-500 h-3 rounded"></div>
                          <div class="w-1 bg-blue-500 h-8 rounded"></div>
                          <div class="w-1 bg-blue-500 h-5 rounded"></div>
                          <div class="w-1 bg-blue-500 h-7 rounded"></div>
                          <div class="w-1 bg-blue-500 h-4 rounded"></div>
                          <div class="w-1 bg-blue-500 h-6 rounded"></div>
                          </div>
                        <div class="file-info text-center">
                          <i class="fas fa-file-upload text-teal-600 mb-2 text-lg"></i>
                          <p class="text-gray-500 text-xs mb-1">
                              {report.files.length} file(s) uploaded
                            </p>
                          <small class="text-gray-400 text-xs">
                              {report.files[0]?.name || 'File uploaded'}
                    </small>
                          </div>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
            
            <!-- Pagination Controls for Reports -->
            {#if totalReportsPages > 1}
              <div class="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 rounded-lg">
                <div class="flex items-center text-sm text-gray-700">
                  <span>Showing {reportsStartIndex + 1} to {Math.min(reportsEndIndex, reports.length)} of {reports.length} reports</span>
                </div>
                
                <div class="flex items-center space-x-2">
                  <!-- Previous Button -->
                  <button 
                    class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    on:click={goToPreviousReportsPage}
                    disabled={currentReportsPage === 1}
                  >
                    <i class="fas fa-chevron-left mr-1"></i>
                    Previous
                  </button>
                  
                  <!-- Page Numbers -->
                  <div class="flex items-center space-x-1">
                    {#each Array.from({length: Math.min(5, totalReportsPages)}, (_, i) => {
                      const startPage = Math.max(1, currentReportsPage - 2)
                      const endPage = Math.min(totalReportsPages, startPage + 4)
                      const page = startPage + i
                      return page <= endPage ? page : null
                    }).filter(Boolean) as page}
                      <button 
                        class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg {currentReportsPage === page ? 'text-white bg-teal-600 border-teal-600' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
                        on:click={() => goToReportsPage(page)}
                      >
                        {page}
                      </button>
                    {/each}
                  </div>
                  
                  <!-- Next Button -->
                  <button 
                    class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    on:click={goToNextReportsPage}
                    disabled={currentReportsPage === totalReportsPages}
                  >
                    Next
                    <i class="fas fa-chevron-right ml-1"></i>
                  </button>
                </div>
              </div>
            {/if}
          {:else}
            <div class="text-center py-8">
              <i class="fas fa-file-medical text-4xl text-gray-400 mb-3"></i>
              <p class="text-gray-500 mb-2">No medical reports available for this patient.</p>
              <p class="text-sm text-gray-400">Click the <span class="font-medium text-teal-600">"+ Add Report"</span> button to add lab results, imaging reports, and other medical documents.</p>
            </div>
          {/if}
          
          <!-- Navigation Buttons -->
          <div class="mt-4 text-center">
                      <button 
              class="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 mr-3"
                on:click={goToPreviousTab}
                title="Go back to Symptoms tab"
              >
              <i class="fas fa-arrow-left mr-2"></i>Back
                      </button>
                      <button 
              class="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
                on:click={goToNextTab}
                title="Continue to Diagnoses tab"
              >
              <i class="fas fa-arrow-right mr-2"></i>Next
                      </button>
          </div>
                    </div>
                  {/if}
      
      <!-- Diagnoses Tab -->
      {#if activeTab === 'diagnoses'}
        <div class="tab-pane active">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 sm:mb-4 gap-2 sm:gap-0">
            <h6 class="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-0">
              <i class="fas fa-stethoscope mr-1 sm:mr-2 text-sm sm:text-base md:text-lg"></i>Medical Diagnoses
            </h6>
            <button 
              class="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200" 
              on:click={() => showDiagnosticForm = true}
            >
              <i class="fas fa-plus mr-1 text-xs sm:text-sm"></i>
              <span class="hidden sm:inline">Add Diagnosis</span>
              <span class="sm:hidden">Add</span>
            </button>
                </div>
          
          <!-- Add Diagnosis Form -->
          {#if showDiagnosticForm}
            <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm mb-4">
              <div class="bg-gray-100 px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-200 rounded-t-lg">
                <h6 class="text-xs sm:text-sm font-semibold text-gray-800 mb-0">
                  <i class="fas fa-plus mr-1 sm:mr-2 text-teal-600"></i>Add New Diagnosis
                </h6>
              </div>
              <div class="p-3 sm:p-4">
                <!-- Responsive grid: single column on mobile, two columns on tablet+ -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div>
                    <label class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Diagnosis Title</label>
                    <input 
                      type="text" 
                      class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                      bind:value={diagnosticTitle}
                      placeholder="e.g., Hypertension, Diabetes Type 2"
                    />
                  </div>
                  <div>
                    <label class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Diagnosis Date</label>
                    <input 
                      type="date" 
                      class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                      bind:value={diagnosticDate}
                    />
                  </div>
            </div>
            
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div>
                    <label class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Diagnostic Code (Optional)</label>
                    <input 
                      type="text" 
                      class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                      bind:value={diagnosticCode}
                      placeholder="e.g., ICD-10: I10, E11.9"
                    />
                  </div>
                  <div>
                    <label class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Severity</label>
                    <select class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" bind:value={diagnosticSeverity}>
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </select>
                  </div>
                </div>
                
                <div class="mb-3 sm:mb-4">
                  <label class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Diagnosis Description</label>
              <textarea 
                    class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                    rows="3" 
                    bind:value={diagnosticDescription}
                    placeholder="Describe the diagnosis, symptoms, findings, and clinical assessment..."
              ></textarea>
            </div>
            
                <!-- Responsive button layout: stacked on mobile, side-by-side on tablet+ -->
                <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button 
                    class="flex-1 inline-flex items-center justify-center px-3 sm:px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200" 
                    on:click={addDiagnosis}
                    >
                    <i class="fas fa-save mr-1 text-xs sm:text-sm"></i>
                    <span class="hidden sm:inline">Save Diagnosis</span>
                    <span class="sm:hidden">Save</span>
                </button>
                    <button 
                    class="flex-1 inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-xs sm:text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200" 
                    on:click={() => {
                      showDiagnosticForm = false
                      diagnosticTitle = ''
                      diagnosticDescription = ''
                      diagnosticCode = ''
                      diagnosticSeverity = 'moderate'
                      diagnosticDate = new Date().toISOString().split('T')[0]
                    }}
                  >
                    <i class="fas fa-times mr-1 text-xs sm:text-sm"></i>
                    <span class="hidden sm:inline">Cancel</span>
                    <span class="sm:hidden">Cancel</span>
                    </button>
                </div>
              </div>
            </div>
          {/if}
          
          <!-- Diagnoses List -->
          {#if diagnoses.length > 0}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {#each paginatedDiagnoses as diagnosis (diagnosis.id)}
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div class="flex justify-between items-center px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-200">
                    <h6 class="text-xs sm:text-sm font-semibold text-gray-900 mb-0 truncate">
                      <i class="fas fa-stethoscope text-teal-600 mr-1 sm:mr-2 text-xs sm:text-sm"></i>
                      <span class="truncate">{diagnosis.title}</span>
                      </h6>
                    <button 
                      class="inline-flex items-center px-1.5 sm:px-2 py-1 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200 flex-shrink-0"
                        on:click={() => removeDiagnosis(diagnosis.id)}
                        title="Remove diagnosis"
                      >
                      <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
                  <div class="p-3 sm:p-4">
                    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 sm:mb-3 gap-1 sm:gap-0">
                      <div class="text-gray-500 text-xs">
                        <i class="fas fa-calendar mr-1"></i>
                            {new Date(diagnosis.date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
              </div>
                      <span class="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium {diagnosis.severity === 'mild' ? 'bg-green-100 text-teal-800' : diagnosis.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'} self-start sm:self-auto">
                            {diagnosis.severity.charAt(0).toUpperCase() + diagnosis.severity.slice(1)}
                          </span>
                      </div>
                      {#if diagnosis.code}
                      <p class="text-gray-500 text-xs mb-2 sm:mb-3 break-words">
                        <i class="fas fa-code mr-1"></i>
                        <span class="font-medium text-gray-900">Code:</span> {diagnosis.code}
                        </p>
            {/if}
                      <div class="diagnosis-description">
                      <p class="text-xs sm:text-sm text-gray-700 mb-0 break-words">{diagnosis.description}</p>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
            
            <!-- Pagination Controls for Diagnoses -->
            {#if totalDiagnosesPages > 1}
              <div class="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 rounded-lg">
                <div class="flex items-center text-sm text-gray-700">
                  <span>Showing {diagnosesStartIndex + 1} to {Math.min(diagnosesEndIndex, diagnoses.length)} of {diagnoses.length} diagnoses</span>
                </div>
                
                <div class="flex items-center space-x-2">
                  <!-- Previous Button -->
                  <button 
                    class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    on:click={goToPreviousDiagnosesPage}
                    disabled={currentDiagnosesPage === 1}
                  >
                    <i class="fas fa-chevron-left mr-1"></i>
                    Previous
                  </button>
                  
                  <!-- Page Numbers -->
                  <div class="flex items-center space-x-1">
                    {#each Array.from({length: Math.min(5, totalDiagnosesPages)}, (_, i) => {
                      const startPage = Math.max(1, currentDiagnosesPage - 2)
                      const endPage = Math.min(totalDiagnosesPages, startPage + 4)
                      const page = startPage + i
                      return page <= endPage ? page : null
                    }).filter(Boolean) as page}
                      <button 
                        class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg {currentDiagnosesPage === page ? 'text-white bg-teal-600 border-teal-600' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
                        on:click={() => goToDiagnosesPage(page)}
                      >
                        {page}
                      </button>
                    {/each}
                  </div>
                  
                  <!-- Next Button -->
                  <button 
                    class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    on:click={goToNextDiagnosesPage}
                    disabled={currentDiagnosesPage === totalDiagnosesPages}
                  >
                    Next
                    <i class="fas fa-chevron-right ml-1"></i>
                  </button>
                </div>
              </div>
            {/if}
          {:else if !isShowingAIDiagnostics}
            <div class="text-center py-6 sm:py-8">
              <i class="fas fa-stethoscope text-3xl sm:text-4xl text-gray-400 mb-2 sm:mb-3"></i>
              <p class="text-gray-500 text-sm sm:text-base mb-2">No diagnoses recorded for this patient.</p>
              <p class="text-sm text-gray-400">Click the <span class="font-medium text-teal-600">"+ Add Diagnosis"</span> button to record medical diagnoses, conditions, and assessments.</p>
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
            patientAllergies={selectedPatient?.allergies || null}
            {doctorId}
        patientData={{
          ...selectedPatient,
          currentActiveMedications: getCurrentMedications(),
          recentPrescriptions: getRecentPrescriptionsSummary(),
          recentReports: getRecentReportsSummary(),
          doctorCountry: effectiveDoctorSettings?.country || 'Not specified'
        }}
            bind:isShowingAIDiagnostics
            on:ai-usage-updated={(event) => {
              if (addToPrescription) {
                addToPrescription('ai-usage', event.detail)
              }
            }}
          />
          
          <!-- Navigation Buttons -->
          <div class="mt-8 text-center">
              <button 
              class="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 mr-3"
                on:click={goToPreviousTab}
                title="Go back to Reports tab"
              >
              <i class="fas fa-arrow-left mr-2"></i>Back
              </button>
              <button 
              class="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
                on:click={goToNextTab}
                title="Continue to Prescriptions tab"
              >
              <i class="fas fa-arrow-right mr-2"></i>Next
              </button>
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
          allowNonPharmacyDrugs={true}
          excludePharmacyDrugs={effectiveDoctorSettings?.templateSettings?.excludePharmacyDrugs ?? false}
          {currentMedications}
          {prescriptionsFinalized}
          {showAIDrugSuggestions}
          {aiDrugSuggestions}
          {currentPrescription}
          {loadingAIDrugSuggestions}
          {symptoms}
          {openaiService}
          bind:prescriptionNotes
          bind:prescriptionDiscount
          bind:prescriptionProcedures
          bind:otherProcedurePrice
          bind:excludeConsultationCharge
          currentUserEmail={effectiveDoctorSettings?.email}
          doctorProfileFallback={effectiveDoctorSettings}
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
          onGenerateAIAnalysis={performFullAIAnalysis}
          loadingAIAnalysis={loadingFullAnalysis}
          showAIAnalysis={showFullAnalysis}
          aiAnalysisHtml={fullAIAnalysis}
          aiAnalysisError={fullAnalysisError}
          onNewPrescription={async () => { 
            console.log('🆕 New Prescription button clicked - Creating NEW prescription');
            showMedicationForm = false; 
            editingMedication = null;
            
            // Reset AI check state for new prescription
            aiCheckComplete = false;
            aiCheckMessage = '';
            lastAnalyzedMedications = [];
            
            try {
              // NEW RULE: When clicking "+ New Prescription", don't show current prescription under prescriptions anymore
              // Remove current prescription from prescriptions array regardless of status
              if (currentPrescription && currentMedications && currentMedications.length > 0) {
                console.log('📋 Removing current prescription from prescriptions array (New Prescription clicked)');
                
                // Remove from prescriptions array - this will hide it from prescriptions tab
                prescriptions = prescriptions.filter(p => p.id !== currentPrescription.id);
                
                // If prescription was sent to pharmacy or printed, move it to history
                const isSentToPharmacy = currentPrescription.status === 'sent' || currentPrescription.sentToPharmacy || currentPrescription.printedAt;
                
                if (isSentToPharmacy) {
                  console.log('📋 Prescription was sent/printed - moving to history');
                  
                  // Update prescription with end date to mark it as historical
                  currentPrescription.endDate = new Date().toISOString().split('T')[0];
                  
                  // Save to Firebase
                  await firebaseStorage.updatePrescription(currentPrescription.id, {
                    endDate: new Date().toISOString().split('T')[0],
                    updatedAt: new Date().toISOString()
                  });
                  
                  console.log('✅ Current prescription moved to history');
                } else {
                  console.log('⚠️ Prescription not sent/printed - deleting from Firebase');
                  // Delete unsent/unprinted prescriptions from Firebase
                  try {
                    await firebaseStorage.deletePrescription(currentPrescription.id);
                    console.log('🗑️ Deleted unsent prescription from Firebase');
                  } catch (error) {
                    console.log('⚠️ Could not delete prescription from Firebase (may not exist):', error.message);
                  }
                }
              }
              
              // Clear any existing medications from Firebase for this patient
              if (currentPrescription) {
                console.log('🗑️ Clearing existing medications from Firebase for new prescription');
                try {
                  await firebaseStorage.clearPrescriptionMedications(currentPrescription.id);
                  console.log('✅ Cleared existing medications from Firebase');
                } catch (error) {
                  console.log('⚠️ Could not clear medications from Firebase:', error.message);
                }
              }
              
              // Create new prescription
              const newPrescription = await firebaseStorage.createPrescription({
                patientId: selectedPatient.id,
                doctorId: doctorId,
                patient: buildPatientSnapshot(),
                name: 'New Prescription',
                notes: 'Prescription created from Prescriptions tab',
                nextAppointmentDate: '',
                medications: [],
                procedures: [],
                otherProcedurePrice: '',
                excludeConsultationCharge: false,
                status: 'draft',
                createdAt: new Date().toISOString()
              })
              
              currentPrescription = newPrescription;
              currentMedications = [];
              prescriptionProcedures = [];
              otherProcedurePrice = '';
              excludeConsultationCharge = false;
              nextAppointmentDate = '';
              prescriptionFinished = false;
              prescriptionsFinalized = false;
              
              // Add the new prescription to the prescriptions array immediately
              prescriptions = [...prescriptions, currentPrescription];
              console.log('📋 Added new prescription to prescriptions array:', prescriptions.length);
              
              // Update prescriptions array to trigger reactivity
              prescriptions = [...prescriptions];
              
              console.log('✅ NEW prescription ready - click "Add Drug" to add medications');
            } catch (error) {
              console.error('❌ Error creating new prescription:', error);
            }
          }}
          onAddDrug={() => { 
            console.log('💊 Add Drug clicked');
            
            if (!currentPrescription) {
              return;
            }
            
            showMedicationForm = true;
            editingMedication = null;
          }}
          onPrintPrescriptions={printPrescriptions}
          onPrintExternalPrescriptions={printExternalPrescriptions}
          bind:prescriptionDiscountScope
          bind:nextAppointmentDate
          />
        </div>
      {/if}

      <!-- History Tab -->
      {#if activeTab === 'history'}
        <div class="tab-pane active">
          <div class="flex justify-between items-center mb-3">
            <h6 class="mb-0">
              <i class="fas fa-history mr-2"></i>Prescription History
            </h6>
          </div>
          
          <PrescriptionList
            {prescriptions}
            {selectedPatient}
            currency={effectiveDoctorSettings?.currency || 'USD'}
          />
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Confirmation Modal -->
<ConfirmationModal
  visible={showConfirmationModal}
  title={confirmationConfig.title}
  message={confirmationConfig.message}
  confirmText={confirmationConfig.confirmText}
  cancelText={confirmationConfig.cancelText}
  type={confirmationConfig.type}
  requireCode={confirmationConfig.requireCode}
  expectedCode={deleteCode}
  codeLabel="Delete Code"
  codePlaceholder="Enter 6-digit delete code"
  on:confirm={handleConfirmationConfirm}
  on:cancel={handleConfirmationCancel}
  on:close={handleConfirmationCancel}
/>
{/if}

<!-- Pharmacy Selection Modal -->
{#if showPharmacyModal}
  <div id="pharmacyModal" tabindex="-1" aria-hidden="true" class="fixed inset-0 z-50 w-full p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] max-h-full">
    <div class="relative w-full max-w-2xl max-h-full mx-auto">
      <div class="relative bg-white rounded-lg shadow dark:bg-gray-700">
        <div class="flex items-center justify-between p-5 border-b rounded-t dark:border-gray-600">
          <h3 class="text-xl font-medium text-gray-900 dark:text-white">
            <i class="fas fa-paper-plane mr-2"></i>
            Send to Pharmacy
          </h3>
          <button 
            type="button" 
            class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white" 
            data-modal-hide="pharmacyModal"
            on:click={() => showPharmacyModal = false}
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
            </svg>
            <span class="sr-only">Close modal</span>
          </button>
        </div>
        <div class="p-6">
          <p class="text-gray-600 dark:text-gray-300 mb-3">
            Select which pharmacies should receive this prescription:
          </p>
          
          <!-- Select All / Deselect All Buttons -->
          <div class="flex gap-2 mb-3">
            <button class="inline-flex items-center px-3 py-2 border border-teal-300 text-teal-700 bg-white hover:bg-teal-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-4 focus:ring-teal-300 focus:ring-offset-2 dark:bg-white dark:text-teal-700 dark:border-teal-300 dark:hover:bg-teal-50 transition-all duration-200" on:click={selectAllPharmacies}>
              <i class="fas fa-check-square me-1"></i>
              Select All
            </button>
            <button class="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-300 focus:ring-offset-2 dark:bg-white dark:text-gray-700 dark:border-gray-300 dark:hover:bg-gray-50 transition-all duration-200" on:click={deselectAllPharmacies}>
              <i class="fas fa-square me-1"></i>
              Deselect All
            </button>
          </div>
          
          <!-- Pharmacy List -->
          <div class="list-group">
            {#each availablePharmacies as pharmacy}
              <label class="list-group-item flex items-center">
                <input 
                  class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2 mr-3" 
                  type="checkbox" 
                  checked={selectedPharmacies.includes(pharmacy.id)}
                  on:change={() => togglePharmacySelection(pharmacy.id)}
                >
                <div class="flex-1">
                  <div class="font-semibold text-gray-900 dark:text-white">
                    <i class="fas fa-store mr-2 text-gray-700 dark:text-gray-300"></i>
                    {pharmacy.name}
                  </div>
                  <small class="text-gray-600 dark:text-gray-300">
                    <i class="fas fa-envelope me-1 text-gray-600 dark:text-gray-300"></i>
                    {pharmacy.email}
                  </small>
                  <br>
                  <small class="text-gray-600 dark:text-gray-300">
                    <i class="fas fa-map-marker-alt me-1 text-gray-600 dark:text-gray-300"></i>
                    {pharmacy.address}
                  </small>
                </div>
              </label>
            {/each}
          </div>
          
          {#if availablePharmacies.length === 0}
            <div class="text-center text-gray-600 dark:text-gray-300 py-4">
              <i class="fas fa-store fa-2x mb-2"></i>
              <p>No pharmacies available</p>
            </div>
          {/if}
        </div>
        <div class="flex items-center p-6 space-x-2 border-t border-gray-200 rounded-b dark:border-gray-600">
          <button 
            type="button" 
            class="text-gray-500 bg-white hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-200 rounded-lg border border-gray-200 text-sm font-medium px-5 py-2.5 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-gray-600"
            on:click={() => showPharmacyModal = false}
          >
            <i class="fas fa-times mr-2"></i>
            Cancel
          </button>
          <button 
            type="button" 
            class="text-white bg-yellow-700 hover:bg-yellow-800 focus:ring-4 focus:outline-none focus:ring-yellow-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-yellow-600 dark:hover:bg-yellow-700 dark:focus:ring-yellow-800" 
            on:click={sendToSelectedPharmacies}
            disabled={selectedPharmacies.length === 0}
          >
            <i class="fas fa-paper-plane mr-2"></i>
            Send to {selectedPharmacies.length} Pharmacy{selectedPharmacies.length !== 1 ? 'ies' : ''}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Prescription PDF Modal -->
{#if showPrescriptionPDF}
  <div id="prescriptionPDFModal" tabindex="-1" aria-hidden="true" class="fixed inset-0 z-50 w-full p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] max-h-full">
    <div class="relative w-full max-w-4xl max-h-full mx-auto">
      <div class="relative bg-white rounded-lg shadow dark:bg-gray-700">
        <div class="flex items-center justify-between p-5 border-b rounded-t dark:border-gray-600">
          <h3 class="text-xl font-medium text-gray-900 dark:text-white">
            <i class="fas fa-file-pdf mr-2"></i>Prescription PDF
          </h3>
          <button 
            type="button" 
            class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white" 
            data-modal-hide="prescriptionPDFModal"
            on:click={() => showPrescriptionPDF = false}
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
            </svg>
            <span class="sr-only">Close modal</span>
          </button>
        </div>
        <div class="p-6">
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

  /* Custom styles for patient details */
</style>
