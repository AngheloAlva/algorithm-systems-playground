/**
 * TDD tests for sorting Zustand store.
 *
 * Tests vanilla store (outside React) using useSortingStore.getState() /
 * setState() per the Zustand 5 pattern for testing outside components.
 *
 * Covers:
 *  - Initial state shape
 *  - Config actions: setAlgorithm, setSpeed, setArrayLength, setArrayMode
 *  - generateArray action: regenerates arr from current length+mode, resets run state
 *  - run action: executes sort, stores traceResult, sets cursor=last, status=done
 *  - resetRun: clears trace/cursor, returns status to idle, arr unchanged
 *  - setCursor, setStatus
 *  - State invariants: arr is ReadonlyArray<number> after generateArray
 */

import { describe, it, expect, beforeEach } from "vitest"
import { useSortingStore, SORTING_RUN_STATUS } from "./sorting-store"
import { SORT_ALGORITHM } from "../lib/algorithms/sorting/index"
import { ARRAY_MODE, MIN_ARRAY_LENGTH, MAX_ARRAY_LENGTH } from "../lib/algorithms/sorting/array-gen"
import { DEFAULT_SPEED } from "../lib/animation/speed-config"
import { SORTING_DEFAULTS } from "../lib/url-state/sorting-codec"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
	useSortingStore.setState(useSortingStore.getInitialState(), true)
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("sortingStore — initial state", () => {
	beforeEach(resetStore)

	it("defaults to bubble algorithm", () => {
		expect(useSortingStore.getState().algorithm).toBe(SORT_ALGORITHM.BUBBLE)
	})

	it("defaults to DEFAULT_SPEED", () => {
		expect(useSortingStore.getState().speed).toBe(DEFAULT_SPEED)
	})

	it("defaults arrayLength to SORTING_DEFAULTS.arrayLength", () => {
		expect(useSortingStore.getState().arrayLength).toBe(SORTING_DEFAULTS.arrayLength)
	})

	it("defaults arrayMode to random", () => {
		expect(useSortingStore.getState().arrayMode).toBe(ARRAY_MODE.RANDOM)
	})

	it("defaults status to idle", () => {
		expect(useSortingStore.getState().status).toBe(SORTING_RUN_STATUS.IDLE)
	})

	it("defaults cursor to 0", () => {
		expect(useSortingStore.getState().cursor).toBe(0)
	})

	it("defaults traceResult to null", () => {
		expect(useSortingStore.getState().traceResult).toBeNull()
	})

	it("initializes arr as a non-empty array", () => {
		const { arr } = useSortingStore.getState()
		expect(Array.isArray(arr)).toBe(true)
		expect(arr.length).toBeGreaterThan(0)
	})

	it("initial arr length matches arrayLength", () => {
		const { arr, arrayLength } = useSortingStore.getState()
		expect(arr.length).toBe(arrayLength)
	})
})

// ---------------------------------------------------------------------------
// Config actions
// ---------------------------------------------------------------------------

describe("sortingStore — setAlgorithm", () => {
	beforeEach(resetStore)

	it("updates the algorithm field", () => {
		useSortingStore.getState().setAlgorithm(SORT_ALGORITHM.MERGE)
		expect(useSortingStore.getState().algorithm).toBe(SORT_ALGORITHM.MERGE)
	})

	it("resets run state when changing algorithm", () => {
		// First run to get a trace
		useSortingStore.getState().run()
		expect(useSortingStore.getState().status).toBe(SORTING_RUN_STATUS.DONE)

		useSortingStore.getState().setAlgorithm(SORT_ALGORITHM.QUICK)
		expect(useSortingStore.getState().status).toBe(SORTING_RUN_STATUS.IDLE)
		expect(useSortingStore.getState().traceResult).toBeNull()
		expect(useSortingStore.getState().cursor).toBe(0)
	})
})

