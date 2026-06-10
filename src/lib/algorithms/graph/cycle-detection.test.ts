/**
 * Unit tests for cycle detection algorithm (Unit B1).
 *
 * Scenarios: G13-A through G13-E plus additional edge cases.
 *
 * IMPORTANT: This implementation uses WHOLE-GRAPH multi-source DFS
 * (requiresStartNode: false), iterating over all nodes as potential DFS
 * roots. This is an orchestrator-level override from the spec's G13.1
 * which described a single-source variant.
 */

import { describe, it, expect } from "vitest"
import { runCycleDetection, CYCLE_DETECTION_PSEUDOCODE } from "./cycle-detection"
import { clearGraph, addNode, addEdge, toggleDirected } from "../../graph/graph"
import type { BackEdgeStep, TreeEdgeStep } from "../../graph/types"

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

function buildUndirected(edgeList: Array<[number, number]>, nodeCount: number) {
	let g = clearGraph()
	const ids: string[] = []
	for (let i = 0; i < nodeCount; i++) {
		const r = addNode(g, i * 100, 0, i)
		g = r.graph
		ids.push(r.nodeId)
	}
	for (const [a, b] of edgeList) {
		const r = addEdge(g, ids[a], ids[b])
		if (r) g = r.graph
	}
	return { graph: g, ids }
}

function buildDirected(edgeList: Array<[number, number]>, nodeCount: number) {
	let g = toggleDirected(clearGraph())
	const ids: string[] = []
	for (let i = 0; i < nodeCount; i++) {
		const r = addNode(g, i * 100, 0, i)
		g = r.graph
		ids.push(r.nodeId)
	}
	for (const [a, b] of edgeList) {
		const r = addEdge(g, ids[a], ids[b])
		if (r) g = r.graph
	}
	return { graph: g, ids }
}

// ---------------------------------------------------------------------------
// G13-A — Cycle in undirected graph (triangle)
// ---------------------------------------------------------------------------

describe("runCycleDetection (G13-A) — undirected cycle", () => {
	it("detects a cycle in an undirected triangle A-B-C", () => {
		// A—B, B—C, C—A
		const { graph, ids } = buildUndirected([[0, 1], [1, 2], [2, 0]], 3)
		const result = runCycleDetection(graph, "")

		const backEdgeSteps = result.steps.filter((s) => s.kind === "back-edge")
		expect(backEdgeSteps.length).toBeGreaterThanOrEqual(1)
		expect(result.metrics.cycleDetected).toBe(true)
		expect(result.metrics.backEdgeCount).toBeGreaterThanOrEqual(1)

		// Every back-edge step must have a valid edgeId referencing a real edge
		for (const step of backEdgeSteps) {
			const s = step as BackEdgeStep
			expect(graph.edges.has(s.edgeId)).toBe(true)
		}
	})
})

// ---------------------------------------------------------------------------
// G13-B — No cycle in undirected tree
// ---------------------------------------------------------------------------

