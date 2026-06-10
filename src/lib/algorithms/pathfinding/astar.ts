/**
 * A* pathfinding algorithm.
 *
 * Uses an admissible heuristic to guide the search:
 * - Manhattan distance (4-connected, diagonal: false)
 * - Chebyshev distance (8-connected, diagonal: true)
 *
 * A* is optimal: it finds the same lowest-cost path as Dijkstra for any
 * reachable end cell, given an admissible heuristic.
 *
 * Implementation: binary min-heap ordered by f = g + h.
 * Push-duplicates + skip-stale (same pattern as Dijkstra — design D3).
 *
 * ## Heuristic admissibility on weighted grids
 * Chebyshev(a, end) = max(dr, dc) counts the minimum number of moves in
 * 8-direction movement. Each move costs at least 1 (minimum cell weight),
 * so h(n) = Chebyshev(n, end) * 1 <= true_cost(n, end) — admissibility
 * holds. A* remains optimal under the uniform per-move destination-weight
 * cost model.
 *
 * ## Path-cost convention (M1)
 * pathCost = sum of weights from start (inclusive) to end (exclusive).
 */

import type { Grid } from "../../grid/grid.types"
import { CELL } from "../../grid/grid.types"
import { neighbors } from "../../grid/grid"
import { BinaryHeap } from "../../structures/binary-heap"
import { manhattan, chebyshev } from "./heuristics"
import { STEP, type PathOptions, type PathResult, type PseudoLine, type Step } from "./types"

// ---------------------------------------------------------------------------
// Pseudocode
// ---------------------------------------------------------------------------

export const astarPseudocode: PseudoLine[] = [
	{ id: 0, text: "function A*(grid, start, end):" },
	{ id: 1, text: "  g[start]=0; push (f=h(start), start) to heap" },
	{ id: 2, text: "  while heap is not empty:" },
	{ id: 3, text: "    (f, current) ← heap.pop()" },
	{ id: 4, text: "    if current already settled: skip (stale)" },
	{ id: 5, text: "    mark current as settled" },
	{ id: 6, text: "    if current == end: return path" },
	{ id: 7, text: "    for each neighbor of current:" },
	{ id: 8, text: "      tentative_g = g[current] + neighbor.weight" },
	{ id: 9, text: "      if tentative_g < g[neighbor]:" },
	{ id: 10, text: "        g[neighbor] = tentative_g; push (g+h, neighbor)" },
	{ id: 11, text: "  return no-path" },
]

// ---------------------------------------------------------------------------
// Heap entry
// ---------------------------------------------------------------------------

interface HeapEntry {
	f: number
	cell: number
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

function guardGrid(grid: Grid): void {
	const startKind = grid.cells[grid.start]
	if (startKind !== CELL.START && startKind !== CELL.END) {
		throw new Error(
			"A*: grid.cells[grid.start] is not CELL.START — call placeStart before running."
		)
	}
	if (grid.cells[grid.end] !== CELL.END) {
		throw new Error("A*: grid.cells[grid.end] is not CELL.END — call placeEnd before running.")
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
// runAstar
// ---------------------------------------------------------------------------

/**
 * Run A* on the given grid.
 *
 * @param grid   - Must have CELL.START at grid.start and CELL.END at grid.end.
 * @param options - PathOptions { diagonal } — also selects heuristic.
 * @returns PathResult { trace, path, metrics }
 */
export function runAstar(grid: Grid, options: PathOptions): PathResult {
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

	const heuristic = options.diagonal ? chebyshev : manhattan

	const size = grid.rows * grid.cols
	const g = new Float64Array(size).fill(Infinity)
	const settled = new Uint8Array(size)
	const cameFrom = new Map<number, number>()

	g[start] = 0
	const h0 = heuristic(start, end, grid.cols)
	const heap = new BinaryHeap<HeapEntry>((a, b) => a.f - b.f)
	heap.push({ f: h0, cell: start })
	trace.push({ kind: STEP.FRONTIER, cell: start, line: 1 })

	let found = false

	while (heap.size() > 0) {
		const entry = heap.pop()!
		const current = entry.cell

		// Skip stale entries
		if (settled[current]) continue

		settled[current] = 1
		// VISIT step
		trace.push({ kind: STEP.VISIT, cell: current, line: 5 })

		if (current === end) {
			found = true
			break
		}

		const ns = neighbors(current, grid, options)
		for (const nb of ns) {
			if (settled[nb]) continue
			// Pay to enter the neighbor cell
			const tentativeG = g[current] + grid.weights[nb]
			if (tentativeG < g[nb]) {
				g[nb] = tentativeG
				cameFrom.set(nb, current)
				const f = tentativeG + heuristic(nb, end, grid.cols)
				heap.push({ f, cell: nb })
				trace.push({ kind: STEP.FRONTIER, cell: nb, line: 10 })
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

	// pathCost: sum of weights along path, start included, end excluded (M1)
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
