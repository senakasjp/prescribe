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
                       backgroundColor: 'rgba(var(--bs-primary-rgb), 0.8)',
                       borderColor: 'rgba(var(--bs-primary-rgb), 1)',
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
                         backgroundColor: 'rgba(var(--bs-dark-rgb), 0.8)',
                         titleColor: 'var(--bs-light)',
                         bodyColor: 'var(--bs-light)',
                         borderColor: 'rgba(var(--bs-primary-rgb), 1)',
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
                           color: 'var(--bs-secondary)',
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
                  color: 'rgba(var(--bs-dark-rgb), 0.1)',
                  drawBorder: false
                },
                ticks: {
                  color: 'var(--bs-secondary)',
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
<div class="card mb-3">
  <div class="card-body py-2 px-2 px-md-3">
    <ul class="nav nav-pills nav-fill">
      <li class="nav-item">
        <button 
          class="nav-link {currentView === 'patients' ? 'active' : ''} btn-sm"
          on:click={() => currentView = 'patients'}
        >
          <i class="fas fa-users me-1 me-md-2"></i>
          <span class="d-none d-sm-inline">Patients</span>
          <span class="d-sm-none">Patients</span>
        </button>
      </li>
      <li class="nav-item">
        <button 
          class="nav-link {currentView === 'pharmacists' ? 'active' : ''} btn-sm"
          on:click={() => currentView = 'pharmacists'}
        >
          <i class="fas fa-pills me-1 me-md-2"></i>
          <span class="d-none d-sm-inline">Pharmacists</span>
          <span class="d-sm-none">Pharmacy</span>
        </button>
      </li>
    </ul>
  </div>
</div>

{#if currentView === 'patients'}
<div class="row g-3">
  <!-- Patient List Sidebar -->
  <div class="col-12 col-lg-4">
    <!-- Patients Card -->
    <div class="card border-2 border-info mb-3 shadow-sm">
      <!-- Fixed Header -->
      <div class="card-header px-2 px-md-3">
        <div class="d-flex justify-content-between align-items-center mb-2 mb-md-3">
          <h5 class="mb-0 fs-6 fs-md-5">
            <i class="fas fa-users me-1 me-md-2"></i>
            <span class="d-none d-sm-inline">Patients</span>
            <span class="d-sm-none">Patients</span>
          </h5>
          <button 
            class="btn btn-primary btn-sm" 
            on:click={showAddPatientForm}
          >
            <i class="fas fa-plus me-1"></i>
            <span class="d-none d-sm-inline">Add Patient</span>
            <span class="d-sm-none">Add</span>
          </button>
        </div>
        
        <!-- Search Bar -->
        <div class="input-group input-group-sm">
          <span class="input-group-text">
            <i class="fas fa-search"></i>
          </span>
          <input 
            type="text" 
            class="form-control" 
            placeholder="Search patients..."
            bind:value={searchQuery}
          >
          {#if searchQuery}
            <button 
              class="btn btn-outline-secondary btn-sm" 
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
            <small class="text-muted">
              <i class="fas fa-info-circle me-1"></i>
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
                <br><small class="text-warning">
                  <i class="fas fa-exclamation-triangle me-1"></i>
                  Showing first 20 results. Refine your search for more specific results.
                </small>
              {/if}
            </small>
          </div>
        {/if}
      </div>
      
      <!-- Scrollable Content Area -->
      <div class="card-body p-0 overflow-auto" style="max-height: 300px;">
        {#if searchQuery}
          {#if loading}
            <div class="text-center p-3">
              <i class="fas fa-spinner fa-spin fa-2x text-primary mb-2"></i>
              <p class="text-muted">Loading patients...</p>
            </div>
          {:else if filteredPatients.length === 0}
            <div class="text-center p-3 text-muted">
              <i class="fas fa-search fa-2x mb-2"></i>
              <p>No patients found matching "{searchQuery}"</p>
              <button class="btn btn-outline-primary btn-sm" on:click={clearSearch}>
                <i class="fas fa-times me-1"></i>Clear Search
              </button>
            </div>
          {:else}
            <div class="list-group list-group-flush">
              {#each filteredPatients as patient}
                <button 
                  class="list-group-item list-group-item-action {selectedPatient?.id === patient.id ? 'active' : ''}"
                  on:click={() => selectPatient(patient)}
                >
                  <div class="d-flex w-100 justify-content-between align-items-center">
                    <div class="flex-grow-1">
                      <h6 class="mb-1">
                        <i class="fas fa-user me-1"></i>
                        {patient.firstName} {patient.lastName}
                      </h6>
                    </div>
                    <div class="text-end">
                      <small class="text-muted">
                        <i class="fas fa-calendar me-1"></i>
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
            <div class="text-center p-3">
              <i class="fas fa-spinner fa-spin fa-2x text-primary mb-2"></i>
              <p class="text-muted">Loading patients...</p>
            </div>
          {:else if filteredPatients.length === 0}
            <div class="text-center p-3 text-muted">
              <i class="fas fa-user-plus fa-2x mb-2"></i>
              <p>No patients yet. Add your first patient!</p>
              <button class="btn btn-primary btn-sm" on:click={showAddPatientForm}>
                <i class="fas fa-plus me-1"></i>Get Started
              </button>
            </div>
          {:else}
            <div class="list-group list-group-flush">
              {#each filteredPatients as patient}
                <button 
                  class="list-group-item list-group-item-action {selectedPatient?.id === patient.id ? 'active' : ''}"
                  on:click={() => selectPatient(patient)}
                >
                  <div class="d-flex w-100 justify-content-between align-items-center">
                    <div class="flex-grow-1">
                      <h6 class="mb-1">
                        <i class="fas fa-user me-1"></i>
                        {patient.firstName} {patient.lastName}
                      </h6>
                    </div>
                    <div class="text-end">
                      <small class="text-muted">
                        <i class="fas fa-calendar me-1"></i>
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
    <div class="col-12 col-lg-8">
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
      <div class="row g-3">
                 <!-- Welcome Message -->
                 <div class="col-12" key={userKey}>
                   <div class="card border-2 border-info shadow-sm">
                     <div class="card-body bg-transparent text-dark rounded-3">
                       <div class="d-flex align-items-center">
                         <div class="flex-shrink-0">
                           <i class="fas fa-user-md fa-2x text-primary"></i>
                         </div>
                         <div class="flex-grow-1 ms-3">
                           <div class="d-flex justify-content-between align-items-center">
                             <div class="d-flex align-items-center">
                               <h4 class="card-title mb-1 fw-bold text-dark me-2" style="cursor: pointer;" on:click={handleEditProfile} title="Click to edit profile">
                                 Welcome, Dr. {doctorName}!
                               </h4>
                               <button class="btn btn-link p-1" on:click={handleEditProfile} title="Edit Profile Settings" data-bs-toggle="tooltip" data-bs-placement="bottom">
                                 <i class="fas fa-cog text-danger fa-sm"></i>
                               </button>
                             </div>
                           </div>
                           <p class="card-text mb-0 text-muted">
                             Ready to provide excellent patient care with AI-powered assistance
                           </p>
                           <!-- Added Country Information -->
                           <p class="card-text mt-2 mb-0 text-muted small">
                             <i class="fas fa-map-marker-alt me-1"></i>
                             Location: {doctorCity || 'Not specified'}, {doctorCountry || 'Not specified'}
                           </p>
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
        
        {#if !editingProfile}
        <!-- Statistics Cards -->
        <div class="col-6 col-md-4">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body bg-info text-white rounded-3 p-2 p-md-3">
              <div class="d-flex align-items-center">
                <div class="flex-shrink-0">
                  <div class="bg-white bg-opacity-25 rounded-circle p-1 p-md-2">
                    <i class="fas fa-users fa-sm fa-md-lg"></i>
                  </div>
                </div>
                <div class="flex-grow-1 ms-2 ms-md-3">
                  <h4 class="card-title mb-0 fw-bold fs-5 fs-md-4" id="totalPatients">{patients.length}</h4>
                  <small class="opacity-75 d-none d-sm-block">Patients Registered</small>
                  <small class="opacity-75 d-sm-none">Patients</small>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="col-6 col-md-4">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body bg-warning text-dark rounded-3 p-2 p-md-3">
              <div class="d-flex align-items-center">
                <div class="flex-shrink-0">
                  <div class="bg-white bg-opacity-25 rounded-circle p-1 p-md-2">
                    <i class="fas fa-prescription fa-sm fa-md-lg"></i>
                  </div>
                </div>
                <div class="flex-grow-1 ms-2 ms-md-3">
                  <h4 class="card-title mb-0 fw-bold fs-5 fs-md-4" id="totalPrescriptions">{totalPrescriptions}</h4>
                  <small class="opacity-75 d-none d-sm-block">Total Prescriptions</small>
                  <small class="opacity-75 d-sm-none">Prescriptions</small>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="col-6 col-md-4">
          <div class="card border border-light shadow-sm h-100">
            <div class="card-body bg-secondary text-white rounded-3 p-2 p-md-3">
              <div class="d-flex align-items-center">
                <div class="flex-shrink-0">
                  <div class="bg-white bg-opacity-25 rounded-circle p-1 p-md-2">
                    <i class="fas fa-pills fa-sm fa-md-lg"></i>
                  </div>
                </div>
                <div class="flex-grow-1 ms-2 ms-md-3">
                  <h4 class="card-title mb-0 fw-bold fs-5 fs-md-4" id="totalDrugs">{totalDrugs}</h4>
                  <small class="opacity-75 d-none d-sm-block">Total Drugs</small>
                  <small class="opacity-75 d-sm-none">Drugs</small>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="col-6 col-md-4">
          <div class="card border border-light shadow-sm h-100">
            <div class="card-body bg-success text-white rounded-3 p-2 p-md-3">
              <div class="d-flex align-items-center">
                <div class="flex-shrink-0">
                  <div class="bg-white bg-opacity-25 rounded-circle p-1 p-md-2">
                    <i class="fas fa-store fa-sm fa-md-lg"></i>
                  </div>
                </div>
                <div class="flex-grow-1 ms-2 ms-md-3">
                  <h4 class="card-title mb-0 fw-bold fs-5 fs-md-4" id="connectedPharmacies">{connectedPharmacies}</h4>
                  <small class="opacity-75 d-none d-sm-block">Connected Pharmacies</small>
                  <small class="opacity-75 d-sm-none">Pharmacies</small>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Prescriptions Per Day Chart -->
        <div class="col-12">
          <div class="card border border-light shadow-sm">
            <div class="card-header bg-light border-0 py-2 py-md-3 px-2 px-md-3">
              <h6 class="card-title mb-0 fw-bold text-dark fs-6 fs-md-5">
                <i class="fas fa-chart-line me-1 me-md-2 text-primary"></i>
                <span class="d-none d-sm-inline">Prescriptions Per Day (Last 30 Days)</span>
                <span class="d-sm-none">Prescriptions Per Day</span>
              </h6>
            </div>
            <div class="card-body p-2 p-md-4">
              <div class="chart-container position-relative w-100" style="height: 250px;">
                <canvas id="prescriptionsChart" class="rounded"></canvas>
              </div>
            </div>
          </div>
        </div>
        {/if}
        
        {#if editingProfile}
        <!-- Inline Tabbed Profile Editing Interface -->
        <div class="col-12">
          <div class="card border-0 shadow-sm">
            <div class="card-header bg-primary text-white">
              <div class="d-flex justify-content-between align-items-center">
                <h6 class="card-title mb-0">
                  <i class="fas fa-cog me-2 fa-sm"></i>
                  Settings
                </h6>
                <button class="btn btn-outline-light btn-sm" on:click={handleProfileCancel}>
                  <i class="fas fa-times fa-sm"></i>
                </button>
              </div>
            </div>
            
            <!-- Tab Navigation -->
            <div class="card-body p-0">
              <ul class="nav nav-tabs nav-fill" id="settingsTabs" role="tablist">
                <li class="nav-item" role="presentation">
                  <button 
                    class="nav-link {activeTab === 'edit-profile' ? 'active' : ''} btn-sm" 
                    id="edit-profile-tab" 
                    type="button" 
                    role="tab" 
                    aria-controls="edit-profile" 
                    aria-selected={activeTab === 'edit-profile'}
                    on:click={() => switchTab('edit-profile')}
                  >
                    <i class="fas fa-user-edit me-2 fa-sm"></i>
                    Edit Profile
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button 
                    class="nav-link {activeTab === 'prescription-template' ? 'active' : ''} btn-sm" 
                    id="prescription-template-tab" 
                    type="button" 
                    role="tab" 
                    aria-controls="prescription-template" 
                    aria-selected={activeTab === 'prescription-template'}
                    on:click={() => switchTab('prescription-template')}
                  >
                    <i class="fas fa-file-medical me-2 fa-sm"></i>
                    Prescription Template
                  </button>
                </li>
              </ul>
              
              <!-- Tab Content -->
              <div class="tab-content p-3" id="settingsTabContent">
                <!-- Edit Profile Tab -->
                {#if activeTab === 'edit-profile'}
                <div class="tab-pane fade show active" id="edit-profile" role="tabpanel" aria-labelledby="edit-profile-tab">
                  <form on:submit={handleProfileSubmit}>
                    <div class="row mb-3">
                      <div class="col-md-6">
                        <label for="editFirstName" class="form-label">
                          First Name <span class="text-danger">*</span>
                        </label>
                        <input 
                          type="text" 
                          class="form-control form-control-sm" 
                          id="editFirstName"
                          bind:value={editFirstName}
                          placeholder="Enter your first name"
                          required
                          disabled={profileLoading}
                        />
                      </div>
                      <div class="col-md-6">
                        <label for="editLastName" class="form-label">
                          Last Name <span class="text-danger">*</span>
                        </label>
                        <input 
                          type="text" 
                          class="form-control form-control-sm" 
                          id="editLastName"
                          bind:value={editLastName}
                          placeholder="Enter your last name"
                          required
                          disabled={profileLoading}
                        />
                      </div>
                    </div>

                    <div class="mb-3">
                      <label for="editEmail" class="form-label">Email Address</label>
                      <input 
                        type="email" 
                        class="form-control form-control-sm" 
                        id="editEmail"
                        value={user?.email || ''}
                        disabled
                        readonly
                      />
                      <div class="form-text">
                        <i class="fas fa-info-circle me-1"></i>
                        Email cannot be changed for security reasons
                      </div>
                    </div>

                    <div class="mb-3">
                      <label for="editCountry" class="form-label">
                        Country <span class="text-danger">*</span>
                      </label>
                      <select 
                        class="form-select form-select-sm" 
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
                      <label for="editCity" class="form-label">
                        City <span class="text-danger">*</span>
                      </label>
                      <select 
                        class="form-select form-select-sm" 
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
                        <div class="form-text text-warning">
                          <i class="fas fa-exclamation-triangle me-1"></i>
                          No cities available for the selected country. Please contact support.
                        </div>
                      {/if}
                    </div>

                    {#if profileError}
                      <div class="alert alert-danger" role="alert">
                        <i class="fas fa-exclamation-triangle me-2"></i>{profileError}
                      </div>
                    {/if}

                    <div class="d-flex justify-content-end gap-2">
                      <button 
                        type="button" 
                        class="btn btn-outline-secondary btn-sm" 
                        on:click={handleProfileCancel}
                        disabled={profileLoading}
                      >
                        <i class="fas fa-times me-1 fa-sm"></i>
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        class="btn btn-primary btn-sm"
                        disabled={profileLoading}
                      >
                        {#if profileLoading}
                          <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                        {/if}
                        <i class="fas fa-save me-1 fa-sm"></i>
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
                {/if}
                
                <!-- Prescription Template Tab -->
                {#if activeTab === 'prescription-template'}
                <div class="tab-pane fade show active" id="prescription-template" role="tabpanel" aria-labelledby="prescription-template-tab">
                  <div class="mb-4">
                    <h6 class="fw-bold mb-3">
                      <i class="fas fa-file-medical me-2"></i>
                      Prescription Template Settings
                    </h6>
                    <p class="text-muted small mb-4">Choose how you want your prescription header to appear on printed prescriptions.</p>
                  </div>
                  
                  <!-- Template Type Selection -->
                  <div class="row mb-4">
                    <div class="col-12">
                      <label class="form-label fw-semibold mb-3">Select Template Type:</label>
                      
                      <!-- Option 1: Printed Letterheads -->
                      {#if templateType !== 'upload'}
                      <div class="card mb-3 border {templateType === 'printed' ? 'border-primary' : ''}">
                        <div class="card-body p-3">
                          <div class="form-check">
                            <input 
                              class="form-check-input" 
                              type="radio" 
                              name="templateType" 
                              id="templatePrinted" 
                              value="printed"
                              bind:group={templateType}
                              on:change={() => selectTemplateType('printed')}
                            />
                            <label class="form-check-label w-100" for="templatePrinted">
                              <div class="d-flex align-items-center">
                                <div class="flex-shrink-0 me-3">
                                  <i class="fas fa-print fa-2x text-primary"></i>
                                </div>
                                <div class="flex-grow-1">
                                  <h6 class="mb-1">I have printed A3 letterheads</h6>
                                  <p class="text-muted small mb-0">Use your existing printed letterhead paper for prescriptions. No header will be added to the PDF.</p>
                                </div>
                              </div>
                            </label>
                          </div>
                          
                          {#if templateType === 'printed'}
                          <div class="mt-3">
                            <label class="form-label small">Header Size Adjustment:</label>
                            <div class="row align-items-center">
                              <div class="col-8">
                                <input 
                                  type="range" 
                                  class="form-range" 
                                  min="50" 
                                  max="300" 
                                  step="10"
                                  bind:value={headerSize}
                                />
                              </div>
                              <div class="col-4">
                                <span class="badge bg-primary">{headerSize}px</span>
                              </div>
                            </div>
                            <div class="form-text">
                              <i class="fas fa-info-circle me-1"></i>
                              Adjust the header space to match your printed letterhead height.
                            </div>
                            
                            <!-- Template Preview -->
                            <div class="mt-3">
                              <label class="form-label small">Template Preview:</label>
                              <div class="border rounded p-2 bg-light">
                                <div class="template-preview">
                                  <!-- Header Space (representing printed letterhead) -->
                                  <div 
                                    class="header-space border-bottom border-2 border-primary mb-3"
                                    style="height: {headerSize}px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);"
                                  >
                                    <div class="d-flex align-items-center justify-content-center h-100">
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
                                        <div class="d-flex justify-content-between">
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
                      <div class="card mb-3 border {templateType === 'upload' ? 'border-primary' : ''}">
                        <div class="card-body p-3">
                          <div class="form-check">
                            <input 
                              class="form-check-input" 
                              type="radio" 
                              name="templateType" 
                              id="templateUpload" 
                              value="upload"
                              bind:group={templateType}
                              on:change={() => selectTemplateType('upload')}
                            />
                            <label class="form-check-label w-100" for="templateUpload">
                              <div class="d-flex align-items-center">
                                <div class="flex-shrink-0 me-3">
                                  <i class="fas fa-image fa-2x text-success"></i>
                                </div>
                                <div class="flex-grow-1">
                                  <h6 class="mb-1">I want to upload an image for header</h6>
                                  <p class="text-muted small mb-0">Upload your custom header image to be used on all prescriptions.</p>
                                </div>
                              </div>
                            </label>
                          </div>
                          
                          {#if templateType === 'upload'}
                          <div class="mt-3">
                            <input 
                              type="file" 
                              class="form-control form-control-sm" 
                              accept="image/*"
                              on:change={handleHeaderUpload}
                            />
                            <div class="form-text">
                              <i class="fas fa-info-circle me-1"></i>
                              Supported formats: JPG, PNG, GIF. Recommended size: 800x200 pixels.
                            </div>
                            
                            {#if uploadedHeader}
                            <div class="mt-3">
                              <label class="form-label small">Header Size Adjustment:</label>
                              <div class="row align-items-center">
                                <div class="col-8">
                                  <input 
                                    type="range" 
                                    class="form-range" 
                                    min="50" 
                                    max="300" 
                                    step="10"
                                    bind:value={headerSize}
                                  />
                                </div>
                                <div class="col-4">
                                  <span class="badge bg-primary">{headerSize}px</span>
                                </div>
                              </div>
                              <div class="form-text">
                                <i class="fas fa-info-circle me-1"></i>
                                Adjust the header space to match your uploaded image height.
                              </div>
                              
                              <!-- Template Preview with Uploaded Image -->
                              <div class="mt-3">
                                <label class="form-label small">Template Preview:</label>
                                <div class="border rounded p-2 bg-light">
                                  <div class="template-preview">
                                    <!-- Header Space with Uploaded Image -->
                                    <div 
                                      class="header-space border-bottom border-2 border-primary mb-3"
                                      style="height: {headerSize}px; background-image: url('{uploadedHeader}'); background-size: contain; background-repeat: no-repeat; background-position: center;"
                                    >
                                      <div class="d-flex align-items-center justify-content-center h-100">
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
                                          <div class="d-flex justify-content-between">
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
                      <div class="card mb-3 border {templateType === 'system' ? 'border-primary' : ''}">
                        <div class="card-body p-3">
                          <div class="form-check">
                            <input 
                              class="form-check-input" 
                              type="radio" 
                              name="templateType" 
                              id="templateSystem" 
                              value="system"
                              bind:group={templateType}
                              on:change={() => selectTemplateType('system')}
                            />
                            <label class="form-check-label w-100" for="templateSystem">
                              <div class="d-flex align-items-center">
                                <div class="flex-shrink-0 me-3">
                                  <i class="fas fa-cog fa-2x text-info"></i>
                                </div>
                                <div class="flex-grow-1">
                                  <h6 class="mb-1">I want system to add header for template</h6>
                                  <p class="text-muted small mb-0">Use a system-generated header with your practice information.</p>
                                </div>
                              </div>
                            </label>
                          </div>
                          
                          {#if templateType === 'system'}
                          <div class="mt-3">
                            <button 
                              type="button" 
                              class="btn btn-outline-info btn-sm"
                              on:click={generateSystemHeader}
                            >
                              <i class="fas fa-eye me-2"></i>
                              Preview System Header
                            </button>
                            
                            {#if templatePreview && templatePreview.type === 'system'}
                            <div class="mt-3">
                              <label class="form-label small">System Header Preview:</label>
                              <div class="border rounded p-3 bg-light">
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
                  <div class="d-flex justify-content-end gap-2">
                    <button 
                      type="button" 
                      class="btn btn-outline-secondary btn-sm" 
                      on:click={handleProfileCancel}
                    >
                      <i class="fas fa-times me-1 fa-sm"></i>
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      class="btn btn-primary btn-sm"
                      on:click={saveTemplateSettings}
                      disabled={!templateType}
                    >
                      <i class="fas fa-save me-1 fa-sm"></i>
                      Save Template Settings
                    </button>
                  </div>
                </div>
                {/if}
              </div>
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

  .form-range {
    height: 0.5rem;
  }

  .form-range::-webkit-slider-thumb {
    width: 1.2rem;
    height: 1.2rem;
    background: var(--bs-primary);
    border-radius: 50%;
  }

  .form-range::-moz-range-thumb {
    width: 1.2rem;
    height: 1.2rem;
    background: var(--bs-primary);
    border-radius: 50%;
    border: none;
  }
</style>