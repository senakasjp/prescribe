<script>
  import { onMount } from 'svelte'
  
  export let prescriptions = []
  
  // Pagination state
  let currentPage = 1
  let itemsPerPage = 5 // Show 5 prescriptions per page
  
  // Helper function to group medications by prescription
  const getPrescriptionsWithMedications = () => {
    const prescriptionsWithMedications = prescriptions
      .filter(prescription => prescription.medications && prescription.medications.length > 0)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    
    console.log('🔍 PrescriptionList: Total prescriptions:', prescriptions.length)
    console.log('🔍 PrescriptionList: Prescriptions with medications:', prescriptionsWithMedications.length)
    console.log('🔍 PrescriptionList: Prescription data:', prescriptions)
    
    return prescriptionsWithMedications
  }
  
  const allPrescriptions = getPrescriptionsWithMedications()
  
  // Pagination calculations
  $: totalPages = Math.ceil(allPrescriptions.length / itemsPerPage)
  $: startIndex = (currentPage - 1) * itemsPerPage
  $: endIndex = startIndex + itemsPerPage
  $: prescriptionsWithMedications = allPrescriptions.slice(startIndex, endIndex)
  
  // Reset to first page when prescriptions change
  $: if (allPrescriptions.length > 0) {
    currentPage = 1
  }
  
  // Helper function to format prescription date
  const formatPrescriptionDate = (dateString) => {
    if (!dateString) return 'Unknown date'
    return new Date(dateString).toLocaleDateString()
  }
  
  // Pagination functions
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      currentPage = page
    }
  }
  
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      currentPage--
    }
  }
  
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      currentPage++
    }
  }
</script>

{#if prescriptionsWithMedications && prescriptionsWithMedications.length > 0}
  <div class="space-y-4">
    {#each prescriptionsWithMedications as prescription, prescriptionIndex}
      <div class="bg-white rounded-lg shadow-sm border-2 {prescriptionIndex % 2 === 0 ? 'border-teal-200' : 'border-teal-200'}">
        <!-- Prescription Header -->
        <div class="bg-teal-600 text-white px-4 py-3 rounded-t-lg">
          <div class="flex items-center">
            <i class="fas fa-prescription-bottle-alt mr-2"></i>
            <h6 class="text-lg font-semibold mb-0">
              Prescription #{prescriptionIndex + 1} on {formatPrescriptionDate(prescription.createdAt)}
            </h6>
          </div>
          {#if prescription.notes}
            <div class="text-sm opacity-90 mt-1">
              <i class="fas fa-sticky-note mr-1"></i>
              {prescription.notes}
            </div>
          {/if}
        </div>
        
        <!-- Medications List -->
        <div class="divide-y divide-gray-200">
          {#each prescription.medications as medication, medicationIndex}
            <div class="p-4 {medicationIndex === prescription.medications.length - 1 ? '' : 'border-b border-gray-200'}">
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div class="col-span-full">
                  <h6 class="text-lg font-semibold text-teal-600 mb-2">
                    <i class="fas fa-pills mr-2"></i>
                    {medication.name || 'Unknown Medication'}
                  </h6>
                </div>
                <div>
                  <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Dosage</div>
                  <div class="font-semibold text-gray-900">{medication.dosage || 'Not specified'}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Duration</div>
                  <div class="font-semibold text-gray-900">{medication.duration || 'Not specified'}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Frequency</div>
                  <div class="font-semibold text-gray-900">{medication.frequency || 'Not specified'}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Added</div>
                  <div class="text-gray-600">
                    <i class="fas fa-calendar mr-1"></i>
                    {medication.createdAt ? new Date(medication.createdAt).toLocaleDateString() : 'Unknown date'}
                  </div>
                </div>
                <div class="col-span-full">
                  <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Instructions</div>
                  <p class="text-gray-700">{medication.instructions || 'No instructions provided'}</p>
                </div>
                {#if medication.notes}
                  <div class="col-span-full">
                    <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</div>
                    <p class="text-teal-600">{medication.notes}</p>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
    
    <!-- Pagination Controls -->
    {#if totalPages > 1}
      <div class="flex items-center justify-between mt-6 px-4 py-3 bg-gray-50 rounded-lg">
        <div class="flex items-center text-sm text-gray-700">
          <span>Showing {startIndex + 1} to {Math.min(endIndex, allPrescriptions.length)} of {allPrescriptions.length} prescriptions</span>
        </div>
        
        <div class="flex items-center space-x-2">
          <!-- Previous Button -->
          <button 
            class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={goToPreviousPage}
            disabled={currentPage === 1}
          >
            <i class="fas fa-chevron-left mr-1"></i>
            Previous
          </button>
          
          <!-- Page Numbers -->
          <div class="flex items-center space-x-1">
            {#each Array.from({length: Math.min(5, totalPages)}, (_, i) => {
              const startPage = Math.max(1, currentPage - 2)
              const endPage = Math.min(totalPages, startPage + 4)
              const page = startPage + i
              return page <= endPage ? page : null
            }).filter(Boolean) as page}
              <button 
                class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg {currentPage === page ? 'text-white bg-teal-600 border-teal-600' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
                on:click={() => goToPage(page)}
              >
                {page}
              </button>
            {/each}
          </div>
          
          <!-- Next Button -->
          <button 
            class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={goToNextPage}
            disabled={currentPage === totalPages}
          >
            Next
            <i class="fas fa-chevron-right ml-1"></i>
          </button>
        </div>
      </div>
    {/if}
  </div>
{:else}
  <div class="text-center py-8">
    <i class="fas fa-pills text-4xl text-gray-400 mb-3"></i>
    <p class="text-gray-500">No prescriptions found for this patient.</p>
  </div>
{/if}

