/**
 * Zustand store for the graph editor + visualizer module.
 *
 * ## Store shape (design §6)
 * - Config (URL-serializable): algorithm, speed
 * - Topology (NOT URL-serialized): graph, labelSeq
 * - Editor: editMode, interaction, selection, startId
 * - Playback: status, cursor, result (RUN_STATUS re-exported from pathfinding-store)
 *
 * ## Out of store (per design decisions)
 * - canvas DOM refs — owned by GraphCanvas via useRef
 * - rAF id — owned by useStepPlayer
 * - getComputedStyle color cache — component-local
 *
 * ## Instant recompute (design §6, ADR-3)
 * Any topology mutation (add/remove node/edge, setDirected, setEdgeWeight, setStart,
 * setAlgorithm) triggers silentRecompute if status !== "idle".
 * moveNode is EXEMPT — positions don't affect BFS/DFS/MST outcomes.
 *
 * ## No persist middleware (NG2)
 * Graph topology intentionally NOT persisted to localStorage.
 */

import { create } from "zustand"
import { useShallow } from "zustand/react/shallow"

import type { EditMode, GraphData, GraphTraceResult } from "../lib/graph/types"
import { EDIT_MODE } from "../lib/graph/types"
import {
	addNode,
	addEdge,
	removeNode as libRemoveNode,
	moveNode as libMoveNode,
	removeEdge as libRemoveEdge,
	setEdgeWeight as libSetEdgeWeight,
	toggleDirected,
	clearGraph,
	loadSampleGraph as libLoadSampleGraph,
} from "../lib/graph/graph"
import { nodeAt, edgeAt, NODE_RADIUS, EDGE_THRESHOLD } from "../lib/graph/hit-test"
import { GRAPH_ALGORITHM_REGISTRY, GRAPH_ALGORITHM } from "../lib/algorithms/graph/index"
import type { GraphAlgorithm } from "../lib/algorithms/graph/index"
import { DEFAULT_SPEED } from "../lib/animation/speed-config"
import { RUN_STATUS, type RunStatus } from "./pathfinding-store"

// ---------------------------------------------------------------------------
// Re-export RUN_STATUS for consumers (same as sorting-store convention)
// ---------------------------------------------------------------------------

export type { RunStatus } from "./pathfinding-store"
export { RUN_STATUS } from "./pathfinding-store"

// ---------------------------------------------------------------------------
// Interaction substate — transient pointer gesture
// ---------------------------------------------------------------------------

export type Interaction =
	| { kind: "none" }
	| { kind: "moving"; nodeId: string }
	| { kind: "linking"; sourceId: string; x: number; y: number }

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export type Selection = { kind: "node" | "edge"; id: string } | null

// ---------------------------------------------------------------------------
// Store state + actions interface
// ---------------------------------------------------------------------------

export interface GraphState {
	// Config (URL-serializable)
	algorithm: GraphAlgorithm
	speed: number

	// Topology
	graph: GraphData
	labelSeq: number

	// Editor
	editMode: EditMode
	interaction: Interaction
	selection: Selection
	startId: string | null

	// Playback
	status: RunStatus
	cursor: number
	result: GraphTraceResult | null

	// -- Config actions --
	setAlgorithm: (alg: GraphAlgorithm) => void
	setSpeed: (speed: number) => void

	// -- Editor actions --
	setEditMode: (mode: EditMode) => void
	setStart: (nodeId: string | null) => void
	setSelection: (sel: Selection) => void
	clearSelection: () => void

	// -- Topology mutations (each triggers silentRecompute) --
	addNodeAt: (x: number, y: number) => void
	removeNode: (nodeId: string) => void
	addEdgeBetween: (sourceId: string, targetId: string, weight?: number) => void
	removeEdge: (edgeId: string) => void
	/** moveNode is EXEMPT from silentRecompute (positions don't affect algorithms) */
	moveNode: (nodeId: string, x: number, y: number) => void
	setEdgeWeight: (edgeId: string, weight: number) => void
	setDirected: (directed: boolean) => void
	loadSampleGraph: () => void
	clearAll: () => void

