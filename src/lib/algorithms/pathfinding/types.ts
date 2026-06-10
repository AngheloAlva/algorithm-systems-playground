/**
 * Shared Step discriminated-union types for pathfinding algorithms.
 *
 * Every pathfinder produces a PathResult containing:
 *  - `trace`: the ordered sequence of Steps (for animation + pseudocode highlight)
 *  - `path`: flat indices from start to end (empty if no path found)
 *  - `metrics`: summary statistics about the run
 *
 * ## Path-cost convention (M1)
 * `pathCost` = sum of weights of all cells in the path INCLUDING the start cell
 * and EXCLUDING the end cell. Cost models entering a cell; you arrive at the end
 * but do not traverse through it.
 *
 * ## No React / DOM imports
 * This module is pure TypeScript — safe to import in Node/test/worker contexts.
 */

import type { Grid } from "../../grid/grid.types"

// ---------------------------------------------------------------------------
// Step kind — const-then-type pattern (typescript skill)
// ---------------------------------------------------------------------------

export const STEP = {
	VISIT: "visit",
	FRONTIER: "frontier",
	PATH: "path",
} as const

export type StepKind = (typeof STEP)[keyof typeof STEP]

// ---------------------------------------------------------------------------
// Step interfaces — discriminated union on `kind`
// ---------------------------------------------------------------------------

/**
 * A cell has been dequeued / popped and fully explored.
 * Drives the "visited" overlay color.
 */
export interface VisitStep {
	kind: "visit"
	/** Flat cell index (row * cols + col). */
	cell: number
	/** 0-indexed line in the algorithm's pseudocode array to highlight. */
	line: number
}

/**
 * A cell has been added to the open set / frontier queue.
 * Drives the "frontier" overlay color.
 */
export interface FrontierStep {
	kind: "frontier"
	cell: number
	line: number
}

/**
 * A cell is part of the final reconstructed path.
 * Drives the "path" overlay color.
 */
export interface PathStep {
	kind: "path"
	cell: number
	line: number
}

/** Union of all step types — use `kind` to discriminate. */
export type Step = VisitStep | FrontierStep | PathStep

// ---------------------------------------------------------------------------
// Pseudocode line (for panel rendering)
// ---------------------------------------------------------------------------

export interface PseudoLine {
	id: number
	text: string
}

// ---------------------------------------------------------------------------
// PathResult and PathMetrics
// ---------------------------------------------------------------------------

export interface PathMetrics {
	/** Number of cells that were fully explored (dequeued from open set). */
	visitedCount: number
	/** Number of cells in the path (includes start + end). 0 if no path. */
	pathLength: number
	/**
	 * Sum of traversal weights along the path (start included, end excluded per M1).
	 * 0 if no path.
	 */
	pathCost: number
	/** Whether the end cell is reachable from start. */
	reachable: boolean
}

export interface PathResult {
	/** Ordered Step sequence for animation playback and pseudocode highlighting. */
	trace: Step[]
	/** Flat cell indices from start to end, in order. Empty array if no path. */
	path: number[]
	metrics: PathMetrics
}

// ---------------------------------------------------------------------------
// PathOptions and Pathfinder type
// ---------------------------------------------------------------------------

export interface PathOptions {
	/**
	 * When true, 8-connected movement (diagonal allowed).
	 * When false (default), 4-connected only.
	 */
	diagonal: boolean
}

/**
 * Canonical pathfinder signature.
 * Pure and deterministic: same (grid, options) always returns the same PathResult.
 * `metrics.elapsedMs` is NOT produced inside the function — the caller wraps
 * the call with `performance.now()` and injects it after the call.
 */
export type Pathfinder = (grid: Grid, options: PathOptions) => PathResult
