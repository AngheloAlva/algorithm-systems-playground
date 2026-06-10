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

	// Stub pointer capture APIs (required for pointerdown tests)
	HTMLElement.prototype.setPointerCapture = vi.fn()
	HTMLElement.prototype.releasePointerCapture = vi.fn()
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
		const { getByRole } = render(
			<PathfindingCanvas grid={grid} trace={NO_TRACE} cursor={0} cellSize={24} />
		)
		// After FIX 3, the live-region span is rendered before the application div,
		// so container.firstChild is no longer the application div — use getByRole.
		const div = getByRole("application")
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
	let onCellClick: ReturnType<typeof vi.fn<(cellIndex: number, isPointerDown?: boolean) => string | undefined>>

	beforeEach(() => {
		onCellClick = vi.fn<(cellIndex: number, isPointerDown?: boolean) => string | undefined>()
	})

	it("Space at initial cursor position (0,0) invokes onCellClick with index 0 and isPointerDown=true (keyboard is a discrete action)", () => {
		// Start is at (0,0); Space calls onCellClick with (0, true) — the store decides
		// to no-op for the start cell, but the canvas always fires the callback.
		// isPointerDown: true is passed from keyboard Space to reset dedupe ref (FIX 2).
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
		// Press Space without moving — cursor is at (0,0) = index 0
		fireEvent.keyDown(container, { key: " " })
		expect(onCellClick).toHaveBeenCalledWith(0, true)
	})

	it("ArrowRight then Space invokes onCellClick with index 1 and isPointerDown=true", () => {
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
		// Press Space to edit cell at (0,1)
		fireEvent.keyDown(container, { key: " " })
		// cellIndex for (0,1) in 5-col grid = 0*5+1 = 1
		expect(onCellClick).toHaveBeenCalledWith(1, true)
	})

	it("ArrowDown moves cursor one row down, Space invokes correct cell index with isPointerDown=true", () => {
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
		expect(onCellClick).toHaveBeenCalledWith(5, true)
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
		// Still at (0,0) which is the start — Space calls onCellClick with (0, true)
		expect(onCellClick).toHaveBeenCalledWith(0, true)
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
		// Still at (0,0) — onCellClick called with (0, true)
		expect(onCellClick).toHaveBeenCalledWith(0, true)
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
		expect(onCellClick).toHaveBeenCalledWith(4, true)
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
		expect(onCellClick).toHaveBeenCalledWith(20, true)
	})
})

// ---------------------------------------------------------------------------
// FIX 5 — aria-live region announces cursor position and cell state
// ---------------------------------------------------------------------------

describe("PathfindingCanvas — FIX 5 aria-live announcements", () => {
	it("contains an aria-live polite region as a sibling of the application div (not inside it)", () => {
		const grid = makeGrid()
		// After FIX 3 the live region is outside role="application" to avoid
		// NVDA+Firefox suppression of live regions in application mode.
		const { container, getByRole } = render(
			<PathfindingCanvas grid={grid} trace={NO_TRACE} cursor={0} cellSize={24} />
		)
		const appDiv = getByRole("application")
		// Must NOT be inside the application div
		expect(appDiv.querySelector("[aria-live='polite']")).toBeNull()
		// Must be reachable from the outer render container
		expect(container.querySelector("[aria-live='polite']")).not.toBeNull()
	})

	it("announces row/column on ArrowRight move", () => {
		const grid = makeGrid()
		const { container, getByRole } = render(
			<PathfindingCanvas grid={grid} trace={NO_TRACE} cursor={0} cellSize={24} />
		)
		const appDiv = getByRole("application")
		appDiv.focus()
		fireEvent.keyDown(appDiv, { key: "ArrowRight" })
		// Live region is outside role="application" — query from outer container
		const liveRegion = container.querySelector("[aria-live='polite']")
		// Should announce "Row 1, column 2: ..." (1-indexed)
		expect(liveRegion?.textContent).toMatch(/row 1, column 2/i)
	})

	it("announces row/column on ArrowDown move", () => {
		const grid = makeGrid()
		const { container, getByRole } = render(
			<PathfindingCanvas grid={grid} trace={NO_TRACE} cursor={0} cellSize={24} />
		)
		const appDiv = getByRole("application")
		appDiv.focus()
		fireEvent.keyDown(appDiv, { key: "ArrowDown" })
		const liveRegion = container.querySelector("[aria-live='polite']")
		expect(liveRegion?.textContent).toMatch(/row 2, column 1/i)
	})
})

// ---------------------------------------------------------------------------
// FIX 7 — keyboard cursor only visible when container has focus
// ---------------------------------------------------------------------------

