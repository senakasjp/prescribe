import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'

process.env.NOTIFY_USER_ID = 'notify-user'
process.env.NOTIFY_API_KEY = 'notify-key'
process.env.SMTP_FROM = 'billing@mprescribe.test'

const functionsRequire = createRequire(`${process.cwd()}/functions/index.js`)
const admin = functionsRequire('firebase-admin')
const nodemailer = functionsRequire('nodemailer')
const functionsModule = functionsRequire('./index.js')

const firestoreSpy = vi.spyOn(admin, 'firestore')
const fetchMock = vi.fn()
global.fetch = fetchMock

describe('stripe payment notifications idempotency', () => {
  let doctorsStore
  let paymentLocks
  let doctorPaymentRecords
  let emailLogs
  let smsLogs
  let sendMailMock

  const buildFirestoreMock = () => ({
    collection: (name) => {
      if (name === 'stripePaymentLocks') {
        return {
          doc: (id) => ({
            create: vi.fn().mockImplementation(async (payload) => {
              if (paymentLocks.has(id)) {
                const error = new Error('Already exists')
                error.code = 6
                throw error
              }
              paymentLocks.set(id, payload)
            })
          })
        }
      }

      if (name === 'doctors') {
        return {
          doc: (id) => ({
            get: vi.fn().mockResolvedValue({
              exists: doctorsStore.has(id),
              data: () => doctorsStore.get(id) || {}
            }),
            set: vi.fn().mockImplementation(async (payload, opts = {}) => {
              const current = doctorsStore.get(id) || {}
              if (opts && opts.merge) {
                doctorsStore.set(id, { ...current, ...payload })
              } else {
                doctorsStore.set(id, payload)
              }
            })
          })
        }
      }

      if (name === 'doctorPaymentRecords') {
        return {
          add: vi.fn().mockImplementation(async (payload) => {
            doctorPaymentRecords.push(payload)
          })
        }
      }

      if (name === 'emailLogs') {
        return {
          add: vi.fn().mockImplementation(async (payload) => {
            emailLogs.push(payload)
          }),
          orderBy: vi.fn().mockReturnThis(),
          offset: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] })
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

      if (name === 'systemSettings') {
        return {
          doc: (docId) => ({
            get: vi.fn().mockResolvedValue((() => {
              if (docId === 'smtp') {
                return {
                  exists: true,
                  data: () => ({
                    host: 'smtp.test.local',
                    port: 587,
                    secure: false,
                    user: 'smtp-user',
                    pass: 'smtp-pass',
                    fromAddress: 'billing@mprescribe.test'
                  })
                }
              }
              if (docId === 'paymentThanksEmail') {
                return {
                  exists: true,
                  data: () => ({
                    enabled: true,
                    subject: 'Payment received',
                    text: 'Thanks {{name}}',
                    html: '<p>Thanks {{name}}</p>'
                  })
                }
              }
              if (docId === 'messagingTemplates') {
                return {
                  exists: true,
                  data: () => ({
                    appUrl: 'https://example.test',
                    smsSenderId: 'TEST',
                    paymentSuccessTemplateEnabled: true,
                    paymentSuccessTemplate:
                      'Hi {{doctorName}}, payment successful.'
                  })
                }
              }
              return { exists: false, data: () => ({}) }
            })())
          })
        }
      }

      return {
        doc: () => ({
          get: vi.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
          set: vi.fn().mockResolvedValue(undefined)
        }),
        add: vi.fn().mockResolvedValue(undefined),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        orderBy: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis()
      }
    },
    batch: () => ({
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined)
    })
  })

  beforeEach(() => {
    doctorsStore = new Map([
      ['doctor-1', {
        email: 'doctor@test.com',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '0712345678',
        walletMonths: 0
      }]
    ])
    paymentLocks = new Map()
    doctorPaymentRecords = []
    emailLogs = []
    smsLogs = []

    firestoreSpy.mockImplementation(() => buildFirestoreMock())

    sendMailMock = vi.fn().mockResolvedValue({ messageId: 'msg-1' })
    vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail: sendMailMock
    })

    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('{"status":"ok"}')
    })
  })

  it('sends payment success SMS and email only once for duplicate payment reference', async () => {
    const firstResult = await functionsModule.__applyDoctorPaymentSuccessForTests({
      resolvedDoctorId: 'doctor-1',
      planId: 'professional_monthly_lkr',
      interval: 'month',
      sessionId: 'cs_test_123',
      paymentReferenceId: 'cs_test_123',
      customerId: 'cus_123',
      subscriptionId: 'sub_123',
      paidAt: '2026-02-15T10:00:00.000Z'
    })

    const secondResult = await functionsModule.__applyDoctorPaymentSuccessForTests({
      resolvedDoctorId: 'doctor-1',
      planId: 'professional_monthly_lkr',
      interval: 'month',
      sessionId: 'cs_test_123',
      paymentReferenceId: 'cs_test_123',
      customerId: 'cus_123',
      subscriptionId: 'sub_123',
      paidAt: '2026-02-15T10:00:02.000Z'
    })

    expect(sendMailMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(doctorPaymentRecords).toHaveLength(1)

    const emailSuccessLogs = emailLogs.filter(
      (entry) => entry.type === 'paymentThanksEmail' && entry.status === 'sent'
    )
    expect(emailSuccessLogs).toHaveLength(1)

    const smsSuccessLogs = smsLogs.filter(
      (entry) => entry.type === 'paymentSuccess' && entry.status === 'sent'
    )
    expect(smsSuccessLogs).toHaveLength(1)
    expect(firstResult.walletMonths).toBe(1)
    expect(secondResult.walletMonths).toBe(1)
    expect(doctorsStore.get('doctor-1')?.walletMonths).toBe(1)
  })
})
