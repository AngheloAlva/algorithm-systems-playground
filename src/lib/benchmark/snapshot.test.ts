/**
 * Tests for the snapshot benchmark runner (pure).
 * Written before implementation (TDD — RED phase).
 *
 * SNAP-1: Returns one row per algorithm (5 entries)
 * SNAP-2: Merge Sort swaps are always zero
 * SNAP-3: Concrete fixture — Bubble Sort comparisons on sorted array of length 3
 * SNAP-4: Pure lib boundary (no React/DOM — verified by test environment)
 */

import { describe, expect, it } from "vitest"
import { runSnapshot } from "./snapshot"
import type { AlgorithmMetricsRow, SnapshotResult } from "./snapshot"

// ---------------------------------------------------------------------------
// SNAP-1 — Returns one row per algorithm
// ---------------------------------------------------------------------------

describe("runSnapshot — result shape (SNAP-1)", () => {
	it("returns a SnapshotResult with 5 rows for a non-empty input", () => {
		const result: SnapshotResult = runSnapshot(5, "sorted", 42)
		expect(result.rows).toHaveLength(5)
	})

	it("each row has algorithm, label, comparisons, swaps, steps fields", () => {
		const result = runSnapshot(5, "sorted", 42)
		for (const row of result.rows) {
			expect(typeof row.algorithm).toBe("string")
			expect(typeof row.label).toBe("string")
			expect(typeof row.comparisons).toBe("number")
			expect(typeof row.swaps).toBe("number")
			expect(typeof row.steps).toBe("number")
			expect(row.comparisons).toBeGreaterThanOrEqual(0)
			expect(row.swaps).toBeGreaterThanOrEqual(0)
		}
	})

	it("result carries back the input config", () => {
		const result = runSnapshot(10, "random", 42)
		expect(result.arrayLength).toBe(10)
		expect(result.arrayMode).toBe("random")
		expect(result.seed).toBe(42)
	})
})

// ---------------------------------------------------------------------------
// SNAP-2 — Merge Sort swaps always zero
// ---------------------------------------------------------------------------

describe("runSnapshot — Merge Sort swaps (SNAP-2)", () => {
	it("merge entry swaps === 0 for reversed input of length 5", () => {
		const result = runSnapshot(5, "reversed", 42)
		const mergeRow = result.rows.find((r: AlgorithmMetricsRow) => r.algorithm === "merge")
		expect(mergeRow).toBeDefined()
		expect(mergeRow!.swaps).toBe(0)
	})

	it("merge entry swaps === 0 for random input", () => {
		const result = runSnapshot(10, "random", 7)
		const mergeRow = result.rows.find((r: AlgorithmMetricsRow) => r.algorithm === "merge")
		expect(mergeRow).toBeDefined()
		expect(mergeRow!.swaps).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// SNAP-3 — Concrete fixture: Bubble comparisons on sorted array of length 5
// (MIN_ARRAY_LENGTH = 5; smaller values are clamped up)
// ---------------------------------------------------------------------------

describe("runSnapshot — concrete fixture (SNAP-3)", () => {
	it("bubble entry: sorted array length 5 → swaps === 0 (early exit on first pass)", () => {
		// sorted mode is deterministic — seed is ignored but required by API
		const result = runSnapshot(5, "sorted", 42)
		const bubbleRow = result.rows.find((r: AlgorithmMetricsRow) => r.algorithm === "bubble")
		expect(bubbleRow).toBeDefined()
		expect(bubbleRow!.swaps).toBe(0)
	})

	it("bubble entry: sorted array length 5 → comparisons === 4 (n-1 comparisons, early exit)", () => {
		// Bubble on sorted [1,2,3,4,5]: first pass makes 4 comparisons, finds no swaps, exits
		const result = runSnapshot(5, "sorted", 42)
		const bubbleRow = result.rows.find((r: AlgorithmMetricsRow) => r.algorithm === "bubble")
		expect(bubbleRow).toBeDefined()
		expect(bubbleRow!.comparisons).toBe(4)
	})

	it("insertion entry: sorted array length 5 → swaps === 0 and comparisons === 4", () => {
		const result = runSnapshot(5, "sorted", 42)
		const insertionRow = result.rows.find((r: AlgorithmMetricsRow) => r.algorithm === "insertion")
		expect(insertionRow).toBeDefined()
		expect(insertionRow!.swaps).toBe(0)
		expect(insertionRow!.comparisons).toBe(4)
	})

	it("each algorithm produces comparisons > 0 for a non-trivial input", () => {
		const result = runSnapshot(10, "reversed", 42)
		for (const row of result.rows) {
			expect(row.comparisons).toBeGreaterThan(0)
		}
	})
})

// ---------------------------------------------------------------------------
// SNAP-4 — Determinism: same inputs → same outputs
// ---------------------------------------------------------------------------

describe("runSnapshot — determinism", () => {
	it("two calls with same args return identical results", () => {
		const a = runSnapshot(10, "random", 42)
		const b = runSnapshot(10, "random", 42)
		expect(a.rows).toEqual(b.rows)
	})
})
