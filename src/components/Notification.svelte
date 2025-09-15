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
    class="toast show position-fixed top-0 end-0 m-3" 
    role="alert" 
    aria-live="assertive" 
    aria-atomic="true"
    style="z-index: 9999; min-width: 300px;"
  >
    <div class="toast-header bg-{type === 'success' ? 'success' : type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'info'} text-white">
      <i class="fas fa-{type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
      <strong class="me-auto">
        {type === 'success' ? 'Success' : type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Info'}
      </strong>
      <button 
        type="button" 
        class="btn-close btn-close-white" 
        on:click={handleClose}
        aria-label="Close"
      ></button>
    </div>
    <div class="toast-body bg-white text-dark">
      {message}
    </div>
  </div>
{/if}

<!-- Bootstrap 5 toast styling is handled by Bootstrap classes -->

