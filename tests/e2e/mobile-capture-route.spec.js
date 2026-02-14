import { test, expect } from '@playwright/test'

test.describe('mobile capture route', () => {
  test('shows invalid-code message for malformed code', async ({ page }) => {
    await page.goto('/?mobile-capture=1&code=bad-code')
    await expect(page.getByText(/Invalid access code/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Take Photograph/i })).toHaveCount(0)
  })

  test('shows expired-link message when timestamp is older than 15 minutes', async ({ page }) => {
    const oldTs = Date.now() - (16 * 60 * 1000)
    await page.goto(`/?mobile-capture=1&code=ABCDEFGH12&ts=${oldTs}`)
    await expect(page.getByText(/capture link has expired/i)).toBeVisible()
  })

  test('renders branded take-photo flow for valid code', async ({ page }) => {
    const freshTs = Date.now()
    await page.goto(`/?mobile-capture=1&code=ABCDEFGH12&ts=${freshTs}`)

    await expect(page.getByText(/Mobile Report Capture/i)).toBeVisible()
    await expect(page.getByText(/Powered by/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Take Photograph/i })).toBeVisible()
    await expect(page.getByText(/Access code:/i)).toHaveCount(0)
  })
})
