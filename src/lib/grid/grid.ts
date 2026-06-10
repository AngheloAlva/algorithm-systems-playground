import { CELL, MAX_WEIGHT, type Grid } from "./grid.types"

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/** Convert (row, col) to flat array index. */
export function index(r: number, c: number, cols: number): number {
	return r * cols + c
}

/** Convert flat array index to { r, c } coordinates. */
export function coords(i: number, cols: number): { r: number; c: number } {
	return { r: Math.floor(i / cols), c: i % cols }
}

// ---------------------------------------------------------------------------
// Grid factory
// ---------------------------------------------------------------------------

/**
 * Create an all-empty grid with no walls, all weights 1, and no start/end placed.
 * start and end are initialized to flat index 0 — callers must call placeStart /
 * placeEnd before running any algorithm.
 *
 * Note: createGrid accepts any positive dimensions intentionally — tests use tiny
 * grids (e.g. 3×3). Dimension clamping (default 24×44, minimum 10×10) is a
 * UI-layer responsibility handled at the component level, not here.
 */
export function createGrid(rows: number, cols: number): Grid {
	const size = rows * cols
	const cells = new Uint8Array(size) // default 0 = CELL.EMPTY
	const weights = new Uint8Array(size).fill(1)
	return { rows, cols, cells, weights, start: 0, end: 0 }
}

// ---------------------------------------------------------------------------
// Immutable clone helpers (internal)
// ---------------------------------------------------------------------------

function cloneGrid(g: Grid): Grid {
	return {
		rows: g.rows,
		cols: g.cols,
		cells: g.cells.slice(),
		weights: g.weights.slice(),
		start: g.start,
		end: g.end,
	}
}

// ---------------------------------------------------------------------------
// Mutation helpers (all return new Grid)
// ---------------------------------------------------------------------------

/**
 * Move the start marker to (row, col).
 * Throws if the target cell is a wall.
 * The previous start cell is cleared to EMPTY.
 */
export function placeStart(g: Grid, row: number, col: number): Grid {
	const target = index(row, col, g.cols)
	if (g.cells[target] === CELL.WALL) {
		throw new Error(`Cannot place start on a wall at (${row}, ${col})`)
	}
	const next = cloneGrid(g)
	// Clear old start only if it was marked as START (not end)
	if (next.cells[next.start] === CELL.START) {
		next.cells[next.start] = CELL.EMPTY
	}
	next.cells[target] = CELL.START
	next.start = target
	return next
}

/**
 * Move the end marker to (row, col).
 * Throws if the target cell is a wall.
 * The previous end cell is cleared to EMPTY.
 */
export function placeEnd(g: Grid, row: number, col: number): Grid {
	const target = index(row, col, g.cols)
	if (g.cells[target] === CELL.WALL) {
		throw new Error(`Cannot place end on a wall at (${row}, ${col})`)
	}
	const next = cloneGrid(g)
	// Clear old end only if it was marked as END (not start)
	if (next.cells[next.end] === CELL.END) {
		next.cells[next.end] = CELL.EMPTY
	}
	next.cells[target] = CELL.END
	next.end = target
	return next
}

/**
 * Toggle the wall state of (row, col).
 * No-op if the cell is the start or end cell.
 */
export function toggleWall(g: Grid, row: number, col: number): Grid {
	const i = index(row, col, g.cols)
	const kind = g.cells[i]
	// Guard: never wall the start or end
	if (kind === CELL.START || kind === CELL.END) {
		return g
	}
	const next = cloneGrid(g)
	next.cells[i] = kind === CELL.WALL ? CELL.EMPTY : CELL.WALL
	return next
}

/**
 * Set the traversal weight of (row, col), clamped to [1, MAX_WEIGHT].
 * No-op if the cell is a wall (walls are impassable; weight is irrelevant).
 */
export function setWeight(g: Grid, row: number, col: number, weight: number): Grid {
	const i = index(row, col, g.cols)
	if (g.cells[i] === CELL.WALL) {
		return g
	}
	const next = cloneGrid(g)
	next.weights[i] = Math.max(1, Math.min(MAX_WEIGHT, weight))
	return next
}

// ---------------------------------------------------------------------------
// Neighbor enumeration
// ---------------------------------------------------------------------------

/** Fixed neighbor direction offsets: N, E, S, W (then NE, SE, SW, NW for diagonal). */
const DIRS_4 = [
	[-1, 0], // N
	[0, 1], // E
	[1, 0], // S
	[0, -1], // W
] as const

const DIRS_8 = [
	...DIRS_4,
	[-1, 1], // NE
	[1, 1], // SE
	[1, -1], // SW
	[-1, -1], // NW
] as const

/**
 * Return the flat indices of valid (in-bounds, non-wall) neighbors of cell i.
 * Order is fixed: N, E, S, W, [NE, SE, SW, NW] — ensures deterministic traces.
 *
 * No corner cutting: diagonal movement requires both adjacent cardinal cells
 * (r+dr, c) and (r, c+dc) to be in-bounds and not walls. A diagonal neighbor
 * that would require passing through a wall corner is excluded.
 */
export function neighbors(i: number, g: Grid, options: { diagonal: boolean }): number[] {
	const { r, c } = coords(i, g.cols)
	const dirs = options.diagonal ? DIRS_8 : DIRS_4
	const result: number[] = []
	for (const [dr, dc] of dirs) {
		const nr = r + dr
		const nc = c + dc
		if (nr < 0 || nr >= g.rows || nc < 0 || nc >= g.cols) continue
		const ni = index(nr, nc, g.cols)
		if (g.cells[ni] === CELL.WALL) continue

		// No corner cutting: for diagonal moves, both adjacent cardinals must be passable
		const isDiagonal = dr !== 0 && dc !== 0
		if (isDiagonal) {
			// Cardinal neighbour sharing the same row as the source: (r+dr, c)
			const cardinalRowR = r + dr
			const cardinalRowC = c
			// Cardinal neighbour sharing the same column as the source: (r, c+dc)
			const cardinalColR = r
			const cardinalColC = c + dc

			// Both cardinals must be in-bounds
			if (cardinalRowR < 0 || cardinalRowR >= g.rows || cardinalColC < 0 || cardinalColC >= g.cols)
				continue

			// Both cardinals must not be walls
			if (g.cells[index(cardinalRowR, cardinalRowC, g.cols)] === CELL.WALL) continue
			if (g.cells[index(cardinalColR, cardinalColC, g.cols)] === CELL.WALL) continue
		}

		result.push(ni)
	}
	return result
}
