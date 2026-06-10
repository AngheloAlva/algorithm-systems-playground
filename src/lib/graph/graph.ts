/**
 * Pure graph mutation functions.
 *
 * Design invariants (ADR-1, design §2):
 * - Every function returns a NEW GraphData with fresh Map instances for mutated collections.
 * - Input is never modified.
 * - No React / DOM imports.
 *
 * labelSeq is passed in by the caller (the store owns the monotonic counter) so GraphData
 * stays a pure serializable topology without embedded counters.
 */

import type { GraphData, GraphNode, GraphEdge } from "./types"

// ---------------------------------------------------------------------------
// labelFromIndex — bijective base-26 sequence A, B, …, Z, AA, AB, …
// ---------------------------------------------------------------------------

/**
 * Converts a 0-based index to a bijective base-26 label.
 *   0 → A, 1 → B, …, 25 → Z, 26 → AA, 27 → AB, …
 */
export function labelFromIndex(index: number): string {
	let label = ""
	let n = index
	while (true) {
		label = String.fromCharCode(65 + (n % 26)) + label
		n = Math.floor(n / 26) - 1
		if (n < 0) break
	}
	return label
}

// ---------------------------------------------------------------------------
// clearGraph
// ---------------------------------------------------------------------------

/** Returns an empty graph with directed: false. */
export function clearGraph(): GraphData {
	return {
		nodes: new Map<string, GraphNode>(),
		edges: new Map<string, GraphEdge>(),
		directed: false,
	}
}

// ---------------------------------------------------------------------------
// addNode
// ---------------------------------------------------------------------------

/** Result type for addNode — returns the new graph and the id of the new node. */
export interface AddNodeResult {
	graph: GraphData
	nodeId: string
}

/**
 * Adds a node at (x, y) with an auto-generated label derived from labelSeq.
 *
 * @param graph    - Input graph (not mutated).
 * @param x        - X coordinate.
 * @param y        - Y coordinate.
 * @param labelSeq - Monotonic counter from the store (determines the label).
 * @returns        - New GraphData + id of the created node.
 *                   If nodes.size >= 50, returns the unchanged graph (soft cap).
 */
export function addNode(graph: GraphData, x: number, y: number, labelSeq: number): AddNodeResult {
	if (graph.nodes.size >= 50) {
		return { graph, nodeId: "" }
	}

	const nodeId = crypto.randomUUID()
	const label = labelFromIndex(labelSeq)
	const node: GraphNode = { id: nodeId, x, y, label }

	const nodes = new Map(graph.nodes)
	nodes.set(nodeId, node)

	return {
		graph: { nodes, edges: graph.edges, directed: graph.directed },
		nodeId,
	}
}

// ---------------------------------------------------------------------------
// removeNode
// ---------------------------------------------------------------------------

/**
 * Removes a node and ALL incident edges (source === nodeId OR target === nodeId).
 * No-op if nodeId not found.
 */
export function removeNode(graph: GraphData, nodeId: string): GraphData {
	if (!graph.nodes.has(nodeId)) {
		return graph
	}

	const nodes = new Map(graph.nodes)
	nodes.delete(nodeId)

	const edges = new Map(graph.edges)
	edges.forEach((edge, edgeId) => {
		if (edge.source === nodeId || edge.target === nodeId) {
			edges.delete(edgeId)
		}
	})

	return { nodes, edges, directed: graph.directed }
}

// ---------------------------------------------------------------------------
// moveNode
// ---------------------------------------------------------------------------

/**
 * Updates the (x, y) position of the specified node.
 * No-op if nodeId not found.
 */
export function moveNode(graph: GraphData, nodeId: string, x: number, y: number): GraphData {
	const node = graph.nodes.get(nodeId)
	if (!node) return graph

	const nodes = new Map(graph.nodes)
	nodes.set(nodeId, { ...node, x, y })

	return { nodes, edges: graph.edges, directed: graph.directed }
}

// ---------------------------------------------------------------------------
// addEdge
// ---------------------------------------------------------------------------

/** Result type for addEdge — returns the new graph and the id of the new edge. */
export interface AddEdgeResult {
	graph: GraphData
	edgeId: string
}

/**
 * Adds an edge between sourceId and targetId.
 *
 * Returns null (no-op) when:
 * - sourceId === targetId (self-loop)
 * - Edge already exists between the pair (directed: exact pair; undirected: either order)
 * - Either endpoint is missing
 *
 * @param weight - Defaults to 1.
 */
