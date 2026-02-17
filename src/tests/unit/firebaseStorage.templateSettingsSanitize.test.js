import { beforeEach, describe, expect, it, vi } from 'vitest'
import { doc, updateDoc } from 'firebase/firestore'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(() => ({ path: 'doctors/doc-1' })),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  writeBatch: vi.fn(),
  onSnapshot: vi.fn()
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

describe('firebaseStorage.saveDoctorTemplateSettings', () => {
  let firebaseStorage

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('../../services/firebaseStorage.js')
    firebaseStorage = module.default
  })

  it('removes undefined fields from nested template settings before updateDoc', async () => {
    const input = {
      templateType: 'upload',
      headerText: undefined,
      templatePreview: {
        type: 'upload',
        formattedHeader: undefined,
        doctorName: 'Dr Test'
      },
      uploadedHeader: 'data:image/png;base64,AAA'
    }

    await firebaseStorage.saveDoctorTemplateSettings('doc-1', input)

    expect(doc).toHaveBeenCalled()
    expect(updateDoc).toHaveBeenCalledTimes(1)

    const [, payload] = updateDoc.mock.calls[0]
    expect(payload.templateSettings).toEqual({
      templateType: 'upload',
      templatePreview: {
        type: 'upload',
        doctorName: 'Dr Test'
      },
      uploadedHeader: 'data:image/png;base64,AAA'
    })
  })
})

