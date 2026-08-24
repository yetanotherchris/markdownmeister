import { useEffect, useState } from 'react'
import type { BuildInfo } from '../../shared/ipc-contract'

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
