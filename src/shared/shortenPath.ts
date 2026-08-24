
export function shortenPath(path: string, maxLength: number): string {
  if (maxLength <= 0) return '…'
  if (path.length === 0) return ''
  if (path.length <= maxLength) return path
  const sep = /^[a-zA-Z]:[\\/]/.test(path) || /^\\/.test(path) || (!path.includes('/') && path.includes('\\'))
    ? '\\'
    : '/'
  const segments = path.split(/[\\/]/).filter((s) => s.length > 0)
  const final = segments[segments.length - 1] ?? path
  let tail = final
  for (let i = segments.length - 2; i >= 0; i--) {
    const candidate = segments[i] + sep + tail
    if (candidate.length + 2 > maxLength) break
    tail = candidate
  }
  return '…' + sep + tail
}
