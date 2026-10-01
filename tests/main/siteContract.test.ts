import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const repoRoot = path.resolve(__dirname, '..', '..')
const siteDir = path.join(repoRoot, 'docs', 'site')

function readSite(relative: string): string {
  return fs.readFileSync(path.join(siteDir, relative), 'utf-8')
}

const indexHtml = readSite('index.html')
const stylesCss = readSite('src/styles.css')
const content = readSite('src/content.ts')
const viteConfig = readSite('vite.config.ts')
const workflow = fs
  .readFileSync(path.join(repoRoot, '.github', 'workflows', 'pages-deploy.yml'), 'utf-8')
  .replaceAll('\r\n', '\n')

describe('site contract: built site source', () => {
  it('is a Vite entry that mounts the React app', () => {
    expect(indexHtml).toContain('id="root"')
    expect(indexHtml).toMatch(/<script[^>]+src="\/src\/main\.tsx"/)
    expect(viteConfig).toContain("base: './'")
    expect(viteConfig).toContain("outDir: 'dist'")
  })

  it('ships the privacy policy and images as static files copied to the build root', () => {
    const privacy = readSite('public/privacy.html')
    expect(privacy).toMatch(/<h1>MarkdownMeister privacy policy<\/h1>/)
    const logo = fs.statSync(path.join(siteDir, 'public', 'assets', 'logo.png'))
    expect(logo.size).toBeGreaterThan(0)
    for (const shot of ['screenshot-1.png', 'screenshot-2.png']) {
      expect(fs.statSync(path.join(siteDir, 'public', 'assets', shot)).size).toBeGreaterThan(0)
    }
  })

  it('records the deploy version in public/version.json', () => {
    const parsed = JSON.parse(readSite('public/version.json')) as { version?: unknown }
    expect(typeof parsed.version).toBe('string')
  })
})

describe('site contract: documentation matches the app', () => {
  it('documents the shortcuts in src/main/shortcuts.ts', () => {
    const shortcuts = fs.readFileSync(path.join(repoRoot, 'src', 'main', 'shortcuts.ts'), 'utf-8')
    for (const label of [
      'New file',
      'Open file',
      'Open folder',
      'Save',
      'Save as',
      'Close tab',
      'Find',
      'Find and replace',
      'Toggle developer tools'
    ]) {
      expect(content).toContain(label)
    }
    for (const command of [
      'new-file',
      'open-file',
      'open-folder',
      'save',
      'save-as',
      'close-tab',
      'find',
      'replace'
    ]) {
      expect(shortcuts).toContain(`'${command}'`)
    }
  })

  it('states the Windows 11 requirement for the folder action', () => {
    expect(content).toContain('Windows 11')
    expect(content).toContain('Windows 10')
  })
})

describe('site contract: zero third-party resources', () => {
  it('loads no external stylesheet, script, or image from the source', () => {
    const sources = [
      indexHtml,
      stylesCss,
      readSite('src/site.tsx'),
      readSite('src/content.ts'),
      readSite('src/main.tsx')
    ].join('\n')
    const allowedHosts = new Set(['github.com', 'api.github.com', 'apps.microsoft.com'])
    const foundHosts = new Set(
      [...sources.matchAll(/(?:https?:)?\/\/([^/"'\s)>]+)/gi)].map((match) =>
        match[1].toLowerCase()
      )
    )
    expect([...foundHosts].filter((host) => !allowedHosts.has(host))).toEqual([])
    expect(stylesCss.match(/url\(\s*['"]?(?:https?:)?\/\//i)).toBeNull()
    expect(indexHtml).not.toMatch(/<script[^>]+src="https?:/i)
  })
})

describe('site contract: Pages deployment workflow', () => {
  it('deploys on pushes to main restricted to site sources and the workflow', () => {
    expect(workflow).toContain('push:')
    expect(workflow).toContain('branches: [main]')
    expect(workflow).toContain("'docs/site/**'")
    expect(workflow).toContain("'.github/workflows/pages-deploy.yml'")
    expect(workflow).not.toContain('pull_request')
  })

  it('grants exactly the Pages permissions and serialises deployments', () => {
    const block = workflow.match(/^permissions:\n([\s\S]*?)^concurrency:/m)?.[1] ?? ''
    const granted = [...block.matchAll(/^\s{2}([a-z-]+):\s*(?:read|write)\s*$/gm)]
      .map((match) => match[1])
      .sort()
    expect(granted).toEqual(['contents', 'id-token', 'pages'])
    expect(block).toContain('contents: read')
    expect(block).toContain('pages: write')
    expect(block).toContain('id-token: write')
    expect(workflow).toContain('group: github-pages')
  })

  it('pins every action to a full commit SHA with a version comment', () => {
    for (const action of ['checkout', 'configure-pages', 'upload-pages-artifact', 'deploy-pages']) {
      expect(workflow).toMatch(new RegExp(`uses:\\s*actions/${action}@[0-9a-f]{40}\\b`))
      expect(workflow).toMatch(new RegExp(`actions/${action}@[0-9a-f]{40} #[^\\n]*v\\d+`))
    }
  })

  it('builds the site and deploys the build output', () => {
    expect(workflow).toContain('npm run docs:build')
    expect(workflow).toMatch(
      /actions\/upload-pages-artifact@[0-9a-f]{40}[\s\S]*?path:\s*docs\/site\/dist/
    )
  })

  it('checks out tags and stamps a validated version into public/version.json', () => {
    expect(workflow).toMatch(/fetch-depth:\s*0/)
    expect(workflow).toMatch(/fetch-tags:\s*true/)
    expect(workflow).toContain('docs/site/public/version.json')
    expect(workflow).toMatch(/\^\[0-9A-Za-z\]\[0-9A-Za-z.\+-\]\*\$/)
  })
})
