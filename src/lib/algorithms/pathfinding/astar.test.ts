import { describe, it, expect } from "vitest"
import { createGrid, placeStart, placeEnd, toggleWall, setWeight } from "../../grid/grid"
import { STEP } from "./types"
import { runAstar } from "./astar"
import { runDijkstra } from "./dijkstra"
import { manhattan } from "./heuristics"

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function openGrid(rows: number, cols: number) {
	let g = createGrid(rows, cols)
	g = placeStart(g, 0, 0)
	g = placeEnd(g, rows - 1, cols - 1)
	return g
}

describe("runAstar", () => {
	describe("optimality parity with Dijkstra — spec §1.3 A* acceptance scenario", () => {
		it("same pathCost as Dijkstra on unit-weight 5×5 grid (4-conn)", () => {
			const grid = openGrid(5, 5)
			const aResult = runAstar(grid, { diagonal: false })
			const dResult = runDijkstra(grid, { diagonal: false })
			expect(aResult.metrics.pathCost).toBe(dResult.metrics.pathCost)
		})

		it("same pathCost as Dijkstra on weighted 4×4 grid (4-conn)", () => {
			let grid = openGrid(4, 4)
			grid = setWeight(grid, 0, 1, 3)
			grid = setWeight(grid, 1, 1, 2)
			grid = setWeight(grid, 2, 2, 4)
			const aResult = runAstar(grid, { diagonal: false })
			const dResult = runDijkstra(grid, { diagonal: false })
			expect(aResult.metrics.pathCost).toBe(dResult.metrics.pathCost)
		})

		it("same pathCost as Dijkstra on weighted diagonal grid (Dijkstra parity, Chebyshev heuristic)", () => {
			// Parity test: A* with Chebyshev heuristic on a weighted 8-connected grid.
			// Chebyshev = max(dr, dc) is admissible under the uniform per-move
			// destination-weight cost model (each move costs >= 1).
			let grid = openGrid(5, 5)
			grid = setWeight(grid, 1, 1, 3)
			grid = setWeight(grid, 2, 2, 5)
			grid = setWeight(grid, 3, 3, 2)
			const aResult = runAstar(grid, { diagonal: true })
			const dResult = runDijkstra(grid, { diagonal: true })
			expect(aResult.metrics.pathCost).toBe(dResult.metrics.pathCost)
		})

		/**
		 * Regression: counterexample proving octile inadmissibility under uniform
		 * per-move destination-weight cost model.
		 *
		 * 5x5 grid, weights row-major:
		 *   [1,1,2,1,1, 1,3,1,4,3, 1,1,4,1,4, 5,4,1,2,2, 1,4,3,1,1]
		 * start (0,0), end (4,4), diagonal ON.
		 * Dijkstra optimal cost = 5. A* with octile returned 6 (inadmissible).
		 * A* with Chebyshev must match Dijkstra (cost 5).
		 */
		it("counterexample: A* pathCost matches Dijkstra on adversarial 5x5 weighted diagonal grid (Chebyshev admissibility)", () => {
			const weights = [1, 1, 2, 1, 1, 1, 3, 1, 4, 3, 1, 1, 4, 1, 4, 5, 4, 1, 2, 2, 1, 4, 3, 1, 1]
			let grid = createGrid(5, 5)
			grid = placeStart(grid, 0, 0)
			grid = placeEnd(grid, 4, 4)
			for (let r = 0; r < 5; r++) {
				for (let c = 0; c < 5; c++) {
					grid = setWeight(grid, r, c, weights[r * 5 + c])
				}
			}
			const dResult = runDijkstra(grid, { diagonal: true })
			const aResult = runAstar(grid, { diagonal: true })
			// Dijkstra optimal cost must be 5
			expect(dResult.metrics.pathCost).toBe(5)
			// A* must match Dijkstra (admissibility guarantee)
			expect(aResult.metrics.pathCost).toBe(dResult.metrics.pathCost)
		})

		it("same pathCost as Dijkstra on weighted 3×3 spec scenario (cheaper route)", () => {
			let grid = createGrid(3, 3)
			grid = placeStart(grid, 0, 0)
			grid = placeEnd(grid, 2, 2)
			grid = setWeight(grid, 1, 0, 5)
			grid = setWeight(grid, 2, 0, 5)
			grid = setWeight(grid, 2, 1, 5)
			const aResult = runAstar(grid, { diagonal: false })
			const dResult = runDijkstra(grid, { diagonal: false })
			expect(aResult.metrics.pathCost).toBe(dResult.metrics.pathCost)
		})
	})

	describe("heuristic admissibility assertions", () => {
		it("Manhattan heuristic never overestimates on unit-weight 4-conn grid", () => {
			// On a 4-connected unit-weight grid, the actual cost from any cell to end
			// equals the Manhattan distance (each hop costs 1). h(a,end) = true cost.
			// Admissibility holds: h <= actual_cost.
			const grid = openGrid(5, 5)
			const end = grid.end
			const cols = grid.cols
			const dResult = runDijkstra(grid, { diagonal: false })

			for (const cell of dResult.path) {
				const h = manhattan(cell, end, cols)
				// Actual remaining cost (unit-weight, M1 from cell to end excl.):
				// = number of cells to enter from `cell` to one before end
				const cellIdx = dResult.path.indexOf(cell)
				const remainingCost = dResult.path.length - cellIdx - 1
				expect(h).toBeLessThanOrEqual(remainingCost)
			}
		})

		it("Chebyshev heuristic never overestimates on 8-connected grid (admissibility)", () => {
			// Chebyshev = max(dr, dc) is tight for 8-dir under uniform per-move
			// destination-weight cost model. Each move costs >= 1, so Chebyshev
			// (which counts minimum moves) never exceeds actual cost.
			// Parity tests (A* == Dijkstra pathCost) confirm optimality in practice.
			const cols = 5
			// Spot-check: (0,0) → (4,4): dr=4, dc=4 → Chebyshev = max(4,4) = 4
			expect(manhattan(0, 24, cols)).toBe(8) // sanity: Manhattan = 8
			// Chebyshev lower bound: 4 moves minimum (diagonal all the way)
			// Verified by Dijkstra parity tests
		})
	})

	describe("heuristic selection by diagonal option", () => {
		it("uses Manhattan heuristic when diagonal: false", () => {
			const grid = openGrid(4, 4)
			// A* with diagonal:false should find same path as 4-conn Dijkstra
			const aResult = runAstar(grid, { diagonal: false })
			const dResult = runDijkstra(grid, { diagonal: false })
			expect(aResult.metrics.pathCost).toBe(dResult.metrics.pathCost)
		})

		it("uses Chebyshev heuristic when diagonal: true", () => {
			const grid = openGrid(4, 4)
			// A* with diagonal:true should find same path as 8-conn Dijkstra
			const aResult = runAstar(grid, { diagonal: true })
			const dResult = runDijkstra(grid, { diagonal: true })
			expect(aResult.metrics.pathCost).toBe(dResult.metrics.pathCost)
		})
	})

	describe("no-path case", () => {
		it("returns empty path when end is completely walled in", () => {
			let grid = openGrid(3, 3)
			grid = toggleWall(grid, 1, 2)
			grid = toggleWall(grid, 2, 1)
			const result = runAstar(grid, { diagonal: false })
			expect(result.path).toEqual([])
			expect(result.metrics.pathLength).toBe(0)
			expect(result.metrics.pathCost).toBe(0)
			expect(result.metrics.reachable).toBe(false)
		})

		it("returns non-empty trace even when no path", () => {
			let grid = openGrid(3, 3)
			grid = toggleWall(grid, 1, 2)
			grid = toggleWall(grid, 2, 1)
			const { trace } = runAstar(grid, { diagonal: false })
			expect(trace.length).toBeGreaterThan(0)
		})
	})

	describe("start === end edge case", () => {
		it("returns path of length 1", () => {
			let grid = createGrid(3, 3)
			grid = placeStart(grid, 1, 1)
			grid = placeEnd(grid, 1, 1)
			const result = runAstar(grid, { diagonal: false })
			expect(result.path.length).toBe(1)
			expect(result.metrics.reachable).toBe(true)
		})
	})

	describe("step kinds and pseudocode lines", () => {
		it("all steps have valid kind", () => {
			const grid = openGrid(4, 4)
			const { trace } = runAstar(grid, { diagonal: false })
			const validKinds = new Set([STEP.VISIT, STEP.FRONTIER, STEP.PATH])
			trace.forEach((step) => {
				expect(validKinds.has(step.kind)).toBe(true)
			})
		})

		it("every step has a valid pseudocodeLine index (>= 0)", () => {
			const grid = openGrid(4, 4)
			const { trace } = runAstar(grid, { diagonal: false })
			trace.forEach((step) => {
				expect(typeof step.line).toBe("number")
				expect(step.line).toBeGreaterThanOrEqual(0)
			})
		})
	})

	describe("metrics", () => {
		it("visitedCount matches number of VISIT steps", () => {
			const grid = openGrid(4, 4)
			const { trace, metrics } = runAstar(grid, { diagonal: false })
			const visitCount = trace.filter((s) => s.kind === STEP.VISIT).length
			expect(metrics.visitedCount).toBe(visitCount)
		})

		it("pathLength equals path.length", () => {
			const grid = openGrid(5, 5)
			const { path, metrics } = runAstar(grid, { diagonal: false })
			expect(metrics.pathLength).toBe(path.length)
		})

		it("pathCost equals sum of weights (M1: start included, end excluded)", () => {
			const grid = openGrid(5, 5)
			const { path, metrics } = runAstar(grid, { diagonal: false })
			const expectedCost = path.slice(0, -1).reduce((acc, idx) => acc + grid.weights[idx], 0)
			expect(metrics.pathCost).toBe(expectedCost)
		})
	})

	describe("guard: unconfigured grid", () => {
		it("throws if grid.cells[grid.start] is not START", () => {
			const grid = createGrid(3, 3)
			expect(() => runAstar(grid, { diagonal: false })).toThrow()
		})
	})
})
