<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import firebaseStorage from '../services/firebaseStorage.js'
  import authService from '../services/authService.js'
  import PatientForm from './PatientForm.svelte'
  import PatientDetails from './PatientDetails.svelte'
  import PatientList from './PatientList.svelte'
  import MedicalSummary from './MedicalSummary.svelte'
  import PharmacistManagement from './PharmacistManagement.svelte'
  import ApexCharts from 'apexcharts'
  import { countries } from '../data/countries.js'
  import { cities, getCitiesByCountry } from '../data/cities.js'
  import LoadingSpinner from './LoadingSpinner.svelte'
  import ThreeDots from './ThreeDots.svelte'
  import ConfirmationModal from './ConfirmationModal.svelte'
  import prescriptionStatusService from '../services/doctor/prescriptionStatusService.js'
  
  const dispatch = createEventDispatcher()
  export let user
  export let currentView = 'patients' // Navigation from menubar: 'home', 'patients', 'prescriptions', 'pharmacies'
  export let openSettings = false // Trigger to open settings modal
  
  // Watch for openSettings trigger from menubar
  $: if (openSettings) {
    editingProfile = true
    editFirstName = user?.firstName || ''
    editLastName = user?.lastName || ''
    editCountry = user?.country || ''
    editCity = user?.city || ''
    profileError = ''
    setTimeout(() => dispatch('settings-opened'), 100)
  }
  
  // Reactive statement to ensure component updates when user changes
  $: userKey = user?.id || user?.email || 'default'
  $: userUpdated = user ? `${user.firstName}-${user.lastName}-${user.country}` : 'default'
  $: userProfileKey = user ? `${user.firstName || ''}-${user.lastName || ''}-${user.country || ''}-${user.email || ''}` : 'default'
  
  // Force component re-render when user profile data changes
  $: userProfileData = user ? {
    firstName: user.firstName,
    lastName: user.lastName,
    country: user.country,
    city: user.city,
    email: user.email
  } : {}
  
  // Reactive statement to log user changes for debugging
  $: if (user) {
    console.log('PatientManagement: User updated:', user)
    console.log('PatientManagement: User country:', user.country)
    console.log('PatientManagement: User name:', user.name)
    console.log('PatientManagement: User firstName:', user.firstName)
    console.log('PatientManagement: User lastName:', user.lastName)
    console.log('PatientManagement: User email:', user.email)
  }

  // Get doctor's data from storage - reactive to user changes
  let doctorData = null
  
  // Load doctor data when user changes
  $: if (user?.email) {
    loadDoctorData()
  }
  
  // Reactive doctorId that updates when doctorData changes
  $: doctorId = doctorData?.id || user?.uid || user?.id
  
  const loadDoctorData = async () => {
    try {
      doctorData = await firebaseStorage.getDoctorByEmail(user.email)
    } catch (error) {
      console.error('Error loading doctor data:', error)
      doctorData = null
    }
  }
  $: doctorName = userProfileData.firstName && userProfileData.lastName ? 
    `${userProfileData.firstName} ${userProfileData.lastName}` : 
    userProfileData.firstName || user?.displayName || user?.name || user?.email || 'Doctor'
  $: doctorCountry = userProfileData.country || 'Not specified'
  $: doctorCity = userProfileData.city || 'Not specified'
  
  // Force reactive updates when user properties change
  $: userDisplayName = userProfileData.firstName && userProfileData.lastName ? 
    `${userProfileData.firstName}-${userProfileData.lastName}-${userProfileData.country}` : 'default'
  
  // Debug reactive updates
  $: if (user) {
    console.log('PatientManagement: User changed - firstName:', user.firstName, 'lastName:', user.lastName, 'country:', user.country)
    console.log('PatientManagement: doctorName updated to:', doctorName)
    console.log('PatientManagement: doctorCountry updated to:', doctorCountry)
  }
  
  let patients = []
  let selectedPatient = null
  let showPatientForm = false
  let chartInstance = null
  let loading = true
  let chartLoading = false
  let searchQuery = ''
  let filteredPatients = []
  let showAllLastPrescriptionMeds = false // Track if last prescription medications are expanded
  
  // Medical data for selected patient
  let illnesses = []
  let prescriptions = []
  let symptoms = []
  
  // Dispensed status tracking
  let prescriptionDispensedStatus = {}
  let checkingDispensedStatus = false
  
  // Reactive prescription selection for Last Prescription card
  $: selectedPrescriptionForCard = (() => {
    console.log('🔄 Reactive statement triggered!')
    console.log('🔄 Prescriptions length:', prescriptions.length)
    console.log('🔄 Dispensed status keys:', Object.keys(prescriptionDispensedStatus).length)
    console.log('🔄 CheckingDispensedStatus:', checkingDispensedStatus)
    
    if (!prescriptions.length) {
      console.log('🔍 No prescriptions available yet')
      return null
    }
    
    if (!Object.keys(prescriptionDispensedStatus).length) {
      console.log('🔍 No dispensed status available yet')
      return null
    }
    
    console.log('🔍 Selecting prescription for Last Prescription card...')
    console.log('🔍 Prescriptions available:', prescriptions.length)
    console.log('🔍 Dispensed status loaded:', Object.keys(prescriptionDispensedStatus).length > 0)
    console.log('🔍 CheckingDispensedStatus:', checkingDispensedStatus)
    
    // First, try to find the most recent dispensed prescription
    const dispensedPrescriptions = prescriptions.filter(p => 
      p.medications && p.medications.length > 0 && 
      prescriptionDispensedStatus[p.id]?.isDispensed
    )
    
    console.log('🔍 Available prescriptions:', prescriptions.map(p => ({ 
      id: p.id, 
      hasMeds: p.medications?.length > 0, 
      isDispensed: prescriptionDispensedStatus[p.id]?.isDispensed,
      dispensedStatus: prescriptionDispensedStatus[p.id]
    })))
    console.log('🔍 Dispensed prescriptions found:', dispensedPrescriptions.length)
    
    if (dispensedPrescriptions.length > 0) {
      // Sort by creation date and return the most recent dispensed prescription
      const selected = dispensedPrescriptions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      console.log('✅ Selected dispensed prescription:', selected.id)
      return selected
    }
    
    // Fall back to the most recent prescription with medications
    const fallback = prescriptions.find(p => p.medications && p.medications.length > 0)
    console.log('✅ Fallback to prescription with medications:', fallback?.id)
    return fallback
  })()
  
  // Notes visibility state
  let showSymptomsNotes = false
  let showIllnessesNotes = false
  let showPrescriptionsNotes = false
  
  // Medical summary tab state
  let activeMedicalTab = 'prescriptions'
  
  // Prescription state
  let currentPrescription = []
  
  // Refresh trigger for right side updates
  let refreshTrigger = 0
  
  // Statistics variables
  let totalPrescriptions = 0
  let totalDrugs = 0
  let connectedPharmacies = 0
  let statisticsLoading = false
  
  // Confirmation modal state
  let showConfirmationModal = false
  let confirmationConfig = {
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'warning'
  }
  let pendingAction = null
  
  // Confirmation modal helper functions
  function showConfirmation(title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning') {
    confirmationConfig = { title, message, confirmText, cancelText, type }
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
  
  // Profile editing state removed - now using tabbed modal
  
  // Reactive variables removed - now using tabbed modal
  
  // Reactive statements to ensure component updates when data changes
  $: if (selectedPatient) {
    loadMedicalData(selectedPatient.id)
  }
  
  // Load statistics only when explicitly needed (removed reactive loop)
  
  $: if (symptoms) {
    symptoms = symptoms || []
  }
  
  $: if (illnesses) {
    illnesses = illnesses || []
  }
  
  $: if (prescriptions) {
    prescriptions = prescriptions || []
  }
  
  // Update chart when patients data changes
  $: if (patients.length > 0) {
    setTimeout(() => {
      createPrescriptionsChart()
    }, 100)
  }
  
  // Reactive tab counts
  $: symptomsCount = symptoms?.length || 0
  $: illnessesCount = illnesses?.length || 0
  $: prescriptionsCount = prescriptions?.length || 0
  
  // Load patients from storage
  const loadPatients = async () => {
    alert('🚀 loadPatients: Function called! User: ' + (user?.email || 'null'))
    console.log('🚀 loadPatients: Function called!')
    console.log('🚀 loadPatients: User object:', user)
    try {
      loading = true
      
      console.log('🔍 PatientManagement: Starting loadPatients')
      console.log('🔍 PatientManagement: User object:', user)
      console.log('🔍 PatientManagement: User.id:', user?.id)
      console.log('🔍 PatientManagement: User.uid:', user?.uid)
      console.log('🔍 PatientManagement: User.email:', user?.email)
      
      // Always get the doctor from Firebase to ensure we have the correct ID
      console.log('🔍 PatientManagement: Getting doctor from Firebase for email:', user.email)
      const doctor = await firebaseStorage.getDoctorByEmail(user.email)
      console.log('🔍 PatientManagement: Doctor from Firebase:', doctor)
      
      if (!doctor) {
        console.error('❌ PatientManagement: Doctor not found in Firebase for email:', user.email)
        throw new Error('Doctor not found in database')
      }
      
      const doctorId = doctor.id
      console.log('✅ PatientManagement: Using doctor ID:', doctorId)
      
      console.log('🔍 PatientManagement: Loading patients for doctor ID:', doctorId)
      patients = await firebaseStorage.getPatients(doctorId)
      filteredPatients = [...patients]
      console.log('✅ PatientManagement: Loaded patients:', patients.length)
      console.log('🔍 PatientManagement: Patients data:', patients)
      
      // Load statistics after patients are loaded
      await loadStatistics()
    } catch (error) {
      console.error('❌ PatientManagement: Error loading patients:', error)
      console.error('❌ PatientManagement: Error stack:', error.stack)
      patients = []
      filteredPatients = []
    } finally {
      loading = false
    }
  }
  
  // Load all statistics
  const loadStatistics = async () => {
    alert('🚀 loadStatistics: Function called! patients: ' + patients.length + ', doctorId: ' + doctorId)
    console.log('🚀 loadStatistics: Function called!')
    console.log('🚀 loadStatistics: statisticsLoading:', statisticsLoading)
    console.log('🚀 loadStatistics: patients.length:', patients.length)
    console.log('🚀 loadStatistics: doctorId:', doctorId)
    
    // Prevent multiple simultaneous calls
    if (statisticsLoading) {
      console.log('🔍 loadStatistics: Already loading, skipping...')
      return
    }
    
    statisticsLoading = true
    try {
      console.log('🔍 loadStatistics: Starting statistics calculation...')
      console.log('🔍 loadStatistics: About to call getTotalPrescriptions...')
      totalPrescriptions = await getTotalPrescriptions()
      console.log('🔍 loadStatistics: getTotalPrescriptions returned:', totalPrescriptions)
      
      console.log('🔍 loadStatistics: About to call getTotalDrugs...')
      totalDrugs = await getTotalDrugs()
      console.log('🔍 loadStatistics: getTotalDrugs returned:', totalDrugs)
      
      console.log('🔍 loadStatistics: About to call getConnectedPharmacies...')
      connectedPharmacies = await getConnectedPharmacies()
      console.log('🔍 loadStatistics: getConnectedPharmacies returned:', connectedPharmacies)
      
      console.log('🔍 loadStatistics: Statistics loaded successfully')
      console.log('🔍 loadStatistics: Final values - totalPrescriptions:', totalPrescriptions, 'totalDrugs:', totalDrugs, 'connectedPharmacies:', connectedPharmacies)
    } catch (error) {
      console.error('❌ Error loading statistics:', error)
      console.error('❌ Error stack:', error.stack)
      totalPrescriptions = 0
      totalDrugs = 0
      connectedPharmacies = 0
    } finally {
      statisticsLoading = false
    }
  }
  
  // Search patients
  const searchPatients = () => {
    if (!searchQuery.trim()) {
      filteredPatients = [...patients]
      return
    }
    
    const query = searchQuery.toLowerCase().trim()
    filteredPatients = patients.filter(patient => {
      const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase()
      return fullName.includes(query) || 
             patient.firstName.toLowerCase().includes(query) || 
             patient.lastName.toLowerCase().includes(query) || 
             patient.idNumber.toLowerCase().includes(query) || 
             patient.email.toLowerCase().includes(query) || 
             (patient.phone && patient.phone.toLowerCase().includes(query)) ||
             (patient.dateOfBirth && patient.dateOfBirth.includes(query))
    }).slice(0, 20) // Limit to 20 results for performance
  }
  
  // Reactive statement to trigger search when query changes
  $: if (searchQuery !== undefined) {
    searchPatients()
  }
  
  // Clear search
  const clearSearch = () => {
    searchQuery = ''
    filteredPatients = [...patients]
    // If a patient is selected and we're searching, deselect them
    if (selectedPatient) {
      selectedPatient = null
      illnesses = []
      prescriptions = []
      symptoms = []
    }
  }
  
  // Add patient
  const addPatient = async (event) => {
    const patientData = event.detail
    try {
      console.log('🔍 PatientManagement: Starting addPatient')
      console.log('🔍 PatientManagement: User object:', user)
      console.log('🔍 PatientManagement: Patient data:', patientData)
      
      if (!user) {
        console.error('❌ PatientManagement: No user found for adding patient')
        return
      }
      
      // Get the doctor from Firebase to ensure we have the correct ID
      console.log('🔍 PatientManagement: Getting doctor from Firebase for email:', user.email)
      let doctor = await firebaseStorage.getDoctorByEmail(user.email)
      console.log('🔍 PatientManagement: Doctor from Firebase:', doctor)
      
      // If doctor not found in Firebase, try to use the user object directly
      if (!doctor) {
        console.warn('⚠️ PatientManagement: Doctor not found in Firebase, using user object directly')
        if (!user || !user.id) {
          console.error('❌ PatientManagement: No user or user ID available')
          throw new Error('User not authenticated properly')
        }
        doctor = user
      }
      
      const doctorId = doctor.id
      console.log('✅ PatientManagement: Using doctor ID for patient creation:', doctorId)
      
      const patientToCreate = {
        ...patientData,
        doctorId: doctorId
      }
      console.log('🔍 PatientManagement: Patient data to create:', patientToCreate)
      
      const newPatient = await firebaseStorage.createPatient(patientToCreate)
      console.log('✅ PatientManagement: Patient created successfully:', newPatient)
      
      // Reload patients to ensure we get the latest data
      console.log('🔍 PatientManagement: Reloading patients after creation...')
      await loadPatients()
      
      showPatientForm = false
      console.log('✅ PatientManagement: Patient creation process completed')
    } catch (error) {
      console.error('❌ PatientManagement: Error adding patient:', error)
      console.error('❌ PatientManagement: Error stack:', error.stack)
    }
  }
  
  // Handle view patient request from PatientDetails
  const handleViewPatient = (event) => {
    const { patient } = event.detail
    console.log('👁️ View patient requested:', patient)
    console.log('👁️ Current view before:', currentView)
    console.log('👁️ Selected patient before:', selectedPatient)
    
    // Ensure patient is selected (refresh/reload the patient view)
    selectPatient(patient)
    
    // Navigate to prescriptions view (which shows sidebar with patient details and medical summary)
    // This ensures the sidebar layout is shown
    currentView = 'prescriptions'
    
    console.log('👁️ Current view after:', currentView)
    console.log('👁️ Selected patient after:', selectedPatient)
  }
  
  // Handle data updates from PatientDetails
  const handleDataUpdated = async (event) => {
    const { type, data } = event.detail
    console.log('🔄 Data updated in PatientDetails:', type, data)
    
    // Refresh medical data to update MedicalSummary
    if (selectedPatient) {
      await loadMedicalData(selectedPatient.id)
    }
    
    // If AI usage was updated, notify parent
    if (type === 'ai-usage') {
      dispatch('ai-usage-updated')
    }
  }
  
  // Statistics functions for dashboard
  const getTotalPrescriptions = async () => {
    let total = 0
    alert('🔍 getTotalPrescriptions: Starting! Patients: ' + patients.length + ', Doctor ID: ' + doctorId)
    console.log('🔍 getTotalPrescriptions: Patients count:', patients.length)
    console.log('🔍 getTotalPrescriptions: Doctor ID:', doctorId)
    
    // Only count prescriptions for the current doctor's patients
    for (const patient of patients) {
      const patientPrescriptions = await firebaseStorage.getPrescriptionsByPatientId(patient.id) || []
      console.log(`🔍 getTotalPrescriptions: Patient ${patient.firstName} has ${patientPrescriptions.length} prescriptions`)
      console.log(`🔍 getTotalPrescriptions: Prescription data:`, patientPrescriptions)
      
      // Filter prescriptions to only include those created by the current doctor
      const doctorPrescriptions = patientPrescriptions.filter(prescription => 
        prescription.doctorId === doctorId || prescription.createdBy === doctorId
      )
      console.log(`🔍 getTotalPrescriptions: Doctor-specific prescriptions for ${patient.firstName}:`, doctorPrescriptions.length)
      
      if (patientPrescriptions.length > 0) {
        alert(`🔍 Patient ${patient.firstName}: ${patientPrescriptions.length} total prescriptions, ${doctorPrescriptions.length} doctor-specific prescriptions`)
      }
      
      total += doctorPrescriptions.length
    }
    
    console.log('🔍 getTotalPrescriptions: Total prescriptions for current doctor:', total)
    alert('🔍 getTotalPrescriptions: Returning total: ' + total)
    return total
  }
  
  const getTotalDrugs = async () => {
    let total = 0
    console.log('🔍 getTotalDrugs: Patients count:', patients.length)
    console.log('🔍 getTotalDrugs: Doctor ID:', doctorId)
    
    // Only count medications from prescriptions created by the current doctor
    for (const patient of patients) {
      const patientPrescriptions = await firebaseStorage.getPrescriptionsByPatientId(patient.id) || []
      console.log(`🔍 getTotalDrugs: Patient ${patient.firstName} has ${patientPrescriptions.length} prescriptions`)
      
      // Filter prescriptions to only include those created by the current doctor
      const doctorPrescriptions = patientPrescriptions.filter(prescription => 
        prescription.doctorId === doctorId || prescription.createdBy === doctorId
      )
      console.log(`🔍 getTotalDrugs: Doctor-specific prescriptions for ${patient.firstName}:`, doctorPrescriptions.length)
      
      doctorPrescriptions.forEach(prescription => {
        console.log(`🔍 getTotalDrugs: Prescription structure:`, prescription)
        if (prescription.medications && Array.isArray(prescription.medications)) {
          console.log(`🔍 getTotalDrugs: Prescription has ${prescription.medications.length} medications`)
          total += prescription.medications.length
        } else {
          console.log(`🔍 getTotalDrugs: Prescription has no medications array, counting as 1`)
          total += 1 // Single medication prescription
        }
      })
    }
    
    console.log('🔍 getTotalDrugs: Total medications for current doctor:', total)
    return total
  }
  
  const getConnectedPharmacies = async () => {
    if (!user) return 0
    
    try {
      // Get doctor data to get the doctor's ID
      const doctor = await firebaseStorage.getDoctorByEmail(user.email)
      if (!doctor) return 0
      
      // Get all pharmacists and count those connected to this doctor (check both sides)
      const allPharmacists = await firebaseStorage.getAllPharmacists()
      const connectedCount = allPharmacists.filter(pharmacist => {
        // Check if pharmacist has this doctor in their connectedDoctors
        const pharmacistHasDoctor = pharmacist.connectedDoctors && pharmacist.connectedDoctors.includes(doctor.id)
        
        // Check if doctor has this pharmacist in their connectedPharmacists
        const doctorHasPharmacist = doctor.connectedPharmacists && doctor.connectedPharmacists.includes(pharmacist.id)
        
        // Connection exists if either side has the connection (for backward compatibility)
        return pharmacistHasDoctor || doctorHasPharmacist
      }).length
      
      console.log('🔍 Connected pharmacies count:', connectedCount)
      console.log('🔍 Doctor ID:', doctor.id)
      console.log('🔍 All pharmacists:', allPharmacists.map(p => ({ 
        name: p.businessName, 
        connectedDoctors: p.connectedDoctors 
      })))
      
      return connectedCount
    } catch (error) {
      console.error('Error getting connected pharmacies:', error)
      return 0
    }
  }

  
  // Create responsive prescriptions per day chart using ApexCharts with caching
  const createPrescriptionsChart = async () => {
    try {
      chartLoading = true
      
      // Destroy existing chart if it exists
      if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
      }
      
      // Check cache first
      const cacheKey = `prescriptions-chart-${user?.id}-${patients.length}`
      const cachedData = localStorage.getItem(cacheKey)
      const cacheTimestamp = localStorage.getItem(`${cacheKey}-timestamp`)
      const now = Date.now()
      const cacheExpiry = 5 * 60 * 1000 // 5 minutes cache
      
      let last30Days = []
      let prescriptionsPerDay = []
      
      // Use cached data if available and not expired
      if (cachedData && cacheTimestamp && (now - parseInt(cacheTimestamp)) < cacheExpiry) {
        console.log('Using cached chart data')
        const parsedData = JSON.parse(cachedData)
        last30Days = parsedData.last30Days
        prescriptionsPerDay = parsedData.prescriptionsPerDay
      } else {
        console.log('Loading fresh chart data')
        
        // Batch load all prescription data once
        const allPrescriptions = []
        for (const patient of patients) {
          try {
            const patientPrescriptions = await firebaseStorage.getMedicationsByPatientId(patient.id) || []
            allPrescriptions.push(...patientPrescriptions)
          } catch (error) {
            console.warn(`Failed to load prescriptions for patient ${patient.id}:`, error)
          }
        }
        
        // Generate date range
        const dateRange = []
        for (let i = 29; i >= 0; i--) {
          const date = new Date()
          date.setDate(date.getDate() - i)
          const year = date.getFullYear()
          const month = date.getMonth() + 1
          const day = date.getDate()
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          
          dateRange.push({
            dateStr,
            displayDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          })
        }
        
        // Count prescriptions per day using pre-loaded data
        last30Days = dateRange.map(d => d.displayDate)
        prescriptionsPerDay = dateRange.map(({ dateStr }) => {
          return allPrescriptions.filter(prescription => {
            const createdDate = new Date(prescription.createdAt || prescription.dateCreated)
            const prescriptionYear = createdDate.getFullYear()
            const prescriptionMonth = createdDate.getMonth() + 1
            const prescriptionDay = createdDate.getDate()
            const prescriptionDateStr = `${prescriptionYear}-${String(prescriptionMonth).padStart(2, '0')}-${String(prescriptionDay).padStart(2, '0')}`
            
            return prescriptionDateStr === dateStr
          }).length
        })
        
        // Cache the results
        const cacheData = { last30Days, prescriptionsPerDay }
        localStorage.setItem(cacheKey, JSON.stringify(cacheData))
        localStorage.setItem(`${cacheKey}-timestamp`, now.toString())
      }
      
      // Create ApexCharts chart with Flowbite styling
      setTimeout(() => {
        const chartElement = document.getElementById('prescriptionsChart')
        if (!chartElement) {
          console.log('Chart element not found, skipping chart creation')
          return
        }
        
        // Destroy existing chart if it exists
        if (chartInstance) {
          chartInstance.destroy()
          chartInstance = null
        }
        
        const options = {
          chart: {
          type: 'bar',
            height: 250,
            toolbar: {
              show: false
            },
            animations: {
              enabled: true,
              easing: 'easeinout',
              speed: 750
            }
          },
          series: [{
            name: 'Prescriptions',
            data: prescriptionsPerDay
          }],
          xaxis: {
            categories: last30Days,
            labels: {
              style: {
                colors: '#6b7280', // gray-500
                fontSize: '10px'
              },
              rotate: -45,
              rotateAlways: false,
              maxHeight: 60,
              hideOverlappingLabels: true,
              trim: true
            },
            axisBorder: {
              show: false
            },
            axisTicks: {
              show: false
            }
          },
          yaxis: {
            min: 0,
            forceNiceScale: true,
            labels: {
              style: {
                colors: '#6b7280', // gray-500
                fontSize: '11px'
              },
              formatter: function(value) {
                return Number.isInteger(value) ? value : ''
              }
            }
          },
                grid: {
            borderColor: 'rgba(31, 41, 55, 0.1)', // gray-800 with low opacity
            strokeDashArray: 3,
            xaxis: {
              lines: {
                show: false
              }
            },
            yaxis: {
              lines: {
                show: true
              }
            }
          },
          colors: ['#36807a'], // teal-600 - matching theme
          plotOptions: {
            bar: {
              borderRadius: 4,
              columnWidth: '60%',
              dataLabels: {
                position: 'top'
              }
            }
          },
          dataLabels: {
            enabled: false
          },
          tooltip: {
            theme: 'light',
            style: {
              fontSize: '12px'
            },
            fillSeriesColor: false,
            custom: function({series, seriesIndex, dataPointIndex, w}) {
              const date = w.globals.labels[dataPointIndex]
              const value = series[seriesIndex][dataPointIndex]
              return `
                <div class="bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg border border-teal-500">
                  <div class="font-semibold">${date}</div>
                  <div>${value} prescription${value !== 1 ? 's' : ''}</div>
                </div>
              `
            }
          },
          responsive: [{
            breakpoint: 768,
            options: {
              chart: {
                height: 200
              },
              xaxis: {
                labels: {
                  fontSize: '8px',
                  rotate: -90,
                  hideOverlappingLabels: true,
                  trim: true,
                  maxHeight: 80
                },
                tickAmount: 10
              }
            }
          }, {
            breakpoint: 480,
            options: {
              chart: {
                height: 180
              },
              xaxis: {
                labels: {
                  fontSize: '7px',
                  rotate: -90,
                  hideOverlappingLabels: true,
                  trim: true,
                  maxHeight: 100
                },
                tickAmount: 8
              }
            }
          }]
        }
        
        chartInstance = new ApexCharts(chartElement, options)
        chartInstance.render()
        
      }, 200)
      
    } catch (error) {
      console.error('Error creating prescriptions chart:', error)
    } finally {
      chartLoading = false
    }
  }

  // Function to invalidate chart cache when new prescriptions are added
  const invalidateChartCache = () => {
    const cacheKey = `prescriptions-chart-${user?.id}-${patients.length}`
    localStorage.removeItem(cacheKey)
    localStorage.removeItem(`${cacheKey}-timestamp`)
    console.log('Chart cache invalidated')
  }

  // Navigation functions for dashboard cards
  const navigateToPatients = () => {
    dispatch('view-change', 'patients')
  }

  const navigateToPrescriptions = () => {
    dispatch('view-change', 'prescriptions')
  }

  const navigateToPharmacies = () => {
    dispatch('view-change', 'pharmacies')
  }
  
  // Load medical data for selected patient
  const loadMedicalData = async (patientId) => {
    try {
      console.log('🔍 PatientManagement: Loading medical data for patient:', patientId)
      
      // Load illnesses
      illnesses = await firebaseStorage.getIllnessesByPatientId(patientId) || []
      console.log('🔍 PatientManagement: Loaded illnesses:', illnesses.length)
      
      // Load prescriptions
      prescriptions = await firebaseStorage.getPrescriptionsByPatientId(patientId) || []
      console.log('🔍 PatientManagement: Loaded prescriptions:', prescriptions.length)
      console.log('🔍 PatientManagement: Prescriptions data:', prescriptions)
      
      // Debug each prescription
      prescriptions.forEach((prescription, index) => {
        console.log(`🔍 PatientManagement: Prescription ${index}:`, {
          id: prescription.id,
          patientId: prescription.patientId,
          medications: prescription.medications,
          medicationsLength: prescription.medications?.length || 0,
          createdAt: prescription.createdAt
        })
      })
      
      // Load symptoms
      symptoms = await firebaseStorage.getSymptomsByPatientId(patientId) || []
      console.log('🔍 PatientManagement: Loaded symptoms:', symptoms.length)
      
      // Check dispensed status for prescriptions
      await checkPrescriptionDispensedStatus(patientId)
      
    } catch (error) {
      console.error('❌ PatientManagement: Error loading medical data:', error)
      // Ensure arrays are always defined
      illnesses = []
      prescriptions = []
      symptoms = []
    }
  }

  // Check dispensed status for patient's prescriptions
  const checkPrescriptionDispensedStatus = async (patientId) => {
    try {
      if (!doctorId || !patientId) return
      
      checkingDispensedStatus = true
      console.log('🔍 Checking dispensed status for patient:', patientId)
      
      // Get dispensed status for all patient prescriptions
      const status = await prescriptionStatusService.getPatientPrescriptionsStatus(patientId, doctorId)
      prescriptionDispensedStatus = status
      
      console.log('✅ Dispensed status loaded:', prescriptionDispensedStatus)
      console.log('🔍 Available prescription IDs:', Object.keys(prescriptionDispensedStatus))
      
      // Debug each prescription status
      Object.entries(prescriptionDispensedStatus).forEach(([prescriptionId, status]) => {
        console.log(`🔍 Prescription ${prescriptionId}:`, {
          isDispensed: status.isDispensed,
          dispensedMedications: status.dispensedMedications,
          dispensedMedicationsLength: status.dispensedMedications?.length || 0
        })
      })
      
    } catch (error) {
      console.error('❌ Error checking dispensed status:', error)
      prescriptionDispensedStatus = {}
    } finally {
      checkingDispensedStatus = false
    }
  }

  // Select a patient
  const selectPatient = (patient) => {
    selectedPatient = patient
    showAllLastPrescriptionMeds = false // Reset expanded state when selecting new patient
    if (patient) {
      loadMedicalData(patient.id)
    } else {
      // Clear medical data when no patient selected
      illnesses = []
      prescriptions = []
      symptoms = []
    }
  }
  
  // Show add patient form
  const showAddPatientForm = () => {
    showPatientForm = true
    selectedPatient = null
    // Clear medical data when showing add form
    illnesses = []
    prescriptions = []
    symptoms = []
  }
  
  // Toggle notes visibility
  const toggleSymptomsNotes = () => {
    showSymptomsNotes = !showSymptomsNotes
  }
  
  const toggleIllnessesNotes = () => {
    showIllnessesNotes = !showIllnessesNotes
  }
  
  const togglePrescriptionsNotes = () => {
    showPrescriptionsNotes = !showPrescriptionsNotes
  }
  
  // Check if notes are available
  const hasNotes = (items, field = 'notes') => {
    return items && items.some(item => item[field] && item[field].trim())
  }
  
  // Add medication to current prescription
  const addToPrescription = async (medication) => {
    try {
      // Create a new medication object with today's date
      const todayMedication = {
        ...medication,
        createdAt: new Date().toISOString(),
        prescriptionDate: new Date().toISOString()
      }
      
      // Add to the prescriptions list for the selected patient
      const newPrescription = await firebaseStorage.createMedication({
        ...todayMedication,
        patientId: selectedPatient.id
      })
      
      // Update the prescriptions array to trigger UI update
      prescriptions = [...prescriptions, newPrescription]
      
      // Increment refresh trigger to update right side
      refreshTrigger++
      
      console.log('Added to prescriptions for today:', medication.name)
    } catch (error) {
      console.error('Error adding prescription:', error)
    }
  }
  
  // Check if medication is already in prescription
  const isInPrescription = (medicationId) => {
    return prescriptions.some(item => item.id === medicationId)
  }

  // Check if a prescription is dispensed
  const isPrescriptionDispensed = (prescriptionId) => {
    return prescriptionDispensedStatus[prescriptionId]?.isDispensed || false
  }

  // Get dispensed info for a prescription
  const getPrescriptionDispensedInfo = (prescriptionId) => {
    return prescriptionDispensedStatus[prescriptionId] || {
      isDispensed: false,
      dispensedAt: null,
      dispensedBy: null,
      dispensedMedications: []
    }
  }

  // Check if a specific medication is dispensed
  const isMedicationDispensed = (prescriptionId, medicationId) => {
    const dispensedInfo = getPrescriptionDispensedInfo(prescriptionId)
    console.log('🔍 Checking if medication is dispensed:', {
      prescriptionId,
      medicationId,
      dispensedInfo,
      dispensedMedications: dispensedInfo.dispensedMedications
    })
    
    if (!dispensedInfo.dispensedMedications || !Array.isArray(dispensedInfo.dispensedMedications)) {
      console.log('❌ No dispensed medications array found')
      return false
    }
    
    // Check if the medication ID is in the dispensed medications array
    const isDispensed = dispensedInfo.dispensedMedications.some(dispensedMed => {
      console.log('🔍 Comparing:', {
        dispensedMed,
        medicationId,
        match: dispensedMed.medicationId === medicationId || 
               dispensedMed.medicationId === medicationId.toString() ||
               dispensedMed.name === medicationId
      })
      return dispensedMed.medicationId === medicationId || 
             dispensedMed.medicationId === medicationId.toString() ||
             dispensedMed.name === medicationId
    })
    
    console.log('🔍 Medication dispensed result:', isDispensed)
    return isDispensed
  }
  
  // Group items by date
  const groupByDate = (items) => {
    if (!items || !Array.isArray(items)) return []
    
    const grouped = items.reduce((groups, item) => {
      const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'No date'
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(item)
      return groups
    }, {})
    
    return Object.entries(grouped)
      .map(([date, items]) => ({ date, items }))
      .sort((a, b) => new Date(b.items[0]?.createdAt || 0) - new Date(a.items[0]?.createdAt || 0))
  }
  
  // Profile editing state
  let editingProfile = false
  let editFirstName = ''
  let editLastName = ''
  let editCountry = ''
  let editCity = ''
  let profileLoading = false
  let profileError = ''
  let activeTab = 'edit-profile'
  
  // Prescription template variables
  let templateType = '' // 'printed', 'upload', 'system'
  let uploadedHeader = null
  let templatePreview = null
  let headerSize = 300 // Default header size in pixels
  
  // Reactive variable for cities based on selected country
  $: availableCities = editCountry ? getCitiesByCountry(editCountry) : []
  
  // Reset city when country changes
  $: if (editCountry && editCity && !availableCities.find(c => c.name === editCity)) {
    editCity = ''
  }
  
  // Handle edit profile click - show inline tabbed interface
  const handleEditProfile = () => {
    editingProfile = true
    // Initialize form fields with current user data
    editFirstName = user?.firstName || ''
    editLastName = user?.lastName || ''
    editCountry = user?.country || ''
    editCity = user?.city || ''
    profileError = ''
  }
  
  // Handle profile cancel
  const handleProfileCancel = () => {
    editingProfile = false
    editFirstName = ''
    editLastName = ''
    editCountry = ''
    editCity = ''
    profileError = ''
  }
  
  // Handle tab switching
  const switchTab = (tabName) => {
    activeTab = tabName
  }
  
  // Handle profile form submission
  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    
    profileError = ''
    profileLoading = true
    
    try {
      // Validate required fields
      if (!editFirstName.trim() || !editLastName.trim()) {
        throw new Error('First name and last name are required')
      }
      
      if (!editCountry.trim()) {
        throw new Error('Country is required')
      }
      
      if (!editCity.trim()) {
        throw new Error('City is required')
      }
      
      // Update user data
      const updatedUser = {
        ...user,
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        country: editCountry.trim(),
        city: editCity.trim(),
        name: `${editFirstName.trim()} ${editLastName.trim()}`
      }
      
      // Update in auth service
      await authService.updateDoctor(updatedUser)
      
      // Dispatch profile update event to parent
      dispatch('profile-updated', updatedUser)
      
      // Exit edit mode
      editingProfile = false
      
    } catch (err) {
      profileError = err.message
    } finally {
      profileLoading = false
    }
  }
  
  // Handle template type selection
  const selectTemplateType = (type) => {
    templateType = type
    uploadedHeader = null
    templatePreview = null
  }
  
  // Handle header image upload
  const handleHeaderUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        uploadedHeader = e.target.result
      }
      reader.readAsDataURL(file)
    }
  }
  
  // Generate system header preview
  const generateSystemHeader = () => {
    templatePreview = {
      type: 'system',
      doctorName: user?.name || 'Dr. [Your Name]',
      practiceName: '[Your Practice Name]',
      address: '[Your Address]',
      phone: '[Your Phone]',
      email: user?.email || '[Your Email]'
    }
  }
  
  // Load template settings
  const loadTemplateSettings = async () => {
    try {
      if (!user?.email) {
        console.log('⚠️ No user email available for loading template settings')
        return
      }

      // Get the doctor from Firebase using email
      const doctor = await firebaseStorage.getDoctorByEmail(user.email)
      if (!doctor) {
        console.log('⚠️ Doctor not found in Firebase for email:', user.email)
        return
      }

      // Load template settings from Firebase
      const savedSettings = await firebaseStorage.getDoctorTemplateSettings(doctor.id)
      
      if (savedSettings) {
        console.log('📋 Loading saved template settings:', savedSettings)
        
        // Restore the saved settings
        templateType = savedSettings.templateType || 'system'
        uploadedHeader = savedSettings.uploadedHeader || null
        headerSize = savedSettings.headerSize || 300
        templatePreview = savedSettings.templatePreview || null
        
        console.log('✅ Template settings loaded successfully:', {
          templateType,
          uploadedHeader: uploadedHeader ? 'Image restored' : null,
          headerSize,
          templatePreview
        })
      } else {
        console.log('ℹ️ No saved template settings found')
      }
      
    } catch (error) {
      console.error('❌ Error loading template settings:', error)
    }
  }

  // Save template settings
  const saveTemplateSettings = async () => {
    try {
      console.log('🔍 saveTemplateSettings: User object:', user)
      console.log('🔍 saveTemplateSettings: User.id:', user?.id)
      console.log('🔍 saveTemplateSettings: User.uid:', user?.uid)
      console.log('🔍 saveTemplateSettings: User.email:', user?.email)
      
      // Check if user is authenticated - try different ID properties
      const userId = user?.id || user?.uid || user?.email
      if (!userId) {
        showConfirmation(
          'Authentication Error',
          'User not authenticated',
          'OK',
          '',
          'danger'
        )
        return
      }

      // Get the doctor ID from Firebase using email
      let doctor = await firebaseStorage.getDoctorByEmail(user.email)
      if (!doctor) {
        console.warn('⚠️ Template settings: Doctor not found in Firebase, using user object directly')
        if (!user || !user.id) {
          showConfirmation(
            'Profile Error',
            'Doctor profile not found. Please try logging in again.',
            'OK',
            '',
            'danger'
          )
        return
        }
        doctor = user
      }

      const templateData = {
        templateType,
        uploadedHeader,
        headerSize,
        templatePreview,
        doctorId: doctor.id,
        updatedAt: new Date().toISOString()
      }
      
      // Save to Firebase using the doctor's Firebase ID
      await firebaseStorage.saveDoctorTemplateSettings(doctor.id, templateData)
      
      console.log('✅ Template settings saved:', {
        templateType,
        uploadedHeader: uploadedHeader ? 'Image uploaded' : null,
        headerSize,
        templatePreview,
        doctorId: doctor.id
      })
      
      showConfirmation(
        'Success',
        'Template settings saved successfully!',
        'OK',
        '',
        'success'
      )
      
    } catch (error) {
      console.error('❌ Error saving template settings:', error)
      showConfirmation(
        'Error',
        'Error saving template settings. Please try again.',
        'OK',
        '',
        'danger'
      )
    }
  }
  
  onMount(() => {
    alert('🚀 PatientManagement: Component mounted! User: ' + (user?.email || 'null'))
    console.log('🚀 PatientManagement: Component mounted!')
    console.log('🚀 PatientManagement: User in onMount:', user)
    console.log('🚀 PatientManagement: About to call loadPatients...')
    loadPatients()
    loadTemplateSettings() // Load saved template settings
    // Create chart after a short delay to ensure DOM is ready
    setTimeout(() => {
      createPrescriptionsChart()
    }, 500)
    
    // Listen for prescription save events to invalidate cache
    const handlePrescriptionSaved = (event) => {
      console.log('Prescription saved event received, invalidating chart cache')
      invalidateChartCache()
      // Recreate chart with fresh data
      setTimeout(() => {
        createPrescriptionsChart()
      }, 100)
    }
    
    window.addEventListener('prescriptionSaved', handlePrescriptionSaved)
    
    // Cleanup function
    return () => {
      window.removeEventListener('prescriptionSaved', handlePrescriptionSaved)
    }
  })
  
  // Cleanup chart instance when component is destroyed
  onDestroy(() => {
    if (chartInstance) {
      chartInstance.destroy()
      chartInstance = null
    }
    chartLoading = false
  })