describe("PathfindingCanvas — FIX 7 keyboard cursor visibility", () => {
	it("container exposes data-has-focus=false initially (cursor hidden for mouse-only users)", () => {
		const grid = makeGrid()
		const { getByRole } = render(
			<PathfindingCanvas grid={grid} trace={NO_TRACE} cursor={0} cellSize={24} />
		)
		const container = getByRole("application")
		expect(container.getAttribute("data-has-focus")).toBe("false")
	})

	it("container exposes data-has-focus=true after focus event", () => {
		const grid = makeGrid()
		const { getByRole } = render(
			<PathfindingCanvas grid={grid} trace={NO_TRACE} cursor={0} cellSize={24} />
		)
		const container = getByRole("application")
		fireEvent.focus(container)
		expect(container.getAttribute("data-has-focus")).toBe("true")
	})

	it("container exposes data-has-focus=false after blur event", () => {
		const grid = makeGrid()
		const { getByRole } = render(
			<PathfindingCanvas grid={grid} trace={NO_TRACE} cursor={0} cellSize={24} />
		)
		const container = getByRole("application")
		fireEvent.focus(container)
		fireEvent.blur(container)
		expect(container.getAttribute("data-has-focus")).toBe("false")
	})
})

// ---------------------------------------------------------------------------
// FIX 1 — stale closure: ArrowKey + Space/W must act on the MOVED-TO cell
// ---------------------------------------------------------------------------

describe("PathfindingCanvas — FIX 1 stale-closure-free keyboard actions", () => {
	it("Space acts on the cell the cursor moved to, not the cell before the arrow press", () => {
		const onCellClick = vi.fn()
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
		// Arrow and Space dispatched in the same synchronous batch
		fireEvent.keyDown(container, { key: "ArrowRight" })
		fireEvent.keyDown(container, { key: " " })
		// Space must act on (0,1) = index 1, NOT on (0,0) = index 0
		// isPointerDown: true is always passed from keyboard Space (FIX 2)
		expect(onCellClick).toHaveBeenCalledWith(1, true)
		expect(onCellClick).not.toHaveBeenCalledWith(0, true)
	})

	it("W acts on the cell the cursor moved to, not the cell before the arrow press", () => {
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
		fireEvent.keyDown(container, { key: "ArrowDown" })
		fireEvent.keyDown(container, { key: "W" })
		// W must act on (1,0) = index 5, NOT on (0,0) = index 0
		expect(onWeightCycle).toHaveBeenCalledWith(5)
		expect(onWeightCycle).not.toHaveBeenCalledWith(0)
	})
})

// ---------------------------------------------------------------------------
// FIX 4 — cursor reset when grid dimensions change
// ---------------------------------------------------------------------------

describe("PathfindingCanvas — FIX 4 cursor resets on grid dimension change", () => {
	it("after grid dimensions change, Space acts on (0,0) even if cursor was moved before", () => {
		const onCellClick = vi.fn()
		const smallGrid = makeGrid(5, 5)
		const { getByRole, rerender } = render(
			<PathfindingCanvas
				grid={smallGrid}
				trace={NO_TRACE}
				cursor={0}
				cellSize={24}
				onCellClick={onCellClick}
			/>
		)
		const container = getByRole("application")
		container.focus()
		// Move cursor to (2,2)
		fireEvent.keyDown(container, { key: "ArrowDown" })
		fireEvent.keyDown(container, { key: "ArrowDown" })
		fireEvent.keyDown(container, { key: "ArrowRight" })
		fireEvent.keyDown(container, { key: "ArrowRight" })

		// Now swap to a different-sized grid (simulates maze generation / reset)
		const newGrid = makeGrid(3, 3)
		rerender(
			<PathfindingCanvas
				grid={newGrid}
				trace={NO_TRACE}
				cursor={0}
				cellSize={24}
				onCellClick={onCellClick}
			/>
		)
		onCellClick.mockClear()

		// After grid change, cursor must be reset to (0,0) — Space = index 0
		// isPointerDown: true is always passed from keyboard Space (FIX 2)
		fireEvent.keyDown(container, { key: " " })
		expect(onCellClick).toHaveBeenCalledWith(0, true)
	})
})

// ---------------------------------------------------------------------------
// FIX 1 (TDD) — post-edit announcements: Space and W must announce POST-edit state
// ---------------------------------------------------------------------------

