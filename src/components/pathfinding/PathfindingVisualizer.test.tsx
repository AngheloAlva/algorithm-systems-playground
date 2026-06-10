/**
 * Tests for PathfindingVisualizer — weight brush discrete dispatch (FIX 2).
 *
 * Verifies that weight brush actions dispatch immediately (no rAF coalescing),
 * repeated pointerdown on the same cell advances weight on each click, and
 * the keyboard W handler (onWeightCycle) calls the store directly.
 *
 * Uses jsdom + Testing Library. Canvas 2D API is mocked.
 * next/navigation is mocked for router/searchParams.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, fireEvent, act } from "@testing-library/react"

// ---------------------------------------------------------------------------
// Mocks — must run before any component import
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: vi.fn() }),
	useSearchParams: () => ({ get: () => null, toString: () => "" }),
}))

import { PathfindingVisualizer } from "./PathfindingVisualizer"
import { usePathfindingStore, BRUSH_MODE } from "@/store/pathfinding-store"

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

	class MutationObserverMock {
		observe = vi.fn()
		disconnect = vi.fn()
		takeRecords = vi.fn(() => [])
	}
	vi.stubGlobal("MutationObserver", MutationObserverMock)

	// Stub setPointerCapture/releasePointerCapture on all elements
	HTMLElement.prototype.setPointerCapture = vi.fn()
	HTMLElement.prototype.releasePointerCapture = vi.fn()
})

// ---------------------------------------------------------------------------
// Reset store before each test
// ---------------------------------------------------------------------------

function resetStore() {
	usePathfindingStore.setState(usePathfindingStore.getInitialState(), true)
}

// ---------------------------------------------------------------------------
// FIX 2 — weight brush semantics
// ---------------------------------------------------------------------------

describe("PathfindingVisualizer — weight brush pointerdown dedupe reset", () => {
	beforeEach(() => {
		resetStore()
	})

	it("repeated pointerdown on same cell under weight brush advances weight each time", async () => {
		usePathfindingStore.getState().setBrush(BRUSH_MODE.WEIGHT)
		const { getByRole } = render(<PathfindingVisualizer />)

		// Find an empty cell at a position we can calculate (row=5, col=5 → cellIndex = 5*44+5=225)
		// We paint via the canvas container — simulate pointerdown events
		const canvas = getByRole("application")

		// Mock getBoundingClientRect so cellAt can compute cell coordinates
		vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			width: 1056,
			height: 576,
			right: 1056,
			bottom: 576,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect)
		// setPointerCapture is stubbed globally in beforeAll

		const grid = usePathfindingStore.getState().grid
		// Target cell (5, 5) — index = 5*44+5 = 225
		const targetCol = 5
		const targetRow = 5
		const cellSize = 24
		const clientX = targetCol * cellSize + cellSize / 2
		const clientY = targetRow * cellSize + cellSize / 2
		const targetIndex = targetRow * grid.cols + targetCol

		// First pointerdown — should advance weight from 1 to 2
		await act(async () => {
			fireEvent.pointerDown(canvas, { clientX, clientY, pointerId: 1 })
			fireEvent.pointerUp(canvas, { clientX, clientY, pointerId: 1 })
		})
		const weightAfterFirst = usePathfindingStore.getState().grid.weights[targetIndex]
		expect(weightAfterFirst).toBe(2)

		// Second pointerdown on the SAME cell — must advance weight again (to 3)
		await act(async () => {
			fireEvent.pointerDown(canvas, { clientX, clientY, pointerId: 1 })
			fireEvent.pointerUp(canvas, { clientX, clientY, pointerId: 1 })
		})
		const weightAfterSecond = usePathfindingStore.getState().grid.weights[targetIndex]
		expect(weightAfterSecond).toBe(3)
	})
})

describe("PathfindingVisualizer — weight brush drag per-cell dedupe", () => {
	beforeEach(() => {
		resetStore()
	})

	it("moving pointer into a new cell during weight drag advances that cell's weight once", async () => {
		usePathfindingStore.getState().setBrush(BRUSH_MODE.WEIGHT)
		const { getByRole } = render(<PathfindingVisualizer />)
		const canvas = getByRole("application")

		vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			width: 1056,
			height: 576,
			right: 1056,
			bottom: 576,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect)
		// setPointerCapture is stubbed globally in beforeAll

		const grid = usePathfindingStore.getState().grid
		const cellSize = 24
		const cell1Row = 5
		const cell1Col = 5
		const cell2Row = 5
		const cell2Col = 6
		const clientX1 = cell1Col * cellSize + cellSize / 2
		const clientY1 = cell1Row * cellSize + cellSize / 2
		const clientX2 = cell2Col * cellSize + cellSize / 2
		const clientY2 = cell2Row * cellSize + cellSize / 2
		const idx1 = cell1Row * grid.cols + cell1Col
		const idx2 = cell2Row * grid.cols + cell2Col

		await act(async () => {
			fireEvent.pointerDown(canvas, { clientX: clientX1, clientY: clientY1, pointerId: 1 })
			// Move to cell2 (new cell — should advance weight)
			fireEvent.pointerMove(canvas, { clientX: clientX2, clientY: clientY2, pointerId: 1 })
			// Move within cell2 again (same cell — should NOT advance again)
			fireEvent.pointerMove(canvas, {
				clientX: clientX2 + 2,
				clientY: clientY2,
				pointerId: 1,
			})
			fireEvent.pointerUp(canvas, { clientX: clientX2, clientY: clientY2, pointerId: 1 })
		})

		// cell1 was painted on pointerdown (weight 1→2)
		expect(usePathfindingStore.getState().grid.weights[idx1]).toBe(2)
		// cell2 was painted once on first entry (weight 1→2), not on second move
		expect(usePathfindingStore.getState().grid.weights[idx2]).toBe(2)
	})
})

describe("PathfindingVisualizer — keyboard W cycles weight directly (no rAF coalescing)", () => {
	beforeEach(() => {
		resetStore()
	})

	it("W key at cursor position calls cycleWeightAt immediately on the correct cell", async () => {
		const { getByRole } = render(<PathfindingVisualizer />)
		const canvas = getByRole("application")

		// Move keyboard cursor to (1,1) then press W — should cycle weight immediately
		await act(async () => {
			canvas.focus()
			fireEvent.keyDown(canvas, { key: "ArrowDown" })
			fireEvent.keyDown(canvas, { key: "ArrowRight" })
		})

		const grid = usePathfindingStore.getState().grid
		const targetIndex = 1 * grid.cols + 1
		const weightBefore = grid.weights[targetIndex]

		await act(async () => {
			fireEvent.keyDown(canvas, { key: "w" })
		})

		const weightAfter = usePathfindingStore.getState().grid.weights[targetIndex]
		expect(weightAfter).toBe(weightBefore + 1)
	})
})

// ---------------------------------------------------------------------------
// FIX 1 (TDD) — live region in Visualizer shows ACTUAL post-edit state
// ---------------------------------------------------------------------------

describe("PathfindingVisualizer — FIX 1 live region reflects actual post-mutation store state", () => {
	beforeEach(() => {
		resetStore()
	})

	function getApp(container: HTMLElement) {
		return container.querySelector("[role='application']") as HTMLElement
	}

	function getLiveRegion(container: HTMLElement) {
		return container.querySelector("[aria-live='polite']")
	}

	it("ERASE brush + Space on empty cell announces 'empty' (no-op — post-edit state is still empty)", async () => {
		usePathfindingStore.getState().setBrush("erase")
		const { container } = render(<PathfindingVisualizer />)
		const app = getApp(container)
		app.focus()

		// Navigate to (0,1) — empty cell
		fireEvent.keyDown(app, { key: "ArrowRight" })
		// Press Space — ERASE on empty is a no-op, post-edit state = "empty"
		await act(async () => {
			fireEvent.keyDown(app, { key: " " })
		})

		const live = getLiveRegion(container)
		expect(live?.textContent).toMatch(/empty/i)
	})

	it("WEIGHT brush + Space on empty cell announces the new weight (post-edit state = 'weight 2')", async () => {
		usePathfindingStore.getState().setBrush("weight")
		const { container } = render(<PathfindingVisualizer />)
		const app = getApp(container)
		app.focus()

		// Navigate to (0,1) — empty cell
		fireEvent.keyDown(app, { key: "ArrowRight" })
		await act(async () => {
			fireEvent.keyDown(app, { key: " " })
		})

		const live = getLiveRegion(container)
		expect(live?.textContent).toMatch(/weight 2/i)
	})

	it("WALL brush + Space on empty cell announces 'wall' (post-edit state = wall)", async () => {
		usePathfindingStore.getState().setBrush("wall")
		const { container } = render(<PathfindingVisualizer />)
		const app = getApp(container)
		app.focus()

		// Navigate to (0,1) — empty cell (not start/end)
		fireEvent.keyDown(app, { key: "ArrowRight" })
		await act(async () => {
			fireEvent.keyDown(app, { key: " " })
		})

		const live = getLiveRegion(container)
		expect(live?.textContent).toMatch(/wall/i)
	})
})

// ---------------------------------------------------------------------------
// FIX 2 (TDD) — Space keyboard press bypasses pointer-dedupe on WEIGHT brush
// ---------------------------------------------------------------------------

describe("PathfindingVisualizer — FIX 2 keyboard Space bypasses WEIGHT brush dedupe", () => {
	beforeEach(() => {
		resetStore()
	})

	it("pointer-down paints a cell with WEIGHT brush; keyboard Space on same cell while pointer still down must advance weight again", async () => {
		usePathfindingStore.getState().setBrush("weight")
		const { getByRole } = render(<PathfindingVisualizer />)
		const canvas = getByRole("application")

		vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			width: 1056,
			height: 576,
			right: 1056,
			bottom: 576,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect)

		const grid = usePathfindingStore.getState().grid
		const cellSize = 24
		// Cell (1,1) — matches keyboard cursor position after ArrowDown + ArrowRight
		const targetRow = 1
		const targetCol = 1
		const clientX = targetCol * cellSize + cellSize / 2
		const clientY = targetRow * cellSize + cellSize / 2
		const targetIndex = targetRow * grid.cols + targetCol

		// Paint via pointer DOWN (no pointer-up — lastPaintedCellRef stays set)
		await act(async () => {
			canvas.focus()
			fireEvent.pointerDown(canvas, { clientX, clientY, pointerId: 1 })
		})
		expect(usePathfindingStore.getState().grid.weights[targetIndex]).toBe(2)

		// Move keyboard cursor to the same cell that was last painted
		await act(async () => {
			fireEvent.keyDown(canvas, { key: "ArrowDown" })
			fireEvent.keyDown(canvas, { key: "ArrowRight" })
		})

		// Press Space — without fix this is swallowed by dedupe (lastPaintedCellRef === targetIndex)
		// With fix: Space passes isPointerDown:true → resets dedupe → weight advances to 3
		await act(async () => {
			fireEvent.keyDown(canvas, { key: " " })
		})
		expect(usePathfindingStore.getState().grid.weights[targetIndex]).toBe(3)
	})
})

// ---------------------------------------------------------------------------
// FIX 3 (TDD) — aria-label is brush-neutral
// ---------------------------------------------------------------------------

describe("PathfindingVisualizer — FIX 3 aria-label is brush-neutral", () => {
	beforeEach(() => {
		resetStore()
	})

	it("application element aria-label does NOT say 'toggle wall'", () => {
		const { getByRole } = render(<PathfindingVisualizer />)
		const app = getByRole("application")
		const label = app.getAttribute("aria-label") ?? ""
		expect(label.toLowerCase()).not.toMatch(/toggle wall/)
	})

	it("application element aria-label mentions 'Space' and describes editing with the active brush", () => {
		const { getByRole } = render(<PathfindingVisualizer />)
		const app = getByRole("application")
		const label = app.getAttribute("aria-label") ?? ""
		expect(label).toMatch(/Space/i)
		// Should describe editing action without implying wall-only semantics
		expect(label.toLowerCase()).toMatch(/brush|edit|active/)
	})
})

// ---------------------------------------------------------------------------
// FIX 1 iteration 4 (TDD) — drag path (isPointerDown falsy) must return undefined
// ---------------------------------------------------------------------------

describe("PathfindingVisualizer — FIX 1 iter4 drag-path returns undefined", () => {
	beforeEach(() => {
		resetStore()
	})

	it("WALL brush drag (pointermove, no isPointerDown) onCellClick returns undefined", async () => {
		usePathfindingStore.getState().setBrush(BRUSH_MODE.WALL)
		const { getByRole } = render(<PathfindingVisualizer />)
		const canvas = getByRole("application")

		vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			width: 1056,
			height: 576,
			right: 1056,
			bottom: 576,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect)

		const grid = usePathfindingStore.getState().grid
		const cellSize = 24
		// Start drag on cell (3,3) then move to (3,4) — both are empty
		const startX = 3 * cellSize + cellSize / 2
		const startY = 3 * cellSize + cellSize / 2
		const moveX = 4 * cellSize + cellSize / 2
		const moveY = 3 * cellSize + cellSize / 2

		// Capture return values through the canvas prop chain via a wrapper that
		// intercepts onCellClick returns. Since PathfindingVisualizer wires
		// handleCellClick internally, we verify the drag path by watching the
		// live region: on a drag move the live region must NOT be updated (because
		// handleCellClick returns undefined and the canvas only sets liveRegionText
		// when the returned value is a non-undefined string).
		await act(async () => {
			fireEvent.pointerDown(canvas, { clientX: startX, clientY: startY, pointerId: 1 })
		})

		// After pointer-down the live region is set (isPointerDown=true path returns a string)
		const liveRegionAfterDown = document.querySelector("[aria-live='polite']")
		const textAfterDown = liveRegionAfterDown?.textContent ?? ""

		// Now simulate a pointermove to a NEW cell — drag path (no isPointerDown)
		// handleCellClick must return undefined so the live region stays unchanged
		await act(async () => {
			fireEvent.pointerMove(canvas, { clientX: moveX, clientY: moveY, pointerId: 1 })
		})

		const liveRegionAfterMove = document.querySelector("[aria-live='polite']")
		const textAfterMove = liveRegionAfterMove?.textContent ?? ""

		// The live region text must NOT have changed after the drag move
		// (undefined return → no setLiveRegionText call)
		// Guard against a broken setup that leaves textAfterDown empty
		expect(textAfterDown).not.toBe("")
		expect(textAfterMove).toBe(textAfterDown)

		await act(async () => {
			fireEvent.pointerUp(canvas, { clientX: moveX, clientY: moveY, pointerId: 1 })
		})

		void grid
	})

	it("ERASE brush drag (pointermove, no isPointerDown) onCellClick returns undefined — live region unchanged", async () => {
		// First place a wall at (3,3) so erase has something to operate on
		usePathfindingStore.getState().setBrush(BRUSH_MODE.WALL)
		const { getByRole, unmount } = render(<PathfindingVisualizer />)
		const canvas = getByRole("application")

		vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			width: 1056,
			height: 576,
			right: 1056,
			bottom: 576,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect)

		const cellSize = 24
		const wallX = 3 * cellSize + cellSize / 2
		const wallY = 3 * cellSize + cellSize / 2
		await act(async () => {
			fireEvent.pointerDown(canvas, { clientX: wallX, clientY: wallY, pointerId: 1 })
			fireEvent.pointerUp(canvas, { clientX: wallX, clientY: wallY, pointerId: 1 })
		})
		unmount()

		// Now switch to ERASE and drag over the wall
		usePathfindingStore.getState().setBrush(BRUSH_MODE.ERASE)
		const { getByRole: getByRole2 } = render(<PathfindingVisualizer />)
		const canvas2 = getByRole2("application")

		vi.spyOn(canvas2, "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			width: 1056,
			height: 576,
			right: 1056,
			bottom: 576,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect)

		const eraseStartX = 2 * cellSize + cellSize / 2
		const eraseStartY = 3 * cellSize + cellSize / 2
		const eraseMoveX = 3 * cellSize + cellSize / 2
		const eraseMoveY = 3 * cellSize + cellSize / 2

		// pointer-down on a different cell to set up drag state
		await act(async () => {
			fireEvent.pointerDown(canvas2, { clientX: eraseStartX, clientY: eraseStartY, pointerId: 1 })
		})
		const liveAfterDown = document.querySelector("[aria-live='polite']")?.textContent ?? ""

		// drag-move into the wall cell — must NOT update live region
		await act(async () => {
			fireEvent.pointerMove(canvas2, { clientX: eraseMoveX, clientY: eraseMoveY, pointerId: 1 })
		})
		const liveAfterMove = document.querySelector("[aria-live='polite']")?.textContent ?? ""

		// Guard against a broken setup that leaves liveAfterDown empty
		expect(liveAfterDown).not.toBe("")
		expect(liveAfterMove).toBe(liveAfterDown)

		await act(async () => {
			fireEvent.pointerUp(canvas2, { clientX: eraseMoveX, clientY: eraseMoveY, pointerId: 1 })
		})
	})
})
