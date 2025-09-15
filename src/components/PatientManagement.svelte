<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import jsonStorage from '../services/jsonStorage.js'
  import PatientForm from './PatientForm.svelte'
  import PatientDetails from './PatientDetails.svelte'
  import PatientList from './PatientList.svelte'
  import MedicalSummary from './MedicalSummary.svelte'
  import PharmacistManagement from './PharmacistManagement.svelte'
  import { Chart, registerables } from 'chart.js'
  
  // Register Chart.js components
  Chart.register(...registerables)
  
  const dispatch = createEventDispatcher()
  export let user
  
  // Reactive statement to ensure component updates when user changes
  $: userKey = user?.id || user?.email || 'default'
  
  // Reactive statement to log user changes for debugging
  $: if (user) {
    console.log('PatientManagement: User updated:', user)
    console.log('PatientManagement: User country:', user.country)
    console.log('PatientManagement: User name:', user.name)
    console.log('PatientManagement: User firstName:', user.firstName)
    console.log('PatientManagement: User lastName:', user.lastName)
    console.log('PatientManagement: User email:', user.email)
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
  
  // Reactive statements to ensure component updates when data changes
  $: if (selectedPatient) {
    loadMedicalData(selectedPatient.id)
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
      patients = await jsonStorage.getPatients()
      filteredPatients = [...patients]
      console.log('Loaded patients:', patients.length)
    } catch (error) {
      console.error('Error loading patients:', error)
      patients = []
      filteredPatients = []
    } finally {
      loading = false
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
      if (!user) {
        console.error('No user found for adding patient')
        return
      }
      
      // Get doctor ID from user object (handle both Firebase and localStorage formats)
      const doctorId = user.uid || user.id || user.email
      
      if (!doctorId) {
        console.error('No valid doctor ID found in user object:', user)
        return
      }
      
      console.log('Adding patient with doctor ID:', doctorId)
      console.log('Patient data:', patientData)
      
      const newPatient = await jsonStorage.createPatient({
        ...patientData,
        doctorId: doctorId
      })
      
      console.log('Patient created successfully:', newPatient)
      
      // Reload patients to ensure we get the latest data
      await loadPatients()
      
      showPatientForm = false
    } catch (error) {
      console.error('Error adding patient:', error)
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
  const getTotalPrescriptions = () => {
    let total = 0
    console.log('🔍 getTotalPrescriptions: Patients count:', patients.length)
    patients.forEach(patient => {
      const patientPrescriptions = jsonStorage.getPrescriptionsByPatientId(patient.id) || []
      console.log(`🔍 getTotalPrescriptions: Patient ${patient.firstName} has ${patientPrescriptions.length} prescriptions`)
      console.log(`🔍 getTotalPrescriptions: Prescription data:`, patientPrescriptions)
      total += patientPrescriptions.length
    })
    console.log('🔍 getTotalPrescriptions: Total prescriptions:', total)
    return total
  }
  
  const getTotalDrugs = () => {
    let total = 0
    console.log('🔍 getTotalDrugs: Patients count:', patients.length)
    patients.forEach(patient => {
      const patientPrescriptions = jsonStorage.getPrescriptionsByPatientId(patient.id) || []
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
    })
    console.log('🔍 getTotalDrugs: Total drugs:', total)
    return total
  }
  
  const getConnectedPharmacies = () => {
    if (!user) return 0
    
    // Get doctor data from storage to access connectedPharmacists
    const doctor = jsonStorage.getDoctorByEmail(user.email)
    if (!doctor || !doctor.connectedPharmacists) return 0
    
    return doctor.connectedPharmacists.length
  }

  
  // Create responsive prescriptions per day chart using Chart.js
  const createPrescriptionsChart = () => {
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
        patients.forEach(patient => {
          const patientPrescriptions = jsonStorage.getMedicationsByPatientId(patient.id) || []
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
        })
        
        prescriptionsPerDay.push(dayPrescriptions)
      }
      
      // Create Chart.js chart
      setTimeout(() => {
        const canvas = document.getElementById('prescriptionsChart')
        if (!canvas) return
        
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
      illnesses = await jsonStorage.getIllnessesByPatientId(patientId) || []
      console.log('Loaded illnesses:', illnesses.length)
      
      // Load prescriptions
      prescriptions = await jsonStorage.getMedicationsByPatientId(patientId) || []
      console.log('Loaded prescriptions:', prescriptions.length)
      
      // Load symptoms
      symptoms = await jsonStorage.getSymptomsByPatientId(patientId) || []
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
      const newPrescription = await jsonStorage.createMedication({
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
  
  onMount(() => {
    loadPatients()
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
    <div class="card mb-3">
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
              class="btn btn-outline-secondary" 
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
                  <div class="d-flex w-100 justify-content-between align-items-start">
                    <div class="flex-grow-1">
                      <h6 class="mb-1">
                        <i class="fas fa-user me-1"></i>
                        <span class="d-inline d-sm-none">{patient.firstName} {patient.lastName}</span>
                        <span class="d-none d-sm-inline">{patient.firstName} {patient.lastName}</span>
                      </h6>
                      <p class="mb-1 text-muted small">
                        <i class="fas fa-envelope me-1"></i>
                        <span class="d-inline d-md-none">{patient.email.split('@')[0]}...</span>
                        <span class="d-none d-md-inline">{patient.email}</span>
                      </p>
                      <small class="text-muted">
                        <i class="fas fa-id-card me-1"></i>ID: {patient.idNumber}
                      </small>
                    </div>
                    <small class="text-muted ms-2">
                      <i class="fas fa-calendar me-1"></i>
                      <span class="d-none d-lg-inline">{patient.dateOfBirth}</span>
                      <span class="d-inline d-lg-none">{new Date(patient.dateOfBirth).getFullYear()}</span>
                    </small>
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
                  <div class="d-flex w-100 justify-content-between align-items-start">
                    <div class="flex-grow-1">
                      <h6 class="mb-1">
                        <i class="fas fa-user me-1"></i>
                        <span class="d-inline d-sm-none">{patient.firstName} {patient.lastName}</span>
                        <span class="d-none d-sm-inline">{patient.firstName} {patient.lastName}</span>
                      </h6>
                      <p class="mb-1 text-muted small">
                        <i class="fas fa-envelope me-1"></i>
                        <span class="d-inline d-md-none">{patient.email.split('@')[0]}...</span>
                        <span class="d-none d-md-inline">{patient.email}</span>
                      </p>
                      <small class="text-muted">
                        <i class="fas fa-id-card me-1"></i>ID: {patient.idNumber}
                      </small>
                    </div>
                    <small class="text-muted ms-2">
                      <i class="fas fa-calendar me-1"></i>
                      <span class="d-none d-lg-inline">{patient.dateOfBirth}</span>
                      <span class="d-inline d-lg-none">{new Date(patient.dateOfBirth).getFullYear()}</span>
                    </small>
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
                   <div class="card border-primary shadow-sm">
                     <div class="card-body bg-transparent text-dark rounded-3">
                       <div class="d-flex align-items-center">
                         <div class="flex-shrink-0">
                           <i class="fas fa-user-md fa-2x text-primary"></i>
                         </div>
                         <div class="flex-grow-1 ms-3">
                           <h4 class="card-title mb-1 fw-bold text-dark">
                             Welcome, Dr. {user?.name || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName) || user?.email || 'Doctor'}!
                           </h4>
                           <p class="card-text mb-0 text-muted">
                             Ready to provide excellent patient care with AI-powered assistance
                           </p>
                           <!-- Added Country Information -->
                           <p class="card-text mt-2 mb-0 text-muted small">
                             <i class="fas fa-map-marker-alt me-1"></i>
                             Country: {user?.country || 'Not specified'}
                             {#if user}
                               <br><small class="text-info">Debug: {JSON.stringify({name: user.name, firstName: user.firstName, lastName: user.lastName, country: user.country})}</small>
                             {/if}
                           </p>
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
        
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
                  <h4 class="card-title mb-0 fw-bold fs-5 fs-md-4" id="totalPrescriptions">{getTotalPrescriptions()}</h4>
                  <small class="opacity-75 d-none d-sm-block">Total Prescriptions</small>
                  <small class="opacity-75 d-sm-none">Prescriptions</small>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="col-6 col-md-4">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body bg-secondary text-white rounded-3 p-2 p-md-3">
              <div class="d-flex align-items-center">
                <div class="flex-shrink-0">
                  <div class="bg-white bg-opacity-25 rounded-circle p-1 p-md-2">
                    <i class="fas fa-pills fa-sm fa-md-lg"></i>
                  </div>
                </div>
                <div class="flex-grow-1 ms-2 ms-md-3">
                  <h4 class="card-title mb-0 fw-bold fs-5 fs-md-4" id="totalDrugs">{getTotalDrugs()}</h4>
                  <small class="opacity-75 d-none d-sm-block">Total Drugs</small>
                  <small class="opacity-75 d-sm-none">Drugs</small>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="col-6 col-md-4">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body bg-success text-white rounded-3 p-2 p-md-3">
              <div class="d-flex align-items-center">
                <div class="flex-shrink-0">
                  <div class="bg-white bg-opacity-25 rounded-circle p-1 p-md-2">
                    <i class="fas fa-store fa-sm fa-md-lg"></i>
                  </div>
                </div>
                <div class="flex-grow-1 ms-2 ms-md-3">
                  <h4 class="card-title mb-0 fw-bold fs-5 fs-md-4" id="connectedPharmacies">{getConnectedPharmacies()}</h4>
                  <small class="opacity-75 d-none d-sm-block">Connected Pharmacies</small>
                  <small class="opacity-75 d-sm-none">Pharmacies</small>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Prescriptions Per Day Chart -->
        <div class="col-12">
          <div class="card border-0 shadow-sm">
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
      </div>
    {/if}
  </div>
</div>
{:else}
<!-- Pharmacist Management View -->
<PharmacistManagement {user} />
{/if}