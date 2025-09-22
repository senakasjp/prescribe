<script>
  export let message = ''
  export let type = 'success' // success, info, warning, error
  export let duration = 3000
  export let visible = false
  
  let timeoutId = null
  
  // Show notification
  $: if (visible && message) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      visible = false
    }, duration)
  }
  
  // Clear timeout on destroy
  import { onDestroy } from 'svelte'
  onDestroy(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  })
  
  // Handle close button
  const handleClose = () => {
    visible = false
    clearTimeout(timeoutId)
  }
</script>

{#if visible}
  <div 
    class="fixed top-4 right-4 z-50 max-w-sm w-full bg-white rounded-lg shadow-lg border border-gray-200" 
    role="alert" 
    aria-live="assertive" 
    aria-atomic="true"
  >
    <div class="flex items-center p-4 rounded-t-lg {type === 'success' ? 'bg-teal-500' : type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'} text-white">
      <i class="fas fa-{type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} mr-2"></i>
      <span class="font-semibold flex-1">
        {type === 'success' ? 'Success' : type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Info'}
      </span>
      <button 
        type="button" 
        class="text-white hover:text-gray-200 ml-2" 
        on:click={handleClose}
        aria-label="Close"
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="p-4 bg-white text-gray-900 rounded-b-lg">
      {message}
    </div>
  </div>
{/if}

<!-- Flowbite notification styling -->

