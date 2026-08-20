import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordParse,
  recordIncomingSerialization,
  recordOutgoingSerialization,
  beginOpen,
  endOpen,
  resetOpenPerformanceCounters,
  getOpenPerformanceCounters
} from '../../src/renderer/editor/openPerformance'

describe('openPerformance counters', () => {
  beforeEach(() => {
    resetOpenPerformanceCounters()
  })

  it('starts at zero', () => {
    expect(getOpenPerformanceCounters()).toEqual({
      fullParses: 0,
      fullSerializations: 0,
      outgoingSerializations: 0,
      openDurations: []
    })
  })

  it('counts parses, incoming and outgoing serializations independently', () => {
    recordParse()
    recordParse()
    recordIncomingSerialization()
    recordOutgoingSerialization()
    const c = getOpenPerformanceCounters()
    expect(c.fullParses).toBe(2)
    expect(c.fullSerializations).toBe(1)
    expect(c.outgoingSerializations).toBe(1)
  })

  it('endOpen without a pending start records nothing', () => {
    endOpen()
    expect(getOpenPerformanceCounters().openDurations).toHaveLength(0)
  })

  it('records one duration per begin/end pair, non-negative', () => {
    beginOpen()
    endOpen()
    const durations = getOpenPerformanceCounters().openDurations
    expect(durations).toHaveLength(1)
    expect(durations[0]).toBeGreaterThanOrEqual(0)
  })

  it('a superseded start keeps only the latest duration (only the latest request pays)', () => {
    beginOpen()
    beginOpen()
    endOpen()
    expect(getOpenPerformanceCounters().openDurations).toHaveLength(1)
    // The consumed start cannot be ended twice.
    endOpen()
    expect(getOpenPerformanceCounters().openDurations).toHaveLength(1)
  })

  it('reset clears counters, durations, and any pending start', () => {
    recordParse()
    beginOpen()
    resetOpenPerformanceCounters()
    endOpen()
    expect(getOpenPerformanceCounters()).toEqual({
      fullParses: 0,
      fullSerializations: 0,
      outgoingSerializations: 0,
      openDurations: []
    })
  })

  it('the returned snapshot is a copy — mutating it does not affect live counters', () => {
    recordParse()
    const snapshot = getOpenPerformanceCounters()
    snapshot.fullParses = 99
    snapshot.openDurations.push(-1)
    expect(getOpenPerformanceCounters().fullParses).toBe(1)
    expect(getOpenPerformanceCounters().openDurations).toHaveLength(0)
  })
})
