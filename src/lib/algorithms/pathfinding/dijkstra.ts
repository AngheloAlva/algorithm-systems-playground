/**
 * Dijkstra's shortest-path algorithm.
 *
 * Explores cells in ascending total-cost order using a binary min-heap.
 * Respects cell weights — finds the LOWEST-COST path.
 *
 * Implementation: push-duplicates + skip-stale on pop (design D3).
 * When a cell is popped from the heap, if it has already been settled
 * (visited) with a lower cost, the popped entry is stale and discarded.
 *
 * ## Path-cost convention (M1)
 * pathCost = sum of weights from start (inclusive) to end (exclusive).
 */

import type { Grid } from "../../grid/grid.types"
import { CELL } from "../../grid/grid.types"
import { neighbors } from "../../grid/grid"
import { BinaryHeap } from "../../structures/binary-heap"
import { STEP, type PathOptions, type PathResult, type PseudoLine, type Step } from "./types"

// ---------------------------------------------------------------------------
// Pseudocode
// ---------------------------------------------------------------------------

export const dijkstraPseudocode: PseudoLine[] = [
	{ id: 0, text: "function Dijkstra(grid, start, end):" },
	{ id: 1, text: "  dist[start] = 0; push (0, start) to heap" },
	{ id: 2, text: "  while heap is not empty:" },
	{ id: 3, text: "    (cost, current) ← heap.pop()" },
	{ id: 4, text: "    if current already settled: skip (stale)" },
	{ id: 5, text: "    mark current as settled" },
	{ id: 6, text: "    if current == end: return path" },
	{ id: 7, text: "    for each neighbor of current:" },
	{ id: 8, text: "      newCost = cost + neighbor.weight" },
	{ id: 9, text: "      if newCost < dist[neighbor]: update; push to heap" },
	{ id: 10, text: "  return no-path" },
]

// ---------------------------------------------------------------------------
// Heap entry
// ---------------------------------------------------------------------------

interface HeapEntry {
	cost: number
	cell: number
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

function guardGrid(grid: Grid): void {
	const startKind = grid.cells[grid.start]
	if (startKind !== CELL.START && startKind !== CELL.END) {
		throw new Error(
			"Dijkstra: grid.cells[grid.start] is not CELL.START — call placeStart before running."
		)
	}
	if (grid.cells[grid.end] !== CELL.END) {
		throw new Error(
			"Dijkstra: grid.cells[grid.end] is not CELL.END — call placeEnd before running."
		)
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
		if (parent === undefined) return []
		current = parent
	}
	path.push(start)
	return path.reverse()
}

// ---------------------------------------------------------------------------
// runDijkstra
// ---------------------------------------------------------------------------

/**
 * Run Dijkstra's algorithm on the given grid.
 *
 * @param grid   - Must have CELL.START at grid.start and CELL.END at grid.end.
 * @param options - PathOptions { diagonal }
 * @returns PathResult { trace, path, metrics }
 */
export function runDijkstra(grid: Grid, options: PathOptions): PathResult {
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

	const size = grid.rows * grid.cols
	const dist = new Float64Array(size).fill(Infinity)
	const settled = new Uint8Array(size) // 0 = not settled, 1 = settled
	const cameFrom = new Map<number, number>()

	dist[start] = 0
	const heap = new BinaryHeap<HeapEntry>((a, b) => a.cost - b.cost)
	heap.push({ cost: 0, cell: start })
	trace.push({ kind: STEP.FRONTIER, cell: start, line: 1 })

	let found = false

	while (heap.size() > 0) {
		const entry = heap.pop()!
		const { cost, cell: current } = entry

		// Skip stale entries (push-duplicates pattern — design D3)
		if (settled[current]) continue

		settled[current] = 1
		// VISIT step — cell is being settled
		trace.push({ kind: STEP.VISIT, cell: current, line: 5 })

		if (current === end) {
			found = true
			break
		}

		const ns = neighbors(current, grid, options)
		for (const nb of ns) {
			if (settled[nb]) continue
			// Cost to enter a neighbor = current cost + neighbor weight (M1: pay to enter)
			const newCost = cost + grid.weights[nb]
			if (newCost < dist[nb]) {
				dist[nb] = newCost
				cameFrom.set(nb, current)
				heap.push({ cost: newCost, cell: nb })
				trace.push({ kind: STEP.FRONTIER, cell: nb, line: 9 })
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

	// Reconstruct path
	const path = reconstructPath(cameFrom, start, end)
	for (const cell of path) {
		trace.push({ kind: STEP.PATH, cell, line: 6 })
	}

	// pathCost is computed directly from the path array because dist[end] excludes
	// the start weight while the M1 convention includes it.
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
