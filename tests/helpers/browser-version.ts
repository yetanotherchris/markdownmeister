export function meetsVersionFloor(version: string, minimum: string): boolean {
  const numericVersion = /^\d+(?:\.\d+)*$/
  if (!numericVersion.test(version) || !numericVersion.test(minimum)) return false

  const actual = version.split('.').map(Number)
  const floor = minimum.split('.').map(Number)
  for (let index = 0; index < Math.max(actual.length, floor.length); index++) {
    const difference = (actual[index] ?? 0) - (floor[index] ?? 0)
    if (difference !== 0) return difference > 0
  }
  return true
}
