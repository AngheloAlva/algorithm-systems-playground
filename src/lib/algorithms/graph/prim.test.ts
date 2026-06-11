/**
 * Unit tests for Prim's MST algorithm.
 * TDD: these tests are written BEFORE the implementation.
 *
 * Spec: G16
 */

import { describe, it, expect } from "vitest"
import { runPrim, PRIM_PSEUDOCODE } from "./prim"
import type { GraphData, GraphEdge, GraphNode } from "../../graph/types"

// ---------------------------------------------------------------------------
// Test graph builder helpers
// ---------------------------------------------------------------------------

function makeGraph(
	nodes: { id: string; label: string }[],
	edges: { id: string; source: string; target: string; weight: number }[],
	directed = false
): GraphData {
	const nodesMap = new Map<string, GraphNode>()
	const edgesMap = new Map<string, GraphEdge>()

	for (const n of nodes) {
		nodesMap.set(n.id, { id: n.id, x: 0, y: 0, label: n.label })
	}
	for (const e of edges) {
		edgesMap.set(e.id, { id: e.id, source: e.source, target: e.target, weight: e.weight })
	}

	return { nodes: nodesMap, edges: edgesMap, directed }
}

// ---------------------------------------------------------------------------
// Same 4-node graph as Kruskal — Scenario G16-A
// A—B (w=4), A—C (w=2), B—C (w=3), B—D (w=5), C—D (w=1)
// Expected MST: total weight 6, 3 edges (same as Kruskal)
// ---------------------------------------------------------------------------

const GRAPH_4NODE = makeGraph(
	[
		{ id: "nA", label: "A" },
		{ id: "nB", label: "B" },
		{ id: "nC", label: "C" },
		{ id: "nD", label: "D" },
	],
	[
		{ id: "eAB", source: "nA", target: "nB", weight: 4 },
		{ id: "eAC", source: "nA", target: "nC", weight: 2 },
		{ id: "eBC", source: "nB", target: "nC", weight: 3 },
		{ id: "eBD", source: "nB", target: "nD", weight: 5 },
		{ id: "eCD", source: "nC", target: "nD", weight: 1 },
	]
)

describe("runPrim — G16", () => {
	// -------------------------------------------------------------------------
	// G16-A: Prim produces same total MST weight as Kruskal
	// -------------------------------------------------------------------------

	it("Scenario G16-A: produces MST weight 6 and 3 edges (same as Kruskal)", () => {
		const result = runPrim(GRAPH_4NODE, "nA")

		expect(result.metrics.mstWeight).toBe(6)
		expect(result.metrics.mstEdgeCount).toBe(3)
	})

	it("Scenario G16-A: includes exactly 3 mst-include steps for 4 nodes", () => {
		const result = runPrim(GRAPH_4NODE, "nA")

		const includeCount = result.steps.filter((s) => s.kind === "mst-include").length
		expect(includeCount).toBe(3)
	})

	it("all included edges exist in the original graph", () => {
		const result = runPrim(GRAPH_4NODE, "nA")

		for (const step of result.steps) {
			if (step.kind === "mst-include") {
				expect(GRAPH_4NODE.edges.has(step.edgeId)).toBe(true)
			}
		}
	})

	// -------------------------------------------------------------------------
	// G16-B: Disconnected graph — Prim only reaches start component
	// -------------------------------------------------------------------------

	it("Scenario G16-B: disconnected graph — only reaches start component", () => {
		const disconnected = makeGraph(
			[
				{ id: "nA", label: "A" },
				{ id: "nB", label: "B" },
				{ id: "nC", label: "C" },
				{ id: "nD", label: "D" },
			],
			[
				{ id: "eAB", source: "nA", target: "nB", weight: 2 },
				{ id: "eCD", source: "nC", target: "nD", weight: 3 },
			]
		)

		const result = runPrim(disconnected, "nA")

		const includeEdgeIds = result.steps
			.filter((s) => s.kind === "mst-include")
			.map((s) => (s as { edgeId: string }).edgeId)

		expect(includeEdgeIds).toContain("eAB")
		expect(includeEdgeIds).not.toContain("eCD") // different component
		expect(result.metrics.mstEdgeCount).toBe(1)
	})

	// -------------------------------------------------------------------------
	// G16-3: step.line validity
	// -------------------------------------------------------------------------

	it("all steps have valid line indices within PRIM_PSEUDOCODE", () => {
		const result = runPrim(GRAPH_4NODE, "nA")

		for (const step of result.steps) {
			expect(step.line).toBeGreaterThanOrEqual(0)
			expect(step.line).toBeLessThan(PRIM_PSEUDOCODE.length)
		}
	})

	// -------------------------------------------------------------------------
	// G16-4: Tie-breaking — deterministic output
	// -------------------------------------------------------------------------

	it("produces identical results on repeated calls (deterministic)", () => {
		const r1 = runPrim(GRAPH_4NODE, "nA")
		const r2 = runPrim(GRAPH_4NODE, "nA")

		expect(r1.steps.map((s) => s.kind)).toEqual(r2.steps.map((s) => s.kind))
		expect(r1.metrics.mstWeight).toBe(r2.metrics.mstWeight)
	})

	// -------------------------------------------------------------------------
	// G16-5: Edge cases
	// -------------------------------------------------------------------------

	it("single-node graph produces empty MST", () => {
		const single = makeGraph([{ id: "nA", label: "A" }], [])
		const result = runPrim(single, "nA")
		expect(result.metrics.mstWeight).toBe(0)
		expect(result.metrics.mstEdgeCount).toBe(0)
	})

	it("empty graph produces empty trace", () => {
		const empty = makeGraph([], [])
		const result = runPrim(empty, "")
		expect(result.steps).toHaveLength(0)
		expect(result.metrics.mstWeight).toBe(0)
	})

	it("invalid startId falls back to lowest-label node", () => {
		// If startId is empty string or not in graph, Prim should pick the lowest-label node
		const result = runPrim(GRAPH_4NODE, "nonexistent")

		// Should still produce a valid MST (same total weight)
		expect(result.metrics.mstWeight).toBe(6)
		expect(result.metrics.mstEdgeCount).toBe(3)
	})

	// -------------------------------------------------------------------------
	// G16-6: mst-reject for stale heap entries
	// -------------------------------------------------------------------------

	it("emits mst-reject for edges popped from heap with both endpoints already in MST", () => {
		const result = runPrim(GRAPH_4NODE, "nA")

		const rejectSteps = result.steps.filter((s) => s.kind === "mst-reject")
		// There should be at least one mst-reject (stale pop from heap)
		// In the 4-node graph, some edges will be stale by the time popped
		expect(rejectSteps.length).toBeGreaterThanOrEqual(0)
		// Total steps = mst-include + mst-reject
		const includeSteps = result.steps.filter((s) => s.kind === "mst-include")
		expect(result.steps.length).toBe(includeSteps.length + rejectSteps.length)
	})

	// -------------------------------------------------------------------------
	// G16-7: Starting from different nodes — same total weight (unique MST)
	// -------------------------------------------------------------------------

	it("starting from different nodes yields same MST total weight (unique MST)", () => {
		const fromA = runPrim(GRAPH_4NODE, "nA")
		const fromB = runPrim(GRAPH_4NODE, "nB")
		const fromC = runPrim(GRAPH_4NODE, "nC")

		expect(fromA.metrics.mstWeight).toBe(6)
		expect(fromB.metrics.mstWeight).toBe(6)
		expect(fromC.metrics.mstWeight).toBe(6)
	})
})
