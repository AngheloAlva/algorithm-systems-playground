import { describe, it, expect } from "vitest"
import { manhattan, chebyshev } from "./heuristics"

// ---------------------------------------------------------------------------
// Helper — compute true costs between two flat indices
// ---------------------------------------------------------------------------

function trueManhattan(a: number, b: number, cols: number): number {
	const ar = Math.floor(a / cols)
	const ac = a % cols
	const br = Math.floor(b / cols)
	const bc = b % cols
	return Math.abs(ar - br) + Math.abs(ac - bc)
}

function trueChebyshev(a: number, b: number, cols: number): number {
	const ar = Math.floor(a / cols)
	const ac = a % cols
	const br = Math.floor(b / cols)
	const bc = b % cols
	const dr = Math.abs(ar - br)
	const dc = Math.abs(ac - bc)
	return Math.max(dr, dc)
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
// chebyshev(a, b, cols)
// ---------------------------------------------------------------------------

describe("chebyshev heuristic", () => {
	it("returns 0 at the goal (a === b)", () => {
		expect(chebyshev(5, 5, 10)).toBe(0)
	})

	it("returns 1 for cardinal neighbors", () => {
		expect(chebyshev(0, 1, 10)).toBe(1)
		expect(chebyshev(0, 10, 10)).toBe(1)
	})

	it("returns 1 for diagonal neighbors", () => {
		// (0,0) → (1,1) with cols=10: max(1,1) = 1
		expect(chebyshev(0, 11, 10)).toBe(1)
	})

	it("is symmetric", () => {
		const a = 3
		const b = 27
		const cols = 10
		expect(chebyshev(a, b, cols)).toBe(chebyshev(b, a, cols))
	})

	/**
	 * Admissibility on unit-weight 8-connected grid:
	 * chebyshev(a, b) ≤ true_cost(a, b) where true cost counts
	 * the minimum number of moves (diagonal moves cover both axes).
	 * On unit-weight grids, Chebyshev equals the true cost (tight bound).
	 */
	it("never overestimates on unit-weight 8-connected grid (admissibility) — sampled", () => {
		const rows = 10
		const cols = 10
		const size = rows * cols
		for (let a = 0; a < size; a += 7) {
			for (let b = 0; b < size; b += 11) {
				const h = chebyshev(a, b, cols)
				const trueCost = trueChebyshev(a, b, cols)
				expect(h).toBeLessThanOrEqual(trueCost)
			}
		}
	})

	it("equals true Chebyshev distance on unit-weight 8-connected grid (tight bound)", () => {
		const cols = 10
		// (1,2) → (4,6): dr=3, dc=4 → chebyshev = max(3,4) = 4
		const a = 1 * cols + 2
		const b = 4 * cols + 6
		expect(chebyshev(a, b, cols)).toBe(4)
		expect(chebyshev(a, b, cols)).toBe(trueChebyshev(a, b, cols))
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
	 * chebyshev(0, 2, cols=3): dr=0, dc=2 → chebyshev = max(0,2) = 2.
	 * Admissibility: chebyshev(2) ≤ true_cost(8). ✓
	 *
	 * Manhattan equivalent: manhattan(0, 2, cols=3) = 2 ≤ 8. ✓
	 */
	it("on weighted grid, chebyshev and manhattan ≤ true weighted path cost (concrete admissibility)", () => {
		// 1-row, 3-col grid: start=(0,0), end=(0,2), weights=[3,5,2]
		const cols = 3
		const start = 0 // cell (0,0), weight 3
		const end = 2 // cell (0,2), weight 2
		// Only path: 0 → 1 → 2. M1: start included, end excluded.
		const weights = [3, 5, 2]
		const trueCost = weights[0] + weights[1] // = 8 (end excluded)

		const hChebyshev = chebyshev(start, end, cols)
		const hManhattan = manhattan(start, end, cols)

		// Chebyshev admissibility: heuristic must not exceed true cost
		expect(hChebyshev).toBeLessThanOrEqual(trueCost)
		// Manhattan admissibility: same requirement
		expect(hManhattan).toBeLessThanOrEqual(trueCost)

		// Verify heuristic values are as expected (unit distances)
		expect(hChebyshev).toBe(2) // dr=0, dc=2 → max(0,2) = 2
		expect(hManhattan).toBe(2) // |0-0| + |0-2| = 2
	})
})
