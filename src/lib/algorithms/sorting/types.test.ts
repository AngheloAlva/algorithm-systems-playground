/**
 * Type-level smoke tests for sorting types.
 * These tests verify that the const objects and interfaces are shaped correctly.
 * No React/DOM imports allowed in this file.
 */

import { describe, expect, it } from "vitest"
import {
	SORT_STEP_KIND,
	type SortStepKind,
	type SortStep,
	type SortMetrics,
	type SortTraceResult,
	type PseudoLine,
} from "./types"

describe("SORT_STEP_KIND", () => {
	it("has COMPARE member", () => {
		expect(SORT_STEP_KIND.COMPARE).toBe("compare")
	})

	it("has SWAP member", () => {
		expect(SORT_STEP_KIND.SWAP).toBe("swap")
	})

	it("has PLACE member", () => {
		expect(SORT_STEP_KIND.PLACE).toBe("place")
	})

	it("has DONE member", () => {
		expect(SORT_STEP_KIND.DONE).toBe("done")
	})
})

describe("SortStep type", () => {
	it("accepts a COMPARE step", () => {
		const step: SortStep = {
			kind: SORT_STEP_KIND.COMPARE,
			indices: [0, 1],
			pseudocodeLine: 0,
		}
		expect(step.kind).toBe("compare")
		expect(step.indices).toEqual([0, 1])
	})

	it("accepts a SWAP step", () => {
		const step: SortStep = {
			kind: SORT_STEP_KIND.SWAP,
			indices: [2, 5],
			pseudocodeLine: 3,
		}
		expect(step.kind).toBe("swap")
	})

	it("accepts a PLACE step", () => {
		const step: SortStep = {
			kind: SORT_STEP_KIND.PLACE,
			indices: [4],
			pseudocodeLine: 7,
		}
		expect(step.kind).toBe("place")
	})

	it("accepts a DONE step", () => {
		const step: SortStep = {
			kind: SORT_STEP_KIND.DONE,
			indices: [],
			pseudocodeLine: 0,
		}
		expect(step.kind).toBe("done")
	})
})

describe("SortMetrics type", () => {
	it("accepts a valid SortMetrics object", () => {
		const metrics: SortMetrics = {
			comparisons: 10,
			swaps: 5,
			arrayLength: 7,
		}
		expect(metrics.comparisons).toBe(10)
		expect(metrics.swaps).toBe(5)
		expect(metrics.arrayLength).toBe(7)
	})
})

describe("SortTraceResult type", () => {
	it("accepts a valid SortTraceResult object", () => {
		const step: SortStep = {
			kind: SORT_STEP_KIND.COMPARE,
			indices: [0, 1],
			pseudocodeLine: 0,
		}
		const result: SortTraceResult = {
			steps: [step],
			metrics: {
				comparisons: 1,
				swaps: 0,
				arrayLength: 2,
			},
		}
		expect(result.steps).toHaveLength(1)
		expect(result.metrics.comparisons).toBe(1)
	})
})

describe("SortStepKind type", () => {
	it("can be assigned from SORT_STEP_KIND values", () => {
		const kind: SortStepKind = SORT_STEP_KIND.COMPARE
		expect(kind).toBe("compare")
	})
})

describe("PseudoLine re-export", () => {
	it("can construct a PseudoLine from the sorting types module", () => {
		const line: PseudoLine = { id: 0, text: "function bubbleSort(arr):" }
		expect(line.id).toBe(0)
		expect(line.text).toBe("function bubbleSort(arr):")
	})
})
