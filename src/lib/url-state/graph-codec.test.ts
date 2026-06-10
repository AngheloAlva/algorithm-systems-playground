/**
 * Unit tests for graph URL codec (Unit A9).
 *
 * Scenarios: G8-A (round-trip), G8-B (topology not in URL), NG1 (no topology keys).
 */

import { describe, it, expect } from "vitest"
import { graphCodec, GRAPH_CODEC_DEFAULTS } from "./graph-codec"

// ---------------------------------------------------------------------------
// G8-A — round-trip
// ---------------------------------------------------------------------------

describe("graphCodec round-trip (G8-A)", () => {
	it("encodes and decodes { algorithm: 'dfs', speed: 2 } correctly", () => {
		const state = { algorithm: "dfs", speed: 2 }
		const params = graphCodec.encode(state)
		const decoded = graphCodec.decode(params)
		expect(decoded.algorithm).toBe("dfs")
		expect(decoded.speed).toBe(2)
	})

	it("round-trips default values", () => {
		const params = graphCodec.encode(GRAPH_CODEC_DEFAULTS)
		const decoded = graphCodec.decode(params)
		expect(decoded.algorithm).toBe(GRAPH_CODEC_DEFAULTS.algorithm)
		expect(decoded.speed).toBe(GRAPH_CODEC_DEFAULTS.speed)
	})
})

// ---------------------------------------------------------------------------
// G8-B / NG1 — topology NOT in URL
// ---------------------------------------------------------------------------

describe("graphCodec topology exclusion (G8-B, NG1)", () => {
	it("encoded output has no 'nodes', 'edges', or 'positions' keys", () => {
		const state = { algorithm: "bfs", speed: 4 }
		const params = graphCodec.encode(state)
		expect(params.has("nodes")).toBe(false)
		expect(params.has("edges")).toBe(false)
		expect(params.has("positions")).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Fallback defaults on invalid / missing values
// ---------------------------------------------------------------------------

describe("graphCodec decode fallbacks", () => {
	it("falls back to default algorithm on invalid value", () => {
		const params = new URLSearchParams("algo=notreal")
		const decoded = graphCodec.decode(params)
		expect(decoded.algorithm).toBe(GRAPH_CODEC_DEFAULTS.algorithm)
	})

	it("falls back to default speed on invalid value", () => {
		const params = new URLSearchParams("speed=99")
		const decoded = graphCodec.decode(params)
		expect(decoded.speed).toBe(GRAPH_CODEC_DEFAULTS.speed)
	})

	it("returns full defaults when params are empty", () => {
		const params = new URLSearchParams()
		const decoded = graphCodec.decode(params)
		expect(decoded.algorithm).toBe(GRAPH_CODEC_DEFAULTS.algorithm)
		expect(decoded.speed).toBe(GRAPH_CODEC_DEFAULTS.speed)
	})
})

// ---------------------------------------------------------------------------
// Codec keys
// ---------------------------------------------------------------------------

describe("graphCodec encode keys", () => {
	it("uses 'algo' key for algorithm (consistent with other codecs)", () => {
		const params = graphCodec.encode({ algorithm: "dfs", speed: 4 })
		// 'dfs' is non-default, so it should be encoded
		expect(params.has("algo")).toBe(true)
	})

	it("uses 'speed' key for speed", () => {
		const params = graphCodec.encode({ algorithm: "bfs", speed: 2 })
		expect(params.has("speed")).toBe(true)
	})

	it("omits default values from encoded params (clean URLs)", () => {
		const params = graphCodec.encode(GRAPH_CODEC_DEFAULTS)
		expect(params.toString()).toBe("")
	})
})
