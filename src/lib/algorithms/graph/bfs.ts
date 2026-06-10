/**
 * Breadth-First Search for graphs.
 *
 * Emits frontier (enqueue) and visit (dequeue) steps.
 * Neighbors sorted by label ascending for deterministic output (ADR-4).
 *
 * ## No React / DOM imports
 */

import type { GraphData, GraphTraceResult, GraphStep } from "../../graph/types"
import { buildAdjacency } from "../../graph/adjacency"

// ---------------------------------------------------------------------------
// Pseudocode (co-located, Phase 1 convention)
// ---------------------------------------------------------------------------

export const BFS_PSEUDOCODE = [
	"function BFS(graph, start):",       // 0
	"  enqueue start; mark visited",      // 1
	"  while queue is not empty:",        // 2
	"    current ← dequeue()",            // 3
	"    for each neighbor of current:",  // 4
	"      if not visited:",              // 5
	"        enqueue neighbor",           // 6
	"        mark neighbor visited",      // 7
]

// ---------------------------------------------------------------------------
// runBFS
// ---------------------------------------------------------------------------

/**
 * Runs BFS from startId on the given graph.
 *
 * @param graph   - The graph to traverse.
 * @param startId - The id of the starting node.
 * @returns GraphTraceResult with frontier/visit steps and metrics.
 */
export function runBFS(graph: GraphData, startId: string): GraphTraceResult {
	if (!graph.nodes.has(startId)) {
		return { steps: [], metrics: { visitedCount: 0, traversalOrder: [] } }
	}

	const steps: GraphStep[] = []
	const visited = new Set<string>()
	const traversalOrder: string[] = []

	const adj = buildAdjacency(graph)

	// FIFO queue using an index pointer (no Array.shift)
	const queue: string[] = [startId]
	let head = 0
	visited.add(startId)

	// Frontier step for start
	steps.push({ kind: "frontier", nodeId: startId, line: 1 })

	while (head < queue.length) {
		const current = queue[head++]

		// Visit step — node is being processed
		steps.push({ kind: "visit", nodeId: current, line: 3 })
		traversalOrder.push(current)

		const neighbors = adj.get(current) ?? []
		for (const { to } of neighbors) {
			if (!visited.has(to)) {
				visited.add(to)
				queue.push(to)
				steps.push({ kind: "frontier", nodeId: to, line: 6 })
			}
		}
	}

	return {
		steps,
		metrics: {
			visitedCount: traversalOrder.length,
			traversalOrder,
		},
	}
}
