import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'

process.env.NOTIFY_USER_ID = 'notify-user'
process.env.NOTIFY_API_KEY = 'notify-key'

const functionsRequire = createRequire(`${process.cwd()}/functions/index.js`)
const admin = functionsRequire('firebase-admin')
const functionsModule = functionsRequire('./index.js')

const firestoreSpy = vi.spyOn(admin, 'firestore')
const authSpy = vi.spyOn(admin, 'auth')
const fetchMock = vi.fn()
global.fetch = fetchMock

const createResponse = () => ({
  statusCode: 200,
  body: '',
  headers: {},
  status(code) {
    this.statusCode = code
    return this
  },
  set(key, value) {
    this.headers[key] = value
    return this
  },
  send(payload) {
    this.body = payload
    return this
  },
  json(payload) {
    this.body = payload
    return this
  }
})

describe('sms logging coverage', () => {
  let messagingTemplates
  let smsLogs
  let patientWrites

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

      if (name === 'doctors') {
        return {
          doc: () => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ name: 'Dr. Maya Silva' })
            })
          })
        }
      }

      if (name === 'patients') {
        return {
          doc: () => ({
            set: vi.fn().mockImplementation(async (payload) => {
              patientWrites.push(payload)
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

  beforeEach(() => {
    if (typeof functionsModule.__resetInMemoryGuardsForTests === 'function') {
      functionsModule.__resetInMemoryGuardsForTests()
    }

    messagingTemplates = {
      patientRegistrationTemplateEnabled: true,
      patientRegistrationChannel: 'sms',
      patientRegistrationTemplate:
        'Welcome {{name}} to M-Prescribe with {{doctorName}}. ID {{patientShortId}}',
      smsSenderId: 'TEST',
      appUrl: 'https://example.test'
    }
    smsLogs = []
    patientWrites = []

    firestoreSpy.mockImplementation(() => buildFirestoreMock())
    authSpy.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: 'admin-1',
        email: 'senakahks@gmail.com'
      })
    })

    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('{"status":"ok"}')
    })
  })

  it('logs patient registration SMS as sent', async () => {
    await functionsModule.sendPatientRegistrationSms.run({
      params: { patientId: 'patient-1' },
      data: {
        data: () => ({
          id: 'patient-1',
          firstName: 'Nimali',
          doctorId: 'doctor-1',
          email: 'nimali@example.com',
          phone: '0713333333',
          phoneCountryCode: '+94'
        })
      }
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(patientWrites).toHaveLength(1)
    expect(
      smsLogs.some((entry) =>
        entry.type === 'patientRegistration' &&
        entry.status === 'sent' &&
        entry.patientId === 'patient-1' &&
        entry.patientEmail === 'nimali@example.com' &&
        entry.doctorId === 'doctor-1'
      )
    ).toBe(true)
  })

  it('logs patient registration SMS as skipped when template is disabled', async () => {
    messagingTemplates = {
      ...messagingTemplates,
      patientRegistrationTemplateEnabled: false
    }

    await functionsModule.sendPatientRegistrationSms.run({
      params: { patientId: 'patient-2' },
      data: {
        data: () => ({
          id: 'patient-2',
          firstName: 'Nimali',
          doctorId: 'doctor-1',
          phone: '0713333333',
          phoneCountryCode: '+94'
        })
      }
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(patientWrites).toHaveLength(0)
    expect(
      smsLogs.some((entry) =>
        entry.type === 'patientRegistration' &&
        entry.status === 'skipped' &&
        entry.error === 'template-disabled'
      )
    ).toBe(true)
  })

  it('logs admin test SMS success and failure', async () => {
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-admin-token' },
      body: {
        recipient: '0712345678',
        senderId: 'TEST',
        message: 'hello'
      }
    }

    const successRes = createResponse()
    await functionsModule.sendSmsApi(req, successRes)
    expect(successRes.statusCode).toBe(200)
    expect(
      smsLogs.some((entry) =>
        entry.type === 'adminTest' &&
        entry.status === 'sent' &&
        entry.to === '94712345678'
      )
    ).toBe(true)

    fetchMock.mockResolvedValueOnce({
      ok: false,
      text: vi.fn().mockResolvedValue('notify error')
    })
    const failureRes = createResponse()
    await functionsModule.sendSmsApi(req, failureRes)
    expect(failureRes.statusCode).toBe(500)
    expect(
      smsLogs.some((entry) =>
        entry.type === 'adminTest' &&
        entry.status === 'failed' &&
        String(entry.error).includes('notify error')
      )
    ).toBe(true)
  })
})
