/**
 * Unit tests for adjacency builder (Unit A3).
 */

import { describe, it, expect } from "vitest"
import { buildAdjacency } from "./adjacency"
import { clearGraph, addNode, addEdge, toggleDirected } from "./graph"

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
// Tests
// ---------------------------------------------------------------------------

describe("buildAdjacency — undirected graph", () => {
	it("builds bidirectional neighbors", () => {
		const { graph: g2, ids } = buildNodes(2)
		const r = addEdge(g2, ids[0], ids[1])!
		const adj = buildAdjacency(r.graph)

		const n1Neighbors = adj.get(ids[0])!
		expect(n1Neighbors.length).toBe(1)
		expect(n1Neighbors[0].to).toBe(ids[1])
		expect(n1Neighbors[0].edgeId).toBe(r.edgeId)
		expect(n1Neighbors[0].weight).toBe(1)

		const n2Neighbors = adj.get(ids[1])!
		expect(n2Neighbors.length).toBe(1)
		expect(n2Neighbors[0].to).toBe(ids[0])
	})

	it("returns empty array for isolated node", () => {
		const g0 = clearGraph()
		const { graph: g1, nodeId } = addNode(g0, 0, 0, 0)
		const adj = buildAdjacency(g1)
		expect(adj.get(nodeId)).toEqual([])
	})
})

describe("buildAdjacency — directed graph", () => {
	it("only adds forward edges", () => {
		const { graph: g2, ids } = buildNodes(2, true)
		const { graph: g } = addEdge(g2, ids[0], ids[1])!
		const adj = buildAdjacency(g)

		expect(adj.get(ids[0])!.length).toBe(1)
		expect(adj.get(ids[0])![0].to).toBe(ids[1])
		expect(adj.get(ids[1])!.length).toBe(0)
	})
})

describe("buildAdjacency — neighbor sorting", () => {
	it("sorts neighbors by node label ascending (ADR-4)", () => {
		// 3 nodes: A, B, C — connect A to C first, then A to B
		const { graph: g3, ids } = buildNodes(3)
		const nA = ids[0]
		const nB = ids[1]
		const nC = ids[2]

		const r1 = addEdge(g3, nA, nC)! // A→C first
		const r2 = addEdge(r1.graph, nA, nB)! // A→B second

		const adj = buildAdjacency(r2.graph)
		const aNeighbors = adj.get(nA)!

		expect(aNeighbors.length).toBe(2)
		expect(aNeighbors[0].to).toBe(nB) // B before C (label sort)
		expect(aNeighbors[1].to).toBe(nC)
	})
})
