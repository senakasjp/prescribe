import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const STORAGE_KEY = 'prescribe-ai-token-usage'
const { addDoctorAIUsageRecordMock } = vi.hoisted(() => ({
  addDoctorAIUsageRecordMock: vi.fn(() => Promise.resolve(true))
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    addDoctorAIUsageRecord: addDoctorAIUsageRecordMock
  }
}))

const loadTracker = async () => {
  const module = await import('../../services/aiTokenTracker.js')
  return module.default
}

describe('aiTokenTracker', () => {
  beforeEach(() => {
    localStorage.clear()
    addDoctorAIUsageRecordMock.mockClear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-13T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('tracks OpenAI token usage and updates totals/daily/monthly buckets', async () => {
    const tracker = await loadTracker()

    const request = tracker.trackUsage('reportAnalysis', 100, 50, 'gpt-4o', null)

    expect(request.type).toBe('reportAnalysis')
    expect(request.totalTokens).toBe(150)
    expect(request.doctorId).toBe('unknown-doctor')

    const stats = tracker.getUsageStats()
    expect(stats.total.tokens).toBe(150)
    expect(stats.total.requests).toBe(1)
    expect(stats.today.tokens).toBe(150)
    expect(stats.today.requests).toBe(1)
    expect(stats.thisMonth.tokens).toBe(150)

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(Array.isArray(persisted.requests)).toBe(true)
    expect(persisted.requests).toHaveLength(1)
    expect(persisted.requests[0].doctorId).toBe('unknown-doctor')
    expect(addDoctorAIUsageRecordMock).not.toHaveBeenCalled()
  })

  it('persists usage to server when doctor id is known', async () => {
    const tracker = await loadTracker()
    tracker.trackUsage('chatbotResponse', 12, 8, 'gpt-4o-mini', 'doc-server-1')

    expect(addDoctorAIUsageRecordMock).toHaveBeenCalledTimes(1)
    expect(addDoctorAIUsageRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        doctorId: 'doc-server-1',
        requestType: 'chatbotResponse',
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20,
        model: 'gpt-4o-mini'
      })
    )
  })

  it('aggregates token usage by doctor and separates today usage correctly', async () => {
    const tracker = await loadTracker()

    tracker.trackUsage('summary', 120, 30, 'gpt-4o-mini', 'doc-a')
    tracker.trackUsage('improveText', 80, 20, 'gpt-4o-mini', 'doc-b')

    vi.setSystemTime(new Date('2026-02-14T10:00:00.000Z'))
    tracker.trackUsage('summary', 40, 10, 'gpt-4o-mini', 'doc-a')

    const doctorAStats = tracker.getDoctorUsageStats('doc-a')
    expect(doctorAStats.total.tokens).toBe(200)
    expect(doctorAStats.total.requests).toBe(2)
    expect(doctorAStats.today.tokens).toBe(50)
    expect(doctorAStats.today.requests).toBe(1)

    const doctorBStats = tracker.getDoctorUsageStats('doc-b')
    expect(doctorBStats.total.tokens).toBe(100)
    expect(doctorBStats.total.requests).toBe(1)
    expect(doctorBStats.today.tokens).toBe(0)
    expect(doctorBStats.today.requests).toBe(0)
  })

  it('applies doctor quota and reports exceeded status', async () => {
    const tracker = await loadTracker()

    tracker.trackUsage('chat', 70, 50, 'gpt-4o-mini', 'doc-quota')
    tracker.setDoctorQuota('doc-quota', 100)

    expect(tracker.isQuotaExceeded('doc-quota')).toBe(true)

    const quotaStatus = tracker.getDoctorQuotaStatus('doc-quota')
    expect(quotaStatus.hasQuota).toBe(true)
    expect(quotaStatus.quotaTokens).toBe(100)
    expect(quotaStatus.usedTokens).toBe(120)
    expect(quotaStatus.isExceeded).toBe(true)
  })

  it('migrates existing requests with missing doctorId to unknown-doctor', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      totalTokens: 25,
      totalCost: 0.1,
      dailyUsage: {},
      monthlyUsage: {},
      requests: [
        {
          id: 1,
          type: 'legacy',
          timestamp: '2026-02-13T00:00:00.000Z',
          promptTokens: 20,
          completionTokens: 5,
          totalTokens: 25,
          cost: 0.1,
          doctorId: null
        }
      ],
      doctorQuotas: {},
      defaultQuota: 50000,
      tokenPricePerMillion: 0.5,
      lastUpdated: null
    }))

    const tracker = await loadTracker()
    const recent = tracker.getRecentRequests(1)
    expect(recent[0].doctorId).toBe('unknown-doctor')

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(persisted.requests[0].doctorId).toBe('unknown-doctor')
  })

  it('keeps only the last 100 requests and returns recent requests sorted by timestamp', async () => {
    const tracker = await loadTracker()

    for (let i = 0; i < 105; i += 1) {
      vi.setSystemTime(new Date(`2026-02-13T10:${String(i % 60).padStart(2, '0')}:00.000Z`))
      tracker.trackUsage(`req-${i}`, 1, 1, 'gpt-4o-mini', 'doc-limit')
    }

    const stats = tracker.getUsageStats()
    expect(stats.total.requests).toBe(100)
    expect(stats.total.tokens).toBe(200)

    const recent = tracker.getRecentRequests(5)
    expect(recent).toHaveLength(5)
    expect(new Date(recent[0].timestamp).getTime()).toBeGreaterThanOrEqual(new Date(recent[1].timestamp).getTime())
  })

  it('returns weekly and monthly usage arrays with fixed lengths', async () => {
    const tracker = await loadTracker()
    tracker.trackUsage('weekly-check', 20, 10, 'gpt-4o-mini', 'doc-week')

    const weekly = tracker.getWeeklyUsage()
    const monthly = tracker.getMonthlyUsage()

    expect(weekly).toHaveLength(7)
    expect(monthly).toHaveLength(6)
    expect(weekly[6].tokens).toBe(30)
    expect(weekly[6].requests).toBe(1)
  })

  it('applies default quota to doctors without quotas and supports explicit doctor quota application', async () => {
    const tracker = await loadTracker()
    tracker.trackUsage('q1', 5, 5, 'gpt-4o-mini', 'doc-1')
    tracker.trackUsage('q2', 5, 5, 'gpt-4o-mini', 'doc-2')
    tracker.trackUsage('q3', 5, 5, 'gpt-4o-mini', 'doc-3')

    tracker.setDoctorQuota('doc-1', 999)
    tracker.setDefaultQuota(1234)
    const applied = tracker.applyDefaultQuotaToAllDoctors()
    expect(applied).toBe(2)
    expect(tracker.getDoctorQuota('doc-1').monthlyTokens).toBe(999)
    expect(tracker.getDoctorQuota('doc-2').monthlyTokens).toBe(1234)
    expect(tracker.getDoctorQuota('doc-3').monthlyTokens).toBe(1234)

    const explicitApplied = tracker.applyDefaultQuotaToDoctors(['doc-x', 'doc-y'])
    expect(explicitApplied).toBe(2)
    expect(tracker.getDoctorQuota('doc-x').monthlyTokens).toBe(1234)
    expect(tracker.getDoctorQuota('doc-y').monthlyTokens).toBe(1234)
  })

  it('supports token price configuration and cost calculation', async () => {
    const tracker = await loadTracker()
    tracker.setTokenPricePerMillion(2.5)

    expect(tracker.getTokenPricePerMillion()).toBe(2.5)
    expect(tracker.calculateCost(1_000_000)).toBe(2.5)
    expect(tracker.calculateCost(500_000)).toBe(1.25)
  })

  it('normalizes string numeric fields when reading usage stats', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      totalTokens: '1,000',
      totalCost: '$5.50',
      dailyUsage: {
        '2026-02-13': { tokens: '200', cost: '$1.00', requests: '2' }
      },
      monthlyUsage: {
        '2026-02': { tokens: '1000', cost: '5.5', requests: '10' }
      },
      requests: [
        {
          id: 1,
          type: 'legacy',
          timestamp: '2026-02-13T00:00:00.000Z',
          promptTokens: '10',
          completionTokens: '5',
          totalTokens: '15',
          cost: '$0.10',
          doctorId: 'doc-norm'
        }
      ],
      doctorQuotas: {},
      defaultQuota: 50000,
      tokenPricePerMillion: 0.5,
      lastUpdated: null
    }))

    const tracker = await loadTracker()
    const stats = tracker.getUsageStats()
    expect(stats.total.tokens).toBe(15)
    expect(stats.total.cost).toBe(0.1)
    expect(stats.total.requests).toBe(1)
  })

  it('derives today and this-month stats from requests to prevent bucket drift inconsistencies', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      totalTokens: 999999,
      totalCost: 999,
      dailyUsage: {
        '2026-02-13': { tokens: 5000, cost: 50, requests: 5 }
      },
      monthlyUsage: {
        '2026-02': { tokens: 200000, cost: 200, requests: 200 }
      },
      requests: [
        {
          id: 1,
          type: 'improveText',
          timestamp: '2026-02-13T09:00:00.000Z',
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          cost: 0.1,
          doctorId: 'doc-a'
        },
        {
          id: 2,
          type: 'patientSummary',
          timestamp: '2026-01-31T09:00:00.000Z',
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          cost: 0.1,
          doctorId: 'doc-a'
        }
      ],
      doctorQuotas: {},
      defaultQuota: 50000,
      tokenPricePerMillion: 0.5,
      lastUpdated: null
    }))

    const tracker = await loadTracker()
    const stats = tracker.getUsageStats()

    expect(stats.total.tokens).toBe(30)
    expect(stats.total.cost).toBe(0.2)
    expect(stats.total.requests).toBe(2)
    expect(stats.today.tokens).toBe(15)
    expect(stats.today.cost).toBe(0.1)
    expect(stats.today.requests).toBe(1)
    expect(stats.thisMonth.tokens).toBe(15)
    expect(stats.thisMonth.cost).toBe(0.1)
    expect(stats.thisMonth.requests).toBe(1)
  })

  it('migrates legacy misordered trackUsage entries so doctor usage is attributed correctly', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      totalTokens: 40,
      totalCost: 0,
      dailyUsage: {},
      monthlyUsage: {},
      requests: [
        {
          id: 1,
          type: 'doc-legacy-1',
          timestamp: '2026-02-13T00:00:00.000Z',
          promptTokens: 40,
          completionTokens: 'improveText',
          totalTokens: '40improveText',
          cost: 0,
          doctorId: 'unknown-doctor',
          model: 'gpt-3.5-turbo'
        }
      ],
      doctorQuotas: {},
      defaultQuota: 50000,
      tokenPricePerMillion: 0.5,
      lastUpdated: null
    }))

    const tracker = await loadTracker()
    const doctorStats = tracker.getDoctorUsageStats('doc-legacy-1')

    expect(doctorStats.total.tokens).toBe(40)
    expect(doctorStats.total.requests).toBe(1)

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(persisted.requests[0].type).toBe('improveText')
    expect(persisted.requests[0].doctorId).toBe('doc-legacy-1')
    expect(persisted.requests[0].completionTokens).toBe(0)
  })

  it('clears usage data while preserving stable operation afterward', async () => {
    const tracker = await loadTracker()
    tracker.trackUsage('before-clear', 10, 5, 'gpt-4o-mini', 'doc-clear')
    tracker.clearUsageData()

    const statsAfterClear = tracker.getUsageStats()
    expect(statsAfterClear.total.tokens).toBe(0)
    expect(statsAfterClear.total.requests).toBe(0)
    expect(tracker.getRecentRequests()).toHaveLength(0)

    tracker.trackUsage('after-clear', 3, 2, 'gpt-4o-mini', 'doc-clear')
    const statsAfterNewUsage = tracker.getUsageStats()
    expect(statsAfterNewUsage.total.tokens).toBe(5)
    expect(statsAfterNewUsage.total.requests).toBe(1)
  })
})
