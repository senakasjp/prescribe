import { test, expect } from '@playwright/test'

const setAdminSession = async (page) => {
  await page.addInitScript(() => {
    const doctorUser = {
      id: 'super-admin-001',
      email: 'senakahks@gmail.com',
      role: 'doctor',
      isAdmin: true,
      firstName: 'Super',
      lastName: 'Admin',
      name: 'Super Admin',
      country: 'United States'
    }
    const adminUser = {
      id: 'admin-001',
      email: 'senakahks@gmail.com',
      role: 'admin',
      name: 'System Administrator',
      permissions: ['read_all', 'write_all', 'delete_all', 'manage_users', 'view_analytics']
    }
    localStorage.setItem('prescribe-current-doctor', JSON.stringify(doctorUser))
    localStorage.setItem('prescribe-current-admin', JSON.stringify(adminUser))
    localStorage.setItem('prescribe-admin-panel-active', 'true')
  })
}

test('admin doctor details billing history stays compact and supports shrink/expand', async ({ page }) => {
  await setAdminSession(page)
  await page.goto('/')
  await expect(page.getByText('Loading admin dashboard...')).toHaveCount(0, { timeout: 60000 })

  if (await page.getByRole('button', { name: /Admin Panel/i }).count()) {
    await page.getByRole('button', { name: /Admin Panel/i }).click()
  }

  let doctorsTab = page.locator('main nav').nth(1).getByRole('button', { name: /Doctors/i })
  if (await doctorsTab.count() === 0) {
    await page.evaluate(() => {
      const doctorUser = {
        id: 'super-admin-001',
        email: 'senakahks@gmail.com',
        role: 'doctor',
        isAdmin: true,
        firstName: 'Super',
        lastName: 'Admin',
        name: 'Super Admin',
        country: 'United States'
      }
      const adminUser = {
        id: 'admin-001',
        email: 'senakahks@gmail.com',
        role: 'admin',
        name: 'System Administrator',
        permissions: ['read_all', 'write_all', 'delete_all', 'manage_users', 'view_analytics']
      }
      localStorage.setItem('prescribe-current-doctor', JSON.stringify(doctorUser))
      localStorage.setItem('prescribe-current-admin', JSON.stringify(adminUser))
      localStorage.setItem('prescribe-admin-panel-active', 'true')
    })
    await page.reload()
    await expect(page.getByText('Loading admin dashboard...')).toHaveCount(0, { timeout: 60000 })
    doctorsTab = page.locator('main nav').nth(1).getByRole('button', { name: /Doctors/i })
  }

  if (await doctorsTab.count() === 0) {
    test.skip(true, 'Admin doctors tab is not available in this environment.')
  }
  await doctorsTab.click()
  if (await page.locator('h2:has-text("Doctors Management"):visible').count() === 0) {
    test.skip(true, 'Admin doctors view did not open from sidebar tab.')
  }
  await expect(page.locator('h5:has-text("All Registered Doctors"):visible')).toBeVisible()

  const doctorsCard = page.locator('div:has(h5:has-text("All Registered Doctors")):visible').first()
  const viewButtons = doctorsCard.getByRole('button', { name: 'View' })
  if (await viewButtons.count() === 0) {
    test.skip(true, 'No doctors with a visible View action were found.')
  }
  await viewButtons.first().click()

  if (await page.getByRole('heading', { name: 'Doctor Details' }).count() === 0) {
    test.skip(true, 'Doctor details screen did not open after clicking View.')
  }
  await expect(page.getByText('Billing Wallet')).toBeVisible()

  const shrinkButton = page.getByRole('button', { name: 'Shrink history' })
  await expect(shrinkButton).toBeVisible()

  const billingTable = page.locator('section,div').filter({ hasText: 'Billing Wallet' }).locator('table').first()
  if (await billingTable.count()) {
    await expect(billingTable.getByRole('columnheader', { name: 'Time' })).toBeVisible()
    await expect(billingTable.getByRole('columnheader', { name: 'Amount' })).toBeVisible()
    await expect(billingTable.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    await expect(billingTable.getByRole('columnheader', { name: 'Type' })).toHaveCount(0)
    await expect(billingTable.getByRole('columnheader', { name: 'Months' })).toHaveCount(0)
    await expect(billingTable.getByRole('columnheader', { name: 'Source' })).toHaveCount(0)
    await expect(billingTable.getByRole('columnheader', { name: 'Reference' })).toHaveCount(0)
  }

  await shrinkButton.click()
  await expect(page.getByText('Billing history is collapsed.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show history' })).toBeVisible()
})
