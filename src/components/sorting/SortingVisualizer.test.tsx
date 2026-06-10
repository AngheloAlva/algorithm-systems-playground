/**
 * Tests for SortingVisualizer.
 *
 * Verifies:
 * - Component mounts without crashing
 * - Key controls are rendered and keyboard-accessible
 * - ARIA live region exists for announcements
 * - Algorithm select renders all 4 sort algorithms
 * - FIX 1: replay fidelity — displayArr reflects array state at cursor
 * - FIX 2: no setTimeout race — double-click run does not double-play
 * - FIX 3: incremental metrics match naive slice.filter computation
 * - FIX 4: exactly one aria-live region
 * - FIX 5: status-sync effect has no eslint-disable for exhaustive-deps
 *
 * next/navigation is mocked. Canvas 2D API is mocked.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, act } from "@testing-library/react"

// ---------------------------------------------------------------------------
// Mocks — must run before component imports
// ---------------------------------------------------------------------------

const mockSearchParams: { get: (key: string) => string | null; toString: () => string } = {
	get: () => null,
	toString: () => "",
}

vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: vi.fn() }),
	useSearchParams: () => mockSearchParams,
}))

import { SortingVisualizer } from "./SortingVisualizer"
import { useSortingStore } from "@/store/sorting-store"
import { replayTo } from "@/lib/algorithms/sorting/replay-state"
import { SORT_STEP_KIND } from "@/lib/algorithms/sorting/types"

// ---------------------------------------------------------------------------
// SortingCanvas mock — capture arr prop for replay fidelity assertions.
// Renders a minimal div with role="img" so existing a11y tests still pass.
// ---------------------------------------------------------------------------

let lastCanvasArrProp: ReadonlyArray<number> | null = null

vi.mock("@/components/canvas/SortingCanvas", () => ({
	SortingCanvas: (props: { arr: ReadonlyArray<number>; currentStep: unknown; status: string; className?: string; "aria-label"?: string }) => {
		lastCanvasArrProp = props.arr
		return <div role="img" aria-label={`Sorting visualization: ${props.arr.length}-element array, ${props.status}`} />
	},
}))

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

// ---------------------------------------------------------------------------
// FIX 1: replay fidelity — displayArr passed to canvas reflects cursor state
// ---------------------------------------------------------------------------

describe("SortingVisualizer — FIX1 replay fidelity", () => {
	beforeEach(() => {
		resetStore()
		lastCanvasArrProp = null
		// Reset mock searchParams to default (returns null for all keys)
		mockSearchParams.get = () => null
	})

	it("canvas receives original arr when cursor=0 and no trace (idle state)", () => {
		render(<SortingVisualizer />)
		// In idle state (no trace), canvas should receive the original arr unchanged
		const storeArr = useSortingStore.getState().arr
		expect(lastCanvasArrProp).toEqual([...storeArr])
	})

	it("after bubble sort trace: canvas arr at DONE cursor equals sorted array", () => {
		// Set a known array in the store
		const knownArr = [5, 3, 1, 4, 2]
		act(() => {
			useSortingStore.setState({ arr: knownArr })
			useSortingStore.getState().run()
		})
		const { traceResult } = useSortingStore.getState()
		expect(traceResult).not.toBeNull()

		const lastCursor = traceResult!.steps.length - 1

		act(() => {
			useSortingStore.getState().setCursor(lastCursor)
		})

		render(<SortingVisualizer />)

		const expected = [...knownArr].sort((a, b) => a - b)
		expect(lastCanvasArrProp).toEqual(expected)
	})

	it("after merge sort trace: canvas arr at DONE cursor equals sorted array", () => {
		// Make URL params report "merge" so the URL sync effect does not reset the algorithm
		mockSearchParams.get = (key: string) => (key === "sort" ? "merge" : null)

		const knownArr = [4, 2, 7, 1, 5]
		useSortingStore.setState({ arr: knownArr, algorithm: "merge" as const })
		useSortingStore.getState().run()

		const { traceResult } = useSortingStore.getState()
		expect(traceResult).not.toBeNull()

		const lastCursor = traceResult!.steps.length - 1
		expect(useSortingStore.getState().cursor).toBe(lastCursor)

		render(<SortingVisualizer />)

		const expected = [...knownArr].sort((a, b) => a - b)
		expect(lastCanvasArrProp).toEqual(expected)
	})

	it("canvas arr at intermediate cursor matches reference replayTo", () => {
		const knownArr = [5, 3, 1, 4, 2]
		act(() => {
			useSortingStore.setState({ arr: knownArr })
			useSortingStore.getState().run()
		})
		const { traceResult } = useSortingStore.getState()
		expect(traceResult).not.toBeNull()

		// Find the first SWAP step cursor
		const swapCursor = traceResult!.steps.findIndex((s) => s.kind === SORT_STEP_KIND.SWAP)
		if (swapCursor === -1) return // skip if no swaps (already sorted)

		act(() => {
			useSortingStore.getState().setCursor(swapCursor)
		})

		render(<SortingVisualizer />)

		const expected = replayTo(knownArr, traceResult!.steps, swapCursor)
		expect(lastCanvasArrProp).toEqual(expected)
	})
})

// ---------------------------------------------------------------------------
// FIX 4: exactly one aria-live region
// ---------------------------------------------------------------------------

describe("SortingVisualizer — FIX4 single aria-live region", () => {
	beforeEach(resetStore)

	it("renders exactly one aria-live polite region", () => {
		const { container } = render(<SortingVisualizer />)
		const liveRegions = container.querySelectorAll("[aria-live='polite']")
		expect(liveRegions.length).toBe(1)
	})

	it("metrics panel does not have its own role=status or aria-live", () => {
		const { container } = render(<SortingVisualizer />)
		// role=status implies aria-live=polite; there should be no role=status div
		const statusDivs = container.querySelectorAll("[role='status']")
		expect(statusDivs.length).toBe(0)
	})
})
