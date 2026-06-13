/**
 * Snapshot benchmark runner — pure.
 *
 * Runs all 5 algorithms in SORT_ALGORITHM_REGISTRY against a single generated array
 * and collects comparison count, swap count, and step count per algorithm.
 *
 * This is the data source for the SnapshotChart (grouped BarChart) and MetricsTable.
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
// Types
// ---------------------------------------------------------------------------

export interface AlgorithmMetricsRow {
	/** Algorithm slug key (e.g. "bubble", "insertion"). */
	algorithm: SortAlgorithm
	/** Human-readable display label (e.g. "Bubble Sort"). */
	label: string
	/** Total comparisons performed. */
	comparisons: number
	/** Total swaps performed (0 for Merge Sort which uses PLACE steps). */
	swaps: number
	/** Total step count (steps.length) from the trace. */
	steps: number
}

export interface SnapshotResult {
	/** The array length used for this snapshot run. */
	arrayLength: number
	/** The array mode used. */
	arrayMode: ArrayMode
	/** The seed used (relevant only for RANDOM mode). */
	seed: number
	/** One row per algorithm in registry order. */
	rows: AlgorithmMetricsRow[]
}

// ---------------------------------------------------------------------------
// runSnapshot
// ---------------------------------------------------------------------------

/**
 * Run all registered sorting algorithms against a single generated array
 * and return their aggregated metrics.
 *
 * @param length - Array length; clamped by generateArray to [MIN, MAX].
 * @param mode   - Array generation mode.
 * @param seed   - Seed for RANDOM mode; makes results reproducible.
 * @returns SnapshotResult with one row per algorithm.
 */
export function runSnapshot(length: number, mode: ArrayMode, seed: number): SnapshotResult {
	const arr = generateArray(length, mode, seed)

	const rows: AlgorithmMetricsRow[] = Object.entries(SORT_ALGORITHM_REGISTRY).map(
		([key, entry]) => {
			const traceResult = entry.run(arr)
			return {
				algorithm: key as SortAlgorithm,
				label: entry.label,
				comparisons: traceResult.metrics.comparisons,
				swaps: traceResult.metrics.swaps,
				steps: traceResult.steps.length,
			}
		}
	)

	return {
		arrayLength: arr.length,
		arrayMode: mode,
		seed,
		rows,
	}
}
