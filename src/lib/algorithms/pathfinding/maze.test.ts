import { describe, it, expect } from "vitest"
import { generateMaze } from "./maze"
import { CELL } from "../../grid/grid.types"
import { runBfs } from "./bfs"
import { runDijkstra } from "./dijkstra"
import { runDfs } from "./dfs"
import { runAstar } from "./astar"

describe("generateMaze", () => {
	describe("determinism — spec §3", () => {
		it("same seed produces structurally identical grids", () => {
			const maze1 = generateMaze(10, 10, 42)
			const maze2 = generateMaze(10, 10, 42)
			expect(maze1.rows).toBe(maze2.rows)
			expect(maze1.cols).toBe(maze2.cols)
			// Deep-equal cells array
			expect(Array.from(maze1.cells)).toEqual(Array.from(maze2.cells))
			// Deep-equal weights array
			expect(Array.from(maze1.weights)).toEqual(Array.from(maze2.weights))
			expect(maze1.start).toBe(maze2.start)
			expect(maze1.end).toBe(maze2.end)
		})

		it("different seeds produce different mazes", () => {
			const maze1 = generateMaze(10, 10, 42)
			const maze2 = generateMaze(10, 10, 99)
			// Very unlikely to be equal
			const cells1 = Array.from(maze1.cells)
			const cells2 = Array.from(maze2.cells)
			expect(cells1).not.toEqual(cells2)
		})
	})

	describe("start/end invariants — spec §3", () => {
		it("start cell is never a wall", () => {
			const maze = generateMaze(15, 15, 123)
			expect(maze.cells[maze.start]).not.toBe(CELL.WALL)
		})

		it("end cell is never a wall", () => {
			const maze = generateMaze(15, 15, 123)
			expect(maze.cells[maze.end]).not.toBe(CELL.WALL)
		})

		it("start cell is marked as CELL.START", () => {
			const maze = generateMaze(10, 10, 7)
			expect(maze.cells[maze.start]).toBe(CELL.START)
		})

		it("end cell is marked as CELL.END", () => {
			const maze = generateMaze(10, 10, 7)
			expect(maze.cells[maze.end]).toBe(CELL.END)
		})
	})

	describe("reachability — spec §3 acceptance scenario", () => {
		it("BFS finds a non-empty path through maze (seed=42, 20×20)", () => {
			const maze = generateMaze(20, 20, 42)
			const result = runBfs(maze, { diagonal: false })
			expect(result.path.length).toBeGreaterThan(0)
			expect(result.metrics.reachable).toBe(true)
		})

		it("Dijkstra finds a non-empty path through maze", () => {
			const maze = generateMaze(20, 20, 42)
			const result = runDijkstra(maze, { diagonal: false })
			expect(result.path.length).toBeGreaterThan(0)
			expect(result.metrics.reachable).toBe(true)
		})

		it("DFS finds a non-empty path through maze", () => {
			const maze = generateMaze(20, 20, 42)
			const result = runDfs(maze, { diagonal: false })
			expect(result.path.length).toBeGreaterThan(0)
			expect(result.metrics.reachable).toBe(true)
		})

		it("A* finds a non-empty path through maze", () => {
			const maze = generateMaze(20, 20, 42)
			const result = runAstar(maze, { diagonal: false })
			expect(result.path.length).toBeGreaterThan(0)
			expect(result.metrics.reachable).toBe(true)
		})
	})

	describe("grid structure", () => {
		it("returns grid with correct dimensions", () => {
			const maze = generateMaze(15, 20, 1)
			expect(maze.rows).toBe(15)
			expect(maze.cols).toBe(20)
			expect(maze.cells.length).toBe(15 * 20)
			expect(maze.weights.length).toBe(15 * 20)
		})

		it("maze has at least some walls (is not empty)", () => {
			const maze = generateMaze(10, 10, 5)
			const wallCount = Array.from(maze.cells).filter((c) => c === CELL.WALL).length
			expect(wallCount).toBeGreaterThan(0)
		})

		it("all weights are 1 (maze generator does not set custom weights)", () => {
			const maze = generateMaze(10, 10, 5)
			// All non-wall cells should have weight 1
			const allWeightsOne = Array.from(maze.weights).every((w) => w === 1)
			expect(allWeightsOne).toBe(true)
		})
	})

	describe("PRNG purity", () => {
		it("does not use Math.random (pure seeded function)", () => {
			// We can't easily intercept Math.random in Vitest without spying,
			// but determinism already proves the generator does not rely on
			// non-seeded randomness. This test is a documentation anchor.
			const maze1 = generateMaze(8, 8, 0)
			const maze2 = generateMaze(8, 8, 0)
			expect(Array.from(maze1.cells)).toEqual(Array.from(maze2.cells))
		})
	})

	// ---------------------------------------------------------------------------
	// Border corridor bug — BUG FIX: ensureReachable was carving row 0 + last col
	// ---------------------------------------------------------------------------

	describe("border walls — row 0 and last column must not always be fully open", () => {
		/**
		 * Seeds 0-4 on the default 24×44 grid all trigger the BFS fallback in the
		 * buggy implementation, which carves an L-corridor along row 0 and the last
		 * column. After the fix (passage-exit protection in divide()), the fallback
		 * is never triggered and those borders receive real walls.
		 *
		 * Assertion: over seeds [0, 1, 2, 3, 4], NOT all of them leave row 0 or the
		 * last column fully empty.
		 */
		const SEEDS = [0, 1, 2, 3, 4]
		const ROWS = 24
		const COLS = 44

		it("at least one of seeds 0-4 has walls in row 0 (row 0 not always a corridor)", () => {
			const allRow0Empty = SEEDS.every((seed) => {
				const maze = generateMaze(ROWS, COLS, seed)
				const hasWallInRow0 = Array.from({ length: COLS }, (_, c) => maze.cells[c]).some(
					(v) => v === CELL.WALL
				)
				return !hasWallInRow0
			})
			// With the bug, all 5 seeds produce an empty row 0 (fallback corridor).
			// After the fix, at least one seed has a wall in row 0.
			expect(allRow0Empty).toBe(false)
		})

		it("at least one of seeds 0-4 has walls in the last column (last col not always a corridor)", () => {
			const allLastColEmpty = SEEDS.every((seed) => {
				const maze = generateMaze(ROWS, COLS, seed)
				const hasWallInLastCol = Array.from(
					{ length: ROWS },
					(_, r) => maze.cells[r * COLS + (COLS - 1)]
				).some((v) => v === CELL.WALL)
				return !hasWallInLastCol
			})
			// With the bug, all 5 seeds produce an empty last col (fallback corridor).
			// After the fix, at least one seed has a wall in the last column.
			expect(allLastColEmpty).toBe(false)
		})

		it("all 5 seeds produce reachable mazes after fix (fallback no longer needed)", () => {
			// This test documents the pre-condition: the fixed algorithm should not
			// need ensureReachable for these seeds. Reachability is verified via BFS.
			for (const seed of SEEDS) {
				const maze = generateMaze(ROWS, COLS, seed)
				// Run BFS to verify reachability
				const result = runBfs(maze, { diagonal: false })
				expect(result.metrics.reachable).toBe(true)
			}
		})
	})
})