	// -- Interaction (transient gesture) actions --
	beginLink: (sourceId: string) => void
	updateLink: (x: number, y: number) => void
	endLink: (targetId: string | null) => void
	beginMove: (nodeId: string) => void
	endMove: () => void

	// -- Playback actions --
	run: () => void
	setCursor: (cursor: number) => void
	setStatus: (status: RunStatus) => void

	// -- Canvas pointer dispatchers --
	handleCanvasPointerDown: (x: number, y: number) => void
	handleCanvasPointerMove: (x: number, y: number) => void
	handleCanvasPointerUp: (x: number, y: number) => void

}

// ---------------------------------------------------------------------------
// Initial state values
// ---------------------------------------------------------------------------

const INITIAL_GRAPH = clearGraph()

const INITIAL_VALUES = {
	algorithm: GRAPH_ALGORITHM.BFS as GraphAlgorithm,
	speed: DEFAULT_SPEED,
	graph: INITIAL_GRAPH,
	labelSeq: 0,
	editMode: EDIT_MODE.SELECT as EditMode,
	interaction: { kind: "none" } as Interaction,
	selection: null as Selection,
	startId: null as string | null,
	status: RUN_STATUS.IDLE as RunStatus,
	cursor: 0,
	result: null as GraphTraceResult | null,
}

// ---------------------------------------------------------------------------
// silentRecompute helper (called within set/get closures)
// ---------------------------------------------------------------------------

