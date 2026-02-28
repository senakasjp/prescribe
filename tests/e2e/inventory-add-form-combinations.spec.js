import { test, expect } from '@playwright/test'

const setPharmacistSession = async (page, pharmacist) => {
  await page.addInitScript((data) => {
    localStorage.setItem('prescribe-current-pharmacist', JSON.stringify(data))
  }, pharmacist)
}

const openAddInventoryModal = async (page) => {
  await setPharmacistSession(page, {
    id: 'ph-1',
    email: 'owner@example.com',
    role: 'pharmacist',
    businessName: 'Main Pharmacy',
    connectedDoctors: ['doc-1']
  })

  await page.goto('/')
  await expect(page.getByText('Pharmacist Portal')).toBeVisible()

  await page.getByRole('tab', { name: /inventory|stock/i }).click()
  await page.getByRole('button', { name: /add inventory item|add item/i }).click()
  await expect(page.getByRole('heading', { name: /add inventory item/i })).toBeVisible()
}

test('add inventory form supports expected field combinations by dispense form', async ({ page }) => {
  await openAddInventoryModal(page)

  const dosageForm = page.locator('#newItemDosageForm')
  const strength = page.locator('#newItemStrength')
  const strengthUnit = page.locator('#newItemStrengthUnit')
  const containerSize = page.locator('#newItemContainerSize')
  const containerUnit = page.locator('#newItemContainerUnit')

  await dosageForm.selectOption('Tablet')
  await expect(strength).toBeVisible()
  await expect(strengthUnit).toBeVisible()
  await expect(containerSize).toHaveCount(0)
  await expect(containerUnit).toHaveCount(0)
  await expect(page.getByText(/selling price for\s*tablet/i)).toBeVisible()

  await dosageForm.selectOption('Capsule')
  await expect(strength).toBeVisible()
  await expect(strengthUnit).toBeVisible()
  await expect(containerSize).toHaveCount(0)
  await expect(containerUnit).toHaveCount(0)
  await expect(page.getByText(/selling price for\s*capsule/i)).toBeVisible()

  await dosageForm.selectOption('Liquid (measured)')
  await expect(strength).toHaveCount(0)
  await expect(strengthUnit).toHaveCount(0)
  await expect(containerSize).toHaveCount(0)
  await expect(containerUnit).toHaveCount(0)
  await expect(page.getByText(/initial stock in ml/i)).toBeVisible()
  await expect(page.getByText(/minimum stock ml/i)).toBeVisible()
  await expect(page.getByText(/selling price per ml/i)).toBeVisible()

  await dosageForm.selectOption('Cream')
  await expect(strength).toHaveCount(0)
  await expect(strengthUnit).toHaveCount(0)
  await expect(containerSize).toBeVisible()
  await expect(containerUnit).toBeVisible()
  await expect(page.getByText(/selling price for\s*cream/i)).toBeVisible()
})
