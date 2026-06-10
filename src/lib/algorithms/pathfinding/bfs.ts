/**
 * Breadth-First Search pathfinder.
 *
 * BFS guarantees the SHORTEST PATH by cell count (fewest hops) on unweighted grids.
 * Cell weights are IGNORED — all edges have equal cost of 1.
 *
 * Implementation uses a FIFO queue via an index pointer (no Array.shift) for O(1)
 * dequeue.
 *
 * ## Path-cost convention (M1)
 * pathCost = sum of weights from start up to (but not including) the end cell.
 * BFS finds the shortest-hop path; pathCost reflects its weight sum for metrics.
 */

import type { Grid } from "../../grid/grid.types"
import { CELL } from "../../grid/grid.types"
import { neighbors } from "../../grid/grid"
import { STEP, type PathOptions, type PathResult, type PseudoLine, type Step } from "./types"

// ---------------------------------------------------------------------------
// Pseudocode — co-located with the algorithm (design §2)
// ---------------------------------------------------------------------------

export const bfsPseudocode: PseudoLine[] = [
	{ id: 0, text: "function BFS(grid, start, end):" },
	{ id: 1, text: "  enqueue start; mark visited" },
	{ id: 2, text: "  while queue is not empty:" },
	{ id: 3, text: "    current ← dequeue()" },
	{ id: 4, text: "    if current == end: return path" },
	{ id: 5, text: "    for each neighbor of current:" },
	{ id: 6, text: "      if not visited: enqueue; mark visited" },
	{ id: 7, text: "  return no-path" },
]

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

/**
 * Validate that the grid has start/end properly placed.
 * Throws if cells[grid.start] !== CELL.START or cells[grid.end] !== CELL.END.
 */
function guardGrid(grid: Grid): void {
	// When start === end, placeEnd overwrites the cell with CELL.END so
	// cells[start] will be CELL.END — accept both as the start-sentinel.
	const startKind = grid.cells[grid.start]
	if (startKind !== CELL.START && startKind !== CELL.END) {
		throw new Error(
			"BFS: grid.cells[grid.start] is not CELL.START — call placeStart before running."
		)
	}
	if (grid.cells[grid.end] !== CELL.END) {
		throw new Error("BFS: grid.cells[grid.end] is not CELL.END — call placeEnd before running.")
	}
}

// ---------------------------------------------------------------------------
// Path reconstruction
// ---------------------------------------------------------------------------

function reconstructPath(cameFrom: Map<number, number>, start: number, end: number): number[] {
	const path: number[] = []
	let current = end
	while (current !== start) {
		path.push(current)
		const parent = cameFrom.get(current)
		if (parent === undefined) return [] // disconnected — should not happen here
		current = parent
	}
	path.push(start)
	return path.reverse()
}

// ---------------------------------------------------------------------------
// runBfs
// ---------------------------------------------------------------------------

/**
 * Run BFS on the given grid.
 *
 * @param grid   - Must have CELL.START at grid.start and CELL.END at grid.end.
 * @param options - PathOptions { diagonal }
 * @returns PathResult { trace, path, metrics }
 */
export function runBfs(grid: Grid, options: PathOptions): PathResult {
	guardGrid(grid)

	const { start, end } = grid
	const trace: Step[] = []

	// Handle start === end immediately
	if (start === end) {
		return {
			trace: [],
			path: [start],
			metrics: {
				visitedCount: 0,
				pathLength: 1,
				pathCost: 0,
				reachable: true,
			},
		}
	}

	const visited = new Set<number>()
	const cameFrom = new Map<number, number>()

	// FIFO queue — index pointer avoids Array.shift O(n) cost
	const queue: number[] = [start]
	let head = 0
	visited.add(start)

	// Frontier step for start
	trace.push({ kind: STEP.FRONTIER, cell: start, line: 1 })

	let found = false

	while (head < queue.length) {
		const current = queue[head++]

		// VISIT step — cell is being processed
		trace.push({ kind: STEP.VISIT, cell: current, line: 3 })

		if (current === end) {
			found = true
			break
		}

		const ns = neighbors(current, grid, options)
		for (const nb of ns) {
			if (!visited.has(nb)) {
				visited.add(nb)
				cameFrom.set(nb, current)
				queue.push(nb)
				// FRONTIER step — neighbor enqueued
				trace.push({ kind: STEP.FRONTIER, cell: nb, line: 6 })
			}
		}
	}

	if (!found) {
		return {
			trace,
			path: [],
			metrics: {
				visitedCount: trace.filter((s) => s.kind === STEP.VISIT).length,
				pathLength: 0,
				pathCost: 0,
				reachable: false,
			},
		}
	}

	// Reconstruct and emit PATH steps
	const path = reconstructPath(cameFrom, start, end)
	for (const cell of path) {
		trace.push({ kind: STEP.PATH, cell, line: 4 })
	}

	// Compute path cost: sum of weights from start (inclusive) to end (exclusive) — M1
	const pathCost = path.slice(0, -1).reduce((acc, idx) => acc + grid.weights[idx], 0)
	const visitedCount = trace.filter((s) => s.kind === STEP.VISIT).length

	return {
		trace,
		path,
		metrics: {
			visitedCount,
			pathLength: path.length,
			pathCost,
			reachable: true,
		},
	}
}
