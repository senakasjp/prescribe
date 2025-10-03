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
  <!-- Flowbite Modal Backdrop -->
  <div 
    id="confirmationModal" 
    tabindex="-1" 
    aria-hidden="true" 
    class="fixed top-0 left-0 right-0 z-[60] w-full p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] max-h-full bg-gray-900 bg-opacity-50"
    on:click={handleClose}
    on:keydown={(e) => { if (e.key === 'Escape') handleClose() }}
    role="dialog"
    aria-modal="true"
  >
    <!-- Flowbite Modal Container -->
    <div class="relative w-full max-w-md max-h-full mx-auto flex items-center justify-center min-h-screen">
      <!-- Flowbite Modal Content -->
      <div 
        class="relative bg-white rounded-lg shadow-xl dark:bg-gray-700 transform transition-all duration-300 ease-out scale-100"
        on:click|stopPropagation
      >
        <!-- Flowbite Modal Header -->
        <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t-lg dark:border-gray-600">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <i class="{iconClass} mr-2 text-lg"></i>
            {title}
          </h3>
          <button
            type="button"
            class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white transition-colors duration-200"
            data-modal-hide="confirmationModal"
            on:click={handleClose}
          >
            <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
            </svg>
            <span class="sr-only">Close modal</span>
          </button>
        </div>
        
        <!-- Flowbite Modal Body -->
        <div class="p-4 md:p-5 space-y-4">
          <p class="text-base text-gray-500 dark:text-gray-400 leading-relaxed">
            {message}
          </p>
        </div>
        
        <!-- Flowbite Modal Footer -->
        <div class="flex items-center justify-end p-4 md:p-5 border-t border-gray-200 rounded-b-lg dark:border-gray-600 space-x-3">
          <button
            type="button"
            class="py-2.5 px-5 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-600 dark:text-white dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-500 transition-colors duration-200"
            on:click={handleCancel}
            disabled={loading}
          >
            <i class="fas fa-times mr-1"></i>
            {cancelText}
          </button>
          <button
            type="button"
            class="text-white {confirmButtonClass} hover:bg-opacity-90 focus:ring-4 focus:outline-none font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:focus:ring-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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


