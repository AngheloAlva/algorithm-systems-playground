/**
 * Merge Sort — top-down recursive variant.
 *
 * Splits the array into two halves recursively until base cases (length 0 or 1),
 * then merges sorted halves back together. Each element written to the merged
 * output emits a PLACE step; each element comparison in the merge phase emits
 * a COMPARE step.
 *
 * PLACE step: { indices: [destIndex], value: <element> } — allows replaying
 * the full sort by writing `arr[indices[0]] = value` for each PLACE step in order.
 *
 * This variant does NOT emit SWAP steps (merge sort does not swap).
 * metrics.swaps is always 0.
 *
 * Time complexity: O(n log n) all cases
 * Space complexity: O(n) for the merged output buffer
 *
 * ## No React / DOM imports
 */

import { SORT_STEP_KIND, type PseudoLine, type SortStep, type SortTraceResult } from "./types"

// ---------------------------------------------------------------------------
// Pseudocode — co-located with the algorithm
// ---------------------------------------------------------------------------

export const mergeSortPseudocode: PseudoLine[] = [
	{ id: 0, text: "function mergeSort(arr, left, right):" },
	{ id: 1, text: "  if left >= right: return" },
	{ id: 2, text: "  mid ← floor((left + right) / 2)" },
	{ id: 3, text: "  mergeSort(arr, left, mid)" },
	{ id: 4, text: "  mergeSort(arr, mid+1, right)" },
	{ id: 5, text: "  merge(arr, left, mid, right)" },
	{ id: 6, text: "function merge(arr, left, mid, right):" },
	{ id: 7, text: "  leftPart ← arr[left..mid]" },
	{ id: 8, text: "  rightPart ← arr[mid+1..right]" },
	{ id: 9, text: "  i ← 0; j ← 0; k ← left" },
	{ id: 10, text: "  while i < len(left) and j < len(right):" },
	{ id: 11, text: "    if leftPart[i] <= rightPart[j]:" },
	{ id: 12, text: "      arr[k] ← leftPart[i]; i ← i+1" },
	{ id: 13, text: "    else: arr[k] ← rightPart[j]; j ← j+1" },
	{ id: 14, text: "    k ← k+1" },
	{ id: 15, text: "  copy remaining elements" },
	{ id: 16, text: "  return arr" },
]

// ---------------------------------------------------------------------------
// Internal merge helper
// ---------------------------------------------------------------------------

function mergeParts(
	working: number[],
	left: number,
	mid: number,
	right: number,
	steps: SortStep[],
	metrics: { comparisons: number; swaps: number }
): void {
	const leftPart = working.slice(left, mid + 1)
	const rightPart = working.slice(mid + 1, right + 1)

	let i = 0
	let j = 0
	let k = left

	while (i < leftPart.length && j < rightPart.length) {
		// COMPARE — leftPart[i] vs rightPart[j]
		steps.push({ kind: SORT_STEP_KIND.COMPARE, indices: [left + i, mid + 1 + j], pseudocodeLine: 11 })
		metrics.comparisons++

		if (leftPart[i] <= rightPart[j]) {
			working[k] = leftPart[i]
			steps.push({ kind: SORT_STEP_KIND.PLACE, indices: [k], value: leftPart[i], pseudocodeLine: 12 })
			i++
		} else {
			working[k] = rightPart[j]
			steps.push({ kind: SORT_STEP_KIND.PLACE, indices: [k], value: rightPart[j], pseudocodeLine: 13 })
			j++
		}
		k++
	}

	// Copy remaining left elements
	while (i < leftPart.length) {
		working[k] = leftPart[i]
		steps.push({ kind: SORT_STEP_KIND.PLACE, indices: [k], value: leftPart[i], pseudocodeLine: 15 })
		i++
		k++
	}

	// Copy remaining right elements
	while (j < rightPart.length) {
		working[k] = rightPart[j]
		steps.push({ kind: SORT_STEP_KIND.PLACE, indices: [k], value: rightPart[j], pseudocodeLine: 15 })
		j++
		k++
	}
}

// ---------------------------------------------------------------------------
// Recursive helper
// ---------------------------------------------------------------------------

function mergeSortRecursive(
	working: number[],
	left: number,
	right: number,
	steps: SortStep[],
	metrics: { comparisons: number; swaps: number }
): void {
	if (left >= right) return

	const mid = Math.floor((left + right) / 2)
	mergeSortRecursive(working, left, mid, steps, metrics)
	mergeSortRecursive(working, mid + 1, right, steps, metrics)
	mergeParts(working, left, mid, right, steps, metrics)
}

// ---------------------------------------------------------------------------
// mergeSort
// ---------------------------------------------------------------------------

/**
 * Run merge sort (top-down recursive) on the input array and return a full trace.
 *
 * @param arr - Input array; never mutated.
 * @returns SortTraceResult with ordered steps and summary metrics.
 */
export function mergeSort(arr: ReadonlyArray<number>): SortTraceResult {
	const n = arr.length
	const steps: SortStep[] = []
	const metrics = { comparisons: 0, swaps: 0 }

	if (n === 0) {
		return { steps, metrics: { ...metrics, arrayLength: 0 } }
	}

	// Work on a mutable copy — original array is never touched
	const working = [...arr]

	if (n > 1) {
		mergeSortRecursive(working, 0, n - 1, steps, metrics)
	}

	steps.push({ kind: SORT_STEP_KIND.DONE, indices: [], pseudocodeLine: 16 })

	return {
		steps,
		metrics: { ...metrics, arrayLength: n },
	}
}
