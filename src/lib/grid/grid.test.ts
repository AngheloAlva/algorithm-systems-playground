import { describe, it, expect } from "vitest"
import { createGrid, placeStart, placeEnd, toggleWall, setWeight, index, coords } from "./grid"
import { CELL, MAX_WEIGHT } from "./grid.types"

// ---------------------------------------------------------------------------
// createGrid
// ---------------------------------------------------------------------------

describe("createGrid", () => {
	it("returns a grid with the specified dimensions", () => {
		const g = createGrid(5, 8)
		expect(g.rows).toBe(5)
		expect(g.cols).toBe(8)
	})

	it("cells buffer has length rows*cols", () => {
		const g = createGrid(4, 6)
		expect(g.cells.length).toBe(24)
	})

	it("weights buffer has length rows*cols", () => {
		const g = createGrid(4, 6)
		expect(g.weights.length).toBe(24)
	})

	it("all cells are EMPTY by default", () => {
		const g = createGrid(3, 3)
		for (let i = 0; i < g.cells.length; i++) {
			expect(g.cells[i]).toBe(CELL.EMPTY)
		}
	})

	it("all weights are 1 by default", () => {
		const g = createGrid(3, 3)
		for (let i = 0; i < g.weights.length; i++) {
			expect(g.weights[i]).toBe(1)
		}
	})

	it("start and end are initialized to 0", () => {
		const g = createGrid(3, 3)
		expect(g.start).toBe(0)
		expect(g.end).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// placeStart
// ---------------------------------------------------------------------------

describe("placeStart", () => {
	it("moves the start marker to the given cell", () => {
		const g = createGrid(3, 3)
		const g2 = placeStart(g, 1, 1)
		expect(g2.start).toBe(index(1, 1, 3))
	})

	it("marks the cell as START in cells array", () => {
		const g = createGrid(3, 3)
		const g2 = placeStart(g, 2, 2)
		expect(g2.cells[g2.start]).toBe(CELL.START)
	})

	it("clears the old start cell to EMPTY", () => {
		const g = createGrid(3, 3)
		const g2 = placeStart(g, 0, 0)
		const g3 = placeStart(g2, 1, 1)
		expect(g3.cells[index(0, 0, 3)]).toBe(CELL.EMPTY)
	})

	it("is immutable — does not mutate the original grid", () => {
		const g = createGrid(3, 3)
		const orig = g.cells.slice()
		placeStart(g, 1, 1)
		expect(g.cells).toEqual(orig)
	})

	it("throws when the target cell is a wall", () => {
		let g = createGrid(3, 3)
		g = toggleWall(g, 0, 1)
		expect(() => placeStart(g, 0, 1)).toThrow()
	})
})

// ---------------------------------------------------------------------------
// placeEnd
// ---------------------------------------------------------------------------

describe("placeEnd", () => {
	it("moves the end marker to the given cell", () => {
		const g = createGrid(3, 3)
		const g2 = placeEnd(g, 2, 2)
		expect(g2.end).toBe(index(2, 2, 3))
	})

	it("marks the cell as END in cells array", () => {
		const g = createGrid(3, 3)
		const g2 = placeEnd(g, 2, 2)
		expect(g2.cells[g2.end]).toBe(CELL.END)
	})

	it("clears the old end cell to EMPTY", () => {
		const g = createGrid(3, 3)
		const g2 = placeEnd(g, 2, 2)
		const g3 = placeEnd(g2, 0, 2)
		expect(g3.cells[index(2, 2, 3)]).toBe(CELL.EMPTY)
	})

	it("is immutable — does not mutate the original grid", () => {
		const g = createGrid(3, 3)
		const orig = g.cells.slice()
		placeEnd(g, 2, 2)
		expect(g.cells).toEqual(orig)
	})

	it("throws when the target cell is a wall", () => {
		let g = createGrid(3, 3)
		g = toggleWall(g, 0, 1)
		expect(() => placeEnd(g, 0, 1)).toThrow()
	})
})

// ---------------------------------------------------------------------------
// toggleWall
// ---------------------------------------------------------------------------

describe("toggleWall", () => {
	it("turns an EMPTY cell into a WALL", () => {
		const g = createGrid(3, 3)
		const g2 = toggleWall(g, 1, 1)
		expect(g2.cells[index(1, 1, 3)]).toBe(CELL.WALL)
	})

	it("turns a WALL cell back to EMPTY", () => {
		const g = createGrid(3, 3)
		const g2 = toggleWall(g, 1, 1)
		const g3 = toggleWall(g2, 1, 1)
		expect(g3.cells[index(1, 1, 3)]).toBe(CELL.EMPTY)
	})

	it("is a no-op on the start cell", () => {
		let g = createGrid(3, 3)
		g = placeStart(g, 0, 0)
		const g2 = toggleWall(g, 0, 0)
		expect(g2.cells[index(0, 0, 3)]).toBe(CELL.START)
	})

	it("is a no-op on the end cell", () => {
		let g = createGrid(3, 3)
		g = placeEnd(g, 2, 2)
		const g2 = toggleWall(g, 2, 2)
		expect(g2.cells[index(2, 2, 3)]).toBe(CELL.END)
	})

	it("is immutable — does not mutate the original grid", () => {
		const g = createGrid(3, 3)
		const orig = g.cells.slice()
		toggleWall(g, 1, 1)
		expect(g.cells).toEqual(orig)
	})
})

// ---------------------------------------------------------------------------
// setWeight
// ---------------------------------------------------------------------------

describe("setWeight", () => {
	it("sets the weight on a non-wall cell", () => {
		const g = createGrid(3, 3)
		const g2 = setWeight(g, 1, 1, 3)
		expect(g2.weights[index(1, 1, 3)]).toBe(3)
	})

	it("clamps weight below 1 to 1", () => {
		const g = createGrid(3, 3)
		const g2 = setWeight(g, 0, 0, 0)
		expect(g2.weights[index(0, 0, 3)]).toBe(1)
	})

	it("clamps weight above MAX_WEIGHT to MAX_WEIGHT", () => {
		const g = createGrid(3, 3)
		const g2 = setWeight(g, 0, 0, MAX_WEIGHT + 10)
		expect(g2.weights[index(0, 0, 3)]).toBe(MAX_WEIGHT)
	})

	it("is a no-op on a wall cell", () => {
		let g = createGrid(3, 3)
		g = toggleWall(g, 1, 1)
		const g2 = setWeight(g, 1, 1, 4)
		expect(g2.weights[index(1, 1, 3)]).toBe(1)
	})

	it("is immutable — does not mutate the original grid", () => {
		const g = createGrid(3, 3)
		const orig = g.weights.slice()
		setWeight(g, 1, 1, 3)
		expect(g.weights).toEqual(orig)
	})
})

// ---------------------------------------------------------------------------
// index / coords helpers
// ---------------------------------------------------------------------------

describe("index(r, c, cols)", () => {
	it("returns r*cols + c", () => {
		expect(index(0, 0, 5)).toBe(0)
		expect(index(1, 0, 5)).toBe(5)
		expect(index(1, 3, 5)).toBe(8)
		expect(index(2, 4, 5)).toBe(14)
	})
})

describe("coords(i, cols)", () => {
	it("recovers row and col from flat index", () => {
		expect(coords(0, 5)).toEqual({ r: 0, c: 0 })
		expect(coords(5, 5)).toEqual({ r: 1, c: 0 })
		expect(coords(8, 5)).toEqual({ r: 1, c: 3 })
		expect(coords(14, 5)).toEqual({ r: 2, c: 4 })
	})

	it("round-trips with index", () => {
		const cols = 7
		for (let r = 0; r < 5; r++) {
			for (let c = 0; c < cols; c++) {
				const i = index(r, c, cols)
				const { r: rr, c: cc } = coords(i, cols)
				expect(rr).toBe(r)
				expect(cc).toBe(c)
			}
		}
	})
})
