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
  export let allowNonPharmacyDrugs = true
  export let excludePharmacyDrugs = false
  export let onIllnessAdded
  export let onSymptomsAdded
  export let onMedicationAdded
  export let onCancelIllness
  export let onCancelSymptoms
  export let onCancelMedication
  export let savingMedication = false
</script>

{#if showIllnessForm}
  <div
    class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto"
    on:click={onCancelIllness}
    role="button"
    tabindex="0"
    on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && onCancelIllness?.()}
  >
    <div
      class="w-full max-w-3xl"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="presentation"
      tabindex="-1"
    >
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
  <div
    class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto"
    on:click={onCancelSymptoms}
    role="button"
    tabindex="0"
    on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && onCancelSymptoms?.()}
  >
    <div
      class="w-full max-w-3xl"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="presentation"
      tabindex="-1"
    >
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
  <div
    class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto"
    on:click={onCancelMedication}
    role="button"
    tabindex="0"
    on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && onCancelMedication?.()}
  >
    <div
      class="w-full max-w-3xl"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="presentation"
      tabindex="-1"
    >
      <MedicationForm 
        {selectedPatient}
        {editingMedication}
        {doctorId}
        {allowNonPharmacyDrugs}
        {excludePharmacyDrugs}
        {savingMedication}
        visible={showMedicationForm}
        on:medication-added={onMedicationAdded}
        on:cancel={onCancelMedication}
      />
    </div>
  </div>
{/if}
