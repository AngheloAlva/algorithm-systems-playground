"use client"

/**
 * MetricsPanel — displays live run metrics for the pathfinding visualizer.
 *
 * Reads from the store via the `selectMetrics` selector so it only re-renders
 * when the metrics object changes (not on every cursor tick).
 *
 * Displays:
 *   - Visited cell count (updates as animation progresses via store cursor)
 *   - Path length (cell count, "—" when no path)
 *   - Path cost (sum of weights, "—" when no path)
 *
 * The ARIA live region announces final results to screen-reader users when
 * the run completes (status transitions to "done").
 *
 * @see design §8, spec §6.2
 */

import { usePathfindingStore, selectMetrics, RUN_STATUS } from "@/store/pathfinding-store"
import { ALGORITHM_REGISTRY } from "@/lib/algorithms/pathfinding/index"
import { useShallow } from "zustand/react/shallow"

export function MetricsPanel() {
	const metrics = usePathfindingStore(selectMetrics)
	const { status, algorithm } = usePathfindingStore(
		useShallow((s) => ({ status: s.status, algorithm: s.algorithm }))
	)

	// Build live-region announcement string when the run completes
	const liveAnnouncement =
		status === RUN_STATUS.DONE && metrics !== null
			? metrics.reachable
				? `${ALGORITHM_REGISTRY[algorithm].label} completed. Visited ${metrics.visitedCount} cells. Path length: ${metrics.pathLength}. Cost: ${metrics.pathCost}.`
				: `${ALGORITHM_REGISTRY[algorithm].label} completed. No path found.`
			: ""

	return (
		<div className="flex flex-col gap-2">
			{/* Screen-reader live region — polite so it doesn't interrupt ongoing speech */}
			<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
				{liveAnnouncement}
			</div>

			<h3 className="text-card-foreground text-xs font-semibold uppercase tracking-wider">
				Metrics
			</h3>

			<dl className="grid grid-cols-3 gap-2 text-sm">
				<div className="flex flex-col gap-0.5">
					<dt className="text-muted-foreground text-xs">Visited</dt>
					<dd className="text-foreground font-mono font-semibold">
						{metrics !== null ? metrics.visitedCount : "—"}
					</dd>
				</div>

				<div className="flex flex-col gap-0.5">
					<dt className="text-muted-foreground text-xs">Path length</dt>
					<dd className="text-foreground font-mono font-semibold">
						{metrics !== null && metrics.reachable ? metrics.pathLength : "—"}
					</dd>
				</div>

				<div className="flex flex-col gap-0.5">
					<dt className="text-muted-foreground text-xs">Cost</dt>
					<dd className="text-foreground font-mono font-semibold">
						{metrics !== null && metrics.reachable ? metrics.pathCost : "—"}
					</dd>
				</div>
			</dl>
		</div>
	)
}
