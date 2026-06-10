/**
 * Tests for PathfindingCanvas keyboard accessibility (PR4 task 5.3).
 *
 * Tests the keyboard-navigable cursor mode:
 * - Container has tabIndex=0 and role="application" for interactive use
 * - ArrowUp/Down/Left/Right move the keyboard cursor within bounds
 * - Space at cursor toggles wall (invokes onCellClick with correct cell index)
 * - w key at cursor cycles weight (invokes onWeightCycle with correct cell index)
 * - Canvas container carries an accessible label
 *
 * Tests use jsdom + Testing Library. Canvas 2D API is mocked.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import { PathfindingCanvas } from "./PathfindingCanvas"
import { createGrid, placeStart, placeEnd } from "@/lib/grid/grid"
import type { Grid } from "@/lib/grid/grid.types"
import type { Step } from "@/lib/algorithms/pathfinding/types"

// ---------------------------------------------------------------------------
// jsdom stubs
// ---------------------------------------------------------------------------

beforeAll(() => {
	const ctx = {
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		strokeRect: vi.fn(),
		beginPath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn(),
		fill: vi.fn(),
		scale: vi.fn(),
		setTransform: vi.fn(),
		save: vi.fn(),
		restore: vi.fn(),
		setLineDash: vi.fn(),
		fillStyle: "",
		strokeStyle: "",
		lineWidth: 1,
		globalAlpha: 1,
	}

	HTMLCanvasElement.prototype.getContext = vi.fn(
		() => ctx
	) as unknown as typeof HTMLCanvasElement.prototype.getContext

	Object.defineProperty(HTMLCanvasElement.prototype, "clientWidth", {
		get: () => 300,
		configurable: true,
	})
	Object.defineProperty(HTMLCanvasElement.prototype, "clientHeight", {
		get: () => 150,
		configurable: true,
	})

	class ResizeObserverMock {
		observe = vi.fn()
		unobserve = vi.fn()
		disconnect = vi.fn()
	}
	vi.stubGlobal("ResizeObserver", ResizeObserverMock)

	// MutationObserver stub (used for theme change detection)
	class MutationObserverMock {
		observe = vi.fn()
		disconnect = vi.fn()
		takeRecords = vi.fn(() => [])
	}
	vi.stubGlobal("MutationObserver", MutationObserverMock)
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGrid(rows = 5, cols = 5): Grid {
	let g = createGrid(rows, cols)
	g = placeStart(g, 0, 0)
	g = placeEnd(g, rows - 1, cols - 1)
	return g
}

const NO_TRACE: Step[] = []

// ---------------------------------------------------------------------------
// Accessibility: container role and label
// ---------------------------------------------------------------------------

describe("PathfindingCanvas — accessibility attributes", () => {
	it("container is focusable (tabIndex=0)", () => {
		const grid = makeGrid()
		const { container } = render(
			<PathfindingCanvas grid={grid} trace={NO_TRACE} cursor={0} cellSize={24} />
		)
		const div = container.firstChild as HTMLElement
		expect(div.tabIndex).toBe(0)
	})

	it("container carries an accessible label", () => {
		const grid = makeGrid()
		const { getByLabelText } = render(
			<PathfindingCanvas grid={grid} trace={NO_TRACE} cursor={0} cellSize={24} />
		)
		// aria-label should mention the grid
		expect(getByLabelText(/grid/i)).toBeDefined()
	})

	it("container has role application for interactive keyboard use", () => {
		const grid = makeGrid()
		const { getByRole } = render(
			<PathfindingCanvas grid={grid} trace={NO_TRACE} cursor={0} cellSize={24} />
		)
		expect(getByRole("application")).toBeDefined()
	})
})

// ---------------------------------------------------------------------------
// Keyboard navigation: arrow keys move cursor
// ---------------------------------------------------------------------------

describe("PathfindingCanvas — keyboard cursor navigation", () => {
	let onCellClick: ReturnType<typeof vi.fn>

	beforeEach(() => {
		onCellClick = vi.fn()
	})

	it("pressing Space at initial cursor position (0,0) invokes onCellClick with index 0+1 (skips start)", () => {
		// Start is at (0,0); pressing Space there should be a no-op (guard)
		// or invoke onCellClick — the spec says Space toggles wall; start cell will be a no-op in grid.ts
		// We just verify onCellClick is called with the cursor's cell index.
		const grid = makeGrid()
		const { getByRole } = render(
			<PathfindingCanvas
				grid={grid}
				trace={NO_TRACE}
				cursor={0}
				cellSize={24}
				onCellClick={onCellClick}
			/>
		)
		const container = getByRole("application")
		container.focus()
		// Move right to (0,1) which is an empty cell
		fireEvent.keyDown(container, { key: "ArrowRight" })
		// Press Space to toggle wall at (0,1)
		fireEvent.keyDown(container, { key: " " })
		// cellIndex for (0,1) in 5-col grid = 0*5+1 = 1
		expect(onCellClick).toHaveBeenCalledWith(1)
	})

	it("ArrowDown moves cursor one row down, Space invokes correct cell index", () => {
		const grid = makeGrid()
		const { getByRole } = render(
			<PathfindingCanvas
				grid={grid}
				trace={NO_TRACE}
				cursor={0}
				cellSize={24}
				onCellClick={onCellClick}
			/>
		)
		const container = getByRole("application")
		container.focus()
		// Move down to (1,0)
		fireEvent.keyDown(container, { key: "ArrowDown" })
		fireEvent.keyDown(container, { key: " " })
		// cellIndex for (1,0) in 5-col grid = 1*5+0 = 5
		expect(onCellClick).toHaveBeenCalledWith(5)
	})

	it("ArrowLeft does not go below col 0", () => {
		const grid = makeGrid()
		const { getByRole } = render(
			<PathfindingCanvas
				grid={grid}
				trace={NO_TRACE}
				cursor={0}
				cellSize={24}
				onCellClick={onCellClick}
			/>
		)
		const container = getByRole("application")
		container.focus()
		// cursor starts at (0,0) — ArrowLeft should clamp
		fireEvent.keyDown(container, { key: "ArrowLeft" })
		fireEvent.keyDown(container, { key: " " })
		// Still at (0,0) which is the start — Space calls onCellClick with 0
		expect(onCellClick).toHaveBeenCalledWith(0)
	})

	it("ArrowUp does not go above row 0", () => {
		const grid = makeGrid()
		const { getByRole } = render(
			<PathfindingCanvas
				grid={grid}
				trace={NO_TRACE}
				cursor={0}
				cellSize={24}
				onCellClick={onCellClick}
			/>
		)
		const container = getByRole("application")
		container.focus()
		// cursor starts at (0,0) — ArrowUp should clamp
		fireEvent.keyDown(container, { key: "ArrowUp" })
		fireEvent.keyDown(container, { key: " " })
		// Still at (0,0) — onCellClick called with 0
		expect(onCellClick).toHaveBeenCalledWith(0)
	})

	it("ArrowRight does not exceed last column", () => {
		const grid = makeGrid(5, 5)
		const { getByRole } = render(
			<PathfindingCanvas
				grid={grid}
				trace={NO_TRACE}
				cursor={0}
				cellSize={24}
				onCellClick={onCellClick}
			/>
		)
		const container = getByRole("application")
		container.focus()
		// Press ArrowRight 10 times — should clamp at col 4
		for (let i = 0; i < 10; i++) {
			fireEvent.keyDown(container, { key: "ArrowRight" })
		}
		fireEvent.keyDown(container, { key: " " })
		// Should be at (0,4) = index 4
		expect(onCellClick).toHaveBeenCalledWith(4)
	})

	it("ArrowDown does not exceed last row", () => {
		const grid = makeGrid(5, 5)
		const { getByRole } = render(
			<PathfindingCanvas
				grid={grid}
				trace={NO_TRACE}
				cursor={0}
				cellSize={24}
				onCellClick={onCellClick}
			/>
		)
		const container = getByRole("application")
		container.focus()
		// Press ArrowDown 10 times — should clamp at row 4
		for (let i = 0; i < 10; i++) {
			fireEvent.keyDown(container, { key: "ArrowDown" })
		}
		fireEvent.keyDown(container, { key: " " })
		// Should be at (4,0) = index 20
		expect(onCellClick).toHaveBeenCalledWith(20)
	})
})

// ---------------------------------------------------------------------------
// Keyboard weight cycling: w key
// ---------------------------------------------------------------------------

describe("PathfindingCanvas — keyboard weight cycling (w key)", () => {
	it("pressing w at cursor invokes onWeightCycle with the cursor cell index", () => {
		const onWeightCycle = vi.fn()
		const grid = makeGrid()
		const { getByRole } = render(
			<PathfindingCanvas
				grid={grid}
				trace={NO_TRACE}
				cursor={0}
				cellSize={24}
				onWeightCycle={onWeightCycle}
			/>
		)
		const container = getByRole("application")
		container.focus()
		// Move to (0,1) — an empty cell
		fireEvent.keyDown(container, { key: "ArrowRight" })
		fireEvent.keyDown(container, { key: "w" })
		expect(onWeightCycle).toHaveBeenCalledWith(1)
	})

	it("pressing W (uppercase) also invokes onWeightCycle", () => {
		const onWeightCycle = vi.fn()
		const grid = makeGrid()
		const { getByRole } = render(
			<PathfindingCanvas
				grid={grid}
				trace={NO_TRACE}
				cursor={0}
				cellSize={24}
				onWeightCycle={onWeightCycle}
			/>
		)
		const container = getByRole("application")
		container.focus()
		fireEvent.keyDown(container, { key: "ArrowRight" })
		fireEvent.keyDown(container, { key: "W" })
		expect(onWeightCycle).toHaveBeenCalledWith(1)
	})
})
