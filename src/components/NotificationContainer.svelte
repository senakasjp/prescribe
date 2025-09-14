<script>
  import { notifications } from '../stores/notifications.js'
  import Notification from './Notification.svelte'
</script>

{#each $notifications as notification (notification.id)}
  <Notification 
    message={notification.message}
    type={notification.type}
    duration={notification.duration}
    visible={notification.visible}
  />
{/each}

