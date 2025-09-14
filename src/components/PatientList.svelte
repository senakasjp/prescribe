<script>
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

<div class="card">
  <div class="card-header bg-light">
    <div class="d-flex justify-content-between align-items-center">
      <h6 class="mb-0">
        <i class="fas fa-users me-2"></i>Patients
      </h6>
      <button 
        class="btn btn-primary btn-sm" 
        on:click={onShowAddPatientForm}
        disabled={loading}
      >
        <i class="fas fa-plus me-1"></i>Add Patient
      </button>
    </div>
  </div>
  <div class="card-body p-0">
    <!-- Search Box -->
    <div class="p-3 border-bottom">
      <div class="input-group">
        <span class="input-group-text">
          <i class="fas fa-search"></i>
        </span>
        <input 
          type="text" 
          class="form-control" 
          placeholder="Search patients..." 
          bind:value={searchQuery}
          on:input={onSearch}
        />
        {#if searchQuery}
          <button 
            class="btn btn-outline-secondary" 
            type="button" 
            on:click={onClearSearch}
          >
            <i class="fas fa-times"></i>
          </button>
        {/if}
      </div>
    </div>

    <!-- Patient List -->
    <div class="p-0" style="overflow-y: auto; max-height: calc(100vh - 200px);">
      {#if loading}
        <div class="text-center p-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mt-2 text-muted">Loading patients...</p>
        </div>
      {:else if filteredPatients.length === 0}
        <div class="text-center p-4">
          <i class="fas fa-user-slash fa-2x text-muted mb-3"></i>
          <p class="text-muted">
            {searchQuery ? 'No patients found matching your search.' : 'No patients added yet.'}
          </p>
          {#if !searchQuery}
            <button 
              class="btn btn-primary btn-sm" 
              on:click={onShowAddPatientForm}
            >
              <i class="fas fa-plus me-1"></i>Add First Patient
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
              <div class="d-flex w-100 justify-content-between align-items-center">
                <div>
                  <h6 class="mb-1">
                    {patient.firstName} {patient.lastName}
                  </h6>
                  <p class="mb-1 text-muted small">
                    <i class="fas fa-calendar me-1"></i>
                    DOB: {patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : 'Not specified'}
                  </p>
                  <p class="mb-0 text-muted small">
                    <i class="fas fa-phone me-1"></i>
                    {patient.phone || 'No phone number'}
                  </p>
                </div>
                <div class="text-end">
                  <small class="text-muted">
                    <i class="fas fa-id-card me-1"></i>
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
