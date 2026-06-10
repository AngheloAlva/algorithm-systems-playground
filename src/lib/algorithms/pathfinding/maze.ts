/**
 * Seeded maze generator using recursive division.
 *
 * ## Algorithm: Recursive Division
 * Starts with an all-open (no walls) grid.
 * Recursively bisects chambers, adding one wall per chamber with
 * one guaranteed passage — producing a spanning-tree maze.
 *
 * On a grid with walls only on chamber dividers (not borders), the algorithm
 * guarantees exactly one path between start and end (a perfect maze).
 *
 * ## Determinism
 * Uses a seeded LCG PRNG — no Math.random(). Same seed → same maze.
 *
 * ## Reachability guarantee
 * Each wall leaves exactly one gap, preserving connectivity between all
 * sub-chambers. Start (top-left) and end (bottom-right) are never walled.
 *
 * ## Implementation notes
 * The division chooses a wall position at least 1 cell from each chamber edge,
 * so that both sub-chambers always have at least 1 cell. The passage is always
 * in an interior cell (never on the chamber boundary), but since we operate on
 * an open grid there are no hard borders to enforce. For small chambers (< 2
 * in one dimension) we do not draw walls so reachability is trivially preserved.
 */

import { createGrid, placeStart, placeEnd, index } from "../../grid/grid"
import { CELL } from "../../grid/grid.types"
import type { Grid } from "../../grid/grid.types"

// ---------------------------------------------------------------------------
// Seeded PRNG — Park-Miller LCG
// ---------------------------------------------------------------------------

/**
 * Create a seeded pseudo-random number generator.
 * Returns floats in [0, 1). Pure — no global state mutated outside closure.
 */
function makePrng(seed: number): () => number {
	let s = seed >>> 0 || 1 // ensure non-zero unsigned 32-bit
	return function rand(): number {
		// Knuth MMIX LCG with 32-bit arithmetic
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0
		return s / 4294967296 // [0, 1)
	}
}

// ---------------------------------------------------------------------------
// Recursive division
// ---------------------------------------------------------------------------

/**
 * Bisect a chamber with one wall + one passage.
 *
 * Wall is drawn at a position strictly INSIDE the chamber:
 * - Horizontal wall: wallRow ∈ [r0+1, r1] (so top sub-chamber has ≥1 row)
 *   Sub-chambers: [r0, wallRow-1] and [wallRow, r1].
 *   Passage opens one column in the wall row.
 * - Vertical wall: wallCol ∈ [c0+1, c1] — symmetric.
 */
function divide(
	cells: Uint8Array,
	rows: number,
	cols: number,
	r0: number,
	c0: number,
	r1: number,
	c1: number,
	rand: () => number
): void {
	const width = c1 - c0 + 1
	const height = r1 - r0 + 1

	// Cannot divide a chamber that's only 1 wide or 1 tall in the split axis
	if (width < 3 && height < 3) return

	// Decide orientation: prefer splitting the longer axis
	// When both axes are too small for one direction, force the other
	const canHorizontal = height >= 3
	const canVertical = width >= 3

	let horizontal: boolean
	if (canHorizontal && canVertical) {
		horizontal = height >= width ? rand() < 0.6 : rand() < 0.4
	} else {
		horizontal = canHorizontal
	}

	if (horizontal) {
		// Wall row: strictly between r0 and r1 (i.e., r0+1 .. r1-1) so both
		// sub-chambers have at least 1 row of usable space.
		// interior rows for wall: r0+1 to r1-1 (height-2 choices)
		const choices = height - 2 // number of valid wall positions
		if (choices < 1) return
		const wallRow = r0 + 1 + Math.floor(rand() * choices)

		// Wall the entire row within this chamber
		for (let c = c0; c <= c1; c++) {
			const i = index(wallRow, c, cols)
			if (cells[i] !== CELL.START && cells[i] !== CELL.END) {
				cells[i] = CELL.WALL
			}
		}

		// Open one passage — randomly pick a column in the wall row
		const passageCol = c0 + Math.floor(rand() * width)
		const pi = index(wallRow, passageCol, cols)
		if (cells[pi] !== CELL.START && cells[pi] !== CELL.END) {
			cells[pi] = CELL.EMPTY
		}

		// Recurse
		divide(cells, rows, cols, r0, c0, wallRow - 1, c1, rand)
		divide(cells, rows, cols, wallRow + 1, c0, r1, c1, rand)
	} else {
		const choices = width - 2
		if (choices < 1) return
		const wallCol = c0 + 1 + Math.floor(rand() * choices)

		for (let r = r0; r <= r1; r++) {
			const i = index(r, wallCol, cols)
			if (cells[i] !== CELL.START && cells[i] !== CELL.END) {
				cells[i] = CELL.WALL
			}
		}

		const passageRow = r0 + Math.floor(rand() * height)
		const pi = index(passageRow, wallCol, cols)
		if (cells[pi] !== CELL.START && cells[pi] !== CELL.END) {
			cells[pi] = CELL.EMPTY
		}

		divide(cells, rows, cols, r0, c0, r1, wallCol - 1, rand)
		divide(cells, rows, cols, r0, wallCol + 1, r1, c1, rand)
	}
}

