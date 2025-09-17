<script>
  import { onMount } from 'svelte'
  import firebaseStorage from '../services/firebaseStorage.js'
  import { notifySuccess, notifyError } from '../stores/notifications.js'
  
  export let user
  
  let pharmacists = []
  let connectedPharmacists = []
  let loading = true
  let showAddForm = false
  let showConnectModal = false
  let pharmacistNumber = ''
  let searchQuery = ''
  let isOwnPharmacy = false
  
  // Load pharmacists data
  const loadPharmacists = async () => {
    try {
      loading = true
      const allPharmacists = await firebaseStorage.getAllPharmacists()
      
      // Get the actual doctor data from Firebase to get the correct doctor ID
      const doctor = await firebaseStorage.getDoctorByEmail(user.email)
      const doctorId = doctor?.id
      
      // Separate connected and unconnected pharmacists (check both sides of the connection)
      connectedPharmacists = allPharmacists.filter(pharmacist => {
        // Check if pharmacist has this doctor in their connectedDoctors
        const pharmacistHasDoctor = pharmacist.connectedDoctors && pharmacist.connectedDoctors.includes(doctorId)
        
        // Check if doctor has this pharmacist in their connectedPharmacists
        const doctorHasPharmacist = doctor.connectedPharmacists && doctor.connectedPharmacists.includes(pharmacist.id)
        
        // Connection exists if either side has the connection (for backward compatibility)
        return pharmacistHasDoctor || doctorHasPharmacist
      })
      
      pharmacists = allPharmacists.filter(pharmacist => {
        // Check if pharmacist has this doctor in their connectedDoctors
        const pharmacistHasDoctor = pharmacist.connectedDoctors && pharmacist.connectedDoctors.includes(doctorId)
        
        // Check if doctor has this pharmacist in their connectedPharmacists
        const doctorHasPharmacist = doctor.connectedPharmacists && doctor.connectedPharmacists.includes(pharmacist.id)
        
        // Not connected if neither side has the connection
        return !pharmacistHasDoctor && !doctorHasPharmacist
      })
      
    } catch (error) {
      console.error('Error loading pharmacists:', error)
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
      const pharmacist = await firebaseStorage.getPharmacistById(pharmacistId)
      const doctor = await firebaseStorage.getDoctorByEmail(user.email)
      
      if (pharmacist && doctor) {
        // Remove doctor from pharmacist's connectedDoctors
        pharmacist.connectedDoctors = pharmacist.connectedDoctors.filter(id => id !== doctor.id)
        
        // Remove pharmacist from doctor's connectedPharmacists
        if (doctor.connectedPharmacists) {
          doctor.connectedPharmacists = doctor.connectedPharmacists.filter(id => id !== pharmacistId)
        }
        
        await firebaseStorage.updatePharmacist(pharmacist)
        notifySuccess('Pharmacist disconnected successfully')
        loadPharmacists()
      }
    } catch (error) {
      notifyError('Failed to disconnect pharmacist')
    }
  }
  
  // Filter pharmacists based on search
  $: filteredPharmacists = pharmacists.filter(pharmacist =>
    pharmacist.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pharmacist.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pharmacist.pharmacistNumber.includes(searchQuery)
  )
  
  onMount(() => {
    loadPharmacists()
  })
</script>

