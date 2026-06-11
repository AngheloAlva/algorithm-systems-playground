/**
 * Unit tests for graph algorithm registry (Unit A7).
 *
 * Scenario G6-A — registry shape, keys, requiresStartNode.
 */

import { describe, it, expect } from "vitest"
import { GRAPH_ALGORITHM_REGISTRY } from "./index"
import { clearGraph, addNode, addEdge } from "../../graph/graph"

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

function buildLinearGraph() {
	let g = clearGraph()
	const ids: string[] = []
	for (let i = 0; i < 3; i++) {
		const r = addNode(g, i * 100, 0, i)
		g = r.graph
		ids.push(r.nodeId)
	}
	const r1 = addEdge(g, ids[0], ids[1])!
	const { graph } = addEdge(r1.graph, ids[1], ids[2])!
	return { graph, ids }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GRAPH_ALGORITHM_REGISTRY (G6-A)", () => {
	it("has keys 'bfs', 'dfs', and 'cycle'", () => {
		expect(Object.keys(GRAPH_ALGORITHM_REGISTRY)).toContain("bfs")
		expect(Object.keys(GRAPH_ALGORITHM_REGISTRY)).toContain("dfs")
		expect(Object.keys(GRAPH_ALGORITHM_REGISTRY)).toContain("cycle")
	})

	it("each entry has required shape fields", () => {
		for (const entry of Object.values(GRAPH_ALGORITHM_REGISTRY)) {
			expect(typeof entry.id).toBe("string")
			expect(typeof entry.label).toBe("string")
			expect(typeof entry.run).toBe("function")
			expect(Array.isArray(entry.pseudocode)).toBe(true)
			expect(typeof entry.requiresStartNode).toBe("boolean")
		}
	})

	it("bfs.requiresStartNode === true", () => {
		expect(GRAPH_ALGORITHM_REGISTRY["bfs"].requiresStartNode).toBe(true)
	})

	it("dfs.requiresStartNode === true", () => {
		expect(GRAPH_ALGORITHM_REGISTRY["dfs"].requiresStartNode).toBe(true)
	})

	it("each entry's pseudocode covers all emitted line indices", () => {
		const { graph, ids } = buildLinearGraph()
		for (const entry of Object.values(GRAPH_ALGORITHM_REGISTRY)) {
			const result = entry.run(graph, ids[0])
			const maxLine = Math.max(-1, ...result.steps.map((s) => s.line))
			expect(entry.pseudocode.length).toBeGreaterThan(maxLine)
		}
	})

	it("each entry's id matches its registry key", () => {
		for (const [key, entry] of Object.entries(GRAPH_ALGORITHM_REGISTRY)) {
			expect(entry.id).toBe(key)
		}
	})

	it("cycle.requiresStartNode === false (whole-graph multi-source DFS)", () => {
		expect(GRAPH_ALGORITHM_REGISTRY["cycle"].requiresStartNode).toBe(false)
	})

	it("cycle entry can run on a graph without a startId (empty string)", () => {
		const { graph } = buildLinearGraph()
		// Should not throw and should return valid metrics
		const result = GRAPH_ALGORITHM_REGISTRY["cycle"].run(graph, "")
		expect(result.metrics.cycleDetected).toBe(false)
		expect(typeof result.metrics.backEdgeCount).toBe("number")
	})

	// -------------------------------------------------------------------------
	// PR 2c entries: kruskal, prim
	// -------------------------------------------------------------------------

	it("has keys 'kruskal' and 'prim' (C4)", () => {
		expect(Object.keys(GRAPH_ALGORITHM_REGISTRY)).toContain("kruskal")
		expect(Object.keys(GRAPH_ALGORITHM_REGISTRY)).toContain("prim")
	})

	it("kruskal.requiresStartNode === false", () => {
		expect(GRAPH_ALGORITHM_REGISTRY["kruskal"].requiresStartNode).toBe(false)
	})

	it("prim.requiresStartNode === false", () => {
		// Prim auto-selects the lowest-label node; no explicit start needed
		expect(GRAPH_ALGORITHM_REGISTRY["prim"].requiresStartNode).toBe(false)
	})

	it("kruskal entry runs and returns MST metrics", () => {
		const { graph } = buildLinearGraph()
		const result = GRAPH_ALGORITHM_REGISTRY["kruskal"].run(graph, "")
		expect(typeof result.metrics.mstWeight).toBe("number")
		expect(typeof result.metrics.mstEdgeCount).toBe("number")
	})

	it("prim entry runs and returns MST metrics", () => {
		const { graph } = buildLinearGraph()
		const result = GRAPH_ALGORITHM_REGISTRY["prim"].run(graph, "")
		expect(typeof result.metrics.mstWeight).toBe("number")
		expect(typeof result.metrics.mstEdgeCount).toBe("number")
	})
})
