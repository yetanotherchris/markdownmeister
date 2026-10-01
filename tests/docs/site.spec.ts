import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:4173'

test('home page presents the product, screenshots, install options, and the folder note', async ({
  page
}) => {
  await page.goto(`${BASE}/`)

  await expect(page.getByRole('heading', { level: 1 })).toContainText('markdown editor')
  await expect(page.getByAltText(/main window/i)).toBeVisible()
  await expect(page.getByAltText(/File menu/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Features' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Install' })).toBeVisible()
  await expect(page.getByText('The folder action requires Windows 11')).toBeVisible()

  const storeLink = page.getByRole('link', { name: 'Get it from the Microsoft Store' })
  await expect(storeLink).toHaveAttribute('href', /apps\.microsoft\.com/)

  const githubLink = page.getByRole('link', { name: 'MarkdownMeister on GitHub' })
  await expect(githubLink).toHaveAttribute(
    'href',
    'https://github.com/yetanotherchris/markdownmeister'
  )
})

test('sidebar navigation moves to each section', async ({ page }) => {
  await page.goto(`${BASE}/`)
  await page.getByRole('navigation').getByRole('link', { name: 'Keyboard shortcuts' }).click()
  await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeInViewport()
})

test('the settings reference lists the options', async ({ page }) => {
  await page.goto(`${BASE}/`)
  const table = page.locator('table').last()
  await expect(table.getByText('Word wrap')).toBeVisible()
  await expect(table.getByText('Rustic')).toBeVisible()
})

test('the privacy policy is served as a static page', async ({ page }) => {
  const response = await page.goto(`${BASE}/privacy.html`)
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('privacy policy')
})
