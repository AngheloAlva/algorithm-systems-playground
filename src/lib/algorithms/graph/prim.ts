/**
 * Prim's Minimum Spanning Tree algorithm.
 *
 * Uses a BinaryHeap (min-heap by edge weight) for the candidate-edge frontier.
 * Starts from startId; falls back to the lowest-label node if startId is absent.
 *
 * Disconnected graph behavior:
 *   Prim only spans the connected component containing startId.
 *   Nodes in other components are NOT visited (spec G16.6 / design §7).
 *   This differs from Kruskal which produces a full spanning forest.
 *
 * Heap push-duplicates strategy:
 *   When a neighbor becomes reachable via a lighter edge, we push the new entry
 *   rather than decrease-key (the BinaryHeap uses push-duplicates; stale entries
 *   are discarded when popped if the target node is already in the MST).
 *   Stale pops emit mst-reject steps (spec G16.3).
 *
 * Tie-breaking: equal-weight edges are compared by edgeId (lexicographic).
 *
 * requiresStartNode: false — algorithm auto-selects startId if absent.
 * (The registry entry declares requiresStartNode: false for UX consistency
 *  with Kruskal; the algorithm gracefully handles any startId.)
 *
 * ## No React / DOM imports
 *
 * @see spec G16, design §7
 */

import type { GraphData, GraphTraceResult, GraphStep, GraphEdge } from "../../graph/types"
import { BinaryHeap } from "../../structures/binary-heap"

// ---------------------------------------------------------------------------
// Pseudocode (co-located, Phase 1 convention)
// ---------------------------------------------------------------------------

export const PRIM_PSEUDOCODE = [
	"function Prim(graph, start):",                         // 0
	"  visited ← {start}",                                  // 1
	"  heap ← min-heap of edges adjacent to start",        // 2
	"  mst ← []",                                          // 3
	"  while heap is not empty:",                          // 4
	"    (u, v, w) ← heap.pop() (min weight edge)",        // 5
	"    if v ∈ visited:  // stale entry",                 // 6
	"      skip edge    // mst-reject",                    // 7
	"    else:",                                            // 8
	"      mst.add(edge)  // mst-include",                 // 9
	"      visited.add(v)",                                 // 10
	"      push edges adjacent to v into heap",            // 11
	"  return mst",                                        // 12
]

// ---------------------------------------------------------------------------
// Heap entry type
// ---------------------------------------------------------------------------

interface HeapEntry {
	edge: GraphEdge
	/** The endpoint that is NOT yet in the MST (the "new" node side). */
	toId: string
}

function heapCompare(a: HeapEntry, b: HeapEntry): number {
	if (a.edge.weight !== b.edge.weight) {
		return a.edge.weight - b.edge.weight
	}
	// Tie-break by edgeId for deterministic output (ADR-4)
	return a.edge.id < b.edge.id ? -1 : a.edge.id > b.edge.id ? 1 : 0
}

// ---------------------------------------------------------------------------
// runPrim
// ---------------------------------------------------------------------------

/**
 * Runs Prim's MST from startId on the given graph.
 *
 * @param graph    - The graph (treated as undirected for MST purposes).
 * @param startId  - The node to start from. Falls back to lowest-label node if absent.
 * @returns GraphTraceResult with mst-include/mst-reject steps and MST metrics.
 */
export function runPrim(graph: GraphData, startId: string): GraphTraceResult {
	if (graph.nodes.size === 0) {
		return {
			steps: [],
			metrics: {
				visitedCount: 0,
				traversalOrder: [],
				mstWeight: 0,
				mstEdgeCount: 0,
			},
		}
	}

	const steps: GraphStep[] = []
	let mstWeight = 0
	let mstEdgeCount = 0

	// Resolve the start node: use startId if valid, else pick the lowest-label node
	const effectiveStart = graph.nodes.has(startId)
		? startId
		: [...graph.nodes.values()].sort((a, b) => {
				if (a.label < b.label) return -1
				if (a.label > b.label) return 1
				return 0
			})[0].id

	// Build adjacency list (undirected: include both directions)
	// We need adjacency as: nodeId → [{ edge, neighborId }]
	const adj = new Map<string, { edge: GraphEdge; neighborId: string }[]>()

	for (const node of graph.nodes.keys()) {
		adj.set(node, [])
	}

	for (const edge of graph.edges.values()) {
		adj.get(edge.source)?.push({ edge, neighborId: edge.target })
		adj.get(edge.target)?.push({ edge, neighborId: edge.source })
	}

	// Sort each adjacency list by (weight, edgeId) for deterministic tie-breaking
	for (const list of adj.values()) {
		list.sort((a, b) => {
			if (a.edge.weight !== b.edge.weight) return a.edge.weight - b.edge.weight
			return a.edge.id < b.edge.id ? -1 : a.edge.id > b.edge.id ? 1 : 0
		})
	}

	const visited = new Set<string>()
	visited.add(effectiveStart)

	const heap = new BinaryHeap<HeapEntry>(heapCompare)

	// Seed the heap with all edges adjacent to the start node
	for (const { edge, neighborId } of adj.get(effectiveStart) ?? []) {
		if (!visited.has(neighborId)) {
			heap.push({ edge, toId: neighborId })
		}
	}

	while (heap.size() > 0) {
		const entry = heap.pop()!

		if (visited.has(entry.toId)) {
			// Stale entry — both endpoints are already in the MST
			steps.push({ kind: "mst-reject", edgeId: entry.edge.id, line: 7 })
			continue
		}

		// Add this edge to the MST
		steps.push({ kind: "mst-include", edgeId: entry.edge.id, line: 9 })
		visited.add(entry.toId)
		mstWeight += entry.edge.weight
		mstEdgeCount++

		// Push all edges from the newly added node to unvisited neighbors
		for (const { edge, neighborId } of adj.get(entry.toId) ?? []) {
			if (!visited.has(neighborId)) {
				heap.push({ edge, toId: neighborId })
			}
		}
	}

	return {
		steps,
		metrics: {
			visitedCount: visited.size,
			traversalOrder: [],
			mstWeight,
			mstEdgeCount,
		},
	}
}
