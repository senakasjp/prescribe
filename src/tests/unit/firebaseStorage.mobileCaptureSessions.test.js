import { beforeEach, describe, expect, it, vi } from 'vitest'

const docMock = vi.fn()
const setDocMock = vi.fn()
const deleteDocMock = vi.fn()
const onSnapshotMock = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: docMock,
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: setDocMock,
  deleteDoc: deleteDocMock,
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  writeBatch: vi.fn(),
  onSnapshot: onSnapshotMock
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

describe('firebaseStorage mobile capture session contract', () => {
  let firebaseStorage

  beforeEach(async () => {
    vi.clearAllMocks()
    docMock.mockImplementation((_db, col, id) => ({ path: `${col}/${id}`, id }))
    setDocMock.mockResolvedValue(undefined)
    deleteDocMock.mockResolvedValue(undefined)
    const module = await import('../../services/firebaseStorage.js')
    firebaseStorage = module.default
  })

  it('upsertMobileCaptureSession uppercases code and writes merge payload', async () => {
    const payload = { status: 'qr_ready', doctorId: 'doc-1' }
    const result = await firebaseStorage.upsertMobileCaptureSession('ab12cd34', payload)

    expect(docMock).toHaveBeenCalledWith({}, 'mobileCaptureSessions', 'AB12CD34')
    expect(setDocMock).toHaveBeenCalledTimes(1)
    const [refArg, dataArg, optionsArg] = setDocMock.mock.calls[0]
    expect(refArg).toEqual({ path: 'mobileCaptureSessions/AB12CD34', id: 'AB12CD34' })
    expect(dataArg).toMatchObject({
      code: 'AB12CD34',
      status: 'qr_ready',
      doctorId: 'doc-1'
    })
    expect(typeof dataArg.updatedAt).toBe('string')
    expect(optionsArg).toEqual({ merge: true })
    expect(result).toEqual({ id: 'AB12CD34', ...payload })
  })

  it('subscribeMobileCaptureSession maps snapshot payload and forwards errors', () => {
    const callback = vi.fn()
    const errorCallback = vi.fn()
    let onData
    let onError
    onSnapshotMock.mockImplementation((_ref, dataHandler, errorHandler) => {
      onData = dataHandler
      onError = errorHandler
      return vi.fn()
    })

    const unsubscribe = firebaseStorage.subscribeMobileCaptureSession('ab12cd34', callback, errorCallback)
    expect(typeof unsubscribe).toBe('function')
    expect(docMock).toHaveBeenCalledWith({}, 'mobileCaptureSessions', 'AB12CD34')

    onData({
      exists: () => true,
      id: 'AB12CD34',
      data: () => ({ status: 'photo_ready', imageDataUrl: 'data:image/png;base64,X' })
    })
    expect(callback).toHaveBeenCalledWith({
      id: 'AB12CD34',
      status: 'photo_ready',
      imageDataUrl: 'data:image/png;base64,X'
    })

    const listenerError = new Error('listener failed')
    onError(listenerError)
    expect(errorCallback).toHaveBeenCalledWith(listenerError)
  })

  it('deleteMobileCaptureSession uppercases session code before delete', async () => {
    await firebaseStorage.deleteMobileCaptureSession('ab12cd34')
    expect(docMock).toHaveBeenCalledWith({}, 'mobileCaptureSessions', 'AB12CD34')
    expect(deleteDocMock).toHaveBeenCalledWith({ path: 'mobileCaptureSessions/AB12CD34', id: 'AB12CD34' })
  })
})
