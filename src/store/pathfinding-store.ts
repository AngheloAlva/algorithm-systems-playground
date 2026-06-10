/**
 * Zustand store for the pathfinding visualizer module.
 *
 * ## Store shape (design §5)
 * - Config (serialized to URL): algorithm, speed, diagonal
 * - Grid (NOT serialized to URL — see design §7 rationale)
 * - Run state: status, cursor, result, brush
 *
 * ## Out of store (per design decisions)
 * - canvas DOM refs — owned by PathfindingCanvas via useRef
 * - rAF id — owned by useStepPlayer
 * - getComputedStyle color cache — component-local
 *
 * ## Instant recompute (design §6 + M3)
 * Any mutation that affects the path (paintCell, dragEndpoint, setCellWeight,
 * setDiagonal, setAlgorithm) triggers a SILENT recompute if status !== "idle".
 * Recompute calls the selected algorithm synchronously, sets result + cursor=last.
 * Status becomes "done" if path found, "idle" if not.
 *
 * generateMaze does NOT trigger silent recompute — it forces status=IDLE and
 * clears result/cursor. A fresh maze never auto-runs; the user must press Run.
 *
 * ## Run vs Recompute
 * - run(): full animate intent — sets result + status=done + cursor=last
 *   (cursor=last so the canvas shows the final state immediately; the animator
 *    can seek to 0 and play from there when launched from the UI)
 * - recompute(): silent — same as run but only fires when status !== "idle"
 *   and is called from mutating actions automatically
 */

import { create } from "zustand"
import { createGrid, placeStart, placeEnd, toggleWall, setWeight } from "../lib/grid/grid"
import { DEFAULT_ROWS, DEFAULT_COLS } from "../lib/grid/grid.types"
import { ALGORITHM, ALGORITHM_REGISTRY } from "../lib/algorithms/pathfinding/index"
import type { Algorithm } from "../lib/algorithms/pathfinding/index"
import type { PathResult } from "../lib/algorithms/pathfinding/types"
import type { Grid } from "../lib/grid/grid.types"
import { DEFAULT_SPEED } from "../lib/animation/speed-config"
import { generateMaze } from "../lib/algorithms/pathfinding/maze"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RUN_STATUS = {
	IDLE: "idle",
	RUNNING: "running",
	PAUSED: "paused",
	DONE: "done",
} as const

export type RunStatus = (typeof RUN_STATUS)[keyof typeof RUN_STATUS]

export const BRUSH_MODE = {
	WALL: "wall",
	WEIGHT: "weight",
	ERASE: "erase",
	MOVE_START: "move-start",
	MOVE_END: "move-end",
} as const

export type BrushMode = (typeof BRUSH_MODE)[keyof typeof BRUSH_MODE]

// ---------------------------------------------------------------------------
// Default grid factory — sets default start/end positions
// ---------------------------------------------------------------------------

export function buildDefaultGrid(): Grid {
	let g = createGrid(DEFAULT_ROWS, DEFAULT_COLS)
	// Place start at top-left area, end at bottom-right area
	g = placeStart(g, 2, 2)
	g = placeEnd(g, DEFAULT_ROWS - 3, DEFAULT_COLS - 3)
	return g
}

// ---------------------------------------------------------------------------
// State + action interface
// ---------------------------------------------------------------------------

export interface PathfindingState {
	// Config (URL-serializable)
	algorithm: Algorithm
	speed: number
	diagonal: boolean

	// Grid (not URL-serialized)
	grid: Grid

	// Run state
	status: RunStatus
	cursor: number
	result: PathResult | null
	brush: BrushMode

	// Actions — config
	setAlgorithm: (algorithm: Algorithm) => void
	setSpeed: (speed: number) => void
	setDiagonal: (diagonal: boolean) => void
	setBrush: (brush: BrushMode) => void

	// Actions — grid mutations
	paintCell: (row: number, col: number) => void
	setCellWeight: (row: number, col: number, weight: number) => void
	dragEndpoint: (endpoint: "start" | "end", row: number, col: number) => void
	generateMaze: (seed: number) => void
	resetGrid: () => void
	clearPath: () => void

	// Actions — animation coupling
	run: () => void
	recompute: () => void
	setCursor: (cursor: number) => void
	setStatus: (status: RunStatus) => void
}

// ---------------------------------------------------------------------------
// Internal helper: run algorithm synchronously, return PathResult
// ---------------------------------------------------------------------------

function runAlgorithm(algorithm: Algorithm, grid: Grid, diagonal: boolean): PathResult {
	const entry = ALGORITHM_REGISTRY[algorithm]
	return entry.run(grid, { diagonal })
}

// ---------------------------------------------------------------------------
// Internal helper: apply silent recompute if status is not idle
// ---------------------------------------------------------------------------

type SetFn = (
	partial: Partial<PathfindingState> | ((state: PathfindingState) => Partial<PathfindingState>)
) => void

type GetFn = () => PathfindingState

/**
 * Runs the selected algorithm synchronously and updates result/cursor/status.
 *
 * Fires for ANY non-IDLE status (PAUSED and RUNNING included). When status is
 * RUNNING this KILLS the in-flight animation by design: result and cursor are
 * overwritten and status is set to DONE or IDLE. The UI animator layer (PR3b)
 * MUST treat the resulting status change as a stop signal and cancel any pending
 * rAF loop.
 *
 * Status after call:
 * - DONE  — algorithm found a path (result.metrics.reachable === true)
 * - IDLE  — no path exists
 */
