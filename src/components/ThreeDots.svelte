<script>
  export let size = 'small' // 'small', 'medium', 'large'
  export let color = 'white' // 'white', 'gray', 'teal', 'blue', 'red', 'green'
  
  // Size configurations for dots
  const sizeConfig = {
    small: {
      dot: 'w-1 h-1',
      spacing: 'space-x-0.5'
    },
    medium: {
      dot: 'w-1.5 h-1.5',
      spacing: 'space-x-1'
    },
    large: {
      dot: 'w-2 h-2',
      spacing: 'space-x-1'
    }
  }
  
  // Color configurations
  const colorConfig = {
    white: 'bg-white',
    gray: 'bg-gray-500',
    teal: 'bg-teal-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    green: 'bg-green-500'
  }
  
  $: config = sizeConfig[size] || sizeConfig.small
  $: colorClass = colorConfig[color] || colorConfig.white
</script>

<!-- Three dots dancing loader -->
<div class="flex items-center {config.spacing} sm:text-sm">
  <div class="{config.dot} {colorClass} rounded-full animate-bounce" style="animation-delay: 0ms"></div>
  <div class="{config.dot} {colorClass} rounded-full animate-bounce" style="animation-delay: 150ms"></div>
  <div class="{config.dot} {colorClass} rounded-full animate-bounce" style="animation-delay: 300ms"></div>
</div>

<style>
  /* Three dots dancing animation */
  @keyframes bounce {
    0%, 20%, 53%, 80%, 100% {
      transform: translate3d(0, 0, 0);
    }
    40%, 43% {
      transform: translate3d(0, -6px, 0);
    }
    70% {
      transform: translate3d(0, -3px, 0);
    }
    90% {
      transform: translate3d(0, -1px, 0);
    }
  }
  
  .animate-bounce {
    animation: bounce 1.4s ease-in-out infinite;
  }
</style>
