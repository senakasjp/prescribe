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
</script>

<div class="bg-white border-2 border-blue-200 rounded-lg shadow-sm">
  <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
    <div class="flex justify-between items-center">
      <h6 class="mb-0">
        <i class="fas fa-users mr-2"></i>Patients
      </h6>
      <button 
        class="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded" 
        on:click={onShowAddPatientForm}
        disabled={loading}
      >
        <i class="fas fa-plus mr-1"></i>Add Patient
      </button>
    </div>
  </div>
  <div class="p-0">
    <!-- Search Box -->
    <div class="p-3 border-b border-gray-200">
      <div class="flex">
        <span class="px-3 py-2 bg-gray-50 border border-gray-300 border-r-0 rounded-l-lg">
          <i class="fas fa-search"></i>
        </span>
        <input 
          type="text" 
          class="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
          placeholder="Search patients..." 
          bind:value={searchQuery}
          on:input={onSearch}
        />
        {#if searchQuery}
          <button 
            class="px-3 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded" 
            type="button" 
            on:click={onClearSearch}
          >
            <i class="fas fa-times"></i>
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
          <i class="fas fa-user-slash fa-2x text-muted mb-3"></i>
          <p class="text-muted">
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
        <div class="list-group list-group-flush">
          {#each filteredPatients as patient}
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
                    <p class="mb-1 text-muted small">
                      <i class="fas fa-calendar mr-1"></i>
                      DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}
                    </p>
                  {/if}
                  {#if patient.phone}
                    <p class="mb-0 text-muted small">
                      <i class="fas fa-phone mr-1"></i>
                      {patient.phone}
                    </p>
                  {/if}
                </div>
                <div class="text-end">
                  <small class="text-muted">
                    <i class="fas fa-id-card mr-1"></i>
                    ID: {patient.id.slice(-8)}
                  </small>
                </div>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
