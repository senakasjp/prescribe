<script>
  import { createEventDispatcher } from 'svelte'
  import DrugAutocomplete from './DrugAutocomplete.svelte'
  import drugDatabase from '../services/drugDatabase.js'
  import { notifySuccess, notifyInfo } from '../stores/notifications.js'
  
  export let visible = true
  export let editingMedication = null
  export let doctorId = null
  
  const dispatch = createEventDispatcher()
  
  let name = ''
  let dosage = ''
  let instructions = ''
  let frequency = ''
  let duration = ''
  let startDate = ''
  let endDate = ''
  let notes = ''
  let error = ''
  let loading = false
  
  // Reset loading state when form is hidden
  $: if (!visible) {
    loading = false
  }
  
  // Track if form has been initialized for editing
  let formInitialized = false
  
  // Populate form when editing (only once)
  $: if (editingMedication && !formInitialized) {
    name = editingMedication.name || ''
    dosage = editingMedication.dosage || ''
    instructions = editingMedication.instructions || ''
    frequency = editingMedication.frequency || ''
    duration = editingMedication.duration || ''
    startDate = editingMedication.startDate || ''
    endDate = editingMedication.endDate || ''
    notes = editingMedication.notes || ''
    formInitialized = true
  }
  
  // Reset form when not editing
  $: if (!editingMedication && visible) {
    name = ''
    dosage = ''
    instructions = ''
    frequency = ''
    duration = ''
    startDate = ''
    endDate = ''
    notes = ''
    error = ''
    formInitialized = false
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    error = ''
    loading = true
    
    try {
      // Validate required fields
      if (!name || !dosage || !instructions || !frequency || !startDate) {
        throw new Error('Please fill in all required fields')
      }
      
      // Validate dates
      const startDateObj = new Date(startDate)
      
      if (endDate) {
        const endDateObj = new Date(endDate)
        if (endDateObj <= startDateObj) {
          throw new Error('End date must be after start date')
        }
      }
      
      const medicationData = {
        name: name.trim(),
        dosage: dosage.trim(),
        instructions: instructions.trim(),
        frequency,
        duration: duration.trim(),
        startDate,
        endDate: endDate || null,
        notes: notes.trim()
      }
      
      // Add editing information if in edit mode
      if (editingMedication) {
        medicationData.id = editingMedication.id
        medicationData.isEdit = true
      }
      
      // Save to drug database for future autocomplete
      if (doctorId) {
        const existingDrug = drugDatabase.getDoctorDrugs(doctorId).find(drug => 
          drug.name === name.trim().toLowerCase()
        )
        
        drugDatabase.addDrug(doctorId, {
          name: name.trim(),
          dosage: dosage.trim(),
          instructions: instructions.trim(),
          frequency,
          duration: duration.trim(),
          notes: notes.trim()
        })
        
        // Show notification
        if (existingDrug) {
          notifyInfo(`"${name.trim()}" updated in your drug database`)
        } else {
          notifySuccess(`"${name.trim()}" added to your drug database`)
        }
      }
      
      dispatch('medication-added', medicationData)
      
      // Reset form
      name = ''
      dosage = ''
      instructions = ''
      frequency = ''
      duration = ''
      startDate = ''
      endDate = ''
      notes = ''
      
    } catch (err) {
      error = err.message
      console.error('Form validation error:', err)
    } finally {
      loading = false
    }
  }
  
  // Handle drug selection from autocomplete
  const handleDrugSelect = (drug) => {
    name = drug.displayName
    // Only update other fields if they're empty (not when editing)
    if (!editingMedication) {
      dosage = drug.dosage || dosage
      instructions = drug.instructions || instructions
      frequency = drug.frequency || frequency
      duration = drug.duration || duration
      notes = drug.notes || notes
    }
    
    // Show notification
    notifyInfo(`"${drug.displayName}" loaded from your drug database`)
  }
  
  // Handle cancel
  const handleCancel = () => {
    dispatch('cancel')
  }
</script>

<div class="card">
  <div class="card-header">
    <h6 class="mb-0">
      <i class="fas fa-pills me-2"></i>Add New Medication
    </h6>
  </div>
  <div class="card-body">
    <form on:submit={handleSubmit}>
      <div class="mb-3">
        <label for="medicationName" class="form-label">Medication Name *</label>
        <DrugAutocomplete 
          bind:value={name}
          placeholder="e.g., Metformin, Lisinopril"
          {doctorId}
          onDrugSelect={handleDrugSelect}
          disabled={loading}
        />
      </div>
      
      <div class="row">
        <div class="col-md-6">
          <div class="mb-3">
            <label for="medicationDosage" class="form-label">Dosage *</label>
            <input 
              type="text" 
              class="form-control" 
              id="medicationDosage" 
              bind:value={dosage}
              required
              disabled={loading}
              placeholder="e.g., 500mg, 10ml"
            >
          </div>
        </div>
        <div class="col-md-6">
          <div class="mb-3">
            <label for="medicationFrequency" class="form-label">Frequency *</label>
            <select 
              class="form-select" 
              id="medicationFrequency" 
              bind:value={frequency}
              required
              disabled={loading}
            >
              <option value="">Select frequency</option>
              <option value="once daily">Once daily</option>
              <option value="twice daily">Twice daily</option>
              <option value="three times daily">Three times daily</option>
              <option value="four times daily">Four times daily</option>
              <option value="as needed">As needed</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="mb-3">
        <label for="medicationInstructions" class="form-label">Instructions *</label>
        <textarea 
          class="form-control" 
          id="medicationInstructions" 
          rows="2" 
          bind:value={instructions}
          required
          disabled={loading}
          placeholder="e.g., Take with food, Take before bedtime"
        ></textarea>
      </div>
      
      <div class="row">
        <div class="col-md-4">
          <div class="mb-3">
            <label for="medicationDuration" class="form-label">Duration</label>
            <input 
              type="text" 
              class="form-control" 
              id="medicationDuration" 
              bind:value={duration}
              disabled={loading}
              placeholder="e.g., 30 days, 3 months"
            >
          </div>
        </div>
        <div class="col-md-4">
          <div class="mb-3">
            <label for="medicationStartDate" class="form-label">Start Date *</label>
            <input 
              type="date" 
              class="form-control" 
              id="medicationStartDate" 
              bind:value={startDate}
              required
              disabled={loading}
            >
          </div>
        </div>
        <div class="col-md-4">
          <div class="mb-3">
            <label for="medicationEndDate" class="form-label">End Date</label>
            <input 
              type="date" 
              class="form-control" 
              id="medicationEndDate" 
              bind:value={endDate}
              disabled={loading}
            >
          </div>
        </div>
      </div>
      
      <div class="mb-3">
        <label for="medicationNotes" class="form-label">Additional Notes</label>
        <textarea 
          class="form-control" 
          id="medicationNotes" 
          rows="2" 
          bind:value={notes}
          disabled={loading}
          placeholder="Any additional notes about the medication"
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
          <i class="fas fa-save me-1"></i>Save Medication
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
