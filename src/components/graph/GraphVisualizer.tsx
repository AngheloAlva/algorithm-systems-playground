"use client"

/**
 * GraphVisualizer — the "use client" island for the graph editor + traversal tab.
 *
 * Assembles:
 *  - GraphCanvas (two-layer canvas + pointer FSM)
 *  - Edit-mode toolbar (SELECT, ADD_NODE, ADD_EDGE, MOVE_NODE, DELETE, SET_START)
 *  - Algorithm selector (BFS, DFS) from GRAPH_ALGORITHM_REGISTRY
 *  - Directed toggle + Load Sample + Clear buttons
 *  - Playback controls (play/pause/step/reset via useStepPlayer) + speed slider
 *  - Inline pseudocode panel (highlighted line at cursor)
 *  - Inline metrics panel (visitedCount, traversalOrder.length)
 *  - No-start-node warning (when status === "no-start-node")
 *  - URL sync (algorithm + speed round-trip via graphCodec)
 *
 * ## Playback wiring (mirrors SortingVisualizer)
 * useStepPlayer({ length: result?.steps.length ?? 0, speed, onAdvance: setCursor })
 *
 * ## No-start-node warning (G10.5, G10-A)
 * When status === "no-start-node", shows: "Select a start node to run this algorithm."
 * The run button is disabled.
 *
 * @see design §6, spec G10
 */

import { useCallback, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useShallow } from "zustand/react/shallow"

import {
	useGraphStore,
	selectGraphActiveLine,
	selectGraphMetrics,
	RUN_STATUS,
} from "@/store/graph-store"
import { GRAPH_ALGORITHM_REGISTRY } from "@/lib/algorithms/graph/index"
import type { GraphAlgorithm } from "@/lib/algorithms/graph/index"
import { EDIT_MODE } from "@/lib/graph/types"
import { graphCodec } from "@/lib/url-state/graph-codec"
import { MIN_SPEED, MAX_SPEED } from "@/lib/animation/speed-config"
import { useStepPlayer, PLAYER_STATUS } from "@/hooks/useStepPlayer"

