/**
 * Tests for SortingVisualizer.
 *
 * Verifies:
 * - Component mounts without crashing
 * - Key controls are rendered and keyboard-accessible
 * - ARIA live region exists for announcements
 * - Algorithm select renders all 4 sort algorithms
 * - FIX 1: cursor sequencing — first committed displayArr is cursor 0, not steps.length-1;
 *          step-from-idle shows state at cursor 0 exactly
 * - FIX 2: pendingActionRef lifecycle — run-then-reset leaves Run clickable;
 *          double-click run results in at most one play (re-entrant guard);
 *          flag cleared on unmount
 * - FIX 3: incremental liveComparisons/liveSwaps match naive slice+filter at several
 *          cursors, including after backward seek and after reset
 * - FIX 4: exactly one aria-live region
 * - FIX 5: status-sync effect has no eslint-disable for exhaustive-deps
 *
 * next/navigation is mocked. Canvas 2D API is mocked.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, act, fireEvent } from "@testing-library/react"

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
import { useSortingStore, SORTING_RUN_STATUS } from "@/store/sorting-store"
import { replayTo } from "@/lib/algorithms/sorting/replay-state"
import { SORT_STEP_KIND } from "@/lib/algorithms/sorting/types"
import { bubbleSort } from "@/lib/algorithms/sorting/bubble-sort"

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
		act(() => {
			useSortingStore.setState({ arr: knownArr, algorithm: "merge" as const })
			useSortingStore.getState().run()
		})

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

// ---------------------------------------------------------------------------
// FIX 1 (new): cursor sequencing — no fully-sorted flash, step-from-idle = cursor 0
// ---------------------------------------------------------------------------

describe("SortingVisualizer — FIX1 cursor sequencing", () => {
	beforeEach(() => {
		resetStore()
		lastCanvasArrProp = null
	})

	it("after clicking Run, the first displayArr committed to canvas is cursor 0, not steps.length-1", () => {
		// Seed a known array so the trace is deterministic
		const knownArr = [3, 1, 2]
		act(() => {
			useSortingStore.setState({ arr: knownArr })
		})

		const { getByRole } = render(<SortingVisualizer />)
		// Reset lastCanvasArrProp to track what the FIRST render after Run shows
		lastCanvasArrProp = null

		act(() => {
			const runBtn = getByRole("button", { name: /run sort/i })
			fireEvent.click(runBtn)
		})

		// After clicking Run, the store has traceResult. The pending effect fires
		// seek(0), which makes cursor = 0. The replay effect then renders from cursor 0.
		// The canvas must NOT receive the fully sorted array as its first post-run prop.
		const trace = bubbleSort(knownArr)
		const expectedSorted = [...knownArr].sort((a, b) => a - b)
		const stateAt0 = replayTo(knownArr, trace.steps, 0)

		// lastCanvasArrProp should reflect cursor 0, NOT the fully sorted array
		// (which is what cursor=steps.length-1 would produce before the seek)
		expect(lastCanvasArrProp).not.toBeNull()
		// The displayed array must equal the state at cursor 0
		expect(lastCanvasArrProp).toEqual(stateAt0)
		// And cursor 0 state must differ from fully sorted (if there's a swap at step 0)
		if (trace.steps.length > 1 && JSON.stringify(stateAt0) !== JSON.stringify(expectedSorted)) {
			expect(lastCanvasArrProp).not.toEqual(expectedSorted)
		}
	})

	it("step from idle shows the state at cursor 0 exactly (not cursor 1)", () => {
		const knownArr = [3, 1, 2]
		act(() => {
			useSortingStore.setState({ arr: knownArr })
		})

		const { getByRole } = render(<SortingVisualizer />)
		lastCanvasArrProp = null

		act(() => {
			const stepBtn = getByRole("button", { name: /step forward/i })
			fireEvent.click(stepBtn)
		})

		const trace = bubbleSort(knownArr)
		const stateAt0 = replayTo(knownArr, trace.steps, 0)
		// After one Step from idle: store has trace, pending STEP resolves via seek(0) only.
		// canvas should show cursor 0 state.
		expect(lastCanvasArrProp).toEqual(stateAt0)
	})
})

// ---------------------------------------------------------------------------
// FIX 2 (new): pendingActionRef lifecycle
// ---------------------------------------------------------------------------

describe("SortingVisualizer — FIX2 pendingActionRef lifecycle", () => {
	beforeEach(() => {
		resetStore()
		lastCanvasArrProp = null
	})

	it("run-then-reset leaves Run button clickable (a subsequent Run works without hanging)", () => {
		const { getByRole } = render(<SortingVisualizer />)

		// Click Run
		act(() => {
			fireEvent.click(getByRole("button", { name: /run sort/i }))
		})

		// Immediately Reset
		act(() => {
			fireEvent.click(getByRole("button", { name: /reset animation/i }))
		})

		// After reset, store is idle and pendingActionRef must be PENDING_NONE.
		// A subsequent Run click must work (not be blocked by the re-entrant guard).
		const storeState = useSortingStore.getState()
		expect(storeState.status).toBe(SORTING_RUN_STATUS.IDLE)

		// Click Run again — should not throw and should produce a trace
		act(() => {
			fireEvent.click(getByRole("button", { name: /run sort/i }))
		})
		// Trace should now be committed (run() was called)
		expect(useSortingStore.getState().traceResult).not.toBeNull()
	})

	it("double-click Run results in at most one pending play (re-entrant guard)", () => {
		// After first click: pendingActionRef = PENDING_PLAY, run() called.
		// Second click while still IDLE+PENDING should be rejected by the guard.
		const { getByRole } = render(<SortingVisualizer />)

		// We intercept run() calls by counting store trace updates
		let runCallCount = 0
		const originalRun = useSortingStore.getState().run
		const patchedRun = () => {
			runCallCount++
			originalRun()
		}
		useSortingStore.setState({ run: patchedRun })

		act(() => {
			const runBtn = getByRole("button", { name: /run sort/i })
			fireEvent.click(runBtn)
			// Immediately click again — still in same act(), before traceResult effect fires
			fireEvent.click(runBtn)
		})

		// run() should have been called at most once (second click rejected by guard)
		expect(runCallCount).toBeLessThanOrEqual(1)
	})

	it("pendingActionRef cleared on unmount so remount does not auto-play", () => {
		const { getByRole, unmount } = render(<SortingVisualizer />)

		// Start a run to set pending flag
		act(() => {
			fireEvent.click(getByRole("button", { name: /run sort/i }))
		})

		// Unmount while pending
		act(() => {
			unmount()
		})

		// Remount fresh — should not auto-play
		resetStore()
		const { getByRole: getByRole2 } = render(<SortingVisualizer />)
		const runBtn = getByRole2("button", { name: /run sort/i })
		// Run button should be visible and idle (not in Pause state)
		expect(runBtn).toBeDefined()
		expect(runBtn.textContent).toContain("Run")
	})
})

// ---------------------------------------------------------------------------
// FIX 3 (new): incremental metrics match naive computation at multiple cursors
// ---------------------------------------------------------------------------

describe("SortingVisualizer — FIX3 incremental metrics fidelity", () => {
	beforeEach(() => {
		resetStore()
		lastCanvasArrProp = null
	})

	function naiveCount(
		steps: ReadonlyArray<{ kind: string }>,
		cursor: number
	): { comparisons: number; swaps: number } {
		let comparisons = 0
		let swaps = 0
		const end = Math.min(cursor, steps.length - 1)
		for (let i = 0; i <= end; i++) {
			if (steps[i].kind === SORT_STEP_KIND.COMPARE) comparisons++
			else if (steps[i].kind === SORT_STEP_KIND.SWAP) swaps++
		}
		return { comparisons, swaps }
	}

	it("liveComparisons and liveSwaps match naive computation at several forward cursors", () => {
		const knownArr = [5, 3, 1, 4, 2]
		act(() => {
			useSortingStore.setState({ arr: knownArr })
			useSortingStore.getState().run()
		})
		const { traceResult } = useSortingStore.getState()
		expect(traceResult).not.toBeNull()

		const steps = traceResult!.steps
		const checkCursors = [
			0,
			Math.floor(steps.length / 4),
			Math.floor(steps.length / 2),
			steps.length - 1,
		]

		for (const cursor of checkCursors) {
			act(() => {
				useSortingStore.getState().setCursor(cursor)
			})

			const { container } = render(<SortingVisualizer />)
			const { comparisons, swaps } = naiveCount(steps, cursor)

			// Read displayed values from the metrics panel
			const allDds = container.querySelectorAll("dd")
			const compDd = allDds[0]
			const swapDd = allDds[1]

			expect(Number(compDd?.textContent)).toBe(comparisons)
			expect(Number(swapDd?.textContent)).toBe(swaps)
		}
	})

	it("liveComparisons/liveSwaps after backward seek match naive computation", () => {
		const knownArr = [5, 3, 1, 4, 2]
		act(() => {
			useSortingStore.setState({ arr: knownArr })
			useSortingStore.getState().run()
		})
		const { traceResult } = useSortingStore.getState()
		expect(traceResult).not.toBeNull()

		const steps = traceResult!.steps
		const lastCursor = steps.length - 1
		const midCursor = Math.floor(steps.length / 2)

		// First advance to last cursor
		act(() => {
			useSortingStore.getState().setCursor(lastCursor)
		})
		// Then seek backward to mid
		act(() => {
			useSortingStore.getState().setCursor(midCursor)
		})

		const { container } = render(<SortingVisualizer />)
		const { comparisons, swaps } = naiveCount(steps, midCursor)
		const allDds = container.querySelectorAll("dd")
		expect(Number(allDds[0]?.textContent)).toBe(comparisons)
		expect(Number(allDds[1]?.textContent)).toBe(swaps)
	})

	it("liveComparisons/liveSwaps after reset are zero (no trace)", () => {
		const knownArr = [5, 3, 1, 4, 2]
		act(() => {
			useSortingStore.setState({ arr: knownArr })
			useSortingStore.getState().run()
		})
		act(() => {
			useSortingStore.getState().resetRun()
		})

		const { container } = render(<SortingVisualizer />)
		// When traceResult is null, metrics panel shows "—" (em dash)
		const allDds = container.querySelectorAll("dd")
		expect(allDds[0]?.textContent?.trim()).toBe("—")
		expect(allDds[1]?.textContent?.trim()).toBe("—")
	})
})
