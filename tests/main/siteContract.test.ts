import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const repoRoot = path.resolve(__dirname, '..', '..')
const siteDir = path.join(repoRoot, 'docs', 'site')

function readSiteFile(name: string): string {
  return fs.readFileSync(path.join(siteDir, name), 'utf-8')
}

const indexHtml = readSiteFile('index.html')
// The compiled stylesheet carries the Tailwind licence banner as a comment;
// comments are not network requests, so they are stripped before auditing.
const stylesCss = readSiteFile('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const workflow = fs
  .readFileSync(path.join(repoRoot, '.github', 'workflows', 'pages-deploy.yml'), 'utf-8')
  .replaceAll('\r\n', '\n')

const REPO_URL = 'https://github.com/yetanotherchris/markdownmeister'
const RELEASES_URL = `${REPO_URL}/releases/latest`
const RELEASE_API_URL =
  'https://api.github.com/repos/yetanotherchris/markdownmeister/releases/latest'

function tagsOf(html: string, tagName: string): string[] {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) ?? []
}

function attrValue(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1]
}

function hrefsOf(html: string, tagName: string): string[] {
  return tagsOf(html, tagName)
    .map((tag) => attrValue(tag, 'href') ?? '')
    .filter((href) => href !== '')
}

function inlineScriptBodies(html: string): string[] {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  return scripts.filter(([, attrs]) => !/\bsrc\s*=/i.test(attrs)).map(([, , body]) => body)
}

