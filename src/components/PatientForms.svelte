<script>
  import IllnessForm from './IllnessForm.svelte'
  import SymptomsForm from './SymptomsForm.svelte'
  import MedicationForm from './MedicationForm.svelte'
  
  export let showIllnessForm = false
  export let showSymptomsForm = false
  export let showMedicationForm = false
  export let selectedPatient = null
  export let editingMedication = null
  export let doctorId = null
  export let onIllnessAdded
  export let onSymptomsAdded
  export let onMedicationAdded
  export let onCancelIllness
  export let onCancelSymptoms
  export let onCancelMedication
</script>

{#if showIllnessForm}
  <div class="card mb-3">
    <div class="card-header">
      <h6 class="mb-0">
        <i class="fas fa-heartbeat me-2"></i>Add Illness
      </h6>
    </div>
    <div class="card-body">
      <IllnessForm 
        {selectedPatient}
        visible={showIllnessForm}
        on:illness-added={onIllnessAdded}
        on:cancel={onCancelIllness}
      />
    </div>
  </div>
{/if}

{#if showSymptomsForm}
  <div class="card mb-3">
    <div class="card-header">
      <h6 class="mb-0">
        <i class="fas fa-thermometer-half me-2"></i>Add Symptoms
      </h6>
    </div>
    <div class="card-body">
      <SymptomsForm 
        {selectedPatient}
        visible={showSymptomsForm}
        on:symptoms-added={onSymptomsAdded}
        on:cancel={onCancelSymptoms}
      />
    </div>
  </div>
{/if}

{#if showMedicationForm}
  <MedicationForm 
    {selectedPatient}
    {editingMedication}
    {doctorId}
    visible={showMedicationForm}
    on:medication-added={onMedicationAdded}
    on:cancel={onCancelMedication}
  />
{/if}
