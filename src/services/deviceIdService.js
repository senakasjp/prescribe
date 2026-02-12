const DEVICE_ID_KEY = 'prescribe_device_id'

const createDeviceId = () => (
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
)

const getStorage = () => {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

const getStoredDeviceId = (storage = getStorage()) => {
  if (!storage) return ''
  return storage.getItem(DEVICE_ID_KEY) || ''
}

const setStoredDeviceId = (deviceId, storage = getStorage()) => {
  if (!storage || !deviceId) return
  storage.setItem(DEVICE_ID_KEY, deviceId)
}

const getOrCreateDeviceId = ({ fallbackId = '', storage = getStorage() } = {}) => {
  let deviceId = getStoredDeviceId(storage)
  if (!deviceId && fallbackId) {
    setStoredDeviceId(fallbackId, storage)
    return fallbackId
  }
  if (!deviceId) {
    deviceId = createDeviceId()
    setStoredDeviceId(deviceId, storage)
  }
  return deviceId || ''
}

export {
  DEVICE_ID_KEY,
  createDeviceId,
  getStoredDeviceId,
  setStoredDeviceId,
  getOrCreateDeviceId
}
