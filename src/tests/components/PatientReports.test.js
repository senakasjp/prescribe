import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import PatientReports from '../../components/patient/PatientReports.svelte'

describe('PatientReports', () => {
  it('shows empty state and dispatches add-report from Add First Report', async () => {
    const user = userEvent.setup()
    const { component } = render(PatientReports, {
      props: {
        reports: [],
        selectedPatient: { id: 'p1' },
        doctorId: 'd1'
      }
    })

    const onAdd = vi.fn()
    component.$on('add-report', onAdd)

    expect(screen.getByText(/No reports available/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Add First Report/i }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('renders reports newest first by createdAt', () => {
    const reports = [
      { id: 'r1', title: 'Older', type: 'text', createdAt: '2024-01-01T00:00:00.000Z', content: 'Old content' },
      { id: 'r2', title: 'Newer', type: 'text', createdAt: '2025-01-01T00:00:00.000Z', content: 'New content' }
    ]

    render(PatientReports, {
      props: {
        reports,
        selectedPatient: { id: 'p1' },
        doctorId: 'd1'
      }
    })

    const headings = screen.getAllByRole('heading', { level: 4 }).map((node) => node.textContent?.trim())
    expect(headings[0]).toBe('Newer')
    expect(headings[1]).toBe('Older')
  })

  it('dispatches view/download/edit/delete events with selected report payload', async () => {
    const user = userEvent.setup()
    const report = {
      id: 'r3',
      title: 'X-Ray',
      type: 'image',
      fileName: 'xray.png',
      createdAt: '2025-02-01T10:00:00.000Z'
    }
    const { component } = render(PatientReports, {
      props: {
        reports: [report],
        selectedPatient: { id: 'p1' },
        doctorId: 'd1'
      }
    })

    const onView = vi.fn()
    const onDownload = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    component.$on('view-report', onView)
    component.$on('download-report', onDownload)
    component.$on('edit-report', onEdit)
    component.$on('delete-report', onDelete)

    await user.click(screen.getByTitle('View report'))
    await user.click(screen.getByTitle('Download report'))
    await user.click(screen.getByTitle('Edit report'))
    await user.click(screen.getByTitle('Delete report'))

    expect(onView).toHaveBeenCalledTimes(1)
    expect(onDownload).toHaveBeenCalledTimes(1)
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)

    expect(onView.mock.calls[0][0].detail.id).toBe('r3')
    expect(onDownload.mock.calls[0][0].detail.id).toBe('r3')
    expect(onEdit.mock.calls[0][0].detail.id).toBe('r3')
    expect(onDelete.mock.calls[0][0].detail.id).toBe('r3')
  })

  it('renders action buttons in expected order for non-text reports', () => {
    const report = {
      id: 'r3-order',
      title: 'CT Image',
      type: 'image',
      fileName: 'ct.png',
      createdAt: '2025-02-01T10:00:00.000Z'
    }

    render(PatientReports, {
      props: {
        reports: [report],
        selectedPatient: { id: 'p1' },
        doctorId: 'd1'
      }
    })

    const actionButtons = screen.getAllByRole('button')
      .filter((button) => button.getAttribute('title'))
      .map((button) => button.getAttribute('title'))

    const firstViewIndex = actionButtons.indexOf('View report')
    const firstEditIndex = actionButtons.indexOf('Edit report')
    const firstDeleteIndex = actionButtons.indexOf('Delete report')

    expect(firstViewIndex).toBeGreaterThan(-1)
    expect(firstEditIndex).toBeGreaterThan(-1)
    expect(firstDeleteIndex).toBeGreaterThan(-1)
    expect(firstViewIndex).toBeLessThan(firstEditIndex)
    expect(firstEditIndex).toBeLessThan(firstDeleteIndex)
  })

  it('hides view/download actions for text reports and keeps edit/delete', () => {
    const report = {
      id: 'r4',
      title: 'Doctor Notes',
      type: 'text',
      createdAt: '2025-02-01T10:00:00.000Z',
      content: 'Patient is stable'
    }

    render(PatientReports, {
      props: {
        reports: [report],
        selectedPatient: { id: 'p1' },
        doctorId: 'd1'
      }
    })

    expect(screen.queryByTitle('View report')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Download report')).not.toBeInTheDocument()
    expect(screen.getByTitle('Edit report')).toBeInTheDocument()
    expect(screen.getByTitle('Delete report')).toBeInTheDocument()
    expect(screen.getByText('Content:')).toBeInTheDocument()
    expect(screen.getByText('Patient is stable')).toBeInTheDocument()
  })

  it('keeps edit before delete for text reports', () => {
    const report = {
      id: 'r4-order',
      title: 'Text Note',
      type: 'text',
      createdAt: '2025-02-01T10:00:00.000Z',
      content: 'Stable'
    }

    render(PatientReports, {
      props: {
        reports: [report],
        selectedPatient: { id: 'p1' },
        doctorId: 'd1'
      }
    })

    const actionButtons = screen.getAllByRole('button')
      .filter((button) => button.getAttribute('title'))
      .map((button) => button.getAttribute('title'))

    const editIndex = actionButtons.indexOf('Edit report')
    const deleteIndex = actionButtons.indexOf('Delete report')
    expect(editIndex).toBeGreaterThan(-1)
    expect(deleteIndex).toBeGreaterThan(-1)
    expect(editIndex).toBeLessThan(deleteIndex)
  })

  it('renders PDF and image metadata blocks with file names and file size', () => {
    const reports = [
      {
        id: 'pdf-1',
        title: 'Lab PDF',
        type: 'pdf',
        fileName: 'lab.pdf',
        fileSize: 1024,
        createdAt: '2025-02-01T10:00:00.000Z'
      },
      {
        id: 'img-1',
        title: 'X-Ray Image',
        type: 'image',
        fileName: 'xray.png',
        fileSize: 2048,
        createdAt: '2025-02-02T10:00:00.000Z'
      }
    ]

    render(PatientReports, {
      props: {
        reports,
        selectedPatient: { id: 'p1' },
        doctorId: 'd1'
      }
    })

    expect(screen.getByText('lab.pdf')).toBeInTheDocument()
    expect(screen.getByText('xray.png')).toBeInTheDocument()
    expect(screen.getByText(/1 KB/)).toBeInTheDocument()
    expect(screen.getByText(/2 KB/)).toBeInTheDocument()
  })

  it('renders report type selector options and dispatches add-report from header button', async () => {
    const user = userEvent.setup()
    const { component } = render(PatientReports, {
      props: {
        reports: [{ id: 'x1', title: 'Existing', type: 'text', createdAt: '2025-01-01T00:00:00.000Z' }],
        selectedPatient: { id: 'p1' },
        doctorId: 'd1'
      }
    })

    const onAdd = vi.fn()
    component.$on('add-report', onAdd)

    const selector = screen.getByRole('combobox')
    const options = Array.from(selector.querySelectorAll('option')).map((opt) => opt.value)
    expect(options).toEqual(['text', 'pdf', 'image'])

    await user.click(screen.getByRole('button', { name: /Add Report/i }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})
