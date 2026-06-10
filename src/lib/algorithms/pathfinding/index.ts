/**
 * Algorithm registry — maps algorithm slug to implementation + metadata.
 *
 * Consumed by the UI layer (AlgorithmControls, PseudocodePanel, PathfindingVisualizer)
 * to look up the pathfinder function, pseudocode lines, and display name for any
 * selected algorithm.
 *
 * ## Adding a new algorithm
 * 1. Implement it in its own file following the `Pathfinder` signature.
 * 2. Export `run*` function and a `*Pseudocode: PseudoLine[]` const.
 * 3. Add an entry to `ALGORITHM_REGISTRY` below.
 * 4. Extend the `Algorithm` union type.
 */

import type { Pathfinder, PseudoLine } from "./types"
import { runBfs, bfsPseudocode } from "./bfs"
import { runDfs, dfsPseudocode } from "./dfs"
import { runDijkstra, dijkstraPseudocode } from "./dijkstra"
import { runAstar, astarPseudocode } from "./astar"

// ---------------------------------------------------------------------------
// Algorithm union type — const-then-type pattern (typescript skill)
// ---------------------------------------------------------------------------

export const ALGORITHM = {
	ASTAR: "astar",
	DIJKSTRA: "dijkstra",
	BFS: "bfs",
	DFS: "dfs",
} as const

export type Algorithm = (typeof ALGORITHM)[keyof typeof ALGORITHM]

// ---------------------------------------------------------------------------
// Registry entry interface
// ---------------------------------------------------------------------------

export interface AlgorithmEntry {
	/** The pathfinder function — pure, deterministic. */
	run: Pathfinder
	/** Pseudocode lines co-located with the algorithm. */
	pseudocode: PseudoLine[]
	/** Human-readable display name for UI dropdowns/tabs. */
	label: string
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const ALGORITHM_REGISTRY: Record<Algorithm, AlgorithmEntry> = {
	astar: {
		run: runAstar,
		pseudocode: astarPseudocode,
		label: "A*",
	},
	dijkstra: {
		run: runDijkstra,
		pseudocode: dijkstraPseudocode,
		label: "Dijkstra",
	},
	bfs: {
		run: runBfs,
		pseudocode: bfsPseudocode,
		label: "BFS",
	},
	dfs: {
		run: runDfs,
		pseudocode: dfsPseudocode,
		label: "DFS",
	},
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export { runBfs, bfsPseudocode } from "./bfs"
export { runDfs, dfsPseudocode } from "./dfs"
export { runDijkstra, dijkstraPseudocode } from "./dijkstra"
export { runAstar, astarPseudocode } from "./astar"
export { generateMaze } from "./maze"
export type {
	Pathfinder,
	PathResult,
	PathOptions,
	PathMetrics,
	Step,
	StepKind,
	PseudoLine,
} from "./types"
export { STEP } from "./types"
