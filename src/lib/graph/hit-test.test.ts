/**
 * Unit tests for graph hit-testing (Unit A4).
 *
 * Scenarios: G3-A through G3-E.
 */

import { describe, it, expect } from "vitest"
import { nodeAt, edgeAt } from "./hit-test"
import type { GraphNode, GraphEdge } from "./types"

// ---------------------------------------------------------------------------
// Helper: build plain Maps from arrays
// ---------------------------------------------------------------------------

function makeNodes(defs: Array<{ id: string; x: number; y: number; label: string }>) {
	const m = new Map<string, GraphNode>()
	for (const d of defs) m.set(d.id, d)
	return m
}

function makeEdges(
	defs: Array<{ id: string; source: string; target: string; weight?: number }>
) {
	const m = new Map<string, GraphEdge>()
	for (const d of defs) m.set(d.id, { ...d, weight: d.weight ?? 1 })
	return m
}

// ---------------------------------------------------------------------------
// G3-A — Node hit at exact center
// ---------------------------------------------------------------------------

describe("nodeAt (G3-A)", () => {
	it("returns node id when pointer is exactly at center", () => {
		const nodes = makeNodes([{ id: "n1", x: 100, y: 100, label: "A" }])
		expect(nodeAt(100, 100, nodes, 20)).toBe("n1")
	})
})

// ---------------------------------------------------------------------------
// G3-B — Node miss outside radius
// ---------------------------------------------------------------------------

describe("nodeAt (G3-B)", () => {
	it("returns null when distance > radius", () => {
		const nodes = makeNodes([{ id: "n1", x: 100, y: 100, label: "A" }])
		expect(nodeAt(125, 100, nodes, 20)).toBeNull() // distance 25 > 20
	})

	it("returns node id when distance exactly equals radius", () => {
		const nodes = makeNodes([{ id: "n1", x: 100, y: 100, label: "A" }])
		expect(nodeAt(120, 100, nodes, 20)).toBe("n1") // distance 20 === 20
	})
})

// ---------------------------------------------------------------------------
// G3-C — Nearest-node tie-breaking
// ---------------------------------------------------------------------------

describe("nodeAt (G3-C)", () => {
	it("returns the nearest node when multiple are within radius", () => {
		const nodes = makeNodes([
			{ id: "n1", x: 100, y: 100, label: "A" },
			{ id: "n2", x: 110, y: 100, label: "B" },
		])
		// pointer at (108, 100) — distance to n1 is 8, to n2 is 2
		expect(nodeAt(108, 100, nodes, 20)).toBe("n2")
	})
})

// ---------------------------------------------------------------------------
// G3-D — Edge hit near midpoint
// ---------------------------------------------------------------------------

describe("edgeAt (G3-D)", () => {
	it("returns edge id when perpendicular distance < threshold", () => {
		const nodes = makeNodes([
			{ id: "n1", x: 0, y: 0, label: "A" },
			{ id: "n2", x: 100, y: 0, label: "B" },
		])
		const edges = makeEdges([{ id: "e1", source: "n1", target: "n2" }])
		// Point at (50, 5) — perpendicular distance from segment is 5 < 8
		expect(edgeAt(50, 5, edges, nodes, 8)).toBe("e1")
	})
})

// ---------------------------------------------------------------------------
// G3-E — Edge miss beyond endpoint
// ---------------------------------------------------------------------------

describe("edgeAt (G3-E)", () => {
	it("returns null when closest point is endpoint and distance > threshold", () => {
		const nodes = makeNodes([
			{ id: "n1", x: 0, y: 0, label: "A" },
			{ id: "n2", x: 100, y: 0, label: "B" },
		])
		const edges = makeEdges([{ id: "e1", source: "n1", target: "n2" }])
		// Point at (150, 0) — closest point on segment is (100,0), distance = 50 > 8
		expect(edgeAt(150, 0, edges, nodes, 8)).toBeNull()
	})

	it("returns null when no edges in map", () => {
		const nodes = makeNodes([{ id: "n1", x: 0, y: 0, label: "A" }])
		const edges = makeEdges([])
		expect(edgeAt(0, 0, edges, nodes, 20)).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// Additional edge cases
// ---------------------------------------------------------------------------

describe("nodeAt — empty map", () => {
	it("returns null for empty nodes map", () => {
		const nodes = makeNodes([])
		expect(nodeAt(0, 0, nodes, 20)).toBeNull()
	})
})
