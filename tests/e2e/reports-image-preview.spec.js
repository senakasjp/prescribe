import { test, expect } from '@playwright/test'
import path from 'path'

const setDoctorSession = async (page, doctor) => {
  await page.addInitScript((data) => {
    localStorage.setItem('prescribe-current-doctor', JSON.stringify(data))
  }, doctor)
}

test('saved report image keeps consistent size and opens enlarged preview on click', async ({ page }) => {
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

  const suffix = Date.now().toString().slice(-6)
  const firstName = `E2EImg${suffix}`
  const reportTitle = `E2E Image Report ${suffix}`

  await page.locator('#firstName').fill(firstName)
  await page.locator('#ageYears').fill('30')
  await page.getByRole('button', { name: /save patient/i }).click()

  const patientRow = page.locator('tr').filter({ hasText: firstName }).first()
  await expect(patientRow).toBeVisible()
  await patientRow.getByRole('button', { name: /view/i }).click()

  await page.getByRole('button', { name: /next/i }).first().click()
  await page.getByRole('button', { name: /next/i }).first().click()
  await expect(page.getByRole('heading', { name: /medical reports/i })).toBeVisible()

  await page.getByRole('button', { name: /add report/i }).click()
  const reportModal = page.locator('div.w-full.max-w-3xl').first()
  await expect(reportModal.getByText(/add new report/i)).toBeVisible()
  await reportModal.locator('label[for="report-image"]').click()

  await reportModal.locator('input[placeholder*="Blood Test Results"]').fill(reportTitle)
  const imagePath = path.resolve('tests/e2e/fixtures/report-sample.png')
  await reportModal.locator('input[type="file"]').setInputFiles(imagePath)

  await reportModal.getByRole('button', { name: /save report/i }).click()

  const reportCard = page.locator('div.bg-white.border.border-gray-200.rounded-lg.shadow-sm').filter({ hasText: reportTitle }).first()
  await expect(reportCard).toBeVisible()

  const thumbnail = reportCard.getByAltText('Report image').first()
  await expect(thumbnail).toBeVisible()
  await expect(thumbnail).toHaveClass(/h-64/)

  await thumbnail.click()
  await expect(page.getByTitle('Close image preview')).toBeVisible()
  await expect(page.getByAltText(/report image preview/i)).toBeVisible()

  await page.getByTitle('Close image preview').click()
  await expect(page.getByTitle('Close image preview')).toHaveCount(0)
})
