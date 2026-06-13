/**
 * Tests for the sweep benchmark runner (pure).
 * Written before implementation (TDD — RED phase).
 *
 * SWEEP-1: Returns 5 algorithm series, each with one point per size
 * SWEEP-2: Comparisons increase monotonically for O(n²) algorithms (random mode)
 * SWEEP-3: Divergence at n=200 using REVERSED mode (NOT sorted — Bubble exits O(n) on sorted)
 * SWEEP-4: Pure lib boundary (no React/DOM — verified by test environment)
 *
 * Authority override #4: Divergence fixtures MUST use "reversed" or "random" mode.
 */

import { describe, expect, it } from "vitest"
import { runSweep, SWEEP_SIZES } from "./sweep"
import type { SweepResult, SweepPoint } from "./sweep"

// ---------------------------------------------------------------------------
// SWEEP_SIZES constant
// ---------------------------------------------------------------------------

describe("SWEEP_SIZES", () => {
	it("has exactly 5 entries", () => {
		expect(SWEEP_SIZES).toHaveLength(5)
	})

	it("equals [10, 25, 50, 100, 200]", () => {
		expect(Array.from(SWEEP_SIZES)).toEqual([10, 25, 50, 100, 200])
	})
})

// ---------------------------------------------------------------------------
// SWEEP-1 — Result shape: 5 entries, one point per size
// ---------------------------------------------------------------------------

describe("runSweep — result shape (SWEEP-1)", () => {
	it("returns a SweepResult with 5 points (one per SWEEP_SIZE)", () => {
		const result: SweepResult = runSweep("sorted", 42)
		expect(result.points).toHaveLength(5)
	})

	it("each point n matches the corresponding SWEEP_SIZE entry", () => {
		const result = runSweep("sorted", 42)
		for (let i = 0; i < SWEEP_SIZES.length; i++) {
			expect(result.points[i].n).toBe(SWEEP_SIZES[i])
		}
	})

	it("each point.comparisons has one entry per algorithm (5 keys)", () => {
		const result = runSweep("sorted", 42)
		for (const point of result.points) {
			const keys = Object.keys(point.comparisons)
			expect(keys).toHaveLength(5)
		}
	})

	it("each comparison value is a non-negative number", () => {
		const result = runSweep("sorted", 42)
		for (const point of result.points) {
			for (const count of Object.values(point.comparisons)) {
				expect(count).toBeGreaterThanOrEqual(0)
			}
		}
	})

	it("result carries back mode and seed", () => {
		const result = runSweep("random", 99)
		expect(result.mode).toBe("random")
		expect(result.seed).toBe(99)
	})
})

// ---------------------------------------------------------------------------
// SWEEP-2 — Monotonic growth for O(n²) algorithms in random mode
// Sizes subset: [10, 50, 100] — indices 0, 2, 3 in SWEEP_SIZES
// ---------------------------------------------------------------------------

describe("runSweep — monotonic growth (SWEEP-2)", () => {
	it("bubble comparisons strictly increase from n=10 to n=50 to n=100 (random, seed=0)", () => {
		const result = runSweep("random", 0)
		const at10 = result.points.find((p: SweepPoint) => p.n === 10)!.comparisons["bubble"]
		const at50 = result.points.find((p: SweepPoint) => p.n === 50)!.comparisons["bubble"]
		const at100 = result.points.find((p: SweepPoint) => p.n === 100)!.comparisons["bubble"]
		expect(at10).toBeLessThan(at50)
		expect(at50).toBeLessThan(at100)
	})

	it("insertion comparisons strictly increase from n=10 to n=50 to n=100 (random, seed=0)", () => {
		const result = runSweep("random", 0)
		const at10 = result.points.find((p: SweepPoint) => p.n === 10)!.comparisons["insertion"]
		const at50 = result.points.find((p: SweepPoint) => p.n === 50)!.comparisons["insertion"]
		const at100 = result.points.find((p: SweepPoint) => p.n === 100)!.comparisons["insertion"]
		expect(at10).toBeLessThan(at50)
		expect(at50).toBeLessThan(at100)
	})
})

// ---------------------------------------------------------------------------
// SWEEP-3 — Divergence at n=200 using REVERSED mode
// Authority override #4: NOT "sorted" — Bubble exits O(n) on sorted (early-exit flag).
// "reversed" → Bubble stays full O(n²), making divergence from Merge > 5×.
// ---------------------------------------------------------------------------

describe("runSweep — divergence at n=200 (SWEEP-3)", () => {
	it("bubble.comparisons / merge.comparisons > 5 at n=200 with reversed mode", () => {
		const result = runSweep("reversed", 42)
		const at200 = result.points.find((p: SweepPoint) => p.n === 200)!
		const bubbleComp = at200.comparisons["bubble"]
		const mergeComp = at200.comparisons["merge"]
		expect(mergeComp).toBeGreaterThan(0)
		expect(bubbleComp / mergeComp).toBeGreaterThan(5)
	})

	it("insertion.comparisons / merge.comparisons > 5 at n=200 with reversed mode", () => {
		const result = runSweep("reversed", 42)
		const at200 = result.points.find((p: SweepPoint) => p.n === 200)!
		const insertionComp = at200.comparisons["insertion"]
		const mergeComp = at200.comparisons["merge"]
		expect(insertionComp / mergeComp).toBeGreaterThan(5)
	})
})

// ---------------------------------------------------------------------------
// SWEEP-4 — Determinism
// ---------------------------------------------------------------------------

describe("runSweep — determinism", () => {
	it("two calls with same args return identical results", () => {
		const a = runSweep("random", 42)
		const b = runSweep("random", 42)
		expect(a.points).toEqual(b.points)
	})
})
