<script>
  import { onMount, onDestroy } from 'svelte'
  
  export let message = ''
  export let type = 'success' // success, info, warning, error
  export let duration = 3000
  export let visible = false
  
  let timeoutId = null
  let notificationElement = null
  let isAnimating = false
  
  // Show notification with animation
  $: if (visible && message) {
    clearTimeout(timeoutId)
    isAnimating = true
    
    // Trigger slide-in animation
    setTimeout(() => {
      if (notificationElement) {
        notificationElement.classList.remove('translate-x-full', 'opacity-0')
        notificationElement.classList.add('translate-x-0', 'opacity-100')
      }
    }, 10)
    
    timeoutId = setTimeout(() => {
      hideNotification()
    }, duration)
  }
  
  // Hide notification with animation
  const hideNotification = () => {
    if (notificationElement) {
      notificationElement.classList.remove('translate-x-0', 'opacity-100')
      notificationElement.classList.add('translate-x-full', 'opacity-0')
      
      setTimeout(() => {
        visible = false
        isAnimating = false
      }, 300) // Match animation duration
    } else {
      visible = false
      isAnimating = false
    }
  }
  
  // Clear timeout on destroy
  onDestroy(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  })
  
  // Handle close button
  const handleClose = () => {
    clearTimeout(timeoutId)
    hideNotification()
  }
  
  // Get type-specific styles
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-teal-50 border-teal-200',
          icon: 'fas fa-check-circle text-teal-600',
          title: 'text-teal-800',
          text: 'text-teal-700',
          button: 'text-teal-400 hover:text-teal-600'
        }
      case 'error':
        return {
          bg: 'bg-red-50 border-red-200',
          icon: 'fas fa-exclamation-circle text-red-600',
          title: 'text-red-800',
          text: 'text-red-700',
          button: 'text-red-400 hover:text-red-600'
        }
      case 'warning':
        return {
          bg: 'bg-yellow-50 border-yellow-200',
          icon: 'fas fa-exclamation-triangle text-yellow-600',
          title: 'text-yellow-800',
          text: 'text-yellow-700',
          button: 'text-yellow-400 hover:text-yellow-600'
        }
      case 'info':
      default:
        return {
          bg: 'bg-blue-50 border-blue-200',
          icon: 'fas fa-info-circle text-blue-600',
          title: 'text-blue-800',
          text: 'text-blue-700',
          button: 'text-blue-400 hover:text-blue-600'
        }
    }
  }
  
  const styles = getTypeStyles()
</script>

{#if visible}
  <div 
    bind:this={notificationElement}
    class="w-full transform transition-all duration-300 ease-in-out translate-x-full opacity-0"
    role="alert" 
    aria-live="assertive" 
    aria-atomic="true"
  >
    <div class="bg-white rounded-lg shadow-xl border {styles.bg} border-opacity-50 overflow-hidden">
      <!-- Header with icon and close button -->
      <div class="flex items-start p-4">
        <div class="flex-shrink-0">
          <i class="{styles.icon} text-lg"></i>
        </div>
        
        <div class="ml-3 flex-1">
          <h4 class="text-sm font-semibold {styles.title}">
            {type === 'success' ? 'Success' : type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Information'}
          </h4>
          <p class="mt-1 text-sm {styles.text}">
            {message}
          </p>
        </div>
        
        <div class="ml-4 flex-shrink-0">
          <button 
            type="button" 
            class="inline-flex {styles.button} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current rounded-md p-1"
            on:click={handleClose}
            aria-label="Close notification"
          >
            <i class="fas fa-times text-sm"></i>
          </button>
        </div>
      </div>
      
      <!-- Progress bar -->
      <div class="h-1 bg-gray-200">
        <div class="h-full {type === 'success' ? 'bg-teal-500' : type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'} transition-all duration-300 ease-linear" style="width: 100%; animation: shrink {duration}ms linear forwards;"></div>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes shrink {
    from { width: 100%; }
    to { width: 0%; }
  }
</style>

<!-- Flowbite notification styling -->

