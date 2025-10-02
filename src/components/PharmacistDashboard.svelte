<script>
  import { onMount } from 'svelte'
  import authService from '../services/authService.js'
  import firebaseStorage from '../services/firebaseStorage.js'
  import { notifySuccess, notifyError } from '../stores/notifications.js'
  import ConfirmationModal from './ConfirmationModal.svelte'
  import InventoryDashboard from './pharmacist/InventoryDashboard.svelte'
  
  export let pharmacist
  
  let prescriptions = []
  let connectedDoctors = []
  let loading = true
  let selectedPrescription = null
  let showPrescriptionDetails = false
  
  // Pagination for prescriptions
  let currentPrescriptionPage = 1
  let prescriptionsPerPage = 10
  
  let activeTab = 'prescriptions' // 'prescriptions' or 'inventory'
  
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
  
  // Load pharmacist data
  const loadPharmacistData = async () => {
    try {
      loading = true
      
      console.log('🔍 PharmacistDashboard: Starting loadPharmacistData')
      console.log('🔍 PharmacistDashboard: pharmacist object:', pharmacist)
      console.log('🔍 PharmacistDashboard: pharmacist.id:', pharmacist?.id)
      console.log('🔍 PharmacistDashboard: pharmacist.connectedDoctors:', pharmacist?.connectedDoctors)
      
      // Check if pharmacist data is valid
      if (!pharmacist || !pharmacist.id) {
        console.error('❌ PharmacistDashboard: Invalid pharmacist data - missing ID')
        notifyError('Invalid pharmacist data. Please log in again.')
        return
      }
      
      // Get prescriptions from connected doctors using Firebase
      prescriptions = await firebaseStorage.getPharmacistPrescriptions(pharmacist.id)
      
      console.log('🔍 PharmacistDashboard: Loaded prescriptions:', prescriptions.length)
      console.log('🔍 PharmacistDashboard: Prescription data:', prescriptions)
      
      // Count total prescriptions across all prescription objects
      let totalPrescriptions = 0
      prescriptions.forEach(prescription => {
        if (prescription.prescriptions && Array.isArray(prescription.prescriptions)) {
          totalPrescriptions += prescription.prescriptions.length
          console.log(`🔍 Prescription ${prescription.id} has ${prescription.prescriptions.length} sub-prescriptions`)
        } else {
          totalPrescriptions += 1
          console.log(`🔍 Prescription ${prescription.id} is a single prescription`)
        }
      })
      console.log('🔍 Total prescriptions count:', totalPrescriptions)
      
      // Load connected doctors info from Firebase
      connectedDoctors = []
      if (pharmacist.connectedDoctors && Array.isArray(pharmacist.connectedDoctors)) {
        for (const doctorId of pharmacist.connectedDoctors) {
          const doctor = await firebaseStorage.getDoctorById(doctorId)
          if (doctor) {
            connectedDoctors.push(doctor)
          }
        }
      } else {
        console.log('🔍 PharmacistDashboard: No connected doctors found or connectedDoctors is not an array')
      }
      
      // Sort prescriptions by date (newest first)
      prescriptions.sort((a, b) => new Date(b.createdAt || b.dateCreated) - new Date(a.createdAt || a.dateCreated))
      
      console.log('✅ PharmacistDashboard: Data loaded successfully')
      
    } catch (error) {
      console.error('❌ PharmacistDashboard: Error loading pharmacist data:', error)
      console.error('❌ PharmacistDashboard: Error stack:', error.stack)
      notifyError('Failed to load prescriptions: ' + error.message)
    } finally {
      loading = false
    }
  }
  
  // View prescription details
  const viewPrescription = (prescription) => {
    selectedPrescription = prescription
    showPrescriptionDetails = true
  }
  
  // Close prescription details
  const closePrescriptionDetails = () => {
    showPrescriptionDetails = false
    selectedPrescription = null
  }

  // Pagination calculations for prescriptions
  $: totalPrescriptionPages = Math.ceil(prescriptions.length / prescriptionsPerPage)
  $: prescriptionStartIndex = (currentPrescriptionPage - 1) * prescriptionsPerPage
  $: prescriptionEndIndex = prescriptionStartIndex + prescriptionsPerPage
  $: paginatedPrescriptions = prescriptions.slice(prescriptionStartIndex, prescriptionEndIndex)
  
  // Reset to first page when prescriptions change
  $: if (prescriptions.length > 0) {
    currentPrescriptionPage = 1
  }
  
  // Pagination functions for prescriptions
  const goToPrescriptionPage = (page) => {
    if (page >= 1 && page <= totalPrescriptionPages) {
      currentPrescriptionPage = page
    }
  }
  
  const goToPreviousPrescriptionPage = () => {
    if (currentPrescriptionPage > 1) {
      currentPrescriptionPage--
    }
  }
  
  const goToNextPrescriptionPage = () => {
    if (currentPrescriptionPage < totalPrescriptionPages) {
      currentPrescriptionPage++
    }
  }

  // Clear all prescriptions (for testing/cleanup)
  const clearAllPrescriptions = async () => {
    pendingAction = async () => {
      try {
        await firebaseStorage.clearPharmacistPrescriptions(pharmacist.id)
        notifySuccess('All prescriptions cleared successfully')
        // Reload the data
        await loadPharmacistData()
      } catch (error) {
        console.error('Error clearing prescriptions:', error)
        notifyError('Failed to clear prescriptions')
      }
    }
    
    showConfirmation(
      'Clear All Prescriptions',
      'Are you sure you want to clear all prescriptions? This action cannot be undone.',
      'Clear All',
      'Cancel',
      'danger'
    )
  }
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // Get doctor name by ID
  const getDoctorName = (doctorId) => {
    const doctor = connectedDoctors.find(d => d.id === doctorId)
    return doctor ? (doctor.name || `${doctor.firstName} ${doctor.lastName}` || doctor.email) : 'Unknown Doctor'
  }
  
  // Sign out
  const handleSignOut = async () => {
    try {
      await authService.signOut()
      notifySuccess('Signed out successfully')
      // Redirect will be handled by parent component
    } catch (error) {
      notifyError('Sign out failed')
    }
  }
  
  
  
  
  

  onMount(() => {
    console.log('🔍 PharmacistDashboard: Received pharmacist data:', pharmacist)
    console.log('🔍 PharmacistDashboard: businessName:', pharmacist?.businessName)
    console.log('🔍 PharmacistDashboard: pharmacistNumber:', pharmacist?.pharmacistNumber)
    console.log('🔍 PharmacistDashboard: All pharmacist fields:', Object.keys(pharmacist || {}))
    loadPharmacistData()
  })
