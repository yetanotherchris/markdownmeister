import { describe, it, expect } from 'vitest'
import { XMLParser } from 'fast-xml-parser'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Spec 038 (FR-002): the manifest fragment that declares the execution alias,
 * the packaged COM class and the windows.fileExplorerContextMenus folder verb
 * must be well-formed XML and structurally valid when used with the manifest
 * template. This suite checks the fragment without running an app package build.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const FRAGMENT_PATH = path.join(REPO_ROOT, 'packaging', 'appx', 'extensions.xml')
const TEMPLATE_PATH = path.join(
  REPO_ROOT,
  'node_modules',
  'app-builder-lib',
  'templates',
  'appx',
  'appxmanifest.xml'
)

// The CLSID, alias file name and DLL name are parsed out of the NATIVE
// sources and the copy hook rather than duplicated here as literals: a
// regenerated GUID or renamed alias in C++ must fail CI until the manifest
// moves with it. It equals
// CLSID_OpenInMarkdownMeisterCommand in native/shell-extension/src/ExplorerCommand.h.
function readClsidFromHeader(): string {
  const header = fs.readFileSync(
    path.join(REPO_ROOT, 'native', 'shell-extension', 'src', 'ExplorerCommand.h'),
    'utf-8'
  )
  const match =
    /CLSID_OpenInMarkdownMeisterCommand\s*=\s*\{\s*0x([0-9a-fA-F]{8}),\s*0x([0-9a-fA-F]{4}),\s*0x([0-9a-fA-F]{4}),\s*\{([^}]+)\}/.exec(
      header
    )
  if (!match) throw new Error('CLSID_OpenInMarkdownMeisterCommand not found in ExplorerCommand.h')
  const data4 = match[4]
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 16).toString(16).padStart(2, '0'))
  return [
    match[1].toLowerCase(),
    match[2].toLowerCase(),
    match[3].toLowerCase(),
    data4.slice(0, 2).join(''),
    data4.slice(2).join('')
  ].join('-')
}

/** kAliasFileName in native/shell-extension/src/ExplorerCommand.cpp. */
function readAliasNameFromSource(): string {
  const source = fs.readFileSync(
    path.join(REPO_ROOT, 'native', 'shell-extension', 'src', 'ExplorerCommand.cpp'),
    'utf-8'
  )
  const match = /kAliasFileName\[\]\s*=\s*L"([^"]+)"/.exec(source)
  if (!match) throw new Error('kAliasFileName not found in ExplorerCommand.cpp')
  return match[1]
}

/** DLL_NAME in scripts/copy-shell-extension.cjs, the hook decides where the
 *  binary lands, so the manifest Path is derived from it, not restated. */
function readDllPackagePath(): string {
  const hook = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'copy-shell-extension.cjs'), 'utf-8')
  const match = /DLL_NAME = '([^']+)'/.exec(hook)
  if (!match) throw new Error('DLL_NAME not found in copy-shell-extension.cjs')
  return `app\\resources\\shell-extension\\${match[1]}`
}

const EXPECTED_CLSID = readClsidFromHeader()
const ALIAS_FILE_NAME = readAliasNameFromSource()
const DLL_PACKAGE_PATH = readDllPackagePath()

interface XmlNode {
  tag: string
  attrs: Record<string, string>
  children: XmlNode[]
}

function parseXml(xml: string): XmlNode {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const parsed = parser.parse(xml) as Record<string, unknown>
  return toTree('root', parsed)
}

function toTree(tag: string, value: unknown): XmlNode {
  if (value === null || typeof value !== 'object') return { tag, attrs: {}, children: [] }
  const record = value as Record<string, unknown>
  const attrs: Record<string, string> = {}
  const children: XmlNode[] = []
  for (const [key, childValue] of Object.entries(record)) {
    if (key.startsWith('@_')) {
      attrs[key] = String(childValue)
    } else if (Array.isArray(childValue)) {
      childValue.forEach((item) => children.push(toTree(key, item)))
    } else {
      children.push(toTree(key, childValue))
    }
  }
  return { tag, attrs, children }
}

function findAll(node: XmlNode, tag: string): XmlNode[] {
  const found: XmlNode[] = []
  for (const child of node.children) {
    if (child.tag === tag) found.push(child)
    found.push(...findAll(child, tag))
  }
  return found
}

