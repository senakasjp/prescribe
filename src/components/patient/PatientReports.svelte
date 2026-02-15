<script>
  import { createEventDispatcher } from 'svelte'
  import { formatDate, sortByDate, formatFileSize } from '../../utils/dataProcessing.js'
  import { getIconClass, getButtonClasses, getBadgeClasses } from '../../utils/uiHelpers.js'
  import { REPORT_TYPES } from '../../utils/constants.js'
  
  const dispatch = createEventDispatcher()
  
  export let reports = []
  export let selectedPatient
  export let doctorId
  export let showReportForm = false
  export let reportType = 'text'
  
  // Sort reports by date (newest first)
  $: sortedReports = sortByDate(reports, 'createdAt')
  
  // Handle add report
  function addReport() {
    showReportForm = true
    dispatch('add-report')
  }
  
  // Handle edit report
  function editReport(report) {
    dispatch('edit-report', report)
  }
  
  // Handle delete report
  function deleteReport(report) {
    dispatch('delete-report', report)
  }
  
  // Handle download report
  function downloadReport(report) {
    dispatch('download-report', report)
  }
  
  // Handle view report
  function viewReport(report) {
    dispatch('view-report', report)
  }
  
  // Get report type icon
  function getReportTypeIcon(type) {
    const iconMap = {
      [REPORT_TYPES.TEXT]: 'keyboard',
      [REPORT_TYPES.PDF]: 'file-pdf',
      [REPORT_TYPES.IMAGE]: 'image'
    }
    return getIconClass(iconMap[type] || 'file')
  }
  
  // Get report type label
  function getReportTypeLabel(type) {
    const labelMap = {
      [REPORT_TYPES.TEXT]: 'Text Report',
      [REPORT_TYPES.PDF]: 'PDF Document',
      [REPORT_TYPES.IMAGE]: 'Image File'
    }
    return labelMap[type] || 'Report'
  }
  
  // Get report type color
  function getReportTypeColor(type) {
    const colorMap = {
      [REPORT_TYPES.TEXT]: 'info',
      [REPORT_TYPES.PDF]: 'danger',
      [REPORT_TYPES.IMAGE]: 'success'
    }
    return colorMap[type] || 'default'
  }
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200 sm:text-sm">
  <div class="px-6 py-4 border-b border-gray-200">
    <div class="flex justify-between items-center">
      <div>
        <h3 class="text-lg font-medium text-gray-900">Medical Reports</h3>
        <p class="text-sm text-gray-500">Patient reports, documents, and files</p>
      </div>
      <div class="flex space-x-2">
        <select
          bind:value={reportType}
          class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        >
          <option value="text">Text Report</option>
          <option value="pdf">PDF Upload</option>
          <option value="image">Image Upload</option>
        </select>
        <button
          on:click={addReport}
          class="{getButtonClasses('primary', { size: 'sm' })}"
        >
          <i class="{getIconClass('add')} mr-2"></i>
          Add Report
        </button>
      </div>
    </div>
  </div>
  
  <div class="p-6">
    {#if sortedReports.length === 0}
      <div class="text-center py-8">
        <i class="{getIconClass('report')} text-4xl text-gray-400 mb-4"></i>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No reports available</h3>
        <p class="text-gray-500 mb-4">Start by adding medical reports, documents, or files for this patient.</p>
        <button
          on:click={addReport}
          class="{getButtonClasses('primary')}"
        >
          <i class="{getIconClass('add')} mr-2"></i>
          Add First Report
        </button>
      </div>
    {:else}
      <div class="space-y-4">
        {#each sortedReports as report (report.id)}
          <div class="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow duration-200">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="flex items-center space-x-3 mb-2">
                  <i class="{getReportTypeIcon(report.type)} text-lg text-gray-400"></i>
                  <h4 class="text-lg font-medium text-gray-900">{report.title}</h4>
                  <span class="{getBadgeClasses(getReportTypeColor(report.type), { size: 'sm' })}">
                    {getReportTypeLabel(report.type)}
                  </span>
                </div>
                
                <div class="flex items-center text-sm text-gray-500 mb-3">
                  <i class="{getIconClass('calendar')} mr-1"></i>
                  {formatDate(report.createdAt, { includeTime: true })}
                  {#if report.fileSize}
                    <span class="mx-2">•</span>
                    <i class="{getIconClass('download')} mr-1"></i>
                    {formatFileSize(report.fileSize)}
                  {/if}
                </div>
                
                {#if report.description}
                  <p class="text-gray-700 mb-3">{report.description}</p>
                {/if}
                
                {#if report.type === REPORT_TYPES.TEXT && report.content}
                  <div class="mt-3 p-3 bg-gray-50 rounded-md">
                    <h5 class="text-sm font-medium text-gray-700 mb-2">Content:</h5>
                    <p class="text-sm text-gray-600 whitespace-pre-wrap">{report.content}</p>
                  </div>
                {/if}
                
                {#if report.type === REPORT_TYPES.PDF && report.fileName}
                  <div class="mt-3 p-3 bg-red-50 rounded-md">
                    <div class="flex items-center">
                      <i class="{getIconClass('file-pdf')} text-red-600 mr-2"></i>
                      <span class="text-sm text-red-800 font-medium">{report.fileName}</span>
                    </div>
                  </div>
                {/if}
                
                {#if report.type === REPORT_TYPES.IMAGE && report.fileName}
                  <div class="mt-3 p-3 bg-green-50 rounded-md">
                    <div class="flex items-center">
                      <i class="{getIconClass('image')} text-green-600 mr-2"></i>
                      <span class="text-sm text-green-800 font-medium">{report.fileName}</span>
                    </div>
                  </div>
                {/if}
              </div>
              
              <div class="flex items-center space-x-2 ml-4">
                {#if report.type !== REPORT_TYPES.TEXT}
                  <button
                    on:click={() => viewReport(report)}
                    class="text-gray-400 hover:text-blue-600 transition-colors duration-200"
                    title="View report"
                  >
                    <i class="{getIconClass('search')}"></i>
                  </button>
                  
                  <button
                    on:click={() => downloadReport(report)}
                    class="text-gray-400 hover:text-green-600 transition-colors duration-200"
                    title="Download report"
                  >
                    <i class="{getIconClass('download')}"></i>
                  </button>
                {/if}
                
                <button
                  on:click={() => editReport(report)}
                  class="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  title="Edit report"
                >
                  <i class="{getIconClass('edit')}"></i>
                </button>
                
                <button
                  on:click={() => deleteReport(report)}
                  class="text-gray-400 hover:text-red-600 transition-colors duration-200"
                  title="Delete report"
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
