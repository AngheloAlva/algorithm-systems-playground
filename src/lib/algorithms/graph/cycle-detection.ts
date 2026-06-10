/**
 * Cycle detection via whole-graph multi-source DFS.
 *
 * Design decisions:
 * - requiresStartNode: false — iterates over ALL nodes as potential DFS roots,
 *   skipping already-visited nodes. Detects cycles in all connected components.
 * - Directed graphs: a back-edge is an edge (u, v) where v is on the current
 *   DFS recursion stack (the "gray"/on-stack set). An edge to a fully-finished
 *   ("black") node is a cross/forward edge, NOT a cycle.
 * - Undirected graphs: a back-edge is an edge (u, v) where v is already visited
 *   AND v is NOT the immediate parent of u in the DFS tree. No parallel edges
 *   or self-loops are possible (enforced by GraphData invariants), so the
 *   immediate-parent check is sufficient.
 *
 * Emits (per DFS tree traversal order):
 *   { kind: "visit", nodeId, line }     — first entry into a node
 *   { kind: "tree-edge", fromId, toId, edgeId, line } — DFS tree traversal
 *   { kind: "back-edge", fromId, toId, edgeId, line } — cycle-forming edge
 *
 * Neighbor ordering: label-lexicographic ascending (ADR-4, same as BFS/DFS).
 *
 * ## No React / DOM imports
 */

import type { GraphData, GraphTraceResult, GraphStep } from "../../graph/types"
import { buildAdjacency } from "../../graph/adjacency"

// ---------------------------------------------------------------------------
// Pseudocode (co-located)
// ---------------------------------------------------------------------------

export const CYCLE_DETECTION_PSEUDOCODE = [
	"function detectCycles(graph):",                // 0
	"  for each unvisited node as root:",           // 1
	"    dfs(root, parent=null)",                   // 2
	"",                                             // 3  (spacing line — never emitted)
	"function dfs(node, parent):",                  // 4
	"  mark node visited",                          // 5
	"  for each neighbor of node:",                 // 6
	"    if neighbor not visited:",                 // 7
	"      emit tree-edge(node, neighbor)",         // 8
	"      dfs(neighbor, parent=node)",             // 9
	"    elif neighbor is on stack (directed):",    // 10
	"      emit back-edge(node, neighbor)",         // 11
	"    elif neighbor != parent (undirected):",    // 12
	"      emit back-edge(node, neighbor)",         // 13
] as const

// ---------------------------------------------------------------------------
// Edge lookup helper
// ---------------------------------------------------------------------------

/**
 * Finds the edge id between two nodes.
 * For undirected graphs, checks both orientations.
 * Returns undefined if no edge found.
 */
function findEdgeId(graph: GraphData, fromId: string, toId: string): string | undefined {
	for (const edge of graph.edges.values()) {
		if (edge.source === fromId && edge.target === toId) return edge.id
		if (!graph.directed && edge.source === toId && edge.target === fromId) return edge.id
	}
	return undefined
}

// ---------------------------------------------------------------------------
// runCycleDetection
// ---------------------------------------------------------------------------

/**
 * Runs whole-graph multi-source DFS cycle detection.
 *
 * @param graph   - The graph to analyze.
 * @param _startId - Ignored; all nodes are visited (requiresStartNode: false).
 * @returns GraphTraceResult with tree-edge/back-edge steps and cycle metrics.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function runCycleDetection(graph: GraphData, startId: string): GraphTraceResult {
	if (graph.nodes.size === 0) {
		return {
			steps: [],
			metrics: {
				visitedCount: 0,
				traversalOrder: [],
				cycleDetected: false,
				backEdgeCount: 0,
			},
		}
	}

	const steps: GraphStep[] = []
	const visited = new Set<string>()
	const traversalOrder: string[] = []
	let backEdgeCount = 0

	const adj = buildAdjacency(graph)

	// For directed graphs: track the recursion stack ("gray" set)
	// For undirected graphs: track the immediate DFS parent per node
	const onStack = new Set<string>() // directed: nodes currently on DFS stack

	// Sort node ids by label to ensure deterministic DFS root selection (ADR-4)
	const sortedNodeIds = [...graph.nodes.values()]
		.sort((a, b) => {
			if (a.label < b.label) return -1
			if (a.label > b.label) return 1
			return a.id < b.id ? -1 : 1
		})
		.map((n) => n.id)

	// ---------------------------------------------------------------------------
	// Recursive DFS (iterative via explicit stack to avoid call stack overflow
	// for large graphs, but recursive is cleaner for the parent-tracking logic
	// needed for undirected cycle detection. At ≤50 nodes, recursion depth is safe.)
	// ---------------------------------------------------------------------------

	function dfsRecursive(nodeId: string, parentEdgeId: string | null): void {
		visited.add(nodeId)
		traversalOrder.push(nodeId)
		steps.push({ kind: "visit", nodeId, line: 5 })

		if (graph.directed) {
			onStack.add(nodeId)
		}

		const neighbors = adj.get(nodeId) ?? []

		for (const { to: neighborId, edgeId } of neighbors) {
			if (!visited.has(neighborId)) {
				// Tree edge — first visit to this neighbor
				steps.push({ kind: "tree-edge", fromId: nodeId, toId: neighborId, edgeId, line: 8 })
				dfsRecursive(neighborId, edgeId)
			} else if (graph.directed) {
				// Directed: back-edge only if neighbor is on the current recursion stack
				if (onStack.has(neighborId)) {
					const beEdgeId = findEdgeId(graph, nodeId, neighborId) ?? edgeId
					steps.push({ kind: "back-edge", fromId: nodeId, toId: neighborId, edgeId: beEdgeId, line: 11 })
					backEdgeCount++
				}
				// Else: cross/forward edge to a fully-finished node — not a cycle
			} else {
				// Undirected: back-edge only if the neighbor is NOT the immediate parent
				// (parentEdgeId check handles the case where the same edge can appear
				// in both directions in the adjacency list)
				if (edgeId !== parentEdgeId) {
					const beEdgeId = findEdgeId(graph, nodeId, neighborId) ?? edgeId
					steps.push({ kind: "back-edge", fromId: nodeId, toId: neighborId, edgeId: beEdgeId, line: 13 })
					backEdgeCount++
				}
			}
		}

		if (graph.directed) {
			onStack.delete(nodeId)
		}
	}

	// Multi-source: iterate over all nodes sorted by label; skip already-visited
	for (const nodeId of sortedNodeIds) {
		if (!visited.has(nodeId)) {
			dfsRecursive(nodeId, null)
		}
	}

	return {
		steps,
		metrics: {
			visitedCount: traversalOrder.length,
			traversalOrder,
			cycleDetected: backEdgeCount > 0,
			backEdgeCount,
		},
	}
}
