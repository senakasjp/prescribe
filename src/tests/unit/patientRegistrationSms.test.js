import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { buildPatientRegistrationSmsPayload } = require('../../../functions/patientRegistrationSms.js')

const baseTemplates = {
  patientRegistrationTemplateEnabled: true,
  patientRegistrationChannel: 'sms',
  smsSenderId: 'TEST',
  patientRegistrationTemplate:
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

  it('skips when patient registration template is disabled', () => {
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
        patientRegistrationTemplateEnabled: false
      },
      appUrl: 'https://example.test'
    })

    expect(payload).toEqual({ ok: false, reason: 'template-disabled' })
  })

  it('skips when patient registration channel is email only', () => {
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
        patientRegistrationChannel: 'email'
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

  it('supports legacy registration template keys', () => {
    const payload = buildPatientRegistrationSmsPayload({
      patient: {
        id: 'patient-legacy-1',
        firstName: 'Legacy',
        phone: '0711111111',
        phoneCountryCode: '+94'
      },
      doctor: { firstName: 'Maya', lastName: 'Silva' },
      templates: {
        registrationTemplateEnabled: true,
        registrationChannel: 'sms',
        smsSenderId: 'TEST',
        registrationTemplate: 'Legacy {{name}} {{doctorName}} {{patientShortId}}'
      },
      appUrl: 'https://example.test'
    })

    expect(payload.ok).toBe(true)
    expect(payload.message).toContain('Legacy')
    expect(payload.message).toContain('Maya Silva')
  })

  it('prefers new patient registration keys over legacy keys when both are present', () => {
    const payload = buildPatientRegistrationSmsPayload({
      patient: {
        id: 'patient-priority-1',
        firstName: 'Nimali',
        phone: '0712222222',
        phoneCountryCode: '+94'
      },
      doctor: { firstName: 'Maya', lastName: 'Silva' },
      templates: {
        patientRegistrationTemplateEnabled: true,
        patientRegistrationChannel: 'sms',
        patientRegistrationTemplate: 'NEW {{name}}',
        registrationTemplateEnabled: true,
        registrationChannel: 'sms',
        registrationTemplate: 'OLD {{name}}',
        smsSenderId: 'TEST'
      },
      appUrl: 'https://example.test'
    })

    expect(payload.ok).toBe(true)
    expect(payload.message).toContain('NEW Nimali')
    expect(payload.message).not.toContain('OLD')
  })

  it('renders title placeholders in patient registration SMS template', () => {
    const payload = buildPatientRegistrationSmsPayload({
      patient: {
        id: 'patient-title-1',
        firstName: 'Nimali',
        phone: '0713333333',
        phoneCountryCode: '+94',
        title: 'Ms.'
      },
      doctor: { firstName: 'Maya', lastName: 'Silva' },
      templates: {
        ...baseTemplates,
        patientRegistrationTemplate:
          'Hi {{ title }} {{name}} ({{patientTitle}} / {{patientDisplayName}})'
      },
      appUrl: 'https://example.test'
    })

    expect(payload.ok).toBe(true)
    expect(payload.message).toContain('Hi Ms. Nimali')
    expect(payload.message).toContain('(Ms. / Ms. Nimali)')
  })
})
