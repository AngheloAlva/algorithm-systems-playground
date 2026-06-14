"use client"

/**
 * SortingVisualizer — the "use client" island for the sorting tab.
 *
 * Owns:
 *  - useSortingStore hook
 *  - useStepPlayer integration (rAF-driven animation cursor)
 *  - SortingCanvas wiring (bar chart renderer)
 *  - Controls (algorithm select, array length slider, array mode select,
 *    play/pause/step/reset, speed control, generate button)
 *  - Inline metrics display (comparisons, swaps)
 *  - Pseudocode panel (inline — mirrors PseudocodePanel pattern)
 *  - ARIA live region for sort completion and array generation
 *  - URL sync (useSearchParams read on mount, router.replace on change)
 *
 * ## Playback wiring (spec §7, §3)
 * useStepPlayer({ length: traceResult?.steps.length ?? 0, speed, onAdvance: setCursor })
 * — exactly the same pattern as the pathfinding island.
 *
 * ## Run button semantics (spec §7.1)
 * If traceResult is null, Play first calls run() then starts playback.
 *
 * ## URL sync
 * Config (algorithm, speed, arrayLength, arrayMode) is read from URL on mount
 * and written on change. arrayLength slider writes are debounced 300ms.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { SORT_STEP_KIND } from "@/lib/algorithms/sorting/types"
import { useRouter, useSearchParams } from "next/navigation"
import { useShallow } from "zustand/react/shallow"

import {
	useSortingStore,
	SORTING_RUN_STATUS,
	selectSortingActiveLine,
	selectSortingMetrics,
} from "@/store/sorting-store"
import { applyStep, replayTo } from "@/lib/algorithms/sorting/replay-state"
import { SORT_ALGORITHM_REGISTRY } from "@/lib/algorithms/sorting/index"
import type { SortAlgorithm } from "@/lib/algorithms/sorting/index"
import { ARRAY_MODE, MIN_ARRAY_LENGTH, MAX_ARRAY_LENGTH } from "@/lib/algorithms/sorting/array-gen"
import type { ArrayMode } from "@/lib/algorithms/sorting/array-gen"
import { sortingCodec } from "@/lib/url-state/sorting-codec"
import { MIN_SPEED, MAX_SPEED } from "@/lib/animation/speed-config"
import { useStepPlayer, PLAYER_STATUS } from "@/hooks/useStepPlayer"

import { SortingCanvas } from "@/components/canvas/SortingCanvas"
import { ControlPanel } from "@/components/controls/control-panel"
import { Toolbar } from "@/components/controls/toolbar"

import { Button } from "@/components/ui/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"

import { PlayIcon, PauseIcon, SkipForwardIcon, RotateCcwIcon, ShuffleIcon } from "lucide-react"

// ---------------------------------------------------------------------------
// Pending-action constants (module-level so effects can reference them stably)
// ---------------------------------------------------------------------------

const PENDING_NONE = 0 as const
const PENDING_PLAY = 1 as const
const PENDING_STEP = 2 as const

// ---------------------------------------------------------------------------
// Array mode display labels
// ---------------------------------------------------------------------------

const ARRAY_MODE_LABELS: Record<ArrayMode, string> = {
	random: "Random",
	sorted: "Sorted",
	reversed: "Reversed",
	"few-unique": "Few Unique",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SortingVisualizer() {
	const router = useRouter()
	const searchParams = useSearchParams()

	// -------------------------------------------------------------------------
	// Store slices (narrow subscriptions)
	// -------------------------------------------------------------------------

	const {
		algorithm,
		speed,
		arrayLength,
		arrayMode,
		status,
		setAlgorithm,
		setSpeed,
		setArrayLength,
		setArrayMode,
		run,
		resetRun,
		generateArray,
		setCursor,
		setStatus,
	} = useSortingStore(
		useShallow((s) => ({
			algorithm: s.algorithm,
			speed: s.speed,
			arrayLength: s.arrayLength,
			arrayMode: s.arrayMode,
			status: s.status,
			setAlgorithm: s.setAlgorithm,
			setSpeed: s.setSpeed,
			setArrayLength: s.setArrayLength,
			setArrayMode: s.setArrayMode,
			run: s.run,
			resetRun: s.resetRun,
			generateArray: s.generateArray,
			setCursor: s.setCursor,
			setStatus: s.setStatus,
		}))
	)

	// Access arr, traceResult separately to avoid over-subscribing
	const arr = useSortingStore((s) => s.arr)
	const traceResult = useSortingStore((s) => s.traceResult)
	const activeLine = useSortingStore(selectSortingActiveLine)
	const metrics = useSortingStore(selectSortingMetrics)
	const cursor = useSortingStore((s) => s.cursor)

	// -------------------------------------------------------------------------
	// FIX 1 + FIX 3: Incremental replay state and metrics
	//
	// displayArr: the array at the current cursor position (React state so
	//   the canvas re-renders when it changes).
	// liveComparisons / liveSwaps: incremental counters (React state, no O(n)
	//   slice().filter() per frame).
	//
	// workingArrRef: mutable copy updated step-by-step; only accessed inside
	//   the useEffect (never during render — satisfies react-hooks/refs).
	// traceRefKey / prevCursorRef: bookkeeping refs, also effect-only.
	// -------------------------------------------------------------------------

	const [displayArr, setDisplayArr] = useState<ReadonlyArray<number>>(arr)
	const [liveComparisons, setLiveComparisons] = useState(0)
	const [liveSwaps, setLiveSwaps] = useState(0)

	// Mutable working state — only read/written inside the effect below
	const workingArrRef = useRef<number[]>([...arr])
	const traceRefKey = useRef<typeof traceResult>(null)
	const prevCursorRef = useRef<number>(0)
	const liveComparisonsRef = useRef<number>(0)
	const liveSwapsRef = useRef<number>(0)

	// Keep arr ref stable for the effect (avoids stale closure on arr changes).
	// Updated via useLayoutEffect before browser paint (same pattern as useStepPlayer).
	const arrRef = useRef<ReadonlyArray<number>>(arr)
	useLayoutEffect(() => {
		arrRef.current = arr
	})

	useEffect(() => {
		if (traceResult === null) {
			// No trace — display original array
			setDisplayArr(arrRef.current)
			setLiveComparisons(0)
			setLiveSwaps(0)
			workingArrRef.current = [...arrRef.current]
			traceRefKey.current = null
			prevCursorRef.current = 0
			liveComparisonsRef.current = 0
			liveSwapsRef.current = 0
			return
		}

		if (traceResult !== traceRefKey.current || cursor < prevCursorRef.current) {
			// New trace OR cursor moved backwards — full rebuild
			const rebuilt = replayTo(arrRef.current, traceResult.steps, cursor)
			workingArrRef.current = rebuilt
			traceRefKey.current = traceResult
			prevCursorRef.current = cursor
			// Recount metrics up to current cursor
			let c = 0
			let s = 0
			for (let i = 0; i <= Math.min(cursor, traceResult.steps.length - 1); i++) {
				const k = traceResult.steps[i].kind
				if (k === SORT_STEP_KIND.COMPARE) c++
				else if (k === SORT_STEP_KIND.SWAP) s++
			}
			liveComparisonsRef.current = c
			liveSwapsRef.current = s
			setDisplayArr([...workingArrRef.current])
			setLiveComparisons(c)
			setLiveSwaps(s)
		} else {
			// Cursor advanced forward — apply only the new steps
			const from = prevCursorRef.current + 1
			const to = Math.min(cursor, traceResult.steps.length - 1)
			for (let i = from; i <= to; i++) {
				applyStep(workingArrRef.current, traceResult.steps[i])
				const k = traceResult.steps[i].kind
				if (k === SORT_STEP_KIND.COMPARE) liveComparisonsRef.current++
				else if (k === SORT_STEP_KIND.SWAP) liveSwapsRef.current++
			}
			prevCursorRef.current = cursor
			setDisplayArr([...workingArrRef.current])
			setLiveComparisons(liveComparisonsRef.current)
			setLiveSwaps(liveSwapsRef.current)
		}
		// No cleanup here — cleanup fires before EVERY re-run (not just unmount).
		// Unmount-only reset is in the dedicated empty-deps effect below.
	}, [cursor, traceResult])

	// -------------------------------------------------------------------------
	// URL sync — read on mount
	// -------------------------------------------------------------------------

	const urlSyncedRef = useRef(false)

	useEffect(() => {
		if (urlSyncedRef.current) return
		urlSyncedRef.current = true

		const decoded = sortingCodec.decode(searchParams)
		if (decoded.algorithm !== algorithm) setAlgorithm(decoded.algorithm as SortAlgorithm)
		if (decoded.speed !== speed) setSpeed(decoded.speed)
		if (decoded.arrayLength !== arrayLength) setArrayLength(decoded.arrayLength)
		if (decoded.arrayMode !== arrayMode) setArrayMode(decoded.arrayMode as ArrayMode)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// URL sync — write on config change, debounced for arrayLength
	const arrayLengthDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const syncUrl = useCallback(
		(overrides?: {
			algorithm?: SortAlgorithm
			speed?: number
			arrayLength?: number
			arrayMode?: ArrayMode
		}) => {
			const current = {
				algorithm: overrides?.algorithm ?? algorithm,
				speed: overrides?.speed ?? speed,
				arrayLength: overrides?.arrayLength ?? arrayLength,
				arrayMode: overrides?.arrayMode ?? arrayMode,
			}
			const params = sortingCodec.encode(current)
			const qs = params.toString()
			router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
		},
		[algorithm, speed, arrayLength, arrayMode, router]
	)

	// Cleanup debounce on unmount
	useEffect(() => {
		return () => {
			if (arrayLengthDebounceRef.current) clearTimeout(arrayLengthDebounceRef.current)
		}
	}, [])

	// -------------------------------------------------------------------------
	// pendingPlayRef — replaces setTimeout(0) race
	// -------------------------------------------------------------------------

	const pendingActionRef = useRef<0 | 1 | 2>(PENDING_NONE)

	// -------------------------------------------------------------------------
	// useStepPlayer integration
	// -------------------------------------------------------------------------

	const traceLength = traceResult?.steps.length ?? 0

	const onAdvance = useCallback(
		(newCursor: number) => {
			setCursor(newCursor)
		},
		[setCursor]
	)

	const player = useStepPlayer({ length: traceLength, speed, onAdvance })

	// Destructure player for stable references in effects and handlers (avoids
	// exhaustive-deps warnings from accessing properties via the `player` binding;
	// all of these are useCallback-stable from useStepPlayer).
	const {
		status: playerStatus,
		pause: playerPause,
		seek: playerSeek,
		play: playerPlay,
		step: playerStep,
		reset: playerReset,
	} = player

	// Sync player stop → store status
	// playerPause is useCallback-stable from useStepPlayer; all deps are explicit.
	useEffect(() => {
		if (status === SORTING_RUN_STATUS.IDLE || status === SORTING_RUN_STATUS.DONE) {
			if (playerStatus === PLAYER_STATUS.PLAYING) {
				playerPause()
			}
		}
	}, [status, playerStatus, playerPause])

	// Mirror player done → store done
	useEffect(() => {
		if (
			playerStatus === PLAYER_STATUS.DONE &&
			(status === SORTING_RUN_STATUS.RUNNING || status === SORTING_RUN_STATUS.PAUSED)
		) {
			setStatus(SORTING_RUN_STATUS.DONE)
		}
	}, [playerStatus, status, setStatus])

	// Consume pendingActionRef once traceResult is committed.
	// For PENDING_STEP: seek(0) IS the first step (frame 0 = steps[0] applied).
	// Do NOT call player.step() on top — that would land on cursor 1, skipping frame 0.
	// For traces with steps.length <= 1 (trivial/1-element arrays): skip play/step
	// and resolve directly to DONE to avoid the player no-oping on an already-DONE cursor.
	useEffect(() => {
		if (traceResult === null) return
		const pending = pendingActionRef.current
		if (pending === PENDING_NONE) return
		// Guard: clear before acting to prevent re-entrant triggers
		pendingActionRef.current = PENDING_NONE

		// Trivial trace: resolve immediately to DONE without starting the player
		if (traceResult.steps.length <= 1) {
			playerSeek(0)
			setStatus(SORTING_RUN_STATUS.DONE)
			return
		}

		playerSeek(0)
		if (pending === PENDING_PLAY) {
			playerPlay()
			setStatus(SORTING_RUN_STATUS.RUNNING)
		} else {
			// PENDING_STEP: seek(0) already positioned at frame 0 — done.
			setStatus(SORTING_RUN_STATUS.PAUSED)
		}
		// No cleanup here — cleanup fires before EVERY re-run (not just unmount).
		// Unmount-only reset is in the dedicated empty-deps effect below.
	}, [traceResult, playerSeek, playerPlay, setStatus])

	// -------------------------------------------------------------------------
	// Unmount-only cleanup: reset replay bookkeeping refs and pending flag.
	// This MUST use empty deps so it fires only on unmount — never mid-life.
	// The replay effect (deps [cursor, traceResult]) intentionally has no cleanup
	// so the incremental optimization survives across cursor ticks.
	// -------------------------------------------------------------------------

	useEffect(() => {
		return () => {
			traceRefKey.current = null
			prevCursorRef.current = 0
			pendingActionRef.current = PENDING_NONE
		}
	}, [])

	// -------------------------------------------------------------------------
	// ARIA live region for sort completion and array generation (FIX 4)
	// -------------------------------------------------------------------------

	// Transient announcements for generate-array action
	const [generateText, setGenerateText] = useState("")

	// liveText is assembled after isDone is computed (see below in "Derived state")

	// -------------------------------------------------------------------------
	// Run button handler
	// -------------------------------------------------------------------------

	const handleRun = useCallback(() => {
		if (status === SORTING_RUN_STATUS.RUNNING || playerStatus === PLAYER_STATUS.PLAYING) {
			playerPause()
			setStatus(SORTING_RUN_STATUS.PAUSED)
			return
		}

		if (playerStatus === PLAYER_STATUS.PAUSED) {
			playerPlay()
			setStatus(SORTING_RUN_STATUS.RUNNING)
			return
		}

		// Guard: if already pending, ignore re-entrant click
		if (pendingActionRef.current !== PENDING_NONE) return

		// Fresh run — set pending flag, then call run() + setCursor(0).
		// Calling setCursor(0) here (in the same event handler) lets React batch
		// both state updates into one render so the replay effect never sees the
		// store's trailing cursor=steps.length-1 before the pending effect seeks to 0.
		pendingActionRef.current = PENDING_PLAY
		playerReset()
		run()
		setCursor(0)
	}, [status, playerStatus, playerPause, playerPlay, playerReset, run, setCursor, setStatus])

	const handleStep = useCallback(() => {
		if (status === SORTING_RUN_STATUS.IDLE) {
			// Guard: if already pending, ignore re-entrant click
			if (pendingActionRef.current !== PENDING_NONE) return
			pendingActionRef.current = PENDING_STEP
			run()
			setCursor(0)
			return
		}
		playerStep()
		setStatus(SORTING_RUN_STATUS.PAUSED)
	}, [status, run, setCursor, playerStep, setStatus])

	const handleReset = useCallback(() => {
		pendingActionRef.current = PENDING_NONE
		playerReset()
		resetRun()
	}, [playerReset, resetRun])

	const handleGenerate = useCallback(() => {
		pendingActionRef.current = PENDING_NONE
		playerReset()
		generateArray()
		setGenerateText(`New array generated. Length: ${arrayLength}.`)
	}, [playerReset, generateArray, arrayLength])

	// -------------------------------------------------------------------------
	// Config change handlers with URL sync
	// -------------------------------------------------------------------------

	const handleAlgorithmChange = useCallback(
		(value: SortAlgorithm | null) => {
			if (!value) return
			setAlgorithm(value)
			syncUrl({ algorithm: value })
		},
		[setAlgorithm, syncUrl]
	)

	const handleArrayModeChange = useCallback(
		(value: ArrayMode | null) => {
			if (!value) return
			setArrayMode(value)
			syncUrl({ arrayMode: value })
		},
		[setArrayMode, syncUrl]
	)

	const handleArrayLengthChange = useCallback(
		(value: number | readonly number[]) => {
			const arr2 = Array.isArray(value) ? value : [value]
			const len = (arr2 as number[])[0] ?? arrayLength
			setArrayLength(len)
			// Debounce URL write for slider
			if (arrayLengthDebounceRef.current) clearTimeout(arrayLengthDebounceRef.current)
			arrayLengthDebounceRef.current = setTimeout(() => {
				syncUrl({ arrayLength: len })
			}, 300)
		},
		[setArrayLength, syncUrl, arrayLength]
	)

	const handleSpeedChange = useCallback(
		(value: number | readonly number[]) => {
			const arr2 = Array.isArray(value) ? value : [value]
			const spd = (arr2 as number[])[0] ?? speed
			setSpeed(spd)
			syncUrl({ speed: spd })
		},
		[setSpeed, syncUrl, speed]
	)

	// -------------------------------------------------------------------------
	// Derived state
	// -------------------------------------------------------------------------

	const isRunning = status === SORTING_RUN_STATUS.RUNNING || playerStatus === PLAYER_STATUS.PLAYING
	const isPaused = status === SORTING_RUN_STATUS.PAUSED || playerStatus === PLAYER_STATUS.PAUSED
	const isDone = status === SORTING_RUN_STATUS.DONE && playerStatus === PLAYER_STATUS.DONE

	// Current step for canvas highlight
	const currentStep = traceResult?.steps[cursor] ?? null

	// Status description for canvas aria-label
	const stepTotal = traceResult?.steps.length ?? 0
	const statusDescription = isDone
		? "done"
		: isRunning
			? `running, step ${cursor + 1} of ${stepTotal}`
			: isPaused
				? `paused at step ${cursor + 1} of ${stepTotal}`
				: "idle"

	// Algorithm pseudocode
	const { pseudocode, label: algoLabel } = SORT_ALGORITHM_REGISTRY[algorithm]

	// liveComparisons and liveSwaps are React state — updated incrementally
	// by the replay effect above (FIX 3: no O(steps) slice().filter() per render).

	// FIX 4: Single live text — derived completion text (no setState-in-effect) plus
	// transient generation announcement from handleGenerate.
	const completionText =
		isDone && metrics !== null
			? `${algoLabel} completed. ${metrics.comparisons} comparisons, ${metrics.swaps} swaps.`
			: ""
	const liveText = completionText || generateText

	// -------------------------------------------------------------------------
	// Render
	// -------------------------------------------------------------------------

	return (
		<div className="flex flex-col gap-4">
			{/* ARIA live region — outside canvas, always polite */}
			<span aria-live="polite" aria-atomic="true" className="sr-only">
				{liveText}
			</span>

			{/* Toolbar */}
			<Toolbar className="flex-wrap gap-3">
				{/* Play / Pause button */}
				<Button
					variant={isRunning ? "outline" : "default"}
					size="sm"
					onClick={handleRun}
					aria-label={
						isRunning ? "Pause animation" : isPaused ? "Resume animation" : "Run sort"
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
				<Button
					variant="outline"
					size="sm"
					onClick={handleReset}
					aria-label="Reset animation"
				>
					<RotateCcwIcon aria-hidden="true" />
					Reset
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
			<div className="flex flex-col gap-4 lg:flex-row">
				{/* Canvas */}
				<div className="flex-1 overflow-auto">
					<div className="bg-muted/20 border-border min-h-64 rounded-md border" style={{ height: 320 }}>
						<SortingCanvas
							arr={displayArr}
							currentStep={currentStep}
							status={statusDescription}
							className="h-full w-full"
						/>
					</div>
				</div>

				{/* Side panels */}
				<div className="flex w-full flex-col gap-3 lg:w-64">
					{/* Algorithm controls */}
					<ControlPanel title="Algorithm">
						<div className="flex flex-col gap-3">
							{/* Algorithm select */}
							<div className="flex flex-col gap-1.5">
								<label
									htmlFor="sort-algorithm-select"
									className="text-muted-foreground text-xs"
								>
									Algorithm
								</label>
								<Select value={algorithm} onValueChange={handleAlgorithmChange}>
									<SelectTrigger
										id="sort-algorithm-select"
										aria-label="Select sorting algorithm"
										className="w-full"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(SORT_ALGORITHM_REGISTRY).map(([key, entry]) => (
											<SelectItem key={key} value={key}>
												{entry.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					</ControlPanel>

					{/* Array controls */}
					<ControlPanel title="Array">
						<div className="flex flex-col gap-3">
							{/* Array length slider */}
							<div className="flex flex-col gap-1.5">
								{/* aria-label on Slider is forwarded to the thumb input (WCAG 4.1.2).
								    The visible text is decorative only — do not use htmlFor since
								    the Slider Root is a <div>, not the <input type="range">. */}
								<span
									className="text-muted-foreground text-xs"
									aria-hidden="true"
								>
									Length: {arrayLength}
								</span>
								<Slider
									value={[arrayLength]}
									min={MIN_ARRAY_LENGTH}
									max={MAX_ARRAY_LENGTH}
									step={1}
									onValueChange={handleArrayLengthChange}
									aria-label="Array length"
								/>
							</div>

							{/* Array mode select */}
							<div className="flex flex-col gap-1.5">
								<label
									htmlFor="sort-array-mode"
									className="text-muted-foreground text-xs"
								>
									Mode
								</label>
								<Select value={arrayMode} onValueChange={handleArrayModeChange}>
									<SelectTrigger
										id="sort-array-mode"
										aria-label="Select array mode"
										className="w-full"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(ARRAY_MODE).map(([key, value]) => (
											<SelectItem key={key} value={value}>
												{ARRAY_MODE_LABELS[value]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Generate button */}
							<Button
								variant="outline"
								size="sm"
								onClick={handleGenerate}
								aria-label="Generate new array"
							>
								<ShuffleIcon aria-hidden="true" />
								Generate array
							</Button>
						</div>
					</ControlPanel>

					{/* Metrics (FIX 4: no aria-live here — all announcements go through the single liveText region) */}
					<ControlPanel title="Metrics">
						<div className="flex flex-col gap-2">
							<dl className="grid grid-cols-3 gap-2 text-sm">
								<div className="flex flex-col gap-0.5">
									<dt className="text-muted-foreground text-xs">Comparisons</dt>
									<dd className="text-foreground font-mono font-semibold">
										{traceResult !== null ? liveComparisons : "—"}
									</dd>
								</div>
								<div className="flex flex-col gap-0.5">
									<dt className="text-muted-foreground text-xs">Swaps</dt>
									<dd className="text-foreground font-mono font-semibold">
										{traceResult !== null ? liveSwaps : "—"}
									</dd>
								</div>
								<div className="flex flex-col gap-0.5">
									<dt className="text-muted-foreground text-xs">Length</dt>
									<dd className="text-foreground font-mono font-semibold">
										{arr.length}
									</dd>
								</div>
							</dl>
						</div>
					</ControlPanel>

					{/* Pseudocode panel (inline — no extraction needed per spec §7.3) */}
					<ControlPanel title="Pseudocode">
						<div className="flex flex-col gap-2">
							<h3 className="text-card-foreground text-xs font-semibold uppercase tracking-wider">
								{algoLabel} pseudocode
							</h3>
							{/* role="region" + aria-label wraps the scroll container so AT announces it as a
								    named landmark. tabIndex enables keyboard scroll (WCAG 2.1.1). The inner <ol>
								    retains its implicit list role so <li> items remain valid list children.
								    role="region" MUST NOT be on <ol> directly — that would invalidate <li> items. */}
							<div
								role="region"
								aria-label={`${algoLabel} pseudocode`}
								tabIndex={0}
								className="border-border bg-muted/30 max-h-48 overflow-y-auto rounded-md border p-2"
							>
								<ol>
									{pseudocode.map((line) => {
										const isActive = line.id === activeLine
										return (
											<li
												key={line.id}
												aria-current={isActive ? "step" : undefined}
												className={[
													"rounded px-2 py-0.5 font-mono text-xs transition-colors",
													isActive
														? "bg-primary/15 text-primary font-semibold"
														: "text-muted-foreground",
												].join(" ")}
											>
												{line.text}
											</li>
										)
									})}
								</ol>
							</div>
						</div>
					</ControlPanel>
				</div>
			</div>
		</div>
	)
}
