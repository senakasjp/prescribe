<script>
  import { createEventDispatcher } from 'svelte'
  
  export let visible = true
  
  const dispatch = createEventDispatcher()
  
  let name = ''
  let description = ''
  let status = 'active'
  let diagnosisDate = ''
  let notes = ''
  let error = ''
  let loading = false
  
  // Reset loading state when form is hidden
  $: if (!visible) {
    loading = false
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    error = ''
    loading = true
    
    try {
      // Validate required fields
      if (!name || !diagnosisDate) {
        throw new Error('Please fill in all required fields')
      }
      
      // Validate diagnosis date
      const diagnosisDateObj = new Date(diagnosisDate)
      const today = new Date()
      if (diagnosisDateObj > today) {
        throw new Error('Diagnosis date cannot be in the future')
      }
      
      const illnessData = {
        name: name.trim(),
        description: description.trim(),
        status,
        diagnosisDate,
        notes: notes.trim()
      }
      
      dispatch('illness-added', illnessData)
      
      // Reset form
      name = ''
      description = ''
      status = 'active'
      diagnosisDate = ''
      notes = ''
      
    } catch (err) {
      error = err.message
      console.error('Form validation error:', err)
    } finally {
      loading = false
    }
  }
  
  // Handle cancel
  const handleCancel = () => {
    dispatch('cancel')
  }
</script>

<div class="card">
  <div class="card-header">
    <h6 class="mb-0">
      <i class="fas fa-heartbeat me-2"></i>Add New Illness
    </h6>
  </div>
  <div class="card-body">
    <form on:submit={handleSubmit}>
      <div class="mb-3">
        <label for="illnessName" class="form-label">Illness Name *</label>
        <input 
          type="text" 
          class="form-control" 
          id="illnessName" 
          bind:value={name}
          required
          disabled={loading}
          placeholder="e.g., Diabetes, Hypertension"
        >
      </div>
      
      <div class="mb-3">
        <label for="illnessDescription" class="form-label">Description</label>
        <textarea 
          class="form-control" 
          id="illnessDescription" 
          rows="3" 
          bind:value={description}
          disabled={loading}
          placeholder="Describe the illness, symptoms, or condition"
        ></textarea>
      </div>
      
      <div class="row">
        <div class="col-md-6">
          <div class="mb-3">
            <label for="illnessStatus" class="form-label">Status</label>
            <select 
              class="form-select" 
              id="illnessStatus" 
              bind:value={status}
              disabled={loading}
            >
              <option value="active">Active</option>
              <option value="chronic">Chronic</option>
              <option value="resolved">Resolved</option>
              <option value="monitoring">Under Monitoring</option>
            </select>
          </div>
        </div>
        <div class="col-md-6">
          <div class="mb-3">
            <label for="diagnosisDate" class="form-label">Diagnosis Date *</label>
            <input 
              type="date" 
              class="form-control" 
              id="diagnosisDate" 
              bind:value={diagnosisDate}
              required
              disabled={loading}
            >
          </div>
        </div>
      </div>
      
      <div class="mb-3">
        <label for="illnessNotes" class="form-label">Additional Notes</label>
        <textarea 
          class="form-control" 
          id="illnessNotes" 
          rows="2" 
          bind:value={notes}
          disabled={loading}
          placeholder="Any additional notes about the illness"
        ></textarea>
      </div>
      
      {#if error}
        <div class="alert alert-danger" role="alert">
          <i class="fas fa-exclamation-triangle me-2"></i>{error}
        </div>
      {/if}
      
      <div class="d-flex gap-2">
        <button 
          type="submit" 
          class="btn btn-primary" 
          disabled={loading}
        >
          {#if loading}
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
          {/if}
          <i class="fas fa-save me-1"></i>Save Illness
        </button>
        <button 
          type="button" 
          class="btn btn-secondary" 
          on:click={handleCancel}
          disabled={loading}
        >
          <i class="fas fa-times me-1"></i>Cancel
        </button>
      </div>
    </form>
  </div>
</div>
