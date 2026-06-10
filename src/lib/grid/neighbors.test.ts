import { describe, it, expect } from "vitest"
import { createGrid, neighbors, index, toggleWall } from "./grid"

// ---------------------------------------------------------------------------
// Helper — build a grid and place start/end explicitly to allow toggleWall
// ---------------------------------------------------------------------------

function grid(rows: number, cols: number) {
	return createGrid(rows, cols)
}

describe("neighbors — 4-connectivity (default)", () => {
	it("center cell of 3×3 has 4 neighbors", () => {
		const g = grid(3, 3)
		const ns = neighbors(index(1, 1, 3), g, { diagonal: false })
		expect(ns).toHaveLength(4)
	})

	it("corner cell (0,0) has 2 neighbors", () => {
		const g = grid(3, 3)
		const ns = neighbors(index(0, 0, 3), g, { diagonal: false })
		expect(ns).toHaveLength(2)
	})

	it("top-right corner (0,cols-1) has 2 neighbors", () => {
		const g = grid(3, 3)
		const ns = neighbors(index(0, 2, 3), g, { diagonal: false })
		expect(ns).toHaveLength(2)
	})

	it("bottom-left corner (rows-1,0) has 2 neighbors", () => {
		const g = grid(3, 3)
		const ns = neighbors(index(2, 0, 3), g, { diagonal: false })
		expect(ns).toHaveLength(2)
	})

	it("bottom-right corner (rows-1,cols-1) has 2 neighbors", () => {
		const g = grid(3, 3)
		const ns = neighbors(index(2, 2, 3), g, { diagonal: false })
		expect(ns).toHaveLength(2)
	})

	it("edge cell (top row, not corner) has 3 neighbors", () => {
		const g = grid(3, 3)
		const ns = neighbors(index(0, 1, 3), g, { diagonal: false })
		expect(ns).toHaveLength(3)
	})

	it("edge cell (left col, not corner) has 3 neighbors", () => {
		const g = grid(3, 3)
		const ns = neighbors(index(1, 0, 3), g, { diagonal: false })
		expect(ns).toHaveLength(3)
	})

	it("returns neighbors in fixed N,E,S,W order", () => {
		// Center of 3×3: N=(0,1)→1, E=(1,2)→5, S=(2,1)→7, W=(1,0)→3
		const g = grid(3, 3)
		const ns = neighbors(index(1, 1, 3), g, { diagonal: false })
		expect(ns).toEqual([
			index(0, 1, 3), // N
			index(1, 2, 3), // E
			index(2, 1, 3), // S
			index(1, 0, 3), // W
		])
	})

	it("excludes wall cells", () => {
		let g = grid(3, 3)
		g = toggleWall(g, 0, 1) // wall N of center
		const ns = neighbors(index(1, 1, 3), g, { diagonal: false })
		expect(ns).not.toContain(index(0, 1, 3))
		expect(ns).toHaveLength(3)
	})

	it("excludes out-of-bounds — no wrapping", () => {
		const g = grid(5, 5)
		// Cell at (0,0): N and W are out of bounds
		const ns = neighbors(index(0, 0, 5), g, { diagonal: false })
		for (const n of ns) {
			expect(n).toBeGreaterThanOrEqual(0)
			expect(n).toBeLessThan(5 * 5)
		}
		expect(ns).toHaveLength(2)
	})
})

describe("neighbors — 8-connectivity (diagonal)", () => {
	it("center cell of 3×3 has 8 neighbors", () => {
		const g = grid(3, 3)
		const ns = neighbors(index(1, 1, 3), g, { diagonal: true })
		expect(ns).toHaveLength(8)
	})

	it("corner cell (0,0) has 3 neighbors", () => {
		const g = grid(3, 3)
		const ns = neighbors(index(0, 0, 3), g, { diagonal: true })
		expect(ns).toHaveLength(3)
	})

	it("edge cell (top row, not corner) has 5 neighbors", () => {
		const g = grid(3, 3)
		const ns = neighbors(index(0, 1, 3), g, { diagonal: true })
		expect(ns).toHaveLength(5)
	})

	it("returns 8-conn neighbors in fixed N,E,S,W,NE,SE,SW,NW order", () => {
		const cols = 3
		const g = grid(3, cols)
		const ns = neighbors(index(1, 1, cols), g, { diagonal: true })
		expect(ns).toEqual([
			index(0, 1, cols), // N
			index(1, 2, cols), // E
			index(2, 1, cols), // S
			index(1, 0, cols), // W
			index(0, 2, cols), // NE
			index(2, 2, cols), // SE
			index(2, 0, cols), // SW
			index(0, 0, cols), // NW
		])
	})

	it("excludes diagonal wall cells", () => {
		let g = grid(3, 3)
		g = toggleWall(g, 0, 2) // wall NE of center
		const ns = neighbors(index(1, 1, 3), g, { diagonal: true })
		expect(ns).not.toContain(index(0, 2, 3))
		expect(ns).toHaveLength(7)
	})
})

describe("neighbors — no corner cutting (diagonal)", () => {
	it("excludes diagonal when both adjacent cardinals are walls", () => {
		// Grid:
		//   # # .
		//   # C .    (C = center at (1,1))
		//   . . .
		// N=(0,1) is wall, W=(1,0) is wall → NW=(0,0) diagonal must be excluded
		let g = grid(3, 3)
		g = toggleWall(g, 0, 1) // N wall
		g = toggleWall(g, 1, 0) // W wall
		const ns = neighbors(index(1, 1, 3), g, { diagonal: true })
		expect(ns).not.toContain(index(0, 0, 3)) // NW blocked
	})

	it("excludes diagonal when one adjacent cardinal is a wall", () => {
		// N=(0,1) is wall but W=(1,0) is open → NW=(0,0) diagonal must still be excluded
		let g = grid(3, 3)
		g = toggleWall(g, 0, 1) // N wall only
		const ns = neighbors(index(1, 1, 3), g, { diagonal: true })
		expect(ns).not.toContain(index(0, 0, 3)) // NW blocked because N is wall
	})

	it("includes diagonal when both adjacent cardinals are open", () => {
		// No walls → all 8 neighbors reachable, including NW=(0,0)
		const g = grid(3, 3)
		const ns = neighbors(index(1, 1, 3), g, { diagonal: true })
		expect(ns).toContain(index(0, 0, 3)) // NW included
		expect(ns).toHaveLength(8)
	})
})

describe("neighbors — large grid bounds", () => {
	it("works on a 24×44 default-size grid without index overflow", () => {
		const g = grid(24, 44)
		// Last cell (23,43) — bottom-right corner
		const ns = neighbors(index(23, 43, 44), g, { diagonal: false })
		expect(ns).toHaveLength(2)
		// All indices in range
		for (const n of ns) {
			expect(n).toBeGreaterThanOrEqual(0)
			expect(n).toBeLessThan(24 * 44)
		}
	})
})
