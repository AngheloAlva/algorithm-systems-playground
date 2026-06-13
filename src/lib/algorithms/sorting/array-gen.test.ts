/**
 * Tests for generateArray and related constants.
 * Written before implementation (TDD — RED phase).
 */

import { describe, expect, it } from "vitest"
import {
	generateArray,
	MIN_ARRAY_LENGTH,
	MAX_ARRAY_LENGTH,
	ARRAY_MODE,
	type ArrayMode,
} from "./array-gen"

describe("constants", () => {
	it("MIN_ARRAY_LENGTH is 5", () => {
		expect(MIN_ARRAY_LENGTH).toBe(5)
	})

	it("MAX_ARRAY_LENGTH is 200", () => {
		expect(MAX_ARRAY_LENGTH).toBe(200)
	})
})

describe("ARRAY_MODE", () => {
	it("has RANDOM member with value 'random'", () => {
		expect(ARRAY_MODE.RANDOM).toBe("random")
	})

	it("has SORTED member with value 'sorted'", () => {
		expect(ARRAY_MODE.SORTED).toBe("sorted")
	})

	it("has REVERSED member with value 'reversed'", () => {
		expect(ARRAY_MODE.REVERSED).toBe("reversed")
	})

	it("has FEW_UNIQUE member with value 'few-unique'", () => {
		expect(ARRAY_MODE.FEW_UNIQUE).toBe("few-unique")
	})
})

describe("generateArray — SORTED mode", () => {
	it("generateArray(10, 'sorted') returns [1,2,3,4,5,6,7,8,9,10]", () => {
		expect(generateArray(10, "sorted")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
	})

	it("generateArray(5, 'sorted') returns [1,2,3,4,5]", () => {
		expect(generateArray(5, "sorted")).toEqual([1, 2, 3, 4, 5])
	})

	it("is deterministic (same output on repeated calls)", () => {
		const a = generateArray(20, "sorted")
		const b = generateArray(20, "sorted")
		expect(a).toEqual(b)
	})
})

describe("generateArray — REVERSED mode", () => {
	it("generateArray(6, 'reversed') returns [6,5,4,3,2,1]", () => {
		expect(generateArray(6, "reversed")).toEqual([6, 5, 4, 3, 2, 1])
	})

	it("is deterministic (same output on repeated calls)", () => {
		const a = generateArray(15, "reversed")
		const b = generateArray(15, "reversed")
		expect(a).toEqual(b)
	})
})

describe("generateArray — FEW_UNIQUE mode", () => {
	it("generateArray(5, 'few-unique') has between 2 and 5 distinct values", () => {
		const result = generateArray(5, "few-unique")
		const distinct = new Set(result).size
		expect(distinct).toBeGreaterThanOrEqual(2)
		expect(distinct).toBeLessThanOrEqual(5)
	})

	it("generateArray(5, 'few-unique') values are within [1..5]", () => {
		const result = generateArray(5, "few-unique")
		for (const v of result) {
			expect(v).toBeGreaterThanOrEqual(1)
			expect(v).toBeLessThanOrEqual(5)
		}
	})

	it("generateArray(20, 'few-unique') has between 2 and 5 distinct values", () => {
		const result = generateArray(20, "few-unique")
		const distinct = new Set(result).size
		expect(distinct).toBeGreaterThanOrEqual(2)
		expect(distinct).toBeLessThanOrEqual(5)
	})

	it("generateArray(20, 'few-unique') values are within [1..20]", () => {
		const result = generateArray(20, "few-unique")
		for (const v of result) {
			expect(v).toBeGreaterThanOrEqual(1)
			expect(v).toBeLessThanOrEqual(20)
		}
	})

	it("is deterministic for same length", () => {
		const a = generateArray(30, "few-unique")
		const b = generateArray(30, "few-unique")
		expect(a).toEqual(b)
	})
})

describe("generateArray — RANDOM mode", () => {
	it("returns an array of the correct length", () => {
		const result = generateArray(10, "random")
		expect(result).toHaveLength(10)
	})

	it("values are in range [1, length]", () => {
		const n = 10
		const result = generateArray(n, "random")
		for (const v of result) {
			expect(v).toBeGreaterThanOrEqual(1)
			expect(v).toBeLessThanOrEqual(n)
		}
	})
})

describe("generateArray — length clamping", () => {
	it("length below MIN_ARRAY_LENGTH is clamped to MIN_ARRAY_LENGTH", () => {
		expect(generateArray(1, "sorted")).toHaveLength(MIN_ARRAY_LENGTH)
	})

	it("length above MAX_ARRAY_LENGTH is clamped to MAX_ARRAY_LENGTH", () => {
		expect(generateArray(9999, "sorted")).toHaveLength(MAX_ARRAY_LENGTH)
	})

	it("generateArray(MIN_ARRAY_LENGTH, 'sorted').length === MIN_ARRAY_LENGTH", () => {
		expect(generateArray(MIN_ARRAY_LENGTH, "sorted")).toHaveLength(MIN_ARRAY_LENGTH)
	})

	it("generateArray(MAX_ARRAY_LENGTH, 'sorted').length === MAX_ARRAY_LENGTH", () => {
		expect(generateArray(MAX_ARRAY_LENGTH, "sorted")).toHaveLength(MAX_ARRAY_LENGTH)
	})
})

describe("ArrayMode type", () => {
	it("can be assigned from ARRAY_MODE values", () => {
		const mode: ArrayMode = ARRAY_MODE.RANDOM
		expect(mode).toBe("random")
	})
})

// ---------------------------------------------------------------------------
// SEED-1 — Deterministic RANDOM mode with seed
// ---------------------------------------------------------------------------

describe("generateArray — seeded RANDOM mode (SEED-1)", () => {
	it("same seed + length produces identical arrays (seed=42, length=10)", () => {
		const a = generateArray(10, "random", 42)
		const b = generateArray(10, "random", 42)
		expect(a).toEqual(b)
	})

	it("different seeds produce different arrays (seed=1 vs seed=2, length=50)", () => {
		const a = generateArray(50, "random", 1)
		const b = generateArray(50, "random", 2)
		expect(a).not.toEqual(b)
	})

	it("seeded array has correct length", () => {
		const result = generateArray(20, "random", 42)
		expect(result).toHaveLength(20)
	})

	it("seeded array values are in range [1, length]", () => {
		const n = 30
		const result = generateArray(n, "random", 42)
		for (const v of result) {
			expect(v).toBeGreaterThanOrEqual(1)
			expect(v).toBeLessThanOrEqual(n)
		}
	})
})

// ---------------------------------------------------------------------------
// SEED-2 — Two-argument form unchanged
// ---------------------------------------------------------------------------

describe("generateArray — two-argument form unchanged (SEED-2)", () => {
	it("generateArray(20, 'sorted') still returns [1..20]", () => {
		const result = generateArray(20, "sorted")
		expect(result).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
	})

	it("SORTED mode with seed returns same as without seed", () => {
		const withSeed = generateArray(10, "sorted", 42)
		const withoutSeed = generateArray(10, "sorted")
		expect(withSeed).toEqual(withoutSeed)
	})

	it("REVERSED mode with seed returns same as without seed", () => {
		const withSeed = generateArray(10, "reversed", 99)
		const withoutSeed = generateArray(10, "reversed")
		expect(withSeed).toEqual(withoutSeed)
	})

	it("FEW_UNIQUE mode with seed returns same as without seed", () => {
		const withSeed = generateArray(10, "few-unique", 7)
		const withoutSeed = generateArray(10, "few-unique")
		expect(withSeed).toEqual(withoutSeed)
	})
})
