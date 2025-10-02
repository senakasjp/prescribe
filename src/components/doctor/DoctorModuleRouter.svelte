<!-- Doctor Module Router - Routes doctor-specific components -->
<!-- This component handles ONLY doctor module routing and should never interact with pharmacist components -->

<script>
  import { onMount } from 'svelte'
  import doctorAuthService from '../../services/doctor/doctorAuthService.js'
  import doctorStorageService from '../../services/doctor/doctorStorageService.js'
  import PatientManagement from '../PatientManagement.svelte'
  import EditProfile from '../EditProfile.svelte'
  import PrescriptionList from '../PrescriptionList.svelte'
  import NotificationContainer from '../NotificationContainer.svelte'
  import LoadingSpinner from '../LoadingSpinner.svelte'
  import PrivacyPolicyModal from '../PrivacyPolicyModal.svelte'
  
  let currentView = 'home'
  let loading = false
  let showPrivacyPolicy = false
  
  // Doctor-specific state
  let doctor = null
  let patients = []
  let prescriptions = []
  
  onMount(async () => {
    try {
      loading = true
      
      // Get current doctor
      doctor = doctorAuthService.getCurrentDoctor()
      if (!doctor) {
        console.error('DoctorModuleRouter: No authenticated doctor found')
        return
      }
      
      console.log('DoctorModuleRouter: Loaded doctor:', doctor)
      
      // Load doctor-specific data
      await loadDoctorData()
      
    } catch (error) {
      console.error('DoctorModuleRouter: Error initializing:', error)
    } finally {
      loading = false
    }
  })
  
  async function loadDoctorData() {
    try {
      if (!doctor?.id) return
      
      // Load patients for this doctor only
      patients = await doctorStorageService.getPatientsByDoctorId(doctor.id)
      
      // Load prescriptions for this doctor only
      prescriptions = await doctorStorageService.getPrescriptionsByDoctorId(doctor.id)
      
      console.log('DoctorModuleRouter: Loaded doctor data:', {
        patientsCount: patients.length,
        prescriptionsCount: prescriptions.length
      })
      
    } catch (error) {
      console.error('DoctorModuleRouter: Error loading doctor data:', error)
    }
  }
  
  function handleViewChange(view) {
    currentView = view
    console.log('DoctorModuleRouter: View changed to:', view)
  }
  
  function handleLogout() {
    console.log('DoctorModuleRouter: Logging out doctor')
    doctorAuthService.signOutDoctor()
    // The parent App.svelte will handle the logout
  }
  
  function handleProfileUpdate(updatedDoctor) {
    doctor = updatedDoctor
    console.log('DoctorModuleRouter: Doctor profile updated')
  }
  
  function showPrivacyPolicyModal() {
    showPrivacyPolicy = true
  }
  
  function hidePrivacyPolicyModal() {
    showPrivacyPolicy = false
  }
</script>