export function addEdge(
	graph: GraphData,
	sourceId: string,
	targetId: string,
	weight = 1
): AddEdgeResult | null {
	// Self-loop guard
	if (sourceId === targetId) return null

	// Missing endpoint guard
	if (!graph.nodes.has(sourceId) || !graph.nodes.has(targetId)) return null

	// Parallel edge guard
	if (hasEdgeBetween(graph, sourceId, targetId)) return null

	const edgeId = crypto.randomUUID()
	const edge: GraphEdge = { id: edgeId, source: sourceId, target: targetId, weight }

	const edges = new Map(graph.edges)
	edges.set(edgeId, edge)

	return {
		graph: { nodes: graph.nodes, edges, directed: graph.directed },
		edgeId,
	}
}

// ---------------------------------------------------------------------------
// removeEdge
// ---------------------------------------------------------------------------

/**
 * Removes an edge by id.
 * No-op if edgeId not found.
 */
export function removeEdge(graph: GraphData, edgeId: string): GraphData {
	if (!graph.edges.has(edgeId)) return graph

	const edges = new Map(graph.edges)
	edges.delete(edgeId)

	return { nodes: graph.nodes, edges, directed: graph.directed }
}

// ---------------------------------------------------------------------------
// setEdgeWeight
// ---------------------------------------------------------------------------

/**
 * Updates the weight of an edge.
 * Rejects (returns unchanged graph) if weight <= 0.
 */
export function setEdgeWeight(graph: GraphData, edgeId: string, weight: number): GraphData {
	if (weight <= 0) return graph

	const edge = graph.edges.get(edgeId)
	if (!edge) return graph

	const edges = new Map(graph.edges)
	edges.set(edgeId, { ...edge, weight })

	return { nodes: graph.nodes, edges, directed: graph.directed }
}

// ---------------------------------------------------------------------------
// toggleDirected
// ---------------------------------------------------------------------------

/**
 * Flips the directed flag.
 * Edges are preserved unchanged — algorithms re-evaluate directedness at run time.
 */
export function toggleDirected(graph: GraphData): GraphData {
	return { nodes: graph.nodes, edges: graph.edges, directed: !graph.directed }
}

// ---------------------------------------------------------------------------
// hasEdgeBetween
// ---------------------------------------------------------------------------

/**
 * Checks whether an edge already exists between two nodes.
 * - Directed: checks exact (a → b) pair only.
 * - Undirected: checks both (a → b) and (b → a).
 */
export function hasEdgeBetween(graph: GraphData, a: string, b: string): boolean {
	for (const edge of graph.edges.values()) {
		if (edge.source === a && edge.target === b) return true
		if (!graph.directed && edge.source === b && edge.target === a) return true
	}
	return false
}

// ---------------------------------------------------------------------------
// loadSampleGraph
// ---------------------------------------------------------------------------

/**
 * Returns a deterministic hardcoded sample graph.
 *
 * Structure: 6 nodes (A–F), 8 edges, undirected, positive weights, contains cycles.
 * Node positions are fixed for a pleasant initial layout.
 */
export function loadSampleGraph(): GraphData {
	const makeNode = (id: string, x: number, y: number, label: string): GraphNode => ({
		id,
		x,
		y,
		label,
	})
	const makeEdge = (
		id: string,
		source: string,
		target: string,
		weight: number
	): GraphEdge => ({ id, source, target, weight })

	// Fixed IDs ensure deterministic structure (not affected by UUID randomness)
	const nA = "sample-node-A"
	const nB = "sample-node-B"
	const nC = "sample-node-C"
	const nD = "sample-node-D"
	const nE = "sample-node-E"
	const nF = "sample-node-F"

	const nodes = new Map<string, GraphNode>([
		[nA, makeNode(nA, 300, 80, "A")],
		[nB, makeNode(nB, 150, 200, "B")],
		[nC, makeNode(nC, 450, 200, "C")],
		[nD, makeNode(nD, 100, 340, "D")],
		[nE, makeNode(nE, 300, 340, "E")],
		[nF, makeNode(nF, 500, 340, "F")],
	])

	const edges = new Map<string, GraphEdge>([
		["sample-edge-AB", makeEdge("sample-edge-AB", nA, nB, 4)],
		["sample-edge-AC", makeEdge("sample-edge-AC", nA, nC, 2)],
		["sample-edge-BC", makeEdge("sample-edge-BC", nB, nC, 3)], // creates triangle A-B-C (cycle)
		["sample-edge-BD", makeEdge("sample-edge-BD", nB, nD, 5)],
		["sample-edge-BE", makeEdge("sample-edge-BE", nB, nE, 1)],
		["sample-edge-CE", makeEdge("sample-edge-CE", nC, nE, 6)],
		["sample-edge-CF", makeEdge("sample-edge-CF", nC, nF, 3)],
		["sample-edge-EF", makeEdge("sample-edge-EF", nE, nF, 2)], // creates cycle C-E-F-C
	])

	return { nodes, edges, directed: false }
}
