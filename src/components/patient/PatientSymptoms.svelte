<script>
  import { createEventDispatcher } from 'svelte'
  import { formatDate, sortByDate } from '../../utils/dataProcessing.js'
  import { getIconClass, getButtonClasses, getBadgeClasses } from '../../utils/uiHelpers.js'
  import { SEVERITY_LEVELS } from '../../utils/constants.js'
  
  const dispatch = createEventDispatcher()
  
  export let symptoms = []
  export let selectedPatient
  export let doctorId
  export let showSymptomsForm = false
  export let expandedSymptoms = {}
  
  // Sort symptoms by date (newest first)
  $: sortedSymptoms = sortByDate(symptoms, 'createdAt')
  
  // Pagination for symptoms
  let currentSymptomsPage = 1
  let symptomsPerPage = 25
  
  // Pagination calculations for symptoms
  $: totalSymptomsPages = Math.ceil(sortedSymptoms.length / symptomsPerPage)
  $: symptomsStartIndex = (currentSymptomsPage - 1) * symptomsPerPage
  $: symptomsEndIndex = symptomsStartIndex + symptomsPerPage
  $: paginatedSymptoms = sortedSymptoms.slice(symptomsStartIndex, symptomsEndIndex)
  
  // Reset to first page when symptoms change
  $: if (sortedSymptoms.length > 0) {
    currentSymptomsPage = 1
  }
  
  // Pagination functions for symptoms
  const goToSymptomsPage = (page) => {
    if (page >= 1 && page <= totalSymptomsPages) {
      currentSymptomsPage = page
    }
  }
  
  const goToPreviousSymptomsPage = () => {
    if (currentSymptomsPage > 1) {
      currentSymptomsPage--
    }
  }
  
  const goToNextSymptomsPage = () => {
    if (currentSymptomsPage < totalSymptomsPages) {
      currentSymptomsPage++
    }
  }
  
  // Handle add symptom
  function addSymptom() {
    showSymptomsForm = true
    dispatch('add-symptom')
  }
  
  // Handle edit symptom
  function editSymptom(symptom) {
    dispatch('edit-symptom', symptom)
  }
  
  // Handle delete symptom
  function deleteSymptom(symptom) {
    dispatch('delete-symptom', symptom)
  }
  
  // Toggle symptom expansion
  function toggleSymptomExpansion(symptomId) {
    expandedSymptoms[symptomId] = !expandedSymptoms[symptomId]
    expandedSymptoms = { ...expandedSymptoms }
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
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200">
  <div class="px-6 py-4 border-b border-gray-200">
    <div class="flex justify-between items-center">
      <div>
        <h3 class="text-lg font-medium text-gray-900">Symptoms</h3>
        <p class="text-sm text-gray-500">Patient symptoms and observations</p>
      </div>
      <button
        on:click={addSymptom}
        class="{getButtonClasses('primary', { size: 'sm' })}"
      >
        <i class="{getIconClass('add')} mr-2"></i>
        Add Symptom
      </button>
    </div>
  </div>
  
  <div class="p-6">
    {#if sortedSymptoms.length === 0}
      <div class="text-center py-8">
        <i class="{getIconClass('symptom')} text-4xl text-gray-400 mb-4"></i>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No symptoms recorded</h3>
        <p class="text-gray-500 mb-4">Start by adding the patient's symptoms and observations.</p>
        <button
          on:click={addSymptom}
          class="{getButtonClasses('primary')}"
        >
          <i class="{getIconClass('add')} mr-2"></i>
          Add First Symptom
        </button>
      </div>
    {:else}
      <div class="space-y-4">
        {#each paginatedSymptoms as symptom (symptom.id)}
          <div class="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow duration-200">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="flex items-center space-x-3 mb-2">
                  <h4 class="text-lg font-medium text-gray-900">{symptom.name}</h4>
                  <span class="{getBadgeClasses(getSeverityColor(symptom.severity), { size: 'sm' })}">
                    {getSeverityLabel(symptom.severity)}
                  </span>
                </div>
                
                <div class="flex items-center text-sm text-gray-500 mb-3">
                  <i class="{getIconClass('calendar')} mr-1"></i>
                  {formatDate(symptom.createdAt, { includeTime: true })}
                </div>
                
                {#if symptom.description}
                  <p class="text-gray-700 mb-3">{symptom.description}</p>
                {/if}
                
                {#if symptom.duration}
                  <div class="flex items-center text-sm text-gray-600 mb-2">
                    <i class="{getIconClass('clock')} mr-1"></i>
                    Duration: {symptom.duration}
                  </div>
                {/if}
                
                {#if symptom.location}
                  <div class="flex items-center text-sm text-gray-600 mb-2">
                    <i class="{getIconClass('location')} mr-1"></i>
                    Location: {symptom.location}
                  </div>
                {/if}
                
                {#if symptom.notes && expandedSymptoms[symptom.id]}
                  <div class="mt-3 p-3 bg-gray-50 rounded-md">
                    <h5 class="text-sm font-medium text-gray-700 mb-2">Notes:</h5>
                    <p class="text-sm text-gray-600">{symptom.notes}</p>
                  </div>
                {/if}
              </div>
              
              <div class="flex items-center space-x-2 ml-4">
                {#if symptom.notes}
                  <button
                    on:click={() => toggleSymptomExpansion(symptom.id)}
                    class="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    {expandedSymptoms[symptom.id] ? 'Hide Notes' : 'Show Notes'}
                  </button>
                {/if}
                
                <button
                  on:click={() => editSymptom(symptom)}
                  class="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  title="Edit symptom"
                >
                  <i class="{getIconClass('edit')}"></i>
                </button>
                
                <button
                  on:click={() => deleteSymptom(symptom)}
                  class="text-gray-400 hover:text-red-600 transition-colors duration-200"
                  title="Delete symptom"
                >
                  <i class="{getIconClass('delete')}"></i>
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
      
      <!-- Pagination Controls for Symptoms -->
      {#if totalSymptomsPages > 1}
        <div class="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 rounded-lg">
          <div class="flex items-center text-sm text-gray-700">
            <span>Showing {symptomsStartIndex + 1} to {Math.min(symptomsEndIndex, sortedSymptoms.length)} of {sortedSymptoms.length} symptoms</span>
          </div>
          
          <div class="flex items-center space-x-2">
            <!-- Previous Button -->
            <button 
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={goToPreviousSymptomsPage}
              disabled={currentSymptomsPage === 1}
            >
              <i class="fas fa-chevron-left mr-1"></i>
              Previous
            </button>
            
            <!-- Page Numbers -->
            <div class="flex items-center space-x-1">
              {#each Array.from({length: Math.min(5, totalSymptomsPages)}, (_, i) => {
                const startPage = Math.max(1, currentSymptomsPage - 2)
                const endPage = Math.min(totalSymptomsPages, startPage + 4)
                const page = startPage + i
                return page <= endPage ? page : null
              }).filter(Boolean) as page}
                <button 
                  class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg {currentSymptomsPage === page ? 'text-white bg-teal-600 border-teal-600' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
                  on:click={() => goToSymptomsPage(page)}
                >
                  {page}
                </button>
              {/each}
            </div>
            
            <!-- Next Button -->
            <button 
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={goToNextSymptomsPage}
              disabled={currentSymptomsPage === totalSymptomsPages}
            >
              Next
              <i class="fas fa-chevron-right ml-1"></i>
            </button>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>
