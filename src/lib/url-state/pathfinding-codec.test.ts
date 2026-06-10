/**
 * TDD tests for PathfindingUrlCodec.
 *
 * Tests are written RED-first before implementation exists.
 *
 * Covers:
 *  - encode/decode roundtrip for every field
 *  - default omission in encoded params (clean URLs)
 *  - defaults applied when params are absent
 *  - invalid algorithm slug fallback to default
 *  - invalid speed value fallback to default
 *  - boolean encoding as "1" / "0"
 *  - partial params (one field present, rest absent)
 */

import { describe, it, expect } from "vitest"
import { pathfindingCodec, PATHFINDING_DEFAULTS } from "./pathfinding-codec"
import type { PathfindingUrlState } from "./pathfinding-codec"

describe("pathfindingCodec — encode", () => {
	it("omits all keys when state matches defaults (clean URL)", () => {
		const params = pathfindingCodec.encode(PATHFINDING_DEFAULTS)
		expect(params.toString()).toBe("")
	})

	it("encodes algorithm when it differs from default", () => {
		const state: PathfindingUrlState = { ...PATHFINDING_DEFAULTS, algorithm: "dijkstra" }
		const params = pathfindingCodec.encode(state)
		expect(params.get("algo")).toBe("dijkstra")
	})

	it("encodes speed when it differs from default", () => {
		const state: PathfindingUrlState = { ...PATHFINDING_DEFAULTS, speed: 7 }
		const params = pathfindingCodec.encode(state)
		expect(params.get("speed")).toBe("7")
	})

	it("encodes diagonal true as '1'", () => {
		const state: PathfindingUrlState = { ...PATHFINDING_DEFAULTS, diagonal: true }
		const params = pathfindingCodec.encode(state)
		expect(params.get("diag")).toBe("1")
	})

	it("omits diagonal when false (default)", () => {
		const params = pathfindingCodec.encode(PATHFINDING_DEFAULTS)
		expect(params.has("diag")).toBe(false)
	})

	it("encodes non-default bfs algorithm", () => {
		const state: PathfindingUrlState = { ...PATHFINDING_DEFAULTS, algorithm: "bfs" }
		const params = pathfindingCodec.encode(state)
		expect(params.get("algo")).toBe("bfs")
	})

	it("encodes non-default dfs algorithm", () => {
		const state: PathfindingUrlState = { ...PATHFINDING_DEFAULTS, algorithm: "dfs" }
		const params = pathfindingCodec.encode(state)
		expect(params.get("algo")).toBe("dfs")
	})
})

