import { useEffect, useState } from 'react'
import type { BuildInfo } from '../../shared/ipc-contract'

/**
 * Spec 037: fetch the read-only build identity once per mount. A failed or
 * unauthorized fetch resolves to `null` and the About area simply stays empty
 * rather than displaying wrong values (FR-007 honesty); the repository link
 * needs no fetched data because main owns the URL.
 */
export function useBuildInfo(): BuildInfo | null {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null)
  useEffect(() => {
    let cancelled = false
    window.api
      .getBuildInfo()
      .then((result) => {
        if (!cancelled && result.ok) setBuildInfo(result.value)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return buildInfo
}
