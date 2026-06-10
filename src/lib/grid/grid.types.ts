/**
 * Grid model types for the pathfinding visualizer.
 *
 * ## Path-cost convention (M1)
 * Cost is the price of ENTERING a cell. A path from start to end accumulates
 * the weight of every cell traversed, INCLUDING the start cell and EXCLUDING
 * the end cell. This matches canonical Dijkstra where you pay to enter a node.
 *
 * Example: path [S, A, B, E] has cost = weight(S) + weight(A) + weight(B).
 *
 * ## Grid dimensions (M2)
 * Default grid is 24 rows × 44 cols on a ≥1280px container.
 * Minimum grid is 10 × 10. Maximum is bounded by the <16ms recompute budget.
 */

// ---------------------------------------------------------------------------
// Cell kinds — const-then-type pattern (typescript skill requirement)
// ---------------------------------------------------------------------------

export const CELL = {
	EMPTY: 0,
	WALL: 1,
	START: 2,
	END: 3,
} as const

export type CellKind = (typeof CELL)[keyof typeof CELL]

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

/** Maximum traversal weight for a cell. Weight 1 = normal terrain. */
export const MAX_WEIGHT = 5

// ---------------------------------------------------------------------------
// Grid defaults (M2)
// ---------------------------------------------------------------------------

/** Default number of rows on a ≥1280px container. */
export const DEFAULT_ROWS = 24

/** Default number of columns on a ≥1280px container. */
export const DEFAULT_COLS = 44

// ---------------------------------------------------------------------------
// Grid interface
// ---------------------------------------------------------------------------

/**
 * A flat, typed-array grid representation.
 *
 * - `cells[r * cols + c]` holds the {@link CellKind} byte for cell (r, c).
 * - `weights[r * cols + c]` holds the traversal weight [1, {@link MAX_WEIGHT}].
 *   Weight is irrelevant for wall cells but is preserved to survive un-wall.
 * - `start` and `end` are flat indices into `cells` / `weights`.
 *
 * ### Immutability contract
 * All mutation helpers in `grid.ts` return a new Grid (shallow clone of the
 * arrays). Callers must not mutate the typed arrays in-place.
 */
export interface Grid {
	rows: number
	cols: number
	/** Flat Uint8Array of {@link CellKind} values — length === rows * cols. */
	cells: Uint8Array
	/** Parallel flat Uint8Array of weights [1..{@link MAX_WEIGHT}]. */
	weights: Uint8Array
	/** Flat index of the start cell. */
	start: number
	/** Flat index of the end cell. */
	end: number
}
