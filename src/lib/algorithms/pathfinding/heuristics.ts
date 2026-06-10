/**
 * Admissible heuristics for A* pathfinding.
 *
 * Both functions accept flat cell indices (row * cols + col) and the grid
 * column count to recover 2D coordinates without carrying a full Grid reference.
 *
 * ## Admissibility guarantee
 * A heuristic h(a, b) is admissible if h(a, b) ≤ true_cost(a, b) for every
 * reachable cell a. On unit-weight grids both heuristics equal the true cost
 * (tight bound). On weighted grids the actual edge cost is ≥ 1, so the
 * unit-distance heuristic still never overestimates → A* remains optimal.
 */

/**
 * Manhattan distance heuristic — for 4-connected (non-diagonal) grids.
 *
 * h(a, b) = |row_a - row_b| + |col_a - col_b|
 */
export function manhattan(a: number, b: number, cols: number): number {
	const ar = Math.floor(a / cols)
	const ac = a % cols
	const br = Math.floor(b / cols)
	const bc = b % cols
	return Math.abs(ar - br) + Math.abs(ac - bc)
}

/**
 * Octile distance heuristic — for 8-connected (diagonal) grids.
 *
 * On a unit-weight 8-connected grid, the optimal cost between two cells is:
 *   max(dr, dc) + (√2 - 1) * min(dr, dc)
 *
 * where dr = |row_a - row_b|, dc = |col_a - col_b|.
 *
 * This equals the number of diagonal moves × √2 plus remaining cardinal moves × 1,
 * which is the minimum-cost path when diagonal and cardinal moves cost 1 and √2
 * respectively.
 */
export function octile(a: number, b: number, cols: number): number {
	const ar = Math.floor(a / cols)
	const ac = a % cols
	const br = Math.floor(b / cols)
	const bc = b % cols
	const dr = Math.abs(ar - br)
	const dc = Math.abs(ac - bc)
	return Math.max(dr, dc) + (Math.SQRT2 - 1) * Math.min(dr, dc)
}
