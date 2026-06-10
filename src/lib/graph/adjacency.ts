/**
 * Adjacency builder for graph traversal algorithms.
 *
 * Produces a Map<nodeId, neighbor[]> with neighbors sorted by node label ascending (ADR-4).
 * This deterministic ordering makes BFS/DFS traces reproducible regardless of insertion order.
 *
 * ## No React / DOM imports
 */

import type { GraphData } from "./types"

// ---------------------------------------------------------------------------
// Neighbor entry type
// ---------------------------------------------------------------------------

export interface NeighborEntry {
	to: string
	edgeId: string
	weight: number
}

// ---------------------------------------------------------------------------
// buildAdjacency
// ---------------------------------------------------------------------------

/**
 * Builds an adjacency map from the graph.
 *
 * - Directed: only forward edges (source → target).
 * - Undirected: both directions for each edge.
 * - Neighbors sorted by target node label ascending; ties broken by edgeId (ADR-4).
 *
 * @returns Map<nodeId, NeighborEntry[]>
 */
export function buildAdjacency(graph: GraphData): Map<string, NeighborEntry[]> {
	// Initialize with empty arrays for every node
	const adj = new Map<string, NeighborEntry[]>()
	for (const nodeId of graph.nodes.keys()) {
		adj.set(nodeId, [])
	}

	// Populate edges
	for (const edge of graph.edges.values()) {
		const { id: edgeId, source, target, weight } = edge

		const sourceList = adj.get(source)
		if (sourceList !== undefined) {
			sourceList.push({ to: target, edgeId, weight })
		}

		if (!graph.directed) {
			const targetList = adj.get(target)
			if (targetList !== undefined) {
				targetList.push({ to: source, edgeId, weight })
			}
		}
	}

	// Sort each neighbor list by target node label ascending, then edgeId (ADR-4)
	for (const [, neighbors] of adj) {
		neighbors.sort((a, b) => {
			const labelA = graph.nodes.get(a.to)?.label ?? ""
			const labelB = graph.nodes.get(b.to)?.label ?? ""
			if (labelA < labelB) return -1
			if (labelA > labelB) return 1
			return a.edgeId < b.edgeId ? -1 : 1
		})
	}

	return adj
}
