/**
 * replay-state — pure helpers to reconstruct array state from a sort trace.
 *
 * No React / DOM imports. Safe in Node / test / worker contexts.
 *
 * ## Trace contract (locked from PR5a review)
 * - SWAP: exchanges arr[indices[0]] and arr[indices[1]]
 * - PLACE (value !== undefined): writes arr[indices[0]] = value  (merge sort write-replay)
 * - PLACE (value === undefined): NO write  (quickSort pivot-position marker)
 * - COMPARE: no mutation
 * - DONE: no mutation
 */

import { SORT_STEP_KIND } from "./types"
import type { SortStep } from "./types"

// ---------------------------------------------------------------------------
// applyStep
// ---------------------------------------------------------------------------

/**
 * Apply one trace step to a working array IN PLACE, following the trace contract.
 *
 * @param arr - Working array; mutated in place.
 * @param step - The step to apply.
 */
export function applyStep(arr: number[], step: SortStep): void {
	switch (step.kind) {
		case SORT_STEP_KIND.SWAP: {
			const [a, b] = step.indices
			const tmp = arr[a]
			arr[a] = arr[b]
			arr[b] = tmp
			break
		}
		case SORT_STEP_KIND.PLACE: {
			// Only write when value is present (merge sort). quickSort PLACE has no value.
			if (step.value !== undefined) {
				arr[step.indices[0]] = step.value
			}
			break
		}
		// COMPARE and DONE: no mutation
		default:
			break
	}
}

// ---------------------------------------------------------------------------
// replayTo
// ---------------------------------------------------------------------------

/**
 * Return the array state after applying steps[0..cursor] (inclusive) to a
 * copy of `original`.
 *
 * @param original - The original unsorted array; never mutated.
 * @param steps - Full ordered step sequence from the trace.
 * @param cursor - Last step index to apply (0-indexed). Pass -1 to get original unchanged.
 * @returns A new array representing the array state at `cursor`.
 */
export function replayTo(
	original: ReadonlyArray<number>,
	steps: ReadonlyArray<SortStep>,
	cursor: number
): number[] {
	const arr = [...original]
	const end = Math.min(cursor, steps.length - 1)
	for (let i = 0; i <= end; i++) {
		applyStep(arr, steps[i])
	}
	return arr
}