import { GraphCanvas } from "@/components/canvas/GraphCanvas"
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
import {
	PlayIcon,
	PauseIcon,
	SkipForwardIcon,
	RotateCcwIcon,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Edit-mode toolbar button labels + aria info
// ---------------------------------------------------------------------------

const EDIT_MODE_LABELS: Record<string, string> = {
	[EDIT_MODE.SELECT]: "Select",
	[EDIT_MODE.ADD_NODE]: "Add Node",
	[EDIT_MODE.ADD_EDGE]: "Add Edge",
	[EDIT_MODE.MOVE_NODE]: "Move Node",
	[EDIT_MODE.DELETE]: "Delete",
	[EDIT_MODE.SET_START]: "Set Start",
}

const EDIT_MODE_ORDER = [
	EDIT_MODE.SELECT,
	EDIT_MODE.ADD_NODE,
	EDIT_MODE.ADD_EDGE,
	EDIT_MODE.MOVE_NODE,
	EDIT_MODE.DELETE,
	EDIT_MODE.SET_START,
] as const

// ---------------------------------------------------------------------------
// Pending-action constants (same pattern as SortingVisualizer)
// ---------------------------------------------------------------------------

const PENDING_NONE = 0 as const
const PENDING_PLAY = 1 as const
const PENDING_STEP = 2 as const

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphVisualizer() {
	const router = useRouter()
	const searchParams = useSearchParams()

	// -------------------------------------------------------------------------
	// Store slices (narrow subscriptions)
	// -------------------------------------------------------------------------

	const {
		algorithm,
		speed,
		status,
		editMode,
		graph,
		setAlgorithm,
		setSpeed,
		setEditMode,
		setDirected,
		loadSampleGraph,
		clearAll,
		run,
		setCursor,
		setStatus,
	} = useGraphStore(
		useShallow((s) => ({
			algorithm: s.algorithm,
			speed: s.speed,
			status: s.status,
			editMode: s.editMode,
			graph: s.graph,
			setAlgorithm: s.setAlgorithm,
			setSpeed: s.setSpeed,
			setEditMode: s.setEditMode,
			setDirected: s.setDirected,
			loadSampleGraph: s.loadSampleGraph,
			clearAll: s.clearAll,
			run: s.run,
			setCursor: s.setCursor,
			setStatus: s.setStatus,
		}))
	)

	const result = useGraphStore((s) => s.result)
	const activeLine = useGraphStore(selectGraphActiveLine)
	const metrics = useGraphStore(selectGraphMetrics)

	// -------------------------------------------------------------------------
	// URL sync — read once on mount, write explicitly from change handlers
	// -------------------------------------------------------------------------

	const urlSyncedRef = useRef(false)

	useEffect(() => {
		if (urlSyncedRef.current) return
		urlSyncedRef.current = true
		const decoded = graphCodec.decode(searchParams)
		if (decoded.algorithm && GRAPH_ALGORITHM_REGISTRY[decoded.algorithm]) {
			setAlgorithm(decoded.algorithm as GraphAlgorithm)
		}
		if (decoded.speed) {
			setSpeed(decoded.speed)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const syncUrl = useCallback(
		(overrides?: { algorithm?: GraphAlgorithm; speed?: number }) => {
			const current = {
				algorithm: overrides?.algorithm ?? algorithm,
				speed: overrides?.speed ?? speed,
			}
			const params = graphCodec.encode(current)
			const qs = params.toString()
			router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
		},
		[algorithm, speed, router]
	)

	// -------------------------------------------------------------------------
	// Playback — useStepPlayer (mirrors SortingVisualizer)
	// -------------------------------------------------------------------------

	const pendingRef = useRef<typeof PENDING_NONE | typeof PENDING_PLAY | typeof PENDING_STEP>(
		PENDING_NONE
	)

	const { status: playerStatus, play, pause, step, reset, seek } = useStepPlayer({
		length: result?.steps.length ?? 0,
		speed,
		onAdvance: setCursor,
	})

	// After run() resolves a new trace: seek to 0 and play
	useEffect(() => {
		if (pendingRef.current === PENDING_PLAY && result !== null) {
			pendingRef.current = PENDING_NONE
			seek(0)
			play()
		} else if (pendingRef.current === PENDING_STEP && result !== null) {
			pendingRef.current = PENDING_NONE
			seek(0)
			step()
		}
	}, [result, seek, play, step])

	const handlePlay = useCallback(() => {
		if (status === RUN_STATUS.NO_START_NODE) return

		if (result === null) {
			pendingRef.current = PENDING_PLAY
			run()
			return
		}
		if (playerStatus === PLAYER_STATUS.DONE) {
			seek(0)
		}
		play()
		setStatus(RUN_STATUS.RUNNING)
	}, [status, result, playerStatus, run, seek, play, setStatus])

	const handlePause = useCallback(() => {
		pause()
		setStatus(RUN_STATUS.PAUSED)
	}, [pause, setStatus])

	const handleStep = useCallback(() => {
		if (status === RUN_STATUS.NO_START_NODE) return

		if (result === null) {
			pendingRef.current = PENDING_STEP
			run()
			return
		}
		step()
	}, [status, result, run, step])

	const handleReset = useCallback(() => {
		reset()
		setStatus(RUN_STATUS.IDLE)
		setCursor(0)
		useGraphStore.setState({ result: null })
	}, [reset, setStatus, setCursor])

	const handleAlgorithmChange = useCallback(
		(alg: string | null) => {
			if (!alg) return
			const next = alg as GraphAlgorithm
			setAlgorithm(next)
			reset()
			setStatus(RUN_STATUS.IDLE)
			setCursor(0)
			// Clear stale trace from the previous algorithm
			useGraphStore.setState({ result: null })
			syncUrl({ algorithm: next })
		},
		[setAlgorithm, reset, setStatus, setCursor, syncUrl]
	)

	// -------------------------------------------------------------------------
	// Derived values
	// -------------------------------------------------------------------------

	const isPlaying = playerStatus === PLAYER_STATUS.PLAYING
	const isNoStartNode = status === RUN_STATUS.NO_START_NODE
	const currentAlgorithmEntry = GRAPH_ALGORITHM_REGISTRY[algorithm]
	const pseudocode = currentAlgorithmEntry?.pseudocode ?? []

	// -------------------------------------------------------------------------
	// Render
	// -------------------------------------------------------------------------

	return (
		<div className="flex flex-1 flex-col gap-4">
			{/* No-start-node warning (G10.5, G10-A) */}
			{isNoStartNode && (
				<div
					role="alert"
					className="bg-destructive/10 border-destructive/30 text-destructive flex items-center gap-2 rounded-lg border px-4 py-2 text-sm"
				>
					<span>Select a start node to run this algorithm.</span>
					<span className="text-muted-foreground">(Switch to Set Start mode and click a node)</span>
				</div>
			)}

			<div className="flex flex-1 gap-4">
				{/* Canvas area */}
				<div className="bg-muted/10 border-border flex flex-1 flex-col overflow-hidden rounded-lg border">
					{/* Edit-mode toolbar */}
					<Toolbar className="rounded-b-none border-b">
						<span className="text-muted-foreground mr-1 text-xs font-medium">Mode:</span>
						{EDIT_MODE_ORDER.map((mode) => (
							<button
								key={mode}
								type="button"
								onClick={() => setEditMode(mode)}
								aria-pressed={editMode === mode}
								className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
									editMode === mode
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-muted hover:text-foreground"
								}`}
							>
								{EDIT_MODE_LABELS[mode]}
							</button>
						))}

						<div className="border-border mx-1 h-5 w-px border-l" />

						{/* Directed toggle */}
						<button
							type="button"
							onClick={() => setDirected(!graph.directed)}
							aria-pressed={graph.directed}
							className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
								graph.directed
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-muted hover:text-foreground"
							}`}
						>
							Directed
						</button>

						<div className="flex-1" />

						{/* Load Sample + Clear */}
						<Button variant="outline" size="sm" onClick={loadSampleGraph} className="h-7 text-xs">
							Load Sample
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={clearAll}
							className="h-7 text-xs"
						>
							Clear
						</Button>
					</Toolbar>

					{/* Canvas */}
					<GraphCanvas className="flex-1" />
				</div>

				{/* Right panel */}
				<div className="flex w-64 flex-col gap-3">
					{/* Algorithm + Playback */}
					<ControlPanel title="Algorithm">
						{/* Algorithm selector */}
						<Select
							value={algorithm}
							onValueChange={handleAlgorithmChange}
						>
							<SelectTrigger className="h-8 text-sm" aria-label="Select algorithm">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.values(GRAPH_ALGORITHM_REGISTRY).map((entry) => (
									<SelectItem key={entry.id} value={entry.id}>
										{entry.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						{/* Playback controls */}
						<div className="flex items-center gap-1">
							<Button
								size="sm"
								variant="outline"
								onClick={isPlaying ? handlePause : handlePlay}
								disabled={isNoStartNode}
								aria-label={isPlaying ? "Pause" : "Play"}
								aria-disabled={isNoStartNode}
								className="h-8 flex-1"
							>
								{isPlaying ? (
									<PauseIcon className="h-3 w-3" />
								) : (
									<PlayIcon className="h-3 w-3" />
								)}
								<span className="ml-1 text-xs">{isPlaying ? "Pause" : "Play"}</span>
							</Button>

							<Button
								size="sm"
								variant="outline"
								onClick={handleStep}
								disabled={isNoStartNode || playerStatus === PLAYER_STATUS.DONE}
								aria-label="Step"
								className="h-8"
							>
								<SkipForwardIcon className="h-3 w-3" />
							</Button>

							<Button
								size="sm"
								variant="outline"
								onClick={handleReset}
								aria-label="Reset"
								className="h-8"
							>
								<RotateCcwIcon className="h-3 w-3" />
							</Button>
						</div>

						{/* Speed slider */}
						<div className="flex flex-col gap-1">
							<span className="text-muted-foreground text-xs">Speed: {speed}</span>
							<Slider
								min={MIN_SPEED}
								max={MAX_SPEED}
								step={1}
								value={[speed]}
								onValueChange={(vals) => { const v = Array.isArray(vals) ? vals[0] : vals; const n = v as number; setSpeed(n); syncUrl({ speed: n }) }}
								aria-label="Playback speed"
								className="w-full"
							/>
						</div>
					</ControlPanel>

					{/* Metrics */}
					<ControlPanel title="Metrics">
						{metrics ? (
							<dl className="space-y-1 text-sm">
								{metrics.visitedCount !== undefined && (
									<>
										<dt className="text-muted-foreground text-xs">Visited</dt>
										<dd className="font-medium">{metrics.visitedCount}</dd>
									</>
								)}
								{metrics.traversalOrder && metrics.traversalOrder.length > 0 && (
									<>
										<dt className="text-muted-foreground text-xs">Traversal order</dt>
										<dd className="font-medium">{metrics.traversalOrder.length} nodes</dd>
									</>
								)}
								{metrics.mstWeight !== undefined && (
									<>
										<dt className="text-muted-foreground text-xs">MST weight</dt>
										<dd className="font-medium">{metrics.mstWeight}</dd>
									</>
								)}
								{metrics.mstEdgeCount !== undefined && (
									<>
										<dt className="text-muted-foreground text-xs">MST edges</dt>
										<dd className="font-medium">{metrics.mstEdgeCount}</dd>
									</>
								)}
								{metrics.cycleDetected !== undefined && (
									<>
										<dt className="text-muted-foreground text-xs">Cycle detected</dt>
										<dd className="font-medium">{metrics.cycleDetected ? "Yes" : "No"}</dd>
									</>
								)}
							</dl>
						) : (
							<p className="text-muted-foreground text-xs">Run an algorithm to see metrics.</p>
						)}
					</ControlPanel>

					{/* Pseudocode */}
					<ControlPanel title="Pseudocode" className="flex-1 overflow-auto">
						<ol className="space-y-0.5 text-xs">
							{pseudocode.map((line, idx) => (
								<li
									key={idx}
									className={`rounded px-1.5 py-0.5 font-mono transition-colors ${
										activeLine === idx
											? "bg-primary/15 text-foreground font-semibold"
											: "text-muted-foreground"
									}`}
									aria-current={activeLine === idx ? "step" : undefined}
								>
									{line}
								</li>
							))}
						</ol>
					</ControlPanel>
				</div>
			</div>
		</div>
	)
}
