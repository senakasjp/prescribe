<script>
  import { createEventDispatcher } from 'svelte'
  
  export let visible = false
  export let title = 'Confirm Action'
  export let message = 'Are you sure you want to proceed?'
  export let confirmText = 'Confirm'
  export let cancelText = 'Cancel'
  export let type = 'warning' // 'warning', 'danger', 'info', 'success'
  export let loading = false
  
  const dispatch = createEventDispatcher()
  
  function handleConfirm() {
    dispatch('confirm')
  }
  
  function handleCancel() {
    dispatch('cancel')
  }
  
  function handleClose() {
    dispatch('close')
  }
  
  // Get appropriate colors based on type
  $: confirmButtonClass = {
    warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-300',
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-300',
    info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-300',
    success: 'bg-green-600 hover:bg-green-700 focus:ring-green-300'
  }[type] || 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-300'
  
  $: iconClass = {
    warning: 'fas fa-exclamation-triangle text-yellow-600',
    danger: 'fas fa-exclamation-circle text-red-600',
    info: 'fas fa-info-circle text-blue-600',
    success: 'fas fa-check-circle text-green-600'
  }[type] || 'fas fa-info-circle text-blue-600'
</script>

{#if visible}
  <div id="confirmationModal" tabindex="-1" aria-hidden="true" class="fixed inset-0 z-50 w-full p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] max-h-full">
    <div class="relative w-full max-w-md max-h-full mx-auto">
      <div class="relative bg-white rounded-lg shadow dark:bg-gray-700">
        <!-- Modal header -->
        <div class="flex items-center justify-between p-5 border-b rounded-t dark:border-gray-600">
          <h3 class="text-xl font-medium text-gray-900 dark:text-white">
            <i class="{iconClass} mr-2"></i>
            {title}
          </h3>
          <button
            type="button"
            class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white"
            data-modal-hide="confirmationModal"
            on:click={handleClose}
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
            </svg>
            <span class="sr-only">Close modal</span>
          </button>
        </div>
        
        <!-- Modal body -->
        <div class="p-6">
          <p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
            {message}
          </p>
        </div>
        
        <!-- Modal footer -->
        <div class="flex items-center p-6 space-x-2 border-t border-gray-200 rounded-b dark:border-gray-600">
          <button
            type="button"
            class="text-gray-500 bg-white hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-200 rounded-lg border border-gray-200 text-sm font-medium px-5 py-2.5 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-gray-600"
            on:click={handleCancel}
            disabled={loading}
          >
            <i class="fas fa-times mr-1"></i>
            {cancelText}
          </button>
          <button
            type="button"
            class="text-white {confirmButtonClass} focus:ring-4 focus:outline-none font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:focus:ring-800 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={handleConfirm}
            disabled={loading}
          >
            {#if loading}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {/if}
            <i class="fas fa-check mr-1"></i>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}


