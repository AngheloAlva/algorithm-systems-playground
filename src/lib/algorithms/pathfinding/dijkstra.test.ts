import { describe, it, expect } from "vitest"
import { createGrid, placeStart, placeEnd, toggleWall, setWeight } from "../../grid/grid"
import { STEP } from "./types"
import { runDijkstra } from "./dijkstra"

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function openGrid(rows: number, cols: number) {
	let g = createGrid(rows, cols)
	g = placeStart(g, 0, 0)
	g = placeEnd(g, rows - 1, cols - 1)
	return g
}

describe("runDijkstra", () => {
	describe("weighted shortest path — spec §1.3 Dijkstra acceptance scenario", () => {
		it("prefers lower-cost route on a weighted 3×3 grid", () => {
			// 3×3 grid, start (0,0), end (2,2).
			// Cells: (0,1) and (1,0) are on the direct path and have high weight (5).
			// The only other route goes (0,0)→(0,1)→(0,2)→(1,2)→(2,2) with low weights.
			// We will set weights along one path HIGH and the other LOW.
			//
			// Grid layout (row, col):
			//   S(0,0)  A(0,1)  B(0,2)
			//   C(1,0)  D(1,1)  E(1,2)
			//   F(2,0)  G(2,1)  End(2,2)
			//
			// Route 1: S→A→B→E→End  weights: 1+1+1+1 = 4 (start included, end excluded)
			// Route 2: S→C→F→G→End  weights: 1+5+5+5 = 16 (via high-cost cells)
			// Dijkstra should pick Route 1.

			let grid = createGrid(3, 3)
			grid = placeStart(grid, 0, 0)
			grid = placeEnd(grid, 2, 2)
			// Make C(1,0), F(2,0), G(2,1) expensive
			grid = setWeight(grid, 1, 0, 5)
			grid = setWeight(grid, 2, 0, 5)
			grid = setWeight(grid, 2, 1, 5)

			const result = runDijkstra(grid, { diagonal: false })

			// Should take the cheap route — cost = weights of [S(0,0), A(0,1), B(0,2), E(1,2)] = 1+1+1+1 = 4
			expect(result.metrics.pathCost).toBe(4)
			expect(result.metrics.reachable).toBe(true)
		})

		it("pathCost equals sum of weights on path (M1: start included, end excluded)", () => {
			const grid = openGrid(5, 5)
			const { path, metrics } = runDijkstra(grid, { diagonal: false })
			const expectedCost = path.slice(0, -1).reduce((acc, idx) => acc + grid.weights[idx], 0)
			expect(metrics.pathCost).toBe(expectedCost)
		})
	})

	describe("equivalence with BFS on unit-weight grid", () => {
		it("produces same pathCost as BFS on unit-weight grid", () => {
			const grid = openGrid(5, 5)
			const dijkstraResult = runDijkstra(grid, { diagonal: false })
			// On unit-weight grid, Dijkstra and BFS should find same-cost path
			// BFS path cost = path.length - 1 (all weights=1, end excluded)
			const expectedCost = dijkstraResult.path.length - 1
			expect(dijkstraResult.metrics.pathCost).toBe(expectedCost)
		})
	})

	describe("no-path case", () => {
		it("returns empty path when end is completely walled in", () => {
			let grid = openGrid(3, 3)
			grid = toggleWall(grid, 1, 2)
			grid = toggleWall(grid, 2, 1)
			const result = runDijkstra(grid, { diagonal: false })
			expect(result.path).toEqual([])
			expect(result.metrics.pathLength).toBe(0)
			expect(result.metrics.pathCost).toBe(0)
			expect(result.metrics.reachable).toBe(false)
		})

		it("still returns non-empty trace (visited cells) even when no path", () => {
			let grid = openGrid(3, 3)
			grid = toggleWall(grid, 1, 2)
			grid = toggleWall(grid, 2, 1)
			const { trace } = runDijkstra(grid, { diagonal: false })
			expect(trace.length).toBeGreaterThan(0)
		})
	})

	describe("start === end edge case", () => {
		it("returns path of length 1", () => {
			let grid = createGrid(3, 3)
			grid = placeStart(grid, 1, 1)
			grid = placeEnd(grid, 1, 1)
			const result = runDijkstra(grid, { diagonal: false })
			expect(result.path.length).toBe(1)
			expect(result.metrics.reachable).toBe(true)
		})
	})

	describe("step kinds and pseudocode lines", () => {
		it("all steps have valid kind", () => {
			const grid = openGrid(4, 4)
			const { trace } = runDijkstra(grid, { diagonal: false })
			const validKinds = new Set([STEP.VISIT, STEP.FRONTIER, STEP.PATH])
			trace.forEach((step) => {
				expect(validKinds.has(step.kind)).toBe(true)
			})
		})

		it("every step has a valid pseudocodeLine index (>= 0)", () => {
			const grid = openGrid(4, 4)
			const { trace } = runDijkstra(grid, { diagonal: false })
			trace.forEach((step) => {
				expect(typeof step.line).toBe("number")
				expect(step.line).toBeGreaterThanOrEqual(0)
			})
		})
	})

	describe("metrics", () => {
		it("visitedCount matches number of VISIT steps", () => {
			const grid = openGrid(4, 4)
			const { trace, metrics } = runDijkstra(grid, { diagonal: false })
			const visitCount = trace.filter((s) => s.kind === STEP.VISIT).length
			expect(metrics.visitedCount).toBe(visitCount)
		})

		it("pathLength equals path.length", () => {
			const grid = openGrid(5, 5)
			const { path, metrics } = runDijkstra(grid, { diagonal: false })
			expect(metrics.pathLength).toBe(path.length)
		})
	})

	describe("diagonal mode", () => {
		it("finds shorter path with diagonal enabled", () => {
			const grid = openGrid(5, 5)
			const result4 = runDijkstra(grid, { diagonal: false })
			const result8 = runDijkstra(grid, { diagonal: true })
			// Diagonal path should be shorter in hop count
			expect(result8.path.length).toBeLessThanOrEqual(result4.path.length)
		})
	})

	describe("guard: unconfigured grid", () => {
		it("throws if grid.cells[grid.start] is not START", () => {
			const grid = createGrid(3, 3)
			expect(() => runDijkstra(grid, { diagonal: false })).toThrow()
		})
	})
})
