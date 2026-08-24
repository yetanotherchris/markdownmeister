

export interface FrontmatterParts {
  frontmatter: string
  body: string
}

/** The index just past the `\n` ending the line that starts at `start`, or
 *  `text.length` when the line has no terminator. */
function lineEndIndex(text: string, start: number): number {
  const idx = text.indexOf('\n', start)
  return idx === -1 ? text.length : idx + 1
}


function lineContent(text: string, start: number, end: number): string {
  let content = text.slice(start, end)
  if (content.endsWith('\n')) content = content.slice(0, -1)
  if (content.endsWith('\r')) content = content.slice(0, -1)
  return content
}


function isDelimiter(text: string, start: number, end: number): boolean {
  return lineContent(text, start, end) === '---'
}


export function splitFrontmatter(text: string): FrontmatterParts {
  const firstLineEnd = lineEndIndex(text, 0)
  if (!isDelimiter(text, 0, firstLineEnd)) {
    return { frontmatter: '', body: text }
  }

  // Scan the lines after the opening delimiter for the first closing one.
  let pos = firstLineEnd
  while (pos < text.length) {
    const end = lineEndIndex(text, pos)
    if (isDelimiter(text, pos, end)) {
      return { frontmatter: text.slice(0, end), body: text.slice(end) }
    }
    pos = end
  }

  return { frontmatter: '', body: text }
}


export function joinFrontmatter(frontmatter: string, body: string): string {
  return frontmatter + body
}
