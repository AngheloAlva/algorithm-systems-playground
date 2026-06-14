import { Suspense } from "react"
import type { Metadata } from "next"
import { MODULES } from "@/config/modules"
import { PathfindingVisualizer } from "@/components/pathfinding/PathfindingVisualizer"

const mod = MODULES.find((m) => m.slug === "pathfinding")!

export const metadata: Metadata = {
	title: `${mod.title} — Algorithm Playground`,
	description: mod.description,
}

/**
 * PathfindingPage — server shell + Suspense-wrapped client island.
 *
 * The Suspense boundary is required by Next.js App Router whenever a client
 * component calls `useSearchParams()`. Without it the entire page would be
 * forced into CSR (client-side rendering) or throw a build-time error.
 *
 * The server shell (this component) stays statically renderable; only the
 * PathfindingVisualizer island is client-side (design §9, D10).
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/use-search-params#static-rendering
 */
export default function PathfindingPage() {
	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
			{/* Server-rendered header */}
			<header className="flex flex-col gap-1">
				<h1 className="text-foreground text-2xl font-bold tracking-tight">{mod.title}</h1>
				<p className="text-muted-foreground text-sm">{mod.description}</p>
			</header>

			{/* Client visualizer island — Suspense required for useSearchParams */}
			<Suspense
				fallback={
					<div className="bg-muted/30 border-border flex h-96 items-center justify-center rounded-lg border">
						<span className="text-muted-foreground text-sm">Loading visualizer…</span>
					</div>
				}
			>
				<PathfindingVisualizer />
			</Suspense>
		</div>
	)
}
