/**
 * Tests for replay-state helpers.
 *
 * applyStep(arr, step) — mutates arr in place per the trace contract.
 * replayTo(original, steps, cursor) — returns array state after steps[0..cursor].
 *
 * Contract:
 *   - SWAP: exchanges arr[indices[0]] and arr[indices[1]]
 *   - PLACE (value !== undefined): writes arr[indices[0]] = value
 *   - PLACE (value === undefined): NO write (quickSort pivot marker)
 *   - COMPARE: no mutation
 *   - DONE: no mutation
 *
 * Property: replayTo(original, steps, lastCursor) === [...original].sort((a,b)=>a-b)
 *   for bubble, heap, merge, and quick sort traces.
 */

import { describe, it, expect } from "vitest"
import { applyStep, replayTo } from "./replay-state"
import { SORT_STEP_KIND } from "./types"
import type { SortStep } from "./types"
import { bubbleSort } from "./bubble-sort"
import { mergeSort } from "./merge-sort"
import { quickSort } from "./quick-sort"
import { heapSort } from "./heap-sort"

// ---------------------------------------------------------------------------
// applyStep unit tests
// ---------------------------------------------------------------------------

describe("applyStep", () => {
	it("SWAP exchanges the two indices", () => {
		const arr = [3, 1, 4]
		const step: SortStep = { kind: SORT_STEP_KIND.SWAP, indices: [0, 1], pseudocodeLine: 0 }
		applyStep(arr, step)
		expect(arr).toEqual([1, 3, 4])
	})

	it("PLACE with value writes arr[indices[0]] = value", () => {
		const arr = [3, 1, 4]
		const step: SortStep = {
			kind: SORT_STEP_KIND.PLACE,
			indices: [2],
			value: 9,
			pseudocodeLine: 0,
		}
		applyStep(arr, step)
		expect(arr[2]).toBe(9)
	})

	it("PLACE without value does NOT write (quickSort pivot marker)", () => {
		const arr = [3, 1, 4]
		const step: SortStep = {
			kind: SORT_STEP_KIND.PLACE,
			indices: [1],
			// value intentionally absent
			pseudocodeLine: 0,
		}
		applyStep(arr, step)
		// array must be unchanged
		expect(arr).toEqual([3, 1, 4])
	})

	it("COMPARE does not mutate arr", () => {
		const arr = [3, 1, 4]
		const step: SortStep = {
			kind: SORT_STEP_KIND.COMPARE,
			indices: [0, 1],
			pseudocodeLine: 0,
		}
		applyStep(arr, step)
		expect(arr).toEqual([3, 1, 4])
	})

	it("DONE does not mutate arr", () => {
		const arr = [3, 1, 4]
		const step: SortStep = { kind: SORT_STEP_KIND.DONE, indices: [], pseudocodeLine: 0 }
		applyStep(arr, step)
		expect(arr).toEqual([3, 1, 4])
	})
})

// ---------------------------------------------------------------------------
// replayTo unit tests
// ---------------------------------------------------------------------------

describe("replayTo", () => {
	it("cursor=-1 returns a copy of original unchanged", () => {
		const original = [5, 3, 1]
		const steps: SortStep[] = [
			{ kind: SORT_STEP_KIND.SWAP, indices: [0, 1], pseudocodeLine: 0 },
		]
		const result = replayTo(original, steps, -1)
		expect(result).toEqual([5, 3, 1])
	})

	it("cursor=0 applies exactly the first step", () => {
		const original = [5, 3, 1]
		const steps: SortStep[] = [
			{ kind: SORT_STEP_KIND.SWAP, indices: [0, 1], pseudocodeLine: 0 },
			{ kind: SORT_STEP_KIND.SWAP, indices: [1, 2], pseudocodeLine: 0 },
		]
		const result = replayTo(original, steps, 0)
		// only step[0] applied: swap(0,1) on [5,3,1] → [3,5,1]
		expect(result).toEqual([3, 5, 1])
	})

	it("does not mutate original", () => {
		const original = [5, 3, 1]
		const steps: SortStep[] = [
			{ kind: SORT_STEP_KIND.SWAP, indices: [0, 2], pseudocodeLine: 0 },
		]
		replayTo(original, steps, 0)
		expect(original).toEqual([5, 3, 1])
	})

	it("empty steps returns copy of original", () => {
		const original = [2, 1]
		const result = replayTo(original, [], 0)
		expect(result).toEqual([2, 1])
	})
})

// ---------------------------------------------------------------------------
// Property: replayTo(original, steps, last) === sorted — all four algorithms
// ---------------------------------------------------------------------------

const INPUTS = [
	[5, 3, 1, 4, 2],
	[1, 2, 3, 4, 5],
	[5, 4, 3, 2, 1],
	[1],
	[7, 7, 7],
	[42, 1],
]

