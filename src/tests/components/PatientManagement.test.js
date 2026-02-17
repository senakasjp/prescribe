import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/svelte'
import PatientManagement from '../../components/PatientManagement.svelte'

const {
  chartConfigs,
  chartRender,
  chartDestroy,
  ApexChartsMock,
  doctor,
  currentMonthRx,
  previousMonthRx
} = vi.hoisted(() => {
  const chartConfigs = []
  const chartRender = vi.fn()
  const chartDestroy = vi.fn()
  const ApexChartsMock = vi.fn().mockImplementation((element, options) => {
    chartConfigs.push(options)
    const marker = document.createElement('div')
    marker.setAttribute('data-mock-apex', '1')
    marker.setAttribute('data-series-first', options?.series?.[0]?.name || '')

    return {
      render: () => {
        chartRender()
        if (element && marker.parentNode !== element) {
          element.appendChild(marker)
        }
      },
      destroy: () => {
        chartDestroy()
        if (marker.parentNode) {
          marker.parentNode.removeChild(marker)
        }
      }
    }
  })

  const doctor = {
    id: 'doc-1',
    email: 'doctor@example.com',
    firstName: 'Test',
    lastName: 'Doctor',
    country: 'Sri Lanka',
    city: 'Colombo',
    currency: 'USD',
    roundingPreference: 'none',
    connectedPharmacists: [],
    deleteCode: '123456'
  }

  const now = new Date()
  const toIso = (daysOffset, monthOffset = 0) => {
    const value = new Date(now.getFullYear(), now.getMonth() + monthOffset, now.getDate() + daysOffset, 10, 0, 0)
    return value.toISOString()
  }

  const currentMonthRx = [
    { id: 'rx-current-1', patientId: 'pat-1', doctorId: 'doc-1', createdAt: toIso(-3) },
    { id: 'rx-current-2', patientId: 'pat-1', doctorId: 'doc-1', createdAt: toIso(-1) },
    { id: 'rx-current-3', patientId: 'pat-2', doctorId: 'doc-1', createdAt: toIso(-1) }
  ]

  const previousMonthRx = [
    { id: 'rx-prev-1', patientId: 'pat-3', doctorId: 'doc-1', createdAt: toIso(2, -1) }
  ]

  return {
    chartConfigs,
    chartRender,
    chartDestroy,
    ApexChartsMock,
    doctor,
    currentMonthRx,
    previousMonthRx
  }
})

vi.mock('apexcharts', () => ({
  default: ApexChartsMock
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getDoctorByEmail: vi.fn(async () => doctor),
    getDoctorById: vi.fn(async () => doctor),
    getDoctorTemplateSettings: vi.fn(async () => null),
    getPatients: vi.fn(async () => [
      { id: 'pat-1', createdAt: currentMonthRx[0].createdAt },
      { id: 'pat-2', createdAt: currentMonthRx[2].createdAt }
    ]),
    getPrescriptionsByPatientId: vi.fn(async (patientId) =>
      currentMonthRx.filter((item) => item.patientId === patientId)
    ),
    getAllPharmacists: vi.fn(async () => []),
    getMedicationsByPatientId: vi.fn(async (patientId) =>
      currentMonthRx.filter((item) => item.patientId === patientId)
    ),
    getPrescriptionsByDoctorId: vi.fn(async () => [...currentMonthRx, ...previousMonthRx])
  }
}))

vi.mock('../../services/pharmacyMedicationService.js', () => ({
  pharmacyMedicationService: {
    getPharmacyStock: vi.fn(async () => [])
  }
}))

vi.mock('../../services/pharmacist/chargeCalculationService.js', () => ({
  default: {
    calculateExpectedChargeFromStock: vi.fn((prescription) => {
      if (String(prescription.id).includes('prev')) {
        return {
          doctorCharges: { totalAfterDiscount: 80 },
          drugCharges: { totalCost: 20 }
        }
      }
      return {
        doctorCharges: { totalAfterDiscount: 120 },
        drugCharges: { totalCost: 30 }
      }
    })
  }
}))

const settleCharts = async () => {
  await new Promise((resolve) => setTimeout(resolve, 900))
}

