/**
 * Unit tests for DFS graph traversal (Unit A6).
 *
 * Scenarios: G5-A through G5-C.
 */

import { describe, it, expect } from "vitest"
import { runDFS, DFS_PSEUDOCODE } from "./dfs"
import { clearGraph, addNode, addEdge, toggleDirected } from "../../graph/graph"

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

function buildNodes(count: number, directed = false) {
	let g = clearGraph()
	if (directed) g = toggleDirected(g)
	const ids: string[] = []
	for (let i = 0; i < count; i++) {
		const r = addNode(g, i * 100, 0, i)
		g = r.graph
		ids.push(r.nodeId)
	}
	return { graph: g, ids }
}

// ---------------------------------------------------------------------------
// G5-A — DFS on simple path A-B-C
// ---------------------------------------------------------------------------

describe("runDFS (G5-A)", () => {
	it("visits A, B, C in depth-first label-sorted order", () => {
		const { graph: g3, ids } = buildNodes(3)
		const r1 = addEdge(g3, ids[0], ids[1])!
		const { graph: g } = addEdge(r1.graph, ids[1], ids[2])!

		const result = runDFS(g, ids[0])
		expect(result.metrics.traversalOrder).toEqual([ids[0], ids[1], ids[2]])
		expect(result.metrics.visitedCount).toBe(3)
	})
})

// ---------------------------------------------------------------------------
// G5-B — DFS respects directed edges
// ---------------------------------------------------------------------------

describe("runDFS (G5-B)", () => {
	it("reaches D only via B in directed graph A→B, A→C, B→D", () => {
		const { graph: g4, ids } = buildNodes(4, true)
		const r1 = addEdge(g4, ids[0], ids[1])!
		const r2 = addEdge(r1.graph, ids[0], ids[2])!
		const { graph: g } = addEdge(r2.graph, ids[1], ids[3])!

		const result = runDFS(g, ids[0])
		expect(result.metrics.traversalOrder).toContain(ids[3])
		expect(result.metrics.visitedCount).toBe(4)
	})
})

// ---------------------------------------------------------------------------
// G5-C — DFS disconnected graph
// ---------------------------------------------------------------------------

describe("runDFS (G5-C)", () => {
	it("only visits nodes in start component", () => {
		const { graph: g4, ids } = buildNodes(4)
		const r1 = addEdge(g4, ids[0], ids[1])! // component 1
		const { graph: g } = addEdge(r1.graph, ids[2], ids[3])! // component 2

		const result = runDFS(g, ids[0])
		expect(result.metrics.traversalOrder).toContain(ids[0])
		expect(result.metrics.traversalOrder).toContain(ids[1])
		expect(result.metrics.traversalOrder).not.toContain(ids[2])
		expect(result.metrics.traversalOrder).not.toContain(ids[3])
	})
})

// ---------------------------------------------------------------------------
// Stack-based iterative with reverse-push convention
// ---------------------------------------------------------------------------

describe("runDFS — reverse-push convention (G5.4)", () => {
	it("pushes neighbors in reverse sorted order so smallest-label is popped first", () => {
		const { graph: g3, ids } = buildNodes(3)
		const nA = ids[0]
		const nB = ids[1]
		const nC = ids[2]

		// Add C first, then B — ordering should be by label not insertion
		const r1 = addEdge(g3, nA, nC)!
		const { graph: g } = addEdge(r1.graph, nA, nB)!

		const result = runDFS(g, nA)
		const order = result.metrics.traversalOrder
		const bIdx = order.indexOf(nB)
		const cIdx = order.indexOf(nC)
		expect(bIdx).toBeLessThan(cIdx)
	})
})

// ---------------------------------------------------------------------------
// Frontier / visit step sequence
// ---------------------------------------------------------------------------

describe("runDFS step kinds", () => {
	it("emits frontier on push and visit on pop", () => {
		const { graph: g2, ids } = buildNodes(2)
		const { graph: g } = addEdge(g2, ids[0], ids[1])!

		const result = runDFS(g, ids[0])
		const kinds = result.steps.map((s) => s.kind)
		expect(kinds).toContain("frontier")
		expect(kinds).toContain("visit")
	})
})

// ---------------------------------------------------------------------------
// step.line validity
// ---------------------------------------------------------------------------

describe("runDFS step.line", () => {
	it("all step.line values are valid indices into DFS_PSEUDOCODE", () => {
		const { graph: g2, ids } = buildNodes(2)
		const { graph: g } = addEdge(g2, ids[0], ids[1])!

		const result = runDFS(g, ids[0])
		for (const step of result.steps) {
			expect(step.line).toBeGreaterThanOrEqual(0)
			expect(step.line).toBeLessThan(DFS_PSEUDOCODE.length)
		}
	})
})
