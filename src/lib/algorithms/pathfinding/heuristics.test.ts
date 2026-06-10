import { describe, it, expect } from "vitest"
import { manhattan, octile } from "./heuristics"

// ---------------------------------------------------------------------------
// Helper — compute true BFS cost (unit-weight, 4-conn) between two flat indices
// ---------------------------------------------------------------------------

function trueManhattan(a: number, b: number, cols: number): number {
	const ar = Math.floor(a / cols)
	const ac = a % cols
	const br = Math.floor(b / cols)
	const bc = b % cols
	return Math.abs(ar - br) + Math.abs(ac - bc)
}

function trueOctile(a: number, b: number, cols: number): number {
	const ar = Math.floor(a / cols)
	const ac = a % cols
	const br = Math.floor(b / cols)
	const bc = b % cols
	const dr = Math.abs(ar - br)
	const dc = Math.abs(ac - bc)
	return Math.max(dr, dc) + (Math.SQRT2 - 1) * Math.min(dr, dc)
}

// ---------------------------------------------------------------------------
// manhattan(a, b, cols)
// ---------------------------------------------------------------------------

describe("manhattan heuristic", () => {
	it("returns 0 at the goal (a === b)", () => {
		expect(manhattan(5, 5, 10)).toBe(0)
	})

	it("returns 1 for adjacent cells (horizontal)", () => {
		// (0,0) → (0,1) with cols=10
		expect(manhattan(0, 1, 10)).toBe(1)
	})

	it("returns 1 for adjacent cells (vertical)", () => {
		// (0,0) → (1,0) with cols=5
		expect(manhattan(0, 5, 5)).toBe(1)
	})

	it("returns correct Manhattan distance for non-adjacent cells", () => {
		// (0,0) → (3,4) with cols=10: |0-3| + |0-4| = 7
		expect(manhattan(0, 34, 10)).toBe(7)
	})

	it("is symmetric", () => {
		expect(manhattan(0, 34, 10)).toBe(manhattan(34, 0, 10))
	})

	/**
	 * Admissibility: Manhattan heuristic MUST NOT overestimate the true cost
	 * on a unit-weight 4-connected grid. h(a,b) ≤ true_cost(a,b).
	 * On unit grids the true cost equals the Manhattan distance — so equality holds.
	 */
	it("never overestimates true unit cost (admissibility) — sampled cells", () => {
		const rows = 10
		const cols = 10
		const size = rows * cols
		// Check a sample of cell pairs
		for (let a = 0; a < size; a += 7) {
			for (let b = 0; b < size; b += 11) {
				const h = manhattan(a, b, cols)
				const trueCost = trueManhattan(a, b, cols)
				expect(h).toBeLessThanOrEqual(trueCost)
			}
		}
	})

	it("equals the true cost on unit-weight 4-connected grid (tight bound)", () => {
		const cols = 8
		// (2,3) → (5,7): |2-5| + |3-7| = 3 + 4 = 7
		const a = 2 * cols + 3
		const b = 5 * cols + 7
		expect(manhattan(a, b, cols)).toBe(7)
		expect(manhattan(a, b, cols)).toBe(trueManhattan(a, b, cols))
	})
})

// ---------------------------------------------------------------------------
// octile(a, b, cols)
// ---------------------------------------------------------------------------

describe("octile heuristic", () => {
	it("returns 0 at the goal (a === b)", () => {
		expect(octile(5, 5, 10)).toBe(0)
	})

	it("returns 1 for cardinal neighbors", () => {
		expect(octile(0, 1, 10)).toBe(1)
		expect(octile(0, 10, 10)).toBe(1)
	})

	it("returns √2 for diagonal neighbors", () => {
		// (0,0) → (1,1) with cols=10
		expect(octile(0, 11, 10)).toBeCloseTo(Math.SQRT2, 10)
	})

	it("is symmetric", () => {
		const a = 3
		const b = 27
		const cols = 10
		expect(octile(a, b, cols)).toBeCloseTo(octile(b, a, cols), 10)
	})

	/**
	 * Admissibility on unit-weight 8-connected grid:
	 * octile(a, b) ≤ true_diagonal_cost(a, b) where true cost counts
	 * the minimum number of diagonal + cardinal moves.
	 * On unit-weight grids, octile equals the true cost (tight bound).
	 */
	it("never overestimates on unit-weight 8-connected grid (admissibility) — sampled", () => {
		const rows = 10
		const cols = 10
		const size = rows * cols
		for (let a = 0; a < size; a += 7) {
			for (let b = 0; b < size; b += 11) {
				const h = octile(a, b, cols)
				const trueCost = trueOctile(a, b, cols)
				// Allow tiny floating-point tolerance
				expect(h).toBeLessThanOrEqual(trueCost + 1e-10)
			}
		}
	})

	it("equals true octile distance on unit-weight 8-connected grid", () => {
		const cols = 10
		// (1,2) → (4,6): dr=3, dc=4 → octile = 4 + (√2-1)*3
		const a = 1 * cols + 2
		const b = 4 * cols + 6
		const expected = trueOctile(a, b, cols)
		expect(octile(a, b, cols)).toBeCloseTo(expected, 10)
	})

	/**
	 * Admissibility on a concrete weighted grid scenario.
	 *
	 * Grid (3 cols, 1 row): cells with weights [3, 5, 2].
	 * Path cost convention M1: start included, end excluded.
	 * start = cell 0 (weight 3), end = cell 2 (weight 2).
	 * Only path: 0 → 1 → 2.
	 * True path cost = weight[0] + weight[1] = 3 + 5 = 8  (end cell excluded).
	 *
	 * octile(0, 2, cols=3): dr=0, dc=2 → octile = 2 (unit distance, no diagonal).
	 * Admissibility: octile(2) ≤ true_cost(8). ✓
	 *
	 * Manhattan equivalent: manhattan(0, 2, cols=3) = 2 ≤ 8. ✓
	 */
	it("on weighted grid, octile and manhattan ≤ true weighted path cost (concrete admissibility)", () => {
		// 1-row, 3-col grid: start=(0,0), end=(0,2), weights=[3,5,2]
		const cols = 3
		const start = 0 // cell (0,0), weight 3
		const end = 2 // cell (0,2), weight 2
		// Only path: 0 → 1 → 2. M1: start included, end excluded.
		const weights = [3, 5, 2]
		const trueCost = weights[0] + weights[1] // = 8 (end excluded)

		const hOctile = octile(start, end, cols)
		const hManhattan = manhattan(start, end, cols)

		// Octile admissibility: heuristic must not exceed true cost
		expect(hOctile).toBeLessThanOrEqual(trueCost + 1e-10)
		// Manhattan admissibility: same requirement
		expect(hManhattan).toBeLessThanOrEqual(trueCost + 1e-10)

		// Verify heuristic values are as expected (unit distances)
		expect(hOctile).toBeCloseTo(2, 10) // dr=0, dc=2 → octile=2
		expect(hManhattan).toBe(2) // |0-0| + |0-2| = 2
	})
})