describe("pathfindingCodec — decode", () => {
	it("returns defaults when params are empty", () => {
		const params = new URLSearchParams()
		const result = pathfindingCodec.decode(params)
		expect(result).toEqual(PATHFINDING_DEFAULTS)
	})

	it("decodes algo=dijkstra correctly", () => {
		const params = new URLSearchParams("algo=dijkstra")
		expect(pathfindingCodec.decode(params).algorithm).toBe("dijkstra")
	})

	it("decodes algo=bfs correctly", () => {
		const params = new URLSearchParams("algo=bfs")
		expect(pathfindingCodec.decode(params).algorithm).toBe("bfs")
	})

	it("decodes algo=dfs correctly", () => {
		const params = new URLSearchParams("algo=dfs")
		expect(pathfindingCodec.decode(params).algorithm).toBe("dfs")
	})

	it("decodes algo=astar correctly", () => {
		const params = new URLSearchParams("algo=astar")
		expect(pathfindingCodec.decode(params).algorithm).toBe("astar")
	})

	it("falls back to default algorithm for unknown slug", () => {
		const params = new URLSearchParams("algo=badvalue")
		expect(pathfindingCodec.decode(params).algorithm).toBe(PATHFINDING_DEFAULTS.algorithm)
	})

	it("falls back to default algorithm for empty algo param", () => {
		const params = new URLSearchParams("algo=")
		expect(pathfindingCodec.decode(params).algorithm).toBe(PATHFINDING_DEFAULTS.algorithm)
	})

	it("decodes speed=3 correctly", () => {
		const params = new URLSearchParams("speed=3")
		expect(pathfindingCodec.decode(params).speed).toBe(3)
	})

	it("decodes speed=8 correctly", () => {
		const params = new URLSearchParams("speed=8")
		expect(pathfindingCodec.decode(params).speed).toBe(8)
	})

	it("falls back to default speed for NaN speed", () => {
		const params = new URLSearchParams("speed=NaN")
		expect(pathfindingCodec.decode(params).speed).toBe(PATHFINDING_DEFAULTS.speed)
	})

	it("falls back to default speed for out-of-range speed (0)", () => {
		const params = new URLSearchParams("speed=0")
		expect(pathfindingCodec.decode(params).speed).toBe(PATHFINDING_DEFAULTS.speed)
	})

	it("falls back to default speed for out-of-range speed (9)", () => {
		const params = new URLSearchParams("speed=9")
		expect(pathfindingCodec.decode(params).speed).toBe(PATHFINDING_DEFAULTS.speed)
	})

	it("decodes diag=1 as diagonal true", () => {
		const params = new URLSearchParams("diag=1")
		expect(pathfindingCodec.decode(params).diagonal).toBe(true)
	})

	it("decodes diag=0 as diagonal false", () => {
		const params = new URLSearchParams("diag=0")
		expect(pathfindingCodec.decode(params).diagonal).toBe(false)
	})

	it("defaults diagonal to false when diag is absent", () => {
		const params = new URLSearchParams()
		expect(pathfindingCodec.decode(params).diagonal).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Hostile-input decode (S1 + S2)
// ---------------------------------------------------------------------------

describe("pathfindingCodec — hostile inputs (diagonal)", () => {
	it("diag=true falls back to default false (strict '1'/'0' contract — not a boolean string)", () => {
		const params = new URLSearchParams("diag=true")
		expect(pathfindingCodec.decode(params).diagonal).toBe(false)
	})

	it("diag=yes falls back to default false", () => {
		const params = new URLSearchParams("diag=yes")
		expect(pathfindingCodec.decode(params).diagonal).toBe(false)
	})

	it("diag=garbage falls back to default false", () => {
		const params = new URLSearchParams("diag=garbage")
		expect(pathfindingCodec.decode(params).diagonal).toBe(false)
	})

	it("diag=2 falls back to default false (only '1' is truthy)", () => {
		const params = new URLSearchParams("diag=2")
		expect(pathfindingCodec.decode(params).diagonal).toBe(false)
	})
})

describe("pathfindingCodec — hostile inputs (speed)", () => {
	it("speed=-1 falls back to default (below valid range)", () => {
		const params = new URLSearchParams("speed=-1")
		expect(pathfindingCodec.decode(params).speed).toBe(PATHFINDING_DEFAULTS.speed)
	})

	it("speed=999 falls back to default (above valid range)", () => {
		const params = new URLSearchParams("speed=999")
		expect(pathfindingCodec.decode(params).speed).toBe(PATHFINDING_DEFAULTS.speed)
	})

	it("speed=3.5 falls back to default (non-integer)", () => {
		const params = new URLSearchParams("speed=3.5")
		expect(pathfindingCodec.decode(params).speed).toBe(PATHFINDING_DEFAULTS.speed)
	})

	it("speed=0 falls back to default (below MIN_SPEED)", () => {
		const params = new URLSearchParams("speed=0")
		expect(pathfindingCodec.decode(params).speed).toBe(PATHFINDING_DEFAULTS.speed)
	})
})

describe("pathfindingCodec — roundtrip", () => {
	it("roundtrips the default state", () => {
		const encoded = pathfindingCodec.encode(PATHFINDING_DEFAULTS)
		const decoded = pathfindingCodec.decode(encoded)
		expect(decoded).toEqual(PATHFINDING_DEFAULTS)
	})

	it("roundtrips { algorithm: dijkstra, speed: 3, diagonal: true }", () => {
		const state: PathfindingUrlState = { algorithm: "dijkstra", speed: 3, diagonal: true }
		const encoded = pathfindingCodec.encode(state)
		const decoded = pathfindingCodec.decode(encoded)
		expect(decoded).toEqual(state)
	})

	it("roundtrips { algorithm: bfs, speed: 8, diagonal: false }", () => {
		const state: PathfindingUrlState = { algorithm: "bfs", speed: 8, diagonal: false }
		const encoded = pathfindingCodec.encode(state)
		const decoded = pathfindingCodec.decode(encoded)
		expect(decoded).toEqual(state)
	})

	it("roundtrips { algorithm: dfs, speed: 1, diagonal: true }", () => {
		const state: PathfindingUrlState = { algorithm: "dfs", speed: 1, diagonal: true }
		const encoded = pathfindingCodec.encode(state)
		const decoded = pathfindingCodec.decode(encoded)
		expect(decoded).toEqual(state)
	})

	it("roundtrips partial state with only algo changed", () => {
		const state: PathfindingUrlState = { ...PATHFINDING_DEFAULTS, algorithm: "dfs" }
		const encoded = pathfindingCodec.encode(state)
		const decoded = pathfindingCodec.decode(encoded)
		expect(decoded).toEqual(state)
	})
})
