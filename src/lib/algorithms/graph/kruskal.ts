/**
 * Kruskal's Minimum Spanning Tree algorithm.
 *
 * Operates on UNDIRECTED weighted graphs. If called on a directed graph,
 * edges are treated as undirected (both directions are considered implicitly
 * by sorting all edges and checking Union-Find connectivity — the directed
 * flag is ignored).
 *
 * Algorithm:
 *   1. Sort all edges by weight ascending; tie-break by edgeId (lexicographic).
 *   2. Initialize Union-Find with all node ids.
 *   3. For each edge:
 *      - If endpoints are in different sets → emit mst-include, union them.
 *      - Otherwise → emit mst-reject (would form a cycle).
 *
 * Disconnected graph → minimum spanning FOREST:
 *   Processes all edges; each connected component gets its own spanning tree.
 *   mstEdgeCount will be nodes.size - numberOfComponents.
 *
 * requiresStartNode: false — startId is accepted for interface compatibility but ignored.
 *
 * ## No React / DOM imports
 *
 * @see spec G15, design §7
 */

import type { GraphData, GraphTraceResult, GraphStep } from "../../graph/types"
import { UnionFind } from "../../structures/union-find"

// ---------------------------------------------------------------------------
// Pseudocode (co-located, Phase 1 convention)
// ---------------------------------------------------------------------------

export const KRUSKAL_PSEUDOCODE = [
	"function Kruskal(graph):",                             // 0
	"  sort edges by weight asc, edgeId asc (tie-break)",  // 1
	"  uf ← UnionFind(all nodes)",                         // 2
	"  mst ← []",                                          // 3
	"  for each edge (u, v, w) in sorted order:",          // 4
	"    if find(u) ≠ find(v):",                           // 5
	"      mst.add(edge)   // mst-include",                // 6
	"      union(u, v)",                                   // 7
	"    else:",                                            // 8
	"      skip edge       // mst-reject (cycle)",         // 9
	"  return mst",                                        // 10
]

// ---------------------------------------------------------------------------
// runKruskal
// ---------------------------------------------------------------------------

/**
 * Runs Kruskal's MST on the given graph.
 *
 * @param graph   - The graph to compute the MST for (treated as undirected).
 * @param _startId - Accepted for GraphAlgorithmFn compatibility; ignored.
 * @returns GraphTraceResult with mst-include/mst-reject steps and MST metrics.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function runKruskal(graph: GraphData, _startId: string): GraphTraceResult {
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

	// Initialize Union-Find with all node ids
	const nodeIds = [...graph.nodes.keys()]
	const uf = new UnionFind(nodeIds)

	// Sort edges: primary by weight ascending, secondary by edgeId ascending (ADR-4)
	const sortedEdges = [...graph.edges.values()].sort((a, b) => {
		if (a.weight !== b.weight) return a.weight - b.weight
		return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
	})

	for (const edge of sortedEdges) {
		if (!uf.connected(edge.source, edge.target)) {
			// Different components — include this edge in the MST
			steps.push({ kind: "mst-include", edgeId: edge.id, line: 6 })
			uf.union(edge.source, edge.target)
			mstWeight += edge.weight
			mstEdgeCount++
		} else {
			// Same component — including this edge would form a cycle
			steps.push({ kind: "mst-reject", edgeId: edge.id, line: 9 })
		}
	}

	return {
		steps,
		metrics: {
			visitedCount: graph.nodes.size,
			traversalOrder: [],
			mstWeight,
			mstEdgeCount,
		},
	}
}
