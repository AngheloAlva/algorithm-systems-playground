import { describe, it, expect } from "vitest"
import {
	CELL,
	MAX_WEIGHT,
	DEFAULT_ROWS,
	DEFAULT_COLS,
	type Grid,
	type CellKind,
} from "./grid.types"

describe("CELL constants", () => {
	it("has exactly four members: EMPTY, WALL, START, END", () => {
		expect(Object.keys(CELL)).toEqual(["EMPTY", "WALL", "START", "END"])
	})

	it("EMPTY is 0", () => {
		expect(CELL.EMPTY).toBe(0)
	})

	it("WALL is 1", () => {
		expect(CELL.WALL).toBe(1)
	})

	it("START is 2", () => {
		expect(CELL.START).toBe(2)
	})

	it("END is 3", () => {
		expect(CELL.END).toBe(3)
	})

	it("all values are distinct", () => {
		const values = Object.values(CELL)
		expect(new Set(values).size).toBe(values.length)
	})
})

describe("MAX_WEIGHT", () => {
	it("equals 5", () => {
		expect(MAX_WEIGHT).toBe(5)
	})
})

describe("default dimensions (M2)", () => {
	it("DEFAULT_ROWS is 24", () => {
		expect(DEFAULT_ROWS).toBe(24)
	})

	it("DEFAULT_COLS is 44", () => {
		expect(DEFAULT_COLS).toBe(44)
	})

	it("default grid fits the ≥1280px target (col width ≈ 29px)", () => {
		// 1280 / DEFAULT_COLS should be within the 24–31px target range
		const cellWidth = 1280 / DEFAULT_COLS
		expect(cellWidth).toBeGreaterThanOrEqual(24)
		expect(cellWidth).toBeLessThanOrEqual(31)
	})
})

describe("Grid interface shape (type-level documentation)", () => {
	/**
	 * This test block verifies that the Grid interface has the expected fields
	 * by constructing a synthetic Grid value. TypeScript compile-level checks
	 * confirm the shape; the runtime test confirms default values.
	 *
	 * Path-cost convention (M1): cost includes start cell weight, excludes end.
	 */
	it("constructs a valid Grid value with all required fields", () => {
		const grid: Grid = {
			rows: 2,
			cols: 2,
			cells: new Uint8Array([2, 0, 0, 3]), // START, EMPTY, EMPTY, END
			weights: new Uint8Array([1, 1, 1, 1]),
			start: 0,
			end: 3,
		}

		expect(grid.rows).toBe(2)
		expect(grid.cols).toBe(2)
		expect(grid.cells).toBeInstanceOf(Uint8Array)
		expect(grid.weights).toBeInstanceOf(Uint8Array)
		expect(grid.start).toBe(0)
		expect(grid.end).toBe(3)
	})

	it("cells and weights are parallel Uint8Arrays of length rows*cols", () => {
		const rows = 3
		const cols = 4
		const grid: Grid = {
			rows,
			cols,
			cells: new Uint8Array(rows * cols),
			weights: new Uint8Array(rows * cols).fill(1),
			start: 0,
			end: rows * cols - 1,
		}

		expect(grid.cells.length).toBe(rows * cols)
		expect(grid.weights.length).toBe(rows * cols)
	})
})

describe("CellKind type coverage", () => {
	it("CELL values satisfy CellKind", () => {
		// Compile-time assertion via assignment — if this compiles, the type is correct
		const kinds: CellKind[] = [CELL.EMPTY, CELL.WALL, CELL.START, CELL.END]
		expect(kinds).toHaveLength(4)
	})
})
