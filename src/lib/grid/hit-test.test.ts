import { describe, it, expect } from "vitest"
import { cellAt } from "./hit-test"

// ---------------------------------------------------------------------------
// cellAt(clientX, clientY, rect, cols, cellSize) => flat index | -1
// ---------------------------------------------------------------------------

/** Synthetic DOMRect-like object for tests. */
function rect(left: number, top: number, width: number, height: number) {
	return { left, top, right: left + width, bottom: top + height, width, height }
}

describe("cellAt", () => {
	const ROWS = 5
	const COLS = 5
	const CELL_SIZE = 20
	// Canvas starts at (100, 200) in client space
	const R = rect(100, 200, COLS * CELL_SIZE, ROWS * CELL_SIZE)

	it("maps top-left corner (0,0) to flat index 0", () => {
		// Click just inside the top-left cell
		expect(cellAt(101, 201, R, COLS, CELL_SIZE, ROWS)).toBe(0)
	})

	it("maps bottom-right corner to last flat index", () => {
		// Click just inside the bottom-right cell (row=4, col=4)
		const x = 100 + 4 * CELL_SIZE + 1
		const y = 200 + 4 * CELL_SIZE + 1
		expect(cellAt(x, y, R, COLS, CELL_SIZE, ROWS)).toBe(ROWS * COLS - 1)
	})

	it("maps center of cell (1,2) correctly", () => {
		const x = 100 + 2 * CELL_SIZE + CELL_SIZE / 2
		const y = 200 + 1 * CELL_SIZE + CELL_SIZE / 2
		const expected = 1 * COLS + 2
		expect(cellAt(x, y, R, COLS, CELL_SIZE, ROWS)).toBe(expected)
	})

	it("returns -1 when pointer is to the left of the canvas", () => {
		expect(cellAt(99, 210, R, COLS, CELL_SIZE, ROWS)).toBe(-1)
	})

	it("returns -1 when pointer is above the canvas", () => {
		expect(cellAt(110, 199, R, COLS, CELL_SIZE, ROWS)).toBe(-1)
	})

	it("returns -1 when pointer is to the right of the canvas", () => {
		expect(cellAt(100 + COLS * CELL_SIZE + 1, 210, R, COLS, CELL_SIZE, ROWS)).toBe(-1)
	})

	it("returns -1 when pointer is below the canvas", () => {
		expect(cellAt(110, 200 + ROWS * CELL_SIZE + 1, R, COLS, CELL_SIZE, ROWS)).toBe(-1)
	})

	it("returns -1 when pointer is exactly on the right boundary", () => {
		// The right boundary is exclusive
		const x = 100 + COLS * CELL_SIZE
		expect(cellAt(x, 201, R, COLS, CELL_SIZE, ROWS)).toBe(-1)
	})

	it("returns -1 when pointer is exactly on the bottom boundary", () => {
		const y = 200 + ROWS * CELL_SIZE
		expect(cellAt(101, y, R, COLS, CELL_SIZE, ROWS)).toBe(-1)
	})

	it("handles non-square grids (cols != rows)", () => {
		const r = rect(0, 0, 10 * CELL_SIZE, 5 * CELL_SIZE) // 5 rows, 10 cols
		const rows = 5
		const cols = 10
		// Cell (2, 7)
		const x = 7 * CELL_SIZE + 5
		const y = 2 * CELL_SIZE + 5
		expect(cellAt(x, y, r, cols, CELL_SIZE, rows)).toBe(2 * cols + 7)
	})

	it("handles fractional coordinates — truncates to cell", () => {
		// Click at 1.9 cells from left → should land in col 1, not col 2
		const x = 100 + 1.9 * CELL_SIZE
		const y = 200 + 0.5 * CELL_SIZE
		expect(cellAt(x, y, R, COLS, CELL_SIZE, ROWS)).toBe(0 * COLS + 1)
	})

	it("returns -1 when floating-point rounding pushes row to exactly rows (bottom-boundary edge case)", () => {
		// Construct a scenario where Math.floor(y_offset / cellSize) == rows,
		// while y_offset is still technically within the canvas rect.
		// cellSize = 3, rows = 3 → canvasH = 9.
		// y_offset = 8.9999… → Math.floor(8.9999 / 3) = 2 (safe).
		// But with cellSize = 3.3333…, rows = 3 → canvasH = 10.
		// y_offset = 9.9999 → Math.floor(9.9999 / 3.3333…) could be 3 == rows.
		// We test with a carefully chosen cellSize that triggers row == rows.
		const rows = 3
		const cols = 4
		const cellSize = 10 / rows // ≈ 3.3333…
		const canvasW = cols * cellSize
		const canvasH = rows * cellSize // == 10.0 exactly
		const rFrac = rect(0, 0, canvasW, canvasH)
		// y_offset just below canvasH: passes OOB check, but Math.floor might give `rows`
		// Use a y that is exactly (rows * cellSize - epsilon), in-bounds per rect,
		// but produces row = rows when divided by a non-integer cellSize.
		// We force the scenario by passing y_offset = rows * cellSize which should
		// be caught by the row >= rows guard (not the rect OOB check which uses >=).
		// rows * cellSize == canvasH → y_offset == canvasH → NOT caught by x<0||y<0||x>=W||y>=H
		// because y >= canvasH IS caught by the OOB rect check (y >= rect.bottom - rect.top).
		// So the definitive test: just verify the guard exists and is effective by
		// checking that a point at exactly row=ROWS from top is rejected.
		// y_offset = ROWS * cellSize → row = ROWS after Math.floor → must be -1
		const yExactlyAtRowBoundary = rows * cellSize // == canvasH exactly
		// This hits the rect OOB check (y >= canvasH), so returns -1 from there.
		expect(cellAt(canvasW / 2, yExactlyAtRowBoundary, rFrac, cols, cellSize, rows)).toBe(-1)

		// The meaningful test: ensure the rows parameter is wired and the row guard
		// returns -1 when row >= rows. We test cellAt with explicit rows param by
		// passing a smaller rows value than what the canvas was built for.
		// If rows param is ignored, cellAt returns a valid index; if guarded, returns -1.
		const rFull = rect(0, 0, COLS * CELL_SIZE, ROWS * CELL_SIZE) // 5×5 grid canvas
		// Point in the last row (row=4) of a 5-row canvas, but we declare rows=4 →
		// any point in row 4 should return -1 because row >= 4.
		const xMid = (COLS * CELL_SIZE) / 2
		const yLastRow = 4 * CELL_SIZE + 1 // inside canvas, inside last row (row=4 of 5)
		expect(cellAt(xMid, yLastRow, rFull, COLS, CELL_SIZE, 4)).toBe(-1)
	})
})