describe("PathfindingCanvas — FIX 1 post-edit live region announcements", () => {
	it("Space uses the announcement returned by onCellClick to update the live region", () => {
		// The canvas no longer predicts post-edit state locally.
		// It relies on onCellClick to return the ACTUAL post-mutation description.
		// This test verifies the canvas correctly uses the returned string.
		const grid = makeGrid()
		const { container, getByRole } = render(
			<PathfindingCanvas
				grid={grid}
				trace={NO_TRACE}
				cursor={0}
				cellSize={24}
				onCellClick={() => "wall"}
			/>
		)
		const appDiv = getByRole("application")
		appDiv.focus()
		// Move to (0,1) — an empty cell
		fireEvent.keyDown(appDiv, { key: "ArrowRight" })
		// Press Space — callback returns "wall" (simulating Visualizer post-mutation state)
		fireEvent.keyDown(appDiv, { key: " " })
		// Live region is outside the application div (FIX 3), query from container
		const liveRegion = container.querySelector("[aria-live='polite']")
		expect(liveRegion?.textContent).toMatch(/wall/i)
	})

	it("W uses the announcement returned by onWeightCycle to update the live region", () => {
		// The canvas no longer predicts post-edit weight math locally.
		// It relies on onWeightCycle to return the ACTUAL post-mutation description.
		// This test verifies the canvas correctly uses the returned string.
		const grid = makeGrid()
		const { container, getByRole } = render(
			<PathfindingCanvas
				grid={grid}
				trace={NO_TRACE}
				cursor={0}
				cellSize={24}
				onWeightCycle={() => "weight 2"}
			/>
		)
		const appDiv = getByRole("application")
		appDiv.focus()
		// Move to (0,1) — an empty cell (weight 1)
		fireEvent.keyDown(appDiv, { key: "ArrowRight" })
		// Press W — callback returns "weight 2" (simulating Visualizer post-mutation state)
		fireEvent.keyDown(appDiv, { key: "w" })
		const liveRegion = container.querySelector("[aria-live='polite']")
		expect(liveRegion?.textContent).toMatch(/weight 2/i)
	})

	it("Space announces nothing when onCellClick is not provided", () => {
		const grid = makeGrid()
		const { container, getByRole } = render(
			<PathfindingCanvas grid={grid} trace={NO_TRACE} cursor={0} cellSize={24} />
		)
		const appDiv = getByRole("application")
		appDiv.focus()
		fireEvent.keyDown(appDiv, { key: "ArrowRight" })
		fireEvent.keyDown(appDiv, { key: " " })
		const liveRegion = container.querySelector("[aria-live='polite']")
		// Only arrow-navigation text should be present (no post-edit announcement)
		expect(liveRegion?.textContent).not.toMatch(/wall/i)
		expect(liveRegion?.textContent).not.toMatch(/weight/i)
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

// ---------------------------------------------------------------------------
// FIX 2 iteration 4 (TDD) — pointerdown on a wall cell updates the live region
// ---------------------------------------------------------------------------

describe("PathfindingCanvas — FIX 2 iter4 pointerdown sets live region via onCellClick return", () => {
	it("pointerdown on a cell fires onCellClick and uses its return value to set the live region", () => {
		// Arrange: onCellClick returns "wall" simulating a post-mutation wall state
		const grid = makeGrid()
		const { container, getByRole } = render(
			<PathfindingCanvas
				grid={grid}
				trace={NO_TRACE}
				cursor={0}
				cellSize={24}
				onCellClick={() => "wall"}
			/>
		)
		const appDiv = getByRole("application")

		vi.spyOn(appDiv, "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			width: 120,
			height: 120,
			right: 120,
			bottom: 120,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect)

		// Fire pointerdown on cell (0,1) — cellSize=24, x=36, y=12
		fireEvent.pointerDown(appDiv, { clientX: 36, clientY: 12, pointerId: 1 })

		const liveRegion = container.querySelector("[aria-live='polite']")
		// Live region must match the exact formatted string
		expect(liveRegion?.textContent).toBe("Row 1, column 2: wall")
	})

	it("pointerdown on a cell: live region text uses 'Row N, column M: {desc}' format", () => {
		const grid = makeGrid(5, 5)
		const { container, getByRole } = render(
			<PathfindingCanvas
				grid={grid}
				trace={NO_TRACE}
				cursor={0}
				cellSize={24}
				onCellClick={() => "empty"}
			/>
		)
		const appDiv = getByRole("application")

		vi.spyOn(appDiv, "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			width: 120,
			height: 120,
			right: 120,
			bottom: 120,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect)

		// Cell (1,0) — clientX=12, clientY=36
		fireEvent.pointerDown(appDiv, { clientX: 12, clientY: 36, pointerId: 1 })

		const liveRegion = container.querySelector("[aria-live='polite']")
		expect(liveRegion?.textContent).toMatch(/row 2, column 1/i)
		expect(liveRegion?.textContent).toMatch(/empty/i)
	})

	it("pointerdown when onCellClick returns undefined does NOT update the live region", () => {
		const grid = makeGrid()
		const { container, getByRole } = render(
			<PathfindingCanvas
				grid={grid}
				trace={NO_TRACE}
				cursor={0}
				cellSize={24}
				onCellClick={() => undefined}
			/>
		)
		const appDiv = getByRole("application")

		vi.spyOn(appDiv, "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			width: 120,
			height: 120,
			right: 120,
			bottom: 120,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect)

		// Fire at cell (0,1) — clientX=36, clientY=12 (empty cell, not start/end)
		// so handlePointerDown takes the wall-drag path and calls onCellClick
		fireEvent.pointerDown(appDiv, { clientX: 36, clientY: 12, pointerId: 1 })

		const liveRegion = container.querySelector("[aria-live='polite']")
		// Live region should remain empty (undefined return → desc guard not satisfied)
		expect(liveRegion?.textContent).toBe("")
	})
})
