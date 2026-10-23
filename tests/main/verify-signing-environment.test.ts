import { describe, expect, it } from 'vitest'
import { verifySigningEnvironment } from '../../scripts/verify-signing-environment.mjs'

function protectedEnvironment(): object {
  return {
    protection_rules: [
      {
        type: 'required_reviewers',
        prevent_self_review: true,
        reviewers: [{ type: 'User', reviewer: { login: 'independent-maintainer' } }]
      }
    ],
    can_admins_bypass: false,
    deployment_branch_policy: { custom_branch_policies: true }
  }
}
const policies = { total_count: 1, branch_policies: [{ name: 'v*', type: 'tag' }] }

describe('signing environment protection', () => {
  it('accepts independently reviewed, non-bypassable release-tag deployments', () => {
    expect(() => verifySigningEnvironment(protectedEnvironment(), policies)).not.toThrow()
  })

  it.each([
    {},
    { protection_rules: [] },
    {
      protection_rules: [
        { type: 'required_reviewers', prevent_self_review: false, reviewers: [{}] }
      ]
    },
    {
      protection_rules: [{ type: 'required_reviewers', prevent_self_review: true, reviewers: [] }]
    },
    { ...protectedEnvironment(), can_admins_bypass: true },
    { ...protectedEnvironment(), deployment_branch_policy: null }
  ])('rejects missing signing protection: %j', (environment) => {
    expect(() => verifySigningEnvironment(environment, policies)).toThrow(/macos-signing/)
  })

  it.each([
    {},
    { branch_policies: [] },
    { branch_policies: [{ name: 'v*', type: 'branch' }] },
    { branch_policies: [{ name: '*', type: 'tag' }] },
    {
      branch_policies: [
        { name: 'v*', type: 'tag' },
        { name: 'main', type: 'branch' }
      ]
    },
    { total_count: 101, branch_policies: [{ name: 'v*', type: 'tag' }] }
  ])('rejects missing or broader deployment rules: %j', (rules) => {
    expect(() => verifySigningEnvironment(protectedEnvironment(), rules)).toThrow(/only tags/)
  })
})
