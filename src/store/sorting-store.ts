/**
 * Zustand store for the sorting visualizer module.
 *
 * ## Store shape (spec §5)
 * - Config (serialized to URL): algorithm, speed, arrayLength, arrayMode
 * - Array + run state: arr, status, cursor, traceResult
 *
 * ## Out of store (per design decisions)
 * - canvas DOM refs — owned by SortingCanvas via useRef
 * - rAF id — owned by useStepPlayer
 * - getComputedStyle color cache — component-local
 *
 * ## Run model
 * - run(): executes the selected sort on current arr synchronously, stores
 *   traceResult, sets cursor=last step index, status=done.
 *   The UI/animator is responsible for seeking to 0 and playing.
 *   The store is NOT responsible for playback.
 *
 * ## No instant-recompute
 * Array is not interactive mid-run; array regeneration only happens via
 * explicit generateArray() or user controls (spec §5).
 *
 * ## MD-2 compliance
 * RunStatus and RUN_STATUS are imported from pathfinding-store (peer store
 * import — not a layer violation; avoids drift between two definitions).
 */

import { create } from "zustand"
import { RunStatus, RUN_STATUS } from "./pathfinding-store"
import { SORT_ALGORITHM, SORT_ALGORITHM_REGISTRY } from "../lib/algorithms/sorting/index"
import type { SortAlgorithm } from "../lib/algorithms/sorting/index"
import type { SortTraceResult } from "../lib/algorithms/sorting/types"
import { generateArray as genArray, MIN_ARRAY_LENGTH, MAX_ARRAY_LENGTH } from "../lib/algorithms/sorting/array-gen"
import type { ArrayMode } from "../lib/algorithms/sorting/array-gen"
import { DEFAULT_SPEED } from "../lib/animation/speed-config"
import { SORTING_DEFAULTS } from "../lib/url-state/sorting-codec"

// ---------------------------------------------------------------------------
// Re-export RunStatus for convenience (callers can import from either store)
// ---------------------------------------------------------------------------

export type { RunStatus } from "./pathfinding-store"
export { RUN_STATUS } from "./pathfinding-store"

// ---------------------------------------------------------------------------
// SortingRunStatus alias — same const, different semantic name for clarity
// ---------------------------------------------------------------------------

export const SORTING_RUN_STATUS = RUN_STATUS

// ---------------------------------------------------------------------------
// State + action interface
// ---------------------------------------------------------------------------

export interface SortingState {
	// Config (URL-serializable)
	algorithm: SortAlgorithm
	speed: number
	arrayLength: number
	arrayMode: ArrayMode

	// Array + run state
	arr: ReadonlyArray<number>
	status: RunStatus
	cursor: number
	traceResult: SortTraceResult | null

	// Actions — config
	setAlgorithm: (alg: SortAlgorithm) => void
	setSpeed: (speed: number) => void
	setArrayLength: (len: number) => void
	setArrayMode: (mode: ArrayMode) => void

	// Actions — array
	/** Regenerates arr from current length+mode; resets run state. */
	generateArray: () => void

	// Actions — animation coupling
	/**
	 * Executes the selected sort on current arr synchronously.
	 * Stores traceResult, sets cursor=steps.length-1, status=done.
	 * The animator (useStepPlayer) should seek to 0 and play after this.
	 */
	run: () => void
	/** Clears trace/cursor; status=idle; arr unchanged. */
	resetRun: () => void
	setCursor: (cursor: number) => void
	setStatus: (status: RunStatus) => void
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Clamp arrayLength to [MIN_ARRAY_LENGTH, MAX_ARRAY_LENGTH]. */
function clampLength(len: number): number {
	return Math.max(MIN_ARRAY_LENGTH, Math.min(MAX_ARRAY_LENGTH, len))
}

/** Reset run state fields (no trace, no cursor, idle). */
function resetRunState() {
	return {
		status: RUN_STATUS.IDLE as RunStatus,
		cursor: 0,
		traceResult: null as SortTraceResult | null,
	}
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialLength = SORTING_DEFAULTS.arrayLength
const initialMode = SORTING_DEFAULTS.arrayMode as ArrayMode
const initialArr = genArray(initialLength, initialMode)

const INITIAL_STATE = {
	algorithm: SORT_ALGORITHM.BUBBLE as SortAlgorithm,
	speed: DEFAULT_SPEED,
	arrayLength: initialLength,
	arrayMode: initialMode,
	arr: initialArr,
	status: RUN_STATUS.IDLE as RunStatus,
	cursor: 0,
	traceResult: null as SortTraceResult | null,
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSortingStore = create<SortingState>()((set, get) => ({
	...INITIAL_STATE,

	// ---------------------------------------------------------------------------
	// Config actions
	// ---------------------------------------------------------------------------

	setAlgorithm(alg: SortAlgorithm) {
		set({ algorithm: alg, ...resetRunState() })
	},

	setSpeed(speed: number) {
		// Speed does not affect the sort — no regeneration
		set({ speed })
	},

	setArrayLength(len: number) {
		const clamped = clampLength(len)
		const { arrayMode } = get()
		const newArr = genArray(clamped, arrayMode)
		set({ arrayLength: clamped, arr: newArr, ...resetRunState() })
	},

	setArrayMode(mode: ArrayMode) {
		const { arrayLength } = get()
		const newArr = genArray(arrayLength, mode)
		set({ arrayMode: mode, arr: newArr, ...resetRunState() })
	},

	// ---------------------------------------------------------------------------
	// Array action
	// ---------------------------------------------------------------------------

	generateArray() {
		const { arrayLength, arrayMode } = get()
		const newArr = genArray(arrayLength, arrayMode)
		set({ arr: newArr, ...resetRunState() })
	},

	// ---------------------------------------------------------------------------
	// Animation coupling
	// ---------------------------------------------------------------------------

	run() {
		const { algorithm, arr } = get()
		const entry = SORT_ALGORITHM_REGISTRY[algorithm]
		const traceResult = entry.run(arr)
		const cursor = traceResult.steps.length > 0 ? traceResult.steps.length - 1 : 0
		set({ traceResult, cursor, status: RUN_STATUS.DONE })
	},

	resetRun() {
		set(resetRunState())
	},

	setCursor(cursor: number) {
		set({ cursor })
	},

	setStatus(status: RunStatus) {
		set({ status })
	},
}))

// ---------------------------------------------------------------------------
// Selector helpers (for component use — narrow subscriptions)
// ---------------------------------------------------------------------------

/** Select algorithm config for URL codec sync */
export const selectSortingUrlState = (s: SortingState) => ({
	algorithm: s.algorithm,
	speed: s.speed,
	arrayLength: s.arrayLength,
	arrayMode: s.arrayMode,
})

/** Select active pseudocode line for PseudocodePanel */
export const selectSortingActiveLine = (s: SortingState) =>
	s.traceResult?.steps[s.cursor]?.pseudocodeLine ?? -1

/** Select sorting metrics from traceResult */
export const selectSortingMetrics = (s: SortingState) => s.traceResult?.metrics ?? null
