/**
 * Bubble Sort — standard nested-loop variant.
 *
 * Each outer pass bubbles the largest unsorted element to its correct position
 * at the end of the unsorted region. An early-exit flag (swapped) skips
 * remaining passes when no swaps occurred (best-case O(n) on already-sorted input).
 *
 * Time complexity: O(n²) average/worst; O(n) best (already sorted)
 * Space complexity: O(1) extra (in-place on working copy; original never mutated)
 *
 * ## No React / DOM imports
 */

import { SORT_STEP_KIND, type SortStep, type SortTraceResult } from "./types"
import type { PseudoLine } from "./types"

// ---------------------------------------------------------------------------
// Pseudocode — co-located with the algorithm
// ---------------------------------------------------------------------------

export const bubbleSortPseudocode: PseudoLine[] = [
	{ id: 0, text: "function bubbleSort(arr):" },
	{ id: 1, text: "  n ← length(arr)" },
	{ id: 2, text: "  for i from 0 to n-2:" },
	{ id: 3, text: "    swapped ← false" },
	{ id: 4, text: "    for j from 0 to n-2-i:" },
	{ id: 5, text: "      if arr[j] > arr[j+1]:" },
	{ id: 6, text: "        swap(arr[j], arr[j+1])" },
	{ id: 7, text: "        swapped ← true" },
	{ id: 8, text: "    if not swapped: break" },
	{ id: 9, text: "  return arr" },
]

// ---------------------------------------------------------------------------
// bubbleSort
// ---------------------------------------------------------------------------

/**
 * Run bubble sort on the input array and return a full trace.
 *
 * @param arr - Input array; never mutated.
 * @returns SortTraceResult with ordered steps and summary metrics.
 */
export function bubbleSort(arr: ReadonlyArray<number>): SortTraceResult {
	const n = arr.length
	const steps: SortStep[] = []
	let comparisons = 0
	let swaps = 0

	if (n === 0) {
		return { steps, metrics: { comparisons, swaps, arrayLength: 0 } }
	}

	// Work on a mutable copy — original array is never touched
	const working = [...arr]

	for (let i = 0; i < n - 1; i++) {
		let swapped = false

		for (let j = 0; j < n - 1 - i; j++) {
			// COMPARE step — two adjacent elements are being evaluated
			steps.push({ kind: SORT_STEP_KIND.COMPARE, indices: [j, j + 1], pseudocodeLine: 5 })
			comparisons++

			if (working[j] > working[j + 1]) {
				// SWAP step — elements exchanged in working copy
				;[working[j], working[j + 1]] = [working[j + 1], working[j]]
				steps.push({ kind: SORT_STEP_KIND.SWAP, indices: [j, j + 1], pseudocodeLine: 6 })
				swaps++
				swapped = true
			}
		}

		// Early exit — array already sorted
		if (!swapped) break
	}

	steps.push({ kind: SORT_STEP_KIND.DONE, indices: [], pseudocodeLine: 9 })

	return {
		steps,
		metrics: { comparisons, swaps, arrayLength: n },
	}
}
