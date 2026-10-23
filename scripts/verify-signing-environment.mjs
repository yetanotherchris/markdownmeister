import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function verifySigningEnvironment(environment, policies) {
  const approval = environment?.protection_rules?.find((rule) => rule.type === 'required_reviewers')
  if (!approval?.prevent_self_review || !approval.reviewers?.length) {
    throw new Error('macos-signing requires an independent reviewer with self-review disabled')
  }
  if (environment.can_admins_bypass !== false) {
    throw new Error('macos-signing must disable administrator bypass of approval rules')
  }
  if (!environment.deployment_branch_policy?.custom_branch_policies) {
    throw new Error('macos-signing requires custom release-tag deployment restrictions')
  }
  const rules = policies?.branch_policies
  if (
    !Array.isArray(rules) ||
    rules.length === 0 ||
    policies.total_count !== rules.length ||
    rules.some((rule) => rule.type !== 'tag' || rule.name !== 'v*')
  ) {
    throw new Error('macos-signing deployment policies must allow only tags matching v*')
  }
}

function readApi(endpoint) {
  const result = spawnSync('gh', ['api', endpoint], { encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Cannot inspect signing environment: ${result.stderr}`)
  return JSON.parse(result.stdout)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repository = process.env.GITHUB_REPOSITORY
  if (!repository) throw new Error('Missing GITHUB_REPOSITORY')
  const endpoint = `repos/${repository}/environments/macos-signing`
  const environment = readApi(endpoint)
  const policies = environment.deployment_branch_policy?.custom_branch_policies
    ? readApi(`${endpoint}/deployment-branch-policies?per_page=100`)
    : null
  verifySigningEnvironment(environment, policies)
  console.log('Signing environment approval and release-tag restrictions verified')
}
