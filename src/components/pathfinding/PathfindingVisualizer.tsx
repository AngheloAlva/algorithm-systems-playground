"use client"

/**
 * PathfindingVisualizer — the "use client" island for the pathfinding module.
 *
 * This is the single large client boundary (design §9, D10). It owns:
 *   - Zustand store hook (usePathfindingStore)
 *   - useStepPlayer integration (rAF-driven animation cursor)
 *   - PathfindingCanvas wiring (pointer painting + rAF-throttled drag)
 *   - Control panels (algorithm, speed, brush, toolbar actions)
 *   - PseudocodePanel + MetricsPanel
 *   - URL sync (useSearchParams read on mount, router.replace on change)
 *   - Tabs shell (pathfinding active, sorting disabled)
 *
 * ## rAF-throttled drag (design §6)
 * paintCell and dragEndpoint are called by pointer handlers. Per the store
 * @remarks, those actions recompute synchronously on every call. To prevent
 * recompute storms during fast drags, pointer-move dispatches are coalesced
 * via requestAnimationFrame: at most one store call per animation frame while
 * the pointer is held down.
 *
 * ## Animator coupling (design §3, §6)
 * useStepPlayer drives the store cursor via setCursor. When the store's result
 * changes mid-play (silentRecompute during RUNNING), the trace length changes
 * → useStepPlayer's `length` prop changes → the hook detects done/overflow on
 * the next frame and stops cleanly. This satisfies the "silent recompute during
 * RUNNING is a stop signal" contract without explicit coordination.
 *
 * ## URL sync
 * Config (algorithm, speed, diagonal) is read from URL on mount and written
 * on change. Speed slider writes are debounced 300ms (design §7).
 */

import { useCallback, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useShallow } from "zustand/react/shallow"

import { usePathfindingStore, RUN_STATUS, BRUSH_MODE } from "@/store/pathfinding-store"
import { CELL } from "@/lib/grid/grid.types"
import { ALGORITHM_REGISTRY } from "@/lib/algorithms/pathfinding/index"
import type { Algorithm } from "@/lib/algorithms/pathfinding/index"
import { pathfindingCodec } from "@/lib/url-state/pathfinding-codec"
import { MIN_SPEED, MAX_SPEED } from "@/lib/animation/speed-config"
import { useStepPlayer, PLAYER_STATUS } from "@/hooks/useStepPlayer"

import { PathfindingCanvas } from "@/components/canvas/PathfindingCanvas"
import { ControlPanel } from "@/components/controls/control-panel"
import { Toolbar } from "@/components/controls/toolbar"
import { PseudocodePanel } from "./PseudocodePanel"
import { MetricsPanel } from "./MetricsPanel"

import { Button } from "@/components/ui/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import {
	PlayIcon,
	PauseIcon,
	SkipForwardIcon,
	RotateCcwIcon,
	BrickWallIcon,
	EraserIcon,
	WeightIcon,
	ShuffleIcon,
	Trash2Icon,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Cell size constant — fits DEFAULT_ROWS × DEFAULT_COLS in ~1280px viewport
// ---------------------------------------------------------------------------
const CELL_SIZE = 24

