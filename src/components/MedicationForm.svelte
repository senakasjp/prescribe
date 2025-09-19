<script>
  import { createEventDispatcher, onMount } from 'svelte'
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
  let formKey = 0
  
  // Function to reset form to empty state
  const resetForm = () => {
    console.log('🔄 Resetting MedicationForm to empty state')
    // Force reset all variables
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
    formKey++ // Increment key to force DrugAutocomplete reset
    
    // Force a small delay to ensure state updates
    setTimeout(() => {
      console.log('✅ MedicationForm reset complete - final state:', {
        name, dosage, instructions, frequency, duration, startDate, endDate, notes
      })
    }, 10)
  }
  
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
  
  // No reactive reset - only reset on mount to avoid conflicts
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    error = ''
    loading = true
    
    try {
      // Validate required fields
      if (!name || !dosage || !instructions || !frequency || !duration) {
        throw new Error('Please fill in all required fields')
      }
      
      // Validate dates
      const startDateObj = startDate ? new Date(startDate) : new Date() // Default to today if no start date
      
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
        startDate: startDate || new Date().toISOString().split('T')[0], // Default to today if not provided
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
    // Only auto-fill other fields when editing an existing prescription
    // For new prescriptions, only fill the name field
    if (editingMedication) {
      dosage = drug.dosage || dosage
      instructions = drug.instructions || instructions
      frequency = drug.frequency || frequency
      duration = drug.duration || duration
      notes = drug.notes || notes
    }
    
    // Show notification
    notifyInfo(`"${drug.displayName}" selected`)
  }
  
  // Handle cancel
  const handleCancel = () => {
    dispatch('cancel')
  }
  
  // Reset form when component mounts if not editing
  onMount(() => {
    console.log('🚀 MedicationForm mounted - checking if reset needed')
    if (!editingMedication) {
      console.log('🔄 New prescription - resetting to empty state')
      resetForm()
    } else {
      console.log('📝 Editing existing prescription - keeping data')
    }
  })
</script>

<div class="card border-2 border-info shadow-sm medication-form-card">
  <div class="card-header">
    <h6 class="mb-0">
      <i class="fas fa-pills me-2"></i>Add New Medication
    </h6>
  </div>
  <div class="card-body">
    <form on:submit={handleSubmit}>
      <div class="mb-3">
        <label for="medicationName" class="form-label">Medication Name <span class="text-danger">*</span></label>
        <DrugAutocomplete 
          bind:value={name}
          placeholder="e.g., Metformin, Lisinopril"
          {doctorId}
          onDrugSelect={handleDrugSelect}
          disabled={loading}
        />
      </div>
      
      <div class="row">
        <div class="col-12 col-sm-6">
          <div class="mb-3">
            <label for="medicationDosage" class="form-label">Dosage <span class="text-danger">*</span></label>
            <input 
              type="text" 
              class="form-control form-control-sm" 
              id="medicationDosage" 
              bind:value={dosage}
              required
              disabled={loading}
              placeholder="e.g., 500mg, 10ml"
            >
          </div>
        </div>
        <div class="col-12 col-sm-6">
          <div class="mb-3">
            <label for="medicationFrequency" class="form-label">Frequency <span class="text-danger">*</span></label>
            <select 
              class="form-select form-select-sm" 
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
        <label for="medicationInstructions" class="form-label">Instructions <span class="text-danger">*</span></label>
        <textarea 
          class="form-control form-control-sm" 
          id="medicationInstructions" 
          rows="2" 
          bind:value={instructions}
          required
          disabled={loading}
          placeholder="e.g., Take with food, Take before bedtime"
        ></textarea>
      </div>
      
      <div class="row">
        <div class="col-12 col-sm-6 col-lg-4">
          <div class="mb-3">
            <label for="medicationDuration" class="form-label">Duration <span class="text-danger">*</span></label>
            <input 
              type="text" 
              class="form-control form-control-sm" 
              id="medicationDuration" 
              bind:value={duration}
              disabled={loading}
              placeholder="e.g., 30 days, 3 months"
            >
          </div>
        </div>
        <div class="col-12 col-sm-6 col-lg-4">
          <div class="mb-3">
            <label for="medicationStartDate" class="form-label">Start Date <small class="text-muted">(Optional)</small></label>
            <input 
              type="date" 
              class="form-control form-control-sm" 
              id="medicationStartDate" 
              bind:value={startDate}
              disabled={loading}
            >
          </div>
        </div>
        <div class="col-12 col-sm-12 col-lg-4">
          <div class="mb-3">
            <label for="medicationEndDate" class="form-label">End Date</label>
            <input 
              type="date" 
              class="form-control form-control-sm" 
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
          class="form-control form-control-sm" 
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
      
      <div class="d-flex flex-column flex-sm-row gap-2">
        <button 
          type="submit" 
          class="btn btn-primary btn-sm flex-fill" 
          disabled={loading}
        >
          {#if loading}
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
          {/if}
          <i class="fas fa-save me-1"></i>Save Medication
        </button>
        <button 
          type="button" 
          class="btn btn-secondary btn-sm flex-fill" 
          on:click={handleCancel}
          disabled={loading}
        >
          <i class="fas fa-times me-1"></i>Cancel
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  /* Responsive medication form styling */
  .medication-form-card {
    margin-bottom: 1rem;
  }
  
  .medication-form-card .card-body {
    padding: 1rem;
  }
  
  .medication-form-card .form-label {
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  
  .medication-form-card .form-control,
  .medication-form-card .form-select {
    font-size: 0.9rem;
  }
  
  .medication-form-card .btn {
    font-size: 0.85rem;
    padding: 0.5rem 1rem;
  }
  
  /* Mobile-first responsive adjustments */
  @media (max-width: 576px) {
    .medication-form-card .card-body {
      padding: 0.75rem;
    }
    
    .medication-form-card .form-label {
      font-size: 0.85rem;
    }
    
    .medication-form-card .form-control,
    .medication-form-card .form-select {
      font-size: 0.85rem;
      padding: 0.5rem 0.75rem;
    }
    
    .medication-form-card .btn {
      font-size: 0.8rem;
      padding: 0.45rem 0.8rem;
    }
    
    .medication-form-card .d-flex.gap-2 {
      flex-direction: column;
    }
    
    .medication-form-card .d-flex.gap-2 .btn {
      width: 100%;
      margin-bottom: 0.5rem;
    }
    
    .medication-form-card .d-flex.gap-2 .btn:last-child {
      margin-bottom: 0;
    }
  }
  
  /* Tablet adjustments */
  @media (min-width: 577px) and (max-width: 768px) {
    .medication-form-card .card-body {
      padding: 0.9rem;
    }
    
    .medication-form-card .form-label {
      font-size: 0.88rem;
    }
    
    .medication-form-card .form-control,
    .medication-form-card .form-select {
      font-size: 0.88rem;
    }
  }
  
  /* Ensure proper spacing on all screen sizes */
  .medication-form-card .row {
    margin-left: -0.5rem;
    margin-right: -0.5rem;
  }
  
  .medication-form-card .row > [class*="col-"] {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
  
  /* Better spacing for form elements */
  .medication-form-card .mb-3 {
    margin-bottom: 1rem;
  }
  
  @media (max-width: 576px) {
    .medication-form-card .mb-3 {
      margin-bottom: 0.75rem;
    }
  }
</style>
