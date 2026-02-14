import { describe, it, expect, beforeEach, vi } from 'vitest'
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ path: 'reports' })),
  doc: vi.fn((_db, name, id) => ({ path: `${name}/${id}` })),
  addDoc: vi.fn(() => Promise.resolve({ id: 'rep-new' })),
  getDoc: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(() => Promise.resolve()),
  query: vi.fn(() => ({ kind: 'query' })),
  where: vi.fn(() => ({ kind: 'where' })),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve())
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

describe('firebaseStorage reports APIs', () => {
  let firebaseStorage

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('../../services/firebaseStorage.js')
    firebaseStorage = module.default
  })

  it('createReport throws when patientId is missing', async () => {
    await expect(firebaseStorage.createReport({ title: 'No patient' }))
      .rejects.toThrow('Patient ID is required to create a report')
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('createReport saves report and returns created object', async () => {
    const payload = {
      patientId: 'patient-1',
      title: 'CBC',
      type: 'text',
      content: 'Normal'
    }

    const result = await firebaseStorage.createReport(payload)

    expect(collection).toHaveBeenCalled()
    expect(addDoc).toHaveBeenCalledTimes(1)
    const addArg = addDoc.mock.calls[0][1]
    expect(addArg).toEqual(expect.objectContaining({
      patientId: 'patient-1',
      title: 'CBC',
      type: 'text'
    }))
    expect(typeof addArg.createdAt).toBe('string')
    expect(result.id).toBe('rep-new')
  })

  it('createReport rejects content-mismatched PDF uploads', async () => {
    await expect(firebaseStorage.createReport({
      patientId: 'patient-1',
      title: 'Injected PDF',
      type: 'pdf',
      files: [{ name: 'report.pdf', size: 1024, type: 'image/png' }]
    })).rejects.toThrow('Invalid PDF MIME type')
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('createReport rejects oversized uploaded files', async () => {
    await expect(firebaseStorage.createReport({
      patientId: 'patient-1',
      title: 'Large image',
      type: 'image',
      files: [{ name: 'scan.png', size: 11 * 1024 * 1024, type: 'image/png' }],
      dataUrl: 'data:image/png;base64,AA=='
    })).rejects.toThrow('Report file size is invalid')
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('createReport rejects image uploads with non-image data URL payloads', async () => {
    await expect(firebaseStorage.createReport({
      patientId: 'patient-1',
      title: 'Poison payload',
      type: 'image',
      files: [{ name: 'scan.jpg', size: 1024, type: 'image/jpeg' }],
      dataUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='
    })).rejects.toThrow('Invalid image data URL')
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('createReport allows valid secure image upload metadata', async () => {
    const result = await firebaseStorage.createReport({
      patientId: 'patient-1',
      title: 'Chest X-Ray',
      type: 'image',
      files: [{ name: 'xray.jpeg', size: 1024 * 200, type: 'image/jpeg' }],
      dataUrl: 'data:image/jpeg;base64,AA=='
    })

    expect(result.id).toBe('rep-new')
    expect(addDoc).toHaveBeenCalledTimes(1)
  })

  it('createReport persists OCR-extracted text content for camera image reports', async () => {
    const result = await firebaseStorage.createReport({
      patientId: 'patient-1',
      title: 'CBC Camera Capture',
      type: 'image',
      content: 'HB 11.2 g/dL\nWBC 6500',
      files: [{ name: 'camera-capture.jpg', size: 1024 * 220, type: 'image/jpeg', source: 'camera' }],
      dataUrl: 'data:image/jpeg;base64,AA==',
      selectedAreaDataUrl: 'data:image/png;base64,BB=='
    })

    expect(result.id).toBe('rep-new')
    expect(addDoc).toHaveBeenCalledTimes(1)
    const addArg = addDoc.mock.calls[0][1]
    expect(addArg.type).toBe('image')
    expect(addArg.content).toContain('HB 11.2 g/dL')
    expect(addArg.selectedAreaDataUrl).toContain('data:image/png;base64,')
    expect(addArg.files?.[0]?.source).toBe('camera')
  })

  it('createReport rejects invalid selected-area image payload for image report', async () => {
    await expect(firebaseStorage.createReport({
      patientId: 'patient-1',
      title: 'Invalid selected area payload',
      type: 'image',
      files: [{ name: 'scan.jpg', size: 1024, type: 'image/jpeg' }],
      dataUrl: 'data:image/jpeg;base64,AA==',
      selectedAreaDataUrl: 'data:text/html;base64,PGgxPkJhZDwvaDE+'
    })).rejects.toThrow('Invalid selected area image data URL')
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('getReportsByPatientId returns [] when patientId is empty', async () => {
    const result = await firebaseStorage.getReportsByPatientId('')
    expect(result).toEqual([])
    expect(getDocs).not.toHaveBeenCalled()
  })

  it('getReportsByPatientId queries by patient and sorts by newest first', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [
        { id: 'r1', data: () => ({ patientId: 'p1', createdAt: '2024-01-01T00:00:00.000Z', title: 'Old' }) },
        { id: 'r2', data: () => ({ patientId: 'p1', createdAt: '2025-01-01T00:00:00.000Z', title: 'New' }) }
      ]
    })

    const result = await firebaseStorage.getReportsByPatientId('p1')

    expect(where).toHaveBeenCalledWith('patientId', '==', 'p1')
    expect(query).toHaveBeenCalled()
    expect(result.map((r) => r.id)).toEqual(['r2', 'r1'])
  })

  it('deleteReport no-ops when reportId is missing', async () => {
    await firebaseStorage.deleteReport('')
    expect(deleteDoc).not.toHaveBeenCalled()
  })

  it('updateReport throws when reportId is missing', async () => {
    await expect(firebaseStorage.updateReport('', { title: 'Updated' }))
      .rejects.toThrow('Report ID is required to update a report')
    expect(updateDoc).not.toHaveBeenCalled()
  })

  it('updateReport updates report document and returns updated payload', async () => {
    const payload = {
      patientId: 'p1',
      title: 'Updated CBC',
      type: 'text',
      content: 'Improved'
    }
    const result = await firebaseStorage.updateReport('report-9', payload)

    expect(doc).toHaveBeenCalled()
    expect(updateDoc).toHaveBeenCalledTimes(1)
    const updateTarget = updateDoc.mock.calls[0][0]
    const updatePayload = updateDoc.mock.calls[0][1]
    expect(updateTarget).toEqual(expect.objectContaining({ path: 'reports/report-9' }))
    expect(updatePayload).toEqual(expect.objectContaining({
      patientId: 'p1',
      title: 'Updated CBC',
      type: 'text'
    }))
    expect(typeof updatePayload.updatedAt).toBe('string')
    expect(result.id).toBe('report-9')
  })

  it('updateReport rejects invalid PDF MIME type', async () => {
    await expect(firebaseStorage.updateReport('report-2', {
      patientId: 'patient-1',
      title: 'Tampered PDF',
      type: 'pdf',
      files: [{ name: 'scan.pdf', size: 1024, type: 'image/png' }]
    })).rejects.toThrow('Invalid PDF MIME type')

    expect(updateDoc).not.toHaveBeenCalled()
  })

  it('updateReport allows text reports without file metadata', async () => {
    await firebaseStorage.updateReport('report-text-1', {
      patientId: 'patient-1',
      title: 'Progress Notes',
      type: 'text',
      content: 'Patient improved'
    })

    expect(updateDoc).toHaveBeenCalledTimes(1)
    const updatePayload = updateDoc.mock.calls[0][1]
    expect(updatePayload.type).toBe('text')
    expect(updatePayload.content).toBe('Patient improved')
    expect(typeof updatePayload.updatedAt).toBe('string')
  })

  it('deleteReport deletes by report id', async () => {
    await firebaseStorage.deleteReport('report-1')

    expect(doc).toHaveBeenCalled()
    expect(deleteDoc).toHaveBeenCalledTimes(1)
    expect(deleteDoc.mock.calls[0][0]).toEqual(expect.objectContaining({
      path: 'reports/report-1'
    }))
  })
})
