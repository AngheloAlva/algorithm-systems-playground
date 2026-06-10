/**
 * Depth-First Search pathfinder.
 *
 * DFS explores cells in LIFO order (explicit stack). It does NOT guarantee
 * shortest or lowest-cost path. The spec explicitly states:
 * "DFS path optimality is not a correctness criterion."
 *
 * If the end is reachable, path.length >= 2 (start + end).
 */

import type { Grid } from "../../grid/grid.types"
import { CELL } from "../../grid/grid.types"
import { neighbors } from "../../grid/grid"
import { STEP, type PathOptions, type PathResult, type PseudoLine, type Step } from "./types"

// ---------------------------------------------------------------------------
// Pseudocode
// ---------------------------------------------------------------------------

export const dfsPseudocode: PseudoLine[] = [
	{ id: 0, text: "function DFS(grid, start, end):" },
	{ id: 1, text: "  push start onto stack; mark visited" },
	{ id: 2, text: "  while stack is not empty:" },
	{ id: 3, text: "    current ← pop()" },
	{ id: 4, text: "    if current == end: return path" },
	{ id: 5, text: "    for each neighbor of current:" },
	{ id: 6, text: "      if not visited: push; record parent; mark visited" },
	{ id: 7, text: "  return no-path" },
]

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

function guardGrid(grid: Grid): void {
	const startKind = grid.cells[grid.start]
	if (startKind !== CELL.START && startKind !== CELL.END) {
		throw new Error(
			"DFS: grid.cells[grid.start] is not CELL.START — call placeStart before running."
		)
	}
	if (grid.cells[grid.end] !== CELL.END) {
		throw new Error("DFS: grid.cells[grid.end] is not CELL.END — call placeEnd before running.")
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
// runDfs
// ---------------------------------------------------------------------------

/**
 * Run DFS on the given grid.
 *
 * @param grid   - Must have CELL.START at grid.start and CELL.END at grid.end.
 * @param options - PathOptions { diagonal }
 * @returns PathResult { trace, path, metrics }
 */
export function runDfs(grid: Grid, options: PathOptions): PathResult {
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

	// LIFO stack
	const stack: number[] = [start]
	visited.add(start)

	// Frontier step for start
	trace.push({ kind: STEP.FRONTIER, cell: start, line: 1 })

	let found = false

	while (stack.length > 0) {
		const current = stack.pop()!

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
				stack.push(nb)
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
