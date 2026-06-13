/**
 * Tests for the dashboard URL codec.
 *
 * Covers:
 * - CODEC-1: encode non-defaults (keys present); omit defaults (zero entries)
 * - CODEC-2: round-trip for each ArrayMode with length=75
 * - CODEC-3: out-of-range length falls back to default; unknown mode falls back; seed round-trips
 */

import { describe, it, expect } from "vitest"
import { dashboardCodec, DASHBOARD_DEFAULTS, type DashboardUrlState } from "./dashboard-codec"
import { ARRAY_MODE } from "../algorithms/sorting/array-gen"

describe("dashboardCodec", () => {
  // ---------------------------------------------------------------------------
  // CODEC-1: encode — non-default values
  // ---------------------------------------------------------------------------

  describe("encode — non-default values", () => {
    it("includes 'len' key when arrayLength differs from default", () => {
      const state: DashboardUrlState = {
        arrayLength: 100,
        arrayMode: ARRAY_MODE.RANDOM,
        seed: 42,
      }
      const params = dashboardCodec.encode(state)
      expect(params.get("len")).toBe("100")
    })

    it("includes 'mode' key when arrayMode is not the default", () => {
      const state: DashboardUrlState = {
        arrayLength: 50,
        arrayMode: ARRAY_MODE.REVERSED,
        seed: 42,
      }
      const params = dashboardCodec.encode(state)
      expect(params.get("mode")).toBe("reversed")
    })

    it("includes 'seed' key when seed differs from default", () => {
      const state: DashboardUrlState = {
        arrayLength: 50,
        arrayMode: ARRAY_MODE.RANDOM,
        seed: 99,
      }
      const params = dashboardCodec.encode(state)
      expect(params.get("seed")).toBe("99")
    })

    it("includes all three keys when all values are non-default", () => {
      const state: DashboardUrlState = {
        arrayLength: 100,
        arrayMode: ARRAY_MODE.REVERSED,
        seed: 7,
      }
      const params = dashboardCodec.encode(state)
      expect(params.get("len")).toBe("100")
      expect(params.get("mode")).toBe("reversed")
      expect(params.get("seed")).toBe("7")
    })
  })

  // ---------------------------------------------------------------------------
  // CODEC-1: encode — omit defaults (clean URLs)
  // ---------------------------------------------------------------------------

  describe("encode — omit defaults", () => {
    it("produces zero entries when all values are defaults", () => {
      const state: DashboardUrlState = {
        arrayLength: DASHBOARD_DEFAULTS.arrayLength,
        arrayMode: DASHBOARD_DEFAULTS.arrayMode,
        seed: DASHBOARD_DEFAULTS.seed,
      }
      const params = dashboardCodec.encode(state)
      expect(Array.from(params.entries())).toHaveLength(0)
    })

    it("omits 'len' when arrayLength equals the default", () => {
      const state: DashboardUrlState = {
        arrayLength: DASHBOARD_DEFAULTS.arrayLength,
        arrayMode: ARRAY_MODE.SORTED,
        seed: 42,
      }
      const params = dashboardCodec.encode(state)
      expect(params.has("len")).toBe(false)
    })

    it("omits 'mode' when arrayMode equals the default", () => {
      const state: DashboardUrlState = {
        arrayLength: 100,
        arrayMode: DASHBOARD_DEFAULTS.arrayMode,
        seed: 42,
      }
      const params = dashboardCodec.encode(state)
      expect(params.has("mode")).toBe(false)
    })

    it("omits 'seed' when seed equals the default (42)", () => {
      const state: DashboardUrlState = {
        arrayLength: 100,
        arrayMode: ARRAY_MODE.SORTED,
        seed: DASHBOARD_DEFAULTS.seed,
      }
      const params = dashboardCodec.encode(state)
      expect(params.has("seed")).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // CODEC-2: round-trip fidelity for all ArrayMode values
  // ---------------------------------------------------------------------------

  describe("round-trip fidelity", () => {
    const modes = [
      ARRAY_MODE.RANDOM,
      ARRAY_MODE.SORTED,
      ARRAY_MODE.REVERSED,
      ARRAY_MODE.FEW_UNIQUE,
    ] as const

    for (const mode of modes) {
      it(`round-trips mode=${mode} with length=75`, () => {
        const original: DashboardUrlState = {
          arrayLength: 75,
          arrayMode: mode,
          seed: 42,
        }
        const encoded = dashboardCodec.encode(original)
        const decoded = dashboardCodec.decode(encoded)
        expect(decoded).toEqual(original)
      })
    }

    it("round-trips non-default seed", () => {
      const original: DashboardUrlState = {
        arrayLength: 50,
        arrayMode: ARRAY_MODE.RANDOM,
        seed: 123,
      }
      const encoded = dashboardCodec.encode(original)
      const decoded = dashboardCodec.decode(encoded)
      expect(decoded.seed).toBe(123)
    })
  })

  // ---------------------------------------------------------------------------
  // CODEC-3: invalid / missing parameter fallback
  // ---------------------------------------------------------------------------

  describe("decode — invalid / missing fallback", () => {
    it("falls back to default arrayLength when param is absent", () => {
      const params = new URLSearchParams()
      const decoded = dashboardCodec.decode(params)
      expect(decoded.arrayLength).toBe(DASHBOARD_DEFAULTS.arrayLength)
    })

    it("falls back to default arrayLength when param is out-of-range (above MAX)", () => {
      const params = new URLSearchParams("len=999")
      const decoded = dashboardCodec.decode(params)
      expect(decoded.arrayLength).toBe(DASHBOARD_DEFAULTS.arrayLength)
    })

    it("falls back to default arrayLength when param is out-of-range (below MIN)", () => {
      const params = new URLSearchParams("len=1")
      const decoded = dashboardCodec.decode(params)
      expect(decoded.arrayLength).toBe(DASHBOARD_DEFAULTS.arrayLength)
    })

    it("falls back to default arrayLength when param is non-numeric", () => {
      const params = new URLSearchParams("len=abc")
      const decoded = dashboardCodec.decode(params)
      expect(decoded.arrayLength).toBe(DASHBOARD_DEFAULTS.arrayLength)
    })

    it("falls back to default arrayMode when mode is absent", () => {
      const params = new URLSearchParams()
      const decoded = dashboardCodec.decode(params)
      expect(decoded.arrayMode).toBe(DASHBOARD_DEFAULTS.arrayMode)
    })

    it("falls back to default arrayMode when mode is unknown", () => {
      const params = new URLSearchParams("mode=zigzag")
      const decoded = dashboardCodec.decode(params)
      expect(decoded.arrayMode).toBe(DASHBOARD_DEFAULTS.arrayMode)
    })

    it("falls back to default seed when seed is absent", () => {
      const params = new URLSearchParams()
      const decoded = dashboardCodec.decode(params)
      expect(decoded.seed).toBe(DASHBOARD_DEFAULTS.seed)
    })

    it("falls back to default seed when seed is non-numeric", () => {
      const params = new URLSearchParams("seed=xyz")
      const decoded = dashboardCodec.decode(params)
      expect(decoded.seed).toBe(DASHBOARD_DEFAULTS.seed)
    })

    it("decodes seed=42 explicitly (default but still a valid round-trip)", () => {
      const params = new URLSearchParams("seed=42")
      const decoded = dashboardCodec.decode(params)
      expect(decoded.seed).toBe(42)
    })

    it("round-trips seed=0 (falsy zero must not fall back to default 42)", () => {
      // Encodes {arrayLength:50, arrayMode:RANDOM, seed:0}; seed=0 is non-default
      // so the 'seed' key must be present in params and decoded back as exactly 0.
      const original: DashboardUrlState = {
        arrayLength: 50,
        arrayMode: ARRAY_MODE.RANDOM,
        seed: 0,
      }
      const encoded = dashboardCodec.encode(original)
      expect(encoded.has("seed")).toBe(true)
      const decoded = dashboardCodec.decode(encoded)
      expect(decoded.seed).toBe(0)
    })

    it("falls back to default arrayLength when len is a float (5.5)", () => {
      const params = new URLSearchParams("len=5.5")
      const decoded = dashboardCodec.decode(params)
      expect(decoded.arrayLength).toBe(DASHBOARD_DEFAULTS.arrayLength)
    })
  })
})