describe("runCycleDetection (G13-B) — undirected tree", () => {
	it("emits no back-edge steps for an undirected tree A-B, A-C, B-D", () => {
		// 4 nodes: A=0, B=1, C=2, D=3 ; edges: A-B, A-C, B-D
		const { graph } = buildUndirected([[0, 1], [0, 2], [1, 3]], 4)
		const result = runCycleDetection(graph, "")

		const backEdgeSteps = result.steps.filter((s) => s.kind === "back-edge")
		expect(backEdgeSteps).toHaveLength(0)
		expect(result.metrics.cycleDetected).toBe(false)
		expect(result.metrics.backEdgeCount).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// G13-C — Directed cycle
// ---------------------------------------------------------------------------

describe("runCycleDetection (G13-C) — directed cycle", () => {
	it("detects a directed cycle A→B→C→A", () => {
		// 3 nodes: A=0, B=1, C=2 ; edges: A→B, B→C, C→A
		const { graph, ids } = buildDirected([[0, 1], [1, 2], [2, 0]], 3)
		const result = runCycleDetection(graph, "")

		const backEdgeSteps = result.steps.filter((s) => s.kind === "back-edge")
		expect(backEdgeSteps.length).toBeGreaterThanOrEqual(1)
		expect(result.metrics.cycleDetected).toBe(true)

		// The back-edge should be from C to A (the edge that closes the cycle)
		const cycleClosingEdge = backEdgeSteps.find((s) => {
			const bes = s as BackEdgeStep
			return bes.toId === ids[0] // to node A
		})
		expect(cycleClosingEdge).toBeDefined()
	})
})

// ---------------------------------------------------------------------------
// G13-D — Directed DAG — no false positive on forward/cross edges
// ---------------------------------------------------------------------------

describe("runCycleDetection (G13-D) — directed DAG", () => {
	it("does not emit back-edge steps for a DAG A→B, A→C, B→D, C→D", () => {
		// Diamond DAG — D is reachable from both B and C; C→D is a cross edge, NOT a back-edge
		const { graph } = buildDirected([[0, 1], [0, 2], [1, 3], [2, 3]], 4)
		const result = runCycleDetection(graph, "")

		const backEdgeSteps = result.steps.filter((s) => s.kind === "back-edge")
		expect(backEdgeSteps).toHaveLength(0)
		expect(result.metrics.cycleDetected).toBe(false)
		expect(result.metrics.backEdgeCount).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// G13-E — Undirected parent-edge not treated as cycle
// ---------------------------------------------------------------------------

describe("runCycleDetection (G13-E) — undirected parent edge not a cycle", () => {
	it("does not emit back-edge for the edge back to the DFS parent in A—B—C", () => {
		const { graph } = buildUndirected([[0, 1], [1, 2]], 3)
		const result = runCycleDetection(graph, "")

		const backEdgeSteps = result.steps.filter((s) => s.kind === "back-edge")
		expect(backEdgeSteps).toHaveLength(0)
		expect(result.metrics.cycleDetected).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Multi-component: cycle in one component, none in another
// ---------------------------------------------------------------------------

describe("runCycleDetection — disconnected graph, cycle in one component only", () => {
	it("detects cycle in the cyclic component but not in the tree component", () => {
		// Component 1: triangle A=0, B=1, C=2 (has cycle)
		// Component 2: path D=3—E=4 (no cycle)
		const { graph } = buildUndirected([[0, 1], [1, 2], [2, 0], [3, 4]], 5)
		const result = runCycleDetection(graph, "")

		expect(result.metrics.cycleDetected).toBe(true)
		// An undirected triangle produces ≥ 1 back-edge(s) during DFS
		// (DFS may see the same cycle from multiple directions)
		expect(result.metrics.backEdgeCount).toBeGreaterThanOrEqual(1)

		// Both components should be visited (multi-source)
		const visitedNodeIds = result.steps
			.filter((s) => s.kind === "visit")
			.map((s) => ("nodeId" in s ? s.nodeId : ""))
		expect(visitedNodeIds.length).toBe(5) // all 5 nodes visited
	})
})

// ---------------------------------------------------------------------------
// Single node — no edges, no cycle
// ---------------------------------------------------------------------------

describe("runCycleDetection — single node", () => {
	it("returns no steps and cycleDetected=false for a single node", () => {
		let g = clearGraph()
		const r = addNode(g, 0, 0, 0)
		g = r.graph
		const result = runCycleDetection(g, "")

		expect(result.metrics.cycleDetected).toBe(false)
		expect(result.metrics.backEdgeCount).toBe(0)
		// Single node gets a visit step
		const visitSteps = result.steps.filter((s) => s.kind === "visit")
		expect(visitSteps).toHaveLength(1)
	})
})

// ---------------------------------------------------------------------------
// Empty graph — no nodes, no cycle
// ---------------------------------------------------------------------------

describe("runCycleDetection — empty graph", () => {
	it("returns empty steps and cycleDetected=false for an empty graph", () => {
		const g = clearGraph()
		const result = runCycleDetection(g, "")

		expect(result.steps).toHaveLength(0)
		expect(result.metrics.cycleDetected).toBe(false)
		expect(result.metrics.backEdgeCount).toBe(0)
		expect(result.metrics.visitedCount).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// tree-edge steps carry valid edgeIds
// ---------------------------------------------------------------------------

describe("runCycleDetection — tree-edge edgeId validity", () => {
	it("every tree-edge step has an edgeId that resolves to a real edge in the graph", () => {
		const { graph } = buildUndirected([[0, 1], [1, 2], [2, 0]], 3)
		const result = runCycleDetection(graph, "")

		const treeEdgeSteps = result.steps.filter((s) => s.kind === "tree-edge")
		expect(treeEdgeSteps.length).toBeGreaterThanOrEqual(1)
		for (const step of treeEdgeSteps) {
			const s = step as TreeEdgeStep
			expect(graph.edges.has(s.edgeId)).toBe(true)
		}
	})
})

// ---------------------------------------------------------------------------
// step.line validity
// ---------------------------------------------------------------------------

describe("runCycleDetection — step.line validity", () => {
	it("all step.line values are valid indices into CYCLE_DETECTION_PSEUDOCODE", () => {
		const { graph } = buildUndirected([[0, 1], [1, 2], [2, 0]], 3)
		const result = runCycleDetection(graph, "")

		for (const step of result.steps) {
			expect(step.line).toBeGreaterThanOrEqual(0)
			expect(step.line).toBeLessThan(CYCLE_DETECTION_PSEUDOCODE.length)
		}
	})
})

// ---------------------------------------------------------------------------
// Multi-source: nodes in separate component get frontier steps
// ---------------------------------------------------------------------------

describe("runCycleDetection — multi-source visits all components", () => {
	it("emits visit steps for nodes in all components (no component skipped)", () => {
		// Two isolated nodes A and B
		let g = clearGraph()
		const r1 = addNode(g, 0, 0, 0)
		g = r1.graph
		const r2 = addNode(g, 100, 0, 1)
		g = r2.graph

		const result = runCycleDetection(g, "")

		const visitedIds = result.steps
			.filter((s) => s.kind === "visit")
			.map((s) => ("nodeId" in s ? s.nodeId : ""))
		expect(visitedIds).toHaveLength(2)
		expect(visitedIds).toContain(r1.nodeId)
		expect(visitedIds).toContain(r2.nodeId)
	})
})
