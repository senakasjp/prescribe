<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import firebaseStorage from '../services/firebaseStorage.js'
  import authService from '../services/authService.js'
  import PatientForm from './PatientForm.svelte'
  import PatientDetails from './PatientDetails.svelte'
  import PatientList from './PatientList.svelte'
  import MedicalSummary from './MedicalSummary.svelte'
  import PharmacistManagement from './PharmacistManagement.svelte'
  import { Chart, registerables } from 'chart.js'
  import { countries } from '../data/countries.js'
  import { cities, getCitiesByCountry } from '../data/cities.js'
  
  // Register Chart.js components
  Chart.register(...registerables)
  
  const dispatch = createEventDispatcher()
  export let user
  
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
  let searchQuery = ''
  let filteredPatients = []
  let currentView = 'patients' // 'patients' or 'pharmacists'
  
  // Medical data for selected patient
  let illnesses = []
  let prescriptions = []
  let symptoms = []
  
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
  
  // Profile editing state removed - now using tabbed modal
  
  // Reactive variables removed - now using tabbed modal
  
  // Reactive statements to ensure component updates when data changes
  $: if (selectedPatient) {
    loadMedicalData(selectedPatient.id)
  }
  
  // Reload statistics when patients change
  $: if (patients.length >= 0) {
    loadStatistics()
  }
  
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
      
      // Load statistics after loading patients
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
    try {
      totalPrescriptions = await getTotalPrescriptions()
      totalDrugs = await getTotalDrugs()
      connectedPharmacies = await getConnectedPharmacies()
    } catch (error) {
      console.error('Error loading statistics:', error)
      totalPrescriptions = 0
      totalDrugs = 0
      connectedPharmacies = 0
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
      
      // Always get the doctor from Firebase to ensure we have the correct ID
      console.log('🔍 PatientManagement: Getting doctor from Firebase for email:', user.email)
      const doctor = await firebaseStorage.getDoctorByEmail(user.email)
      console.log('🔍 PatientManagement: Doctor from Firebase:', doctor)
      
      if (!doctor) {
        console.error('❌ PatientManagement: Doctor not found in Firebase for email:', user.email)
        throw new Error('Doctor not found in database')
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
    console.log('🔍 getTotalPrescriptions: Patients count:', patients.length)
    
    // Check if we have any patients at all
    if (patients.length === 0) {
      console.log('🔍 getTotalPrescriptions: No patients found, checking all prescriptions in storage')
      // If no patients, check all prescriptions in storage
      const allPrescriptions = await firebaseStorage.getAllPrescriptions()
      console.log('🔍 getTotalPrescriptions: All prescriptions in storage:', allPrescriptions)
      total = allPrescriptions.length
    } else {
      for (const patient of patients) {
        const patientPrescriptions = await firebaseStorage.getPrescriptionsByPatientId(patient.id) || []
        console.log(`🔍 getTotalPrescriptions: Patient ${patient.firstName} has ${patientPrescriptions.length} prescriptions`)
        console.log(`🔍 getTotalPrescriptions: Prescription data:`, patientPrescriptions)
        total += patientPrescriptions.length
      }
    }
    
    console.log('🔍 getTotalPrescriptions: Total prescriptions:', total)
    return total
  }
  
  const getTotalDrugs = async () => {
    let total = 0
    console.log('🔍 getTotalDrugs: Patients count:', patients.length)
    
    // Check if we have any patients at all
    if (patients.length === 0) {
      console.log('🔍 getTotalDrugs: No patients found, checking all prescriptions in storage')
      // If no patients, check all prescriptions in storage
      const allPrescriptions = await firebaseStorage.getAllPrescriptions()
      console.log('🔍 getTotalDrugs: All prescriptions in storage:', allPrescriptions)
      
      allPrescriptions.forEach(prescription => {
        console.log(`🔍 getTotalDrugs: Prescription structure:`, prescription)
        if (prescription.medications && Array.isArray(prescription.medications)) {
          console.log(`🔍 getTotalDrugs: Prescription has ${prescription.medications.length} medications`)
          total += prescription.medications.length
        } else {
          console.log(`🔍 getTotalDrugs: Prescription has no medications array, counting as 1`)
          total += 1 // Single medication prescription
        }
      })
    } else {
      for (const patient of patients) {
        const patientPrescriptions = await firebaseStorage.getPrescriptionsByPatientId(patient.id) || []
        console.log(`🔍 getTotalDrugs: Patient ${patient.firstName} has ${patientPrescriptions.length} prescriptions`)
        patientPrescriptions.forEach(prescription => {
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
    }
    
    console.log('🔍 getTotalDrugs: Total drugs:', total)
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

  
  // Create responsive prescriptions per day chart using Chart.js
  const createPrescriptionsChart = async () => {
    try {
      // Destroy existing chart if it exists
      if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
      }
      
      // Calculate prescriptions per day for last 30 days
      const last30Days = []
      const prescriptionsPerDay = []
      
      for (let i = 29; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        const day = date.getDate()
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        
        last30Days.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
        
        // Count prescriptions created on this day
        let dayPrescriptions = 0
        for (const patient of patients) {
          const patientPrescriptions = await firebaseStorage.getMedicationsByPatientId(patient.id) || []
          patientPrescriptions.forEach(prescription => {
            const createdDate = new Date(prescription.createdAt || prescription.dateCreated)
            const prescriptionYear = createdDate.getFullYear()
            const prescriptionMonth = createdDate.getMonth() + 1
            const prescriptionDay = createdDate.getDate()
            const prescriptionDateStr = `${prescriptionYear}-${String(prescriptionMonth).padStart(2, '0')}-${String(prescriptionDay).padStart(2, '0')}`
            
            if (prescriptionDateStr === dateStr) {
              dayPrescriptions++
            }
          })
        }
        
        prescriptionsPerDay.push(dayPrescriptions)
      }
      
      // Create Chart.js chart with proper error handling
      setTimeout(() => {
        const canvas = document.getElementById('prescriptionsChart')
        if (!canvas) {
          console.log('Canvas not found, skipping chart creation')
          return
        }
        
        // Check if canvas is already in use
        if (canvas.chart) {
          console.log('Canvas already has a chart, destroying it first')
          canvas.chart.destroy()
          canvas.chart = null
        }
        
        const ctx = canvas.getContext('2d')
        
        chartInstance = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: last30Days,
                     datasets: [{
                       label: 'Prescriptions',
                       data: prescriptionsPerDay,
                       backgroundColor: 'rgba(59, 130, 246, 0.8)', // blue-500 with opacity
                       borderColor: 'rgba(59, 130, 246, 1)', // blue-500
                       borderWidth: 1,
                       borderRadius: 4,
                       borderSkipped: false,
                     }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              },
                       tooltip: {
                         backgroundColor: 'rgba(31, 41, 55, 0.9)', // gray-800 with opacity
                         titleColor: '#f9fafb', // gray-50
                         bodyColor: '#f9fafb', // gray-50
                         borderColor: 'rgba(59, 130, 246, 1)', // blue-500
                         borderWidth: 1,
                         cornerRadius: 6,
                         displayColors: false,
                callbacks: {
                  title: function(context) {
                    return context[0].label
                  },
                  label: function(context) {
                    return `${context.parsed.y} prescription${context.parsed.y !== 1 ? 's' : ''}`
                  }
                }
              }
            },
            scales: {
              x: {
                grid: {
                  display: false
                },
                         ticks: {
                           color: '#6b7280', // gray-500
                           font: {
                             size: 10
                           },
                           maxRotation: 45,
                           minRotation: 0,
                           maxTicksLimit: 15
                         }
              },
              y: {
                beginAtZero: true,
                grid: {
                  color: 'rgba(31, 41, 55, 0.1)', // gray-800 with low opacity
                  drawBorder: false
                },
                ticks: {
                  color: '#6b7280', // gray-500
                  font: {
                    size: 11
                  },
                  stepSize: 1,
                  callback: function(value) {
                    return Number.isInteger(value) ? value : ''
                  }
                }
              }
            },
            interaction: {
              intersect: false,
              mode: 'index'
            },
            animation: {
              duration: 750,
              easing: 'easeInOutQuart'
            }
          }
        })
        
        // Store chart reference on canvas for cleanup
        canvas.chart = chartInstance
        
      }, 200)
      
    } catch (error) {
      console.error('Error creating prescriptions chart:', error)
    }
  }
  
  // Load medical data for selected patient
  const loadMedicalData = async (patientId) => {
    try {
      console.log('Loading medical data for patient:', patientId)
      
      // Load illnesses
      illnesses = await firebaseStorage.getIllnessesByPatientId(patientId) || []
      console.log('Loaded illnesses:', illnesses.length)
      
      // Load prescriptions
      prescriptions = await firebaseStorage.getPrescriptionsByPatientId(patientId) || []
      console.log('Loaded prescriptions:', prescriptions.length)
      
      // Load symptoms
      symptoms = await firebaseStorage.getSymptomsByPatientId(patientId) || []
      console.log('Loaded symptoms:', symptoms.length)
      
    } catch (error) {
      console.error('Error loading medical data:', error)
      // Ensure arrays are always defined
      illnesses = []
      prescriptions = []
      symptoms = []
    }
  }

  // Select a patient
  const selectPatient = (patient) => {
    selectedPatient = patient
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
        alert('User not authenticated')
        return
      }

      // Get the doctor ID from Firebase using email
      const doctor = await firebaseStorage.getDoctorByEmail(user.email)
      if (!doctor) {
        alert('Doctor profile not found. Please try logging in again.')
        return
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
      
      alert('Template settings saved successfully!')
      
    } catch (error) {
      console.error('❌ Error saving template settings:', error)
      alert('Error saving template settings. Please try again.')
    }
  }
  
  onMount(() => {
    loadPatients()
    loadTemplateSettings() // Load saved template settings
    // Create chart after a short delay to ensure DOM is ready
    setTimeout(() => {
      createPrescriptionsChart()
    }, 500)
  })
  
  // Cleanup chart instance when component is destroyed
  onDestroy(() => {
    if (chartInstance) {
      chartInstance.destroy()
      chartInstance = null
    }
  })
