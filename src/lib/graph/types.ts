/**
 * Core type definitions for the graph editor module.
 *
 * Design principles (ADR-1 / design §2):
 * - Flat interfaces — no inline nested object types
 * - const-type pattern for all discriminated unions (typescript SKILL)
 * - Maps for O(1) id lookup; every mutation returns NEW Map instances (reactivity invariant)
 *
 * ## No React / DOM imports
 * This module is pure TypeScript — safe to import in Node/test/worker contexts.
 */

// ---------------------------------------------------------------------------
// Graph data model (G1)
// ---------------------------------------------------------------------------

/** A node in the graph. label is always present — auto-generated, never undefined. */
export interface GraphNode {
	id: string
	x: number
	y: number
	label: string
}

/** A directed or undirected edge between two nodes. */
export interface GraphEdge {
	id: string
	source: string
	target: string
	/** Always positive (> 0). Defaults to 1 when not supplied. */
	weight: number
}

/**
 * The complete graph topology.
 * Every mutation returns a NEW GraphData with fresh Map instances (ADR-1 reactivity invariant).
 */
export interface GraphData {
	nodes: Map<string, GraphNode>
	edges: Map<string, GraphEdge>
	/** When true, edges have direction (source → target). */
	directed: boolean
}

// ---------------------------------------------------------------------------
// Edit mode — const-type pattern (G7.2, typescript SKILL)
// ---------------------------------------------------------------------------

export const EDIT_MODE = {
	SELECT: "select",
	ADD_NODE: "add-node",
	ADD_EDGE: "add-edge",
	MOVE_NODE: "move-node",
	DELETE: "delete",
	SET_START: "set-start",
} as const

export type EditMode = (typeof EDIT_MODE)[keyof typeof EDIT_MODE]

// ---------------------------------------------------------------------------
// Graph step kinds — const-type pattern (design §5)
// ---------------------------------------------------------------------------

export const GRAPH_STEP_KIND = {
	VISIT: "visit",
	FRONTIER: "frontier",
	TREE_EDGE: "tree-edge",
	BACK_EDGE: "back-edge",
	MST_INCLUDE: "mst-include",
	MST_REJECT: "mst-reject",
} as const

export type GraphStepKind = (typeof GRAPH_STEP_KIND)[keyof typeof GRAPH_STEP_KIND]

// ---------------------------------------------------------------------------
// GraphStep discriminated union (design §5)
// ---------------------------------------------------------------------------

/** Node was dequeued / first processed. */
export type VisitStep = { kind: "visit"; nodeId: string; line: number }

/** Node was added to the queue / stack. */
export type FrontierStep = { kind: "frontier"; nodeId: string; line: number }

/** DFS tree edge traversal. */
export type TreeEdgeStep = { kind: "tree-edge"; fromId: string; toId: string; line: number }

/** DFS back-edge (cycle found). */
export type BackEdgeStep = { kind: "back-edge"; fromId: string; toId: string; line: number }

/** MST edge included. */
export type MstIncludeStep = { kind: "mst-include"; edgeId: string; line: number }

/** MST edge rejected (would form a cycle). */
export type MstRejectStep = { kind: "mst-reject"; edgeId: string; line: number }

/** Union of all graph step types — discriminate on `kind`. */
export type GraphStep =
	| VisitStep
	| FrontierStep
	| TreeEdgeStep
	| BackEdgeStep
	| MstIncludeStep
	| MstRejectStep

// ---------------------------------------------------------------------------
// Metrics and trace result (design §5)
// ---------------------------------------------------------------------------

/** Summary statistics for a graph algorithm run. */
export interface GraphMetrics {
	/** Number of nodes visited (dequeued/processed). */
	visitedCount: number
	/** Node ids in the order they were visited/dequeued. */
	traversalOrder: string[]
	/** Whether a cycle was detected (cycle detection algorithm). */
	cycleDetected?: boolean
	/** Number of back-edges found. */
	backEdgeCount?: number
	/** Sum of MST edge weights. */
	mstWeight?: number
	/** Number of edges in the MST. */
	mstEdgeCount?: number
}

/** Full result of running a graph algorithm. */
export interface GraphTraceResult {
	steps: GraphStep[]
	metrics: GraphMetrics
}

// ---------------------------------------------------------------------------
// Algorithm function contract
// ---------------------------------------------------------------------------

/** Options passed to graph algorithm runners. */
export interface GraphAlgorithmOptions {
	startId: string | null
}

/** Canonical graph algorithm signature — pure and deterministic. */
export type GraphAlgorithmFn = (
	graph: GraphData,
	options: GraphAlgorithmOptions
) => GraphTraceResult

// ---------------------------------------------------------------------------
// Pseudocode line (mirrors pathfinding PseudoLine)
// ---------------------------------------------------------------------------

export interface PseudoLine {
	id: number
	text: string
}
