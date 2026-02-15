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

test('pharmacy team member can access registrations UI', async ({ page }) => {
  await setPharmacistSession(page, {
    id: 'team-1',
    email: 'team@example.com',
    role: 'pharmacist',
    isPharmacyUser: true,
    pharmacyId: 'ph-1',
    connectedDoctors: ['doc-1'],
    businessName: 'Main Pharmacy'
  })

  await page.goto('/')

  await expect(page.getByText('Pharmacist Portal')).toBeVisible()
  const registrationsTab = page.getByRole('tab', { name: /registrations|new/i })
  await expect(registrationsTab).toBeVisible()
  await expect(registrationsTab).toBeEnabled()
})

test('doctor can open add patient form', async ({ page }) => {
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
  const addPatientButton = page.getByRole('button', { name: /add new patient/i })
  await expect(addPatientButton).toBeVisible()
  await addPatientButton.click()
  await expect(page.getByText(/First Name/i)).toBeVisible()
})

test('doctor menu shows reports and omits standalone prescriptions button', async ({ page }) => {
  await setDoctorSession(page, {
    id: 'doc-1',
    email: 'doctor@example.com',
    role: 'doctor',
    firstName: 'Test',
    lastName: 'Doctor',
    country: 'United States'
  })

  await page.goto('/')

  const menuBarNav = page.locator('main nav').nth(1)

  await expect(page.getByRole('heading', { name: /welcome, dr\. test doctor/i })).toBeVisible()
  await expect(menuBarNav.getByRole('button', { name: /reports/i })).toBeVisible()
  await expect(menuBarNav.getByRole('button', { name: /patients/i })).toBeVisible()
  await expect(menuBarNav.getByRole('button', { name: /settings/i })).toBeVisible()
  await expect(menuBarNav.getByRole('button', { name: /prescriptions/i })).toHaveCount(0)
})

test('pharmacy owner can view prescriptions and inventory tabs', async ({ page }) => {
  await setPharmacistSession(page, {
    id: 'ph-1',
    email: 'owner@example.com',
    role: 'pharmacist',
    businessName: 'Main Pharmacy',
    connectedDoctors: ['doc-1']
  })

  await page.goto('/')

  await expect(page.getByText('Pharmacist Portal')).toBeVisible()
  await expect(page.getByRole('tab', { name: /prescriptions|rx/i })).toBeVisible()
  await expect(page.getByRole('tab', { name: /inventory|stock/i })).toBeVisible()
})
