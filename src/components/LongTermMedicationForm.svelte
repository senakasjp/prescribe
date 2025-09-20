<script>
  import { createEventDispatcher } from 'svelte'
  
  export let visible = true
  export let editingMedication = null // Medication data when editing
  
  const dispatch = createEventDispatcher()
  
  let medicationName = ''
  let dosage = ''
  let frequency = ''
  let startDate = ''
  let notes = ''
  let error = ''
  let loading = false
  
  // Reset loading state when form is hidden
  $: if (!visible) {
    loading = false
  }
  
  // Populate form when editing
  $: if (editingMedication) {
    medicationName = editingMedication.medicationName || ''
    dosage = editingMedication.dosage || ''
    frequency = editingMedication.frequency || ''
    startDate = editingMedication.startDate || ''
    notes = editingMedication.notes || ''
  }
  
  // Reset form when not editing
  $: if (!editingMedication && visible) {
    medicationName = ''
    dosage = ''
    frequency = ''
    startDate = ''
    notes = ''
    error = ''
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    error = ''
    loading = true
    
    try {
      // Validate required fields
      if (!medicationName.trim() || !dosage.trim() || !frequency.trim()) {
        throw new Error('Please fill in medication name, dosage, and frequency')
      }
      
      // Validate start date
      if (startDate) {
        const startDateObj = new Date(startDate)
        const today = new Date()
        if (startDateObj > today) {
          throw new Error('Start date cannot be in the future')
        }
      }
      
      const longTermMedicationData = {
        medicationName: medicationName.trim(),
        dosage: dosage.trim(),
        frequency: frequency.trim(),
        startDate: startDate || '',
        notes: notes.trim()
      }
      
      if (editingMedication) {
        // Editing existing medication
        dispatch('long-term-medication-updated', {
          id: editingMedication.id,
          data: longTermMedicationData
        })
      } else {
        // Adding new medication
        dispatch('long-term-medication-added', longTermMedicationData)
      }
      
      // Reset form
      medicationName = ''
      dosage = ''
      frequency = ''
      startDate = ''
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
      <i class="fas fa-pills me-2"></i>{editingMedication ? 'Edit Long-Term Medication' : 'Add Long-Term Medication'}
    </h6>
  </div>
  <div class="card-body">
    <form on:submit={handleSubmit}>
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="medicationName" class="form-label">
              <i class="fas fa-capsules me-1"></i>Medication Name *
            </label>
            <input 
              type="text" 
              class="form-control" 
              id="medicationName" 
              bind:value={medicationName}
              required
              disabled={loading}
              placeholder="e.g., Lisinopril, Metformin, Aspirin"
            >
          </div>
        </div>
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="dosage" class="form-label">
              <i class="fas fa-weight me-1"></i>Dosage *
            </label>
            <input 
              type="text" 
              class="form-control" 
              id="dosage" 
              bind:value={dosage}
              required
              disabled={loading}
              placeholder="e.g., 10mg, 500mg, 81mg"
            >
          </div>
        </div>
      </div>
      
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="frequency" class="form-label">
              <i class="fas fa-clock me-1"></i>Frequency *
            </label>
            <select 
              class="form-select" 
              id="frequency" 
              bind:value={frequency}
              required
              disabled={loading}
            >
              <option value="">Select Frequency</option>
              <option value="Once daily">Once daily</option>
              <option value="Twice daily">Twice daily</option>
              <option value="Three times daily">Three times daily</option>
              <option value="Four times daily">Four times daily</option>
              <option value="As needed">As needed</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="startDate" class="form-label">
              <i class="fas fa-calendar me-1"></i>Start Date
            </label>
            <input 
              type="date" 
              class="form-control" 
              id="startDate" 
              bind:value={startDate}
              disabled={loading}
            >
          </div>
        </div>
      </div>
      
      <div class="mb-3">
        <label for="notes" class="form-label">
          <i class="fas fa-sticky-note me-1"></i>Additional Notes
        </label>
        <textarea 
          class="form-control" 
          id="notes" 
          rows="3" 
          bind:value={notes}
          disabled={loading}
          placeholder="Any additional notes about this medication (side effects, instructions, etc.)"
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
          <i class="fas fa-save me-1"></i>{editingMedication ? 'Update Medication' : 'Save Medication'}
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
