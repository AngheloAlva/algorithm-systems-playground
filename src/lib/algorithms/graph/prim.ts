/**
 * Prim's Minimum Spanning Tree algorithm.
 *
 * Uses a BinaryHeap (min-heap by edge weight) for the candidate-edge frontier.
 * Starts from startId; falls back to the lowest-label node if startId is absent.
 *
 * Disconnected graph behavior:
 *   Prim produces a minimum spanning FOREST, consistent with Kruskal.
 *   After exhausting the start component, the algorithm re-seeds from the
 *   next unvisited node (lowest-label) and continues until ALL nodes are
 *   covered. Each component root emits a "visit" step (no edge — roots have
 *   no incoming MST edge by definition).
 *   This deviates from spec G16.6 (single-component only) — user-approved
 *   for consistency between Prim and Kruskal.
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
	"  visited ← {}; forest ← []",                         // 1
	"  roots ← [start] + unvisited nodes (lowest-label)",  // 2
	"  for each root in roots:",                            // 3
	"    if root ∈ visited: continue",                     // 4
	"    visited.add(root)  // component root, no edge",   // 5
	"    heap ← min-heap of edges adjacent to root",       // 6
	"    while heap is not empty:",                        // 7
	"      (u, v, w) ← heap.pop() (min weight edge)",     // 8
	"      if v ∈ visited:  // stale entry",               // 9
	"        skip edge    // mst-reject",                  // 10
	"      else:",                                          // 11
	"        forest.add(edge)  // mst-include",            // 12
	"        visited.add(v)",                               // 13
	"        push edges adjacent to v into heap",          // 14
	"  return forest",                                     // 15
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

	// Build the ordered list of root candidates: effectiveStart first, then
	// remaining nodes in ascending label order (lowest-label tie-breaking).
	const remainingByLabel = [...graph.nodes.values()]
		.filter((n) => n.id !== effectiveStart)
		.sort((a, b) => {
			if (a.label < b.label) return -1
			if (a.label > b.label) return 1
			return 0
		})
		.map((n) => n.id)

	const roots = [effectiveStart, ...remainingByLabel]

	for (const root of roots) {
		if (visited.has(root)) continue

		// Seed this component: the root node itself has no incoming forest edge.
		// Emit a visit step so the canvas overlay lights up every component root.
		visited.add(root)
		steps.push({ kind: "visit", nodeId: root, line: 5 })

		const heap = new BinaryHeap<HeapEntry>(heapCompare)

		// Push edges adjacent to this component root
		for (const { edge, neighborId } of adj.get(root) ?? []) {
			if (!visited.has(neighborId)) {
				heap.push({ edge, toId: neighborId })
			}
		}

		while (heap.size() > 0) {
			const entry = heap.pop()!

			if (visited.has(entry.toId)) {
				// Stale entry — both endpoints already in the forest
				steps.push({ kind: "mst-reject", edgeId: entry.edge.id, line: 10 })
				continue
			}

			// Add this edge to the forest
			steps.push({ kind: "mst-include", edgeId: entry.edge.id, line: 12 })
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