describe('PatientManagement home charts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chartConfigs.length = 0
  })

  it('configures prescription activity chart with returning series and distinct color', async () => {
    render(PatientManagement, {
      props: {
        currentView: 'home',
        user: doctor,
        authUser: null
      }
    })

    await settleCharts()

    await waitFor(() => {
      const prescriptionChart = chartConfigs.find(
        (config) => config?.series?.some((series) => series.name === 'Returning')
      )
      expect(prescriptionChart).toBeTruthy()
      expect(prescriptionChart.series.map((series) => series.name)).toEqual([
        'Total Prescriptions',
        'Returning'
      ])
      expect(prescriptionChart.colors).toEqual(['#0891b2', '#f97316'])
      expect(prescriptionChart.stroke.dashArray).toEqual([0, 6])
    })
  })

  it('configures income chart with current-vs-last month grouped bars and different colors', async () => {
    render(PatientManagement, {
      props: {
        currentView: 'home',
        user: doctor,
        authUser: null
      }
    })

    await settleCharts()
    window.dispatchEvent(new Event('prescriptionSaved'))
    await settleCharts()

    await waitFor(() => {
      const incomeChart = chartConfigs.find(
        (config) => config?.series?.some((series) => series.name === 'This Month')
      )
      expect(incomeChart).toBeTruthy()
      expect(incomeChart.chart.type).toBe('bar')
      expect(incomeChart.series.map((series) => series.name)).toEqual(['This Month', 'Last Month'])
      expect(incomeChart.colors).toEqual(['#0891b2', '#a855f7'])
      expect(incomeChart.plotOptions.bar.columnWidth).toBe('70%')
    })
  })

  it('shows existing vs new patient split on the home stats card', async () => {
    const oldPatientDate = new Date()
    oldPatientDate.setDate(oldPatientDate.getDate() - 60)

    const firebaseStorageModule = await import('../../services/firebaseStorage.js')
    firebaseStorageModule.default.getPatients.mockResolvedValueOnce([
      { id: 'pat-1', createdAt: currentMonthRx[0].createdAt },
      { id: 'pat-2', createdAt: oldPatientDate.toISOString() }
    ])

    const { container } = render(PatientManagement, {
      props: {
        currentView: 'home',
        user: doctor,
        authUser: null
      }
    })

    await settleCharts()

    await waitFor(() => {
      const text = container.textContent || ''
      expect(text).toContain('Existing vs New')
      expect(text).toContain('existing')
      expect(text).toContain('new (30d)')
    })
  })

  it('maps expected income values into this-month and last-month series', async () => {
    render(PatientManagement, {
      props: {
        currentView: 'home',
        user: doctor,
        authUser: null
      }
    })

    await settleCharts()

    await waitFor(() => {
      const incomeChart = chartConfigs.find(
        (config) => config?.series?.some((series) => series.name === 'This Month')
      )
      expect(incomeChart).toBeTruthy()
      const thisMonthSeries = incomeChart.series.find((series) => series.name === 'This Month')
      const lastMonthSeries = incomeChart.series.find((series) => series.name === 'Last Month')
      expect(thisMonthSeries.data.some((value) => value === 150)).toBe(true)
      expect(lastMonthSeries.data.some((value) => value === 100)).toBe(true)
    })
  })

  it('shows patients and settings quick actions but hides prescriptions quick action on home', async () => {
    const { getByRole, queryByRole } = render(PatientManagement, {
      props: {
        currentView: 'home',
        user: doctor,
        authUser: null
      }
    })

    await waitFor(() => {
      expect(getByRole('button', { name: /^Patients$/i })).toBeTruthy()
      expect(getByRole('button', { name: /^Settings$/i })).toBeTruthy()
      expect(queryByRole('button', { name: /^Prescriptions$/i })).toBeNull()
    })
  })

  it('keeps a single mounted income chart after rapid refresh events', async () => {
    render(PatientManagement, {
      props: {
        currentView: 'home',
        user: doctor,
        authUser: null
      }
    })

    await settleCharts()
    window.dispatchEvent(new Event('prescriptionSaved'))
    window.dispatchEvent(new Event('prescriptionSaved'))
    window.dispatchEvent(new Event('prescriptionSaved'))
    await settleCharts()

    await waitFor(() => {
      const incomeHost = document.getElementById('incomeComparisonChart')
      expect(incomeHost).toBeTruthy()
      const mountedIncomeCharts = incomeHost.querySelectorAll('[data-mock-apex="1"]')
      expect(mountedIncomeCharts.length).toBe(1)
    })
  })

  it('re-renders home charts after returning from another tab', async () => {
    const view = render(PatientManagement, {
      props: {
        currentView: 'patients',
        user: doctor,
        authUser: null
      }
    })

    await settleCharts()
    expect(document.getElementById('incomeComparisonChart')).toBeNull()

    await view.rerender({
      currentView: 'home',
      user: doctor,
      authUser: null
    })

    await settleCharts()

    await waitFor(() => {
      const prescriptionHost = document.getElementById('prescriptionsChart')
      const incomeHost = document.getElementById('incomeComparisonChart')
      expect(prescriptionHost).toBeTruthy()
      expect(incomeHost).toBeTruthy()
      expect(prescriptionHost.querySelector('[data-series-first="Total Prescriptions"]')).toBeTruthy()
      expect(incomeHost.querySelector('[data-series-first="This Month"]')).toBeTruthy()
    })
  })

  it('re-renders home charts after tab return followed by window resize', async () => {
    const view = render(PatientManagement, {
      props: {
        currentView: 'patients',
        user: doctor,
        authUser: null
      }
    })

    await settleCharts()
    await view.rerender({
      currentView: 'home',
      user: doctor,
      authUser: null
    })
    await settleCharts()

    window.dispatchEvent(new Event('resize'))
    await settleCharts()

    await waitFor(() => {
      const prescriptionHost = document.getElementById('prescriptionsChart')
      const incomeHost = document.getElementById('incomeComparisonChart')
      expect(prescriptionHost).toBeTruthy()
      expect(incomeHost).toBeTruthy()
      expect(prescriptionHost.querySelector('[data-series-first="Total Prescriptions"]')).toBeTruthy()
      expect(incomeHost.querySelector('[data-series-first="This Month"]')).toBeTruthy()
      expect(prescriptionHost.querySelectorAll('[data-mock-apex="1"]').length).toBe(1)
      expect(incomeHost.querySelectorAll('[data-mock-apex="1"]').length).toBe(1)
    })
  })
})
