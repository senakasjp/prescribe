<script>
  export let size = 'medium' // 'small', 'medium', 'large'
  export let color = 'teal' // 'teal', 'blue', 'red', 'green'
  export let text = 'Loading...'
  export let showText = true
  export let fullScreen = false
  
  // Size configurations for dots
  const sizeConfig = {
    small: {
      dot: 'w-1.5 h-1.5',
      text: 'text-xs',
      container: 'p-2',
      spacing: 'space-x-1'
    },
    medium: {
      dot: 'w-2 h-2',
      text: 'text-sm',
      container: 'p-4',
      spacing: 'space-x-1.5'
    },
    large: {
      dot: 'w-3 h-3',
      text: 'text-base',
      container: 'p-6',
      spacing: 'space-x-2'
    }
  }
  
  // Color configurations
  const colorConfig = {
    teal: 'bg-teal-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    green: 'bg-green-500'
  }
  
  $: config = sizeConfig[size] || sizeConfig.medium
  $: colorClass = colorConfig[color] || colorConfig.teal
</script>

{#if fullScreen}
  <!-- Full Screen Loading -->
  <div class="fixed inset-0 bg-white bg-opacity-90 backdrop-blur-sm z-50 flex items-center justify-center">
    <div class="text-center">
      <!-- Three dots dancing loader -->
      <div class="flex justify-center items-center mb-4 {config.spacing}">
        <div class="{config.dot} {colorClass} rounded-full animate-bounce" style="animation-delay: 0ms"></div>
        <div class="{config.dot} {colorClass} rounded-full animate-bounce" style="animation-delay: 150ms"></div>
        <div class="{config.dot} {colorClass} rounded-full animate-bounce" style="animation-delay: 300ms"></div>
      </div>
      
      <!-- Loading text -->
      {#if showText}
        <p class="{config.text} text-gray-600 font-medium">{text}</p>
      {/if}
    </div>
  </div>
{:else}
  <!-- Inline Loading -->
  <div class="flex items-center justify-center {config.container}">
    <div class="text-center">
      <!-- Three dots dancing loader -->
      <div class="flex justify-center items-center mb-2 {config.spacing}">
        <div class="{config.dot} {colorClass} rounded-full animate-bounce" style="animation-delay: 0ms"></div>
        <div class="{config.dot} {colorClass} rounded-full animate-bounce" style="animation-delay: 150ms"></div>
        <div class="{config.dot} {colorClass} rounded-full animate-bounce" style="animation-delay: 300ms"></div>
      </div>
      
      <!-- Loading text -->
      {#if showText}
        <p class="{config.text} text-gray-600 font-medium">{text}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Three dots dancing animation */
  @keyframes bounce {
    0%, 20%, 53%, 80%, 100% {
      transform: translate3d(0, 0, 0);
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
  
  .animate-bounce {
    animation: bounce 1.4s ease-in-out infinite;
  }
</style>
