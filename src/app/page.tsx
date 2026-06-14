import { ModuleGrid } from "@/components/layout/module-grid"

export const metadata = {
	title: "Algorithm Systems Playground",
	description: "Interactive visualizations of classic algorithms and data structures.",
}

export default function HomePage() {
	return (
		<div className="flex flex-1 flex-col gap-10 p-6 md:p-10">
			{/* Intro */}
			<section className="flex flex-col gap-3">
				<h1 className="text-foreground text-3xl font-bold tracking-tight">
					Algorithm Systems Playground
				</h1>
				<p className="text-muted-foreground max-w-2xl text-base">
					An interactive portfolio of classic computer-science algorithms — each implemented from
					scratch and rendered in real time. Choose a module below to step through graph traversals,
					pathfinding heuristics, discrete simulations, and performance comparisons.
				</p>
			</section>

			{/* Module grid */}
			<section aria-label="Modules">
				<ModuleGrid />
			</section>
		</div>
	)
}