{#if loading}
  <LoadingSpinner />
{:else if doctor}
  <div class="min-h-screen bg-gray-50">
    <!-- Doctor Module Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <!-- Logo and Title -->
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <h1 class="text-xl font-bold text-teal-600">Prescribe - Doctor Portal</h1>
            </div>
          </div>
          
          <!-- Doctor Info -->
          <div class="flex items-center space-x-4">
            <div class="text-sm text-gray-700">
              <span class="font-medium">Dr. {doctor.firstName} {doctor.lastName}</span>
              <span class="text-gray-500">({doctor.email})</span>
            </div>
            
            <!-- Navigation Menu -->
            <div class="flex items-center space-x-2">
              <button 
                class="px-3 py-2 text-sm font-medium text-gray-700 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                on:click={() => handleViewChange('home')}
                class:bg-teal-50={currentView === 'home'}
                class:text-teal-600={currentView === 'home'}
              >
                Home
              </button>
              <button 
                class="px-3 py-2 text-sm font-medium text-gray-700 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                on:click={() => handleViewChange('patients')}
                class:bg-teal-50={currentView === 'patients'}
                class:text-teal-600={currentView === 'patients'}
              >
                Patients
              </button>
              <button 
                class="px-3 py-2 text-sm font-medium text-gray-700 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                on:click={() => handleViewChange('prescriptions')}
                class:bg-teal-50={currentView === 'prescriptions'}
                class:text-teal-600={currentView === 'prescriptions'}
              >
                Prescriptions
              </button>
            </div>
            
            <!-- Profile and Logout -->
            <div class="flex items-center space-x-2">
              <button 
                class="px-3 py-2 text-sm font-medium text-gray-700 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                on:click={() => handleViewChange('profile')}
                class:bg-teal-50={currentView === 'profile'}
                class:text-teal-600={currentView === 'profile'}
              >
                Profile
              </button>
              <button 
                class="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                on:click={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
    
    <!-- Main Content -->
    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {#if currentView === 'home'}
        <div class="space-y-6">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Welcome, Dr. {doctor.firstName}!</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="bg-teal-50 rounded-lg p-4">
                <h3 class="text-sm font-medium text-teal-600 mb-2">Total Patients</h3>
                <p class="text-2xl font-bold text-teal-700">{patients.length}</p>
              </div>
              <div class="bg-blue-50 rounded-lg p-4">
                <h3 class="text-sm font-medium text-blue-600 mb-2">Total Prescriptions</h3>
                <p class="text-2xl font-bold text-blue-700">{prescriptions.length}</p>
              </div>
              <div class="bg-green-50 rounded-lg p-4">
                <h3 class="text-sm font-medium text-green-600 mb-2">Active Prescriptions</h3>
                <p class="text-2xl font-bold text-green-700">{prescriptions.filter(p => p.status === 'active').length}</p>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                class="p-4 border border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-colors text-left"
                on:click={() => handleViewChange('patients')}
              >
                <h4 class="font-medium text-gray-900">Manage Patients</h4>
                <p class="text-sm text-gray-600 mt-1">Add, edit, or view patient information</p>
              </button>
              <button 
                class="p-4 border border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-colors text-left"
                on:click={() => handleViewChange('prescriptions')}
              >
                <h4 class="font-medium text-gray-900">View Prescriptions</h4>
                <p class="text-sm text-gray-600 mt-1">Review and manage prescriptions</p>
              </button>
            </div>
          </div>
        </div>
      {:else if currentView === 'patients'}
        <PatientManagement 
          bind:patients={patients}
          bind:prescriptions={prescriptions}
          {doctor}
          on:view-change={(e) => handleViewChange(e.detail.view)}
        />
      {:else if currentView === 'prescriptions'}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-semibold text-gray-900">
              <i class="fas fa-prescription-bottle-alt mr-2 text-teal-600"></i>
              All Prescriptions
            </h2>
            <div class="text-sm text-gray-500">
              Total: {prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''}
            </div>
          </div>
          
          {#if prescriptions.length === 0}
            <div class="text-center py-12">
              <i class="fas fa-prescription-bottle-alt text-6xl text-gray-300 mb-4"></i>
              <h3 class="text-lg font-semibold text-gray-500 mb-2">No Prescriptions Yet</h3>
              <p class="text-gray-400 mb-6">Start by creating prescriptions for your patients.</p>
              <button 
                class="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
                on:click={() => handleViewChange('patients')}
              >
                <i class="fas fa-users mr-2"></i>
                Go to Patients
              </button>
            </div>
          {:else}
            <PrescriptionList {prescriptions} />
          {/if}
        </div>
      {:else if currentView === 'profile'}
        <EditProfile 
          {doctor}
          on:profile-updated={(e) => handleProfileUpdate(e.detail.doctor)}
        />
      {/if}
    </main>
  </div>
{/if}

<!-- Notification Container -->
<NotificationContainer />

<!-- Privacy Policy Modal -->
{#if showPrivacyPolicy}
  <PrivacyPolicyModal on:close={hidePrivacyPolicyModal} />
{/if}
