import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card"
import { MODULE_STATUS, MODULES } from "@/config/modules"
import { ArrowRightIcon } from "lucide-react"

export const metadata = {
	title: "Algorithm Systems Playground",
	description: "Interactive visualizations of classic algorithms and data structures.",
}

export default function HomePage() {
	return (
		<main className="flex flex-1 flex-col gap-10 p-6 md:p-10">
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
				<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" role="list">
					{MODULES.map((mod) => {
						const Icon = mod.icon
						const isAvailable = mod.status === MODULE_STATUS.AVAILABLE

						return (
							<li key={mod.slug}>
								<Card className="flex h-full flex-col transition-shadow hover:shadow-md">
									<CardHeader>
										<div className="mb-2 flex items-center gap-3">
											<div className="border-border bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg border">
												<Icon className="size-5" aria-hidden="true" />
											</div>
											<h2 className="text-foreground text-base leading-none font-semibold">
												{mod.title}
											</h2>
										</div>
										<CardDescription>{mod.description}</CardDescription>
									</CardHeader>

									<CardContent className="flex-1" />

									<CardFooter className="flex items-center justify-between">
										<span
											className={
												isAvailable
													? "border-border bg-primary/10 text-primary inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
													: "border-border bg-muted text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
											}
										>
											{isAvailable ? "Available" : "Coming soon"}
										</span>

										<Link
											href={`/${mod.slug}`}
											className="text-foreground focus-visible:ring-ring inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
											aria-label={`Open ${mod.title} module`}
										>
											Explore
											<ArrowRightIcon className="size-3.5" aria-hidden="true" />
										</Link>
									</CardFooter>
								</Card>
							</li>
						)
					})}
				</ul>
			</section>
		</main>
	)
}
