/**
 * Tests for the sorting algorithm registry (index.ts).
 * Written before implementation (TDD — RED phase).
 */

import { describe, expect, it } from "vitest"
import {
	SORT_ALGORITHM,
	SORT_ALGORITHM_REGISTRY,
	type SortAlgorithm,
} from "./index"

describe("SORT_ALGORITHM", () => {
	it("has BUBBLE member", () => {
		expect(SORT_ALGORITHM.BUBBLE).toBe("bubble")
	})

	it("has INSERTION member", () => {
		expect(SORT_ALGORITHM.INSERTION).toBe("insertion")
	})

	it("has QUICK member", () => {
		expect(SORT_ALGORITHM.QUICK).toBe("quick")
	})

	it("has MERGE member", () => {
		expect(SORT_ALGORITHM.MERGE).toBe("merge")
	})

	it("has HEAP member", () => {
		expect(SORT_ALGORITHM.HEAP).toBe("heap")
	})
})

describe("SORT_ALGORITHM_REGISTRY", () => {
	it("has exactly 5 entries", () => {
		const keys = Object.keys(SORT_ALGORITHM_REGISTRY)
		expect(keys).toHaveLength(5)
	})

	it("has an entry for each SortAlgorithm value", () => {
		const algorithms: SortAlgorithm[] = ["bubble", "insertion", "quick", "merge", "heap"]
		for (const alg of algorithms) {
			expect(SORT_ALGORITHM_REGISTRY[alg]).toBeDefined()
		}
	})

	it("each entry has run, pseudocode, and label fields", () => {
		for (const entry of Object.values(SORT_ALGORITHM_REGISTRY)) {
			expect(typeof entry.run).toBe("function")
			expect(Array.isArray(entry.pseudocode)).toBe(true)
			expect(typeof entry.label).toBe("string")
		}
	})

	it("calling SORT_ALGORITHM_REGISTRY['bubble'].run([3,1,2]) returns a non-empty SortTraceResult", () => {
		const result = SORT_ALGORITHM_REGISTRY["bubble"].run([3, 1, 2])
		expect(result).toBeDefined()
		expect(Array.isArray(result.steps)).toBe(true)
		expect(result.steps.length).toBeGreaterThan(0)
		expect(typeof result.metrics.comparisons).toBe("number")
	})

	it("pseudocode for each algorithm is a non-empty array", () => {
		for (const [, entry] of Object.entries(SORT_ALGORITHM_REGISTRY)) {
			expect(entry.pseudocode.length).toBeGreaterThan(0)
			expect(entry.pseudocode[0]).toHaveProperty("id")
			expect(entry.pseudocode[0]).toHaveProperty("text")
		}
	})

	it("SORT_ALGORITHM_REGISTRY['quick'].run produces deterministic results", () => {
		const input = [5, 3, 1, 4, 2]
		const r1 = SORT_ALGORITHM_REGISTRY["quick"].run(input)
		const r2 = SORT_ALGORITHM_REGISTRY["quick"].run(input)
		expect(r1.steps.length).toBe(r2.steps.length)
		expect(r1.metrics).toEqual(r2.metrics)
	})

	it("SORT_ALGORITHM_REGISTRY['merge'].run handles empty array", () => {
		const result = SORT_ALGORITHM_REGISTRY["merge"].run([])
		expect(result.metrics.comparisons).toBe(0)
	})

	it("SORT_ALGORITHM_REGISTRY['heap'].run sorts correctly", () => {
		const input = [5, 3, 1, 4, 2]
		const result = SORT_ALGORITHM_REGISTRY["heap"].run(input)
		expect(result.metrics.swaps).toBeGreaterThan(0)
	})
})
