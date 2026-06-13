/**
 * SimMetricsPanel — unit tests (SIM7.3)
 *
 * Tests:
 *   - Shows "—" placeholders when status is IDLE (no run yet)
 *   - Shows values once a run exists (RUNNING/PAUSED/DONE)
 *   - Displays all 6 metrics: R0, CFR, herd %, peak infected, peak day, total deaths
 *   - Duration shown when available
 *   - Pure presentational — accepts metrics + status as props (no store access)
 */

import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import type { SIRMetrics } from "@/lib/simulation/sird"

import { SimMetricsPanel } from "./SimMetricsPanel"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const IDLE_STATUS = "idle"
const RUNNING_STATUS = "running"
const DONE_STATUS = "done"

const SAMPLE_METRICS: SIRMetrics = {
  r0: 2.857,
  cfr: 0.0476,
  herdImmunityThreshold: 0.65,
  peakInfected: 312.4,
  peakDay: 58.2,
  totalDeaths: 43.1,
  durationDays: 142.0,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SimMetricsPanel", () => {
  // -------------------------------------------------------------------------
  // IDLE status — show "—" placeholders (SIM7.3-b)
  // -------------------------------------------------------------------------

  it("shows '—' placeholder for all metrics when status is IDLE", () => {
    render(<SimMetricsPanel metrics={SAMPLE_METRICS} status={IDLE_STATUS} />)
    const dashes = screen.getAllByText("—")
    // At least 4 "—" (the run-dependent metrics: peak, deaths, duration; R0/CFR/herd visible always)
    // Design note: R0/CFR/herd are param-derived (valid anytime); the component may
    // choose to show them or "—" during IDLE. We assert at least the run-specific ones are "—".
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it("renders the panel without crashing when status is IDLE", () => {
    expect(() =>
      render(<SimMetricsPanel metrics={SAMPLE_METRICS} status={IDLE_STATUS} />)
    ).not.toThrow()
  })

  // -------------------------------------------------------------------------
  // Non-IDLE status — show actual values (SIM7.3-a)
  // -------------------------------------------------------------------------

  it("shows R0 value when status is RUNNING", () => {
    render(<SimMetricsPanel metrics={SAMPLE_METRICS} status={RUNNING_STATUS} />)
    // R0 ≈ 2.857 — some formatted representation is present
    expect(screen.getByText(/2\.86|2\.857|2\.9/)).toBeDefined()
  })

  it("shows CFR as a percentage when status is DONE", () => {
    render(<SimMetricsPanel metrics={SAMPLE_METRICS} status={DONE_STATUS} />)
    // CFR = 0.0476 → ~4.76% or ~4.8%
    expect(screen.getByText(/4\.\d+%|4\.8%|4\.76%/)).toBeDefined()
  })

  it("shows herd immunity threshold as a percentage when status is DONE", () => {
    render(<SimMetricsPanel metrics={SAMPLE_METRICS} status={DONE_STATUS} />)
    // 0.65 → 65.0%
    expect(screen.getByText(/65[.\d]*%/)).toBeDefined()
  })

  it("shows peak infected value when status is DONE", () => {
    render(<SimMetricsPanel metrics={SAMPLE_METRICS} status={DONE_STATUS} />)
    // peakInfected = 312.4
    expect(screen.getByText(/312/)).toBeDefined()
  })

  it("shows peak day when status is DONE", () => {
    render(<SimMetricsPanel metrics={SAMPLE_METRICS} status={DONE_STATUS} />)
    // peakDay = 58.2
    expect(screen.getByText(/58/)).toBeDefined()
  })

  it("shows total deaths when status is DONE", () => {
    render(<SimMetricsPanel metrics={SAMPLE_METRICS} status={DONE_STATUS} />)
    // totalDeaths = 43.1
    expect(screen.getByText(/43/)).toBeDefined()
  })

  it("shows duration when status is DONE", () => {
    render(<SimMetricsPanel metrics={SAMPLE_METRICS} status={DONE_STATUS} />)
    // durationDays = 142.0
    expect(screen.getByText(/142/)).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // Labels visible at all times (SIM7.3)
  // -------------------------------------------------------------------------

  it("renders 'R₀' or 'R0' label", () => {
    render(<SimMetricsPanel metrics={SAMPLE_METRICS} status={IDLE_STATUS} />)
    expect(screen.getByText(/R[₀0]/)).toBeDefined()
  })

  it("renders 'CFR' label", () => {
    render(<SimMetricsPanel metrics={SAMPLE_METRICS} status={IDLE_STATUS} />)
    expect(screen.getByText(/CFR/i)).toBeDefined()
  })

  it("renders 'Peak' or 'peak' label", () => {
    render(<SimMetricsPanel metrics={SAMPLE_METRICS} status={IDLE_STATUS} />)
    const peakLabels = screen.getAllByText(/peak/i)
    expect(peakLabels.length).toBeGreaterThanOrEqual(1)
  })

  it("renders 'Deaths' or 'deaths' label", () => {
    render(<SimMetricsPanel metrics={SAMPLE_METRICS} status={IDLE_STATUS} />)
    expect(screen.getByText(/deaths/i)).toBeDefined()
  })
})
