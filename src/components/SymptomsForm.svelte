<script>
  import { createEventDispatcher } from 'svelte'
  
  export let visible = true
  
  const dispatch = createEventDispatcher()
  
  let description = ''
  let severity = 'mild'
  let duration = ''
  let onsetDate = ''
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
      if (!description || !onsetDate) {
        throw new Error('Please fill in all required fields')
      }
      
      // Validate onset date
      const onsetDateObj = new Date(onsetDate)
      const today = new Date()
      if (onsetDateObj > today) {
        throw new Error('Onset date cannot be in the future')
      }
      
      const symptomsData = {
        description: description.trim(),
        severity,
        duration: duration.trim(),
        onsetDate,
        notes: notes.trim()
      }
      
      dispatch('symptoms-added', symptomsData)
      
      // Reset form
      description = ''
      severity = 'mild'
      duration = ''
      onsetDate = ''
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

<div class="card border-2 border-info shadow-sm">
  <div class="card-header">
    <h6 class="mb-0">
      <i class="fas fa-thermometer-half me-2"></i>Add New Symptoms
    </h6>
  </div>
  <div class="card-body">
    <form on:submit={handleSubmit}>
      <div class="mb-3">
        <label for="symptomsDescription" class="form-label">Symptom Description *</label>
        <textarea 
          class="form-control" 
          id="symptomsDescription" 
          rows="3" 
          bind:value={description}
          required
          disabled={loading}
          placeholder="Describe the symptoms in detail (e.g., chest pain, shortness of breath, fever)"
        ></textarea>
      </div>
      
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="symptomsSeverity" class="form-label">Severity</label>
            <select 
              class="form-select" 
              id="symptomsSeverity" 
              bind:value={severity}
              disabled={loading}
            >
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="symptomsDuration" class="form-label">Duration</label>
            <input 
              type="text" 
              class="form-control" 
              id="symptomsDuration" 
              bind:value={duration}
              disabled={loading}
              placeholder="e.g., 2 hours, 3 days, 1 week"
            >
          </div>
        </div>
      </div>
      
      <div class="mb-3">
        <label for="symptomsOnsetDate" class="form-label">Onset Date *</label>
        <input 
          type="date" 
          class="form-control" 
          id="symptomsOnsetDate" 
          bind:value={onsetDate}
          required
          disabled={loading}
        >
      </div>
      
      <div class="mb-3">
        <label for="symptomsNotes" class="form-label">Additional Notes</label>
        <textarea 
          class="form-control" 
          id="symptomsNotes" 
          rows="2" 
          bind:value={notes}
          disabled={loading}
          placeholder="Any additional notes about the symptoms (triggers, patterns, etc.)"
        ></textarea>
      </div>
      
      {#if error}
        <div class="alert alert-danger" role="alert">
          <i class="fas fa-exclamation-triangle me-2"></i>{error}
        </div>
      {/if}
      
      <div class="d-flex flex-column flex-sm-row gap-2">
        <button 
          type="submit" 
          class="btn btn-primary flex-fill" 
          disabled={loading}
        >
          {#if loading}
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
          {/if}
          <i class="fas fa-save me-1"></i>Save Symptoms
        </button>
        <button 
          type="button" 
          class="btn btn-secondary flex-fill" 
          on:click={handleCancel}
          disabled={loading}
        >
          <i class="fas fa-times me-1"></i>Cancel
        </button>
      </div>
    </form>
  </div>
</div>