</script>

<div class="max-w-screen-xl mx-auto px-4 py-6">
  <!-- Compact Header -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 py-3">
    <div class="flex justify-between items-center px-4">
      <div class="flex items-center">
        <i class="fas fa-pills text-blue-600 mr-2"></i>
        <span class="font-bold text-blue-600">M-Prescribe - Pharmacist Portal</span>
      </div>
      <div class="relative">
        <button 
          id="pharmacistDropdownButton" 
          data-dropdown-toggle="pharmacistDropdown" 
          class="text-gray-700 hover:text-gray-900 flex items-center p-0" 
          type="button"
        >
          <i class="fas fa-user-circle mr-2"></i>
          <span class="hidden md:inline">{pharmacist.businessName}</span>
          <svg class="w-2.5 h-2.5 ml-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 4 4 4-4"/>
          </svg>
        </button>
        <div id="pharmacistDropdown" class="z-10 hidden bg-white divide-y divide-gray-100 rounded-lg shadow w-44 dark:bg-gray-700">
          <div class="px-4 py-3 text-sm text-gray-900 dark:text-white">
            <div class="font-medium">{pharmacist.businessName}</div>
            <div class="truncate text-xs text-gray-500">ID: {pharmacist.pharmacistNumber}</div>
          </div>
          <ul class="py-2 text-sm text-gray-700 dark:text-gray-200">
            <li>
              <button class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white" on:click={handleSignOut}>
                <i class="fas fa-sign-out-alt mr-2"></i>Sign Out
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Main Content -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <!-- Sidebar -->
    <div class="lg:col-span-3">
      <div class="bg-white border-2 border-blue-200 rounded-lg shadow-sm">
        <div class="bg-blue-600 text-white px-4 py-3 rounded-t-lg">
          <h6 class="text-lg font-semibold mb-0">
            <i class="fas fa-info-circle mr-2"></i>
            Pharmacy Information
          </h6>
        </div>
        <div class="p-4">
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">Business Name:</label>
            <p class="text-gray-900">{pharmacist.businessName || pharmacist.name || 'Not specified'}</p>
          </div>
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">Pharmacist ID:</label>
            <p class="text-blue-600 font-semibold">{pharmacist.pharmacistNumber || pharmacist.id || 'Not specified'}</p>
          </div>
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">Connected Doctors:</label>
            <p class="text-gray-900">{connectedDoctors.length}</p>
          </div>
          <div class="mb-0">
            <label class="block text-sm font-medium text-gray-700 mb-1">Total Prescriptions:</label>
            <p class="mb-0">{prescriptions.length}</p>
          </div>
        </div>
      </div>
      
      <!-- Connected Doctors -->
      {#if connectedDoctors.length > 0}
        <div class="bg-white border-2 border-blue-200 rounded-lg shadow-sm mt-4">
          <div class="bg-blue-500 text-white px-4 py-3 rounded-t-lg">
            <h6 class="text-lg font-semibold mb-0">
              <i class="fas fa-user-md mr-2"></i>
              Connected Doctors
            </h6>
          </div>
          <div class="p-4">
            {#each connectedDoctors as doctor}
              <div class="flex items-center mb-3">
                <i class="fas fa-user-md text-blue-600 mr-2"></i>
                <div>
                  <div class="font-semibold text-gray-900">{doctor.name || `${doctor.firstName} ${doctor.lastName}` || doctor.email}</div>
                  <small class="text-gray-500">{doctor.email}</small>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
    
    <!-- Main Content with Tabs -->
    <div class="lg:col-span-9">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="bg-white border-b border-gray-200 px-4 py-3">
          <div class="flex justify-between items-center">
            <div class="flex space-x-1" role="tablist">
              <button 
                class="px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'prescriptions' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}" 
                on:click={() => activeTab = 'prescriptions'}
                type="button"
                role="tab"
              >
                <i class="fas fa-prescription mr-2"></i>
                Prescriptions
              </button>
              <button 
                class="px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'inventory' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}" 
                on:click={() => activeTab = 'inventory'}
                type="button"
                role="tab"
              >
                <i class="fas fa-warehouse mr-2"></i>
                Advanced Inventory
              </button>
            </div>
            <div class="flex space-x-2" role="group">
              {#if activeTab === 'prescriptions'}
                <button class="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded text-sm font-medium transition-colors duration-200" on:click={loadPharmacistData}>
                  <i class="fas fa-sync-alt mr-1"></i>
                  Refresh
                </button>
                <button class="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm font-medium transition-colors duration-200" on:click={clearAllPrescriptions}>
                  <i class="fas fa-trash mr-1"></i>
                  Clear All
                </button>
              {:else if activeTab === 'inventory'}
                <button class="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded text-sm font-medium transition-colors duration-200" on:click={loadPharmacistData}>
                  <i class="fas fa-sync-alt mr-1"></i>
                  Refresh
                </button>
              {/if}
            </div>
          </div>
        </div>
        
        <div class="p-4">
          {#if activeTab === 'prescriptions'}
            {#if loading}
              <div class="text-center py-4">
                <svg class="animate-spin h-8 w-8 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="mt-2 text-gray-500">Loading prescriptions...</p>
              </div>
            {:else if prescriptions.length === 0}
              <div class="text-center py-8">
                <i class="fas fa-prescription text-4xl text-gray-400 mb-3"></i>
                <h5 class="text-gray-500">No Prescriptions Available</h5>
                <p class="text-gray-500">Prescriptions from connected doctors will appear here.</p>
              </div>
            {:else}
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medications</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    {#each paginatedPrescriptions as prescription}
                      <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4 whitespace-nowrap">
                          <div class="font-semibold text-gray-900">{prescription.patientName || 'Unknown Patient'}</div>
                          <div class="text-sm text-gray-500">{prescription.patientEmail || 'No email'}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <div class="font-semibold text-gray-900">{prescription.doctorName || getDoctorName(prescription.doctorId)}</div>
                          <div class="text-sm text-gray-500">ID: {prescription.doctorId}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {prescription.prescriptions ? prescription.prescriptions.reduce((total, p) => total + (p.medications ? p.medications.length : 0), 0) : 0} medication(s)
                          </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(prescription.receivedAt || prescription.sentAt || prescription.createdAt)}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            {prescription.status || 'Pending'}
                          </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            class="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                            on:click={() => viewPrescription(prescription)}
                          >
                            <i class="fas fa-eye mr-1"></i>
                            View
                          </button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
                
                <!-- Pagination Controls -->
                {#if totalPrescriptionPages > 1}
                  <div class="flex items-center justify-between mt-6 px-4 py-3 bg-gray-50 rounded-lg">
                    <div class="flex items-center text-sm text-gray-700">
                      <span>Showing {prescriptionStartIndex + 1} to {Math.min(prescriptionEndIndex, prescriptions.length)} of {prescriptions.length} prescriptions</span>
                    </div>
                    
                    <div class="flex items-center space-x-2">
                      <!-- Previous Button -->
                      <button 
                        class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        on:click={goToPreviousPrescriptionPage}
                        disabled={currentPrescriptionPage === 1}
                      >
                        <i class="fas fa-chevron-left mr-1"></i>
                        Previous
                      </button>
                      
                      <!-- Page Numbers -->
                      <div class="flex items-center space-x-1">
                        {#each Array.from({length: Math.min(5, totalPrescriptionPages)}, (_, i) => {
                          const startPage = Math.max(1, currentPrescriptionPage - 2)
                          const endPage = Math.min(totalPrescriptionPages, startPage + 4)
                          const page = startPage + i
                          return page <= endPage ? page : null
                        }).filter(Boolean) as page}
                          <button 
                            class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg {currentPrescriptionPage === page ? 'text-white bg-blue-600 border-blue-600' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
                            on:click={() => goToPrescriptionPage(page)}
                          >
                            {page}
                          </button>
                        {/each}
                      </div>
                      
                      <!-- Next Button -->
                      <button 
                        class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        on:click={goToNextPrescriptionPage}
                        disabled={currentPrescriptionPage === totalPrescriptionPages}
                      >
                        Next
                        <i class="fas fa-chevron-right ml-1"></i>
                      </button>
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          {:else if activeTab === 'inventory'}
            <!-- Advanced Inventory System -->
            <InventoryDashboard {pharmacist} />
          {/if}
        </div>
      </div>
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
  on:confirm={handleConfirmationConfirm}
  on:cancel={handleConfirmationCancel}
  on:close={handleConfirmationCancel}
/>

<!-- Prescription Details Modal -->
{#if showPrescriptionDetails && selectedPrescription}
  <div id="prescriptionModal" tabindex="-1" aria-hidden="true" class="fixed inset-0 z-50 w-full p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] max-h-full">
    <div class="relative w-full max-w-4xl max-h-full mx-auto">
      <div class="relative bg-white rounded-lg shadow dark:bg-gray-700">
        <div class="flex items-center justify-between p-5 border-b rounded-t dark:border-gray-600">
          <h3 class="text-xl font-medium text-gray-900 dark:text-white">
            <i class="fas fa-prescription mr-2"></i>
            Prescription Details
          </h3>
          <button 
            type="button" 
            class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white" 
            data-modal-hide="prescriptionModal"
            on:click={closePrescriptionDetails}
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
            </svg>
            <span class="sr-only">Close modal</span>
          </button>
        </div>
        <div class="p-6">
          <!-- Patient Information -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h6 class="font-semibold text-blue-600">Patient Information</h6>
              <p><strong>Name:</strong> {selectedPrescription.patientName || 'Unknown Patient'}</p>
              <p><strong>Email:</strong> {selectedPrescription.patientEmail || 'No email'}</p>
              {#if selectedPrescription.patientAge}
                <p><strong>Age:</strong> {selectedPrescription.patientAge}</p>
              {/if}
            </div>
            <div>
              <h6 class="font-semibold text-blue-600">Prescription Information</h6>
              <p><strong>Doctor:</strong> {selectedPrescription.doctorName || getDoctorName(selectedPrescription.doctorId)}</p>
              <p><strong>Date:</strong> {formatDate(selectedPrescription.receivedAt || selectedPrescription.sentAt || selectedPrescription.createdAt)}</p>
              <p><strong>Status:</strong> <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{selectedPrescription.status || 'Pending'}</span></p>
            </div>
          </div>
          
          <!-- Prescriptions -->
          <div class="mb-4">
            <h6 class="font-semibold text-blue-600">Prescriptions</h6>
            {#if selectedPrescription.prescriptions && selectedPrescription.prescriptions.length > 0}
              {#each selectedPrescription.prescriptions as prescription}
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
                  <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h6 class="text-sm font-semibold mb-0">Prescription ID: {prescription.id}</h6>
                  </div>
                  <div class="p-4">
                    <!-- Medications for this prescription -->
                    {#if prescription.medications && prescription.medications.length > 0}
                      <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                          <thead class="bg-gray-50">
                            <tr>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medication</th>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dosage</th>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instructions</th>
                            </tr>
                          </thead>
                          <tbody class="bg-white divide-y divide-gray-200">
                            {#each prescription.medications as medication}
                              <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{medication.name}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{medication.dosage}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{medication.frequency}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{medication.duration}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{medication.instructions}</td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    {:else}
                      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <i class="fas fa-info-circle mr-2 text-blue-600"></i>
                        <span class="text-blue-700">No medications found in this prescription.</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            {:else}
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <i class="fas fa-info-circle mr-2 text-blue-600"></i>
                <span class="text-blue-700">No prescriptions found.</span>
              </div>
            {/if}
          </div>
          
          <!-- Notes -->
          {#if selectedPrescription.notes}
            <div class="mb-4">
              <h6 class="font-semibold text-blue-600">Doctor's Notes</h6>
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <span class="text-gray-700">{selectedPrescription.notes}</span>
              </div>
            </div>
          {/if}
        </div>
        <div class="flex items-center p-6 space-x-2 border-t border-gray-200 rounded-b dark:border-gray-600">
          <button 
            type="button" 
            class="text-gray-500 bg-white hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-200 rounded-lg border border-gray-200 text-sm font-medium px-5 py-2.5 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-gray-600"
            on:click={closePrescriptionDetails}
          >
            <i class="fas fa-times mr-1"></i>
            Close
          </button>
          <button 
            type="button" 
            class="text-white bg-teal-700 hover:bg-teal-800 focus:ring-4 focus:outline-none focus:ring-teal-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-teal-600 dark:hover:bg-teal-700 dark:focus:ring-teal-800"
          >
            <i class="fas fa-check mr-1"></i>
            Mark as Dispensed
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}


<style>
  /* Custom styles for enhanced UI */
</style>
