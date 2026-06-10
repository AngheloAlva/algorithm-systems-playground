/**
 * Admissible heuristics for A* pathfinding.
 *
 * Both functions accept flat cell indices (row * cols + col) and the grid
 * column count to recover 2D coordinates without carrying a full Grid reference.
 *
 * ## Cost model
 * Each move (cardinal or diagonal) costs the weight of the DESTINATION cell
 * (minimum weight = 1). There is no sqrt(2) multiplier for diagonals.
 *
 * ## Admissibility guarantee
 * A heuristic h(a, b) is admissible if h(a, b) ≤ true_cost(a, b) for every
 * reachable cell a.
 *
 * - Manhattan is admissible and tight for 4-connected grids:
 *   minimum moves = |dr| + |dc|, each costing ≥ 1.
 *
 * - Chebyshev is admissible and tight for 8-connected grids:
 *   minimum moves = max(dr, dc), each costing ≥ 1. This is the correct
 *   lower bound under the uniform per-move destination-weight cost model.
 *
 * ## Historical note
 * Octile distance (max(dr,dc) + (√2-1)*min(dr,dc)) was previously used for
 * 8-connected grids. It was removed because it assumes diagonal moves cost √2
 * while cardinal moves cost 1 — a cost model this implementation does not use.
 * Under the uniform per-move model, octile overestimates the true minimum cost
 * (counterexample: 5×5 grid with specific weights, Dijkstra=5, A*+octile=6),
 * violating admissibility and making A* non-optimal.
 */

/**
 * Manhattan distance heuristic — for 4-connected (non-diagonal) grids.
 *
 * h(a, b) = |row_a - row_b| + |col_a - col_b|
 *
 * Admissible and tight: equals the minimum number of cardinal moves, each
 * costing at least 1 under the destination-weight cost model.
 */
export function manhattan(a: number, b: number, cols: number): number {
	const ar = Math.floor(a / cols)
	const ac = a % cols
	const br = Math.floor(b / cols)
	const bc = b % cols
	return Math.abs(ar - br) + Math.abs(ac - bc)
}

/**
 * Chebyshev distance heuristic — for 8-connected (diagonal) grids.
 *
 * h(a, b) = max(|row_a - row_b|, |col_a - col_b|)
 *
 * Admissible and tight: equals the minimum number of moves in 8-direction
 * movement (diagonal moves cover both axes simultaneously), each costing at
 * least 1 under the destination-weight cost model.
 */
export function chebyshev(a: number, b: number, cols: number): number {
	const ar = Math.floor(a / cols)
	const ac = a % cols
	const br = Math.floor(b / cols)
	const bc = b % cols
	const dr = Math.abs(ar - br)
	const dc = Math.abs(ac - bc)
	return Math.max(dr, dc)
}
