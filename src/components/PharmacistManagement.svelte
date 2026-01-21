<script>
  import { onMount } from 'svelte'
  import firebaseStorage from '../services/firebaseStorage.js'
  import { notifySuccess, notifyError } from '../stores/notifications.js'
  import ThreeDots from './ThreeDots.svelte'
  
  export let user
  
  let pharmacists = []
  let connectedPharmacists = []
  let loading = true
  let showAddForm = false
  let showConnectModal = false
  let pharmacistNumber = ''
  let searchQuery = ''
  let isOwnPharmacy = false
  
  // Force reactive updates
  let refreshTrigger = 0
  
  // Load pharmacists data
  const loadPharmacists = async (forceRefresh = false) => {
    try {
      loading = true
      console.log('🔍 Loading pharmacists data...')
      
      const allPharmacists = await firebaseStorage.getAllPharmacists()
      console.log('🔍 All pharmacists loaded:', allPharmacists.length)
      
      // Always get fresh doctor data from Firebase to ensure we have the latest connections
      const doctor = await firebaseStorage.getDoctorByEmail(user.email)
      const doctorId = doctor?.id
      
      console.log('🔍 Doctor data:', doctor)
      console.log('🔍 Doctor ID:', doctorId)
      console.log('🔍 Doctor connectedPharmacists:', doctor?.connectedPharmacists)
      
      // Separate connected and unconnected pharmacists (check both sides of the connection)
      connectedPharmacists = allPharmacists.filter(pharmacist => {
        // Check if pharmacist has this doctor in their connectedDoctors
        const pharmacistHasDoctor = pharmacist.connectedDoctors && pharmacist.connectedDoctors.includes(doctorId)
        
        // Check if doctor has this pharmacist in their connectedPharmacists
        const doctorHasPharmacist = doctor.connectedPharmacists && doctor.connectedPharmacists.includes(pharmacist.id)
        
        // Connection exists if either side has the connection (for backward compatibility)
        const isConnected = pharmacistHasDoctor || doctorHasPharmacist
        console.log(`🔍 Pharmacist ${pharmacist.businessName}: pharmacistHasDoctor=${pharmacistHasDoctor}, doctorHasPharmacist=${doctorHasPharmacist}, isConnected=${isConnected}`)
        return isConnected
      })
      
      pharmacists = allPharmacists.filter(pharmacist => {
        // Check if pharmacist has this doctor in their connectedDoctors
        const pharmacistHasDoctor = pharmacist.connectedDoctors && pharmacist.connectedDoctors.includes(doctorId)
        
        // Check if doctor has this pharmacist in their connectedPharmacists
        const doctorHasPharmacist = doctor.connectedPharmacists && doctor.connectedPharmacists.includes(pharmacist.id)
        
        // Not connected if neither side has the connection
        const isNotConnected = !pharmacistHasDoctor && !doctorHasPharmacist
        console.log(`🔍 Pharmacist ${pharmacist.businessName}: pharmacistHasDoctor=${pharmacistHasDoctor}, doctorHasPharmacist=${doctorHasPharmacist}, isNotConnected=${isNotConnected}`)
        return isNotConnected
      })
      
      console.log('✅ Connected pharmacists:', connectedPharmacists.length)
      console.log('✅ Available pharmacists:', pharmacists.length)
      
      // Force reactive update
      refreshTrigger++
      console.log('🔄 Refresh trigger updated:', refreshTrigger)
      
    } catch (error) {
      console.error('❌ Error loading pharmacists:', error)
      notifyError('Failed to load pharmacists')
    } finally {
      loading = false
    }
  }
  
  // Connect to pharmacist
  const connectPharmacist = async () => {
    if (!pharmacistNumber.trim()) {
      notifyError('Please enter a pharmacist number')
      return
    }
    
    if (pharmacistNumber.length !== 6) {
      notifyError('Pharmacist number must be 6 digits')
      return
    }
    
    // Log the checkbox state for debugging
    console.log('Connecting to pharmacist:', pharmacistNumber, 'Is own pharmacy:', isOwnPharmacy)
    
    try {
      await firebaseStorage.connectPharmacistToDoctor(pharmacistNumber, user.email)
      const message = isOwnPharmacy 
        ? 'Successfully connected to your own pharmacy!'
        : 'Successfully connected to pharmacist!'
      notifySuccess(message)
      pharmacistNumber = ''
      isOwnPharmacy = false
      showAddForm = false
      showConnectModal = false
      loadPharmacists()
    } catch (error) {
      notifyError(error.message || 'Failed to connect to pharmacist')
    }
  }
  
  // Open connect modal
  const openConnectModal = () => {
    pharmacistNumber = ''
    isOwnPharmacy = false
    showConnectModal = true
  }
  
  // Close connect modal
  const closeConnectModal = () => {
    showConnectModal = false
    pharmacistNumber = ''
    isOwnPharmacy = false
  }
  
  // Disconnect pharmacist
  const disconnectPharmacist = async (pharmacistId) => {
    try {
      console.log('🔌 Starting pharmacist disconnection for:', pharmacistId)
      
      const pharmacist = await firebaseStorage.getPharmacistById(pharmacistId)
      const doctor = await firebaseStorage.getDoctorByEmail(user.email)
      
      console.log('🔍 Pharmacist data:', pharmacist)
      console.log('🔍 Doctor data:', doctor)
      
      if (pharmacist && doctor) {
        console.log('🔍 Original pharmacist.connectedDoctors:', pharmacist.connectedDoctors)
        console.log('🔍 Original doctor.connectedPharmacists:', doctor.connectedPharmacists)
        console.log('🔍 Doctor ID to remove:', doctor.id)
        console.log('🔍 Pharmacist ID to remove:', pharmacistId)
        
        // Remove doctor from pharmacist's connectedDoctors
        const pharmacistConnectedDoctors = pharmacist.connectedDoctors || []
        const updatedConnectedDoctors = pharmacistConnectedDoctors.filter(id => {
          const shouldKeep = id !== doctor.id
          console.log(`🔍 Pharmacist connectedDoctors: ${id} !== ${doctor.id} = ${shouldKeep}`)
          return shouldKeep
        })
        
        // Remove pharmacist from doctor's connectedPharmacists
        const doctorConnectedPharmacists = doctor.connectedPharmacists || []
        const updatedConnectedPharmacists = doctorConnectedPharmacists.filter(id => {
          const shouldKeep = id !== pharmacistId
          console.log(`🔍 Doctor connectedPharmacists: ${id} !== ${pharmacistId} = ${shouldKeep}`)
          return shouldKeep
        })
        
        console.log('🔍 Updated pharmacist connectedDoctors:', updatedConnectedDoctors)
        console.log('🔍 Updated doctor connectedPharmacists:', updatedConnectedPharmacists)
        
        // Update both pharmacist and doctor in Firebase
        console.log('🔄 Updating pharmacist in Firebase...')
        const updatedPharmacist = await firebaseStorage.updatePharmacist({
          id: pharmacist.id,
          connectedDoctors: updatedConnectedDoctors
        })
        console.log('✅ Pharmacist updated:', updatedPharmacist)
        
        console.log('🔄 Updating doctor in Firebase...')
        const updatedDoctor = await firebaseStorage.updateDoctor({
          id: doctor.id,
          connectedPharmacists: updatedConnectedPharmacists
        })
        console.log('✅ Doctor updated:', updatedDoctor)
        
        // Verify the updates worked
        console.log('🔍 Verifying updates...')
        const verifyPharmacist = await firebaseStorage.getPharmacistById(pharmacist.id)
        const verifyDoctor = await firebaseStorage.getDoctorByEmail(user.email)
        
        console.log('🔍 Verified pharmacist.connectedDoctors:', verifyPharmacist.connectedDoctors)
        console.log('🔍 Verified doctor.connectedPharmacists:', verifyDoctor.connectedPharmacists)
        
        const pharmacistStillHasDoctor = verifyPharmacist.connectedDoctors && verifyPharmacist.connectedDoctors.includes(doctor.id)
        const doctorStillHasPharmacist = verifyDoctor.connectedPharmacists && verifyDoctor.connectedPharmacists.includes(pharmacistId)
        
        console.log('🔍 Pharmacist still has doctor:', pharmacistStillHasDoctor)
        console.log('🔍 Doctor still has pharmacist:', doctorStillHasPharmacist)
        
        if (pharmacistStillHasDoctor || doctorStillHasPharmacist) {
          console.error('❌ Disconnection failed - connection still exists')
          notifyError('Disconnection failed. Please try again.')
          return
        }
        
        console.log('✅ Successfully disconnected pharmacist from both sides')
        notifySuccess('Pharmacist disconnected successfully')
        
        // Add a small delay to ensure Firebase has time to update
        setTimeout(async () => {
          console.log('🔄 Refreshing pharmacists list after disconnection...')
          await loadPharmacists(true)
        }, 500)
      } else {
        console.error('❌ Missing pharmacist or doctor data')
        notifyError('Failed to disconnect pharmacist - missing data')
      }
    } catch (error) {
      console.error('❌ Error disconnecting pharmacist:', error)
      notifyError('Failed to disconnect pharmacist: ' + error.message)
    }
  }
  
  // Filter pharmacists based on search
  $: filteredPharmacists = pharmacists.filter(pharmacist =>
    pharmacist.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pharmacist.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pharmacist.pharmacistNumber.includes(searchQuery)
  )
  
  // Reactive statements to ensure UI updates
  $: console.log('🔄 Reactive update - connectedPharmacists:', connectedPharmacists.length, 'pharmacists:', pharmacists.length, 'refreshTrigger:', refreshTrigger)
  $: connectedPharmacists = connectedPharmacists // Force reactivity
  $: pharmacists = pharmacists // Force reactivity
  
  onMount(() => {
    loadPharmacists()
  })