function sorted(arr: ReadonlyArray<number>): number[] {
	return [...arr].sort((a, b) => a - b)
}

describe("replayTo — bubble sort traces reach sorted state at final cursor", () => {
	for (const input of INPUTS) {
		it(`input=${JSON.stringify(input)}`, () => {
			const frozenInput = Object.freeze([...input])
			const trace = bubbleSort(frozenInput)
			const lastCursor = trace.steps.length - 1
			if (lastCursor < 0) {
				// empty array: no steps, nothing to replay
				expect(frozenInput).toEqual([])
				return
			}
			const result = replayTo(frozenInput, trace.steps, lastCursor)
			expect(result).toEqual(sorted(frozenInput))
		})
	}
})

describe("replayTo — merge sort traces reach sorted state at final cursor", () => {
	for (const input of INPUTS) {
		it(`input=${JSON.stringify(input)}`, () => {
			const frozenInput = Object.freeze([...input])
			const trace = mergeSort(frozenInput)
			const lastCursor = trace.steps.length - 1
			if (lastCursor < 0) {
				expect(frozenInput).toEqual([])
				return
			}
			const result = replayTo(frozenInput, trace.steps, lastCursor)
			expect(result).toEqual(sorted(frozenInput))
		})
	}
})

describe("replayTo — quick sort traces reach sorted state at final cursor", () => {
	for (const input of INPUTS) {
		it(`input=${JSON.stringify(input)}`, () => {
			const frozenInput = Object.freeze([...input])
			const trace = quickSort(frozenInput)
			const lastCursor = trace.steps.length - 1
			if (lastCursor < 0) {
				expect(frozenInput).toEqual([])
				return
			}
			const result = replayTo(frozenInput, trace.steps, lastCursor)
			expect(result).toEqual(sorted(frozenInput))
		})
	}
})

describe("replayTo — heap sort traces reach sorted state at final cursor", () => {
	for (const input of INPUTS) {
		it(`input=${JSON.stringify(input)}`, () => {
			const frozenInput = Object.freeze([...input])
			const trace = heapSort(frozenInput)
			const lastCursor = trace.steps.length - 1
			if (lastCursor < 0) {
				expect(frozenInput).toEqual([])
				return
			}
			const result = replayTo(frozenInput, trace.steps, lastCursor)
			expect(result).toEqual(sorted(frozenInput))
		})
	}
})

describe("replayTo — quick sort PLACE (no value) does not corrupt array", () => {
	it("any PLACE step with undefined value must not write to array", () => {
		const input = [3, 1, 2]
		const frozenInput = Object.freeze([...input])
		const trace = quickSort(frozenInput)
		const placeSteps = trace.steps.filter(
			(s) => s.kind === SORT_STEP_KIND.PLACE && s.value === undefined
		)
		// quickSort emits at least one valueless PLACE for each partition pivot placement
		// For a 3-element input we expect at least one
		expect(placeSteps.length).toBeGreaterThan(0)

		// Ensure replayTo does not corrupt: final result is still sorted
		const lastCursor = trace.steps.length - 1
		const result = replayTo(frozenInput, trace.steps, lastCursor)
		expect(result).toEqual(sorted(frozenInput))
	})
})

describe("replayTo — merge sort PLACE (with value) writes correctly", () => {
	it("all merge PLACE steps carry a value", () => {
		const input = [3, 1, 2]
		const frozenInput = Object.freeze([...input])
		const trace = mergeSort(frozenInput)
		const placeSteps = trace.steps.filter((s) => s.kind === SORT_STEP_KIND.PLACE)
		for (const step of placeSteps) {
			expect(step.value).not.toBeUndefined()
		}
	})
})

describe("replayTo — intermediate cursors produce valid intermediate states", () => {
	it("bubble sort: state at cursor k matches reference replay", () => {
		const input = [5, 3, 1, 4, 2]
		const frozenInput = Object.freeze([...input])
		const trace = bubbleSort(frozenInput)
		// Test at several cursors by comparing replayTo against a reference loop
		const refArr = [...frozenInput]
		for (let k = 0; k < Math.min(trace.steps.length, 10); k++) {
			applyStep(refArr, trace.steps[k])
			const result = replayTo(frozenInput, trace.steps, k)
			expect(result).toEqual(refArr)
		}
	})

	it("merge sort: state at cursor k matches reference replay", () => {
		const input = [5, 3, 1, 4, 2]
		const frozenInput = Object.freeze([...input])
		const trace = mergeSort(frozenInput)
		const refArr = [...frozenInput]
		for (let k = 0; k < Math.min(trace.steps.length, 10); k++) {
			applyStep(refArr, trace.steps[k])
			const result = replayTo(frozenInput, trace.steps, k)
			expect(result).toEqual(refArr)
		}
	})
})
