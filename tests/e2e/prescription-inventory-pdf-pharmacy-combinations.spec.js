import { test, expect } from '@playwright/test'

const setDoctorSession = async (page, doctor) => {
  await page.addInitScript((data) => {
    localStorage.setItem('prescribe-current-doctor', JSON.stringify(data))
  }, doctor)
}

const addMedication = async (
  page,
  { brandName, dispenseForm, dosage, strength, strengthUnit, qts, liquidPdfValue, frequency, timing, durationDays }
) => {
  await page.getByRole('button', { name: /add drug/i }).click()
  await expect(page.getByRole('heading', { name: /add new medication/i })).toBeVisible()
  const form = page.locator('form').filter({ has: page.locator('#brandName') }).first()

  await form.locator('#brandName').fill(brandName)
  await form.locator('#medicationDosageForm').selectOption(dispenseForm)

  const dosageField = form.locator('#medicationDosage')
  const requiresDosage = dispenseForm === 'Tablet' || dispenseForm === 'Capsule'
  const strengthEnabledForms = new Set([
    'Tablet',
    'Capsule',
    'Liquid (measured)',
    'Liquid (bottles)',
    'Injection'
  ])
  const shouldAttemptStrength = strengthEnabledForms.has(dispenseForm)
  if (requiresDosage) {
    await expect(dosageField).toBeVisible()
  } else {
    await expect(dosageField).toHaveCount(0)
  }

  if (dosage) await form.locator('#medicationDosage').selectOption(dosage)
  if (shouldAttemptStrength && strength && await form.locator('#medicationStrength').count()) {
    await form.locator('#medicationStrength').fill(String(strength))
  }
  if (shouldAttemptStrength && strengthUnit && await form.locator('#medicationStrengthUnit').count()) {
    await form.locator('#medicationStrengthUnit').selectOption(strengthUnit)
  }
  if (qts && await form.locator('#medicationQts').count()) {
    await form.locator('#medicationQts').fill(String(qts))
  }
  if (liquidPdfValue && await form.locator('#liquidDosePerFrequencyMl').count()) {
    await form.locator('#liquidDosePerFrequencyMl').fill(String(liquidPdfValue))
  }
  if (frequency) await form.locator('#medicationFrequency').selectOption(frequency)
  if (timing) await form.locator('#medicationTiming').selectOption(timing)
  if (durationDays) await form.locator('#medicationDuration').fill(String(durationDays))

  await form.locator('button[type="submit"]').click()
  await expect(page.getByRole('heading', { name: /add new medication/i })).toHaveCount(0)
}

const expectMedicationSecondaryLine = async (page, brandName, pattern) => {
  const row = page.locator('.medication-list > div').filter({ hasText: brandName }).first()
  await expect(row).toBeVisible()
  await expect(row.locator('.text-gray-500.text-sm').first()).toContainText(pattern)
}

