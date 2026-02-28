import { test, expect } from '@playwright/test'

const setDoctorSession = async (page, doctor) => {
  await page.addInitScript((data) => {
    localStorage.setItem('prescribe-current-doctor', JSON.stringify(data))
  }, doctor)
}

test('doctor payments referral tab shows referral link and WhatsApp share action', async ({ page }) => {
  await setDoctorSession(page, {
    id: 'doc-ref-1',
    email: 'doctor@example.com',
    role: 'doctor',
    firstName: 'Test',
    lastName: 'Doctor',
    country: 'United States',
    referralCode: 'REF-7788'
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /welcome, dr\. test doctor/i })).toBeVisible()

  const menuBarNav = page.locator('main nav').nth(1)
  await menuBarNav.getByRole('button', { name: /payments/i }).click()

  await expect(page.getByRole('heading', { name: /payments/i })).toBeVisible()
  await page.getByRole('tab', { name: /referral/i }).click()

  await expect(page.getByText('Referral Link')).toBeVisible()
  const referralLink = page.getByRole('link', { name: /register=1&ref=REF-7788#signin/i })
  await expect(referralLink).toBeVisible()
  await expect(referralLink).toHaveAttribute('href', /\/\?register=1&ref=REF-7788#signin$/)
  await expect(referralLink).toHaveAttribute('target', '_blank')
  await expect(referralLink).toHaveAttribute('rel', /noopener/)
  await expect(referralLink).toHaveAttribute('rel', /noreferrer/)

  const whatsappShareLink = page.getByRole('link', { name: /Share referral link on WhatsApp/i })
  await expect(whatsappShareLink).toBeVisible()
  await expect(whatsappShareLink).toHaveAttribute('href', /https:\/\/wa\.me\/\?text=/)
  await expect(whatsappShareLink).toHaveAttribute('target', '_blank')
})