<div class="container-fluid">
  <!-- Header -->
  <div class="d-flex justify-content-between align-items-center mb-4">
    <div>
      <h4 class="fw-bold text-dark mb-1">
        <i class="fas fa-pills me-2 text-primary"></i>
        Pharmacist Management
      </h4>
      <p class="text-muted mb-0">Connect with pharmacists to share prescriptions</p>
    </div>
    <button 
      class="btn btn-primary position-relative"
      on:click={openConnectModal}
      type="button"
      style="z-index: 1000;"
    >
      <i class="fas fa-plus me-2"></i>
      Connect Pharmacist
    </button>
  </div>
  
  <!-- Add Pharmacist Form -->
  {#if showAddForm}
    <div class="card border-primary mb-4">
      <div class="card-header bg-primary text-white">
        <h6 class="card-title mb-0">
          <i class="fas fa-link me-2"></i>
          Connect to Pharmacist
        </h6>
      </div>
      <div class="card-body">
        <div class="row">
          <div class="col-md-8">
            <div class="mb-3">
              <label for="pharmacistNumber" class="form-label fw-bold">
                Pharmacist Number <span class="text-danger">*</span>
              </label>
              <div class="input-group">
                <span class="input-group-text">
                  <i class="fas fa-hashtag"></i>
                </span>
                <input
                  type="text"
                  id="pharmacistNumber"
                  class="form-control"
                  bind:value={pharmacistNumber}
                  placeholder="Enter 6-digit pharmacist number"
                  maxlength="6"
                  pattern="[0-9]{6}"
                />
              </div>
              <div class="form-text">
                Ask the pharmacist for their unique 6-digit number to connect.
              </div>
            </div>
          </div>
          <div class="col-md-4 d-flex align-items-end">
            <div class="d-flex gap-2 w-100">
              <button 
                class="btn btn-success flex-fill"
                on:click={connectPharmacist}
                disabled={!pharmacistNumber || pharmacistNumber.length !== 6}
              >
                <i class="fas fa-link me-1"></i>
                Connect
              </button>
              <button 
                class="btn btn-outline-secondary"
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
  <div class="row mb-4">
    <div class="col-12">
      <div class="card border-0 shadow-sm">
        <div class="card-header bg-success text-white">
          <h6 class="card-title mb-0">
            <i class="fas fa-check-circle me-2"></i>
            Connected Pharmacists ({connectedPharmacists.length})
          </h6>
        </div>
        <div class="card-body">
          {#if connectedPharmacists.length === 0}
            <div class="text-center py-4">
              <i class="fas fa-pills fa-3x text-muted mb-3"></i>
              <h5 class="text-muted">No Connected Pharmacists</h5>
              <p class="text-muted">Connect with pharmacists to start sharing prescriptions.</p>
            </div>
          {:else}
            <div class="row">
              {#each connectedPharmacists as pharmacist}
                <div class="col-md-6 col-lg-4 mb-3">
                  <div class="card border-success h-100">
                    <div class="card-body">
                      <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title fw-bold text-success mb-0">
                          {pharmacist.businessName}
                        </h6>
                        <button 
                          class="btn btn-outline-danger btn-sm"
                          on:click={() => disconnectPharmacist(pharmacist.id)}
                          title="Disconnect"
                        >
                          <i class="fas fa-unlink"></i>
                        </button>
                      </div>
                      <p class="text-muted small mb-2">
                        <i class="fas fa-envelope me-1"></i>
                        {pharmacist.email}
                      </p>
                      <p class="text-muted small mb-2">
                        <i class="fas fa-hashtag me-1"></i>
                        ID: {pharmacist.pharmacistNumber}
                      </p>
                      <p class="text-muted small mb-0">
                        <i class="fas fa-calendar me-1"></i>
                        Connected: {new Date(pharmacist.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
  
  <!-- Available Pharmacists -->
  <div class="row">
    <div class="col-12">
      <div class="card border-0 shadow-sm">
        <div class="card-header bg-info text-white">
          <div class="d-flex justify-content-between align-items-center">
            <h6 class="card-title mb-0">
              <i class="fas fa-search me-2"></i>
              Available Pharmacists ({filteredPharmacists.length})
            </h6>
            <div class="d-flex align-items-center">
              <div class="input-group" style="width: 250px;">
                <span class="input-group-text">
                  <i class="fas fa-search"></i>
                </span>
                <input
                  type="text"
                  class="form-control"
                  bind:value={searchQuery}
                  placeholder="Search pharmacists..."
                />
              </div>
            </div>
          </div>
        </div>
        <div class="card-body">
          {#if loading}
            <div class="text-center py-4">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="mt-2 text-muted">Loading pharmacists...</p>
            </div>
          {:else if filteredPharmacists.length === 0}
            <div class="text-center py-4">
              <i class="fas fa-pills fa-3x text-muted mb-3"></i>
              <h5 class="text-muted">No Available Pharmacists</h5>
              <p class="text-muted">
                {searchQuery ? 'No pharmacists match your search.' : 'No pharmacists are available to connect.'}
              </p>
            </div>
          {:else}
            <div class="row">
              {#each filteredPharmacists as pharmacist}
                <div class="col-md-6 col-lg-4 mb-3">
                  <div class="card border-info h-100">
                    <div class="card-body">
                      <h6 class="card-title fw-bold text-info mb-2">
                        {pharmacist.businessName}
                      </h6>
                      <p class="text-muted small mb-2">
                        <i class="fas fa-envelope me-1"></i>
                        {pharmacist.email}
                      </p>
                      <p class="text-muted small mb-2">
                        <i class="fas fa-hashtag me-1"></i>
                        ID: {pharmacist.pharmacistNumber}
                      </p>
                      <p class="text-muted small mb-0">
                        <i class="fas fa-calendar me-1"></i>
                        Registered: {new Date(pharmacist.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Connect Pharmacist Modal -->
{#if showConnectModal}
  <div class="modal fade show d-block" style="background-color: rgba(var(--bs-dark-rgb), 0.5);" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header bg-primary text-white">
          <h5 class="modal-title">
            <i class="fas fa-link me-2"></i>
            Connect to Pharmacist
          </h5>
          <button type="button" class="btn-close btn-close-white" on:click={closeConnectModal}></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label for="modalPharmacistNumber" class="form-label fw-bold">
              Pharmacist Number <span class="text-danger">*</span>
            </label>
            <div class="input-group">
              <span class="input-group-text">
                <i class="fas fa-hashtag"></i>
              </span>
              <input
                type="text"
                id="modalPharmacistNumber"
                class="form-control"
                bind:value={pharmacistNumber}
                placeholder="Enter 6-digit pharmacist number"
                maxlength="6"
                pattern="[0-9]{6}"
                autofocus
              />
            </div>
            <div class="form-text">
              <i class="fas fa-info-circle me-1"></i>
              Ask the pharmacist for their unique 6-digit number to connect.
            </div>
          </div>
          
          <!-- Own Pharmacy Checkbox -->
          <div class="mb-3">
            <div class="form-check">
              <input 
                class="form-check-input" 
                type="checkbox" 
                id="isOwnPharmacy"
                bind:checked={isOwnPharmacy}
              />
              <label class="form-check-label fw-semibold" for="isOwnPharmacy">
                <i class="fas fa-home me-2 text-primary"></i>
                This is my own pharmacy
              </label>
            </div>
            <div class="form-text">
              <i class="fas fa-info-circle me-1"></i>
              Check this if you are connecting to your own pharmacy/pharmacy business.
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" on:click={closeConnectModal}>
            <i class="fas fa-times me-1"></i>
            Cancel
          </button>
          <button 
            type="button" 
            class="btn btn-primary"
            on:click={connectPharmacist}
            disabled={!pharmacistNumber || pharmacistNumber.length !== 6}
          >
            <i class="fas fa-link me-1"></i>
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
