/**
 * Unit tests for Kruskal's MST algorithm.
 * TDD: these tests are written BEFORE the implementation.
 *
 * Spec: G15
 */

import { describe, it, expect } from "vitest"
import { runKruskal, KRUSKAL_PSEUDOCODE } from "./kruskal"
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
// G15-A: Kruskal on a 4-node weighted graph
// A—B (w=4), A—C (w=2), B—C (w=3), B—D (w=5), C—D (w=1)
// Expected MST: C—D(1), A—C(2), B—C(3) → total weight 6, 3 edges
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

describe("runKruskal — G15", () => {
	// -------------------------------------------------------------------------
	// G15-A: Correct MST on a small weighted graph
	// -------------------------------------------------------------------------

	it("Scenario G15-A: produces correct MST — weight 6, 3 edges for 4 nodes", () => {
		const result = runKruskal(GRAPH_4NODE, "")

		expect(result.metrics.mstWeight).toBe(6)
		expect(result.metrics.mstEdgeCount).toBe(3)
		expect(result.metrics.visitedCount).toBe(4) // all 4 nodes in forest
	})

	it("Scenario G15-A: includes C—D (w=1), A—C (w=2), B—C (w=3) as MST edges", () => {
		const result = runKruskal(GRAPH_4NODE, "")

		const includeSteps = result.steps.filter((s) => s.kind === "mst-include")
		const includeEdgeIds = includeSteps.map((s) => (s as { edgeId: string }).edgeId)

		expect(includeEdgeIds).toContain("eCD") // weight 1
		expect(includeEdgeIds).toContain("eAC") // weight 2
		expect(includeEdgeIds).toContain("eBC") // weight 3
		expect(includeEdgeIds).not.toContain("eAB") // excluded (would cycle)
	})

	it("Scenario G15-A: rejects A—B (w=4) — would form a cycle", () => {
		const result = runKruskal(GRAPH_4NODE, "")

		const rejectSteps = result.steps.filter((s) => s.kind === "mst-reject")
		const rejectEdgeIds = rejectSteps.map((s) => (s as { edgeId: string }).edgeId)

		expect(rejectEdgeIds).toContain("eAB")
	})

	it("each step has a valid line index within pseudocode length", () => {
		const result = runKruskal(GRAPH_4NODE, "")

		for (const step of result.steps) {
			expect(step.line).toBeGreaterThanOrEqual(0)
			expect(step.line).toBeLessThan(KRUSKAL_PSEUDOCODE.length)
		}
	})

	// -------------------------------------------------------------------------
	// G15-B: Disconnected graph produces a spanning forest
	// -------------------------------------------------------------------------

	it("Scenario G15-B: disconnected graph — produces spanning forest", () => {
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
		const result = runKruskal(disconnected, "")

		const includeEdgeIds = result.steps
			.filter((s) => s.kind === "mst-include")
			.map((s) => (s as { edgeId: string }).edgeId)

		expect(includeEdgeIds).toContain("eAB")
		expect(includeEdgeIds).toContain("eCD")
		expect(result.metrics.mstEdgeCount).toBe(2)
		expect(result.metrics.mstWeight).toBe(5) // eAB(2) + eCD(3)
		expect(result.metrics.visitedCount).toBe(4) // all 4 nodes in forest
		// Forest: mstEdgeCount = nodes.size - 2 (two components)
	})

	// -------------------------------------------------------------------------
	// G15-4: Tie-breaking by edgeId (deterministic)
	// -------------------------------------------------------------------------

	it("tie-breaks equal-weight edges by edgeId lexicographic order", () => {
		// Two edges with same weight but different ids
		const graph = makeGraph(
			[
				{ id: "nA", label: "A" },
				{ id: "nB", label: "B" },
				{ id: "nC", label: "C" },
			],
			[
				{ id: "eZZ", source: "nA", target: "nB", weight: 1 }, // same weight, later id
				{ id: "eAA", source: "nA", target: "nC", weight: 1 }, // same weight, earlier id
			]
		)

		const r1 = runKruskal(graph, "")
		const r2 = runKruskal(graph, "")

		// Both runs must produce identical step sequences (deterministic)
		expect(r1.steps.map((s) => s.kind)).toEqual(r2.steps.map((s) => s.kind))

		// eAA should be processed first (lexicographically smaller id)
		const firstInclude = r1.steps.find((s) => s.kind === "mst-include")
		expect((firstInclude as { edgeId: string }).edgeId).toBe("eAA")
	})

	// -------------------------------------------------------------------------
	// G15-5: Metrics correctness
	// -------------------------------------------------------------------------

	it("single-node graph produces empty MST with weight 0 and 0 edges", () => {
		const single = makeGraph([{ id: "nA", label: "A" }], [])
		const result = runKruskal(single, "")
		expect(result.metrics.mstWeight).toBe(0)
		expect(result.metrics.mstEdgeCount).toBe(0)
		expect(result.steps).toHaveLength(0)
		expect(result.metrics.visitedCount).toBe(1) // single node spans itself
	})

	it("empty graph produces empty trace", () => {
		const empty = makeGraph([], [])
		const result = runKruskal(empty, "")
		expect(result.steps).toHaveLength(0)
		expect(result.metrics.mstWeight).toBe(0)
		expect(result.metrics.mstEdgeCount).toBe(0)
	})

	// -------------------------------------------------------------------------
	// G15-6: startId is accepted but ignored
	// -------------------------------------------------------------------------

	it("accepts and ignores startId — same result with different startId values", () => {
		const r1 = runKruskal(GRAPH_4NODE, "nA")
		const r2 = runKruskal(GRAPH_4NODE, "nD")
		const r3 = runKruskal(GRAPH_4NODE, "")

		expect(r1.metrics.mstWeight).toBe(r2.metrics.mstWeight)
		expect(r2.metrics.mstWeight).toBe(r3.metrics.mstWeight)
	})

	// -------------------------------------------------------------------------
	// Step structure validation
	// -------------------------------------------------------------------------

	it("all mst-include and mst-reject steps carry an edgeId that exists in the graph", () => {
		const result = runKruskal(GRAPH_4NODE, "")

		for (const step of result.steps) {
			if (step.kind === "mst-include" || step.kind === "mst-reject") {
				expect(GRAPH_4NODE.edges.has(step.edgeId)).toBe(true)
			}
		}
	})

	it("total steps = number of edges (one step per edge)", () => {
		const result = runKruskal(GRAPH_4NODE, "")
		// Kruskal processes every edge exactly once
		expect(result.steps.length).toBe(GRAPH_4NODE.edges.size)
	})
})
