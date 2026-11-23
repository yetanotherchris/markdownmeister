import { execFileSync } from 'node:child_process'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

const script = path.resolve(__dirname, '..', '..', 'scripts', 'run-sandbox-e2e.ps1')

function sandboxLib(body: string): string {
  const command = [
    "$env:MM_SANDBOX_E2E_LIB_ONLY = '1'",
    `. '${script.replace(/'/g, "''")}'`,
    body
  ].join('; ')
  return execFileSync('pwsh', ['-NoProfile', '-Command', command], { encoding: 'utf8' }).trim()
}

describe('run-sandbox-e2e helpers', () => {
  it('quotes cmd metacharacters and doubles percent signs', () => {
    const quoted = sandboxLib(`
      @(
        (Format-CmdArgument 'tests/e2e/one.spec.ts'),
        (Format-CmdArgument 'my file.spec.ts'),
        (Format-CmdArgument 'a&b'),
        (Format-CmdArgument '100%'),
        (Format-CmdArgument '')
      ) -join [char]10
    `)
    expect(quoted.split(/\r?\n/)).toEqual([
      'tests/e2e/one.spec.ts',
      '"my file.spec.ts"',
      '"a&b"',
      '"100%%"',
      '""'
    ])
  })

  it('reads sandbox ids from a list or a single object', () => {
    const ids = sandboxLib(`
      $list = '{"WindowsSandboxEnvironments":[{"Id":"abc"},{"Id":"def"}]}'
      $one = '{"Id":"solo"}'
      $empty = Get-SandboxIds '{"WindowsSandboxEnvironments":[]}'
      @(
        ((Get-SandboxIds $list) -join ','),
        (Get-SandboxIds $one),
        ($(if ($empty.Count -eq 0) { 'none' } else { $empty -join ',' }))
      ) -join [char]10
    `)
    expect(ids.split(/\r?\n/)).toEqual(['abc,def', 'solo', 'none'])
  })
})
