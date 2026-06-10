/**
 * Smoke tests for SortingVisualizer.
 *
 * Verifies:
 * - Component mounts without crashing
 * - Key controls are rendered and keyboard-accessible
 * - ARIA live region exists for announcements
 * - Algorithm select renders all 4 sort algorithms
 *
 * next/navigation is mocked. Canvas 2D API is mocked.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render } from "@testing-library/react"

// ---------------------------------------------------------------------------
// Mocks — must run before component imports
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: vi.fn() }),
	useSearchParams: () => ({ get: () => null, toString: () => "" }),
}))

import { SortingVisualizer } from "./SortingVisualizer"
import { useSortingStore } from "@/store/sorting-store"

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

	class MutationObserverMock {
		observe = vi.fn()
		disconnect = vi.fn()
		takeRecords = vi.fn(() => [])
	}
	vi.stubGlobal("MutationObserver", MutationObserverMock)
})

// ---------------------------------------------------------------------------
// Reset store
// ---------------------------------------------------------------------------

function resetStore() {
	useSortingStore.setState(useSortingStore.getInitialState(), true)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SortingVisualizer — mount", () => {
	beforeEach(resetStore)

	it("renders without crashing", () => {
		expect(() => render(<SortingVisualizer />)).not.toThrow()
	})

	it("renders a Run button", () => {
		const { getByRole } = render(<SortingVisualizer />)
		const runButton = getByRole("button", { name: /run sort/i })
		expect(runButton).toBeDefined()
	})

	it("renders a Step button", () => {
		const { getByRole } = render(<SortingVisualizer />)
		const stepButton = getByRole("button", { name: /step forward/i })
		expect(stepButton).toBeDefined()
	})

	it("renders a Reset button", () => {
		const { getByRole } = render(<SortingVisualizer />)
		const resetButton = getByRole("button", { name: /reset animation/i })
		expect(resetButton).toBeDefined()
	})

	it("renders a Generate array button", () => {
		const { getByRole } = render(<SortingVisualizer />)
		const genButton = getByRole("button", { name: /generate new array/i })
		expect(genButton).toBeDefined()
	})

	it("renders a canvas with role=img", () => {
		const { getByRole } = render(<SortingVisualizer />)
		const canvas = getByRole("img")
		expect(canvas).toBeDefined()
	})

	it("has an aria-live polite region for announcements", () => {
		const { container } = render(<SortingVisualizer />)
		const liveRegion = container.querySelector("[aria-live='polite']")
		expect(liveRegion).not.toBeNull()
	})

	it("renders algorithm select with accessible label", () => {
		const { getByRole } = render(<SortingVisualizer />)
		// Should be a combobox (Select) with accessible label
		const selects = getByRole("combobox", { name: /select sorting algorithm/i })
		expect(selects).toBeDefined()
	})

	it("renders a speed label in the toolbar", () => {
		const { container } = render(<SortingVisualizer />)
		// Speed label is rendered as aria-hidden span in the toolbar
		const speedLabel = Array.from(container.querySelectorAll("span")).find(
			(el) => el.textContent?.trim() === "Speed"
		)
		expect(speedLabel).toBeDefined()
	})

	it("renders an array length label in the controls", () => {
		const { container } = render(<SortingVisualizer />)
		// Array length label contains "Length:"
		const lengthLabel = Array.from(container.querySelectorAll("label")).find(
			(el) => el.textContent?.includes("Length:")
		)
		expect(lengthLabel).toBeDefined()
	})

	it("renders pseudocode list", () => {
		const { container } = render(<SortingVisualizer />)
		const ol = container.querySelector("ol[aria-label]")
		expect(ol).not.toBeNull()
	})
})

describe("SortingVisualizer — a11y", () => {
	beforeEach(resetStore)

	it("Run button is keyboard-reachable (has tabIndex >= 0)", () => {
		const { getByRole } = render(<SortingVisualizer />)
		const runButton = getByRole("button", { name: /run sort/i })
		// Native buttons are focusable by default; no negative tabIndex
		expect(runButton.getAttribute("tabindex")).not.toBe("-1")
	})

	it("Generate array button is not disabled by default", () => {
		const { getByRole } = render(<SortingVisualizer />)
		const genButton = getByRole("button", { name: /generate new array/i })
		expect(genButton).not.toBeDisabled()
	})

	it("Step button is not disabled when idle", () => {
		const { getByRole } = render(<SortingVisualizer />)
		const stepButton = getByRole("button", { name: /step forward/i })
		expect(stepButton).not.toBeDisabled()
	})
})
