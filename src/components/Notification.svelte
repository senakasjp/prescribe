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
    class="toast show position-fixed" 
    role="alert" 
    aria-live="assertive" 
    aria-atomic="true"
    style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;"
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
    <div class="toast-body">
      {message}
    </div>
  </div>
{/if}

<style>
  .toast {
    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
    border: none;
  }
  
  .toast-header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .toast-body {
    background-color: white;
    color: #212529;
  }
</style>