function silentRecompute(
	get: () => GraphState,
	set: (partial: Partial<GraphState>) => void
): void {
	const { status, graph, algorithm, startId } = get()

	// No-op when idle — nothing to recompute
	if (status === RUN_STATUS.IDLE) return

	// During active playback (RUNNING or PAUSED), a topology edit would cause
	// split-brain: the store result and the player cursor would be out of sync.
	// Reset to IDLE so the user must explicitly re-run. (ADR-3, FIX 9)
	if (status === RUN_STATUS.RUNNING || status === RUN_STATUS.PAUSED) {
		set({ status: RUN_STATUS.IDLE, result: null, cursor: 0 })
		return
	}

	const entry = GRAPH_ALGORITHM_REGISTRY[algorithm]
	if (!entry) return

	// Guard: requiresStartNode but no startId
	if (entry.requiresStartNode && !startId) {
		set({ status: RUN_STATUS.NO_START_NODE, result: null, cursor: 0 })
		return
	}

	try {
		const result = entry.run(graph, startId ?? "")
		const lastCursor = Math.max(0, result.steps.length - 1)
		set({ result, cursor: lastCursor, status: RUN_STATUS.DONE })
	} catch {
		// If algo throws (e.g., start node deleted), reset to idle
		set({ status: RUN_STATUS.IDLE, result: null, cursor: 0 })
	}
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGraphStore = create<GraphState>()((set, get) => ({
	...INITIAL_VALUES,

	// ---------------------------------------------------------------------------
	// Config
	// ---------------------------------------------------------------------------

	setAlgorithm(alg) {
		set({ algorithm: alg })
		// Recompute if non-idle (algorithm change affects output)
		silentRecompute(get, set)
	},

	setSpeed(speed) {
		set({ speed })
	},

	// ---------------------------------------------------------------------------
	// Editor mode
	// ---------------------------------------------------------------------------

	setEditMode(mode) {
		// Always clear interaction on mode switch — no in-progress gesture state
		// should survive a mode change, regardless of which mode we're leaving.
		set({
			editMode: mode,
			selection: null,
			interaction: { kind: "none" },
		})
	},

	setStart(nodeId) {
		set({ startId: nodeId })
		silentRecompute(get, set)
	},

	setSelection(sel) {
		set({ selection: sel })
	},

	clearSelection() {
		set({ selection: null })
	},

	// ---------------------------------------------------------------------------
	// Topology mutations
	// ---------------------------------------------------------------------------

	addNodeAt(x, y) {
		const { graph, labelSeq } = get()
		const result = addNode(graph, x, y, labelSeq)
		if (result.nodeId === "") return // soft cap hit
		set({ graph: result.graph, labelSeq: labelSeq + 1 })
		silentRecompute(get, set)
	},

	removeNode(nodeId) {
		const { graph, startId, selection } = get()
		const newGraph = libRemoveNode(graph, nodeId)
		const updates: Partial<GraphState> = { graph: newGraph }
		// If the deleted node was the start node, clear startId
		if (startId === nodeId) {
			updates.startId = null
		}
		// Clear selection if it referenced the deleted node
		if (selection?.kind === "node" && selection.id === nodeId) {
			updates.selection = null
		}
		set(updates)
		silentRecompute(get, set)
	},

	addEdgeBetween(sourceId, targetId, weight = 1) {
		const { graph } = get()
		const result = addEdge(graph, sourceId, targetId, weight)
		if (!result) return // self-loop, parallel, missing endpoint
		set({ graph: result.graph })
		silentRecompute(get, set)
	},

	removeEdge(edgeId) {
		const { graph, selection } = get()
		const newGraph = libRemoveEdge(graph, edgeId)
		const updates: Partial<GraphState> = { graph: newGraph }
		// Clear selection if it referenced the deleted edge
		if (selection?.kind === "edge" && selection.id === edgeId) {
			updates.selection = null
		}
		set(updates)
		silentRecompute(get, set)
	},

	moveNode(nodeId, x, y) {
		// EXEMPT from silentRecompute — position changes don't affect BFS/DFS/MST
		const { graph } = get()
		const newGraph = libMoveNode(graph, nodeId, x, y)
		set({ graph: newGraph })
	},

	setEdgeWeight(edgeId, weight) {
		const { graph } = get()
		const newGraph = libSetEdgeWeight(graph, edgeId, weight)
		set({ graph: newGraph })
		silentRecompute(get, set)
	},

	setDirected(directed) {
		const { graph } = get()
		if (graph.directed === directed) return
		const newGraph = toggleDirected(graph)
		set({ graph: newGraph })
		silentRecompute(get, set)
	},

	loadSampleGraph() {
		const newGraph = libLoadSampleGraph()
		set({
			graph: newGraph,
			labelSeq: newGraph.nodes.size, // advance seq past existing labels
			startId: null,
			status: RUN_STATUS.IDLE,
			result: null,
			cursor: 0,
			interaction: { kind: "none" },
			selection: null,
		})
	},

	clearAll() {
		set({
			graph: clearGraph(),
			labelSeq: 0,
			startId: null,
			status: RUN_STATUS.IDLE,
			result: null,
			cursor: 0,
			interaction: { kind: "none" },
			selection: null,
		})
	},

	// ---------------------------------------------------------------------------
	// Interaction (transient gesture)
	// ---------------------------------------------------------------------------

	beginLink(sourceId) {
		const { graph } = get()
		const node = graph.nodes.get(sourceId)
		set({
			interaction: {
				kind: "linking",
				sourceId,
				x: node?.x ?? 0,
				y: node?.y ?? 0,
			},
		})
	},

	updateLink(x, y) {
		const { interaction } = get()
		if (interaction.kind !== "linking") return
		set({ interaction: { ...interaction, x, y } })
	},

	endLink(targetId) {
		const { interaction, graph } = get()
		if (interaction.kind !== "linking") return

		if (targetId && targetId !== interaction.sourceId) {
			// Attempt to create edge
			const result = addEdge(graph, interaction.sourceId, targetId)
			if (result) {
				set({ graph: result.graph, interaction: { kind: "none" } })
				silentRecompute(get, set)
				return
			}
		}
		// Cancel (invalid target or null)
		set({ interaction: { kind: "none" } })
	},

	beginMove(nodeId) {
		set({ interaction: { kind: "moving", nodeId } })
	},

	endMove() {
		set({ interaction: { kind: "none" } })
	},

	// ---------------------------------------------------------------------------
	// Playback
	// ---------------------------------------------------------------------------

	run() {
		const { graph, algorithm, startId } = get()
		const entry = GRAPH_ALGORITHM_REGISTRY[algorithm]
		if (!entry) return

		if (entry.requiresStartNode && !startId) {
			set({ status: RUN_STATUS.NO_START_NODE, result: null })
			return
		}

		const result = entry.run(graph, startId ?? "")
		const lastCursor = Math.max(0, result.steps.length - 1)
		set({ result, cursor: lastCursor, status: RUN_STATUS.DONE })
	},

	setCursor(cursor) {
		set({ cursor })
	},

	setStatus(status) {
		set({ status })
	},

	// ---------------------------------------------------------------------------
	// Canvas pointer dispatchers
	// ---------------------------------------------------------------------------

	handleCanvasPointerDown(x, y) {
		const { editMode, graph } = get()
		const hitNode = nodeAt(x, y, graph.nodes, NODE_RADIUS)

		switch (editMode) {
			case EDIT_MODE.ADD_NODE: {
				if (!hitNode) {
					get().addNodeAt(x, y)
				}
				break
			}
			case EDIT_MODE.ADD_EDGE: {
				if (hitNode) {
					get().beginLink(hitNode)
				}
				break
			}
			case EDIT_MODE.DELETE: {
				if (hitNode) {
					get().removeNode(hitNode)
				} else {
					const hitEdge = edgeAt(x, y, graph.edges, graph.nodes, EDGE_THRESHOLD)
					if (hitEdge) {
						get().removeEdge(hitEdge)
					}
				}
				break
			}
			case EDIT_MODE.SET_START: {
				if (hitNode) {
					get().setStart(hitNode)
				}
				break
			}
			case EDIT_MODE.MOVE_NODE: {
				if (hitNode) {
					get().beginMove(hitNode)
				}
				break
			}
			case EDIT_MODE.SELECT: {
				if (hitNode) {
					get().setSelection({ kind: "node", id: hitNode })
				} else {
					const hitEdge = edgeAt(x, y, graph.edges, graph.nodes, EDGE_THRESHOLD)
					if (hitEdge) {
						get().setSelection({ kind: "edge", id: hitEdge })
					} else {
						get().clearSelection()
					}
				}
				break
			}
		}
	},

	handleCanvasPointerMove(x, y) {
		const { interaction } = get()

		if (interaction.kind === "moving") {
			get().moveNode(interaction.nodeId, x, y)
		} else if (interaction.kind === "linking") {
			get().updateLink(x, y)
		}
	},

	handleCanvasPointerUp(x, y) {
		const { interaction, graph } = get()

		if (interaction.kind === "linking") {
			const hitNode = nodeAt(x, y, graph.nodes, NODE_RADIUS)
			get().endLink(hitNode)
		} else if (interaction.kind === "moving") {
			get().endMove()
		}
	},
}))

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function selectGraph(state: GraphState) {
	return state.graph
}

export function selectGraphUrlState(state: GraphState) {
	return { algorithm: state.algorithm, speed: state.speed }
}

export function selectGraphMetrics(state: GraphState) {
	return state.result?.metrics ?? null
}

export function selectGraphActiveLine(state: GraphState): number {
	if (!state.result) return -1
	return state.result.steps[state.cursor]?.line ?? -1
}

export function selectStartId(state: GraphState) {
	return state.startId
}

export function selectSelection(state: GraphState) {
	return state.selection
}

export function selectEditMode(state: GraphState) {
	return state.editMode
}

export function selectInteraction(state: GraphState) {
	return state.interaction
}

// Multi-field selector helper (use with useShallow)
export function selectPlaybackState(state: GraphState) {
	return {
		status: state.status,
		cursor: state.cursor,
		result: state.result,
		speed: state.speed,
	}
}

// Re-export useShallow for consumers
export { useShallow }
