
const ABSOLUTE_PATH_RE = /(?:[A-Za-z]:[\\/]|\\\\|\/)(?:[^\s"'`]| (?=[^'"`\s]*[\\/]))*/g

export function scrubAbsolutePaths(message: string): string {
  return message.replace(ABSOLUTE_PATH_RE, '<path>')
}
