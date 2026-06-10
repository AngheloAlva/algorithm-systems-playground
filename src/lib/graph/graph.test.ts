/**
 * Unit tests for graph mutation operations (Unit A2).
 *
 * Scenarios: G2-A through G2-H, G1-A (auto-label), Map reactivity invariant.
 */

import { describe, it, expect } from "vitest"
import {
	addNode,
	removeNode,
	moveNode,
	addEdge,
	removeEdge,
	setEdgeWeight,
	toggleDirected,
	clearGraph,
	loadSampleGraph,
	hasEdgeBetween,
	labelFromIndex,
} from "./graph"

// ---------------------------------------------------------------------------
// Utility builders
// ---------------------------------------------------------------------------

/** Build a graph with N nodes and return ids + final graph. */
function buildNodes(
	count: number,
	directed = false
): { graph: ReturnType<typeof clearGraph>; ids: string[] } {
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
// labelFromIndex (G1-A support)
// ---------------------------------------------------------------------------

describe("labelFromIndex", () => {
	it("returns A for index 0", () => {
		expect(labelFromIndex(0)).toBe("A")
	})

	it("returns Z for index 25", () => {
		expect(labelFromIndex(25)).toBe("Z")
	})

	it("returns AA for index 26", () => {
		expect(labelFromIndex(26)).toBe("AA")
	})

	it("returns AB for index 27", () => {
		expect(labelFromIndex(27)).toBe("AB")
	})

	it("returns AZ for index 51", () => {
		expect(labelFromIndex(51)).toBe("AZ")
	})

	it("returns BA for index 52", () => {
		expect(labelFromIndex(52)).toBe("BA")
	})
})

// ---------------------------------------------------------------------------
// G1-A — Auto-label sequence (27 nodes: A..Z, AA)
// ---------------------------------------------------------------------------

describe("addNode auto-label sequence (G1-A)", () => {
	it("produces correct labels for 27 sequential additions", () => {
		let graph = clearGraph()
		let seq = 0
		const labels: string[] = []

		for (let i = 0; i < 27; i++) {
			const result = addNode(graph, 0, 0, seq++)
			graph = result.graph
			labels.push(graph.nodes.get(result.nodeId)!.label)
		}

		expect(labels[0]).toBe("A")
		expect(labels[25]).toBe("Z")
		expect(labels[26]).toBe("AA")
	})
})

// ---------------------------------------------------------------------------
// Map reactivity invariant — EVERY mutation returns new references
// ---------------------------------------------------------------------------

describe("Map reactivity invariant", () => {
	it("addNode returns new GraphData and new nodes Map", () => {
		const g0 = clearGraph()
		const { graph: g1 } = addNode(g0, 10, 20, 0)
		expect(g1).not.toBe(g0)
		expect(g1.nodes).not.toBe(g0.nodes)
	})

	it("removeNode returns new GraphData and new nodes/edges Maps", () => {
		const g0 = clearGraph()
		const { graph: g1, nodeId } = addNode(g0, 10, 20, 0)
		const g2 = removeNode(g1, nodeId)
		expect(g2).not.toBe(g1)
		expect(g2.nodes).not.toBe(g1.nodes)
	})

	it("addEdge returns new GraphData and new edges Map", () => {
		const { graph: g2, ids } = buildNodes(2)
		const result = addEdge(g2, ids[0], ids[1])
		expect(result).not.toBeNull()
		const g3 = result!.graph
		expect(g3).not.toBe(g2)
		expect(g3.edges).not.toBe(g2.edges)
	})

	it("moveNode returns new GraphData and new nodes Map", () => {
		const g0 = clearGraph()
		const { graph: g1, nodeId } = addNode(g0, 0, 0, 0)
		const g2 = moveNode(g1, nodeId, 50, 50)
		expect(g2).not.toBe(g1)
		expect(g2.nodes).not.toBe(g1.nodes)
	})

	it("toggleDirected returns new GraphData (edges Map may be shared)", () => {
		const g0 = clearGraph()
		const g1 = toggleDirected(g0)
		expect(g1).not.toBe(g0)
	})

	it("removeEdge returns new GraphData and new edges Map", () => {
		const { graph: g2, ids } = buildNodes(2)
		const { graph: g3, edgeId: e1 } = addEdge(g2, ids[0], ids[1])!
		const g4 = removeEdge(g3, e1)
		expect(g4).not.toBe(g3)
		expect(g4.edges).not.toBe(g3.edges)
	})

	it("setEdgeWeight returns new GraphData and new edges Map", () => {
		const { graph: g2, ids } = buildNodes(2)
		const { graph: g3, edgeId: e1 } = addEdge(g2, ids[0], ids[1])!
		const g4 = setEdgeWeight(g3, e1, 7)
		expect(g4).not.toBe(g3)
		expect(g4.edges).not.toBe(g3.edges)
	})
})

// ---------------------------------------------------------------------------
// G2-A — deleteNode cascades edges
// ---------------------------------------------------------------------------

describe("removeNode (G2-A)", () => {
	it("removes node and all incident edges, preserves non-incident edges", () => {
		const { graph: g3, ids } = buildNodes(3)
		const n1 = ids[0]
		const n2 = ids[1]
		const n3 = ids[2]

		const r1 = addEdge(g3, n1, n2)! // n1→n2
		const r2 = addEdge(r1.graph, n2, n3)! // n2→n3
		const r3 = addEdge(r2.graph, n1, n3)! // n1→n3
		const e1 = r1.edgeId
		const e2 = r2.edgeId
		const e3 = r3.edgeId

		const g7 = removeNode(r3.graph, n2) // delete n2, should cascade e1 and e2

		expect(g7.nodes.size).toBe(2)
		expect(g7.nodes.has(n1)).toBe(true)
		expect(g7.nodes.has(n3)).toBe(true)
		expect(g7.nodes.has(n2)).toBe(false)

		expect(g7.edges.has(e1)).toBe(false) // incident to n2
		expect(g7.edges.has(e2)).toBe(false) // incident to n2
		expect(g7.edges.has(e3)).toBe(true) // not incident to n2
	})

	it("is a no-op for unknown node id", () => {
		const g0 = clearGraph()
		const { graph: g1 } = addNode(g0, 0, 0, 0)
		const g2 = removeNode(g1, "unknown-id")
		expect(g2.nodes.size).toBe(g1.nodes.size)
	})
})

// ---------------------------------------------------------------------------
// G2-B — Self-loop rejection
// ---------------------------------------------------------------------------

describe("addEdge self-loop rejection (G2-B)", () => {
	it("returns null when source === target", () => {
		const g0 = clearGraph()
		const { graph: g1, nodeId: n1 } = addNode(g0, 0, 0, 0)
		const result = addEdge(g1, n1, n1)
		expect(result).toBeNull()
		expect(g1.edges.size).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// G2-C — Parallel-edge rejection (directed)
// ---------------------------------------------------------------------------

describe("addEdge parallel-edge rejection directed (G2-C)", () => {
	it("rejects duplicate directed edge n1→n2", () => {
		const { graph: gBase, ids } = buildNodes(2, true)
		const n1 = ids[0]
		const n2 = ids[1]

		const r1 = addEdge(gBase, n1, n2)
		expect(r1).not.toBeNull()
		const g2 = r1!.graph

		const r2 = addEdge(g2, n1, n2)
		expect(r2).toBeNull()
		expect(g2.edges.size).toBe(1)
	})

	it("allows reverse edge n2→n1 in directed mode", () => {
		const { graph: gBase, ids } = buildNodes(2, true)
		const n1 = ids[0]
		const n2 = ids[1]

		const r1 = addEdge(gBase, n1, n2)!
		const r2 = addEdge(r1.graph, n2, n1)
		expect(r2).not.toBeNull()
		expect(r2!.graph.edges.size).toBe(2)
	})
})

// ---------------------------------------------------------------------------
// G2-D — Parallel-edge rejection (undirected, reversed pair)
// ---------------------------------------------------------------------------

describe("addEdge parallel-edge rejection undirected (G2-D)", () => {
	it("rejects reversed pair in undirected mode", () => {
		const { graph: gBase, ids } = buildNodes(2) // directed: false
		const n1 = ids[0]
		const n2 = ids[1]

		const r1 = addEdge(gBase, n1, n2)!
		const r2 = addEdge(r1.graph, n2, n1) // reversed
		expect(r2).toBeNull()
		expect(r1.graph.edges.size).toBe(1)
	})
})

// ---------------------------------------------------------------------------
// G2-E — toggleDirected preserves edges
// ---------------------------------------------------------------------------

describe("toggleDirected (G2-E)", () => {
	it("flips directed flag without changing edges", () => {
		const { graph: g3, ids } = buildNodes(3)
		const r1 = addEdge(g3, ids[0], ids[1])!
		const r2 = addEdge(r1.graph, ids[1], ids[2])!
		const g2 = r2.graph

		expect(g2.directed).toBe(false)
		expect(g2.edges.size).toBe(2)

		const g3t = toggleDirected(g2)
		expect(g3t.directed).toBe(true)
		expect(g3t.edges.size).toBe(2)

		// Same edge ids and weights
		g2.edges.forEach((edge) => {
			const toggled = g3t.edges.get(edge.id)
			expect(toggled).toBeDefined()
			expect(toggled!.weight).toBe(edge.weight)
		})
	})
})

// ---------------------------------------------------------------------------
// G2-F — loadSampleGraph is deterministic
// ---------------------------------------------------------------------------

describe("loadSampleGraph (G2-F)", () => {
	it("returns consistent structure on repeated calls", () => {
		const g1 = loadSampleGraph()
		const g2 = loadSampleGraph()

		expect(g1.nodes.size).toBe(g2.nodes.size)
		expect(g1.edges.size).toBe(g2.edges.size)
		expect(g1.nodes.size).toBeGreaterThanOrEqual(5)
		expect(g1.edges.size).toBeGreaterThanOrEqual(6)
		expect(g1.directed).toBe(false)

		const labels1 = [...g1.nodes.values()].map((n) => n.label).sort()
		const labels2 = [...g2.nodes.values()].map((n) => n.label).sort()
		expect(labels1).toEqual(labels2)
	})

	it("has at least one cycle (edges.size >= nodes.size for undirected)", () => {
		const g = loadSampleGraph()
		expect(g.edges.size).toBeGreaterThanOrEqual(g.nodes.size)
	})
})

// ---------------------------------------------------------------------------
// G2-G — Soft cap at 50 nodes
// ---------------------------------------------------------------------------

describe("addNode soft cap (G2-G)", () => {
	it("does not add node when nodes.size >= 50", () => {
		let g = clearGraph()
		for (let i = 0; i < 50; i++) {
			const r = addNode(g, i * 10, 0, i)
			g = r.graph
		}
		expect(g.nodes.size).toBe(50)

		const result = addNode(g, 999, 999, 50)
		expect(result.graph.nodes.size).toBe(50)
		expect(result.graph).toBe(g) // same reference (no-op)
	})
})

// ---------------------------------------------------------------------------
// G2-H — setEdgeWeight rejects non-positive
// ---------------------------------------------------------------------------

describe("setEdgeWeight (G2-H)", () => {
	it("updates weight when positive", () => {
		const { graph: gBase, ids } = buildNodes(2)
		const { graph: g, edgeId: e1 } = addEdge(gBase, ids[0], ids[1])!
		const g2 = setEdgeWeight(g, e1, 5)
		expect(g2.edges.get(e1)!.weight).toBe(5)
	})

	it("rejects weight of 0", () => {
		const { graph: gBase, ids } = buildNodes(2)
		const { graph: g, edgeId: e1 } = addEdge(gBase, ids[0], ids[1])!
		const initialWeight = g.edges.get(e1)!.weight
		const g2 = setEdgeWeight(g, e1, 0)
		expect(g2.edges.get(e1)!.weight).toBe(initialWeight)
		expect(g2).toBe(g)
	})

	it("rejects negative weight", () => {
		const { graph: gBase, ids } = buildNodes(2)
		const { graph: g, edgeId: e1 } = addEdge(gBase, ids[0], ids[1])!
		const initialWeight = g.edges.get(e1)!.weight
		const g2 = setEdgeWeight(g, e1, -5)
		expect(g2.edges.get(e1)!.weight).toBe(initialWeight)
	})
})

// ---------------------------------------------------------------------------
// G1-C — Default weight
// ---------------------------------------------------------------------------

describe("addEdge default weight (G1-C)", () => {
	it("defaults weight to 1 when not supplied", () => {
		const { graph: gBase, ids } = buildNodes(2)
		const result = addEdge(gBase, ids[0], ids[1])
		expect(result).not.toBeNull()
		expect(result!.graph.edges.get(result!.edgeId)!.weight).toBe(1)
	})
})

// ---------------------------------------------------------------------------
// removeEdge
// ---------------------------------------------------------------------------

describe("removeEdge", () => {
	it("removes the specified edge", () => {
		const { graph: gBase, ids } = buildNodes(2)
		const { graph: g, edgeId: e1 } = addEdge(gBase, ids[0], ids[1])!
		const g2 = removeEdge(g, e1)
		expect(g2.edges.has(e1)).toBe(false)
		expect(g2.nodes.size).toBe(2)
	})

	it("is a no-op for unknown edge id", () => {
		const g0 = clearGraph()
		const g1 = removeEdge(g0, "unknown-edge")
		expect(g1.edges.size).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// hasEdgeBetween
// ---------------------------------------------------------------------------

describe("hasEdgeBetween", () => {
	it("returns true for existing directed edge a→b", () => {
		const { graph: gBase, ids } = buildNodes(2, true)
		const { graph: g } = addEdge(gBase, ids[0], ids[1])!
		expect(hasEdgeBetween(g, ids[0], ids[1])).toBe(true)
		expect(hasEdgeBetween(g, ids[1], ids[0])).toBe(false)
	})

	it("returns true for either direction in undirected mode", () => {
		const { graph: gBase, ids } = buildNodes(2)
		const { graph: g } = addEdge(gBase, ids[0], ids[1])!
		expect(hasEdgeBetween(g, ids[0], ids[1])).toBe(true)
		expect(hasEdgeBetween(g, ids[1], ids[0])).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// clearGraph
// ---------------------------------------------------------------------------

describe("clearGraph", () => {
	it("returns empty graph with directed: false", () => {
		const g = clearGraph()
		expect(g.nodes.size).toBe(0)
		expect(g.edges.size).toBe(0)
		expect(g.directed).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// G1-B — Node ids are never recycled after deletion
// ---------------------------------------------------------------------------

describe("addNode stable id after delete (G1-B)", () => {
	it("new node id is not equal to a previously deleted node id", () => {
		const g0 = clearGraph()
		const { graph: g1, nodeId: deletedId } = addNode(g0, 0, 0, 0)
		const g2 = removeNode(g1, deletedId)
		const { nodeId: newId } = addNode(g2, 50, 50, 1)
		expect(newId).not.toBe(deletedId)
	})
})
