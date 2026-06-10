/**
 * Quick Sort — Lomuto partition scheme.
 *
 * The Lomuto partition picks the LAST element as the pivot. After partitioning,
 * the pivot is placed in its correct final sorted position. Elements less than
 * the pivot are to its left; elements greater are to its right.
 *
 * This variant emits:
 *  - COMPARE steps for each element compared against the pivot
 *  - SWAP steps for each element that moves left of the pivot boundary
 *  - PLACE step when the pivot is moved into its final position
 *  - DONE step at the end
 *
 * Time complexity: O(n log n) average; O(n²) worst (already sorted input)
 * Space complexity: O(log n) stack depth (recursive call stack)
 *
 * ## No React / DOM imports
 */

import { SORT_STEP_KIND, type SortStep, type SortTraceResult } from "./types"
import type { PseudoLine } from "./types"

// ---------------------------------------------------------------------------
// Pseudocode — co-located with the algorithm
// ---------------------------------------------------------------------------

export const quickSortPseudocode: PseudoLine[] = [
	{ id: 0, text: "function quickSort(arr, low, high):" },
	{ id: 1, text: "  if low >= high: return" },
	{ id: 2, text: "  pivotIndex ← partition(arr, low, high)" },
	{ id: 3, text: "  quickSort(arr, low, pivotIndex - 1)" },
	{ id: 4, text: "  quickSort(arr, pivotIndex + 1, high)" },
	{ id: 5, text: "function partition(arr, low, high):" },
	{ id: 6, text: "  pivot ← arr[high]" },
	{ id: 7, text: "  i ← low - 1" },
	{ id: 8, text: "  for j from low to high-1:" },
	{ id: 9, text: "    if arr[j] <= pivot:" },
	{ id: 10, text: "      i ← i + 1" },
	{ id: 11, text: "      swap(arr[i], arr[j])" },
	{ id: 12, text: "  swap(arr[i+1], arr[high])  // place pivot" },
	{ id: 13, text: "  return i + 1" },
]

// ---------------------------------------------------------------------------
// Internal Lomuto partition
// ---------------------------------------------------------------------------

function lomutoPartition(
	working: number[],
	low: number,
	high: number,
	steps: SortStep[],
	metrics: { comparisons: number; swaps: number }
): number {
	const pivot = working[high]
	let i = low - 1

	for (let j = low; j < high; j++) {
		// COMPARE — current element vs pivot
		steps.push({ kind: SORT_STEP_KIND.COMPARE, indices: [j, high], pseudocodeLine: 9 })
		metrics.comparisons++

		if (working[j] <= pivot) {
			i++
			if (i !== j) {
				;[working[i], working[j]] = [working[j], working[i]]
				steps.push({ kind: SORT_STEP_KIND.SWAP, indices: [i, j], pseudocodeLine: 11 })
				metrics.swaps++
			}
		}
	}

	// Place pivot in its final sorted position
	const pivotPos = i + 1
	if (pivotPos !== high) {
		;[working[pivotPos], working[high]] = [working[high], working[pivotPos]]
		steps.push({ kind: SORT_STEP_KIND.SWAP, indices: [pivotPos, high], pseudocodeLine: 12 })
		metrics.swaps++
	}
	steps.push({ kind: SORT_STEP_KIND.PLACE, indices: [pivotPos], pseudocodeLine: 12 })

	return pivotPos
}

// ---------------------------------------------------------------------------
// Recursive helper
// ---------------------------------------------------------------------------

function quickSortRecursive(
	working: number[],
	low: number,
	high: number,
	steps: SortStep[],
	metrics: { comparisons: number; swaps: number }
): void {
	if (low >= high) return

	const pivotIndex = lomutoPartition(working, low, high, steps, metrics)
	quickSortRecursive(working, low, pivotIndex - 1, steps, metrics)
	quickSortRecursive(working, pivotIndex + 1, high, steps, metrics)
}

// ---------------------------------------------------------------------------
// quickSort
// ---------------------------------------------------------------------------

/**
 * Run quicksort (Lomuto partition scheme) on the input array and return a full trace.
 *
 * @param arr - Input array; never mutated.
 * @returns SortTraceResult with ordered steps and summary metrics.
 */
export function quickSort(arr: ReadonlyArray<number>): SortTraceResult {
	const n = arr.length
	const steps: SortStep[] = []
	const metrics = { comparisons: 0, swaps: 0 }

	if (n === 0) {
		return { steps, metrics: { ...metrics, arrayLength: 0 } }
	}

	// Work on a mutable copy — original array is never touched
	const working = [...arr]
	quickSortRecursive(working, 0, n - 1, steps, metrics)

	steps.push({ kind: SORT_STEP_KIND.DONE, indices: [], pseudocodeLine: 4 })

	return {
		steps,
		metrics: { ...metrics, arrayLength: n },
	}
}