</script>

<!-- Navigation Tabs -->
<div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
  <div class="p-3">
    <div class="flex rounded-lg border border-gray-200 bg-gray-100 p-1" role="group" aria-label="View selection">
      <button 
        class="flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 {currentView === 'patients' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
        on:click={() => currentView = 'patients'}
      >
        <i class="fas fa-users mr-2"></i>
        <span class="hidden sm:inline">Patients</span>
        <span class="sm:hidden">Patients</span>
      </button>
      <button 
        class="flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 {currentView === 'pharmacists' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
        on:click={() => currentView = 'pharmacists'}
      >
        <i class="fas fa-pills mr-2"></i>
        <span class="hidden sm:inline">Pharmacists</span>
        <span class="sm:hidden">Pharmacists</span>
      </button>
    </div>
  </div>
</div>

{#if currentView === 'patients'}
<div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
  <!-- Patient List Sidebar -->
  <div class="lg:col-span-4">
    <!-- Patients Card -->
    <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm mb-3">
      <!-- Fixed Header -->
      <div class="px-3 py-4 border-b border-gray-200">
        <div class="flex justify-between items-center mb-3">
          <h5 class="text-lg font-semibold text-gray-900 mb-0">
            <i class="fas fa-users text-teal-600 mr-2"></i>
            Patients
          </h5>
          <button 
            class="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200" 
            on:click={showAddPatientForm}
          >
            <i class="fas fa-plus mr-1"></i>
            <span class="hidden sm:inline">Add Patient</span>
            <span class="sm:hidden">Add</span>
          </button>
        </div>
        
        <!-- Search Bar -->
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i class="fas fa-search text-gray-400"></i>
          </div>
          <input 
            type="text" 
            class="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
            placeholder="Search patients..."
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
          <div class="mt-2">
            <small class="text-gray-500">
              <i class="fas fa-info-circle mr-1"></i>
              Showing {filteredPatients.length} of {patients.filter(p => {
                const query = searchQuery.toLowerCase().trim()
                const fullName = `${p.firstName} ${p.lastName}`.toLowerCase()
                return fullName.includes(query) || 
                       p.firstName.toLowerCase().includes(query) || 
                       p.lastName.toLowerCase().includes(query) || 
                       p.idNumber.toLowerCase().includes(query) || 
                       p.email.toLowerCase().includes(query) || 
                       (p.phone && p.phone.toLowerCase().includes(query)) ||
                       (p.dateOfBirth && p.dateOfBirth.includes(query))
              }).length} patient{filteredPatients.length !== 1 ? 's' : ''} matching "{searchQuery}"
              {#if patients.filter(p => {
                const query = searchQuery.toLowerCase().trim()
                const fullName = `${p.firstName} ${p.lastName}`.toLowerCase()
                return fullName.includes(query) || 
                       p.firstName.toLowerCase().includes(query) || 
                       p.lastName.toLowerCase().includes(query) || 
                       p.idNumber.toLowerCase().includes(query) || 
                       p.email.toLowerCase().includes(query) || 
                       (p.phone && p.phone.toLowerCase().includes(query)) ||
                       (p.dateOfBirth && p.dateOfBirth.includes(query))
              }).length > 20}
                <br><small class="text-yellow-600">
                  <i class="fas fa-exclamation-triangle mr-1"></i>
                  Showing first 20 results. Refine your search for more specific results.
                </small>
              {/if}
            </small>
          </div>
        {/if}
      </div>
      
      <!-- Scrollable Content Area -->
      <div class="overflow-auto max-h-80">
        {#if searchQuery}
          {#if loading}
            <div class="text-center p-4">
              <svg class="animate-spin h-8 w-8 text-teal-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p class="text-gray-500">Loading patients...</p>
            </div>
          {:else if filteredPatients.length === 0}
            <div class="text-center p-4 text-gray-500">
              <i class="fas fa-search fa-2x mb-2"></i>
              <p>No patients found matching "{searchQuery}"</p>
              <button class="bg-teal-100 hover:bg-teal-200 text-teal-700 px-3 py-1 rounded text-sm font-medium transition-colors duration-200" on:click={clearSearch}>
                <i class="fas fa-times mr-1"></i>Clear Search
              </button>
            </div>
          {:else}
            <div class="divide-y divide-gray-200">
              {#each filteredPatients as patient}
                <button 
                  class="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-200 {selectedPatient?.id === patient.id ? 'bg-teal-50 border-l-4 border-teal-500' : ''}"
                  on:click={() => selectPatient(patient)}
                >
                  <div class="flex justify-between items-center">
                    <div class="flex-1">
                      <h6 class="text-sm font-medium text-gray-900 mb-1">
                        <i class="fas fa-user text-gray-400 mr-2"></i>
                        {patient.firstName} {patient.lastName}
                      </h6>
                    </div>
                    <div class="text-right">
                      <small class="text-gray-500">
                        <i class="fas fa-calendar mr-1"></i>
                        {#if patient.age && patient.age !== '' && !isNaN(patient.age)}
                          {patient.age} years
                        {:else if patient.dateOfBirth}
                          {(() => {
                            const birthDate = new Date(patient.dateOfBirth)
                            if (!isNaN(birthDate.getTime())) {
                              const today = new Date()
                              const age = today.getFullYear() - birthDate.getFullYear()
                              const monthDiff = today.getMonth() - birthDate.getMonth()
                              const calculatedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age
                              return calculatedAge + ' years'
                            }
                            return 'Age not specified'
                          })()}
                        {:else}
                          Age not specified
                        {/if}
                      </small>
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        {:else if !selectedPatient}
          {#if loading}
            <div class="text-center p-4">
              <svg class="animate-spin h-8 w-8 text-teal-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p class="text-gray-500">Loading patients...</p>
            </div>
          {:else if filteredPatients.length === 0}
            <div class="text-center p-4 text-gray-500">
              <i class="fas fa-user-plus fa-2x mb-2"></i>
              <p>No patients yet. Add your first patient!</p>
              <button class="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200" on:click={showAddPatientForm}>
                <i class="fas fa-plus mr-1"></i>Get Started
              </button>
            </div>
          {:else}
            <div class="divide-y divide-gray-200">
              {#each filteredPatients as patient}
                <button 
                  class="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-200 {selectedPatient?.id === patient.id ? 'bg-teal-50 border-l-4 border-teal-500' : ''}"
                  on:click={() => selectPatient(patient)}
                >
                  <div class="flex justify-between items-center">
                    <div class="flex-1">
                      <h6 class="text-sm font-medium text-gray-900 mb-1">
                        <i class="fas fa-user text-gray-400 mr-2"></i>
                        {patient.firstName} {patient.lastName}
                      </h6>
                    </div>
                    <div class="text-right">
                      <small class="text-gray-500">
                        <i class="fas fa-calendar mr-1"></i>
                        {#if patient.age && patient.age !== '' && !isNaN(patient.age)}
                          {patient.age} years
                        {:else if patient.dateOfBirth}
                          {(() => {
                            const birthDate = new Date(patient.dateOfBirth)
                            if (!isNaN(birthDate.getTime())) {
                              const today = new Date()
                              const age = today.getFullYear() - birthDate.getFullYear()
                              const monthDiff = today.getMonth() - birthDate.getMonth()
                              const calculatedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age
                              return calculatedAge + ' years'
                            }
                            return 'Age not specified'
                          })()}
                        {:else}
                          Age not specified
                        {/if}
                      </small>
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        {:else}
          <!-- Empty space when patient is selected and no search -->
        {/if}
      </div>
    </div>
    
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
          doctorId={user?.uid || user?.id} 
          currentUser={user}
          on:dataUpdated={handleDataUpdated}
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
                           <div class="flex justify-between items-center">
                             <div class="flex items-center">
                               <h4 class="text-xl font-bold text-gray-900 mb-1 mr-3 cursor-pointer hover:text-teal-600 transition-colors duration-200" on:click={handleEditProfile} title="Click to edit profile">
                                  Welcome, Dr. {doctorName}! 🚀 UPDATED
                               </h4>
                               <button class="p-1 text-gray-400 hover:text-red-500 transition-colors duration-200" on:click={handleEditProfile} title="Edit Profile Settings">
                                 <i class="fas fa-cog text-sm"></i>
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
        <div class="bg-white border-2 border-blue-500 text-blue-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 h-full transform hover:scale-105 hover:bg-blue-50">
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
        <div class="bg-white border-2 border-orange-500 text-orange-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 h-full transform hover:scale-105 hover:bg-orange-50">
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
        <div class="bg-white border-2 border-green-500 text-green-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 h-full transform hover:scale-105 hover:bg-green-50">
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
        <div class="bg-white border-2 border-purple-500 text-purple-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 h-full transform hover:scale-105 hover:bg-purple-50">
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
              <div class="relative w-full" style="height: 250px;">
                <canvas id="prescriptionsChart" class="rounded"></canvas>
              </div>
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
                  <i class="fas fa-cog me-2 fa-sm"></i>
                  Settings
                </h6>
                <button class="inline-flex items-center px-3 py-2 border border-white text-white bg-transparent hover:bg-white hover:text-teal-600 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-teal-600 transition-colors duration-200" on:click={handleProfileCancel}>
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
                        <i class="fas fa-info-circle me-1"></i>
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
                          <i class="fas fa-exclamation-triangle me-1"></i>
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
                          <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
                      <i class="fas fa-file-medical me-2"></i>
                      Prescription Template Settings
                    </h6>
                    <p class="text-muted small mb-4">Choose how you want your prescription header to appear on printed prescriptions.</p>
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
                                <div class="flex-grow">
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
                                      <div class="text-center text-muted">
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
                                      <div class="col-6 text-end">
                                        <strong>Date:</strong> [Date]
                                      </div>
                                    </div>
                                    <div class="row mb-2">
                                      <div class="col-6">
                                        <strong>Age:</strong> [Age]
                                      </div>
                                      <div class="col-6 text-end">
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
                                        <div class="small text-muted">Instructions and notes here</div>
                                      </div>
                                    </div>
                                    <div class="signature-area border-top pt-2 mt-3">
                                      <div class="row">
                                        <div class="col-6">
                                          <strong>Doctor's Signature:</strong> _______________
                                        </div>
                                        <div class="col-6 text-end">
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
                                <div class="flex-grow">
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
                              <i class="fas fa-info-circle me-1"></i>
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
                                        <div class="text-center text-muted" style="background: rgba(255,255,255,0.8); padding: 0.5rem; border-radius: 0.25rem;">
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
                                        <div class="col-6 text-end">
                                          <strong>Date:</strong> [Date]
                                        </div>
                                      </div>
                                      <div class="row mb-2">
                                        <div class="col-6">
                                          <strong>Age:</strong> [Age]
                                        </div>
                                        <div class="col-6 text-end">
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
                                          <div class="small text-muted">Instructions and notes here</div>
                                        </div>
                                      </div>
                                      <div class="signature-area border-top pt-2 mt-3">
                                        <div class="row">
                                          <div class="col-6">
                                            <strong>Doctor's Signature:</strong> _______________
                                          </div>
                                          <div class="col-6 text-end">
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
                                <div class="flex-grow">
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
{:else}
<!-- Pharmacist Management View -->
<PharmacistManagement {user} />
{/if}

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