import { test, expect } from '@playwright/test'

test('landing login toggles doctor/pharmacy forms', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /doctor/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /pharmacy/i })).toBeVisible()

  await page.getByRole('button', { name: /pharmacy/i }).click()

  await expect(page.getByLabel(/email address/i)).toBeVisible()
  await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible()
})
