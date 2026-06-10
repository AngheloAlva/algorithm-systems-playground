/**
 * Tests for quickSort trace generation.
 * Written before implementation (TDD — RED phase).
 */

import { describe, expect, it } from "vitest"
import { quickSort, quickSortPseudocode } from "./quick-sort"
import { SORT_STEP_KIND } from "./types"
import type { PseudoLine } from "./types"

// ---------------------------------------------------------------------------
// Helper: replay steps to reconstruct array state
// ---------------------------------------------------------------------------

function replaySteps(input: ReadonlyArray<number>, result: ReturnType<typeof quickSort>): number[] {
	const arr = [...input]
	for (const step of result.steps) {
		if (step.kind === SORT_STEP_KIND.SWAP) {
			const [i, j] = step.indices
			;[arr[i], arr[j]] = [arr[j], arr[i]]
		} else if (step.kind === SORT_STEP_KIND.PLACE) {
			// PLACE marks the pivot's final position at step.indices[0].
			// Whether or not a SWAP preceded it (pivotPos === high means no SWAP was emitted),
			// no additional mutation is required during replay — the pivot's value is
			// already in the correct slot from prior SWAP steps or from the initial position.
		}
	}
	return arr
}

describe("quickSort", () => {
	it("sorts [3,1,4,1,5,9,2,6] correctly by replaying steps", () => {
		const input = [3, 1, 4, 1, 5, 9, 2, 6]
		const result = quickSort(input)
		const sorted = replaySteps(input, result)
		expect(sorted).toEqual([...input].sort((a, b) => a - b))
	})

	it("is deterministic — same input produces same SortTraceResult structure", () => {
		const input = [3, 1, 4, 1, 5, 9, 2, 6]
		const r1 = quickSort(input)
		const r2 = quickSort(input)
		expect(r1.steps.length).toBe(r2.steps.length)
		expect(r1.metrics).toEqual(r2.metrics)
	})

	it("every step has a valid pseudocodeLine index", () => {
		const result = quickSort([3, 1, 4, 1, 5])
		const maxLine = quickSortPseudocode.length - 1
		for (const step of result.steps) {
			expect(step.pseudocodeLine).toBeGreaterThanOrEqual(0)
			expect(step.pseudocodeLine).toBeLessThanOrEqual(maxLine)
		}
	})

	it("already-sorted input still produces correct sorted output", () => {
		const input = [1, 2, 3, 4, 5]
		const result = quickSort(input)
		const sorted = replaySteps(input, result)
		expect(sorted).toEqual([1, 2, 3, 4, 5])
	})

	it("reverse-sorted input produces metrics.comparisons > 0", () => {
		const result = quickSort([5, 4, 3, 2, 1])
		expect(result.metrics.comparisons).toBeGreaterThan(0)
	})

	it("does not mutate the original array", () => {
		const input = [3, 1, 4, 1, 5]
		const copy = [...input]
		quickSort(input)
		expect(input).toEqual(copy)
	})

	it("metrics.arrayLength equals input length", () => {
		const input = [3, 1, 4]
		const result = quickSort(input)
		expect(result.metrics.arrayLength).toBe(input.length)
	})

	it("handles a single-element array", () => {
		const result = quickSort([42])
		expect(result.metrics.comparisons).toBe(0)
		expect(result.metrics.swaps).toBe(0)
		expect(result.steps).toHaveLength(1)
		expect(result.steps[0].kind).toBe(SORT_STEP_KIND.DONE)
	})

	it("handles an empty array", () => {
		const result = quickSort([])
		expect(result.steps).toHaveLength(0)
		expect(result.metrics.comparisons).toBe(0)
	})

	it("metrics.comparisons equals number of COMPARE steps", () => {
		// [3,1,4,1,5] exercises partitioning with duplicate values and the
		// i===j skipped-self-swap path, making the consistency check non-trivial.
		const result = quickSort([3, 1, 4, 1, 5])
		const compareCount = result.steps.filter((s) => s.kind === SORT_STEP_KIND.COMPARE).length
		expect(result.metrics.comparisons).toBe(compareCount)
	})

	it("metrics.swaps equals number of SWAP steps", () => {
		// Same input exercises the i===j guard (self-swaps are skipped); confirms
		// metrics.swaps counts only emitted SWAP steps, not skipped self-swaps.
		const result = quickSort([3, 1, 4, 1, 5])
		const swapCount = result.steps.filter((s) => s.kind === SORT_STEP_KIND.SWAP).length
		expect(result.metrics.swaps).toBe(swapCount)
	})
})

describe("quickSortPseudocode", () => {
	it("is a non-empty PseudoLine array", () => {
		expect(Array.isArray(quickSortPseudocode)).toBe(true)
		expect(quickSortPseudocode.length).toBeGreaterThan(0)
	})

	it("each entry has id (number) and text (string)", () => {
		for (const line of quickSortPseudocode) {
			expect(typeof line.id).toBe("number")
			expect(typeof line.text).toBe("string")
		}
	})

	it("entries have sequential ids starting from 0", () => {
		quickSortPseudocode.forEach((line: PseudoLine, index: number) => {
			expect(line.id).toBe(index)
		})
	})
})
