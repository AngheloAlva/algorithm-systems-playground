/**
 * Tests for bubbleSort trace generation.
 * Written before implementation (TDD — RED phase).
 */

import { describe, expect, it } from "vitest"
import { bubbleSort, bubbleSortPseudocode } from "./bubble-sort"
import { SORT_STEP_KIND } from "./types"
import type { PseudoLine } from "./types"

// ---------------------------------------------------------------------------
// Helper: replay SWAP steps onto a copy of the input to reconstruct sorted arr
// ---------------------------------------------------------------------------

function replaySwaps(input: ReadonlyArray<number>, result: ReturnType<typeof bubbleSort>): number[] {
	const arr = [...input]
	for (const step of result.steps) {
		if (step.kind === SORT_STEP_KIND.SWAP) {
			const [i, j] = step.indices
			;[arr[i], arr[j]] = [arr[j], arr[i]]
		}
	}
	return arr
}

describe("bubbleSort", () => {
	it("sorts [5,3,1,4,2] correctly by replaying SWAP steps", () => {
		const input = [5, 3, 1, 4, 2]
		const result = bubbleSort(input)
		const sorted = replaySwaps(input, result)
		expect(sorted).toEqual([1, 2, 3, 4, 5])
	})

	it("metrics.comparisons equals number of COMPARE steps", () => {
		const result = bubbleSort([5, 3, 1, 4, 2])
		const compareCount = result.steps.filter((s) => s.kind === SORT_STEP_KIND.COMPARE).length
		expect(result.metrics.comparisons).toBe(compareCount)
	})

	it("metrics.swaps equals number of SWAP steps", () => {
		const result = bubbleSort([5, 3, 1, 4, 2])
		const swapCount = result.steps.filter((s) => s.kind === SORT_STEP_KIND.SWAP).length
		expect(result.metrics.swaps).toBe(swapCount)
	})

	it("every step has a valid pseudocodeLine index", () => {
		const result = bubbleSort([3, 1, 4, 1, 5])
		const maxLine = bubbleSortPseudocode.length - 1
		for (const step of result.steps) {
			expect(step.pseudocodeLine).toBeGreaterThanOrEqual(0)
			expect(step.pseudocodeLine).toBeLessThanOrEqual(maxLine)
		}
	})

	it("already-sorted input still produces correct sorted output", () => {
		const input = [1, 2, 3, 4, 5]
		const result = bubbleSort(input)
		const sorted = replaySwaps(input, result)
		expect(sorted).toEqual([1, 2, 3, 4, 5])
	})

	it("reverse-sorted input produces metrics.comparisons > 0", () => {
		const result = bubbleSort([5, 4, 3, 2, 1])
		expect(result.metrics.comparisons).toBeGreaterThan(0)
	})

	it("metrics.arrayLength equals input length", () => {
		const input = [3, 1, 4, 1, 5, 9, 2]
		const result = bubbleSort(input)
		expect(result.metrics.arrayLength).toBe(input.length)
	})

	it("does not mutate the original array", () => {
		const input = [5, 3, 1, 4, 2]
		const copy = [...input]
		bubbleSort(input)
		expect(input).toEqual(copy)
	})

	it("handles a single-element array", () => {
		const result = bubbleSort([42])
		expect(result.metrics.comparisons).toBe(0)
		expect(result.metrics.swaps).toBe(0)
	})

	it("handles an empty array", () => {
		const result = bubbleSort([])
		expect(result.steps).toHaveLength(0)
		expect(result.metrics.comparisons).toBe(0)
	})
})

describe("bubbleSortPseudocode", () => {
	it("is a non-empty PseudoLine array", () => {
		expect(Array.isArray(bubbleSortPseudocode)).toBe(true)
		expect(bubbleSortPseudocode.length).toBeGreaterThan(0)
	})

	it("each entry has id (number) and text (string)", () => {
		for (const line of bubbleSortPseudocode) {
			expect(typeof line.id).toBe("number")
			expect(typeof line.text).toBe("string")
		}
	})

	it("entries have sequential ids starting from 0", () => {
		bubbleSortPseudocode.forEach((line: PseudoLine, index: number) => {
			expect(line.id).toBe(index)
		})
	})
})
