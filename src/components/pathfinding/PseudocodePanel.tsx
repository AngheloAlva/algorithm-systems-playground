"use client"

/**
 * PseudocodePanel — displays per-algorithm pseudocode with active-line highlight.
 *
 * The active line is derived from `selectActiveLine` — a pure projection of
 * `result.trace[cursor].line`. No separate sync mechanism is needed; the
 * highlight is accurate to the animation frame by design (design §8, M4).
 *
 * When no result exists or cursor is at 0 with no steps played, `activeLine`
 * is -1 and no line is highlighted (M4: no line highlighted in idle state).
 *
 * The panel is read-only and has no interactive elements.
 * Monospace font + scroll-into-view on the highlighted line.
 *
 * @see design §8, spec §6.1, M4
 */

import { useRef, useEffect } from "react"
import { usePathfindingStore, selectActiveLine } from "@/store/pathfinding-store"
import { ALGORITHM_REGISTRY } from "@/lib/algorithms/pathfinding/index"

export function PseudocodePanel() {
	const algorithm = usePathfindingStore((s) => s.algorithm)
	const activeLine = usePathfindingStore(selectActiveLine)
	const activeLineRef = useRef<HTMLLIElement | null>(null)

	const { pseudocode, label } = ALGORITHM_REGISTRY[algorithm]

	// Scroll the active line into view smoothly whenever it changes.
	// Guard for jsdom (test env) where scrollIntoView is not implemented.
	useEffect(() => {
		if (activeLineRef.current && typeof activeLineRef.current.scrollIntoView === "function") {
			activeLineRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" })
		}
	}, [activeLine])

	return (
		<div className="flex flex-col gap-2">
			<h3 className="text-card-foreground text-xs font-semibold uppercase tracking-wider">
				{label} pseudocode
			</h3>

			<ol
				className="border-border bg-muted/30 max-h-48 overflow-y-auto rounded-md border p-2"
				aria-label={`${label} pseudocode`}
			>
				{pseudocode.map((line) => {
					const isActive = line.id === activeLine
					return (
						<li
							key={line.id}
							ref={isActive ? activeLineRef : null}
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
	)
}