/** Substitute every electron-builder template placeholder with a stand-in so
 *  the spliced document parses like a real generated manifest would. */
function renderTemplate(fragment: string): string {
  const values: Record<string, string> = {
    identityName: 'PlaceholderIdentity.MarkdownMeister',
    arch: 'x64',
    publisher: 'CN=00000000-0000-0000-0000-000000000000',
    version: '1.2.1.0',
    applicationId: 'MarkdownMeister',
    displayName: 'MarkdownMeister',
    publisherDisplayName: 'MarkdownMeister',
    description: 'A WYSIWYG markdown editor',
    backgroundColor: '#464646',
    logo: 'assets\\StoreLogo.png',
    square150x150Logo: 'assets\\Square150x150Logo.png',
    square44x44Logo: 'assets\\Square44x44Logo.png',
    lockScreen: '',
    defaultTile: '',
    splashScreen: '',
    resourceLanguages: '<Resource Language="en-US" />',
    capabilities: '<Capabilities><rescap:Capability Name="runFullTrust" /></Capabilities>',
    executable: 'app\\markdownmeister.exe',
    minVersion: '10.0.19041.0',
    maxVersionTested: '10.0.26100.0',
    extensions: fragment
  }
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`\${${key}}`, value),
    fs.readFileSync(TEMPLATE_PATH, 'utf-8')
  )
}

describe('store manifest extensions fragment', () => {
  const fragment = fs.readFileSync(FRAGMENT_PATH, 'utf-8')

  it('is well-formed XML on its own', () => {
    expect(() => parseXml(`<root>${fragment}</root>`)).not.toThrow()
  })

  it('splices into the real electron-builder template as well-formed XML', () => {
    expect(() => parseXml(renderTemplate(fragment))).not.toThrow()
  })

  it('registers the COM class at the packaged DLL path with STA threading', () => {
    const manifest = parseXml(renderTemplate(fragment))
    const classes = findAll(manifest, 'com:Class')
    expect(classes).toHaveLength(1)
    expect(classes[0].attrs['@_Id']).toBe(EXPECTED_CLSID)
    expect(classes[0].attrs['@_Path']).toBe(DLL_PACKAGE_PATH)
    expect(classes[0].attrs['@_ThreadingModel']).toBe('STA')
  })

  it('declares the modern folder verb for Directory items only', () => {
    const manifest = parseXml(renderTemplate(fragment))

    const contextMenus = findAll(manifest, 'desktop4:Extension')
    expect(contextMenus).toHaveLength(1)

    // desktop5 revision required for folders (desktop4 @Type only admits
    // "*" / ".<ext>" patterns, verified against vendor makeappx).
    const itemTypes = findAll(manifest, 'desktop5:ItemType')
    expect(itemTypes).toHaveLength(1)
    expect(itemTypes[0].attrs['@_Type']).toBe('Directory')

    const verbs = findAll(manifest, 'desktop5:Verb')
    expect(verbs).toHaveLength(1)
    expect(verbs[0].attrs['@_Clsid']).toBe(EXPECTED_CLSID)

    // No classic-menu or file-type declarations leak in from this channel.
    expect(
      findAll(manifest, 'uap:Extension').map((node) => node.attrs['@_Category'])
    ).not.toContain('windows.fileTypeAssociation')
  })

  it('declares the markdownmeister.exe execution alias matching the launcher binary', () => {
    const manifest = parseXml(renderTemplate(fragment))
    const aliases = findAll(manifest, 'desktop:ExecutionAlias')
    expect(aliases).toHaveLength(1)
    // The launcher binary name is fixed by electron-builder.yml's
    // `executableName: markdownmeister` (spec 019), by the Scoop manifest
    // assertions and by kAliasFileName in the native source; the alias must
    // never drift from it.
    expect(aliases[0].attrs['@_Alias']).toBe(ALIAS_FILE_NAME)

    // The owning extension's Executable must mirror the GENERATED casing
    // exactly (app\markdownmeister.exe, from executableName), matching only
    // by NTFS case-insensitivity is not a contract.
    const owners = findAll(manifest, 'uap3:Extension')
    expect(owners).toHaveLength(1)
    expect(owners[0].attrs['@_Executable']).toBe('app\\markdownmeister.exe')
  })
})
