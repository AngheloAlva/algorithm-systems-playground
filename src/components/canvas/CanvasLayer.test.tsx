/**
 * Smoke tests for CanvasLayer.
 *
 * jsdom does not implement the Canvas 2D API, so we mock getContext.
 * The goal is to verify the component mounts without crashing and
 * exposes the expected DOM role/aria props.
 */

import { describe, it, expect, vi, beforeAll } from "vitest"
import { render } from "@testing-library/react"
import { CanvasLayer } from "./CanvasLayer"

// ---------------------------------------------------------------------------
// jsdom stubs
// ---------------------------------------------------------------------------

beforeAll(() => {
	// Minimal CanvasRenderingContext2D stub so CanvasLayer doesn't throw
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
		fillStyle: "",
		strokeStyle: "",
		lineWidth: 1,
		globalAlpha: 1,
	}

	HTMLCanvasElement.prototype.getContext = vi.fn(
		() => ctx
	) as unknown as typeof HTMLCanvasElement.prototype.getContext

	// jsdom returns 0 for clientWidth/clientHeight; stub non-zero values so the
	// S1 zero-size guard does not suppress draw calls in tests.
	Object.defineProperty(HTMLCanvasElement.prototype, "clientWidth", {
		get: () => 300,
		configurable: true,
	})
	Object.defineProperty(HTMLCanvasElement.prototype, "clientHeight", {
		get: () => 150,
		configurable: true,
	})

	// ResizeObserver is not implemented in jsdom — must be a class (constructor)
	class ResizeObserverMock {
		observe = vi.fn()
		unobserve = vi.fn()
		disconnect = vi.fn()
	}
	vi.stubGlobal("ResizeObserver", ResizeObserverMock)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasLayer", () => {
	it("renders a canvas element", () => {
		const draw = vi.fn()
		const { container } = render(<CanvasLayer draw={draw} />)
		const canvas = container.querySelector("canvas")
		expect(canvas).not.toBeNull()
	})

	it("forwards role and aria-label to the canvas element", () => {
		const draw = vi.fn()
		const { getByRole } = render(<CanvasLayer draw={draw} role="img" aria-label="Test canvas" />)
		expect(getByRole("img")).toBeDefined()
	})

	it("applies custom className to the canvas", () => {
		const draw = vi.fn()
		const { container } = render(<CanvasLayer draw={draw} className="test-class" />)
		const canvas = container.querySelector("canvas")
		expect(canvas?.classList.contains("test-class")).toBe(true)
	})

	it("always includes absolute-positioning classes", () => {
		const draw = vi.fn()
		const { container } = render(<CanvasLayer draw={draw} />)
		const canvas = container.querySelector("canvas")
		expect(canvas?.className).toContain("absolute")
	})

	// W4 / C1: draw must be called on mount AND re-called when draw identity changes
	it("calls draw on mount", () => {
		const draw = vi.fn()
		render(<CanvasLayer draw={draw} />)
		expect(draw).toHaveBeenCalled()
	})

	it("calls draw again when a new draw function is passed (C1 repaint)", () => {
		const draw1 = vi.fn()
		const draw2 = vi.fn()
		const { rerender } = render(<CanvasLayer draw={draw1} />)
		const callsBefore = draw1.mock.calls.length + draw2.mock.calls.length
		// Provide a new draw identity — CanvasLayer must invoke it
		rerender(<CanvasLayer draw={draw2} />)
		const callsAfter = draw1.mock.calls.length + draw2.mock.calls.length
		expect(callsAfter).toBeGreaterThan(callsBefore)
		expect(draw2).toHaveBeenCalled()
	})
})
