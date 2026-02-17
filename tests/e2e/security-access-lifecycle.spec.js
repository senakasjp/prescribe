import { test, expect } from '@playwright/test'

const setDoctorSession = async (page, doctor) => {
  await page.addInitScript((data) => {
    localStorage.setItem('prescribe-current-doctor', JSON.stringify(data))
  }, doctor)
}

const setPharmacistSession = async (page, pharmacist) => {
  await page.addInitScript((data) => {
    localStorage.setItem('prescribe-current-pharmacist', JSON.stringify(data))
  }, pharmacist)
}

test('doctor session should not expose pharmacist-only portal tabs', async ({ page }) => {
  await setDoctorSession(page, {
    id: 'doc-sec-1',
    email: 'doctor-sec@example.com',
    role: 'doctor',
    firstName: 'Secure',
    lastName: 'Doctor',
    country: 'United States'
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
  await expect(page.getByText('Pharmacist Portal')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /inventory|stock/i })).toHaveCount(0)
})

test('pharmacist session should not expose doctor patient-management controls', async ({ page }) => {
  await setPharmacistSession(page, {
    id: 'ph-sec-1',
    email: 'pharmacist-sec@example.com',
    role: 'pharmacist',
    businessName: 'Security Pharmacy',
    connectedDoctors: ['doc-1']
  })

  await page.goto('/')
  await expect(page.getByText('Pharmacist Portal')).toBeVisible()
  await expect(page.getByRole('button', { name: /add new patient/i })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /patient management/i })).toHaveCount(0)
})

test('invalid local doctor session should not silently grant authenticated doctor UI', async ({ page }) => {
  await setDoctorSession(page, {
    id: 'doc-invalid-1',
    role: 'doctor'
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /doctor portal/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^login$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /add new patient/i })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /welcome/i })).toHaveCount(0)
})
