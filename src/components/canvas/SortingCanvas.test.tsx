/**
 * Smoke tests for SortingCanvas.
 *
 * SortingCanvas is a display-only canvas renderer. Tests verify:
 * - Component mounts without crashing
 * - Renders with proper role="img" and aria-label
 * - Accepts null currentStep without crashing
 * - Accepts various arr sizes including empty
 * - Does not render interactive elements (display-only)
 *
 * jsdom does not implement Canvas 2D API — same stub pattern as CanvasLayer.test.tsx.
 */

import { describe, it, expect, vi, beforeAll } from "vitest"
import { render } from "@testing-library/react"
import { SortingCanvas } from "./SortingCanvas"
import type { SortStep } from "@/lib/algorithms/sorting/types"
import { SORT_STEP_KIND } from "@/lib/algorithms/sorting/types"

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
		get: () => 600,
		configurable: true,
	})
	Object.defineProperty(HTMLCanvasElement.prototype, "clientHeight", {
		get: () => 300,
		configurable: true,
	})

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

describe("SortingCanvas", () => {
	it("renders without crashing with minimal props", () => {
		const arr = [3, 1, 4, 1, 5]
		expect(() =>
			render(<SortingCanvas arr={arr} currentStep={null} status="idle" />)
		).not.toThrow()
	})

	it("renders a canvas element", () => {
		const arr = [3, 1, 4, 1, 5]
		const { container } = render(<SortingCanvas arr={arr} currentStep={null} status="idle" />)
		expect(container.querySelector("canvas")).not.toBeNull()
	})

	it("canvas has role=img", () => {
		const arr = [3, 1, 4, 1, 5]
		const { getByRole } = render(<SortingCanvas arr={arr} currentStep={null} status="idle" />)
		expect(getByRole("img")).toBeDefined()
	})

	it("canvas aria-label contains arr.length", () => {
		const arr = [3, 1, 4, 1, 5]
		const { getByRole } = render(<SortingCanvas arr={arr} currentStep={null} status="idle" />)
		const canvas = getByRole("img")
		expect(canvas.getAttribute("aria-label")).toContain("5")
	})

	it("renders with an empty array without crashing", () => {
		expect(() =>
			render(<SortingCanvas arr={[]} currentStep={null} status="idle" />)
		).not.toThrow()
	})

	it("renders with a COMPARE step without crashing", () => {
		const arr = [3, 1, 4, 1, 5]
		const step: SortStep = {
			kind: SORT_STEP_KIND.COMPARE,
			indices: [0, 1],
			pseudocodeLine: 0,
		}
		expect(() =>
			render(<SortingCanvas arr={arr} currentStep={step} status="running" />)
		).not.toThrow()
	})

	it("renders with a SWAP step without crashing", () => {
		const arr = [3, 1, 4, 1, 5]
		const step: SortStep = {
			kind: SORT_STEP_KIND.SWAP,
			indices: [0, 1],
			pseudocodeLine: 1,
		}
		expect(() =>
			render(<SortingCanvas arr={arr} currentStep={step} status="running" />)
		).not.toThrow()
	})

	it("renders with a PLACE step (with value) without crashing", () => {
		const arr = [3, 1, 4, 1, 5]
		const step: SortStep = {
			kind: SORT_STEP_KIND.PLACE,
			indices: [0],
			pseudocodeLine: 2,
			value: 1,
		}
		expect(() =>
			render(<SortingCanvas arr={arr} currentStep={step} status="running" />)
		).not.toThrow()
	})

	it("renders with a large array without crashing", () => {
		const arr = Array.from({ length: 200 }, (_, i) => i + 1)
		expect(() =>
			render(<SortingCanvas arr={arr} currentStep={null} status="idle" />)
		).not.toThrow()
	})

	it("accepts a custom className on the container", () => {
		const arr = [3, 1, 4]
		const { container } = render(
			<SortingCanvas arr={arr} currentStep={null} status="idle" className="my-test-class" />
		)
		const wrapper = container.firstElementChild
		expect(wrapper?.classList.contains("my-test-class")).toBe(true)
	})
})
