import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('Mac App Store delivery', () => {
  it('passes the credential, signature, and upload regression tests', () => {
    const result = spawnSync(
      process.platform === 'win32' ? 'python' : 'python3',
      [
        '-B',
        '-m',
        'unittest',
        'discover',
        '-s',
        'tests/packaging',
        '-p',
        'test_macos_store.py',
        '-v'
      ],
      { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }
    )

    expect(result.error, result.error?.message).toBeUndefined()
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
  })

  it('loads a valid Store-only builder configuration with its inherited hooks resolved', () => {
    const script = `
      const assert = require('node:assert/strict')
      const { getConfig, validateConfiguration } = require('app-builder-lib/out/util/config/config')
      ;(async () => {
        const config = await getConfig(process.cwd(), 'packaging/macos/store.mjs', {
          extraMetadata: { version: '9.9.99' }
        })
        await validateConfiguration(config)
        assert.equal(config.appId, 'dev.yetanotherchris.markdownmeister')
        assert.equal(config.extraMetadata.version, '9.9.99')
        assert.equal(config.mac.target, 'mas')
        assert.equal(config.afterSign, null)
        assert.equal(config.forceCodeSigning, true)
        assert.equal(config.directories.output, 'dist-store')
        assert.equal(config.mas.bundleVersion, '12')
        assert.equal(config.mas.provisioningProfile, '/private/store-signing.provisionprofile')
        assert.equal(config.mas.entitlements, 'packaging/macos/entitlements.mas.plist')
        assert.equal(config.mas.entitlementsInherit, 'packaging/macos/entitlements.mas.inherit.plist')
      })().catch(error => { console.error(error); process.exitCode = 1 })
    `
    const result = spawnSync(process.execPath, ['-e', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        MACOS_STORE_BUILD_NUMBER: '12',
        MACOS_STORE_PROFILE_PATH: '/private/store-signing.provisionprofile'
      }
    })

    expect(result.error, result.error?.message).toBeUndefined()
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
  })

  it('rejects invalid dispatch refs in the actual preflight before the environment job', () => {
    const script = `
      const assert = require('node:assert/strict')
      const { readFileSync } = require('node:fs')
      const { resolve } = require('node:path')
      const { spawnSync } = require('node:child_process')
      const workflow = require('js-yaml').load(
        readFileSync('.github/workflows/build-macos-store.yml', 'utf8')
      )
      assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch'])
      const preflight = workflow.jobs.preflight
      const delivery = workflow.jobs['build-and-upload']
      const launcher = workflow.jobs['launch-tagged-build']
      assert.equal(workflow.on.workflow_dispatch.inputs.version.required, true)
      assert.equal(workflow.env.MACOS_STORE_REQUESTED_VERSION, '\${{ inputs.version }}')
      assert.equal(launcher.if, "github.ref == 'refs/heads/main'")
      assert.equal(preflight.if, "github.ref != 'refs/heads/main'")
      assert.equal(launcher.environment, undefined)
      assert.equal(launcher.permissions.actions, 'write')
      assert.equal(workflow.permissions.actions, undefined)
      assert.equal(delivery.permissions?.actions, undefined)
      assert.equal(preflight.environment, undefined)
      assert.ok([delivery.needs].flat().includes('preflight'))
      assert.equal(delivery.environment, 'macos-signing')
      const paths = delivery.steps.find(step => step.run?.includes('MACOS_STORE_PROFILE_PATH='))
      assert.ok(paths?.run.includes(
        'MACOS_STORE_PROFILE_PATH=$RUNNER_TEMP/markdownmeister-store-credentials/store-signing.provisionprofile'
      ))
      const gate = preflight.steps.find(step => step.name === 'Require release tag')
      const validation = preflight.steps.find(step => step.run?.includes('macos_store.py inputs'))
      assert.ok(gate?.run)
      assert.ok(validation?.run)
      let bash = 'bash'
      if (process.platform === 'win32') {
        const git = spawnSync('git', ['--exec-path'], { encoding: 'utf8' })
        assert.equal(git.status, 0, git.stderr)
        bash = resolve(git.stdout.trim(), '../../../bin/bash.exe')
      }
      const commands = [
        'set -e',
        'python3() { command "$STORE_TEST_PYTHON" "$@"; }',
        gate.run,
        validation.run
      ].join(String.fromCharCode(10))
      for (const [ref, version, expected] of [
        ['refs/heads/main', '9.9.99', 1],
        ['refs/heads/v9.9.99', '9.9.99', 1],
        ['refs/tags/vnext', '9.9.99', 1],
        ['refs/tags/v01.9.99', '9.9.99', 1],
        ['refs/tags/v9.9.99', '9.9.98', 1],
        ['refs/tags/v9.9.99', '9.9.99', 0]
      ]) {
        const result = spawnSync(bash, ['-c', commands], {
          encoding: 'utf8',
          env: {
            ...process.env,
            STORE_TEST_PYTHON: process.platform === 'win32' ? 'python' : 'python3',
            GITHUB_REF: ref,
            MACOS_STORE_REQUESTED_VERSION: version,
            MACOS_STORE_BUILD_NUMBER: '12'
          }
        })
        assert.equal(result.status, expected, ref + ': ' + result.stdout + result.stderr)
      }
      const launchValidation = launcher.steps.find(step => step.run?.includes('dispatch-inputs'))
      const dispatch = launcher.steps.find(step => step.run?.includes('gh workflow run'))
      assert.ok(launchValidation?.run)
      assert.ok(dispatch?.run)
      assert.equal(dispatch.env.REQUESTED_BUILD_NUMBER, '\${{ inputs.buildNumber }}')
      assert.equal(dispatch.env.UPLOAD_REQUESTED, '\${{ inputs.upload }}')
      assert.equal(dispatch['continue-on-error'], undefined)
      for (const [number, upload, expected] of [['', 'false', 0], ['41', 'true', 0], ['', 'true', 1]]) {
        const result = spawnSync(bash, ['-c', [
          'set -e',
          'python3() { command "$STORE_TEST_PYTHON" "$@"; }',
          'gh() { if [ "$STORE_TEST_GH_FAILURE" = true ]; then return 1; fi; for arg; do echo "$arg"; done; }',
          launchValidation.run,
          dispatch.run
        ].join(String.fromCharCode(10))], {
          encoding: 'utf8',
          env: {
            ...process.env,
            STORE_TEST_PYTHON: process.platform === 'win32' ? 'python' : 'python3',
            GITHUB_REF: 'refs/heads/main',
            GITHUB_REPOSITORY: 'example/editor',
            MACOS_STORE_REQUESTED_VERSION: '9.9.99',
            MACOS_STORE_BUILD_NUMBER: number || '12',
            REQUESTED_BUILD_NUMBER: number,
            UPLOAD_REQUESTED: upload,
            STORE_TEST_GH_FAILURE: expected === 1 ? 'true' : 'false'
          }
        })
        assert.equal(result.status, expected, result.stdout + result.stderr)
        if (expected !== 0) continue
        const args = result.stdout.trim().split(String.fromCharCode(10)).map(line => line.trim()).slice(1)
        assert.deepEqual(args, [
          'workflow', 'run', 'build-macos-store.yml', '--repo', 'example/editor', '--ref', 'v9.9.99',
          '-f', 'version=9.9.99', '-f', 'buildNumber=' + number, '-f', 'upload=' + upload
        ])
      }
    `
    const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' })

    expect(result.error, result.error?.message).toBeUndefined()
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
  })
})
