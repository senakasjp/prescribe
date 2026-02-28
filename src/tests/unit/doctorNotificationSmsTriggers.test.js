import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'

process.env.NOTIFY_USER_ID = 'notify-user'
process.env.NOTIFY_API_KEY = 'notify-key'

const functionsRequire = createRequire(`${process.cwd()}/functions/index.js`)
const admin = functionsRequire('firebase-admin')
const functionsModule = functionsRequire('./index.js')
const firestoreSpy = vi.spyOn(admin, 'firestore')

let messagingTemplates = {}
const fetchMock = vi.fn()
global.fetch = fetchMock
let smsLogs = []

const buildFirestoreMock = () => ({
  collection: (name) => {
    if (name === 'systemSettings') {
      return {
        doc: () => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => messagingTemplates
          })
        })
      }
    }

    if (name === 'smsLogs') {
      return {
        add: vi.fn().mockImplementation(async (payload) => {
          smsLogs.push(payload)
        }),
        orderBy: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] })
      }
    }

    return {
      doc: () => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
        set: vi.fn().mockResolvedValue(undefined)
      }),
      add: vi.fn().mockResolvedValue(undefined),
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: true, docs: [] })
    }
  },
  batch: () => ({
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined)
  })
})

describe('doctor notification SMS triggers', () => {
  beforeEach(() => {
    if (typeof functionsModule.__resetInMemoryGuardsForTests === 'function') {
      functionsModule.__resetInMemoryGuardsForTests()
    }

    messagingTemplates = {
      doctorRegistrationTemplateEnabled: true,
      doctorRegistrationTemplate:
        'Hi Dr. {{doctorName}}, your registration is received. {{appUrl}}',
      doctorApprovedTemplateEnabled: true,
      doctorApprovedTemplate:
        'Hi Dr. {{doctorName}}, your account is approved. {{appUrl}}',
      smsSenderId: 'TEST',
      appUrl: 'https://example.test',
      smsTestRecipient: '0770000000',
      doctorRegistrationCopyToTestEnabled: false
    }

    firestoreSpy.mockImplementation(() => buildFirestoreMock())
    smsLogs = []

    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('{"status":"ok"}')
    })
  })

  it('sends doctor registration SMS for newly created pending doctor', async () => {
    await functionsModule.sendDoctorRegistrationSms.run({
      data: {
        data: () => ({
          firstName: 'Maya',
          lastName: 'Silva',
          phone: '0712345678',
          isApproved: false
        })
      }
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://app.notify.lk/api/v1/send')
    const params = new URLSearchParams(options.body)
    expect(params.get('sender_id')).toBe('TEST')
    expect(params.get('to')).toBe('94712345678')
    expect(params.get('message')).toContain('Maya Silva')
    expect(params.get('message')).toContain('https://example.test')
    expect(
      smsLogs.some((entry) =>
        entry.type === 'doctorRegistration' &&
        entry.status === 'sent' &&
        entry.to === '94712345678'
      )
    ).toBe(true)
  })

  it('sends an additional doctor registration test SMS when copy flag is enabled', async () => {
    messagingTemplates = {
      ...messagingTemplates,
      doctorRegistrationCopyToTestEnabled: true
    }

    await functionsModule.sendDoctorRegistrationSms.run({
      data: {
        data: () => ({
          name: 'Dr. Demo',
          phone: '0712345678',
          isApproved: false
        })
      }
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = new URLSearchParams(fetchMock.mock.calls[0][1].body)
    const second = new URLSearchParams(fetchMock.mock.calls[1][1].body)
    expect(first.get('to')).toBe('94712345678')
    expect(second.get('to')).toBe('94770000000')
    expect(smsLogs.filter((entry) => entry.type === 'doctorRegistration')).toHaveLength(1)
    expect(smsLogs.filter((entry) => entry.type === 'doctorRegistrationTestCopy')).toHaveLength(1)
  })

  it('does not duplicate doctor registration SMS when test recipient matches primary recipient', async () => {
    messagingTemplates = {
      ...messagingTemplates,
      doctorRegistrationCopyToTestEnabled: true,
      smsTestRecipient: '0712345678'
    }

    await functionsModule.sendDoctorRegistrationSms.run({
      data: {
        data: () => ({
          name: 'Dr. Demo',
          phone: '0712345678',
          isApproved: false
        })
      }
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('suppresses duplicate registration SMS payload on immediate retry', async () => {
    const event = {
      data: {
        data: () => ({
          name: 'Dr. Retry',
          phone: '0712345678',
          isApproved: false
        })
      }
    }

    await functionsModule.sendDoctorRegistrationSms.run(event)
    await functionsModule.sendDoctorRegistrationSms.run(event)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('skips doctor registration SMS when doctor is already approved', async () => {
    await functionsModule.sendDoctorRegistrationSms.run({
      data: {
        data: () => ({
          name: 'Dr. Demo',
          phone: '0712345678',
          isApproved: true
        })
      }
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('skips doctor registration SMS when template is disabled', async () => {
    messagingTemplates = {
      ...messagingTemplates,
      doctorRegistrationTemplateEnabled: false
    }

    await functionsModule.sendDoctorRegistrationSms.run({
      data: {
        data: () => ({
          name: 'Dr. Demo',
          phone: '0712345678',
          isApproved: false
        })
      }
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('skips doctor registration SMS when recipient number is invalid', async () => {
    await functionsModule.sendDoctorRegistrationSms.run({
      data: {
        data: () => ({
          name: 'Dr. Demo',
          phone: '123',
          isApproved: false
        })
      }
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(
      smsLogs.some((entry) =>
        entry.type === 'doctorRegistration' &&
        entry.status === 'failed' &&
        entry.error === 'Recipient format invalid'
      )
    ).toBe(true)
  })

  it('sends doctor approved SMS only on transition to approved', async () => {
    await functionsModule.sendDoctorApprovedSms.run({
      data: {
        before: {
          data: () => ({
            firstName: 'Maya',
            lastName: 'Silva',
            isApproved: false
          })
        },
        after: {
          data: () => ({
            firstName: 'Maya',
            lastName: 'Silva',
            isApproved: true,
            phone: '0712345678'
          })
        }
      }
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const params = new URLSearchParams(fetchMock.mock.calls[0][1].body)
    expect(params.get('to')).toBe('94712345678')
    expect(params.get('message')).toContain('account is approved')
    expect(
      smsLogs.some((entry) =>
        entry.type === 'doctorApproved' &&
        entry.status === 'sent' &&
        entry.to === '94712345678'
      )
    ).toBe(true)
  })

  it('skips doctor approved SMS when approval state does not transition', async () => {
    await functionsModule.sendDoctorApprovedSms.run({
      data: {
        before: {
          data: () => ({
            isApproved: true
          })
        },
        after: {
          data: () => ({
            isApproved: true,
            phone: '0712345678'
          })
        }
      }
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('skips doctor approved SMS when sender id is missing', async () => {
    messagingTemplates = {
      ...messagingTemplates,
      smsSenderId: ''
    }

    await functionsModule.sendDoctorApprovedSms.run({
      data: {
        before: {
          data: () => ({
            isApproved: false
          })
        },
        after: {
          data: () => ({
            isApproved: true,
            phone: '0712345678'
          })
        }
      }
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