const setupPrescriptionWithCombinations = async (page, suffix) => {
  const firstName = `E2ECombo${suffix}`

  await setDoctorSession(page, {
    id: 'doc-1',
    email: 'doctor@example.com',
    role: 'doctor',
    firstName: 'Test',
    lastName: 'Doctor',
    country: 'United States'
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /welcome, dr\. test doctor/i })).toBeVisible()

  await page.getByRole('button', { name: /total patients/i }).first().click()
  await page.getByRole('button', { name: /add new patient/i }).click()
  await page.locator('#firstName').fill(firstName)
  await page.locator('#ageYears').fill('42')
  await page.getByRole('button', { name: /save patient/i }).click()

  const patientRow = page.locator('tr').filter({ hasText: firstName }).first()
  await expect(patientRow).toBeVisible()
  await patientRow.getByRole('button', { name: /view/i }).click()

  await expect
    .poll(async () => page.evaluate(() => typeof window.__setPatientDetailsTab === 'function'))
    .toBe(true)
  await page.evaluate(() => window.__setPatientDetailsTab('prescriptions'))
  await expect(page.getByRole('heading', { name: /prescription/i })).toBeVisible()

  await page.getByRole('button', { name: /new prescription/i }).click()

  await addMedication(page, {
    brandName: `TabDrug${suffix}`,
    dispenseForm: 'Tablet',
    dosage: '1',
    strength: '500',
    strengthUnit: 'mg',
    frequency: 'Once daily (OD)',
    timing: 'After meals (PC)',
    durationDays: '5'
  })

  await addMedication(page, {
    brandName: `LiqMeasured${suffix}`,
    dispenseForm: 'Liquid (measured)',
    strength: '100',
    strengthUnit: 'ml',
    qts: '90',
    liquidPdfValue: '10',
    frequency: 'Three times daily (TDS)',
    timing: 'After meals (PC)',
    durationDays: '2'
  })

  await addMedication(page, {
    brandName: `LiqBottle${suffix}`,
    dispenseForm: 'Liquid (bottles)',
    strength: '120',
    strengthUnit: 'ml',
    qts: '2',
    liquidPdfValue: '120',
    frequency: 'Twice daily (BD)',
    durationDays: '7'
  })

  await addMedication(page, {
    brandName: `CreamDrug${suffix}`,
    dispenseForm: 'Cream',
    strength: '15',
    strengthUnit: 'g',
    qts: '2'
  })

  await expect(page.getByText(`TabDrug${suffix}`).first()).toBeVisible()
  await expect(page.getByText(`LiqMeasured${suffix}`).first()).toBeVisible()
  await expect(page.getByText(`LiqBottle${suffix}`).first()).toBeVisible()
  await expect(page.getByText(`CreamDrug${suffix}`).first()).toBeVisible()

  await page.getByRole('button', { name: /finalize prescription/i }).click()
  await expect(page.getByRole('button', { name: /send to pharmacy/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /print \(full\)/i })).toBeVisible()
}

test('mixed medication combinations support pharmacy-send flow', async ({ page }) => {
  const suffix = Date.now().toString().slice(-6)
  await setupPrescriptionWithCombinations(page, suffix)

  await page.getByRole('button', { name: /send to pharmacy/i }).click()
  const pharmacyModal = page.locator('#pharmacyModal')
  const connectWarning = page.getByText(/no pharmacy is connected to your account/i)

  await expect
    .poll(async () => {
      const modalVisible = await pharmacyModal.isVisible().catch(() => false)
      const warningVisible = await connectWarning.isVisible().catch(() => false)
      return modalVisible || warningVisible
    })
    .toBe(true)
})

test('mixed medication combinations keep full-print action available', async ({ page }) => {
  const suffix = Date.now().toString().slice(-6)
  await setupPrescriptionWithCombinations(page, suffix)

  const printButton = page.getByRole('button', { name: /print \(full\)/i })
  await expect(printButton).toBeVisible()
  await expect(printButton).toBeEnabled()
})

test('tablet keeps dosage while non-tablet forms do not show injected "1"', async ({ page }) => {
  const suffix = Date.now().toString().slice(-6)
  await setupPrescriptionWithCombinations(page, suffix)

  await expectMedicationSecondaryLine(page, `TabDrug${suffix}`, /500 mg 1/i)
  await expectMedicationSecondaryLine(page, `LiqMeasured${suffix}`, /100 ml/i)
  await expectMedicationSecondaryLine(page, `LiqBottle${suffix}`, /120 ml/i)
  await expectMedicationSecondaryLine(page, `CreamDrug${suffix}`, /Cream \| Quantity: 02/i)

  const liquidMeasuredRow = page.locator('.medication-list > div').filter({ hasText: `LiqMeasured${suffix}` }).first()
  const liquidBottleRow = page.locator('.medication-list > div').filter({ hasText: `LiqBottle${suffix}` }).first()
  const creamRow = page.locator('.medication-list > div').filter({ hasText: `CreamDrug${suffix}` }).first()

  await expect(liquidMeasuredRow).not.toContainText(/\b100 ml 1\b/i)
  await expect(liquidBottleRow).not.toContainText(/\b120 ml 1\b/i)
  await expect(creamRow).not.toContainText(/\b1 Cream\b/i)
})
