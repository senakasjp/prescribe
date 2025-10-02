<script>
  import { createEventDispatcher } from 'svelte'
  import { formatDate, sortByDate } from '../../utils/dataProcessing.js'
  import { getIconClass, getButtonClasses, getBadgeClasses } from '../../utils/uiHelpers.js'
  import { SEVERITY_LEVELS } from '../../utils/constants.js'
  
  const dispatch = createEventDispatcher()
  
  export let diagnoses = []
  export let selectedPatient
  export let doctorId
  export let showDiagnosisForm = false
  
  // Sort diagnoses by date (newest first)
  $: sortedDiagnoses = sortByDate(diagnoses, 'createdAt')
  
  // Handle add diagnosis
  function addDiagnosis() {
    showDiagnosisForm = true
    dispatch('add-diagnosis')
  }
  
  // Handle edit diagnosis
  function editDiagnosis(diagnosis) {
    dispatch('edit-diagnosis', diagnosis)
  }
  
  // Handle delete diagnosis
  function deleteDiagnosis(diagnosis) {
    dispatch('delete-diagnosis', diagnosis)
  }
  
  // Get severity color
  function getSeverityColor(severity) {
    const colorMap = {
      [SEVERITY_LEVELS.MILD]: 'success',
      [SEVERITY_LEVELS.MODERATE]: 'warning',
      [SEVERITY_LEVELS.SEVERE]: 'danger',
      [SEVERITY_LEVELS.CRITICAL]: 'danger'
    }
    return colorMap[severity] || 'default'
  }
  
  // Get severity label
  function getSeverityLabel(severity) {
    const labelMap = {
      [SEVERITY_LEVELS.MILD]: 'Mild',
      [SEVERITY_LEVELS.MODERATE]: 'Moderate',
      [SEVERITY_LEVELS.SEVERE]: 'Severe',
      [SEVERITY_LEVELS.CRITICAL]: 'Critical'
    }
    return labelMap[severity] || severity
  }
  
  // Get diagnosis status color
  function getStatusColor(status) {
    const colorMap = {
      'active': 'danger',
      'resolved': 'success',
      'chronic': 'warning',
      'suspected': 'info'
    }
    return colorMap[status] || 'default'
  }
  
  // Get diagnosis status label
  function getStatusLabel(status) {
    const labelMap = {
      'active': 'Active',
      'resolved': 'Resolved',
      'chronic': 'Chronic',
      'suspected': 'Suspected'
    }
    return labelMap[status] || status
  }
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200">
  <div class="px-6 py-4 border-b border-gray-200">
    <div class="flex justify-between items-center">
      <div>
        <h3 class="text-lg font-medium text-gray-900">Diagnoses</h3>
        <p class="text-sm text-gray-500">Medical diagnoses and conditions</p>
      </div>
      <button
        on:click={addDiagnosis}
        class="{getButtonClasses('primary', { size: 'sm' })}"
      >
        <i class="{getIconClass('add')} mr-2"></i>
        Add Diagnosis
      </button>
    </div>
  </div>
  
  <div class="p-6">
    {#if sortedDiagnoses.length === 0}
      <div class="text-center py-8">
        <i class="{getIconClass('diagnosis')} text-4xl text-gray-400 mb-4"></i>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No diagnoses recorded</h3>
        <p class="text-gray-500 mb-4">Start by adding medical diagnoses and conditions for this patient.</p>
        <button
          on:click={addDiagnosis}
          class="{getButtonClasses('primary')}"
        >
          <i class="{getIconClass('add')} mr-2"></i>
          Add First Diagnosis
        </button>
      </div>
    {:else}
      <div class="space-y-4">
        {#each sortedDiagnoses as diagnosis (diagnosis.id)}
          <div class="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow duration-200">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="flex items-center space-x-3 mb-2">
                  <h4 class="text-lg font-medium text-gray-900">{diagnosis.title}</h4>
                  <span class="{getBadgeClasses(getSeverityColor(diagnosis.severity), { size: 'sm' })}">
                    {getSeverityLabel(diagnosis.severity)}
                  </span>
                  {#if diagnosis.status}
                    <span class="{getBadgeClasses(getStatusColor(diagnosis.status), { size: 'sm' })}">
                      {getStatusLabel(diagnosis.status)}
                    </span>
                  {/if}
                </div>
                
                <div class="flex items-center text-sm text-gray-500 mb-3">
                  <i class="{getIconClass('calendar')} mr-1"></i>
                  {formatDate(diagnosis.createdAt, { includeTime: true })}
                  {#if diagnosis.diagnosticCode}
                    <span class="mx-2">•</span>
                    <i class="{getIconClass('barcode')} mr-1"></i>
                    Code: {diagnosis.diagnosticCode}
                  {/if}
                </div>
                
                {#if diagnosis.description}
                  <p class="text-gray-700 mb-3">{diagnosis.description}</p>
                {/if}
                
                {#if diagnosis.notes}
                  <div class="mt-3 p-3 bg-gray-50 rounded-md">
                    <h5 class="text-sm font-medium text-gray-700 mb-2">Notes:</h5>
                    <p class="text-sm text-gray-600">{diagnosis.notes}</p>
                  </div>
                {/if}
                
                {#if diagnosis.treatmentPlan}
                  <div class="mt-3 p-3 bg-blue-50 rounded-md">
                    <h5 class="text-sm font-medium text-blue-700 mb-2">Treatment Plan:</h5>
                    <p class="text-sm text-blue-600">{diagnosis.treatmentPlan}</p>
                  </div>
                {/if}
                
                {#if diagnosis.followUpDate}
                  <div class="mt-3 p-3 bg-yellow-50 rounded-md">
                    <h5 class="text-sm font-medium text-yellow-700 mb-2">Follow-up:</h5>
                    <p class="text-sm text-yellow-600">
                      <i class="{getIconClass('calendar')} mr-1"></i>
                      {formatDate(diagnosis.followUpDate)}
                    </p>
                  </div>
                {/if}
              </div>
              
              <div class="flex items-center space-x-2 ml-4">
                <button
                  on:click={() => editDiagnosis(diagnosis)}
                  class="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  title="Edit diagnosis"
                >
                  <i class="{getIconClass('edit')}"></i>
                </button>
                
                <button
                  on:click={() => deleteDiagnosis(diagnosis)}
                  class="text-gray-400 hover:text-red-600 transition-colors duration-200"
                  title="Delete diagnosis"
                >
                  <i class="{getIconClass('delete')}"></i>
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
