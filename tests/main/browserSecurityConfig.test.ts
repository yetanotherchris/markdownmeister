import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import docsConfig from '../../playwright.docs.config'
import { meetsVersionFloor } from '../helpers/browser-version'

const root = resolve(__dirname, '../..')
const lock: unknown = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'))
const dockerfile = readFileSync(resolve(root, 'tests/e2e/Dockerfile'), 'utf8')

describe('browser security configuration', () => {
  it('locks the patched application runtime', () => {
    expect(lock).toHaveProperty(['packages', 'node_modules/electron', 'version'], '43.8.6')
  })

  it('keeps the automation packages and digest-pinned image on the same release', () => {
    for (const name of ['@playwright/test', 'playwright', 'playwright-core']) {
      expect(lock).toHaveProperty(['packages', `node_modules/${name}`, 'version'], '1.64.1')
    }
    expect(dockerfile).toMatch(
      /^FROM mcr\.microsoft\.com\/playwright:v1\.64\.1-noble@sha256:[a-f0-9]{64}\r?$/m
    )
    expect(dockerfile).toContain('node@22.23.4')
  })

  it('uses installed stable Chrome for documentation tests without a bundled-browser fallback', () => {
    expect(docsConfig.use?.channel).toBe('chrome')
    expect(dockerfile.indexOf('RUN npx playwright install chrome')).toBeGreaterThan(
      dockerfile.indexOf('RUN npm ci')
    )
    expect(dockerfile).toContain('playwright.docs.config.ts')
    expect(dockerfile).toContain('docs/site/ docs/site/')
  })
})

describe('browser version floor', () => {
  it.each([
    ['156.0.8078.4', '156.0.8078.47', false],
    ['156.0.8078.46', '156.0.8078.47', false],
    ['156.0.8078.47', '156.0.8078.47', true],
    ['156.0.8078.75', '156.0.8078.47', true],
    ['157.0.1.0', '156.0.8078.47', true],
    ['155.99.9999.999', '156.0.8078.47', false],
    ['45.2.1', '45.2.1', true],
    ['45.2.0', '45.2.1', false],
    ['156', '156.0.0.0', true],
    ['156.0.8078.47-beta', '156.0.8078.47', false],
    ['', '156.0.8078.47', false],
    ['156.0.8078.47', '', false]
  ])('%s meets %s: %s', (version, minimum, expected) => {
    expect(meetsVersionFloor(version, minimum)).toBe(expected)
  })
})