</script>

{#if currentView === 'home'}
<!-- Home Dashboard - Quick Stats and Chart -->
<script>alert('🏠 PatientManagement: Home view rendered! totalPrescriptions = ' + totalPrescriptions + ', patients = ' + patients.length + ', doctorId = ' + doctorId);</script>
<div class="space-y-3 sm:space-y-4" on:mount={() => console.log('🏠 PatientManagement: Home view rendered!', {totalPrescriptions, patients: patients.length, doctorId})}>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
    <div class="text-center">
      <i class="fas fa-user-md text-3xl sm:text-4xl md:text-5xl text-teal-600 mb-2 sm:mb-3"></i>
      <h2 class="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">Welcome, Dr. {doctorName}!</h2>
      <p class="text-sm sm:text-base text-gray-600">{doctorCountry}{doctorCity !== 'Not specified' ? `, ${doctorCity}` : ''}</p>
    </div>
  </div>
  
  <!-- Desktop Grid Layout -->
  <div class="hidden md:grid grid-cols-3 gap-4">
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 cursor-pointer hover:shadow-md transition-all duration-200" on:click={navigateToPatients}>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs sm:text-sm font-medium text-gray-600 mb-1">Total Patients</p>
          <p class="text-2xl sm:text-3xl font-bold text-teal-600">{patients.length}</p>
        </div>
        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-teal-100 flex items-center justify-center">
          <i class="fas fa-users text-teal-600 text-lg sm:text-xl"></i>
        </div>
      </div>
    </div>
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 cursor-pointer hover:shadow-md transition-all duration-200" on:click={navigateToPrescriptions}>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs sm:text-sm font-medium text-gray-600 mb-1">Total Prescriptions</p>
          <p class="text-2xl sm:text-3xl font-bold text-rose-600">{totalPrescriptions}</p>
          <!-- DEBUG: totalPrescriptions = {totalPrescriptions}, patients.length = {patients.length}, doctorId = {doctorId} -->
          <script>alert('DEBUG: totalPrescriptions = ' + {totalPrescriptions} + ', patients = ' + {patients.length} + ', doctorId = ' + {doctorId});</script>
        </div>
        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-rose-100 flex items-center justify-center">
          <i class="fas fa-prescription-bottle-alt text-rose-600 text-lg sm:text-xl"></i>
        </div>
      </div>
    </div>
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 cursor-pointer hover:shadow-md transition-all duration-200" on:click={navigateToPharmacies}>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs sm:text-sm font-medium text-gray-600 mb-1">Connected Pharmacies</p>
          <p class="text-2xl sm:text-3xl font-bold text-purple-600">{connectedPharmacies}</p>
        </div>
        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-100 flex items-center justify-center">
          <i class="fas fa-store text-purple-600 text-lg sm:text-xl"></i>
        </div>
      </div>
    </div>
  </div>

  <!-- Mobile Card Layout -->
  <div class="md:hidden space-y-3">
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-all duration-200" on:click={navigateToPatients}>
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center mr-3">
            <i class="fas fa-users text-teal-600 text-lg"></i>
          </div>
          <div>
            <p class="text-xs font-medium text-gray-600">Total Patients</p>
            <p class="text-xl font-bold text-teal-600">{patients.length}</p>
          </div>
        </div>
        <i class="fas fa-chevron-right text-gray-400"></i>
      </div>
    </div>
    
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-all duration-200" on:click={navigateToPrescriptions}>
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center mr-3">
            <i class="fas fa-prescription-bottle-alt text-rose-600 text-lg"></i>
          </div>
          <div>
            <p class="text-xs font-medium text-gray-600">Total Prescriptions</p>
            <p class="text-xl font-bold text-rose-600">{totalPrescriptions}</p>
            <!-- DEBUG: totalPrescriptions = {totalPrescriptions}, patients.length = {patients.length}, doctorId = {doctorId} -->
          </div>
        </div>
        <i class="fas fa-chevron-right text-gray-400"></i>
      </div>
    </div>
    
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-all duration-200" on:click={navigateToPharmacies}>
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
            <i class="fas fa-store text-purple-600 text-lg"></i>
          </div>
          <div>
            <p class="text-xs font-medium text-gray-600">Connected Pharmacies</p>
            <p class="text-xl font-bold text-purple-600">{connectedPharmacies}</p>
          </div>
        </div>
        <i class="fas fa-chevron-right text-gray-400"></i>
      </div>
    </div>
  </div>
  
  <!-- Prescriptions Per Day Chart -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
    <div class="flex items-center mb-3 sm:mb-4">
      <i class="fas fa-chart-bar text-teal-600 text-base sm:text-lg mr-2 sm:mr-3"></i>
      <h3 class="text-base sm:text-lg font-semibold text-gray-900">Prescriptions Per Day (Last 30 Days)</h3>
    </div>
    
    <div class="relative">
      {#if chartLoading}
        <div class="flex items-center justify-center h-48 sm:h-64">
          <div class="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-teal-600"></div>
        </div>
      {:else}
        <div id="prescriptionsChart" class="rounded" style="min-height: 200px;"></div>
      {/if}
    </div>
  </div>
</div>

{:else if currentView === 'patients'}
<!-- Patients List View -->
<div class="space-y-4">
  <!-- Search Patient Card -->
  <div class="bg-white rounded-lg shadow-sm border-2 border-teal-200">
    <div class="bg-teal-50 px-4 py-3 border-b border-teal-200 rounded-t-lg">
      <h3 class="text-sm sm:text-base md:text-xl font-semibold text-gray-900 mb-0">
        <i class="fas fa-search text-teal-600 mr-1 sm:mr-2"></i>
        Search Patient
      </h3>
    </div>
    <div class="p-4">
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <i class="fas fa-search text-gray-400"></i>
        </div>
        <input 
          type="text" 
          class="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
          placeholder="Search patients by name, ID, phone, or email..."
          bind:value={searchQuery}
        >
        {#if searchQuery}
        <button 
            class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600" 
            type="button" 
            on:click={clearSearch}
            title="Clear search"
          >
            <i class="fas fa-times"></i>
        </button>
        {/if}
      </div>
      {#if searchQuery}
        <div class="mt-2 text-xs text-gray-600">
          {#if filteredPatients.length > 0}
            Showing {Math.min(filteredPatients.length, 20)} of {filteredPatients.length} result{filteredPatients.length !== 1 ? 's' : ''}
            {#if filteredPatients.length > 20}
              <span class="text-orange-600 font-medium">(First 20 shown)</span>
            {/if}
          {:else}
            No patients found
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- All Patients Table Card -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200">
    <div class="p-3 sm:p-6 border-b border-gray-200">
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h3 class="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
          <i class="fas fa-users text-teal-600 mr-1 sm:mr-2"></i>
          All Patients ({patients.length})
        </h3>
        <button 
          class="bg-teal-600 hover:bg-teal-700 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-200 w-full sm:w-auto" 
          on:click={showAddPatientForm}
        >
          <i class="fas fa-plus mr-2"></i>
          Add New Patient
        </button>
      </div>
    </div>

    <!-- Desktop Table View -->
    <div class="hidden md:block overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">Patient</th>
            <th class="px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">Age</th>
            <th class="px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">ID Number</th>
            <th class="px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">Contact</th>
            <th class="px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#if (searchQuery ? filteredPatients : patients).length > 0}
            {#each (searchQuery ? filteredPatients.slice(0, 20) : patients) as patient (patient.id)}
              <tr class="hover:bg-gray-50 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm sm:text-base font-semibold mr-3">
                      {patient.firstName?.[0] || 'P'}
                    </div>
                    <div>
                      <p class="text-sm sm:text-base font-medium text-gray-900">{patient.firstName} {patient.lastName || ''}</p>
                      <p class="text-xs sm:text-sm text-gray-500">{patient.gender || 'N/A'}</p>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm sm:text-base text-gray-900">
                  {patient.age || 'N/A'} {patient.age ? 'years' : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm sm:text-base text-gray-900">
                  {patient.idNumber || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm sm:text-base text-gray-500">
                  {#if patient.phone || patient.email}
                    {#if patient.phone}<p><i class="fas fa-phone mr-1"></i>{patient.phone}</p>{/if}
                    {#if patient.email}<p><i class="fas fa-envelope mr-1"></i>{patient.email}</p>{/if}
                  {:else}
                    <p>No contact info</p>
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm sm:text-base">
                  <button 
                    class="inline-flex items-center px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors duration-200"
                    on:click={() => {
                      selectPatient(patient)
                      currentView = 'prescriptions' // Change view to show sidebar layout
                    }}
                  >
                    <i class="fas fa-eye mr-1"></i>
                    View
                  </button>
                </td>
              </tr>
            {/each}
          {:else}
            <tr>
              <td colspan="5" class="px-6 py-12 text-center">
                <i class="fas fa-users text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">
                  {#if searchQuery}
                    No patients found matching "{searchQuery}"
                  {:else}
                    No patients yet. Click "Add New Patient" to get started.
                  {/if}
                </p>
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Mobile Card View -->
    <div class="md:hidden space-y-3 p-4">
      {#if (searchQuery ? filteredPatients : patients).length > 0}
        {#each (searchQuery ? filteredPatients.slice(0, 20) : patients) as patient (patient.id)}
          <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div class="flex justify-between items-start mb-3">
              <div class="flex items-center">
                <div class="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm sm:text-base font-semibold mr-3">
                  {patient.firstName?.[0] || 'P'}
                </div>
                <div>
                  <h3 class="font-semibold text-gray-900 text-sm sm:text-base">{patient.firstName} {patient.lastName || ''}</h3>
                  <p class="text-xs sm:text-sm text-gray-500">{patient.gender || 'N/A'}</p>
                </div>
              </div>
              <button 
                class="inline-flex items-center px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors duration-200"
                on:click={() => {
                  selectPatient(patient)
                  currentView = 'prescriptions' // Change view to show sidebar layout
                }}
              >
                <i class="fas fa-eye mr-1"></i>
                View
              </button>
            </div>
            
            <div class="space-y-2">
              <div class="flex items-center text-xs sm:text-sm">
                <i class="fas fa-birthday-cake text-blue-600 mr-2 w-3"></i>
                <span class="text-gray-600 font-medium">{patient.age || 'N/A'} {patient.age ? 'years' : ''}</span>
              </div>
              <div class="flex items-center text-xs sm:text-sm">
                <i class="fas fa-id-card text-green-600 mr-2 w-3"></i>
                <span class="text-gray-600">{patient.idNumber || 'N/A'}</span>
              </div>
              {#if patient.phone || patient.email}
                {#if patient.phone}
                  <div class="flex items-center text-xs sm:text-sm">
                    <i class="fas fa-phone text-purple-600 mr-2 w-3"></i>
                    <span class="text-gray-600">{patient.phone}</span>
                  </div>
                {/if}
                {#if patient.email}
                  <div class="flex items-center text-xs sm:text-sm">
                    <i class="fas fa-envelope text-orange-600 mr-2 w-3"></i>
                    <span class="text-gray-600">{patient.email}</span>
                  </div>
                {/if}
              {:else}
                <div class="flex items-center text-xs sm:text-sm">
                  <i class="fas fa-exclamation-triangle text-gray-400 mr-2 w-3"></i>
                  <span class="text-gray-500">No contact info</span>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      {:else}
        <div class="text-center p-8">
          <i class="fas fa-users text-5xl text-gray-300 mb-3"></i>
          <p class="text-gray-500">
            {#if searchQuery}
              No patients found matching "{searchQuery}"
            {:else}
              No patients yet. Click "Add New Patient" to get started.
            {/if}
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>

{:else if currentView === 'prescriptions' || selectedPatient}
<div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
  <!-- Patient List Sidebar -->
  <div class="lg:col-span-4">
    
    <!-- Last Prescription Card -->
    {#if selectedPatient}
      <div class="bg-white border-2 border-rose-200 rounded-lg shadow-sm mt-3">
        <div class="bg-rose-50 px-3 py-2 border-b border-rose-200 rounded-t-lg">
          <h6 class="text-lg font-semibold text-gray-900 mb-0">
            <i class="fas fa-prescription-bottle-alt text-rose-600 mr-2"></i>
            Last Prescription
          </h6>
        </div>
        <div class="p-3">
          <!-- Debug info -->
          <div class="text-xs text-gray-500 mb-2">
            Debug: prescriptions.length = {prescriptions.length}
            {#if prescriptions.length > 0}
              , prescriptions with medications = {prescriptions.filter(p => p.medications && p.medications.length > 0).length}
            {/if}
          </div>
          
          {#if prescriptions.length > 0}
            {#if selectedPrescriptionForCard}
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs text-gray-600 mb-2">
                <span><i class="fas fa-calendar mr-1"></i>{new Date(selectedPrescriptionForCard.createdAt).toLocaleDateString()}</span>
                <div class="flex items-center gap-2">
                  {#if isPrescriptionDispensed(selectedPrescriptionForCard.id)}
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <i class="fas fa-check-circle mr-1"></i>Dispensed
                    </span>
                  {/if}
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{selectedPrescriptionForCard.medications.length} drug{selectedPrescriptionForCard.medications.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              {#each (showAllLastPrescriptionMeds ? selectedPrescriptionForCard.medications : selectedPrescriptionForCard.medications.slice(0, 3)) as medication}
                <div class="bg-gray-50 rounded-lg p-2 border border-gray-200">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <p class="text-base font-semibold text-blue-600">{medication.name}</p>
                        {#if isMedicationDispensed(selectedPrescriptionForCard.id, medication.id || medication.name)}
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <i class="fas fa-check-circle mr-1"></i>Dispensed
                          </span>
                        {/if}
                      </div>
                      <div class="flex items-center flex-wrap gap-2">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <i class="fas fa-pills mr-1"></i>{medication.dosage || medication.dose || 'N/A'}
                        </span>
                        {#if medication.frequency || medication.duration}
                          <small class="text-gray-500 text-xs">
                            <i class="fas fa-clock mr-1"></i>{medication.frequency || ''}{#if medication.frequency && medication.duration} · {/if}{medication.duration || ''}
                          </small>
                        {/if}
                      </div>
                      {#if medication.instructions}
                        <p class="text-xs text-gray-500 mt-1 italic">
                          <i class="fas fa-info-circle mr-1"></i>{medication.instructions}
                        </p>
                      {/if}
                    </div>
                    <button 
                      class="inline-flex items-center px-3 py-1 border border-teal-300 text-xs font-medium text-teal-700 bg-white hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 rounded-lg transition-colors duration-200 flex-shrink-0"
                      on:click={() => addToPrescription(medication)}
                      title="Add to current prescription"
                    >
                      <i class="fas fa-plus mr-1"></i>
                      Add
                    </button>
                  </div>
                </div>
              {/each}
                {#if selectedPrescriptionForCard.medications.length > 3}
                  <button
                    type="button"
                    class="w-full text-gray-500 hover:text-teal-600 text-xs block text-center mt-2 py-1 transition-colors duration-200"
                    on:click={() => showAllLastPrescriptionMeds = !showAllLastPrescriptionMeds}
                  >
                    {#if showAllLastPrescriptionMeds}
                      <i class="fas fa-chevron-up mr-1"></i>Show less
                    {:else}
                      <i class="fas fa-chevron-down mr-1"></i>+{selectedPrescriptionForCard.medications.length - 3} more medication{selectedPrescriptionForCard.medications.length - 3 !== 1 ? 's' : ''}
                    {/if}
                  </button>
                {/if}
            </div>
            {:else}
              <small class="text-gray-500 text-xs block text-center py-2">No medications in any prescription</small>
            {/if}
          {:else}
            <small class="text-gray-500 text-xs block text-center py-2">No prescriptions found</small>
          {/if}
        </div>
      </div>
    {/if}
    
    <!-- Medical Summary (No Card Wrapper) -->
    {#if selectedPatient}
      <MedicalSummary 
        {selectedPatient}
        {illnesses}
        {prescriptions}
        {symptoms}
        {activeMedicalTab}
        {showSymptomsNotes}
        {showIllnessesNotes}
        {showPrescriptionsNotes}
        {addToPrescription}
        {hasNotes}
        {toggleSymptomsNotes}
        {toggleIllnessesNotes}
        {togglePrescriptionsNotes}
        {groupByDate}
        {doctorId}
        on:tabChange={(e) => activeMedicalTab = e.detail.tab}
      />
    {/if}
  </div>
  
  <!-- Main Content Area -->
    <div class="lg:col-span-8">
      {#if showPatientForm}
        <PatientForm on:patient-added={addPatient} on:cancel={() => showPatientForm = false} />
      {:else if selectedPatient}
        <PatientDetails 
          {selectedPatient} 
          {addToPrescription} 
          {refreshTrigger} 
          {doctorId}
          currentUser={user}
          on:dataUpdated={handleDataUpdated}
          on:view-patient={handleViewPatient}
        />
      {:else}
      <!-- Welcome Dashboard -->
      <div class="space-y-4">
                 <!-- Welcome Message -->
                 <div key={userKey}>
                   <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm">
                     <div class="p-6">
                       <div class="flex items-center">
                         <div class="flex-shrink-0">
                           <i class="fas fa-user-md fa-2x text-teal-600"></i>
                         </div>
                         <div class="flex-1 ml-4">
                           <!-- Desktop Layout -->
                           <div class="hidden sm:flex justify-between items-center">
                             <div class="flex items-center">
                               <h4 class="text-xl font-bold text-gray-900 mb-1 mr-3 cursor-pointer hover:text-teal-600 transition-colors duration-200" on:click={handleEditProfile} title="Click to edit profile">
                                 Welcome, Dr. {doctorName}!
                               </h4>
                             </div>
                             <button class="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-300 focus:ring-offset-2 dark:bg-white dark:text-gray-700 dark:border-gray-300 dark:hover:bg-gray-50 transition-all duration-200" on:click={handleEditProfile} title="Edit Profile Settings">
                               <i class="fas fa-cog text-sm text-red-600"></i>
                               <span class="text-sm font-medium">Settings</span>
                               </button>
                             </div>
                           
                           <!-- Mobile Layout -->
                           <div class="sm:hidden">
                             <div class="flex items-center justify-between mb-2">
                               <h4 class="text-lg font-bold text-gray-900 cursor-pointer hover:text-teal-600 transition-colors duration-200" on:click={handleEditProfile} title="Click to edit profile">
                                  Welcome, Dr. {doctorName}!
                               </h4>
                               <button class="flex items-center space-x-1 px-2 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-300 focus:ring-offset-2 dark:bg-white dark:text-gray-700 dark:border-gray-300 dark:hover:bg-gray-50 transition-all duration-200" on:click={handleEditProfile} title="Edit Profile Settings">
                                 <i class="fas fa-cog text-xs text-red-600"></i>
                                 <span class="text-xs font-medium">Settings</span>
                               </button>
                           </div>
                           </div>
                           <p class="text-gray-600 mb-0">
                             Ready to provide excellent patient care with AI-powered assistance
                           </p>
                           <!-- Added Country Information -->
                           <p class="text-gray-500 mt-2 mb-0 text-sm">
                             <i class="fas fa-map-marker-alt mr-1"></i>
                             Location: {doctorCity || 'Not specified'}, {doctorCountry || 'Not specified'}
                           </p>
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
        
        {#if !editingProfile}
        <!-- Statistics Cards -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <!-- Patients Card - Ocean Blue Outline -->
        <div class="bg-white border-2 border-blue-500 text-blue-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 h-full transform hover:scale-105 hover:bg-blue-50 cursor-pointer" on:click={navigateToPatients}>
          <div class="p-4">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                <div class="bg-blue-100 border-2 border-blue-500 rounded-full p-3">
                  <i class="fas fa-users text-lg text-blue-600"></i>
                  </div>
                </div>
              <div class="flex-1 ml-3">
                <h4 class="text-2xl font-bold mb-0 text-blue-600" id="totalPatients">{patients.length}</h4>
                <small class="text-blue-500 hidden sm:block">Patients Registered</small>
                <small class="text-blue-500 sm:hidden">Patients</small>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Prescriptions Card - Sunset Orange Outline -->
        <div class="bg-white border-2 border-orange-500 text-orange-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 h-full transform hover:scale-105 hover:bg-orange-50 cursor-pointer" on:click={navigateToPrescriptions}>
          <div class="p-4">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                <div class="bg-orange-100 border-2 border-orange-500 rounded-full p-3">
                  <i class="fas fa-prescription text-lg text-orange-600"></i>
                  </div>
                </div>
              <div class="flex-1 ml-3">
                <h4 class="text-2xl font-bold mb-0 text-orange-600" id="totalPrescriptions">{totalPrescriptions}</h4>
                <small class="text-orange-500 hidden sm:block">Total Prescriptions</small>
                <small class="text-orange-500 sm:hidden">Prescriptions</small>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Drugs Card - Forest Green Outline -->
        <div class="bg-white border-2 border-green-500 text-green-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 h-full transform hover:scale-105 hover:bg-green-50 cursor-pointer" on:click={navigateToPrescriptions}>
          <div class="p-4">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                <div class="bg-green-100 border-2 border-green-500 rounded-full p-3">
                  <i class="fas fa-pills text-lg text-green-600"></i>
                  </div>
                </div>
              <div class="flex-1 ml-3">
                <h4 class="text-2xl font-bold mb-0 text-green-600" id="totalDrugs">{totalDrugs}</h4>
                <small class="text-green-500 hidden sm:block">Total Drugs</small>
                <small class="text-green-500 sm:hidden">Drugs</small>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Pharmacies Card - Royal Purple Outline -->
        <div class="bg-white border-2 border-purple-500 text-purple-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 h-full transform hover:scale-105 hover:bg-purple-50 cursor-pointer" on:click={navigateToPharmacies}>
          <div class="p-4">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                <div class="bg-purple-100 border-2 border-purple-500 rounded-full p-3">
                  <i class="fas fa-store text-lg text-purple-600"></i>
                  </div>
                </div>
              <div class="flex-1 ml-3">
                <h4 class="text-2xl font-bold mb-0 text-purple-600" id="connectedPharmacies">{connectedPharmacies}</h4>
                <small class="text-purple-500 hidden sm:block">Connected Pharmacies</small>
                <small class="text-purple-500 sm:hidden">Pharmacies</small>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Prescriptions Per Day Chart -->
        <div class="col-span-full">
          <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div class="bg-gray-50 border-b border-gray-200 py-3 px-4">
              <h6 class="text-lg font-semibold text-gray-900 mb-0">
                <i class="fas fa-chart-line mr-2 text-teal-600"></i>
                <span class="hidden sm:inline">Prescriptions Per Day (Last 30 Days)</span>
                <span class="sm:hidden">Prescriptions Per Day</span>
              </h6>
            </div>
            <div class="p-4">
              {#if chartLoading}
                <div class="flex items-center justify-center h-64">
                  <LoadingSpinner 
                    size="medium" 
                    color="teal" 
                    text="Generating chart..." 
                    fullScreen={false}
                  />
              </div>
              {:else}
                <div class="relative w-full">
                  <div id="prescriptionsChart" class="rounded"></div>
                </div>
              {/if}
            </div>
          </div>
        </div>
        {/if}
        
        {#if editingProfile}
        <!-- Inline Tabbed Profile Editing Interface -->
        <div class="col-span-full">
          <div class="bg-white border-2 border-teal-500 rounded-lg shadow-sm" style="border-color: #36807a;">
            <div class="bg-teal-600 text-white px-4 py-3 rounded-t-lg">
              <div class="flex justify-between items-center">
                <h6 class="text-lg font-semibold mb-0">
                  <i class="fas fa-cog mr-2 fa-sm"></i>
                  Settings
                </h6>
                <button class="inline-flex items-center px-3 py-2 border border-white text-white bg-transparent hover:bg-white hover:text-teal-600 text-sm font-medium rounded-lg focus:outline-none focus:ring-4 focus:ring-white focus:ring-offset-2 focus:ring-offset-teal-600 transition-all duration-200" on:click={handleProfileCancel}>
                  <i class="fas fa-times fa-sm"></i>
                </button>
              </div>
            </div>
            
            <!-- Tab Navigation -->
            <div class="border-b border-gray-200">
              <ul class="flex flex-wrap -mb-px text-sm font-medium text-center" id="default-tab" data-tabs-toggle="#default-tab-content" role="tablist">
                <li class="flex-1" role="presentation">
                  <button 
                    class="inline-block w-full p-4 border-b-2 rounded-t-lg {activeTab === 'edit-profile' ? 'text-teal-600 border-teal-600 active' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}" 
                    id="edit-profile-tab" 
                    data-tabs-target="#edit-profile" 
                    type="button" 
                    role="tab" 
                    aria-controls="edit-profile" 
                    aria-selected={activeTab === 'edit-profile'}
                    on:click={() => switchTab('edit-profile')}
                  >
                    <i class="fas fa-user-edit mr-2 fa-sm"></i>
                    Edit Profile
                  </button>
                </li>
                <li class="flex-1" role="presentation">
                  <button 
                    class="inline-block w-full p-4 border-b-2 rounded-t-lg {activeTab === 'prescription-template' ? 'text-teal-600 border-teal-600 active' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}" 
                    id="prescription-template-tab" 
                    data-tabs-target="#prescription-template" 
                    type="button" 
                    role="tab" 
                    aria-controls="prescription-template" 
                    aria-selected={activeTab === 'prescription-template'}
                    on:click={() => switchTab('prescription-template')}
                  >
                    <i class="fas fa-file-medical mr-2 fa-sm"></i>
                    Prescription Template
                  </button>
                </li>
              </ul>
            </div>
              
              <!-- Tab Content -->
            <div id="default-tab-content">
                <!-- Edit Profile Tab -->
                {#if activeTab === 'edit-profile'}
              <div class="p-4 rounded-lg bg-white" id="edit-profile" role="tabpanel" aria-labelledby="edit-profile-tab">
                  <form on:submit={handleProfileSubmit}>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <label for="editFirstName" class="block text-sm font-medium text-gray-700 mb-1">
                          First Name <span class="text-red-600">*</span>
                        </label>
                        <input 
                          type="text" 
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                          id="editFirstName"
                          bind:value={editFirstName}
                          placeholder="Enter your first name"
                          required
                          disabled={profileLoading}
                        />
                      </div>
                      <div>
                        <label for="editLastName" class="block text-sm font-medium text-gray-700 mb-1">
                          Last Name <span class="text-red-600">*</span>
                        </label>
                        <input 
                          type="text" 
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                          id="editLastName"
                          bind:value={editLastName}
                          placeholder="Enter your last name"
                          required
                          disabled={profileLoading}
                        />
                      </div>
                    </div>

                    <div class="mb-3">
                      <label for="editEmail" class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <input 
                        type="email" 
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                        id="editEmail"
                        value={user?.email || ''}
                        disabled
                        readonly
                      />
                      <div class="text-sm text-gray-500">
                        <i class="fas fa-info-circle mr-1"></i>
                        Email cannot be changed for security reasons
                      </div>
                    </div>

                    <div class="mb-3">
                      <label for="editCountry" class="block text-sm font-medium text-gray-700 mb-1">
                        Country <span class="text-red-600">*</span>
                      </label>
                      <select 
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                        id="editCountry"
                        bind:value={editCountry}
                        required
                        disabled={profileLoading}
                      >
                        <option value="">Select your country</option>
                        {#each countries as countryOption}
                          <option value={countryOption.name}>{countryOption.name}</option>
                        {/each}
                      </select>
                    </div>

                    <div class="mb-3">
                      <label for="editCity" class="block text-sm font-medium text-gray-700 mb-1">
                        City <span class="text-red-600">*</span>
                      </label>
                      <select 
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                        id="editCity"
                        bind:value={editCity}
                        required
                        disabled={profileLoading || !editCountry}
                      >
                        <option value="">Select your city</option>
                        {#each availableCities as cityOption}
                          <option value={cityOption.name}>{cityOption.name}</option>
                        {/each}
                      </select>
                      {#if editCountry && availableCities.length === 0}
                        <div class="text-sm text-yellow-600">
                          <i class="fas fa-exclamation-triangle mr-1"></i>
                          No cities available for the selected country. Please contact support.
                        </div>
                      {/if}
                    </div>

                    {#if profileError}
                      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-3" role="alert">
                        <i class="fas fa-exclamation-triangle mr-2"></i>{profileError}
                      </div>
                    {/if}

                    <div class="flex justify-end gap-2">
                      <button 
                        type="button" 
                        class="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed" 
                        on:click={handleProfileCancel}
                        disabled={profileLoading}
                      >
                        <i class="fas fa-times mr-1 fa-sm"></i>
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        class="inline-flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        disabled={profileLoading}
                      >
                        {#if profileLoading}
                          <ThreeDots size="small" color="white" />
                        {/if}
                        <i class="fas fa-save mr-1 fa-sm"></i>
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
                {/if}
                
                <!-- Prescription Template Tab -->
                {#if activeTab === 'prescription-template'}
              <div class="p-4 rounded-lg bg-white" id="prescription-template" role="tabpanel" aria-labelledby="prescription-template-tab">
                  <div class="mb-4">
                    <h6 class="fw-bold mb-3">
                      <i class="fas fa-file-medical mr-2"></i>
                      Prescription Template Settings
                    </h6>
                    <p class="text-gray-600 dark:text-gray-300 small mb-4">Choose how you want your prescription header to appear on printed prescriptions.</p>
                  </div>
                  
                  <!-- Template Type Selection -->
                  <div class="row mb-4">
                    <div class="col-span-full">
                      <label class="block text-sm font-semibold text-gray-700 mb-3">Select Template Type:</label>
                      
                      <!-- Option 1: Printed Letterheads -->
                      {#if templateType !== 'upload'}
                      <div class="bg-white border-2 rounded-lg shadow-sm mb-4 {templateType === 'printed' ? 'border-teal-500' : 'border-gray-200'}" style="border-color: {templateType === 'printed' ? '#36807a' : '#e5e7eb'};">
                        <div class="p-4">
                          <div class="flex items-center">
                            <input 
                              class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2 mr-3" 
                              type="radio" 
                              name="templateType" 
                              id="templatePrinted" 
                              value="printed"
                              bind:group={templateType}
                              on:change={() => selectTemplateType('printed')}
                            />
                            <label class="w-full cursor-pointer" for="templatePrinted">
                              <div class="flex items-center">
                                <div class="flex-shrink-0 mr-3">
                                  <i class="fas fa-print text-2xl text-teal-600"></i>
                                </div>
                                <div class="flex-1">
                                  <h6 class="text-sm font-semibold text-gray-900 mb-1">I have printed A3 letterheads</h6>
                                  <p class="text-gray-500 text-sm mb-0">Use your existing printed letterhead paper for prescriptions. No header will be added to the PDF.</p>
                                </div>
                              </div>
                            </label>
                          </div>
                          
                          {#if templateType === 'printed'}
                          <div class="mt-4">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Header Size Adjustment:</label>
                            <div class="flex items-center">
                              <div class="flex-1 mr-4">
                                <input 
                                  type="range" 
                                  class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
                                  min="50" 
                                  max="300" 
                                  step="10"
                                  bind:value={headerSize}
                                />
                              </div>
                              <div class="flex-shrink-0">
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">{headerSize}px</span>
                              </div>
                            </div>
                            <div class="text-sm text-gray-500 mt-2">
                              <i class="fas fa-info-circle mr-1"></i>
                              Adjust the header space to match your printed letterhead height.
                            </div>
                            
                            <!-- Template Preview -->
                            <div class="mt-4">
                              <label class="block text-sm font-medium text-gray-700 mb-2">Template Preview:</label>
                              <div class="border rounded p-2 bg-gray-50">
                                <div class="template-preview">
                                  <!-- Header Space (representing printed letterhead) -->
                                  <div 
                                    class="header-space border-bottom border-2 border-teal-500 mb-3"
                                    style="height: {headerSize}px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);"
                                  >
                                    <div class="flex items-center justify-center h-full">
                                      <div class="text-center text-gray-600 dark:text-gray-300">
                                        <i class="fas fa-print fa-2x mb-2"></i>
                                        <div class="small">Printed Letterhead Area</div>
                                        <div class="small fw-bold">{headerSize}px height</div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <!-- Prescription Content Area -->
                                  <div class="prescription-content">
                                    <div class="row mb-2">
                                      <div class="col-6">
                                        <strong>Patient Name:</strong> [Patient Name]
                                      </div>
                                      <div class="col-6 text-right">
                                        <strong>Date:</strong> [Date]
                                      </div>
                                    </div>
                                    <div class="row mb-2">
                                      <div class="col-6">
                                        <strong>Age:</strong> [Age]
                                      </div>
                                      <div class="col-6 text-right">
                                        <strong>Prescription #:</strong> [Rx Number]
                                      </div>
                                    </div>
                                    <hr class="my-3">
                                    <div class="medications mb-3">
                                      <strong>Medications:</strong>
                                      <div class="mt-2">
                                        <div class="flex justify-between">
                                          <span>• Medication Name</span>
                                          <span><strong>Dosage</strong></span>
                                        </div>
                                        <div class="small text-gray-600 dark:text-gray-300">Instructions and notes here</div>
                                      </div>
                                    </div>
                                    <div class="signature-area border-top pt-2 mt-3">
                                      <div class="row">
                                        <div class="col-6">
                                          <strong>Doctor's Signature:</strong> _______________
                                        </div>
                                        <div class="col-6 text-right">
                                          <strong>Date:</strong> _______________
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          {/if}
                        </div>
                      </div>
                      {/if}
                      
                      <!-- Option 2: Upload Image -->
                      <div class="bg-white border-2 rounded-lg shadow-sm mb-4 {templateType === 'upload' ? 'border-teal-500' : 'border-gray-200'}" style="border-color: {templateType === 'upload' ? '#36807a' : '#e5e7eb'};">
                        <div class="p-4">
                          <div class="flex items-center">
                            <input 
                              class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2 mr-3" 
                              type="radio" 
                              name="templateType" 
                              id="templateUpload" 
                              value="upload"
                              bind:group={templateType}
                              on:change={() => selectTemplateType('upload')}
                            />
                            <label class="w-full cursor-pointer" for="templateUpload">
                              <div class="flex items-center">
                                <div class="flex-shrink-0 mr-3">
                                  <i class="fas fa-image text-2xl text-teal-600"></i>
                                </div>
                                <div class="flex-1">
                                  <h6 class="text-sm font-semibold text-gray-900 mb-1">I want to upload an image for header</h6>
                                  <p class="text-gray-500 text-sm mb-0">Upload your custom header image to be used on all prescriptions.</p>
                                </div>
                              </div>
                            </label>
                          </div>
                          
                          {#if templateType === 'upload'}
                          <div class="mt-3">
                            <input 
                              type="file" 
                              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                              accept="image/*"
                              on:change={handleHeaderUpload}
                            />
                            <div class="text-sm text-gray-500">
                              <i class="fas fa-info-circle mr-1"></i>
                              Supported formats: JPG, PNG, GIF. Recommended size: 800x200 pixels.
                            </div>
                            
                            {#if uploadedHeader}
                            <div class="mt-4">
                              <label class="block text-sm font-medium text-gray-700 mb-2">Header Size Adjustment:</label>
                              <div class="flex items-center">
                                <div class="flex-1 mr-4">
                                  <input 
                                    type="range" 
                                    class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
                                    min="50" 
                                    max="300" 
                                    step="10"
                                    bind:value={headerSize}
                                  />
                                </div>
                                <div class="flex-shrink-0">
                                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">{headerSize}px</span>
                                </div>
                              </div>
                              <div class="text-sm text-gray-500 mt-2">
                                <i class="fas fa-info-circle mr-1"></i>
                                Adjust the header space to match your uploaded image height.
                              </div>
                              
                              <!-- Template Preview with Uploaded Image -->
                              <div class="mt-4">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Template Preview:</label>
                                <div class="border rounded p-2 bg-gray-50">
                                  <div class="template-preview">
                                    <!-- Header Space with Uploaded Image -->
                                    <div 
                                      class="header-space border-bottom border-2 border-teal-500 mb-3"
                                      style="height: {headerSize}px; background-image: url('{uploadedHeader}'); background-size: contain; background-repeat: no-repeat; background-position: center;"
                                    >
                                      <div class="flex items-center justify-center h-full">
                                        <div class="text-center text-gray-600 dark:text-gray-300" style="background: rgba(255,255,255,0.8); padding: 0.5rem; border-radius: 0.25rem;">
                                          <div class="small">Custom Header Image</div>
                                          <div class="small fw-bold">{headerSize}px height</div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <!-- Prescription Content Area -->
                                    <div class="prescription-content">
                                      <div class="row mb-2">
                                        <div class="col-6">
                                          <strong>Patient Name:</strong> [Patient Name]
                                        </div>
                                        <div class="col-6 text-right">
                                          <strong>Date:</strong> [Date]
                                        </div>
                                      </div>
                                      <div class="row mb-2">
                                        <div class="col-6">
                                          <strong>Age:</strong> [Age]
                                        </div>
                                        <div class="col-6 text-right">
                                          <strong>Prescription #:</strong> [Rx Number]
                                        </div>
                                      </div>
                                      <hr class="my-3">
                                      <div class="medications mb-3">
                                        <strong>Medications:</strong>
                                        <div class="mt-2">
                                          <div class="flex justify-between">
                                            <span>• Medication Name</span>
                                            <span><strong>Dosage</strong></span>
                                          </div>
                                          <div class="small text-gray-600 dark:text-gray-300">Instructions and notes here</div>
                                        </div>
                                      </div>
                                      <div class="signature-area border-top pt-2 mt-3">
                                        <div class="row">
                                          <div class="col-6">
                                            <strong>Doctor's Signature:</strong> _______________
                                          </div>
                                          <div class="col-6 text-right">
                                            <strong>Date:</strong> _______________
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {/if}
                          </div>
                          {/if}
                        </div>
                      </div>
                      
                      <!-- Option 3: System Header -->
                      {#if templateType !== 'printed' && templateType !== 'upload'}
                      <div class="bg-white border-2 rounded-lg shadow-sm mb-4 {templateType === 'system' ? 'border-teal-500' : 'border-gray-200'}" style="border-color: {templateType === 'system' ? '#36807a' : '#e5e7eb'};">
                        <div class="p-4">
                          <div class="flex items-center">
                            <input 
                              class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2 mr-3" 
                              type="radio" 
                              name="templateType" 
                              id="templateSystem" 
                              value="system"
                              bind:group={templateType}
                              on:change={() => selectTemplateType('system')}
                            />
                            <label class="w-full cursor-pointer" for="templateSystem">
                              <div class="flex items-center">
                                <div class="flex-shrink-0 mr-3">
                                  <i class="fas fa-cog text-2xl text-teal-600"></i>
                                </div>
                                <div class="flex-1">
                                  <h6 class="text-sm font-semibold text-gray-900 mb-1">I want system to add header for template</h6>
                                  <p class="text-gray-500 text-sm mb-0">Use a system-generated header with your practice information.</p>
                                </div>
                              </div>
                            </label>
                          </div>
                          
                          {#if templateType === 'system'}
                          <div class="mt-3">
                            <button 
                              type="button" 
                              class="inline-flex items-center px-3 py-2 border border-teal-300 text-teal-700 bg-white hover:bg-teal-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200"
                              on:click={generateSystemHeader}
                            >
                              <i class="fas fa-eye mr-2"></i>
                              Preview System Header
                            </button>
                            
                            {#if templatePreview && templatePreview.type === 'system'}
                            <div class="mt-4">
                              <label class="block text-sm font-medium text-gray-700 mb-2">System Header Preview:</label>
                              <div class="border rounded p-3 bg-gray-50">
                                <div class="text-center">
                                  <h5 class="fw-bold mb-1">{templatePreview.doctorName}</h5>
                                  <p class="mb-1 fw-semibold">{templatePreview.practiceName}</p>
                                  <p class="mb-1 small">{templatePreview.address}</p>
                                  <p class="mb-1 small">Tel: {templatePreview.phone} | Email: {templatePreview.email}</p>
                                  <hr class="my-2">
                                  <p class="mb-0 fw-bold">PRESCRIPTION</p>
                                </div>
                              </div>
                            </div>
                            {/if}
                          </div>
                          {/if}
                        </div>
                      </div>
                      {/if}
                    </div>
                  </div>
                  
                  <!-- Save Button -->
                  <div class="flex justify-end gap-2">
                    <button 
                      type="button" 
                      class="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200" 
                      on:click={handleProfileCancel}
                    >
                      <i class="fas fa-times mr-1 fa-sm"></i>
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      class="inline-flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      on:click={saveTemplateSettings}
                      disabled={!templateType}
                    >
                      <i class="fas fa-save mr-1 fa-sm"></i>
                      Save Template Settings
                    </button>
                  </div>
                </div>
                {/if}
            </div>
          </div>
        </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
{/if}

{#if currentView === 'pharmacies'}
<!-- Pharmacist Management View -->
<PharmacistManagement {user} />
{/if}


<!-- Confirmation Modal -->
<ConfirmationModal
  visible={showConfirmationModal}
  title={confirmationConfig.title}
  message={confirmationConfig.message}
  confirmText={confirmationConfig.confirmText}
  cancelText={confirmationConfig.cancelText}
  type={confirmationConfig.type}
  on:confirm={handleConfirmationConfirm}
  on:cancel={handleConfirmationCancel}
  on:close={handleConfirmationCancel}
/>

<style>
  /* Template Preview Styles */
  .template-preview {
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .template-preview .header-space {
    position: relative;
    border-radius: 0.375rem;
    transition: height 0.3s ease;
  }

  .template-preview .prescription-content {
    font-size: 0.8rem;
  }

  .template-preview .medications {
    font-size: 0.75rem;
  }

  .template-preview .signature-area {
    font-size: 0.75rem;
  }

  /* Custom styles for enhanced UI */
</style>