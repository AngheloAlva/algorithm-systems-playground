/**
 * Unit tests for adjacency builder (Unit A3).
 */

import { describe, it, expect } from "vitest"
import { buildAdjacency } from "./adjacency"
import { clearGraph, addNode, addEdge, toggleDirected } from "./graph"

describe("buildAdjacency — undirected graph", () => {
	it("builds bidirectional neighbors", () => {
		let g = clearGraph()
		let n1: string, n2: string, e1: string
		;({ graph: g, nodeId: n1 } = addNode(g, 0, 0, 0)) // A
		;({ graph: g, nodeId: n2 } = addNode(g, 100, 0, 1)) // B
		;({ graph: g, edgeId: e1 } = addEdge(g, n1, n2)!)

		const adj = buildAdjacency(g)

		// n1's neighbors include n2
		const n1Neighbors = adj.get(n1)!
		expect(n1Neighbors.length).toBe(1)
		expect(n1Neighbors[0].to).toBe(n2)
		expect(n1Neighbors[0].edgeId).toBe(e1)
		expect(n1Neighbors[0].weight).toBe(1)

		// n2's neighbors include n1 (undirected — both directions)
		const n2Neighbors = adj.get(n2)!
		expect(n2Neighbors.length).toBe(1)
		expect(n2Neighbors[0].to).toBe(n1)
		expect(n2Neighbors[0].edgeId).toBe(e1)
	})

	it("returns empty array for isolated node", () => {
		let g = clearGraph()
		let n1: string
		;({ graph: g, nodeId: n1 } = addNode(g, 0, 0, 0))

		const adj = buildAdjacency(g)
		expect(adj.get(n1)).toEqual([])
	})
})

describe("buildAdjacency — directed graph", () => {
	it("only adds forward edges", () => {
		let g = toggleDirected(clearGraph())
		let n1: string, n2: string
		;({ graph: g, nodeId: n1 } = addNode(g, 0, 0, 0))
		;({ graph: g, nodeId: n2 } = addNode(g, 100, 0, 1))
		;({ graph: g } = addEdge(g, n1, n2)!)

		const adj = buildAdjacency(g)

		expect(adj.get(n1)!.length).toBe(1)
		expect(adj.get(n1)![0].to).toBe(n2)
		expect(adj.get(n2)!.length).toBe(0) // no reverse edge in directed mode
	})
})

describe("buildAdjacency — neighbor sorting", () => {
	it("sorts neighbors by node label ascending (ADR-4)", () => {
		// Create nodes with labels A, B, C and connect all to A
		// Graph: A—B, A—C
		let g = clearGraph()
		let nA: string, nB: string, nC: string
		;({ graph: g, nodeId: nA } = addNode(g, 0, 0, 0)) // label A
		;({ graph: g, nodeId: nB } = addNode(g, 100, 0, 1)) // label B
		;({ graph: g, nodeId: nC } = addNode(g, 200, 0, 2)) // label C

		// Add in non-alphabetical order: A→C first, then A→B
		;({ graph: g } = addEdge(g, nA, nC)!)
		;({ graph: g } = addEdge(g, nA, nB)!)

		const adj = buildAdjacency(g)
		const aNeighbors = adj.get(nA)!

		expect(aNeighbors.length).toBe(2)
		expect(aNeighbors[0].to).toBe(nB) // B comes before C
		expect(aNeighbors[1].to).toBe(nC)
	})
})
