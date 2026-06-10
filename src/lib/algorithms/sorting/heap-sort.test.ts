/**
 * Tests for heapSort trace generation.
 * Written before implementation (TDD — RED phase).
 */

import { describe, expect, it } from "vitest"
import { heapSort, heapSortPseudocode } from "./heap-sort"
import { SORT_STEP_KIND } from "./types"
import type { PseudoLine } from "./types"

// ---------------------------------------------------------------------------
// Helper: replay SWAP steps onto a copy of the input to reconstruct sorted arr
// ---------------------------------------------------------------------------

function replaySwaps(input: ReadonlyArray<number>, result: ReturnType<typeof heapSort>): number[] {
	const arr = [...input]
	for (const step of result.steps) {
		if (step.kind === SORT_STEP_KIND.SWAP) {
			const [i, j] = step.indices
			;[arr[i], arr[j]] = [arr[j], arr[i]]
		}
	}
	return arr
}

describe("heapSort", () => {
	it("sorts [5,3,1,4,2] correctly by replaying SWAP steps", () => {
		const input = [5, 3, 1, 4, 2]
		const result = heapSort(input)
		const sorted = replaySwaps(input, result)
		expect(sorted).toEqual([1, 2, 3, 4, 5])
	})

	it("already-sorted input [1,2,3,4,5] produces final state [1,2,3,4,5]", () => {
		const input = [1, 2, 3, 4, 5]
		const result = heapSort(input)
		const sorted = replaySwaps(input, result)
		expect(sorted).toEqual([1, 2, 3, 4, 5])
	})

	it("every step has a valid pseudocodeLine index", () => {
		const result = heapSort([3, 1, 4, 1, 5])
		const maxLine = heapSortPseudocode.length - 1
		for (const step of result.steps) {
			expect(step.pseudocodeLine).toBeGreaterThanOrEqual(0)
			expect(step.pseudocodeLine).toBeLessThanOrEqual(maxLine)
		}
	})

	it("reverse-sorted input produces metrics.comparisons > 0", () => {
		const result = heapSort([5, 4, 3, 2, 1])
		expect(result.metrics.comparisons).toBeGreaterThan(0)
	})

	it("does not mutate the original array", () => {
		const input = [5, 3, 1, 4, 2]
		const copy = [...input]
		heapSort(input)
		expect(input).toEqual(copy)
	})

	it("metrics.arrayLength equals input length", () => {
		const input = [3, 1, 4, 1, 5, 9, 2]
		const result = heapSort(input)
		expect(result.metrics.arrayLength).toBe(input.length)
	})

	it("handles a single-element array", () => {
		const result = heapSort([42])
		expect(result.metrics.comparisons).toBe(0)
		expect(result.metrics.swaps).toBe(0)
		expect(result.steps).toHaveLength(1)
		expect(result.steps[0].kind).toBe(SORT_STEP_KIND.DONE)
	})

	it("handles an empty array", () => {
		const result = heapSort([])
		expect(result.steps).toHaveLength(0)
		expect(result.metrics.comparisons).toBe(0)
	})

	it("metrics.comparisons equals number of COMPARE steps", () => {
		const result = heapSort([5, 3, 1, 4, 2])
		const compareCount = result.steps.filter((s) => s.kind === SORT_STEP_KIND.COMPARE).length
		expect(result.metrics.comparisons).toBe(compareCount)
	})

	it("metrics.swaps equals number of SWAP steps", () => {
		const result = heapSort([5, 3, 1, 4, 2])
		const swapCount = result.steps.filter((s) => s.kind === SORT_STEP_KIND.SWAP).length
		expect(result.metrics.swaps).toBe(swapCount)
	})
})

describe("heapSort DONE step", () => {
	it("DONE step pseudocodeLine points at a line whose text is '  return arr'", () => {
		const result = heapSort([5, 3, 1, 4, 2])
		const doneStep = result.steps.find((s) => s.kind === SORT_STEP_KIND.DONE)
		expect(doneStep).toBeDefined()
		const doneLine = heapSortPseudocode[doneStep!.pseudocodeLine]
		expect(doneLine.text).toBe("  return arr")
	})

	it("DONE step pseudocodeLine id is less than the heapify function header id", () => {
		const result = heapSort([5, 3, 1, 4, 2])
		const doneStep = result.steps.find((s) => s.kind === SORT_STEP_KIND.DONE)
		expect(doneStep).toBeDefined()
		const heapifyHeaderIdx = heapSortPseudocode.findIndex((l) => l.text.startsWith("function heapify"))
		expect(doneStep!.pseudocodeLine).toBeLessThan(heapifyHeaderIdx)
	})
})

describe("heapSortPseudocode", () => {
	it("is a non-empty PseudoLine array", () => {
		expect(Array.isArray(heapSortPseudocode)).toBe(true)
		expect(heapSortPseudocode.length).toBeGreaterThan(0)
	})

	it("each entry has id (number) and text (string)", () => {
		for (const line of heapSortPseudocode) {
			expect(typeof line.id).toBe("number")
			expect(typeof line.text).toBe("string")
		}
	})

	it("entries have sequential ids starting from 0", () => {
		heapSortPseudocode.forEach((line: PseudoLine, index: number) => {
			expect(line.id).toBe(index)
		})
	})
})
