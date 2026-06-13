/**
 * Sweep benchmark runner — pure.
 *
 * Runs all 5 algorithms across a fixed set of array sizes (SWEEP_SIZES) and
 * collects comparison counts per algorithm at each size. Used to visualize
 * asymptotic divergence between O(n²) and O(n log n) algorithms.
 *
 * Design decisions (ADR-B):
 * - Fixed SWEEP_SIZES = [10, 25, 50, 100, 200]: stable x-axis for pedagogical clarity.
 * - Comparisons only (not swaps): cleanest monotonic complexity signal for all algorithms.
 * - Per-size derived seed (seed + sizeIndex): each size gets a distinct but reproducible
 *   array, avoiding identical relative orderings across sizes while staying deterministic.
 *
 * ## No React / DOM imports
 */

import {
	SORT_ALGORITHM_REGISTRY,
	generateArray,
	type SortAlgorithm,
	type ArrayMode,
} from "../algorithms/sorting/index"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SWEEP_SIZES = [10, 25, 50, 100, 200] as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SweepPoint {
	/** Array size at this measurement point. */
	n: number
	/** Comparison count per algorithm at this size. */
	comparisons: Record<SortAlgorithm, number>
}

export interface SweepResult {
	/** Array mode used across all sizes. */
	mode: ArrayMode
	/** Base seed used (each size derives its own seed from this). */
	seed: number
	/** One point per SWEEP_SIZES entry. */
	points: SweepPoint[]
}

// ---------------------------------------------------------------------------
// runSweep
// ---------------------------------------------------------------------------

/**
 * Run all registered sorting algorithms across the fixed SWEEP_SIZES and
 * return comparison counts per algorithm at each size.
 *
 * @param mode - Array generation mode (shared across all sizes).
 * @param seed - Base seed; each size uses a derived seed (seed + sizeIndex) to
 *               produce distinct but reproducible arrays at each size.
 * @returns SweepResult with one point per SWEEP_SIZES entry.
 */
export function runSweep(mode: ArrayMode, seed: number): SweepResult {
	const points: SweepPoint[] = SWEEP_SIZES.map((n, sizeIndex) => {
		// Derive a per-size seed so each size gets a different array ordering
		// while remaining reproducible given the same base seed.
		const perSizeSeed = seed + sizeIndex
		const arr = generateArray(n, mode, perSizeSeed)

		const comparisons = {} as Record<SortAlgorithm, number>

		for (const [key, entry] of Object.entries(SORT_ALGORITHM_REGISTRY)) {
			const traceResult = entry.run(arr)
			comparisons[key as SortAlgorithm] = traceResult.metrics.comparisons
		}

		return { n, comparisons }
	})

	return { mode, seed, points }
}
