/**
 * Tests for mergeSort trace generation.
 * Written before implementation (TDD — RED phase).
 */

import { describe, expect, it } from "vitest"
import { mergeSort, mergeSortPseudocode } from "./merge-sort"
import { SORT_STEP_KIND } from "./types"
import type { PseudoLine } from "./types"

// ---------------------------------------------------------------------------
// Helper: replay PLACE steps to reconstruct sorted array
// ---------------------------------------------------------------------------

function replaySteps(input: ReadonlyArray<number>, result: ReturnType<typeof mergeSort>): number[] {
	// mergeSort uses PLACE to write each element in the merged output.
	// PLACE shape: { indices: [destIndex], value: <element> }
	// Replay: arr[indices[0]] = value
	const arr = new Array<number>(input.length).fill(0)
	for (const step of result.steps) {
		if (step.kind === SORT_STEP_KIND.PLACE) {
			const destIndex = step.indices[0]
			if (step.value === undefined) {
				throw new Error(
					`Broken contract: PLACE step at index ${destIndex} is missing value. ` +
						`Replay convention requires value to be defined for merge sort PLACE steps.`
				)
			}
			arr[destIndex] = step.value
		}
	}
	return arr
}

describe("mergeSort", () => {
	it("sorts [5,3,1,4,2] correctly by replaying PLACE steps", () => {
		const input = [5, 3, 1, 4, 2]
		const result = mergeSort(input)
		const sorted = replaySteps(input, result)
		expect(sorted).toEqual([1, 2, 3, 4, 5])
	})

	it("empty array: steps is empty and metrics.comparisons === 0", () => {
		const result = mergeSort([])
		expect(result.steps).toHaveLength(0)
		expect(result.metrics.comparisons).toBe(0)
	})

	it("single-element array: exactly one DONE step and metrics.comparisons === 0", () => {
		const result = mergeSort([42])
		expect(result.steps).toHaveLength(1)
		expect(result.steps[0].kind).toBe(SORT_STEP_KIND.DONE)
		expect(result.metrics.comparisons).toBe(0)
	})

	it("metrics.comparisons counts every comparison in merge phase", () => {
		const result = mergeSort([5, 3, 1, 4, 2])
		const compareCount = result.steps.filter((s) => s.kind === SORT_STEP_KIND.COMPARE).length
		expect(result.metrics.comparisons).toBe(compareCount)
	})

	it("every step has a valid pseudocodeLine index", () => {
		const result = mergeSort([3, 1, 4, 1, 5])
		const maxLine = mergeSortPseudocode.length - 1
		for (const step of result.steps) {
			expect(step.pseudocodeLine).toBeGreaterThanOrEqual(0)
			expect(step.pseudocodeLine).toBeLessThanOrEqual(maxLine)
		}
	})

	it("already-sorted input still produces correct sorted output", () => {
		const input = [1, 2, 3, 4, 5]
		const result = mergeSort(input)
		const sorted = replaySteps(input, result)
		expect(sorted).toEqual([1, 2, 3, 4, 5])
	})

	it("reverse-sorted input produces metrics.comparisons > 0", () => {
		const result = mergeSort([5, 4, 3, 2, 1])
		expect(result.metrics.comparisons).toBeGreaterThan(0)
	})

	it("does not mutate the original array", () => {
		const input = [5, 3, 1, 4, 2]
		const copy = [...input]
		mergeSort(input)
		expect(input).toEqual(copy)
	})

	it("metrics.arrayLength equals input length", () => {
		const input = [3, 1, 4, 1, 5, 9, 2]
		const result = mergeSort(input)
		expect(result.metrics.arrayLength).toBe(input.length)
	})

	it("metrics.swaps is 0 (merge sort does not swap)", () => {
		const result = mergeSort([5, 3, 1, 4, 2])
		expect(result.metrics.swaps).toBe(0)
	})
})

describe("mergeSort DONE step", () => {
	it("DONE step pseudocodeLine points at a line whose text is '  return arr'", () => {
		const result = mergeSort([5, 3, 1, 4, 2])
		const doneStep = result.steps.find((s) => s.kind === SORT_STEP_KIND.DONE)
		expect(doneStep).toBeDefined()
		const doneLine = mergeSortPseudocode[doneStep!.pseudocodeLine]
		expect(doneLine.text).toBe("  return arr")
	})

	it("DONE step pseudocodeLine id is less than the merge function header id", () => {
		const result = mergeSort([5, 3, 1, 4, 2])
		const doneStep = result.steps.find((s) => s.kind === SORT_STEP_KIND.DONE)
		expect(doneStep).toBeDefined()
		const mergeHeaderIdx = mergeSortPseudocode.findIndex((l) => l.text.startsWith("function merge("))
		expect(doneStep!.pseudocodeLine).toBeLessThan(mergeHeaderIdx)
	})
})

describe("mergeSortPseudocode", () => {
	it("is a non-empty PseudoLine array", () => {
		expect(Array.isArray(mergeSortPseudocode)).toBe(true)
		expect(mergeSortPseudocode.length).toBeGreaterThan(0)
	})

	it("each entry has id (number) and text (string)", () => {
		for (const line of mergeSortPseudocode) {
			expect(typeof line.id).toBe("number")
			expect(typeof line.text).toBe("string")
		}
	})

	it("entries have sequential ids starting from 0", () => {
		mergeSortPseudocode.forEach((line: PseudoLine, index: number) => {
			expect(line.id).toBe(index)
		})
	})
})