describe("sortingStore — setSpeed", () => {
	beforeEach(resetStore)

	it("updates the speed field", () => {
		useSortingStore.getState().setSpeed(7)
		expect(useSortingStore.getState().speed).toBe(7)
	})

	it("does not affect arr or run state", () => {
		useSortingStore.getState().run()
		const traceBefore = useSortingStore.getState().traceResult
		useSortingStore.getState().setSpeed(2)
		expect(useSortingStore.getState().traceResult).toBe(traceBefore)
		expect(useSortingStore.getState().status).toBe(SORTING_RUN_STATUS.DONE)
	})
})

describe("sortingStore — setArrayLength", () => {
	beforeEach(resetStore)

	it("updates the arrayLength field", () => {
		useSortingStore.getState().setArrayLength(50)
		expect(useSortingStore.getState().arrayLength).toBe(50)
	})

	it("regenerates arr with new length", () => {
		useSortingStore.getState().setArrayLength(50)
		expect(useSortingStore.getState().arr.length).toBe(50)
	})

	it("resets run state when changing array length", () => {
		useSortingStore.getState().run()
		useSortingStore.getState().setArrayLength(20)
		expect(useSortingStore.getState().status).toBe(SORTING_RUN_STATUS.IDLE)
		expect(useSortingStore.getState().traceResult).toBeNull()
		expect(useSortingStore.getState().cursor).toBe(0)
	})

	it("clamps arrayLength to MIN_ARRAY_LENGTH at minimum", () => {
		useSortingStore.getState().setArrayLength(1)
		expect(useSortingStore.getState().arrayLength).toBeGreaterThanOrEqual(MIN_ARRAY_LENGTH)
	})

	it("clamps arrayLength to MAX_ARRAY_LENGTH at maximum", () => {
		useSortingStore.getState().setArrayLength(9999)
		expect(useSortingStore.getState().arrayLength).toBeLessThanOrEqual(MAX_ARRAY_LENGTH)
	})
})

