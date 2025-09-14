import { writable } from 'svelte/store'

// Notification store
export const notifications = writable([])

// Add notification
export const addNotification = (message, type = 'success', duration = 3000) => {
  const id = Date.now() + Math.random()
  const notification = {
    id,
    message,
    type,
    duration,
    visible: true
  }
  
  notifications.update(current => [...current, notification])
  
  // Auto remove after duration
  setTimeout(() => {
    removeNotification(id)
  }, duration)
}

// Remove notification
export const removeNotification = (id) => {
  notifications.update(current => current.filter(n => n.id !== id))
}

// Clear all notifications
export const clearNotifications = () => {
  notifications.set([])
}

// Success notification
export const notifySuccess = (message, duration = 3000) => {
  addNotification(message, 'success', duration)
}

// Error notification
export const notifyError = (message, duration = 5000) => {
  addNotification(message, 'error', duration)
}

// Warning notification
export const notifyWarning = (message, duration = 4000) => {
  addNotification(message, 'warning', duration)
}

// Info notification
export const notifyInfo = (message, duration = 3000) => {
  addNotification(message, 'info', duration)
}

