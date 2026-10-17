import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const script = await import('../../scripts/verify-macos-artifacts.mjs')
const { default: notarizeMacos } = await import('../../scripts/notarize-macos.cjs')
const { missingEnvironment } = notarizeMacos

describe('macOS release artifact verification', () => {
  it('refuses to notarize with missing API key credentials', () => {
    expect(missingEnvironment({})).toEqual([
      'APPLE_API_KEY',
      'APPLE_API_KEY_ID',
      'APPLE_API_ISSUER'
    ])
    expect(
      missingEnvironment({
        APPLE_API_KEY: '/tmp/AuthKey.p8',
        APPLE_API_KEY_ID: 'ABC123',
        APPLE_API_ISSUER: 'issuer'
      })
    ).toEqual([])
  })

  it('uses the stable release artifact names for each architecture', () => {
    expect(script.artifactNames('1.2.3', 'arm64')).toEqual({
      dmg: 'markdownmeister-1.2.3-macos-arm64.dmg',
      zip: 'markdownmeister-1.2.3-macos-arm64.zip'
    })
  })

  it('requires signature, ticket, Gatekeeper, identity, and hardened runtime checks', () => {
    const commands = script.validationCommands('/tmp/MarkdownMeister.app')

    expect(commands).toContainEqual([
      'codesign',
      ['--verify', '--deep', '--strict', '--verbose=2', '/tmp/MarkdownMeister.app']
    ])
    expect(commands).toContainEqual(['xcrun', ['stapler', 'validate', '/tmp/MarkdownMeister.app']])
    expect(commands).toContainEqual([
      'spctl',
      ['--assess', '--type', 'execute', '--verbose=4', '/tmp/MarkdownMeister.app']
    ])
    expect(commands).toContainEqual([
      'codesign',
      ['--display', '--verbose=4', '/tmp/MarkdownMeister.app']
    ])
  })

  it('fails before invoking macOS tools when a final artifact is missing', () => {
    const artifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdownmeister-artifacts-'))
    try {
      expect(() =>
        script.verifyArtifacts({
          artifactsDir,
          version: '1.2.3',
          arch: 'x64',
          identity: 'Developer ID Application: Example'
        })
      ).toThrow('Missing final DMG artifact: markdownmeister-1.2.3-macos-x64.dmg')
    } finally {
      fs.rmSync(artifactsDir, { force: true, recursive: true })
    }
  })

  it('runs final archive verification before macOS artifacts can upload', () => {
    const root = path.resolve(__dirname, '..', '..')
    const workflow = fs.readFileSync(
      path.join(root, '.github', 'workflows', 'build-release.yml'),
      'utf8'
    )
    const packageStep = workflow.indexOf('name: Package (macOS)')
    const verifyStep = workflow.indexOf('name: Verify final macOS artifacts')
    const uploadStep = workflow.indexOf('name: Upload artifacts')

    expect(packageStep).toBeGreaterThan(-1)
    expect(verifyStep).toBeGreaterThan(packageStep)
    expect(uploadStep).toBeGreaterThan(verifyStep)
    expect(workflow).toContain('MACOS_CERTIFICATE_P12_BASE64')
    expect(workflow).toContain('MACOS_SIGNING_IDENTITY')
  })
})
