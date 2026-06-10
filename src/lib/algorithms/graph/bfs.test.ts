/**
 * Unit tests for BFS graph traversal (Unit A5).
 *
 * Scenarios: G4-A through G4-D.
 */

import { describe, it, expect } from "vitest"
import { runBFS, BFS_PSEUDOCODE } from "./bfs"
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

/** Build undirected path A—B—C */
function buildLinearGraph() {
	const { graph: g3, ids } = buildNodes(3)
	const r1 = addEdge(g3, ids[0], ids[1])!
	const r2 = addEdge(r1.graph, ids[1], ids[2])!
	return { g: r2.graph, nA: ids[0], nB: ids[1], nC: ids[2] }
}

// ---------------------------------------------------------------------------
// G4-A — BFS on simple path A-B-C
// ---------------------------------------------------------------------------

describe("runBFS (G4-A)", () => {
	it("emits frontier(A), visit(A), frontier(B), visit(B), frontier(C), visit(C) in order", () => {
		const { g, nA, nB, nC } = buildLinearGraph()
		const result = runBFS(g, nA)

		const nodeSteps = result.steps
			.filter((s) => s.kind === "frontier" || s.kind === "visit")
			.map((s) => ({ kind: s.kind, nodeId: "nodeId" in s ? s.nodeId : undefined }))

		expect(nodeSteps[0]).toEqual({ kind: "frontier", nodeId: nA })
		expect(nodeSteps[1]).toEqual({ kind: "visit", nodeId: nA })
		expect(nodeSteps[2]).toEqual({ kind: "frontier", nodeId: nB })
		expect(nodeSteps[3]).toEqual({ kind: "visit", nodeId: nB })
		expect(nodeSteps[4]).toEqual({ kind: "frontier", nodeId: nC })
		expect(nodeSteps[5]).toEqual({ kind: "visit", nodeId: nC })

		expect(result.metrics.visitedCount).toBe(3)
		expect(result.metrics.traversalOrder).toEqual([nA, nB, nC])
	})
})

// ---------------------------------------------------------------------------
// G4-B — BFS respects directed edges
// ---------------------------------------------------------------------------

describe("runBFS (G4-B)", () => {
	it("visits all reachable nodes in directed graph A→B, A→C, C→B", () => {
		const { graph: g3, ids } = buildNodes(3, true)
		const r1 = addEdge(g3, ids[0], ids[1])!
		const r2 = addEdge(r1.graph, ids[0], ids[2])!
		const r3 = addEdge(r2.graph, ids[2], ids[1])!

		const result = runBFS(r3.graph, ids[0])
		expect(result.metrics.visitedCount).toBe(3)
		expect(result.metrics.traversalOrder).toContain(ids[0])
		expect(result.metrics.traversalOrder).toContain(ids[1])
		expect(result.metrics.traversalOrder).toContain(ids[2])
	})
})

// ---------------------------------------------------------------------------
// G4-C — BFS disconnected graph
// ---------------------------------------------------------------------------

describe("runBFS (G4-C)", () => {
	it("only visits reachable nodes; does not throw for unreachable nodes", () => {
		const { graph: g3, ids } = buildNodes(3)
		const { graph: g } = addEdge(g3, ids[0], ids[1])! // ids[2] isolated

		const result = runBFS(g, ids[0])
		expect(result.metrics.visitedCount).toBe(2)
		expect(result.metrics.traversalOrder).not.toContain(ids[2])
	})
})

// ---------------------------------------------------------------------------
// G4-D — BFS deterministic ordering
// ---------------------------------------------------------------------------

describe("runBFS (G4-D)", () => {
	it("enqueues B before C when both are neighbors of A (label sort)", () => {
		const { graph: g3, ids } = buildNodes(3)
		const nA = ids[0]
		const nB = ids[1]
		const nC = ids[2]

		// Add in non-alphabetical order: A→C first, then A→B
		const r1 = addEdge(g3, nA, nC)!
		const { graph: g } = addEdge(r1.graph, nA, nB)!

		const result = runBFS(g, nA)
		expect(result.metrics.traversalOrder[0]).toBe(nA)
		expect(result.metrics.traversalOrder[1]).toBe(nB) // B < C label sort
		expect(result.metrics.traversalOrder[2]).toBe(nC)
	})

	it("is deterministic — same result on two identical runs", () => {
		const { g, nA } = buildLinearGraph()
		const r1 = runBFS(g, nA)
		const r2 = runBFS(g, nA)
		expect(r1.metrics.traversalOrder).toEqual(r2.metrics.traversalOrder)
	})
})

// ---------------------------------------------------------------------------
// step.line validity
// ---------------------------------------------------------------------------

describe("runBFS step.line", () => {
	it("all step.line values are valid indices into BFS_PSEUDOCODE", () => {
		const { g, nA } = buildLinearGraph()
		const result = runBFS(g, nA)
		for (const step of result.steps) {
			expect(step.line).toBeGreaterThanOrEqual(0)
			expect(step.line).toBeLessThan(BFS_PSEUDOCODE.length)
		}
	})
})
