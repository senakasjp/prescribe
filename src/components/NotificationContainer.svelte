<script>
  import { notifications } from '../stores/notifications.js'
  import Notification from './Notification.svelte'
  
  // Calculate top position for each notification to stack them properly
  const getTopPosition = (index) => {
    return `${1 + index * 5}rem` // 1rem base + 5rem per notification
  }
</script>

{#each $notifications as notification, index (notification.id)}
  <div 
    class="fixed right-4 z-50 max-w-sm w-full"
    style="top: {getTopPosition(index)};"
  >
    <Notification 
      message={notification.message}
      type={notification.type}
      duration={notification.duration}
      visible={notification.visible}
    />
  </div>
{/each}