describe('site contract: index.html required elements', () => {
  it('presents exactly one top-level heading naming the product', () => {
    const headings = indexHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) ?? []
    expect(headings).toHaveLength(1)
    expect(headings[0]?.replace(/<[^>]+>/g, '').trim()).toBe('MarkdownMeister')
  })

  it('points a download control at the repository latest-release location with same-tab navigation', () => {
    const downloadTags = tagsOf(indexHtml, 'a').filter(
      (tag) => attrValue(tag, 'href') === RELEASES_URL
    )
    expect(downloadTags.length).toBeGreaterThanOrEqual(1)
    for (const tag of downloadTags) expect(attrValue(tag, 'target')).toBeUndefined()
  })

  it('links a labelled GitHub icon to the repository root', () => {
    const repoLink = tagsOf(indexHtml, 'a').find(
      (tag) => attrValue(tag, 'href') === REPO_URL && attrValue(tag, 'aria-label') !== undefined
    )
    expect(repoLink).toBeDefined()
    expect(indexHtml.includes('<svg')).toBe(true)
    expect(attrValue(repoLink ?? '', 'target')).toBeUndefined()
  })

  it('uses the spec-039 product icon as header mark and favicon', () => {
    const iconImgs = tagsOf(indexHtml, 'img').filter((tag) =>
      (attrValue(tag, 'src') ?? '').includes('icon.png')
    )
    expect(iconImgs.length).toBeGreaterThanOrEqual(1)
    const favicon = tagsOf(indexHtml, 'link').some(
      (tag) =>
        attrValue(tag, 'rel') === 'icon' && /assets\/icon\.png/i.test(attrValue(tag, 'href') ?? '')
    )
    expect(favicon).toBe(true)
  })

  it('gives the hero screenshot descriptive alt text', () => {
    const heroImg = tagsOf(indexHtml, 'img').find((tag) =>
      /screenshot-placeholder/.test(attrValue(tag, 'src') ?? '')
    )
    expect(heroImg).toBeDefined()
    expect((attrValue(heroImg ?? '', 'alt') ?? '').trim().length).toBeGreaterThan(10)
  })

  it('follows the Features heading with a non-empty bulleted feature list (FR-004)', () => {
    const main = indexHtml.match(/<main\b[\s\S]*?<\/main>/i)?.[0]
    expect(main).toBeDefined()
    const list = main?.match(/<h2\b[^>]*>\s*Features\s*<\/h2>\s*<ul\b[^>]*>([\s\S]*?)<\/ul>/i)
    expect(list).not.toBeNull()
    const bullets = [...(list?.[1] ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    expect(bullets.length).toBeGreaterThanOrEqual(3)
    for (const bullet of bullets) {
      expect(bullet[1]?.replace(/<[^>]+>/g, '').trim().length).toBeGreaterThan(0)
    }
  })

  it('shows a deploy-time version without JavaScript in both meta and visible span', () => {
    const metaTag = tagsOf(indexHtml, 'meta').find(
      (tag) => attrValue(tag, 'name') === 'deploy-version'
    )
    expect(metaTag).toBeDefined()
    const metaContent = metaTag === undefined ? undefined : attrValue(metaTag, 'content')
    expect(metaContent).toBeTruthy()

    const spanBody = indexHtml.match(/<span\b[^>]*\bid="version"[^>]*>([\s\S]*?)<\/span>/i)?.[1]
    expect(spanBody?.trim()).toBe(metaContent)
  })
})

describe('site contract: release-metadata lookup', () => {
  it('fetches the releases endpoint with a GitHub API accept header and a timeout', () => {
    const script = inlineScriptBodies(indexHtml).join('\n')
    expect(script).toContain(RELEASE_API_URL)
    expect(script).toContain('application/vnd.github+json')
    expect(script).toContain('AbortController')
    expect(script).toContain('setTimeout')
  })

  it('updates the version display only on success and never blocks visitors on failure', () => {
    const script = inlineScriptBodies(indexHtml).join('\n')
    expect(script).toMatch(/response\.ok/)
    expect(script).toMatch(/\.catch\(/)
  })
})

describe('site contract: zero external resources', () => {
  it('loads no script, frame, or stylesheet from outside the site', () => {
    for (const tag of tagsOf(indexHtml, 'script')) expect(attrValue(tag, 'src')).toBeUndefined()
    for (const tag of tagsOf(indexHtml, 'iframe')) expect(attrValue(tag, 'src')).toBeUndefined()
    const remoteLinks = hrefsOf(indexHtml, 'link').filter((href) => /^(https?:)?\/\//i.test(href))
    expect(remoteLinks).toEqual([])
  })

  it('references only local images, including every srcset candidate', () => {
    const candidates = tagsOf(indexHtml, 'img').flatMap((tag) => [
      attrValue(tag, 'src') ?? '',
      ...(attrValue(tag, 'srcset') ?? '')
        .split(',')
        .map((entry) => entry.trim().split(/\s+/)[0])
        .filter((url) => url !== undefined && url !== '')
    ])
    const remoteImages = candidates.filter((src) => /^(https?:)?\/\//i.test(src))
    expect(remoteImages).toEqual([])
  })

  it('keeps inline style attributes free of external references', () => {
    const styles = [...indexHtml.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map((match) => match[1])
    for (const style of styles) expect(style).not.toMatch(/(?:https?:)?\/\//i)
  })

  // Scheme-relative forms (`//host/x`) resolve against the page protocol and
  // must be treated exactly like their absolute `https://host/x` equivalents.
  it('embeds no external url() target or import in the stylesheet', () => {
    expect(stylesCss.match(/url\(\s*['"]?(?:https?:)?\/\//i)).toBeNull()
    expect(stylesCss.match(/@import\s+(?:url\(\s*)?['"]?(?:https?:)?\/\//i)).toBeNull()
  })

  // github.com appears legitimately as the FR-002 navigation targets (download
  // button, repository link); those are navigations, not loaded resources.
  it('names no external host besides api.github.com and the repository navigations', () => {
    const allowedHosts = new Set(['api.github.com', 'github.com'])
    const foundHosts = new Set(
      [...`${indexHtml}\n${stylesCss}`.matchAll(/(?:https?:)?\/\/([^/"'\s)>]+)/gi)].map((m) =>
        m[1].toLowerCase()
      )
    )
    expect(foundHosts.has('api.github.com')).toBe(true)
    expect([...foundHosts].filter((host) => !allowedHosts.has(host))).toEqual([])
  })
})

describe('site contract: Pages deployment workflow', () => {
  it('deploys on pushes to main restricted to site sources and the workflow itself', () => {
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

  it('checks out full history and tags so tag-based version stamping can resolve', () => {
    expect(workflow).toMatch(/fetch-depth:\s*0/)
    expect(workflow).toMatch(/fetch-tags:\s*true/)
  })

  it('uploads docs/site through the official Pages actions in deploy order', () => {
    expect(workflow).toMatch(
      /actions\/upload-pages-artifact@[0-9a-f]{40}[\s\S]*?path:\s*docs\/site/
    )
    const positions = ['configure-pages', 'upload-pages-artifact', 'deploy-pages'].map((action) => {
      const match = workflow.match(new RegExp(`actions/${action}@[0-9a-f]{40}`))
      return match === null ? -1 : (match.index ?? -1)
    })
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('substitutes a validated deploy-time version token into the page before upload', () => {
    expect(workflow).toContain('__MM_DEPLOY_VERSION__')
    expect(workflow).toMatch(/\^\[0-9A-Za-z\]\[0-9A-Za-z.\+-\]\*\$/)
  })
})
