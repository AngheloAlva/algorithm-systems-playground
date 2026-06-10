/**
 * Depth-First Search for graphs (iterative, stack-based).
 *
 * Convention (G5.4): neighbors are pushed in REVERSE lexicographic order
 * so the smallest-label neighbor is on top of the stack and processed first.
 *
 * Emits frontier (push) and visit (pop when first seen) steps.
 *
 * ## No React / DOM imports
 */

import type { GraphData, GraphTraceResult, GraphStep } from "../../graph/types"
import { buildAdjacency } from "../../graph/adjacency"

// ---------------------------------------------------------------------------
// Pseudocode (co-located)
// ---------------------------------------------------------------------------

export const DFS_PSEUDOCODE = [
	"function DFS(graph, start):",              // 0
	"  push start onto stack",                  // 1
	"  while stack is not empty:",              // 2
	"    current ← pop()",                      // 3
	"    if current not visited:",              // 4
	"      mark current visited",               // 5
	"      for each neighbor (reverse order):", // 6
	"        push neighbor onto stack",         // 7
]

// ---------------------------------------------------------------------------
// runDFS
// ---------------------------------------------------------------------------

/**
 * Runs iterative DFS from startId on the given graph.
 *
 * @param graph   - The graph to traverse.
 * @param startId - The id of the starting node.
 * @returns GraphTraceResult with frontier/visit steps and metrics.
 */
export function runDFS(graph: GraphData, startId: string): GraphTraceResult {
	if (!graph.nodes.has(startId)) {
		return { steps: [], metrics: { visitedCount: 0, traversalOrder: [] } }
	}

	const steps: GraphStep[] = []
	const visited = new Set<string>()
	const traversalOrder: string[] = []

	const adj = buildAdjacency(graph)

	const stack: string[] = [startId]
	const frontierEmitted = new Set<string>()
	frontierEmitted.add(startId)
	steps.push({ kind: "frontier", nodeId: startId, line: 1 })

	while (stack.length > 0) {
		const current = stack.pop()!

		if (visited.has(current)) continue

		visited.add(current)
		steps.push({ kind: "visit", nodeId: current, line: 5 })
		traversalOrder.push(current)

		// buildAdjacency returns neighbors sorted ascending by label.
		// To achieve smallest-label-first pop, we push in REVERSE order (largest last).
		const neighbors = adj.get(current) ?? []
		for (let i = neighbors.length - 1; i >= 0; i--) {
			const { to } = neighbors[i]
			if (!visited.has(to)) {
				stack.push(to)
				if (!frontierEmitted.has(to)) {
					frontierEmitted.add(to)
					steps.push({ kind: "frontier", nodeId: to, line: 7 })
				}
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
