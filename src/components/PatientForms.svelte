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
  <IllnessForm 
    {selectedPatient}
    visible={showIllnessForm}
    on:illness-added={onIllnessAdded}
    on:cancel={onCancelIllness}
  />
{/if}

{#if showSymptomsForm}
  <SymptomsForm 
    {selectedPatient}
    visible={showSymptomsForm}
    on:symptoms-added={onSymptomsAdded}
    on:cancel={onCancelSymptoms}
  />
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
