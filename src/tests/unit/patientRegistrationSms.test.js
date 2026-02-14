import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { buildPatientRegistrationSmsPayload } = require('../../../functions/patientRegistrationSms.js')

const baseTemplates = {
  registrationTemplateEnabled: true,
  registrationChannel: 'sms',
  smsSenderId: 'TEST',
  registrationTemplate:
    'Hi {{patientName}}, welcome. Doctor: {{doctorName}}. ID: {{patientShortId}}. {{appUrl}}'
}

describe('patient registration SMS payload', () => {
  it('builds payload for doctor portal patient registration', () => {
    const payload = buildPatientRegistrationSmsPayload({
      patient: {
        id: 'patient-doctor-1',
        firstName: 'Alex',
        lastName: 'Perera',
        phone: '0712345678',
        phoneCountryCode: '+94',
        doctorId: 'doctor-1'
      },
      doctor: {
        firstName: 'Maya',
        lastName: 'Silva'
      },
      templates: baseTemplates,
      appUrl: 'https://example.test'
    })

    expect(payload.ok).toBe(true)
    expect(payload.recipient).toBe('94712345678')
    expect(payload.senderId).toBe('TEST')
    expect(payload.message).toContain('Alex Perera')
    expect(payload.message).toContain('Maya Silva')
    expect(payload.message).toMatch(/PA\d{7}/)
  })

  it('builds payload for pharmacy portal patient registration', () => {
    const payload = buildPatientRegistrationSmsPayload({
      patient: {
        id: 'patient-pharmacy-1',
        name: 'Nimal Jay',
        phone: '0770000000',
        phoneCountryCode: '+94',
        doctorId: 'doctor-2'
      },
      doctor: {
        name: 'Dr. Pathirana'
      },
      templates: baseTemplates,
      appUrl: 'https://example.test'
    })

    expect(payload.ok).toBe(true)
    expect(payload.recipient).toBe('94770000000')
    expect(payload.message).toContain('Nimal Jay')
    expect(payload.message).toContain('Dr. Pathirana')
    expect(payload.message).toMatch(/PA\d{7}/)
  })

  it('keeps phone when country code already included', () => {
    const payload = buildPatientRegistrationSmsPayload({
      patient: {
        id: 'patient-doctor-2',
        firstName: 'Sam',
        lastName: 'Fernando',
        phone: '+94712345678',
        phoneCountryCode: '+94',
        doctorId: 'doctor-3'
      },
      doctor: {
        firstName: 'Ishara',
        lastName: 'Perera'
      },
      templates: baseTemplates,
      appUrl: 'https://example.test'
    })

    expect(payload.ok).toBe(true)
    expect(payload.recipient).toBe('+94712345678')
  })

  it('skips when registration template is disabled', () => {
    const payload = buildPatientRegistrationSmsPayload({
      patient: {
        id: 'patient-3',
        firstName: 'Nadee',
        phone: '0712345678',
        phoneCountryCode: '+94'
      },
      doctor: { firstName: 'Maya', lastName: 'Silva' },
      templates: {
        ...baseTemplates,
        registrationTemplateEnabled: false
      },
      appUrl: 'https://example.test'
    })

    expect(payload).toEqual({ ok: false, reason: 'template-disabled' })
  })

  it('skips when registration channel is email only', () => {
    const payload = buildPatientRegistrationSmsPayload({
      patient: {
        id: 'patient-4',
        firstName: 'Nadee',
        phone: '0712345678',
        phoneCountryCode: '+94'
      },
      doctor: { firstName: 'Maya', lastName: 'Silva' },
      templates: {
        ...baseTemplates,
        registrationChannel: 'email'
      },
      appUrl: 'https://example.test'
    })

    expect(payload).toEqual({ ok: false, reason: 'channel-not-sms' })
  })

  it('skips when sender id is missing', () => {
    const payload = buildPatientRegistrationSmsPayload({
      patient: {
        id: 'patient-5',
        firstName: 'Nadee',
        phone: '0712345678',
        phoneCountryCode: '+94'
      },
      doctor: { firstName: 'Maya', lastName: 'Silva' },
      templates: {
        ...baseTemplates,
        smsSenderId: ''
      },
      appUrl: 'https://example.test'
    })

    expect(payload).toEqual({ ok: false, reason: 'missing-sender-id' })
  })

  it('skips when phone is missing', () => {
    const payload = buildPatientRegistrationSmsPayload({
      patient: {
        id: 'patient-6',
        firstName: 'Nadee',
        phone: '',
        phoneCountryCode: '+94'
      },
      doctor: { firstName: 'Maya', lastName: 'Silva' },
      templates: baseTemplates,
      appUrl: 'https://example.test'
    })

    expect(payload).toEqual({ ok: false, reason: 'missing-phone' })
  })
})