</script>

<div class="max-w-screen-xl mx-auto px-4 py-6">
  <!-- Header -->
  <div class="flex justify-between items-center mb-6">
    <div>
      <h4 class="text-2xl font-bold text-gray-900 mb-1">
        <i class="fas fa-pills mr-2 text-blue-600"></i>
        Pharmacist Management
      </h4>
      <p class="text-gray-500 mb-0">Connect with pharmacists to share prescriptions</p>
    </div>
    <button 
      class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 relative"
      on:click={openConnectModal}
      type="button"
      style="z-index: 1000;"
    >
      <i class="fas fa-plus mr-2"></i>
      Connect Pharmacist
    </button>
  </div>
  
  <!-- Add Pharmacist Form -->
  {#if showAddForm}
    <div class="bg-white border-2 border-blue-200 rounded-lg shadow-sm mb-6">
      <div class="bg-blue-600 text-white px-4 py-3 rounded-t-lg">
        <h6 class="text-lg font-semibold mb-0">
          <i class="fas fa-link mr-2"></i>
          Connect to Pharmacist
        </h6>
      </div>
      <div class="p-4">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div class="md:col-span-8">
            <div class="mb-4">
              <label for="pharmacistNumber" class="block text-sm font-medium text-gray-700 mb-1">
                Pharmacist Number <span class="text-red-500">*</span>
              </label>
              <div class="flex">
                <span class="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg">
                  <i class="fas fa-hashtag"></i>
                </span>
                <input
                  type="text"
                  id="pharmacistNumber"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  bind:value={pharmacistNumber}
                  placeholder="Enter 6-digit pharmacist number"
                  maxlength="6"
                  pattern="[0-9]{6}"
                />
              </div>
              <div class="text-sm text-gray-500 mt-1">
                Ask the pharmacist for their unique 6-digit number to connect.
              </div>
            </div>
          </div>
          <div class="md:col-span-4 flex items-end">
            <div class="flex gap-2 w-full">
              <button 
                class="flex-1 inline-flex items-center justify-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                on:click={connectPharmacist}
                disabled={!pharmacistNumber || pharmacistNumber.length !== 6}
              >
                <i class="fas fa-link mr-1"></i>
                Connect
              </button>
              <button 
                class="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
                on:click={() => {
                  showAddForm = false
                  pharmacistNumber = ''
                }}
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Connected Pharmacists -->
  <div class="mb-6">
    <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div class="bg-teal-600 text-white px-4 py-3 rounded-t-lg">
        <h6 class="text-lg font-semibold mb-0">
          <i class="fas fa-check-circle mr-2"></i>
          Connected Pharmacists ({connectedPharmacists.length})
        </h6>
      </div>
      <div class="p-4">
          {#if connectedPharmacists.length === 0}
            <div class="text-center py-8">
              <i class="fas fa-pills text-4xl text-gray-400 mb-3"></i>
              <h5 class="text-gray-500">No Connected Pharmacists</h5>
              <p class="text-gray-500">Connect with pharmacists to start sharing prescriptions.</p>
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {#each connectedPharmacists as pharmacist}
                <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm h-full">
                  <div class="p-4">
                    <div class="flex justify-between items-start mb-3">
                      <h6 class="text-lg font-semibold text-teal-600 mb-0">
                        {pharmacist.businessName}
                      </h6>
                        <button 
                          class="inline-flex items-center px-2 py-1 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
                          on:click={() => disconnectPharmacist(pharmacist.id)}
                          title="Disconnect"
                        >
                          <i class="fas fa-unlink"></i>
                        </button>
                      </div>
                      <p class="text-gray-500 text-sm mb-2">
                        <i class="fas fa-envelope mr-1"></i>
                        {pharmacist.email}
                      </p>
                      <p class="text-gray-500 text-sm mb-2">
                        <i class="fas fa-hashtag mr-1"></i>
                        ID: {pharmacist.pharmacistNumber}
                      </p>
                      <p class="text-gray-500 text-sm mb-0">
                        <i class="fas fa-calendar mr-1"></i>
                        Connected: {new Date(pharmacist.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  
</div>

<!-- Connect Pharmacist Modal -->
{#if showConnectModal}
  <div id="connectModal" tabindex="-1" aria-hidden="true" class="fixed inset-0 z-50 w-full p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] max-h-full">
    <div class="relative w-full max-w-2xl max-h-full mx-auto">
      <div class="relative bg-white rounded-lg shadow dark:bg-gray-700">
        <div class="flex items-center justify-between p-5 border-b rounded-t dark:border-gray-600">
          <h3 class="text-xl font-medium text-gray-900 dark:text-white">
            <i class="fas fa-link mr-2"></i>
            Connect to Pharmacist
          </h3>
          <button 
            type="button" 
            class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white" 
            data-modal-hide="connectModal"
            on:click={closeConnectModal}
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
            </svg>
            <span class="sr-only">Close modal</span>
          </button>
        </div>
        <div class="p-6">
          <div class="mb-4">
            <label for="modalPharmacistNumber" class="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Pharmacist Number <span class="text-red-500">*</span>
            </label>
            <div class="flex">
              <span class="inline-flex items-center px-3 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-600 border border-r-0 border-gray-300 dark:border-gray-500 rounded-l-lg">
                <i class="fas fa-hashtag"></i>
              </span>
              <input
                type="text"
                id="modalPharmacistNumber"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-r-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                bind:value={pharmacistNumber}
                placeholder="Enter 6-digit pharmacist number"
                maxlength="6"
                pattern="[0-9]{6}"
                autofocus
              />
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-300 mt-1">
              <i class="fas fa-info-circle mr-1"></i>
              Ask the pharmacist for their unique 6-digit number to connect.
            </div>
          </div>
          
          <!-- Own Pharmacy Checkbox -->
          <div class="mb-4">
            <div class="flex items-center">
              <input 
                class="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 rounded focus:ring-blue-500 focus:ring-2 mr-3" 
                type="checkbox" 
                id="isOwnPharmacy"
                bind:checked={isOwnPharmacy}
              />
              <label class="text-sm font-medium text-gray-900 dark:text-white" for="isOwnPharmacy">
                <i class="fas fa-home mr-2 text-blue-600"></i>
                This is my own pharmacy
              </label>
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-300 mt-1">
              <i class="fas fa-info-circle mr-1"></i>
              Check this if you are connecting to your own pharmacy/pharmacy business.
            </div>
          </div>
        </div>
        <div class="flex items-center p-6 space-x-2 border-t border-gray-200 rounded-b dark:border-gray-600">
          <button 
            type="button" 
            class="py-2.5 px-5 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-600 dark:text-white dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-500 transition-colors duration-200"
            on:click={closeConnectModal}
          >
            <i class="fas fa-times mr-1"></i>
            Cancel
          </button>
          <button 
            type="button" 
            class="text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200" 
            on:click={connectPharmacist}
            disabled={!pharmacistNumber || pharmacistNumber.length !== 6}
          >
            <i class="fas fa-link mr-1"></i>
            Connect
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .card {
    border-radius: 10px;
  }
  
  .btn {
    border-radius: 6px;
  }
  
  .input-group-text {
    background-color: var(--bs-light);
    border-color: var(--bs-border-color);
  }
  
  .form-control:focus {
    border-color: var(--bs-primary);
    box-shadow: 0 0 0 0.2rem rgba(var(--bs-primary-rgb), 0.25);
  }
  
  /* Ensure button is clickable */
  .btn {
    cursor: pointer !important;
    pointer-events: auto !important;
  }
  
  .btn:disabled {
    cursor: not-allowed !important;
    opacity: 0.6;
  }
</style>
