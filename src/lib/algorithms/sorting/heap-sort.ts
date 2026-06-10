/**
 * Heap Sort — standard max-heap in-place variant.
 *
 * Phase 1 (build heap): transforms the array into a max-heap by calling
 * heapify on every internal node from the last non-leaf up to the root.
 *
 * Phase 2 (extraction): repeatedly swaps the root (max element) to the end
 * of the unsorted region and calls heapify to restore the max-heap property
 * for the remaining elements.
 *
 * Emits COMPARE steps during heapify comparisons and SWAP steps for each
 * element exchange.
 *
 * Time complexity: O(n log n) all cases
 * Space complexity: O(1) extra (in-place on working copy; original never mutated)
 *
 * ## No React / DOM imports
 */

import { SORT_STEP_KIND, type PseudoLine, type SortStep, type SortTraceResult } from "./types"

// ---------------------------------------------------------------------------
// Pseudocode — co-located with the algorithm
// ---------------------------------------------------------------------------

export const heapSortPseudocode: PseudoLine[] = [
	{ id: 0, text: "function heapSort(arr):" },
	{ id: 1, text: "  n ← length(arr)" },
	{ id: 2, text: "  // Build max-heap" },
	{ id: 3, text: "  for i from floor(n/2)-1 down to 0:" },
	{ id: 4, text: "    heapify(arr, n, i)" },
	{ id: 5, text: "  // Extract elements from heap" },
	{ id: 6, text: "  for i from n-1 down to 1:" },
	{ id: 7, text: "    swap(arr[0], arr[i])" },
	{ id: 8, text: "    heapify(arr, i, 0)" },
	{ id: 9, text: "function heapify(arr, n, i):" },
	{ id: 10, text: "  largest ← i" },
	{ id: 11, text: "  left ← 2*i + 1; right ← 2*i + 2" },
	{ id: 12, text: "  if left < n and arr[left] > arr[largest]:" },
	{ id: 13, text: "    largest ← left" },
	{ id: 14, text: "  if right < n and arr[right] > arr[largest]:" },
	{ id: 15, text: "    largest ← right" },
	{ id: 16, text: "  if largest != i:" },
	{ id: 17, text: "    swap(arr[i], arr[largest])" },
	{ id: 18, text: "    heapify(arr, n, largest)" },
	{ id: 19, text: "  return arr" },
]

// ---------------------------------------------------------------------------
// Internal heapify helper
// ---------------------------------------------------------------------------

function heapify(
	working: number[],
	heapSize: number,
	rootIdx: number,
	steps: SortStep[],
	metrics: { comparisons: number; swaps: number }
): void {
	let largest = rootIdx
	const left = 2 * rootIdx + 1
	const right = 2 * rootIdx + 2

	if (left < heapSize) {
		// COMPARE — arr[left] vs arr[largest]
		steps.push({ kind: SORT_STEP_KIND.COMPARE, indices: [left, largest], pseudocodeLine: 12 })
		metrics.comparisons++
		if (working[left] > working[largest]) {
			largest = left
		}
	}

	if (right < heapSize) {
		// COMPARE — arr[right] vs arr[largest]
		steps.push({ kind: SORT_STEP_KIND.COMPARE, indices: [right, largest], pseudocodeLine: 14 })
		metrics.comparisons++
		if (working[right] > working[largest]) {
			largest = right
		}
	}

	if (largest !== rootIdx) {
		;[working[rootIdx], working[largest]] = [working[largest], working[rootIdx]]
		steps.push({ kind: SORT_STEP_KIND.SWAP, indices: [rootIdx, largest], pseudocodeLine: 17 })
		metrics.swaps++
		// Recursively heapify the affected sub-tree
		heapify(working, heapSize, largest, steps, metrics)
	}
}

// ---------------------------------------------------------------------------
// heapSort
// ---------------------------------------------------------------------------

/**
 * Run heap sort (max-heap in-place) on the input array and return a full trace.
 *
 * @param arr - Input array; never mutated.
 * @returns SortTraceResult with ordered steps and summary metrics.
 */
export function heapSort(arr: ReadonlyArray<number>): SortTraceResult {
	const n = arr.length
	const steps: SortStep[] = []
	const metrics = { comparisons: 0, swaps: 0 }

	if (n === 0) {
		return { steps, metrics: { ...metrics, arrayLength: 0 } }
	}

	// Work on a mutable copy — original array is never touched
	const working = [...arr]

	// Phase 1: Build max-heap
	for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
		heapify(working, n, i, steps, metrics)
	}

	// Phase 2: Extract elements — swap root (max) to end, shrink heap, heapify
	for (let i = n - 1; i > 0; i--) {
		;[working[0], working[i]] = [working[i], working[0]]
		steps.push({ kind: SORT_STEP_KIND.SWAP, indices: [0, i], pseudocodeLine: 7 })
		metrics.swaps++
		heapify(working, i, 0, steps, metrics)
	}

	steps.push({ kind: SORT_STEP_KIND.DONE, indices: [], pseudocodeLine: 19 })

	return {
		steps,
		metrics: { ...metrics, arrayLength: n },
	}
}
