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
// FIX 2 — zero-value round-trips (SIM1.7-a/c/d, SIM5.3)
// mu=0, gamma=0, i0=0 are spec-valid; they must round-trip to the SAME value,
// not fall back to defaults.
// ---------------------------------------------------------------------------

describe("simulationCodec zero-value round-trips (FIX2)", () => {
  it("mu=0 round-trips to 0 (not default)", () => {
    const encoded = simulationCodec.encode({ ...SIMULATION_CODEC_DEFAULTS, mu: 0 })
    const decoded = simulationCodec.decode(encoded)
    expect(decoded.mu).toBe(0)
  })

  it("gamma=0 round-trips to 0 (not default)", () => {
    const encoded = simulationCodec.encode({ ...SIMULATION_CODEC_DEFAULTS, gamma: 0 })
    const decoded = simulationCodec.decode(encoded)
    expect(decoded.gamma).toBe(0)
  })

  it("i0=0 round-trips to 0 (not default)", () => {
    const encoded = simulationCodec.encode({ ...SIMULATION_CODEC_DEFAULTS, i0: 0 })
    const decoded = simulationCodec.decode(encoded)
    expect(decoded.i0).toBe(0)
  })

  it("?m=0 decode → mu === 0 (not 0.005 default)", () => {
    const decoded = simulationCodec.decode(new URLSearchParams("m=0"))
    expect(decoded.mu).toBe(0)
  })

  it("?g=0 decode → gamma === 0 (not 0.1 default)", () => {
    const decoded = simulationCodec.decode(new URLSearchParams("g=0"))
    expect(decoded.gamma).toBe(0)
  })

  it("?i0=0 decode → i0 === 0 (not 1 default)", () => {
    const decoded = simulationCodec.decode(new URLSearchParams("i0=0"))
    expect(decoded.i0).toBe(0)
  })

  it("negative mu still falls back to default (rejection still works)", () => {
    const decoded = simulationCodec.decode(new URLSearchParams("m=-1"))
    expect(decoded.mu).toBe(SIMULATION_CODEC_DEFAULTS.mu)
  })

  it("NaN gamma still falls back to default", () => {
    const decoded = simulationCodec.decode(new URLSearchParams("g=notanumber"))
    expect(decoded.gamma).toBe(SIMULATION_CODEC_DEFAULTS.gamma)
  })
})

// ---------------------------------------------------------------------------
// FIX 3 — cross-field i0 >= n guard
// Decoding ?n=10&i0=9999 must fall back both n and i0 to defaults
// so initialState never computes a negative susceptible count.
// ---------------------------------------------------------------------------

describe("simulationCodec cross-field i0 >= n guard (FIX3)", () => {
  it("?n=10&i0=9999 → both n and i0 fall back to defaults", () => {
    const decoded = simulationCodec.decode(new URLSearchParams("n=10&i0=9999"))
    expect(decoded.n).toBe(SIMULATION_CODEC_DEFAULTS.n)
    expect(decoded.i0).toBe(SIMULATION_CODEC_DEFAULTS.i0)
  })

  it("?n=10&i0=9999 → n - i0 is non-negative (no negative susceptible)", () => {
    const decoded = simulationCodec.decode(new URLSearchParams("n=10&i0=9999"))
    expect(decoded.n - decoded.i0).toBeGreaterThanOrEqual(0)
  })

  it("?n=10&i0=10 (i0 === n) → both fall back to defaults", () => {
    const decoded = simulationCodec.decode(new URLSearchParams("n=10&i0=10"))
    expect(decoded.n).toBe(SIMULATION_CODEC_DEFAULTS.n)
    expect(decoded.i0).toBe(SIMULATION_CODEC_DEFAULTS.i0)
  })

  it("?n=1000&i0=5 (valid) → decodes correctly without fallback", () => {
    const decoded = simulationCodec.decode(new URLSearchParams("n=1000&i0=5"))
    expect(decoded.n).toBe(1000)
    expect(decoded.i0).toBe(5)
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
