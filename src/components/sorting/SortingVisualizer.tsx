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

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useShallow } from "zustand/react/shallow"

import {
	useSortingStore,
	SORTING_RUN_STATUS,
	selectSortingActiveLine,
	selectSortingMetrics,
} from "@/store/sorting-store"
import { SORT_ALGORITHM, SORT_ALGORITHM_REGISTRY } from "@/lib/algorithms/sorting/index"
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

	// Sync player stop → store status
	useEffect(() => {
		if (status === SORTING_RUN_STATUS.IDLE || status === SORTING_RUN_STATUS.DONE) {
			if (player.status === PLAYER_STATUS.PLAYING) {
				player.pause()
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status])

	// Mirror player done → store done
	useEffect(() => {
		if (
			player.status === PLAYER_STATUS.DONE &&
			(status === SORTING_RUN_STATUS.RUNNING || status === SORTING_RUN_STATUS.PAUSED)
		) {
			setStatus(SORTING_RUN_STATUS.DONE)
		}
	}, [player.status, status, setStatus])

	// -------------------------------------------------------------------------
	// ARIA live region for sort completion and array generation
	// -------------------------------------------------------------------------

	const [liveText, setLiveText] = useState("")

	// Announce on sort completion
	useEffect(() => {
		if (
			status === SORTING_RUN_STATUS.DONE &&
			player.status === PLAYER_STATUS.DONE &&
			metrics !== null
		) {
			const algoLabel = SORT_ALGORITHM_REGISTRY[algorithm].label
			setLiveText(
				`${algoLabel} completed. ${metrics.comparisons} comparisons, ${metrics.swaps} swaps.`
			)
		}
	}, [status, player.status, metrics, algorithm])

	// -------------------------------------------------------------------------
	// Run button handler
	// -------------------------------------------------------------------------

	const handleRun = useCallback(() => {
		if (status === SORTING_RUN_STATUS.RUNNING || player.status === PLAYER_STATUS.PLAYING) {
			player.pause()
			setStatus(SORTING_RUN_STATUS.PAUSED)
			return
		}

		if (player.status === PLAYER_STATUS.PAUSED) {
			player.play()
			setStatus(SORTING_RUN_STATUS.RUNNING)
			return
		}

		// Fresh run — compute trace, seek player to 0, then play
		run()
		player.reset()
		setTimeout(() => {
			player.seek(0)
			player.play()
			setStatus(SORTING_RUN_STATUS.RUNNING)
		}, 0)
	}, [status, player, run, setStatus])

	const handleStep = useCallback(() => {
		if (status === SORTING_RUN_STATUS.IDLE) {
			run()
			setTimeout(() => {
				player.seek(0)
				player.step()
				setStatus(SORTING_RUN_STATUS.PAUSED)
			}, 0)
			return
		}
		player.step()
		setStatus(SORTING_RUN_STATUS.PAUSED)
	}, [status, run, player, setStatus])

	const handleReset = useCallback(() => {
		player.reset()
		resetRun()
	}, [player, resetRun])

	const handleGenerate = useCallback(() => {
		player.reset()
		generateArray()
		setLiveText(`New array generated. Length: ${arrayLength}.`)
	}, [player, generateArray, arrayLength])

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

	const isRunning = status === SORTING_RUN_STATUS.RUNNING || player.status === PLAYER_STATUS.PLAYING
	const isPaused = status === SORTING_RUN_STATUS.PAUSED || player.status === PLAYER_STATUS.PAUSED
	const isDone = status === SORTING_RUN_STATUS.DONE && player.status === PLAYER_STATUS.DONE

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

	// Live metrics derived from current cursor position
	// Count comparisons and swaps up to the current cursor
	const liveComparisons = traceResult
		? traceResult.steps.slice(0, cursor + 1).filter((s) => s.kind === "compare").length
		: 0
	const liveSwaps = traceResult
		? traceResult.steps.slice(0, cursor + 1).filter((s) => s.kind === "swap").length
		: 0

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
							arr={arr}
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
								<label
									htmlFor="sort-array-length"
									className="text-muted-foreground text-xs"
								>
									Length: {arrayLength}
								</label>
								<Slider
									id="sort-array-length"
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

					{/* Metrics */}
					<ControlPanel title="Metrics">
						<div className="flex flex-col gap-2">
							{/* ARIA live region for completion announcement */}
							<div
								role="status"
								aria-live="polite"
								aria-atomic="true"
								className="sr-only"
							>
								{isDone && metrics !== null
									? `${algoLabel} completed. ${metrics.comparisons} comparisons, ${metrics.swaps} swaps.`
									: ""}
							</div>

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
							<ol
								className="border-border bg-muted/30 max-h-48 overflow-y-auto rounded-md border p-2"
								aria-label={`${algoLabel} pseudocode`}
							>
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
					</ControlPanel>
				</div>
			</div>
		</div>
	)
}
