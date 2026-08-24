/**
 * Spec 033 (research R5, contract C4): renderer-memory instrumentation for the
 * open path. Counts whole-document parse passes over incoming content
 * (`fullParses`, SC-002), whole-document serializations of incoming content for
 * baseline bookkeeping (`fullSerializations`, SC-003), serializations triggered
 * by outgoing dirty checks (`outgoingSerializations`, fast-path effectiveness),
 * and per-open durations from open-gesture commit to editor-ready
 * (`openDurations`, SC-001/SC-004).
 *
 * Counters are observability only: no user-facing behaviour may read or depend
 * on them. The snapshot is exposed on `window.__mmOpenPerformance` so e2e
 * tests can read it through the page context without touching the preload API.
 */

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

/** Timestamp of the most recent open-gesture commit, or null. A second begin
 *  supersedes the first (spec edge case: only the latest request pays). */
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

/** Mark the end of an open (editor-ready). Records a duration only when a
 *  start is pending; mounts without a preceding open contribute nothing. */
export function endOpen(): void {
  if (pendingOpenStart === null) return
  counters.openDurations.push(performance.now() - pendingOpenStart)
  if (counters.openDurations.length > MAX_DURATIONS) {
    counters.openDurations.splice(0, counters.openDurations.length - MAX_DURATIONS)
  }
  pendingOpenStart = null
}

/** Drop a pending start without recording a duration, an open whose readFile
 *  failed never presents an editor, so it must not poison the next mount's
 *  measurement. */
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
