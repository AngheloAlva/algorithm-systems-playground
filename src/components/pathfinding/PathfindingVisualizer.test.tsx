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
