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
// runCycleDetection
// ---------------------------------------------------------------------------

/**
 * Runs whole-graph multi-source DFS cycle detection.
 *
 * @param graph    - The graph to analyze.
 * @param startId  - Ignored; all nodes are visited (requiresStartNode: false).
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

	// onStack tracks the current DFS recursion stack ("gray" set) for both
	// directed and undirected graphs. For directed graphs it distinguishes
	// back-edges (ancestor on stack) from cross/forward edges (finished node).
	// For undirected graphs it prevents double-counting: a finished descendant
	// is no longer on the stack, so re-encountering it from a different DFS path
	// does not emit a spurious second back-edge.
	const onStack = new Set<string>()

	// Sort node ids by label to ensure deterministic DFS root selection (ADR-4)
	const sortedNodeIds = [...graph.nodes.values()]
		.sort((a, b) => {
			if (a.label < b.label) return -1
			if (a.label > b.label) return 1
			return a.id < b.id ? -1 : 1
		})
		.map((n) => n.id)

	// ---------------------------------------------------------------------------
	// Recursive DFS — parentEdgeId is the edge used to arrive at this node, used
	// for undirected graphs to skip the immediate parent edge (which is always on
	// the stack and must not be treated as a back-edge). At ≤50 nodes the
	// recursion depth is safe.
	// ---------------------------------------------------------------------------

	function dfsRecursive(nodeId: string, parentEdgeId: string | null): void {
		visited.add(nodeId)
		traversalOrder.push(nodeId)
		steps.push({ kind: "visit", nodeId, line: 5 })

		onStack.add(nodeId)

		const neighbors = adj.get(nodeId) ?? []

		for (const { to: neighborId, edgeId } of neighbors) {
			if (!visited.has(neighborId)) {
				// Tree edge — first visit to this neighbor
				steps.push({ kind: "tree-edge", fromId: nodeId, toId: neighborId, edgeId, line: 8 })
				dfsRecursive(neighborId, edgeId)
			} else if (graph.directed) {
				// Directed: back-edge only if neighbor is on the current recursion stack.
				// An edge to a fully-finished ("black") node is a cross/forward edge, not a cycle.
				if (onStack.has(neighborId)) {
					steps.push({ kind: "back-edge", fromId: nodeId, toId: neighborId, edgeId, line: 11 })
					backEdgeCount++
				}
			} else {
				// Undirected: back-edge only if the neighbor is on the current stack
				// (rules out already-finished descendants) AND the edge is not the one
				// we used to arrive here (rules out the immediate parent traversal).
				if (onStack.has(neighborId) && edgeId !== parentEdgeId) {
					steps.push({ kind: "back-edge", fromId: nodeId, toId: neighborId, edgeId, line: 13 })
					backEdgeCount++
				}
			}
		}

		onStack.delete(nodeId)
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
