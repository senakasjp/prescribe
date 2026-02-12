import { describe, expect, it } from 'vitest'
import {
  DEVICE_ID_KEY,
  getOrCreateDeviceId,
  getStoredDeviceId
} from '../../services/deviceIdService.js'

const createMemoryStorage = () => {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value))
    }
  }
}

describe('deviceIdService', () => {
  it('persists fallback device id when local storage is empty', () => {
    const storage = createMemoryStorage()
    const fallbackId = 'owner-device-123'
    const deviceId = getOrCreateDeviceId({ fallbackId, storage })

    expect(deviceId).toBe(fallbackId)
    expect(getStoredDeviceId(storage)).toBe(fallbackId)
    expect(storage.getItem(DEVICE_ID_KEY)).toBe(fallbackId)
  })
})
