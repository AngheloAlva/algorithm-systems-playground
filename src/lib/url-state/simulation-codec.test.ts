/**
 * Unit tests for the simulation URL codec (T4).
 *
 * TDD: all tests written RED first, then simulation-codec.ts makes them green.
 *
 * Mirrors graph-codec.test.ts pattern.
 * URL key map: b→beta, g→gamma, m→mu, n→n, i0→i0 (SIM5.1)
 * Defaults omitted (SIM5.2-a); invalid/negative fall back to defaults (SIM5.2-c)
 */

import { describe, it, expect } from "vitest"
import { simulationCodec, SIMULATION_CODEC_DEFAULTS } from "./simulation-codec"
import { SIRD_DEFAULTS } from "../simulation/sird"

// ---------------------------------------------------------------------------
// SIM5.2-a — round-trip with defaults
// ---------------------------------------------------------------------------

describe("simulationCodec round-trip with defaults (SIM5.2-a)", () => {
  it("encodes all-defaults to empty/minimal URL string", () => {
    const params = simulationCodec.encode(SIMULATION_CODEC_DEFAULTS)
    expect(params.toString()).toBe("")
  })

  it("decode of empty params returns SIRD_DEFAULTS values", () => {
    const decoded = simulationCodec.decode(new URLSearchParams())
    expect(decoded.beta).toBe(SIRD_DEFAULTS.beta)
    expect(decoded.gamma).toBe(SIRD_DEFAULTS.gamma)
    expect(decoded.mu).toBe(SIRD_DEFAULTS.mu)
    expect(decoded.n).toBe(SIRD_DEFAULTS.n)
    expect(decoded.i0).toBe(SIRD_DEFAULTS.i0)
  })

  it("encode then decode with all defaults returns decoded === SIRD_DEFAULTS", () => {
    const params = simulationCodec.encode(SIMULATION_CODEC_DEFAULTS)
    const decoded = simulationCodec.decode(params)
    expect(decoded.beta).toBe(SIMULATION_CODEC_DEFAULTS.beta)
    expect(decoded.gamma).toBe(SIMULATION_CODEC_DEFAULTS.gamma)
    expect(decoded.mu).toBe(SIMULATION_CODEC_DEFAULTS.mu)
    expect(decoded.n).toBe(SIMULATION_CODEC_DEFAULTS.n)
    expect(decoded.i0).toBe(SIMULATION_CODEC_DEFAULTS.i0)
  })
})

// ---------------------------------------------------------------------------
// SIM5.2-b — round-trip with custom values
// ---------------------------------------------------------------------------

describe("simulationCodec round-trip with custom values (SIM5.2-b)", () => {
  const custom = { beta: 0.5, gamma: 0.15, mu: 0.02, n: 5000, i0: 50 }

  it("encode custom values to non-empty string", () => {
    const params = simulationCodec.encode(custom)
    expect(params.toString().length).toBeGreaterThan(0)
  })

  it("encode then decode custom values round-trips correctly", () => {
    const params = simulationCodec.encode(custom)
    const decoded = simulationCodec.decode(params)
    expect(decoded.beta).toBe(custom.beta)
    expect(decoded.gamma).toBe(custom.gamma)
    expect(decoded.mu).toBe(custom.mu)
    expect(decoded.n).toBe(custom.n)
    expect(decoded.i0).toBe(custom.i0)
  })
})

// ---------------------------------------------------------------------------
// SIM5.2-c — invalid/negative fallback to defaults
// ---------------------------------------------------------------------------

describe("simulationCodec decode fallbacks (SIM5.2-c)", () => {
  it("invalid beta (not-a-number) falls back to default beta", () => {
    const params = new URLSearchParams("b=notanumber")
    const decoded = simulationCodec.decode(params)
    expect(decoded.beta).toBe(SIMULATION_CODEC_DEFAULTS.beta)
  })

  it("negative n falls back to default n", () => {
    const params = new URLSearchParams("n=-500")
    const decoded = simulationCodec.decode(params)
    expect(decoded.n).toBe(SIMULATION_CODEC_DEFAULTS.n)
  })

  it("non-finite mu (Infinity) falls back to default mu", () => {
    const params = new URLSearchParams("m=Infinity")
    const decoded = simulationCodec.decode(params)
    expect(decoded.mu).toBe(SIMULATION_CODEC_DEFAULTS.mu)
  })

  it("negative gamma falls back to default gamma", () => {
    const params = new URLSearchParams("g=-0.1")
    const decoded = simulationCodec.decode(params)
    expect(decoded.gamma).toBe(SIMULATION_CODEC_DEFAULTS.gamma)
  })

  it("negative i0 falls back to default i0", () => {
    const params = new URLSearchParams("i0=-10")
    const decoded = simulationCodec.decode(params)
    expect(decoded.i0).toBe(SIMULATION_CODEC_DEFAULTS.i0)
  })

  it("missing params return all defaults (no throw)", () => {
    const decoded = simulationCodec.decode(new URLSearchParams())
    expect(decoded).toEqual(SIMULATION_CODEC_DEFAULTS)
  })
})

// ---------------------------------------------------------------------------
// SIM5.1 — encoded fields and URL keys
// ---------------------------------------------------------------------------

describe("simulationCodec URL keys (SIM5.1)", () => {
  const custom = { beta: 0.5, gamma: 0.15, mu: 0.02, n: 5000, i0: 50 }

  it("uses key 'b' for beta", () => {
    const params = simulationCodec.encode(custom)
    expect(params.has("b")).toBe(true)
    expect(params.get("b")).toBe(String(custom.beta))
  })

  it("uses key 'g' for gamma", () => {
    const params = simulationCodec.encode(custom)
    expect(params.has("g")).toBe(true)
  })

  it("uses key 'm' for mu", () => {
    const params = simulationCodec.encode(custom)
    expect(params.has("m")).toBe(true)
  })

  it("uses key 'n' for population", () => {
    const params = simulationCodec.encode(custom)
    expect(params.has("n")).toBe(true)
  })

  it("uses key 'i0' for initialInfected", () => {
    const params = simulationCodec.encode(custom)
    expect(params.has("i0")).toBe(true)
  })

  it("speed is NOT in the encoded string (SIM5.1)", () => {
    const params = simulationCodec.encode(custom)
    expect(params.has("speed")).toBe(false)
    expect(params.has("s")).toBe(false)
  })

  it("omits all keys when values equal defaults (clean URLs)", () => {
    const params = simulationCodec.encode(SIMULATION_CODEC_DEFAULTS)
    expect(params.has("b")).toBe(false)
    expect(params.has("g")).toBe(false)
    expect(params.has("m")).toBe(false)
    expect(params.has("n")).toBe(false)
    expect(params.has("i0")).toBe(false)
  })
})
