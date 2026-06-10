/**
 * Shared types for sorting algorithm trace generation.
 *
 * Every sort function produces a SortTraceResult containing:
 *  - `steps`: the ordered sequence of SortSteps (for animation + pseudocode highlight)
 *  - `metrics`: summary statistics about the run
 *
 * ## Const-then-type pattern
 * SortStepKind is a const object first, then the type is derived from it.
 *
 * ## No React / DOM imports
 * This module is pure TypeScript — safe to import in Node/test/worker contexts.
 */

// Re-export PseudoLine from pathfinding types so sorting modules import from one place.
// MD-1: import from existing source, no new shared/ location needed.
export type { PseudoLine } from "../pathfinding/types"

// ---------------------------------------------------------------------------
// SortStepKind — const-then-type pattern (typescript skill)
// ---------------------------------------------------------------------------

export const SORT_STEP_KIND = {
	COMPARE: "compare",
	SWAP: "swap",
	PLACE: "place",
	DONE: "done",
} as const

export type SortStepKind = (typeof SORT_STEP_KIND)[keyof typeof SORT_STEP_KIND]

// ---------------------------------------------------------------------------
// SortStep interface
// ---------------------------------------------------------------------------

/**
 * A single step in the sorting trace.
 *
 * - `COMPARE` — two indices are being compared
 * - `SWAP` — two elements are being exchanged
 * - `PLACE` — an element is placed into its final sorted position
 * - `DONE` — the sort is complete
 */
export interface SortStep {
	kind: SortStepKind
	/**
	 * Array positions relevant to this step. Always contains valid array indices.
	 * - COMPARE: [indexA, indexB]
	 * - SWAP: [indexA, indexB]
	 * - PLACE: [destIndex] — the destination position being written
	 * - DONE: [] (empty)
	 */
	indices: readonly number[]
	/** 0-indexed line in the algorithm's own pseudocode array. */
	pseudocodeLine: number
	/**
	 * Element value being written; present only on PLACE steps that carry a value,
	 * e.g. merge sort's write-replay. Replay convention: when `value !== undefined`,
	 * write `arr[indices[0]] = value`. PLACE steps without `value` (e.g. quick sort's
	 * pivot-position marker) carry no element value and require no write during replay.
	 */
	value?: number
}

// ---------------------------------------------------------------------------
// SortMetrics interface
// ---------------------------------------------------------------------------

export interface SortMetrics {
	/** Total number of element comparisons performed. */
	comparisons: number
	/** Total number of element swaps performed. */
	swaps: number
	/** Length of the input array. */
	arrayLength: number
}

// ---------------------------------------------------------------------------
// SortTraceResult interface
// ---------------------------------------------------------------------------

export interface SortTraceResult {
	/** Ordered step sequence for animation playback and pseudocode highlighting. */
	steps: SortStep[]
	metrics: SortMetrics
}
