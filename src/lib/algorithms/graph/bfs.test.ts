/**
 * Unit tests for BFS graph traversal (Unit A5).
 *
 * Scenarios: G4-A through G4-D.
 */

import { describe, it, expect } from "vitest"
import { runBFS, BFS_PSEUDOCODE } from "./bfs"
import { clearGraph, addNode, addEdge, toggleDirected } from "../../graph/graph"

// ---------------------------------------------------------------------------
// Helpers to build test graphs
// ---------------------------------------------------------------------------

/** Build a simple undirected path A—B—C and return the graph + node ids. */
function buildLinearGraph() {
	let g = clearGraph()
	let nA: string, nB: string, nC: string
	;({ graph: g, nodeId: nA } = addNode(g, 0, 0, 0)) // label A
	;({ graph: g, nodeId: nB } = addNode(g, 100, 0, 1)) // label B
	;({ graph: g, nodeId: nC } = addNode(g, 200, 0, 2)) // label C
	;({ graph: g } = addEdge(g, nA, nB)!)
	;({ graph: g } = addEdge(g, nB, nC)!)
	return { g, nA, nB, nC }
}

// ---------------------------------------------------------------------------
// G4-A — BFS on simple path A-B-C
// ---------------------------------------------------------------------------

describe("runBFS (G4-A)", () => {
	it("emits frontier(A), visit(A), frontier(B), visit(B), frontier(C), visit(C) in order", () => {
		const { g, nA, nB, nC } = buildLinearGraph()
		const result = runBFS(g, nA)

		const kinds = result.steps.map((s) => s.kind)
		const nodeSteps = result.steps
			.filter((s) => s.kind === "frontier" || s.kind === "visit")
			.map((s) => ({ kind: s.kind, nodeId: "nodeId" in s ? s.nodeId : undefined }))

		// frontier(A), visit(A), frontier(B), visit(B), frontier(C), visit(C)
		expect(nodeSteps[0]).toEqual({ kind: "frontier", nodeId: nA })
		expect(nodeSteps[1]).toEqual({ kind: "visit", nodeId: nA })
		expect(nodeSteps[2]).toEqual({ kind: "frontier", nodeId: nB })
		expect(nodeSteps[3]).toEqual({ kind: "visit", nodeId: nB })
		expect(nodeSteps[4]).toEqual({ kind: "frontier", nodeId: nC })
		expect(nodeSteps[5]).toEqual({ kind: "visit", nodeId: nC })

		expect(result.metrics.visitedCount).toBe(3)
		expect(result.metrics.traversalOrder).toEqual([nA, nB, nC])
		expect(kinds.every((k) => k === "frontier" || k === "visit")).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// G4-B — BFS respects directed edges
// ---------------------------------------------------------------------------

describe("runBFS (G4-B)", () => {
	it("visits all reachable nodes in directed graph A→B, A→C, C→B", () => {
		let g = toggleDirected(clearGraph())
		let nA: string, nB: string, nC: string
		;({ graph: g, nodeId: nA } = addNode(g, 0, 0, 0))
		;({ graph: g, nodeId: nB } = addNode(g, 100, 0, 1))
		;({ graph: g, nodeId: nC } = addNode(g, 200, 0, 2))
		;({ graph: g } = addEdge(g, nA, nB)!)
		;({ graph: g } = addEdge(g, nA, nC)!)
		;({ graph: g } = addEdge(g, nC, nB)!)

		const result = runBFS(g, nA)
		expect(result.metrics.visitedCount).toBe(3)
		expect(result.metrics.traversalOrder).toContain(nA)
		expect(result.metrics.traversalOrder).toContain(nB)
		expect(result.metrics.traversalOrder).toContain(nC)
	})
})

// ---------------------------------------------------------------------------
// G4-C — BFS disconnected graph
// ---------------------------------------------------------------------------

describe("runBFS (G4-C)", () => {
	it("only visits reachable nodes; does not throw for unreachable nodes", () => {
		let g = clearGraph()
		let nA: string, nB: string, nC: string
		;({ graph: g, nodeId: nA } = addNode(g, 0, 0, 0))
		;({ graph: g, nodeId: nB } = addNode(g, 100, 0, 1))
		;({ graph: g, nodeId: nC } = addNode(g, 300, 0, 2)) // isolated
		;({ graph: g } = addEdge(g, nA, nB)!)

		const result = runBFS(g, nA)
		expect(result.metrics.visitedCount).toBe(2)
		expect(result.metrics.traversalOrder).not.toContain(nC)
	})
})

// ---------------------------------------------------------------------------
// G4-D — BFS deterministic ordering
// ---------------------------------------------------------------------------

describe("runBFS (G4-D)", () => {
	it("enqueues B before C when both are neighbors of A (label sort)", () => {
		let g = clearGraph()
		let nA: string, nB: string, nC: string
		;({ graph: g, nodeId: nA } = addNode(g, 0, 0, 0)) // A
		;({ graph: g, nodeId: nB } = addNode(g, 100, 0, 1)) // B
		;({ graph: g, nodeId: nC } = addNode(g, 200, 0, 2)) // C

		// Add edges in non-alphabetical order: A→C first, then A→B
		;({ graph: g } = addEdge(g, nA, nC)!)
		;({ graph: g } = addEdge(g, nA, nB)!)

		const result = runBFS(g, nA)

		// traversalOrder from BFS: A, B, C (B enqueued before C due to label sort)
		expect(result.metrics.traversalOrder[0]).toBe(nA)
		expect(result.metrics.traversalOrder[1]).toBe(nB) // B < C
		expect(result.metrics.traversalOrder[2]).toBe(nC)
	})

	it("is deterministic — same result on two identical runs", () => {
		const { g, nA } = buildLinearGraph()
		const r1 = runBFS(g, nA)
		const r2 = runBFS(g, nA)
		expect(r1.metrics.traversalOrder).toEqual(r2.metrics.traversalOrder)
		expect(r1.steps.map((s) => s.kind)).toEqual(r2.steps.map((s) => s.kind))
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