export function PathfindingVisualizer() {
	const router = useRouter()
	const searchParams = useSearchParams()

	// -------------------------------------------------------------------------
	// Store slices (narrow subscriptions — avoid 60Hz re-render on cursor tick)
	// -------------------------------------------------------------------------

	const {
		algorithm,
		speed,
		diagonal,
		brush,
		status,
		setAlgorithm,
		setSpeed,
		setDiagonal,
		setBrush,
		run,
		resetGrid,
		clearPath,
		generateMaze,
		paintCell,
		cycleWeightAt,
		dragEndpoint,
		setCursor,
		setStatus,
	} = usePathfindingStore(
		useShallow((s) => ({
			algorithm: s.algorithm,
			speed: s.speed,
			diagonal: s.diagonal,
			brush: s.brush,
			status: s.status,
			setAlgorithm: s.setAlgorithm,
			setSpeed: s.setSpeed,
			setDiagonal: s.setDiagonal,
			setBrush: s.setBrush,
			run: s.run,
			resetGrid: s.resetGrid,
			clearPath: s.clearPath,
			generateMaze: s.generateMaze,
			paintCell: s.paintCell,
			cycleWeightAt: s.cycleWeightAt,
			dragEndpoint: s.dragEndpoint,
			setCursor: s.setCursor,
			setStatus: s.setStatus,
		}))
	)

	// Grid and result accessed separately to avoid over-subscribing
	const grid = usePathfindingStore((s) => s.grid)
	const result = usePathfindingStore((s) => s.result)

	// -------------------------------------------------------------------------
	// URL sync — read on mount
	// -------------------------------------------------------------------------

	const urlSyncedRef = useRef(false)

	useEffect(() => {
		if (urlSyncedRef.current) return
		urlSyncedRef.current = true

		const decoded = pathfindingCodec.decode(searchParams)
		if (decoded.algorithm !== algorithm) setAlgorithm(decoded.algorithm as Algorithm)
		if (decoded.speed !== speed) setSpeed(decoded.speed)
		if (decoded.diagonal !== diagonal) setDiagonal(decoded.diagonal)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// URL sync — write on config change, debounced for speed
	const speedDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const syncUrl = useCallback(
		(overrides?: { algorithm?: Algorithm; speed?: number; diagonal?: boolean }) => {
			const current = {
				algorithm: overrides?.algorithm ?? algorithm,
				speed: overrides?.speed ?? speed,
				diagonal: overrides?.diagonal ?? diagonal,
			}
			const params = pathfindingCodec.encode(current)
			const qs = params.toString()
			router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
		},
		[algorithm, speed, diagonal, router]
	)

	// -------------------------------------------------------------------------
	// rAF-throttled pointer drag state (design §6)
	// -------------------------------------------------------------------------

	const rafPendingRef = useRef<number | null>(null)
	const pendingActionRef = useRef<(() => void) | null>(null)

	// Tracks the last cell index painted during the current drag stroke.
	// Reset on pointerdown/pointerup/pointerleave. Guards against the rAF loop
	// re-dispatching paintCell for the same cell while the pointer is stationary
	// within a cell — which caused wall toggle flicker.
	const lastPaintedCellRef = useRef<number | null>(null)

	/** Enqueue a store mutation for the next animation frame (coalesces drag). */
	const scheduleAction = useCallback((action: () => void) => {
		pendingActionRef.current = action
		if (rafPendingRef.current === null) {
			rafPendingRef.current = requestAnimationFrame(() => {
				rafPendingRef.current = null
				pendingActionRef.current?.()
				pendingActionRef.current = null
			})
		}
	}, [])

	/** Flush any pending action immediately (called on pointer-up). */
	const flushAction = useCallback(() => {
		if (rafPendingRef.current !== null) {
			cancelAnimationFrame(rafPendingRef.current)
			rafPendingRef.current = null
		}
		pendingActionRef.current?.()
		pendingActionRef.current = null
		// Reset cell dedupe so the next drag stroke starts fresh
		lastPaintedCellRef.current = null
	}, [])

	// Cleanup rAF on unmount
	useEffect(() => {
		return () => {
			if (rafPendingRef.current !== null) cancelAnimationFrame(rafPendingRef.current)
		}
	}, [])

	// -------------------------------------------------------------------------
	// Canvas pointer callbacks — rAF-throttled
	// -------------------------------------------------------------------------

	const handleCellClick = useCallback(
		(cellIndex: number, isPointerDown?: boolean): string | undefined => {
			const { rows, cols } = grid
			const row = Math.floor(cellIndex / cols)
			const col = cellIndex % cols
			if (row < 0 || col < 0 || row >= rows || col >= cols) return undefined

			if (brush === BRUSH_MODE.WALL || brush === BRUSH_MODE.ERASE) {
				// Dedupe: skip if the pointer is still within the same cell.
				// Guards against rAF-loop re-dispatching paintCell for a stationary
				// pointer, which caused wall toggle flicker.
				// isPointerDown: true (pointer-down AND keyboard Space) resets the dedupe
				// ref and dispatches paintCell immediately (no rAF coalescing) so that
				// the post-mutation store state can be read synchronously for the
				// announcement return value (FIX 2, FIX 1).
				if (isPointerDown) {
					lastPaintedCellRef.current = null
				}
				if (lastPaintedCellRef.current === cellIndex) return undefined
				lastPaintedCellRef.current = cellIndex
				if (isPointerDown) {
					// Discrete action (pointer-down or keyboard) — dispatch immediately so
					// the post-mutation grid is readable synchronously for FIX 1 announcement.
					paintCell(row, col)
				} else {
					// Drag path: mutation is deferred to rAF — return undefined immediately
					// so the post-mutation read below is never reached on a pre-mutation grid.
					// Per onCellClick JSDoc: drag paths return undefined (no announcement needed).
					scheduleAction(() => paintCell(row, col))
					return undefined
				}
			} else if (brush === BRUSH_MODE.WEIGHT) {
				// Weight brush semantics:
				// - Each pointerdown (or keyboard Space) on a cell advances weight one tier.
				//   isPointerDown: true resets the dedupe ref so repeated discrete actions
				//   always advance (keyboard Space and new pointer-down both pass true).
				// - During a drag, entering a NEW cell advances it once; moving within
				//   the same cell does NOT re-advance (per-cell dedupe across move events).
				// - Dispatched immediately — no rAF coalescing so discrete taps are
				//   never dropped.
				if (isPointerDown) {
					// Reset dedupe on each new pointer-down or keyboard discrete action
					lastPaintedCellRef.current = null
				}
				if (lastPaintedCellRef.current === cellIndex) return undefined
				lastPaintedCellRef.current = cellIndex
				paintCell(row, col)
			} else {
				// Other brush modes (MOVE_START, MOVE_END) — no-op for cell click
				return undefined
			}

			// Read ACTUAL post-mutation state from the store grid (FIX 1).
			// This is authoritative — no local prediction, no duplicated semantics.
			const postGrid = usePathfindingStore.getState().grid
			const i = cellIndex
			if (i === postGrid.start) return "start"
			if (i === postGrid.end) return "end"
			if (postGrid.cells[i] === CELL.WALL) return "wall"
			const w = postGrid.weights[i]
			return w > 1 ? `weight ${w}` : "empty"
		},
		[grid, brush, scheduleAction, paintCell]
	)

	// Weight cycle callback — used by the keyboard W key in the canvas.
	// Dispatched immediately (no rAF coalescing) so discrete W presses are
	// never dropped.
	// Returns the ACTUAL post-mutation cell description derived from the store
	// grid after the mutation — used by the canvas for screen-reader announcement
	// (FIX 1). Uses MAX_WEIGHT from grid types — no hardcoded value (FIX 4).
	const handleWeightCycle = useCallback(
		(cellIdx: number): string | undefined => {
			const { rows, cols } = grid
			const row = Math.floor(cellIdx / cols)
			const col = cellIdx % cols
			if (row < 0 || col < 0 || row >= rows || col >= cols) return undefined
			cycleWeightAt(row, col)
			// Read ACTUAL post-mutation state from the store grid (FIX 1).
			const postGrid = usePathfindingStore.getState().grid
			const i = cellIdx
			if (i === postGrid.start) return "start"
			if (i === postGrid.end) return "end"
			if (postGrid.cells[i] === CELL.WALL) return "wall"
			const w = postGrid.weights[i]
			return w > 1 ? `weight ${w}` : "empty"
		},
		[grid, cycleWeightAt]
	)

	const handleStartDrag = useCallback(
		(cellIndex: number) => {
			const { rows, cols } = grid
			const row = Math.floor(cellIndex / cols)
			const col = cellIndex % cols
			if (row < 0 || col < 0 || row >= rows || col >= cols) return
			scheduleAction(() => dragEndpoint("start", row, col))
		},
		[grid, scheduleAction, dragEndpoint]
	)

	const handleEndDrag = useCallback(
		(cellIndex: number) => {
			const { rows, cols } = grid
			const row = Math.floor(cellIndex / cols)
			const col = cellIndex % cols
			if (row < 0 || col < 0 || row >= rows || col >= cols) return
			scheduleAction(() => dragEndpoint("end", row, col))
		},
		[grid, scheduleAction, dragEndpoint]
	)

	// Flush pending action on pointer release (final authoritative store call)
	const handlePointerUp = useCallback(() => {
		flushAction()
	}, [flushAction])

	// -------------------------------------------------------------------------
	// useStepPlayer integration
	// -------------------------------------------------------------------------

	const traceLength = result?.trace.length ?? 0

	const onAdvance = useCallback(
		(cursor: number) => {
			setCursor(cursor)
		},
		[setCursor]
	)

	const player = useStepPlayer({ length: traceLength, speed, onAdvance })

	// Detect when store status changes to DONE during animation (silent recompute
	// during RUNNING kills the player — "stop signal" contract, design §6).
	useEffect(() => {
		if (status === RUN_STATUS.IDLE || status === RUN_STATUS.DONE) {
			// Store was reset externally — synchronize player if it was playing
			if (player.status === PLAYER_STATUS.PLAYING) {
				player.pause()
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status])

	// Mirror the player's completion into the store: when the trace finishes
	// playing (naturally or via the last manual step) the controls must stop
	// reporting a running/paused animation.
	useEffect(() => {
		if (
			player.status === PLAYER_STATUS.DONE &&
			(status === RUN_STATUS.RUNNING || status === RUN_STATUS.PAUSED)
		) {
			setStatus(RUN_STATUS.DONE)
		}
	}, [player.status, status, setStatus])

	// -------------------------------------------------------------------------
	// Run button handler — kicks off the algorithm then starts player from 0
	// -------------------------------------------------------------------------

	const handleRun = useCallback(() => {
		if (status === RUN_STATUS.RUNNING) {
			// Pause if already playing
			player.pause()
			setStatus(RUN_STATUS.PAUSED)
			return
		}

		if (player.status === PLAYER_STATUS.PAUSED) {
			// Resume from pause
			player.play()
			setStatus(RUN_STATUS.RUNNING)
			return
		}

		// Fresh run — compute trace, seek player to 0, then play
		run()
		// After run(), result is in store. Player length updates on next render.
		// We need to reset player first, then play on next tick.
		player.reset()
		// Use setTimeout(0) to let React flush the new traceLength to useStepPlayer
		setTimeout(() => {
			player.seek(0)
			player.play()
			setStatus(RUN_STATUS.RUNNING)
		}, 0)
	}, [status, player, run, setStatus])

	const handleStep = useCallback(() => {
		if (status === RUN_STATUS.IDLE) {
			// Need to compute first
			run()
			setTimeout(() => {
				player.seek(0)
				player.step()
				setStatus(RUN_STATUS.PAUSED)
			}, 0)
			return
		}
		player.step()
		// player.step() always lands the player in PAUSED; mirror that in the
		// store so the Run/Pause button never lies about the animation state.
		// The DONE transition is owned by the player sync effect (stale closure
		// reads of player.status here would miss the last step).
		setStatus(RUN_STATUS.PAUSED)
	}, [status, run, player, setStatus])

	const handleReset = useCallback(() => {
		player.reset()
		resetGrid()
	}, [player, resetGrid])

	const handleClearPath = useCallback(() => {
		player.reset()
		clearPath()
	}, [player, clearPath])

	const handleGenerateMaze = useCallback(() => {
		player.reset()
		generateMaze(Date.now())
	}, [player, generateMaze])

	// -------------------------------------------------------------------------
	// Config change handlers with URL sync
	// -------------------------------------------------------------------------

	const handleAlgorithmChange = useCallback(
		(value: Algorithm | null) => {
			if (!value) return
			setAlgorithm(value)
			syncUrl({ algorithm: value })
		},
		[setAlgorithm, syncUrl]
	)

	const handleDiagonalChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const diag = e.target.checked
			setDiagonal(diag)
			syncUrl({ diagonal: diag })
		},
		[setDiagonal, syncUrl]
	)

	const handleSpeedChange = useCallback(
		(value: number | readonly number[]) => {
			const arr = Array.isArray(value) ? value : [value]
			const spd = (arr as number[])[0] ?? speed
			setSpeed(spd)
			// Debounce URL write for speed slider
			if (speedDebounceRef.current) clearTimeout(speedDebounceRef.current)
			speedDebounceRef.current = setTimeout(() => {
				syncUrl({ speed: spd })
			}, 300)
		},
		[setSpeed, syncUrl, speed]
	)

	// Cleanup speed debounce on unmount
	useEffect(() => {
		return () => {
			if (speedDebounceRef.current) clearTimeout(speedDebounceRef.current)
		}
	}, [])

	// -------------------------------------------------------------------------
	// Derived state for button labels
	// -------------------------------------------------------------------------

	const isRunning = status === RUN_STATUS.RUNNING || player.status === PLAYER_STATUS.PLAYING
	const isPaused = status === RUN_STATUS.PAUSED || player.status === PLAYER_STATUS.PAUSED
	const isDone = status === RUN_STATUS.DONE && player.status === PLAYER_STATUS.DONE

	// -------------------------------------------------------------------------
	// Render
	// -------------------------------------------------------------------------

	return (
		<Tabs defaultValue="pathfinding" className="flex flex-col gap-4">
			{/* Tab switcher */}
			<TabsList aria-label="Algorithm visualizer tabs">
				<TabsTrigger value="pathfinding">Pathfinding</TabsTrigger>
				<TabsTrigger value="sorting" disabled aria-disabled="true" title="Coming soon">
					Sorting (coming soon)
				</TabsTrigger>
			</TabsList>

			{/* Pathfinding tab */}
			<TabsContent value="pathfinding" className="flex flex-col gap-4">
				{/* Toolbar — play/pause/step/reset + speed */}
				<Toolbar className="flex-wrap gap-3">
					{/* Run / Pause button */}
					<Button
						variant={isRunning ? "outline" : "default"}
						size="sm"
						onClick={handleRun}
						aria-label={
							isRunning ? "Pause animation" : isPaused ? "Resume animation" : "Run algorithm"
						}
					>
						{isRunning ? (
							<>
								<PauseIcon aria-hidden="true" />
								Pause
							</>
						) : isPaused ? (
							<>
								<PlayIcon aria-hidden="true" />
								Resume
							</>
						) : (
							<>
								<PlayIcon aria-hidden="true" />
								Run
							</>
						)}
					</Button>

					{/* Step button */}
					<Button
						variant="outline"
						size="sm"
						onClick={handleStep}
						disabled={isDone}
						aria-label="Step forward one step"
					>
						<SkipForwardIcon aria-hidden="true" />
						Step
					</Button>

					{/* Reset button */}
					<Button variant="outline" size="sm" onClick={handleReset} aria-label="Reset grid">
						<RotateCcwIcon aria-hidden="true" />
						Reset
					</Button>

					{/* Clear path button */}
					<Button
						variant="ghost"
						size="sm"
						onClick={handleClearPath}
						aria-label="Clear path overlay"
					>
						<Trash2Icon aria-hidden="true" />
						Clear path
					</Button>

					{/* Speed slider */}
					<div className="flex min-w-28 flex-1 items-center gap-2">
						<span className="text-muted-foreground text-xs" aria-hidden="true">
							Speed
						</span>
						<Slider
							value={[speed]}
							min={MIN_SPEED}
							max={MAX_SPEED}
							step={1}
							onValueChange={handleSpeedChange}
							aria-label="Animation speed"
							className="flex-1"
						/>
						<span className="text-muted-foreground w-4 text-right text-xs" aria-hidden="true">
							{speed}
						</span>
					</div>
				</Toolbar>

				{/* Main content area: canvas + side panels */}
				<div
					className="flex flex-col gap-4 lg:flex-row"
					onPointerUp={handlePointerUp}
					onPointerLeave={handlePointerUp}
				>
					{/* Canvas */}
					<div className="flex-1 overflow-auto">
						<PathfindingCanvas
							grid={grid}
							trace={result?.trace ?? []}
							cursor={player.cursor}
							cellSize={CELL_SIZE}
							onCellClick={handleCellClick}
							onStartDrag={handleStartDrag}
							onEndDrag={handleEndDrag}
							onWeightCycle={handleWeightCycle}
						/>
					</div>

					{/* Side panels */}
					<div className="flex w-full flex-col gap-3 lg:w-64">
						{/* Algorithm controls */}
						<ControlPanel title="Algorithm">
							<div className="flex flex-col gap-3">
								{/* Algorithm select */}
								<div className="flex flex-col gap-1.5">
									<label htmlFor="algorithm-select" className="text-muted-foreground text-xs">
										Algorithm
									</label>
									<Select value={algorithm} onValueChange={handleAlgorithmChange}>
										<SelectTrigger
											id="algorithm-select"
											aria-label="Select pathfinding algorithm"
											className="w-full"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{Object.entries(ALGORITHM_REGISTRY).map(([key, entry]) => (
												<SelectItem key={key} value={key}>
													{entry.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								{/* Diagonal toggle */}
								<label className="flex cursor-pointer items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={diagonal}
										onChange={handleDiagonalChange}
										className="accent-primary h-4 w-4"
										aria-label="Allow diagonal movement"
									/>
									<span>Diagonal movement</span>
								</label>
							</div>
						</ControlPanel>

						{/* Brush controls */}
						<ControlPanel title="Brush">
							<div className="flex flex-wrap gap-1.5">
								<Button
									variant={brush === BRUSH_MODE.WALL ? "default" : "outline"}
									size="sm"
									onClick={() => setBrush(BRUSH_MODE.WALL)}
									aria-label="Wall brush"
									aria-pressed={brush === BRUSH_MODE.WALL}
								>
									<BrickWallIcon aria-hidden="true" />
									Wall
								</Button>
								<Button
									variant={brush === BRUSH_MODE.ERASE ? "default" : "outline"}
									size="sm"
									onClick={() => setBrush(BRUSH_MODE.ERASE)}
									aria-label="Erase brush"
									aria-pressed={brush === BRUSH_MODE.ERASE}
								>
									<EraserIcon aria-hidden="true" />
									Erase
								</Button>
								<Button
									variant={brush === BRUSH_MODE.WEIGHT ? "default" : "outline"}
									size="sm"
									onClick={() => setBrush(BRUSH_MODE.WEIGHT)}
									aria-label="Weight brush"
									aria-pressed={brush === BRUSH_MODE.WEIGHT}
								>
									<WeightIcon aria-hidden="true" />
									Weight
								</Button>
							</div>
						</ControlPanel>

						{/* Maze generation */}
						<ControlPanel title="Grid">
							<Button
								variant="outline"
								size="sm"
								onClick={handleGenerateMaze}
								aria-label="Generate random maze"
							>
								<ShuffleIcon aria-hidden="true" />
								Generate maze
							</Button>
						</ControlPanel>

						{/* Metrics */}
						<ControlPanel title="Run info">
							<MetricsPanel />
						</ControlPanel>

						{/* Pseudocode */}
						<ControlPanel title="Pseudocode">
							<PseudocodePanel />
						</ControlPanel>
					</div>
				</div>
			</TabsContent>

			{/* Sorting tab — placeholder (coming soon) */}
			<TabsContent value="sorting">
				<div className="text-muted-foreground flex min-h-48 items-center justify-center text-sm">
					Sorting visualizer coming soon.
				</div>
			</TabsContent>
		</Tabs>
	)
}