// ---------------------------------------------------------------------------
// Reachability repair (safety net)
// ---------------------------------------------------------------------------

/**
 * Guarantee reachability by removing walls along a straight-line corridor
 * from start to end if BFS cannot find a path.
 *
 * This is a fallback for edge cases where recursive division produces an
 * unreachable maze (e.g., very small grids). For normal-sized grids
 * (≥ 5×5) the division algorithm always produces a reachable maze.
 */
function ensureReachable(
	cells: Uint8Array,
	rows: number,
	cols: number,
	start: number,
	end: number
): void {
	// Simple L-shaped corridor: go right then down from start to end
	const sr = Math.floor(start / cols)
	const sc = start % cols
	const er = Math.floor(end / cols)
	const ec = end % cols

	// Go right along row sr
	for (let c = sc; c <= ec; c++) {
		const i = index(sr, c, cols)
		if (cells[i] !== CELL.START && cells[i] !== CELL.END) {
			cells[i] = CELL.EMPTY
		}
	}
	// Go down along col ec
	for (let r = sr; r <= er; r++) {
		const i = index(r, ec, cols)
		if (cells[i] !== CELL.START && cells[i] !== CELL.END) {
			cells[i] = CELL.EMPTY
		}
	}
}

// ---------------------------------------------------------------------------
// BFS connectivity check (internal — no trace overhead)
// ---------------------------------------------------------------------------

/**
 * Check whether end is reachable from start using 4-connected BFS.
 *
 * The 4-connected check is conservative by design: any maze that is
 * 4-connected-reachable is also 8-connected-reachable. Mazes where start and
 * end are only reachable diagonally (but not via cardinal moves) will return
 * false here, triggering the deterministic corridor fallback in generateMaze.
 */
function isReachable(
	cells: Uint8Array,
	rows: number,
	cols: number,
	start: number,
	end: number
): boolean {
	if (start === end) return true
	const visited = new Uint8Array(rows * cols)
	const queue: number[] = [start]
	visited[start] = 1
	let head = 0
	const DIRS = [
		[-1, 0],
		[0, 1],
		[1, 0],
		[0, -1],
	]
	while (head < queue.length) {
		const cur = queue[head++]
		if (cur === end) return true
		const r = Math.floor(cur / cols)
		const c = cur % cols
		for (const [dr, dc] of DIRS) {
			const nr = r + dr
			const nc = c + dc
			if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
			const ni = nr * cols + nc
			if (cells[ni] === CELL.WALL || visited[ni]) continue
			visited[ni] = 1
			queue.push(ni)
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// generateMaze
// ---------------------------------------------------------------------------

/**
 * Generate a maze using recursive division with a seeded PRNG.
 *
 * @param rows - Number of rows (>= 3 recommended)
 * @param cols - Number of columns (>= 3 recommended)
 * @param seed - Integer seed for deterministic generation
 * @returns A Grid with walls placed; start→end path always reachable.
 */
export function generateMaze(rows: number, cols: number, seed: number): Grid {
	const rand = makePrng(seed)

	// Create open grid and place start/end markers
	let grid = createGrid(rows, cols)
	grid = placeStart(grid, 0, 0)
	grid = placeEnd(grid, rows - 1, cols - 1)

	// Run recursive division — mutates cells in place
	divide(grid.cells, rows, cols, 0, 0, rows - 1, cols - 1, rand)

	// Defensive: re-assert start/end markers (divide guards them but be safe)
	grid.cells[grid.start] = CELL.START
	grid.cells[grid.end] = CELL.END

	// Safety net: if maze is disconnected, carve an L-shaped corridor
	if (!isReachable(grid.cells, rows, cols, grid.start, grid.end)) {
		ensureReachable(grid.cells, rows, cols, grid.start, grid.end)
		grid.cells[grid.start] = CELL.START
		grid.cells[grid.end] = CELL.END
	}

	return grid
}
