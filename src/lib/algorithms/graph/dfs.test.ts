/**
 * Unit tests for DFS graph traversal (Unit A6).
 *
 * Scenarios: G5-A through G5-C.
 */

import { describe, it, expect } from "vitest"
import { runDFS, DFS_PSEUDOCODE } from "./dfs"
import { clearGraph, addNode, addEdge, toggleDirected } from "../../graph/graph"

// ---------------------------------------------------------------------------
// G5-A — DFS on simple path A-B-C
// ---------------------------------------------------------------------------

describe("runDFS (G5-A)", () => {
	it("visits A, B, C in depth-first label-sorted order", () => {
		let g = clearGraph()
		let nA: string, nB: string, nC: string
		;({ graph: g, nodeId: nA } = addNode(g, 0, 0, 0))
		;({ graph: g, nodeId: nB } = addNode(g, 100, 0, 1))
		;({ graph: g, nodeId: nC } = addNode(g, 200, 0, 2))
		;({ graph: g } = addEdge(g, nA, nB)!)
		;({ graph: g } = addEdge(g, nB, nC)!)

		const result = runDFS(g, nA)
		expect(result.metrics.traversalOrder).toEqual([nA, nB, nC])
		expect(result.metrics.visitedCount).toBe(3)
	})
})

// ---------------------------------------------------------------------------
// G5-B — DFS respects directed edges
// ---------------------------------------------------------------------------

describe("runDFS (G5-B)", () => {
	it("reaches D only via B in directed graph A→B, A→C, B→D", () => {
		let g = toggleDirected(clearGraph())
		let nA: string, nB: string, nC: string, nD: string
		;({ graph: g, nodeId: nA } = addNode(g, 0, 0, 0)) // A
		;({ graph: g, nodeId: nB } = addNode(g, 100, 0, 1)) // B
		;({ graph: g, nodeId: nC } = addNode(g, 200, 0, 2)) // C
		;({ graph: g, nodeId: nD } = addNode(g, 300, 0, 3)) // D
		;({ graph: g } = addEdge(g, nA, nB)!)
		;({ graph: g } = addEdge(g, nA, nC)!)
		;({ graph: g } = addEdge(g, nB, nD)!)

		const result = runDFS(g, nA)
		expect(result.metrics.traversalOrder).toContain(nD)
		expect(result.metrics.visitedCount).toBe(4)
	})
})

// ---------------------------------------------------------------------------
// G5-C — DFS disconnected graph
// ---------------------------------------------------------------------------

describe("runDFS (G5-C)", () => {
	it("only visits nodes in start component; unreachable nodes absent from trace", () => {
		let g = clearGraph()
		let nA: string, nB: string, nC: string, nD: string
		;({ graph: g, nodeId: nA } = addNode(g, 0, 0, 0)) // component 1
		;({ graph: g, nodeId: nB } = addNode(g, 100, 0, 1)) // component 1
		;({ graph: g, nodeId: nC } = addNode(g, 300, 0, 2)) // component 2
		;({ graph: g, nodeId: nD } = addNode(g, 400, 0, 3)) // component 2
		;({ graph: g } = addEdge(g, nA, nB)!)
		;({ graph: g } = addEdge(g, nC, nD)!)

		const result = runDFS(g, nA)
		expect(result.metrics.traversalOrder).toContain(nA)
		expect(result.metrics.traversalOrder).toContain(nB)
		expect(result.metrics.traversalOrder).not.toContain(nC)
		expect(result.metrics.traversalOrder).not.toContain(nD)
	})
})

// ---------------------------------------------------------------------------
// Stack-based iterative with reverse-push convention
// ---------------------------------------------------------------------------

describe("runDFS — reverse-push convention (G5.4)", () => {
	it("pushes neighbors in reverse sorted order so smallest-label is popped first", () => {
		// A connected to B and C; DFS from A should visit B before C
		let g = clearGraph()
		let nA: string, nB: string, nC: string
		;({ graph: g, nodeId: nA } = addNode(g, 0, 0, 0))
		;({ graph: g, nodeId: nB } = addNode(g, 100, 0, 1))
		;({ graph: g, nodeId: nC } = addNode(g, 200, 0, 2))
		;({ graph: g } = addEdge(g, nA, nC)!) // Add C first
		;({ graph: g } = addEdge(g, nA, nB)!) // Then B

		const result = runDFS(g, nA)
		// B has smaller label — should be visited before C
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
	it("emits frontier on push and visit on pop (when not already visited)", () => {
		let g = clearGraph()
		let nA: string, nB: string
		;({ graph: g, nodeId: nA } = addNode(g, 0, 0, 0))
		;({ graph: g, nodeId: nB } = addNode(g, 100, 0, 1))
		;({ graph: g } = addEdge(g, nA, nB)!)

		const result = runDFS(g, nA)
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
		let g = clearGraph()
		let nA: string, nB: string
		;({ graph: g, nodeId: nA } = addNode(g, 0, 0, 0))
		;({ graph: g, nodeId: nB } = addNode(g, 100, 0, 1))
		;({ graph: g } = addEdge(g, nA, nB)!)

		const result = runDFS(g, nA)
		for (const step of result.steps) {
			expect(step.line).toBeGreaterThanOrEqual(0)
			expect(step.line).toBeLessThan(DFS_PSEUDOCODE.length)
		}
	})
})
