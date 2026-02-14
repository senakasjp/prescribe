import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
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

describe('firebaseStorage onboarding dummy data lifecycle', () => {
  let firebaseStorage

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('../../services/firebaseStorage.js')
    firebaseStorage = module.default
  })

  it('hasOnboardingDummyDataForDoctor returns true when any dummy marker exists', async () => {
    vi.spyOn(firebaseStorage, 'getPatientsByDoctorId').mockResolvedValue([{ id: 'p1', isOnboardingDummy: true }])
    vi.spyOn(firebaseStorage, 'getPrescriptionsByDoctorId').mockResolvedValue([])
    vi.spyOn(firebaseStorage, 'getDoctorDrugs').mockResolvedValue([])
    vi.spyOn(firebaseStorage, 'getDoctorById').mockResolvedValue({ id: 'doc-1', templateSettings: null })

    const result = await firebaseStorage.hasOnboardingDummyDataForDoctor('doc-1')

    expect(result).toBe(true)
  })

  it('seedOnboardingDummyDataForDoctor creates patient, 5 drugs, prescription, and template for empty doctor data', async () => {
    vi.spyOn(firebaseStorage, 'getPatientsByDoctorId').mockResolvedValue([])
    vi.spyOn(firebaseStorage, 'getPrescriptionsByDoctorId').mockResolvedValue([])
    vi.spyOn(firebaseStorage, 'getDoctorDrugs').mockResolvedValue([])
    vi.spyOn(firebaseStorage, 'getDoctorById').mockResolvedValue({ id: 'doc-1', templateSettings: null })

    const createPatientSpy = vi.spyOn(firebaseStorage, 'createPatient').mockResolvedValue({
      id: 'dummy-patient-1',
      firstName: 'Demo',
      lastName: 'Patient',
      age: '34',
      gender: 'Female',
      phone: '+15550001001'
    })
    const addDrugSpy = vi.spyOn(firebaseStorage, 'addDrug').mockResolvedValue({ id: 'drug-id' })
    const createPrescriptionSpy = vi.spyOn(firebaseStorage, 'createPrescription').mockResolvedValue({ id: 'rx-id' })
    const saveTemplateSpy = vi.spyOn(firebaseStorage, 'saveDoctorTemplateSettings').mockResolvedValue(true)

    await firebaseStorage.seedOnboardingDummyDataForDoctor({ id: 'doc-1', email: 'new@doc.com' })

    expect(createPatientSpy).toHaveBeenCalledWith(expect.objectContaining({
      doctorId: 'doc-1',
      isOnboardingDummy: true
    }))
    expect(addDrugSpy).toHaveBeenCalledTimes(5)
    expect(createPrescriptionSpy).toHaveBeenCalledWith(expect.objectContaining({
      patientId: 'dummy-patient-1',
      doctorId: 'doc-1',
      isOnboardingDummy: true
    }))
    expect(saveTemplateSpy).toHaveBeenCalledWith('doc-1', expect.objectContaining({
      templateType: 'system',
      isOnboardingDummy: true
    }))
  })

  it('seedOnboardingDummyDataForDoctor is idempotent for existing dummy patient and prescription', async () => {
    vi.spyOn(firebaseStorage, 'getPatientsByDoctorId').mockResolvedValue([
      { id: 'dummy-patient-1', isOnboardingDummy: true }
    ])
    vi.spyOn(firebaseStorage, 'getPrescriptionsByDoctorId').mockResolvedValue([
      { id: 'dummy-rx-1', isOnboardingDummy: true }
    ])
    vi.spyOn(firebaseStorage, 'getDoctorDrugs').mockResolvedValue([
      { id: 'drug-1', name: 'Paracetamol', isOnboardingDummy: true },
      { id: 'drug-2', name: 'Amoxicillin', isOnboardingDummy: true }
    ])
    vi.spyOn(firebaseStorage, 'getDoctorById').mockResolvedValue({
      id: 'doc-1',
      templateSettings: { templateType: 'system', isOnboardingDummy: true }
    })

    const createPatientSpy = vi.spyOn(firebaseStorage, 'createPatient').mockResolvedValue({ id: 'unused' })
    const createPrescriptionSpy = vi.spyOn(firebaseStorage, 'createPrescription').mockResolvedValue({ id: 'unused' })
    const addDrugSpy = vi.spyOn(firebaseStorage, 'addDrug').mockResolvedValue({ id: 'drug-x' })
    const saveTemplateSpy = vi.spyOn(firebaseStorage, 'saveDoctorTemplateSettings').mockResolvedValue(true)

    await firebaseStorage.seedOnboardingDummyDataForDoctor({ id: 'doc-1', email: 'new@doc.com' })

    expect(createPatientSpy).not.toHaveBeenCalled()
    expect(createPrescriptionSpy).not.toHaveBeenCalled()
    expect(saveTemplateSpy).not.toHaveBeenCalled()
    expect(addDrugSpy).toHaveBeenCalledTimes(3)
  })

  it('deleteOnboardingDummyDataForDoctor removes only dummy records and clears dummy template', async () => {
    vi.spyOn(firebaseStorage, 'getPatientsByDoctorId').mockResolvedValue([
      { id: 'dummy-patient-1', isOnboardingDummy: true },
      { id: 'real-patient-1', isOnboardingDummy: false }
    ])
    vi.spyOn(firebaseStorage, 'getPrescriptionsByDoctorId').mockResolvedValue([
      { id: 'dummy-rx-1', isOnboardingDummy: true },
      { id: 'real-rx-1', isOnboardingDummy: false }
    ])
    vi.spyOn(firebaseStorage, 'getDoctorDrugs').mockResolvedValue([
      { id: 'dummy-drug-1', isOnboardingDummy: true },
      { id: 'real-drug-1', isOnboardingDummy: false }
    ])
    vi.spyOn(firebaseStorage, 'getDoctorById').mockResolvedValue({
      id: 'doc-1',
      templateSettings: { templateType: 'system', isOnboardingDummy: true }
    })

    const deletePrescriptionSpy = vi.spyOn(firebaseStorage, 'deletePrescription').mockResolvedValue(true)
    const deletePatientSpy = vi.spyOn(firebaseStorage, 'deletePatient').mockResolvedValue(true)
    const deleteDrugSpy = vi.spyOn(firebaseStorage, 'deleteDrug').mockResolvedValue(true)
    const saveTemplateSpy = vi.spyOn(firebaseStorage, 'saveDoctorTemplateSettings').mockResolvedValue(true)

    await firebaseStorage.deleteOnboardingDummyDataForDoctor('doc-1')

    expect(deletePrescriptionSpy).toHaveBeenCalledTimes(1)
    expect(deletePrescriptionSpy).toHaveBeenCalledWith('dummy-rx-1')
    expect(deletePatientSpy).toHaveBeenCalledTimes(1)
    expect(deletePatientSpy).toHaveBeenCalledWith('dummy-patient-1')
    expect(deleteDrugSpy).toHaveBeenCalledTimes(1)
    expect(deleteDrugSpy).toHaveBeenCalledWith('dummy-drug-1')
    expect(saveTemplateSpy).toHaveBeenCalledWith('doc-1', null)
  })
})