function silentRecompute(set: SetFn, get: GetFn): void {
	const { status, grid, algorithm, diagonal } = get()
	if (status === RUN_STATUS.IDLE) return

	const result = runAlgorithm(algorithm, grid, diagonal)
	const cursor = result.trace.length > 0 ? result.trace.length - 1 : 0
	const nextStatus = result.metrics.reachable ? RUN_STATUS.DONE : RUN_STATUS.IDLE
	set({ result, cursor, status: nextStatus })
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialGrid = buildDefaultGrid()

const INITIAL_STATE = {
	algorithm: ALGORITHM.ASTAR,
	speed: DEFAULT_SPEED,
	diagonal: false,
	grid: initialGrid,
	status: RUN_STATUS.IDLE as RunStatus,
	cursor: 0,
	result: null as PathResult | null,
	brush: BRUSH_MODE.WALL as BrushMode,
}

export const usePathfindingStore = create<PathfindingState>()((set, get) => ({
	...INITIAL_STATE,

	// ---------------------------------------------------------------------------
	// Config actions
	// ---------------------------------------------------------------------------

	setAlgorithm(algorithm: Algorithm) {
		set({ algorithm })
		silentRecompute(set, get)
	},

	setSpeed(speed: number) {
		// Speed does not affect the path — no recompute
		set({ speed })
	},

	setDiagonal(diagonal: boolean) {
		set({ diagonal })
		silentRecompute(set, get)
	},

	setBrush(brush: BrushMode) {
		set({ brush })
	},

	// ---------------------------------------------------------------------------
	// Grid mutation actions
	// ---------------------------------------------------------------------------

	/**
	 * Toggle a wall on the cell at (row, col).
	 *
	 * @remarks
	 * Drag batching is the UI layer's responsibility. This action recomputes
	 * synchronously on every call. Pointer-drag handlers MUST batch/throttle
	 * (rAF) before invoking, per design §6.
	 */
	paintCell(row: number, col: number) {
		const { grid } = get()
		const nextGrid = toggleWall(grid, row, col)
		set({ grid: nextGrid })
		silentRecompute(set, get)
	},

	setCellWeight(row: number, col: number, weight: number) {
		const { grid } = get()
		const nextGrid = setWeight(grid, row, col, weight)
		set({ grid: nextGrid })
		silentRecompute(set, get)
	},

	/**
	 * Move the start or end endpoint to (row, col).
	 *
	 * @remarks
	 * Drag batching is the UI layer's responsibility. This action recomputes
	 * synchronously on every call. Pointer-drag handlers MUST batch/throttle
	 * (rAF) before invoking, per design §6.
	 */
	dragEndpoint(endpoint: "start" | "end", row: number, col: number) {
		const { grid } = get()
		let nextGrid: Grid
		try {
			if (endpoint === "start") {
				nextGrid = placeStart(grid, row, col)
			} else {
				nextGrid = placeEnd(grid, row, col)
			}
		} catch {
			// Target cell is a wall — silently ignore
			return
		}
		set({ grid: nextGrid })
		silentRecompute(set, get)
	},

	generateMaze(seed: number) {
		const { grid } = get()
		const mazeGrid = generateMaze(grid.rows, grid.cols, seed)
		set({ grid: mazeGrid, status: RUN_STATUS.IDLE, result: null, cursor: 0 })
	},

	resetGrid() {
		set({
			grid: buildDefaultGrid(),
			status: RUN_STATUS.IDLE,
			result: null,
			cursor: 0,
		})
	},

	clearPath() {
		set({ status: RUN_STATUS.IDLE, result: null, cursor: 0 })
	},

	// ---------------------------------------------------------------------------
	// Animation coupling
	// ---------------------------------------------------------------------------

	run() {
		const { algorithm, grid, diagonal } = get()
		const result = runAlgorithm(algorithm, grid, diagonal)
		const cursor = result.trace.length > 0 ? result.trace.length - 1 : 0
		const status = result.metrics.reachable ? RUN_STATUS.DONE : RUN_STATUS.IDLE
		set({ result, cursor, status })
	},

	/**
	 * Silent guarded recompute for the UI layer.
	 *
	 * Only fires when status !== IDLE. If status is IDLE this is a no-op —
	 * use run() for an explicit animated run.
	 *
	 * Internally delegates to silentRecompute so logic is not duplicated.
	 *
	 * @remarks
	 * Calling this from the UI when status is IDLE is safe and intentional:
	 * the guard prevents spurious algorithm runs before the user starts.
	 */
	recompute() {
		// Guard: no-op when idle — run() is the explicit entry point for animated runs
		if (get().status === RUN_STATUS.IDLE) return
		silentRecompute(set, get)
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

/** Select grid — repaint on grid topology changes only */
export const selectGrid = (s: PathfindingState) => s.grid

/** Select algorithm config for URL codec sync */
export const selectUrlState = (s: PathfindingState) => ({
	algorithm: s.algorithm,
	speed: s.speed,
	diagonal: s.diagonal,
})

/** Select run metrics for MetricsPanel */
export const selectMetrics = (s: PathfindingState) => s.result?.metrics ?? null

/** Select active pseudocode line for PseudocodePanel */
export const selectActiveLine = (s: PathfindingState) => s.result?.trace[s.cursor]?.line ?? -1
