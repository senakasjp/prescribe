<!-- Pharmacist Module Router - Routes pharmacist-specific components -->
<!-- This component handles ONLY pharmacist module routing and should never interact with doctor components -->

<script>
  import { onMount } from 'svelte'
  import pharmacistAuthService from '../../services/pharmacist/pharmacistAuthService.js'
  import firebaseAuthService from '../../services/firebaseAuth.js'
  import pharmacistStorageService from '../../services/pharmacist/pharmacistStorageService.js'
  import PharmacistDashboard from '../PharmacistDashboard.svelte'
  import PharmacistSettings from './PharmacistSettings.svelte'
  import NotificationContainer from '../NotificationContainer.svelte'
  import LoadingSpinner from '../LoadingSpinner.svelte'
  import PrivacyPolicyModal from '../PrivacyPolicyModal.svelte'
  
  let currentView = 'dashboard'
  let loading = false
  let showPrivacyPolicy = false
  
  // Pharmacist-specific state
  let pharmacist = null
  let prescriptions = []
  let drugStock = []
  let connectedDoctors = []
  let pharmacyId = null
  $: pharmacyId = pharmacist?.pharmacyId || pharmacist?.id || null
  
  onMount(async () => {
    try {
      loading = true
      
      // Get current pharmacist
      pharmacist = pharmacistAuthService.getCurrentPharmacist()
      if (!pharmacist) {
        console.error('PharmacistModuleRouter: No authenticated pharmacist found')
        return
      }
      
      console.log('PharmacistModuleRouter: Loaded pharmacist:', pharmacist)
      
      // Load pharmacist-specific data
      await loadPharmacistData()
      
    } catch (error) {
      console.error('PharmacistModuleRouter: Error initializing:', error)
    } finally {
      loading = false
    }
  })
  
  async function loadPharmacistData() {
    try {
      if (!pharmacyId) return
      
      // Load prescriptions for this pharmacist only
      prescriptions = await pharmacistStorageService.getPrescriptionsByPharmacistId(pharmacyId)
      
      // Load drug stock for this pharmacist only
      drugStock = await pharmacistStorageService.getDrugStockByPharmacistId(pharmacyId)
      
      // Load connected doctors for this pharmacist only
      connectedDoctors = await pharmacistStorageService.getConnectedDoctors(pharmacyId)
      
      console.log('PharmacistModuleRouter: Loaded pharmacist data:', {
        prescriptionsCount: prescriptions.length,
        drugStockCount: drugStock.length,
        connectedDoctorsCount: connectedDoctors.length
      })
      
    } catch (error) {
      console.error('PharmacistModuleRouter: Error loading pharmacist data:', error)
    }
  }
  
  function handleViewChange(view) {
    currentView = view
    console.log('PharmacistModuleRouter: View changed to:', view)
  }
  
  function handleLogout() {
    console.log('PharmacistModuleRouter: Logging out pharmacist')
    pharmacistAuthService.signOutPharmacist()
    firebaseAuthService.signOut()
    // The parent App.svelte will handle the logout
  }
  
  function handleProfileUpdate(updatedPharmacist) {
    pharmacist = updatedPharmacist
    console.log('PharmacistModuleRouter: Pharmacist profile updated')
  }
  
  function handleBackToDashboard() {
    currentView = 'dashboard'
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
{:else if pharmacist}
  <div class="min-h-screen bg-gray-50">
    <!-- Pharmacist Module Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <!-- Logo and Title -->
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <h1 class="text-xl font-bold text-blue-600"><span class="text-red-600 font-extrabold">M</span>-Prescribe - Pharmacist Portal</h1>
            </div>
          </div>
          
          <!-- Pharmacist Info -->
          <div class="flex items-center space-x-4">
            <div class="text-sm text-gray-700">
              <span class="font-medium">{pharmacist.businessName}</span>
              <span class="text-gray-500">({pharmacist.email})</span>
            </div>
            
            <!-- Navigation Menu -->
            <div class="flex items-center space-x-2">
              <button 
                class="px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                on:click={() => handleViewChange('dashboard')}
                class:bg-blue-50={currentView === 'dashboard'}
                class:text-blue-600={currentView === 'dashboard'}
              >
                Dashboard
              </button>
              <button 
                class="px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                on:click={() => handleViewChange('prescriptions')}
                class:bg-blue-50={currentView === 'prescriptions'}
                class:text-blue-600={currentView === 'prescriptions'}
              >
                Prescriptions
              </button>
              <button 
                class="px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                on:click={() => handleViewChange('inventory')}
                class:bg-blue-50={currentView === 'inventory'}
                class:text-blue-600={currentView === 'inventory'}
              >
                Inventory
              </button>
              <button 
                class="px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                on:click={() => handleViewChange('doctors')}
                class:bg-blue-50={currentView === 'doctors'}
                class:text-blue-600={currentView === 'doctors'}
              >
                Doctors
              </button>
            </div>
            
            <!-- Profile and Logout -->
            <div class="flex items-center space-x-2">
              <button 
                class="px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                on:click={() => handleViewChange('profile')}
                class:bg-blue-50={currentView === 'profile'}
                class:text-blue-600={currentView === 'profile'}
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
      {#if currentView === 'dashboard'}
        <PharmacistDashboard 
          bind:pharmacist={pharmacist}
          bind:prescriptions={prescriptions}
          bind:drugStock={drugStock}
          bind:connectedDoctors={connectedDoctors}
          on:view-change={(e) => handleViewChange(e.detail.view)}
        />
      {:else if currentView === 'prescriptions'}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Prescriptions</h2>
          <p class="text-gray-600">Prescription management will be implemented here.</p>
        </div>
      {:else if currentView === 'inventory'}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Inventory Management</h2>
          <p class="text-gray-600">Drug stock management will be implemented here.</p>
        </div>
      {:else if currentView === 'doctors'}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Connected Doctors</h2>
          <p class="text-gray-600">Doctor connection management will be implemented here.</p>
        </div>
      {:else if currentView === 'profile'}
        <PharmacistSettings 
          {pharmacist}
          on:profile-updated={(e) => handleProfileUpdate(e.detail)}
          on:back-to-dashboard={handleBackToDashboard}
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