describe("sortingStore — setArrayMode", () => {
	beforeEach(resetStore)

	it("updates the arrayMode field", () => {
		useSortingStore.getState().setArrayMode(ARRAY_MODE.SORTED)
		expect(useSortingStore.getState().arrayMode).toBe(ARRAY_MODE.SORTED)
	})

	it("regenerates arr with new mode", () => {
		useSortingStore.getState().setArrayMode(ARRAY_MODE.SORTED)
		const arr = useSortingStore.getState().arr
		// SORTED mode should produce ascending array
		const isSorted = arr.every((v, i, a) => i === 0 || a[i - 1] <= v)
		expect(isSorted).toBe(true)
	})

	it("resets run state when changing array mode", () => {
		useSortingStore.getState().run()
		useSortingStore.getState().setArrayMode(ARRAY_MODE.REVERSED)
		expect(useSortingStore.getState().status).toBe(SORTING_RUN_STATUS.IDLE)
		expect(useSortingStore.getState().traceResult).toBeNull()
		expect(useSortingStore.getState().cursor).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// generateArray action
// ---------------------------------------------------------------------------

describe("sortingStore — generateArray", () => {
	beforeEach(resetStore)

	it("regenerates arr from current length+mode", () => {
		useSortingStore.getState().setArrayLength(10)
		useSortingStore.getState().generateArray()
		expect(useSortingStore.getState().arr.length).toBe(10)
	})

	it("resets run state: status=idle, cursor=0, traceResult=null", () => {
		useSortingStore.getState().run()
		expect(useSortingStore.getState().status).toBe(SORTING_RUN_STATUS.DONE)

		useSortingStore.getState().generateArray()
		expect(useSortingStore.getState().status).toBe(SORTING_RUN_STATUS.IDLE)
		expect(useSortingStore.getState().cursor).toBe(0)
		expect(useSortingStore.getState().traceResult).toBeNull()
	})

	it("produces a sorted arr in SORTED mode", () => {
		useSortingStore.getState().setArrayLength(10)
		useSortingStore.setState({ arrayMode: ARRAY_MODE.SORTED })
		useSortingStore.getState().generateArray()
		const arr = useSortingStore.getState().arr
		for (let i = 1; i < arr.length; i++) {
			expect(arr[i]).toBeGreaterThanOrEqual(arr[i - 1])
		}
	})

	it("produces a reversed arr in REVERSED mode", () => {
		useSortingStore.getState().setArrayLength(10)
		useSortingStore.setState({ arrayMode: ARRAY_MODE.REVERSED })
		useSortingStore.getState().generateArray()
		const arr = useSortingStore.getState().arr
		for (let i = 1; i < arr.length; i++) {
			expect(arr[i]).toBeLessThanOrEqual(arr[i - 1])
		}
	})
})

// ---------------------------------------------------------------------------
// run action
// ---------------------------------------------------------------------------

describe("sortingStore — run", () => {
	beforeEach(resetStore)

	it("sets traceResult to a non-null SortTraceResult", () => {
		useSortingStore.getState().run()
		expect(useSortingStore.getState().traceResult).not.toBeNull()
	})

	it("sets status to done", () => {
		useSortingStore.getState().run()
		expect(useSortingStore.getState().status).toBe(SORTING_RUN_STATUS.DONE)
	})

	it("sets cursor to last step index", () => {
		useSortingStore.getState().run()
		const { cursor, traceResult } = useSortingStore.getState()
		expect(traceResult).not.toBeNull()
		expect(cursor).toBe(traceResult!.steps.length - 1)
	})

	it("does not mutate arr", () => {
		const arrBefore = [...useSortingStore.getState().arr]
		useSortingStore.getState().run()
		const arrAfter = useSortingStore.getState().arr
		expect([...arrAfter]).toEqual(arrBefore)
	})

	it("traceResult metrics.arrayLength matches arr.length", () => {
		useSortingStore.getState().run()
		const { traceResult, arr } = useSortingStore.getState()
		expect(traceResult!.metrics.arrayLength).toBe(arr.length)
	})

	it("works for all four algorithms", () => {
		const algorithms = [
			SORT_ALGORITHM.BUBBLE,
			SORT_ALGORITHM.QUICK,
			SORT_ALGORITHM.MERGE,
			SORT_ALGORITHM.HEAP,
		]
		for (const alg of algorithms) {
			resetStore()
			useSortingStore.getState().setAlgorithm(alg)
			useSortingStore.getState().run()
			expect(useSortingStore.getState().status).toBe(SORTING_RUN_STATUS.DONE)
			expect(useSortingStore.getState().traceResult).not.toBeNull()
		}
	})
})

// ---------------------------------------------------------------------------
// resetRun action
// ---------------------------------------------------------------------------

describe("sortingStore — resetRun", () => {
	beforeEach(resetStore)

	it("sets status to idle", () => {
		useSortingStore.getState().run()
		useSortingStore.getState().resetRun()
		expect(useSortingStore.getState().status).toBe(SORTING_RUN_STATUS.IDLE)
	})

	it("sets cursor to 0", () => {
		useSortingStore.getState().run()
		useSortingStore.getState().resetRun()
		expect(useSortingStore.getState().cursor).toBe(0)
	})

	it("sets traceResult to null", () => {
		useSortingStore.getState().run()
		useSortingStore.getState().resetRun()
		expect(useSortingStore.getState().traceResult).toBeNull()
	})

	it("leaves arr unchanged", () => {
		const arrBefore = [...useSortingStore.getState().arr]
		useSortingStore.getState().run()
		useSortingStore.getState().resetRun()
		expect([...useSortingStore.getState().arr]).toEqual(arrBefore)
	})
})

// ---------------------------------------------------------------------------
// setCursor / setStatus
// ---------------------------------------------------------------------------

describe("sortingStore — setCursor / setStatus", () => {
	beforeEach(resetStore)

	it("setCursor updates cursor", () => {
		useSortingStore.getState().run()
		useSortingStore.getState().setCursor(3)
		expect(useSortingStore.getState().cursor).toBe(3)
	})

	it("setStatus updates status", () => {
		useSortingStore.getState().setStatus(SORTING_RUN_STATUS.PAUSED)
		expect(useSortingStore.getState().status).toBe(SORTING_RUN_STATUS.PAUSED)
	})
})
