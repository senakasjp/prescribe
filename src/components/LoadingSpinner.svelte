<script>
  export let size = 'medium' // 'small', 'medium', 'large'
  export let color = 'teal' // 'teal', 'blue', 'red', 'green'
  export let text = 'Loading...'
  export let showText = true
  export let fullScreen = false
  
  // Size configurations
  const sizeConfig = {
    small: {
      spinner: 'h-4 w-4',
      text: 'text-xs',
      container: 'p-2'
    },
    medium: {
      spinner: 'h-6 w-6',
      text: 'text-sm',
      container: 'p-4'
    },
    large: {
      spinner: 'h-8 w-8',
      text: 'text-base',
      container: 'p-6'
    }
  }
  
  // Color configurations
  const colorConfig = {
    teal: 'text-teal-500',
    blue: 'text-blue-500',
    red: 'text-red-500',
    green: 'text-green-500'
  }
  
  $: config = sizeConfig[size] || sizeConfig.medium
  $: colorClass = colorConfig[color] || colorConfig.teal
</script>

{#if fullScreen}
  <!-- Full Screen Loading -->
  <div class="fixed inset-0 bg-white bg-opacity-90 backdrop-blur-sm z-50 flex items-center justify-center">
    <div class="text-center">
      <!-- Mobile-optimized spinner -->
      <div class="relative mx-auto mb-4">
        <!-- Outer ring -->
        <div class="w-12 h-12 border-4 border-gray-200 rounded-full animate-spin border-t-teal-500"></div>
        <!-- Inner pulse -->
        <div class="absolute inset-0 w-12 h-12 border-4 border-transparent rounded-full animate-pulse bg-teal-100 opacity-30"></div>
      </div>
      
      <!-- Loading text -->
      {#if showText}
        <p class="text-gray-600 font-medium text-sm sm:text-base">{text}</p>
      {/if}
      
      <!-- Loading dots animation -->
      <div class="flex justify-center mt-2 space-x-1">
        <div class="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
        <div class="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
        <div class="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
      </div>
    </div>
  </div>
{:else}
  <!-- Inline Loading -->
  <div class="flex items-center justify-center {config.container}">
    <div class="text-center">
      <!-- Spinner -->
      <div class="relative mx-auto mb-2">
        <div class="{config.spinner} border-2 border-gray-200 rounded-full animate-spin border-t-teal-500"></div>
      </div>
      
      <!-- Loading text -->
      {#if showText}
        <p class="{config.text} text-gray-600 font-medium">{text}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Custom animations for smoother mobile experience */
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes bounce {
    0%, 20%, 53%, 80%, 100% {
      transform: translate3d(0,0,0);
    }
    40%, 43% {
      transform: translate3d(0, -8px, 0);
    }
    70% {
      transform: translate3d(0, -4px, 0);
    }
    90% {
      transform: translate3d(0, -2px, 0);
    }
  }
  
  .animate-spin {
    animation: spin 1s linear infinite;
  }
  
  .animate-bounce {
    animation: bounce 1.4s ease-in-out infinite;
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: .5;
    }
  }
</style>
