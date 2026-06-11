/**
 * Graph algorithm registry.
 *
 * Follows the ALGORITHM_REGISTRY pattern from pathfinding (const-type pattern, typescript SKILL).
 * Each entry is self-contained: id, label, run function, pseudocode, requiresStartNode.
 *
 * PR 2a: BFS + DFS only.
 * PR 2b adds: cycle detection.
 * PR 2c adds: kruskal, prim.
 *
 * ## No React / DOM imports
 */

import type { GraphAlgorithmFn } from "../../graph/types"
import { runBFS, BFS_PSEUDOCODE } from "./bfs"
import { runDFS, DFS_PSEUDOCODE } from "./dfs"
import { runCycleDetection, CYCLE_DETECTION_PSEUDOCODE } from "./cycle-detection"
import { runKruskal, KRUSKAL_PSEUDOCODE } from "./kruskal"
import { runPrim, PRIM_PSEUDOCODE } from "./prim"

// ---------------------------------------------------------------------------
// Algorithm slug — const-type pattern (typescript SKILL)
// ---------------------------------------------------------------------------

export const GRAPH_ALGORITHM = {
	BFS: "bfs",
	DFS: "dfs",
	CYCLE: "cycle",
	KRUSKAL: "kruskal",
	PRIM: "prim",
} as const

export type GraphAlgorithm = (typeof GRAPH_ALGORITHM)[keyof typeof GRAPH_ALGORITHM]

// ---------------------------------------------------------------------------
// Registry entry type
// ---------------------------------------------------------------------------

export interface GraphAlgorithmEntry {
	id: string
	label: string
	run: GraphAlgorithmFn
	pseudocode: string[]
	requiresStartNode: boolean
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const GRAPH_ALGORITHM_REGISTRY: Record<string, GraphAlgorithmEntry> = {
	[GRAPH_ALGORITHM.BFS]: {
		id: GRAPH_ALGORITHM.BFS,
		label: "Breadth-First Search",
		run: runBFS,
		pseudocode: BFS_PSEUDOCODE,
		requiresStartNode: true,
	},
	[GRAPH_ALGORITHM.DFS]: {
		id: GRAPH_ALGORITHM.DFS,
		label: "Depth-First Search",
		run: runDFS,
		pseudocode: DFS_PSEUDOCODE,
		requiresStartNode: true,
	},
	[GRAPH_ALGORITHM.CYCLE]: {
		id: GRAPH_ALGORITHM.CYCLE,
		label: "Cycle Detection",
		run: runCycleDetection,
		pseudocode: [...CYCLE_DETECTION_PSEUDOCODE],
		requiresStartNode: false,
	},
	[GRAPH_ALGORITHM.KRUSKAL]: {
		id: GRAPH_ALGORITHM.KRUSKAL,
		label: "Kruskal's MST",
		run: runKruskal,
		pseudocode: KRUSKAL_PSEUDOCODE,
		requiresStartNode: false,
	},
	[GRAPH_ALGORITHM.PRIM]: {
		id: GRAPH_ALGORITHM.PRIM,
		label: "Prim's MST",
		run: runPrim,
		pseudocode: PRIM_PSEUDOCODE,
		requiresStartNode: false,
	},
}
