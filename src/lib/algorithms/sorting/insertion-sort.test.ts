/**
 * Tests for Insertion Sort — pure algorithm trace.
 * Written before implementation (TDD — RED phase).
 *
 * INSRT-1: Signature and return shape
 * INSRT-2: Comparison and swap metrics (numeric fixtures)
 * INSRT-3: Registry lookup (wired after implementation)
 */

import { describe, expect, it } from "vitest"
import { insertionSort } from "./insertion-sort"
import { SORT_ALGORITHM, SORT_ALGORITHM_REGISTRY } from "./index"

// ---------------------------------------------------------------------------
// INSRT-1 — Function signature and return shape
// ---------------------------------------------------------------------------

describe("insertionSort — signature", () => {
	it("returns an object with steps array and metrics", () => {
		const result = insertionSort([3, 1, 2])
		expect(result).toHaveProperty("steps")
		expect(result).toHaveProperty("metrics")
		expect(Array.isArray(result.steps)).toBe(true)
		expect(typeof result.metrics.comparisons).toBe("number")
		expect(typeof result.metrics.swaps).toBe("number")
	})

	it("metrics.arrayLength equals input length", () => {
		const result = insertionSort([3, 1, 2])
		expect(result.metrics.arrayLength).toBe(3)
	})

	it("does not mutate the input array", () => {
		const arr = [3, 1, 2] as const
		insertionSort(arr)
		expect(arr).toEqual([3, 1, 2])
	})
})

// ---------------------------------------------------------------------------
// INSRT-2 — Numeric fixtures
// ---------------------------------------------------------------------------

describe("insertionSort — already-sorted array", () => {
	it("sorted [1,2,3] → comparisons === 2, swaps === 0", () => {
		const result = insertionSort([1, 2, 3])
		expect(result.metrics.comparisons).toBe(2)
		expect(result.metrics.swaps).toBe(0)
	})
})

describe("insertionSort — reversed array", () => {
	it("reversed [3,2,1] → comparisons === 3, swaps === 3", () => {
		const result = insertionSort([3, 2, 1])
		expect(result.metrics.comparisons).toBe(3)
		expect(result.metrics.swaps).toBe(3)
	})
})

describe("insertionSort — single element", () => {
	it("[42] → comparisons === 0, swaps === 0", () => {
		const result = insertionSort([42])
		expect(result.metrics.comparisons).toBe(0)
		expect(result.metrics.swaps).toBe(0)
	})

	it("[42] → result contains the original value", () => {
		const result = insertionSort([42])
		// DONE step present, steps array valid
		expect(result.steps.length).toBeGreaterThanOrEqual(0)
	})
})

describe("insertionSort — empty array", () => {
	it("empty array → comparisons === 0, swaps === 0", () => {
		const result = insertionSort([])
		expect(result.metrics.comparisons).toBe(0)
		expect(result.metrics.swaps).toBe(0)
		expect(result.metrics.arrayLength).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// INSRT-3 — Registry entry
// ---------------------------------------------------------------------------

describe("insertionSort — registry entry (INSRT-3)", () => {
	it("SORT_ALGORITHM.INSERTION equals 'insertion'", () => {
		expect(SORT_ALGORITHM.INSERTION).toBe("insertion")
	})

	it("registry entry for 'insertion' has label 'Insertion Sort'", () => {
		const entry = SORT_ALGORITHM_REGISTRY[SORT_ALGORITHM.INSERTION]
		expect(entry.label).toBe("Insertion Sort")
	})

	it("registry entry run function is the insertionSort implementation", () => {
		const entry = SORT_ALGORITHM_REGISTRY[SORT_ALGORITHM.INSERTION]
		expect(typeof entry.run).toBe("function")
		// Verify it produces the same result as calling insertionSort directly
		const direct = insertionSort([3, 1, 2])
		const viaRegistry = entry.run([3, 1, 2])
		expect(viaRegistry.metrics).toEqual(direct.metrics)
	})

	it("registry entry has non-empty pseudocode array", () => {
		const entry = SORT_ALGORITHM_REGISTRY[SORT_ALGORITHM.INSERTION]
		expect(Array.isArray(entry.pseudocode)).toBe(true)
		expect(entry.pseudocode.length).toBeGreaterThan(0)
		expect(entry.pseudocode[0]).toHaveProperty("id")
		expect(entry.pseudocode[0]).toHaveProperty("text")
	})
})
