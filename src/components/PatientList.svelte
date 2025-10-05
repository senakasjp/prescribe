<script>
  import LoadingSpinner from './LoadingSpinner.svelte'
  
  export const patients = []
  export let filteredPatients = []
  export let selectedPatient = null
  export let searchQuery = ''
  export let loading = false
  export let onSelectPatient
  export let onSearch
  export let onClearSearch
  export let onShowAddPatientForm
  
  // Pagination for patients
  let currentPage = 1
  let itemsPerPage = 25
  
  // Pagination calculations
  $: totalPages = Math.ceil(filteredPatients.length / itemsPerPage)
  $: startIndex = (currentPage - 1) * itemsPerPage
  $: endIndex = startIndex + itemsPerPage
  $: paginatedPatients = filteredPatients.slice(startIndex, endIndex)
  
  // Reset to first page when filtered patients change
  $: if (filteredPatients.length > 0) {
    currentPage = 1
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

<div class="bg-white border-2 border-blue-200 rounded-lg shadow-sm">
  <div class="bg-gray-50 px-3 sm:px-4 py-3 border-b border-gray-200">
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
      <h6 class="mb-0 text-sm sm:text-base">
        <i class="fas fa-users mr-2"></i>Patients
      </h6>
      <button 
        class="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white rounded w-full sm:w-auto" 
        on:click={onShowAddPatientForm}
        disabled={loading}
      >
        <i class="fas fa-plus mr-1"></i>Add Patient
      </button>
    </div>
  </div>
  <div class="p-0">
    <!-- Search Box -->
    <div class="p-2 sm:p-3 border-b border-gray-200">
      <div class="flex">
        <span class="px-2 sm:px-3 py-2 bg-gray-50 border border-gray-300 border-r-0 rounded-l-lg">
          <i class="fas fa-search text-xs sm:text-sm"></i>
        </span>
        <input 
          type="text" 
          class="flex-1 px-2 sm:px-3 py-2 border border-gray-300 rounded-r-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
          placeholder="Search patients..." 
          bind:value={searchQuery}
          on:input={onSearch}
        />
        {#if searchQuery}
          <button 
            class="px-2 sm:px-3 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded" 
            type="button" 
            on:click={onClearSearch}
          >
            <i class="fas fa-times text-xs sm:text-sm"></i>
          </button>
        {/if}
      </div>
    </div>

    <!-- Patient List -->
    <div class="p-0 overflow-auto" style="max-height: calc(100vh - 200px);">
      {#if loading}
        <LoadingSpinner 
          size="small" 
          color="blue" 
          text="Loading patients..." 
          fullScreen={false}
        />
      {:else if filteredPatients.length === 0}
        <div class="text-center p-4">
          <i class="fas fa-user-slash fa-2x text-gray-400 mb-3"></i>
          <p class="text-gray-600 dark:text-gray-300">
            {searchQuery ? 'No patients found matching your search.' : 'No patients added yet.'}
          </p>
          {#if !searchQuery}
            <button 
              class="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded" 
              on:click={onShowAddPatientForm}
            >
              <i class="fas fa-plus mr-1"></i>Add First Patient
            </button>
          {/if}
        </div>
      {:else}
        <!-- Desktop List View -->
        <div class="hidden md:block list-group list-group-flush">
          {#each paginatedPatients as patient}
            <button 
              class="list-group-item list-group-item-action {selectedPatient?.id === patient.id ? 'active' : ''}"
              on:click={() => onSelectPatient(patient)}
              disabled={loading}
            >
              <div class="flex w-full justify-between items-center">
                <div>
                  {#if patient.firstName || patient.lastName}
                    <h6 class="mb-1">
                      {patient.firstName} {patient.lastName}
                    </h6>
                  {/if}
                  {#if patient.dateOfBirth}
                    <p class="mb-1 text-gray-600 dark:text-gray-300 small">
                      <i class="fas fa-calendar mr-1"></i>
                      DOB: {new Date(patient.dateOfBirth).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </p>
                  {/if}
                  {#if patient.phone}
                    <p class="mb-0 text-gray-600 dark:text-gray-300 small">
                      <i class="fas fa-phone mr-1"></i>
                      {patient.phone}
                    </p>
                  {/if}
                </div>
                <div class="text-end">
                  <small class="text-gray-600 dark:text-gray-300">
                    <i class="fas fa-id-card mr-1"></i>
                    ID: {patient.id.slice(-8)}
                  </small>
                </div>
              </div>
            </button>
          {/each}
        </div>

        <!-- Mobile Card View -->
        <div class="md:hidden space-y-3 p-3">
          {#each paginatedPatients as patient}
            <div 
              class="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors duration-200 {selectedPatient?.id === patient.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''}"
              on:click={() => onSelectPatient(patient)}
              role="button"
              tabindex="0"
              on:keydown={(e) => e.key === 'Enter' && onSelectPatient(patient)}
            >
              <div class="flex justify-between items-start mb-3">
                <div class="flex-1">
                  {#if patient.firstName || patient.lastName}
                    <h3 class="font-semibold text-gray-900 text-sm sm:text-base">
                      {patient.firstName} {patient.lastName}
                    </h3>
                  {/if}
                  <p class="text-xs sm:text-sm text-gray-500">{patient.gender || 'N/A'}</p>
                </div>
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm font-medium bg-blue-100 text-blue-800">
                  ID: {patient.id.slice(-8)}
                </span>
              </div>
              
              <div class="space-y-2">
                {#if patient.dateOfBirth}
                  <div class="flex items-center text-xs sm:text-sm">
                    <i class="fas fa-calendar text-blue-600 mr-2 w-3"></i>
                    <span class="text-gray-600">DOB: {new Date(patient.dateOfBirth).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}</span>
                  </div>
                {/if}
                {#if patient.phone}
                  <div class="flex items-center text-xs sm:text-sm">
                    <i class="fas fa-phone text-green-600 mr-2 w-3"></i>
                    <span class="text-gray-600">{patient.phone}</span>
                  </div>
                {/if}
                {#if patient.email}
                  <div class="flex items-center text-xs sm:text-sm">
                    <i class="fas fa-envelope text-purple-600 mr-2 w-3"></i>
                    <span class="text-gray-600">{patient.email}</span>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
        
        <!-- Pagination Controls -->
        {#if totalPages > 1}
          <div class="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 rounded-lg">
            <div class="flex items-center text-sm text-gray-700">
              <span>Showing {startIndex + 1} to {Math.min(endIndex, filteredPatients.length)} of {filteredPatients.length} patients</span>
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
                    class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg {currentPage === page ? 'text-white bg-blue-600 border-blue-600' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
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
      {/if}
    </div>
  </div>
</div>
