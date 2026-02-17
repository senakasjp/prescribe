import { describe, expect, it } from 'vitest'

describe('integration emulator guard', () => {
  it('requires Firebase emulator env in CI', () => {
    if (!process.env.CI) {
      expect(true).toBe(true)
      return
    }

    expect(process.env.FIRESTORE_EMULATOR_HOST).toBeTruthy()
    expect(process.env.FIREBASE_AUTH_EMULATOR_HOST).toBeTruthy()
  })
})
