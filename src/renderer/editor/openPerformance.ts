

export interface OpenPerformanceCounters {
  fullParses: number
  fullSerializations: number
  outgoingSerializations: number
  openDurations: number[]
}

const counters: OpenPerformanceCounters = {
  fullParses: 0,
  fullSerializations: 0,
  outgoingSerializations: 0,
  openDurations: []
}


let pendingOpenStart: number | null = null

/** Durations are diagnostic; the cap bounds memory on very long sessions. */
const MAX_DURATIONS = 1_000

export function recordParse(): void {
  counters.fullParses++
}

export function recordIncomingSerialization(): void {
  counters.fullSerializations++
}

export function recordOutgoingSerialization(): void {
  counters.outgoingSerializations++
}

/** Mark the start of an open (open-gesture commit, at readFile initiation). */
export function beginOpen(): void {
  pendingOpenStart = performance.now()
}


export function endOpen(): void {
  if (pendingOpenStart === null) return
  counters.openDurations.push(performance.now() - pendingOpenStart)
  if (counters.openDurations.length > MAX_DURATIONS) {
    counters.openDurations.splice(0, counters.openDurations.length - MAX_DURATIONS)
  }
  pendingOpenStart = null
}


export function discardOpen(): void {
  pendingOpenStart = null
}

/** Clear every counter and any pending start (e2e isolation). */
export function resetOpenPerformanceCounters(): void {
  counters.fullParses = 0
  counters.fullSerializations = 0
  counters.outgoingSerializations = 0
  counters.openDurations = []
  pendingOpenStart = null
}

/** A defensive copy: callers cannot mutate live counters. */
export function getOpenPerformanceCounters(): OpenPerformanceCounters {
  return {
    fullParses: counters.fullParses,
    fullSerializations: counters.fullSerializations,
    outgoingSerializations: counters.outgoingSerializations,
    openDurations: [...counters.openDurations]
  }
}

declare global {
  interface Window {
    __mmOpenPerformance?: {
      getCounters: () => OpenPerformanceCounters
      reset: () => void
    }
  }
}

if (typeof window !== 'undefined') {
  window.__mmOpenPerformance = {
    getCounters: getOpenPerformanceCounters,
    reset: resetOpenPerformanceCounters
  }
}
