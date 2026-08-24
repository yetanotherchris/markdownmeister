import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import remarkGFM from 'remark-gfm'
import remarkMath from 'remark-math'
import { markdownSyntaxRemark, DEFAULT_MARKDOWN_SYNTAX_OPTIONS } from '../../src/renderer/editor/markdownSyntaxOptions'

/**
 * Spec 033: the reconfigure skip guard
 * relies on Crepe's stock pipeline being extension-equivalent to the
 * swapped-with-defaults composer. This test proves the equivalence directly:
 * every round-trip fixture parsed+serialized under BOTH pipelines produces
 * byte-identical output, so skipping the swap when the applied options equal
 * the requested defaults cannot change what the editor shows or saves.
 */

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/roundtrip')

function stockPipeline() {
  // What a freshly constructed Crepe editor uses: remark-parse +
  // remark-stringify, remark-gfm, and remark-math.
  return unified().use(remarkParse).use(remarkStringify).use(remarkGFM).use(remarkMath)
}

function swappedWithDefaultsPipeline() {
  // What `reconfigureEditor` builds when the swap runs with default options.
  return unified()
    .use(remarkParse)
    .use(remarkStringify)
    .use(markdownSyntaxRemark({ ...DEFAULT_MARKDOWN_SYNTAX_OPTIONS }))
}

function roundTrip(processor: ReturnType<typeof stockPipeline>, text: string): string {
  const tree = processor.runSync(processor.parse(text))
  return processor.stringify(tree as Parameters<typeof processor.stringify>[0])
}

describe('stock vs swapped-with-defaults pipeline byte-equality', () => {
  const fixtures = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.md'))

  it('has fixtures to test', () => {
    expect(fixtures.length).toBeGreaterThan(0)
  })

  for (const fixture of fixtures) {
    it(`round-trips identically: ${fixture}`, () => {
      const text = fs.readFileSync(path.join(FIXTURE_DIR, fixture), 'utf-8')
      const stock = roundTrip(stockPipeline(), text)
      const swapped = roundTrip(swappedWithDefaultsPipeline(), text)
      expect(swapped).toBe(stock)
    })
  }

  it('agrees on representative syntax the fixtures do not cover', () => {
    const samples = [
      '~~strike~~ and | a |\n| - | mixed',
      '- [ ] task\n- [x] done',
      '$x$ and $$block$$\n\nhttps://example.com',
      'a\nb\n\nterm\n: definition'
    ]
    for (const text of samples) {
      expect(roundTrip(swappedWithDefaultsPipeline(), text)).toBe(roundTrip(stockPipeline(), text))
    }
  })
})
