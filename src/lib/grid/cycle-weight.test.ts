/**
 * TDD tests for cycleWeight — written BEFORE the implementation.
 *
 * cycleWeight(grid, row, col) cycles the weight of (row, col) through
 * [1→2→3→4→5→1]. It is a pure function returning a new Grid.
 *
 * @see spec §5.2 (weight painting mode)
 * @see PR4 task 5.1
 */

import { describe, it, expect } from "vitest"
import { createGrid, placeStart, placeEnd, toggleWall, setWeight } from "./grid"
import { cycleWeight } from "./cycle-weight"
import { MAX_WEIGHT } from "./grid.types"

describe("cycleWeight", () => {
	it("cycles weight from 1 to 2 on a default cell", () => {
		const g = createGrid(3, 3)
		const g2 = cycleWeight(g, 1, 1)
		expect(g2.weights[1 * 3 + 1]).toBe(2)
	})

	it("cycles weight from 2 to 3", () => {
		const g = createGrid(3, 3)
		const g2 = setWeight(g, 1, 1, 2)
		const g3 = cycleWeight(g2, 1, 1)
		expect(g3.weights[1 * 3 + 1]).toBe(3)
	})

	it("cycles weight from 3 to 4", () => {
		const g = createGrid(3, 3)
		const g2 = setWeight(g, 1, 1, 3)
		const g3 = cycleWeight(g2, 1, 1)
		expect(g3.weights[1 * 3 + 1]).toBe(4)
	})

	it("cycles weight from 4 to 5 (MAX_WEIGHT)", () => {
		const g = createGrid(3, 3)
		const g2 = setWeight(g, 1, 1, 4)
		const g3 = cycleWeight(g2, 1, 1)
		expect(g3.weights[1 * 3 + 1]).toBe(5)
		expect(g3.weights[1 * 3 + 1]).toBe(MAX_WEIGHT)
	})

	it("cycles weight from MAX_WEIGHT (5) back to 1", () => {
		const g = createGrid(3, 3)
		const g2 = setWeight(g, 1, 1, MAX_WEIGHT)
		const g3 = cycleWeight(g2, 1, 1)
		expect(g3.weights[1 * 3 + 1]).toBe(1)
	})

	it("a full cycle of 5 taps returns to the original weight", () => {
		let g = createGrid(3, 3)
		// Default weight is 1
		for (let i = 0; i < MAX_WEIGHT; i++) {
			g = cycleWeight(g, 0, 0)
		}
		expect(g.weights[0]).toBe(1)
	})

	it("is a no-op on a wall cell — returns the same grid reference", () => {
		let g = createGrid(3, 3)
		g = toggleWall(g, 0, 0)
		const g2 = cycleWeight(g, 0, 0)
		expect(g2).toBe(g)
	})

	it("is a no-op on the start cell (must not change weight of special cells)", () => {
		let g = createGrid(3, 3)
		g = placeStart(g, 0, 0)
		const weightBefore = g.weights[0]
		const g2 = cycleWeight(g, 0, 0)
		expect(g2.weights[0]).toBe(weightBefore)
	})

	it("is a no-op on the end cell", () => {
		let g = createGrid(3, 3)
		g = placeEnd(g, 2, 2)
		const weightBefore = g.weights[2 * 3 + 2]
		const g2 = cycleWeight(g, 2, 2)
		expect(g2.weights[2 * 3 + 2]).toBe(weightBefore)
	})

	it("is immutable — does not mutate the original grid", () => {
		const g = createGrid(3, 3)
		const origWeights = g.weights.slice()
		cycleWeight(g, 1, 1)
		expect(g.weights).toEqual(origWeights)
	})

	it("does not change cell kind", () => {
		const g = createGrid(3, 3)
		const g2 = cycleWeight(g, 1, 1)
		expect(g2.cells[1 * 3 + 1]).toBe(g.cells[1 * 3 + 1])
	})
})
