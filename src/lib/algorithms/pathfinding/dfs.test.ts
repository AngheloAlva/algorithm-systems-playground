import { describe, it, expect } from "vitest"
import { createGrid, placeStart, placeEnd, toggleWall } from "../../grid/grid"
import { STEP } from "./types"
import { runDfs } from "./dfs"

// ---------------------------------------------------------------------------
// Helper: open grid with start at (0,0) and end at (rows-1, cols-1)
// ---------------------------------------------------------------------------

function openGrid(rows: number, cols: number) {
	let g = createGrid(rows, cols)
	g = placeStart(g, 0, 0)
	g = placeEnd(g, rows - 1, cols - 1)
	return g
}

describe("runDfs", () => {
	describe("reachability — spec §1.3 DFS contract", () => {
		it("returns path.length >= 2 when end is reachable", () => {
			const grid = openGrid(5, 5)
			const result = runDfs(grid, { diagonal: false })
			// DFS finds A path — at minimum start + end
			expect(result.path.length).toBeGreaterThanOrEqual(2)
		})

		it("path starts at grid.start and ends at grid.end", () => {
			const grid = openGrid(5, 5)
			const { path } = runDfs(grid, { diagonal: false })
			expect(path[0]).toBe(grid.start)
			expect(path[path.length - 1]).toBe(grid.end)
		})

		it("VISIT steps include at least one visit for the end cell", () => {
			const grid = openGrid(3, 3)
			const { trace } = runDfs(grid, { diagonal: false })
			const endVisited = trace.some((s) => s.kind === STEP.VISIT && s.cell === grid.end)
			expect(endVisited).toBe(true)
		})

		it("DFS does NOT guarantee optimal path (no assertion on length)", () => {
			// This test documents that path optimality is NOT a DFS requirement.
			// We verify only that a path exists.
			const grid = openGrid(5, 5)
			const { path } = runDfs(grid, { diagonal: false })
			expect(path.length).toBeGreaterThanOrEqual(2)
		})
	})

	describe("step kinds", () => {
		it("all steps have a valid kind", () => {
			const grid = openGrid(4, 4)
			const { trace } = runDfs(grid, { diagonal: false })
			const validKinds = new Set([STEP.VISIT, STEP.FRONTIER, STEP.PATH])
			trace.forEach((step) => {
				expect(validKinds.has(step.kind)).toBe(true)
			})
		})

		it("every step has a valid pseudocodeLine index (>= 0)", () => {
			const grid = openGrid(4, 4)
			const { trace } = runDfs(grid, { diagonal: false })
			trace.forEach((step) => {
				expect(typeof step.line).toBe("number")
				expect(step.line).toBeGreaterThanOrEqual(0)
			})
		})
	})

	describe("no-path case", () => {
		it("returns empty path when end is completely walled in", () => {
			let grid = openGrid(3, 3)
			grid = toggleWall(grid, 1, 2)
			grid = toggleWall(grid, 2, 1)
			const result = runDfs(grid, { diagonal: false })
			expect(result.path).toEqual([])
			expect(result.metrics.pathLength).toBe(0)
			expect(result.metrics.pathCost).toBe(0)
			expect(result.metrics.reachable).toBe(false)
		})

		it("still returns non-empty trace even when no path found", () => {
			let grid = openGrid(3, 3)
			grid = toggleWall(grid, 1, 2)
			grid = toggleWall(grid, 2, 1)
			const { trace } = runDfs(grid, { diagonal: false })
			expect(trace.length).toBeGreaterThan(0)
		})
	})

	describe("start === end edge case", () => {
		it("returns path of length 1 when start and end are the same cell", () => {
			let grid = createGrid(3, 3)
			grid = placeStart(grid, 1, 1)
			grid = placeEnd(grid, 1, 1)
			const result = runDfs(grid, { diagonal: false })
			expect(result.path.length).toBe(1)
			expect(result.metrics.reachable).toBe(true)
		})
	})

	describe("metrics", () => {
		it("visitedCount matches number of VISIT steps", () => {
			const grid = openGrid(4, 4)
			const { trace, metrics } = runDfs(grid, { diagonal: false })
			const visitCount = trace.filter((s) => s.kind === STEP.VISIT).length
			expect(metrics.visitedCount).toBe(visitCount)
		})

		it("pathLength equals path.length", () => {
			const grid = openGrid(4, 4)
			const { path, metrics } = runDfs(grid, { diagonal: false })
			expect(metrics.pathLength).toBe(path.length)
		})

		it("pathCost equals sum of weights (start included, end excluded — M1)", () => {
			const grid = openGrid(4, 4)
			const { path, metrics } = runDfs(grid, { diagonal: false })
			if (path.length === 0) return // no path case
			const expectedCost = path.slice(0, -1).reduce((acc, idx) => acc + grid.weights[idx], 0)
			expect(metrics.pathCost).toBe(expectedCost)
		})
	})

	describe("guard: unconfigured grid", () => {
		it("throws if grid.cells[grid.start] is not START", () => {
			const grid = createGrid(3, 3) // start not placed
			expect(() => runDfs(grid, { diagonal: false })).toThrow()
		})
	})
})
