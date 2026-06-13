/**
 * Insertion Sort — standard in-place comparison sort.
 *
 * For each element at position i (starting from 1), shift elements greater than
 * it one position to the right until the correct insertion point is found.
 *
 * Time complexity: O(n²) average/worst; O(n) best (already sorted)
 * Space complexity: O(1) extra (in-place on working copy; original never mutated)
 *
 * ## No React / DOM imports
 */

import { SORT_STEP_KIND, type PseudoLine, type SortStep, type SortTraceResult } from "./types"

// ---------------------------------------------------------------------------
// Pseudocode — co-located with the algorithm
// ---------------------------------------------------------------------------

export const insertionSortPseudocode: PseudoLine[] = [
	{ id: 0, text: "function insertionSort(arr):" },
	{ id: 1, text: "  for i from 1 to n-1:" },
	{ id: 2, text: "    key ← arr[i]" },
	{ id: 3, text: "    j ← i - 1" },
	{ id: 4, text: "    while j >= 0 and arr[j] > key:" },
	{ id: 5, text: "      arr[j+1] ← arr[j]" },
	{ id: 6, text: "      j ← j - 1" },
	{ id: 7, text: "    arr[j+1] ← key" },
	{ id: 8, text: "  return arr" },
]

// ---------------------------------------------------------------------------
// insertionSort
// ---------------------------------------------------------------------------

/**
 * Run insertion sort on the input array and return a full trace.
 *
 * @param arr - Input array; never mutated.
 * @returns SortTraceResult with ordered steps and summary metrics.
 */
export function insertionSort(arr: ReadonlyArray<number>): SortTraceResult {
	const n = arr.length
	const steps: SortStep[] = []
	let comparisons = 0
	let swaps = 0

	if (n === 0) {
		return { steps, metrics: { comparisons, swaps, arrayLength: 0 } }
	}

	// Work on a mutable copy — original array is never touched
	const working = [...arr]

	for (let i = 1; i < n; i++) {
		const key = working[i]
		let j = i - 1

		while (j >= 0) {
			// COMPARE step — key vs working[j]
			steps.push({ kind: SORT_STEP_KIND.COMPARE, indices: [j, j + 1], pseudocodeLine: 4 })
			comparisons++

			if (working[j] > key) {
				// SWAP step — shift element right
				working[j + 1] = working[j]
				steps.push({ kind: SORT_STEP_KIND.SWAP, indices: [j, j + 1], pseudocodeLine: 5 })
				swaps++
				j--
			} else {
				// Element is in the right position — stop inner loop
				break
			}
		}

		// Place the key in its correct position
		working[j + 1] = key
	}

	steps.push({ kind: SORT_STEP_KIND.DONE, indices: [], pseudocodeLine: 8 })

	return {
		steps,
		metrics: { comparisons, swaps, arrayLength: n },
	}
}
