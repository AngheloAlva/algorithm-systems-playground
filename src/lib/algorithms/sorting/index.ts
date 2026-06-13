/**
 * Sorting algorithm registry — maps algorithm slug to implementation + metadata.
 *
 * Consumed by the UI layer (SortingVisualizer, PseudocodePanel) to look up the
 * sort function, pseudocode lines, and display name for any selected algorithm.
 *
 * ## Adding a new algorithm
 * 1. Implement it in its own file following the sort function signature.
 * 2. Export the sort function and a `*Pseudocode: PseudoLine[]` const.
 * 3. Add an entry to `SORT_ALGORITHM_REGISTRY` below.
 * 4. Extend the `SORT_ALGORITHM` const object.
 *
 * Mirrors src/lib/algorithms/pathfinding/index.ts structure and idioms.
 */

import type { PseudoLine, SortTraceResult } from "./types"
import { bubbleSort, bubbleSortPseudocode } from "./bubble-sort"
import { quickSort, quickSortPseudocode } from "./quick-sort"
import { mergeSort, mergeSortPseudocode } from "./merge-sort"
import { heapSort, heapSortPseudocode } from "./heap-sort"
import { insertionSort, insertionSortPseudocode } from "./insertion-sort"

// ---------------------------------------------------------------------------
// SortAlgorithm union type — const-then-type pattern (typescript skill)
// ---------------------------------------------------------------------------

export const SORT_ALGORITHM = {
	BUBBLE: "bubble",
	INSERTION: "insertion",
	QUICK: "quick",
	MERGE: "merge",
	HEAP: "heap",
} as const

export type SortAlgorithm = (typeof SORT_ALGORITHM)[keyof typeof SORT_ALGORITHM]

// ---------------------------------------------------------------------------
// Registry entry interface
// ---------------------------------------------------------------------------

export interface SortAlgorithmEntry {
	/** The sort function — pure, deterministic. */
	run: (arr: ReadonlyArray<number>) => SortTraceResult
	/** Pseudocode lines co-located with the algorithm. */
	pseudocode: PseudoLine[]
	/** Human-readable display name for UI dropdowns. */
	label: string
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const SORT_ALGORITHM_REGISTRY: Record<SortAlgorithm, SortAlgorithmEntry> = {
	bubble: {
		run: bubbleSort,
		pseudocode: bubbleSortPseudocode,
		label: "Bubble Sort",
	},
	insertion: {
		run: insertionSort,
		pseudocode: insertionSortPseudocode,
		label: "Insertion Sort",
	},
	quick: {
		run: quickSort,
		pseudocode: quickSortPseudocode,
		label: "Quick Sort",
	},
	merge: {
		run: mergeSort,
		pseudocode: mergeSortPseudocode,
		label: "Merge Sort",
	},
	heap: {
		run: heapSort,
		pseudocode: heapSortPseudocode,
		label: "Heap Sort",
	},
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export { bubbleSort, bubbleSortPseudocode } from "./bubble-sort"
export { insertionSort, insertionSortPseudocode } from "./insertion-sort"
export { quickSort, quickSortPseudocode } from "./quick-sort"
export { mergeSort, mergeSortPseudocode } from "./merge-sort"
export { heapSort, heapSortPseudocode } from "./heap-sort"
export { generateArray, MIN_ARRAY_LENGTH, MAX_ARRAY_LENGTH, ARRAY_MODE } from "./array-gen"
export type { ArrayMode } from "./array-gen"
export {
	SORT_STEP_KIND,
	type SortStep,
	type SortStepKind,
	type SortMetrics,
	type SortTraceResult,
	type PseudoLine,
} from "./types"
